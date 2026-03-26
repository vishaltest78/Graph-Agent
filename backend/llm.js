import { GoogleGenAI } from "@google/genai";
import { db } from "./db.js";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

const MODEL = "gemini-2.5-flash";

const SCHEMA = `
SQLite tables (SAP Order-to-Cash dataset):

business_partners(businessPartner, customer[PK], fullName, orgName, firstName, lastName,
  industry, isBlocked, creationDate)

business_partner_addresses(businessPartner[PK], addressId, cityName, country,
  postalCode, region, streetName, transportZone)

sales_order_headers(salesOrder[PK], salesOrderType, salesOrganization, distributionChannel,
  soldToParty→business_partners.customer, creationDate, totalNetAmount[REAL],
  transactionCurrency, overallDeliveryStatus, overallOrdReltdBillgStatus,
  requestedDeliveryDate, headerBillingBlockReason, deliveryBlockReason,
  customerPaymentTerms, pricingDate)

sales_order_items(salesOrder→sales_order_headers, salesOrderItem, material→products,
  requestedQuantity[REAL], requestedQuantityUnit, netAmount[REAL], transactionCurrency,
  materialGroup, productionPlant, storageLocation, rejectionReason, billingBlockReason)

sales_order_schedule_lines(salesOrder, salesOrderItem, scheduleLine,
  confirmedDeliveryDate, orderQuantityUnit, confirmedQty[REAL])

products(product[PK], productType, productGroup, baseUnit, division,
  grossWeight[REAL], netWeight[REAL], weightUnit, isMarkedForDeletion, creationDate)

product_descriptions(product→products, language, productDescription)

product_plants(product, plant, countryOfOrigin, profitCenter, mrpType)

outbound_delivery_headers(deliveryDocument[PK], actualGoodsMovementDate, creationDate,
  deliveryBlockReason, overallGoodsMovementStatus, overallPickingStatus,
  overallProofOfDeliveryStatus, shippingPoint, incompletionStatus, headerBillingBlockReason)

outbound_delivery_items(deliveryDocument→outbound_delivery_headers, deliveryDocumentItem,
  plant→plants, storageLocation, material→products,
  actualDeliveryQuantity[REAL], deliveryQuantityUnit,
  referenceSdDocument→sales_order_headers.salesOrder, referenceSdDocumentItem)

billing_document_headers(billingDocument[PK], billingDocumentType, creationDate,
  billingDocumentDate, isCancelled, cancelledBillingDoc, totalNetAmount[REAL],
  transactionCurrency, companyCode, fiscalYear,
  accountingDocument→journal_entry_items.accountingDocument,
  soldToParty→business_partners.customer)

billing_document_items(billingDocument→billing_document_headers, billingDocumentItem,
  material→products, billingQuantity[REAL], billingQuantityUnit, netAmount[REAL],
  transactionCurrency,
  referenceSdDocument→outbound_delivery_headers.deliveryDocument,
  referenceSdDocumentItem)

journal_entry_items(id, companyCode, fiscalYear, accountingDocument, accountingDocumentItem,
  glAccount, referenceDocument→billing_document_headers.billingDocument,
  transactionCurrency, amountInTransactionCurrency[REAL], companyCodeCurrency,
  amountInCompanyCodeCurrency[REAL], postingDate, documentDate, accountingDocumentType,
  customer→business_partners.customer, costCenter, profitCenter,
  clearingDate, clearingAccountingDocument, assignmentReference, financialAccountType)

payments(id, companyCode, fiscalYear, accountingDocument, accountingDocumentItem,
  clearingDate, clearingAccountingDocument, clearingDocFiscalYear,
  amountInTransactionCurrency[REAL], transactionCurrency,
  amountInCompanyCodeCurrency[REAL], companyCodeCurrency,
  customer→business_partners.customer,
  postingDate, documentDate, glAccount, profitCenter)

plants(plant[PK], plantName, salesOrganization, distributionChannel, division,
  plantCategory, addressId)
`;

const SYSTEM_INSTRUCTION = `You are a senior data analyst for a SAP Order-to-Cash (O2C) ERP system.
You have access to a SQLite database with real SAP business data.
ONLY answer questions about: sales orders, deliveries, billing, journal entries, payments, customers, products, plants.

${SCHEMA}

 VERIFIED JOIN PATHS (tested against real data — use exactly as shown) 

  Customer → Order:
    business_partners.customer = sales_order_headers.soldToParty

  Order → Items:
    sales_order_headers.salesOrder = sales_order_items.salesOrder

  Item → Product name:
    sales_order_items.material = product_descriptions.product
    AND product_descriptions.language = 'EN'

  Order → Delivery:
    outbound_delivery_items.referenceSdDocument = sales_order_headers.salesOrder
    outbound_delivery_items.deliveryDocument = outbound_delivery_headers.deliveryDocument

  Delivery → Plant:
    outbound_delivery_items.plant = plants.plant

  Billing → Delivery (KEY: billing items link to delivery docs, NOT sales orders):
    billing_document_items.billingDocument = billing_document_headers.billingDocument
    billing_document_items.referenceSdDocument = outbound_delivery_headers.deliveryDocument

  Billing → Journal Entry (use accountingDocument, NOT referenceDocument):
    billing_document_headers.accountingDocument = journal_entry_items.accountingDocument

  Billing → Journal Entry (alternative via referenceDocument):
    journal_entry_items.referenceDocument = billing_document_headers.billingDocument

  Product → Billing:
    billing_document_items.material = products.product

  Customer → Billing:
    billing_document_headers.soldToParty = business_partners.customer

  Journal → Payment:
    journal_entry_items.clearingAccountingDocument = payments.accountingDocument

 CORRECT FULL O2C TRACE (Sales Order → Delivery → Billing → Journal Entry) 

  Use this EXACT join chain for any full flow / end-to-end trace query:

    FROM billing_document_headers bdh
    LEFT JOIN billing_document_items bdi
      ON bdi.billingDocument = bdh.billingDocument
    LEFT JOIN outbound_delivery_headers odh
      ON odh.deliveryDocument = bdi.referenceSdDocument
    LEFT JOIN outbound_delivery_items odi
      ON odi.deliveryDocument = odh.deliveryDocument
    LEFT JOIN sales_order_headers soh
      ON soh.salesOrder = odi.referenceSdDocument
    LEFT JOIN journal_entry_items jei
      ON jei.accountingDocument = bdh.accountingDocument

   CRITICAL RULES — violating these will produce NULL results:
    1. billing_document_items.referenceSdDocument links to DELIVERY documents, not sales orders.
       NEVER join billing_document_items.referenceSdDocument to sales_order_headers.salesOrder.
    2. Use billing_document_headers.accountingDocument = journal_entry_items.accountingDocument
       to link billing to journal entries (NOT journal_entry_items.referenceDocument).
    3. payments.invoiceReference and payments.salesDocument are NULL in this dataset.
       Do NOT use payments to bridge billing and sales orders.
    4. Always use LEFT JOIN so incomplete records still appear in results.

 STATUS CODES 

  overallDeliveryStatus / overallOrdReltdBillgStatus:
    'C' = Fully complete   'B' = Partially complete
    'A' = Not yet started  '' or NULL = Not started
  isCancelled = 'true' means the billing document is cancelled.

 QUERY RULES 

  1. ONLY answer questions about this SAP Order-to-Cash business dataset.
  2. If the question is off-topic (general knowledge, weather, coding help, jokes,
     creative writing, math, politics, or anything unrelated to this ERP dataset),
     respond with ONLY this exact JSON and nothing else:
     {"action":"reject","message":"This system only answers questions about the Order-to-Cash dataset (orders, deliveries, billing, payments, customers, products)."}
  3. For valid business questions respond with ONLY this JSON — no markdown, no text outside JSON:
     {"action":"query","sql":"<valid SQLite SELECT>","explanation":"<one sentence>"}
  4. NEVER generate DROP, DELETE, INSERT, UPDATE, CREATE, or ALTER statements.
  5. Always use LEFT JOIN — never INNER JOIN — for flow trace queries.
  6. Add LIMIT 100 to all non-aggregate queries.
  7. Use ONLY the exact table and column names defined above.
  8. For product names always join product_descriptions with language = 'EN'.
  9. Incomplete flows: delivered but not billed = overallOrdReltdBillgStatus != 'C';
     billed but not delivered = overallDeliveryStatus != 'C'.
`;

//  SQL safety guard 
function runSQL(sql) {
  const forbidden = /\b(drop|delete|insert|update|create|alter|truncate)\b/i;
  if (forbidden.test(sql)) throw new Error("Forbidden SQL operation blocked");
  return db.prepare(sql).all();
}

//  Gemini call 
async function callGemini(contents, systemInstruction) {
  const resp = await ai.models.generateContent({
    model: MODEL,
    contents,
    config: { systemInstruction, temperature: 0.1 },
  });
  return resp.text;
}

//  Strip any markdown/code fences the LLM sneaks in 
function stripFences(text) {
  return text
    .replace(/^```(?:html|json|sql|markdown)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
}

//  Format answer as HTML ─
async function formatAnswer(question, sql, rows) {
  const prompt =
    `The user asked: "${question}"\n` +
    `SQL executed: ${sql}\n` +
    `Total rows returned: ${rows.length}\n` +
    `First 10 rows:\n${JSON.stringify(rows.slice(0, 10), null, 2)}\n\n` +
    `Write a clear, accurate, concise, user friendly answer based ONLY on this data.\n` +
    `Include document numbers, amounts, counts, and dates from the results.\n` +
    `If results are empty, clearly state no matching records were found.\n` +
    `If some fields are NULL, mention which part of the flow is missing.\n\n` +
    `STRICT FORMAT RULES:\n` +
    `- Respond in plain HTML only using: <b>, <br>, <ul>, <li>\n` +
    `- Do NOT use markdown, asterisks, backticks, pound signs, or code fences\n` +
    `- Do NOT wrap the response in any code block or \`\`\`html fence`;

  const raw = await callGemini(
    prompt,
    `You are a business data analyst. Answer concisely based only on the provided query results.
     Always respond in plain HTML only. Never use markdown. Never wrap in code blocks.
     Start your response directly with HTML content — no preamble.`
  );
  return stripFences(raw);
}

//  Main export 
export async function processQuery(userMessage) {
  // Step 1: NL → SQL
  const raw = await callGemini(userMessage, SYSTEM_INSTRUCTION);
  const clean = stripFences(raw);

  let parsed;
  try {
    parsed = JSON.parse(clean);
  } catch {
    return {
      type: "reject",
      message: "This system only answers questions about the Order-to-Cash dataset.",
    };
  }

  if (parsed.action === "reject") {
    return { type: "reject", message: parsed.message };
  }

  // Step 2: Execute SQL safely
  let rows;
  try {
    rows = runSQL(parsed.sql);
  } catch (e) {
    return {
      type: "error",
      message: `Query failed: ${e.message}`,
      sql: parsed.sql,
    };
  }

  // Step 3: Format as HTML
  const answer = await formatAnswer(userMessage, parsed.sql, rows);

  return {
    type: "answer",
    answer,
    sql: parsed.sql,
    explanation: parsed.explanation,
    rowCount: rows.length,
    data: rows.slice(0, 50),
  };
}