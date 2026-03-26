import { db } from "./db.js";

// Node type -> color 
export const NODE_META = {
  customer:         { color: "#93C5FD", border: "#3B82F6", hub: true },
  sales_order:      { color: "#93C5FD", border: "#3B82F6", hub: true },
  order_item:       { color: "#FCA5A5", border: "#EF4444", hub: false },
  delivery:         { color: "#93C5FD", border: "#3B82F6", hub: false },
  billing_document: { color: "#FCA5A5", border: "#EF4444", hub: false },
  journal_entry:    { color: "#FCA5A5", border: "#EF4444", hub: false },
  payment:          { color: "#FCA5A5", border: "#EF4444", hub: false },
  product:          { color: "#FCA5A5", border: "#EF4444", hub: false },
};

export function buildGraphJson(limit = 200) {
  const elements = [];
  const nodeIds  = new Set();
 
  const addNode = (id, label, type, data = {}) => {
    if (nodeIds.has(id)) return;
    nodeIds.add(id);
    elements.push({ data: { id, label, type, ...data } });
  };
 
  const addEdge = (source, target, label) => {
    if (!nodeIds.has(source) || !nodeIds.has(target)) return;
    elements.push({ data: {
      id: `e_${source}__${target}__${label}`.replace(/\s+/g,"_"),
      source, target, label
    }});
  };
 
  //  Customers 
  db.prepare(`SELECT bp.*, bpa.cityName, bpa.country
              FROM business_partners bp
              LEFT JOIN business_partner_addresses bpa USING (businessPartner)
              LIMIT ?`).all(limit).forEach(r => {
    addNode(`cust_${r.customer}`,
      r.fullName || r.orgName || r.customer, "customer", {
      customerId: r.customer, fullName: r.fullName, industry: r.industry,
      isBlocked: r.isBlocked, city: r.cityName, country: r.country,
      creationDate: r.creationDate,
    });
  });
 
  //  Sales orders 
  db.prepare(`SELECT * FROM sales_order_headers LIMIT ?`).all(limit).forEach(r => {
    addNode(`so_${r.salesOrder}`, `SO ${r.salesOrder}`, "sales_order", {
      salesOrder: r.salesOrder, salesOrderType: r.salesOrderType,
      soldToParty: r.soldToParty, totalNetAmount: r.totalNetAmount,
      currency: r.transactionCurrency, deliveryStatus: r.overallDeliveryStatus,
      billingStatus: r.overallOrdReltdBillgStatus,
      creationDate: r.creationDate, requestedDeliveryDate: r.requestedDeliveryDate,
      paymentTerms: r.customerPaymentTerms,
    });
    if (r.soldToParty) addEdge(`cust_${r.soldToParty}`, `so_${r.salesOrder}`, "placed");
  });
 
  //  Order items 
  db.prepare(`SELECT * FROM sales_order_items LIMIT ?`).all(limit).forEach(r => {
    const id = `soi_${r.salesOrder}_${r.salesOrderItem}`;
    addNode(id, `Item ${r.salesOrderItem}`, "order_item", {
      salesOrder: r.salesOrder, item: r.salesOrderItem,
      material: r.material, quantity: r.requestedQuantity,
      unit: r.requestedQuantityUnit, netAmount: r.netAmount,
      plant: r.productionPlant,
    });
    addEdge(`so_${r.salesOrder}`, id, "has item");
    if (r.material) {
      addNode(`prod_${r.material}`, r.material, "product", { material: r.material });
      addEdge(id, `prod_${r.material}`, "is material");
    }
  });
 
  //  Product descriptions (enrich product nodes) 
  db.prepare(`SELECT * FROM product_descriptions WHERE language = 'EN' LIMIT ?`).all(limit).forEach(r => {
    const id = `prod_${r.product}`;
    if (nodeIds.has(id)) {
      const el = elements.find(e => e.data.id === id);
      if (el) { el.data.label = r.productDescription; el.data.description = r.productDescription; }
    } else {
      addNode(id, r.productDescription || r.product, "product", {
        material: r.product, description: r.productDescription,
      });
    }
  });
 
  //  Deliveries 
  db.prepare(`SELECT * FROM outbound_delivery_headers LIMIT ?`).all(limit).forEach(r => {
    addNode(`del_${r.deliveryDocument}`, `DEL ${r.deliveryDocument}`, "delivery", {
      deliveryDocument: r.deliveryDocument,
      goodsMovementDate: r.actualGoodsMovementDate,
      goodsMovementStatus: r.overallGoodsMovementStatus,
      pickingStatus: r.overallPickingStatus,
      shippingPoint: r.shippingPoint, creationDate: r.creationDate,
    });
  });
 
  //  Delivery items -> link delivery to sales order 
  db.prepare(`SELECT * FROM outbound_delivery_items LIMIT ?`).all(limit).forEach(r => {
    if (r.referenceSdDocument) {
      addEdge(`so_${r.referenceSdDocument}`, `del_${r.deliveryDocument}`, "delivered via");
    }
    if (r.plant) {
      addNode(`plant_${r.plant}`, r.plant, "plant", { plant: r.plant });
      addEdge(`del_${r.deliveryDocument}`, `plant_${r.plant}`, "shipped from");
    }
  });
 
  //  Billing documents 
  db.prepare(`SELECT * FROM billing_document_headers LIMIT ?`).all(limit).forEach(r => {
    addNode(`bd_${r.billingDocument}`, `BD ${r.billingDocument}`, "billing_document", {
      billingDocument: r.billingDocument, billingDocumentType: r.billingDocumentType,
      billingDocumentDate: r.billingDocumentDate, totalNetAmount: r.totalNetAmount,
      currency: r.transactionCurrency, companyCode: r.companyCode,
      fiscalYear: r.fiscalYear, accountingDocument: r.accountingDocument,
      isCancelled: r.isCancelled, soldToParty: r.soldToParty,
    });
    if (r.soldToParty) addEdge(`cust_${r.soldToParty}`, `bd_${r.billingDocument}`, "billed to");
  });
 
  //  Billing items -> link billing to sales order 
  db.prepare(`SELECT DISTINCT billingDocument, referenceSdDocument FROM billing_document_items
              WHERE referenceSdDocument IS NOT NULL LIMIT ?`).all(limit).forEach(r => {
    addEdge(`so_${r.referenceSdDocument}`, `bd_${r.billingDocument}`, "billed as");
  });
 
  //  Journal entries 
  db.prepare(`SELECT accountingDocument, companyCode, fiscalYear, referenceDocument,
                     transactionCurrency, accountingDocumentType, postingDate, documentDate,
                     SUM(amountInTransactionCurrency) as totalAmount
              FROM journal_entry_items GROUP BY accountingDocument LIMIT ?`).all(limit).forEach(r => {
    addNode(`je_${r.accountingDocument}`, `JE ${r.accountingDocument}`, "journal_entry", {
      accountingDocument: r.accountingDocument, companyCode: r.companyCode,
      fiscalYear: r.fiscalYear, referenceDocument: r.referenceDocument,
      totalAmount: r.totalAmount, currency: r.transactionCurrency,
      postingDate: r.postingDate, documentDate: r.documentDate,
      accountingDocumentType: r.accountingDocumentType,
    });
    if (r.referenceDocument) addEdge(`bd_${r.referenceDocument}`, `je_${r.accountingDocument}`, "generates");
  });
 
  //  Payments 
  db.prepare(`SELECT accountingDocument, companyCode, fiscalYear, customer,
                     invoiceReference, salesDocument,
                     SUM(amountInTransactionCurrency) as totalAmount,
                     transactionCurrency, clearingDate, postingDate
              FROM payments GROUP BY accountingDocument LIMIT ?`).all(limit).forEach(r => {
    addNode(`pay_${r.accountingDocument}`, `PAY ${r.accountingDocument}`, "payment", {
      accountingDocument: r.accountingDocument, invoiceReference: r.invoiceReference,
      salesDocument: r.salesDocument, totalAmount: r.totalAmount,
      currency: r.transactionCurrency, clearingDate: r.clearingDate, customer: r.customer,
    });
    if (r.invoiceReference) addEdge(`bd_${r.invoiceReference}`,  `pay_${r.accountingDocument}`, "settled by");
    if (r.salesDocument)    addEdge(`so_${r.salesDocument}`,     `pay_${r.accountingDocument}`, "paid via");
    if (r.customer)         addEdge(`cust_${r.customer}`,        `pay_${r.accountingDocument}`, "made payment");
  });
 
  //  Annotate connection count 
  const connCount = {};
  elements.forEach(el => {
    if (el.data.source) {
      connCount[el.data.source] = (connCount[el.data.source] || 0) + 1;
      connCount[el.data.target] = (connCount[el.data.target] || 0) + 1;
    }
  });
  elements.forEach(el => {
    if (!el.data.source) el.data.connections = connCount[el.data.id] || 0;
  });
 
  return { elements };
}
 
export function expandNode(nodeId) {
  const full = buildGraphJson(1000);
  const edges = full.elements.filter(e => e.data.source === nodeId || e.data.target === nodeId);
  const ids   = new Set([nodeId, ...edges.flatMap(e => [e.data.source, e.data.target])]);
  const nodes = full.elements.filter(e => !e.data.source && ids.has(e.data.id));
  return { elements: [...nodes, ...edges] };
}