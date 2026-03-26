# Order-to-Cash Graph Query System

A graph-based data exploration and natural language query interface for SAP Order-to-Cash data.

## Architecture

### Tech Stack
| Layer | Choice | Reason |
|---|---|---|
| Backend | Node.js + Express | Single language across full stack |
| Database | SQLite (better-sqlite3) | Zero-infra, perfect for NL→SQL, fast reads |
| Graph | In-memory from SQLite | No separate graph DB needed at this data scale |
| LLM | Google Gemini 1.5 Flash | Free tier, fast, reliable JSON output |
| Graph UI | Cytoscape.js | Best-in-class for network graphs in browser |
| Frontend | React + Vite | Fast dev setup, component-based |

### Data Flow
```
User question
  → Gemini: NL → SQL (with schema in system prompt)
  → SQLite: Execute query
  → Gemini: SQL results → Natural language answer
  → Chat UI: Display answer + collapsible SQL
```

### Graph Model
- **Nodes**: customers, sales_orders, order_items, deliveries, billing_documents, journal_entries, payments, products
- **Edges**: placed, has_item, is_material, billed_to, generates, settled_by, paid_via

### Key Relationships (SAP O2C)
```
business_partners.customer
  → sales_order_headers.soldToParty        (customer placed order)
  → billing_documents.soldToParty          (customer billed)
  → payments.customer                      (customer paid)

sales_order_headers.salesOrder
  → sales_order_items.salesOrder           (order line items)
  → payments.salesDocument                 (payment reference)

billing_documents.billingDocument
  → journal_entry_items.referenceDocument  (accounting entry)
  → payments.invoiceReference              (payment against invoice)

billing_documents.accountingDocument
  → journal_entry_items.accountingDocument (journal link)
```

## LLM Prompting Strategy

**Two-step approach:**
1. **Step 1 (NL → SQL)**: System prompt contains full schema with FK relationships. Gemini returns strict JSON `{action, sql, explanation}`. JSON-only output prevents hallucination.
2. **Step 2 (Answer synthesis)**: Raw SQL results passed back to Gemini with the original question for natural language formatting.

**Guardrails** — the system prompt explicitly:
- Lists the exact tables and columns available
- Instructs the model to reject off-topic questions with a specific JSON `{action: "reject"}` response
- Bans mutating SQL keywords (enforced server-side too)
- Limits results to 100 rows

## Running Locally

```bash
# 1. Setup
git clone <repo>
cd graph-query-system

# 2. Backend
cd backend
npm install
echo "GEMINI_API_KEY=your_key_here" > .env

# Copy dataset
mkdir -p ../data
cp -r /path/to/sap-o2c-data ../data/

# Ingest data (one time)
npm run ingest

# Start backend
npm run dev   # runs on http://localhost:3001

# 3. Frontend (new terminal)
cd ../frontend
npm install
npm run dev   # runs on http://localhost:5173
```

## Example Queries
- "Which products are associated with the highest number of billing documents?"
- "Trace the full flow of billing document 91150187"
- "Find sales orders that were delivered but not billed"
- "Show me all payments made by customer X"
- "What is the total net amount of sales orders created in 2024?"
