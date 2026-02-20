# ETHOS MK.I — Import Sage BOM/BOO Data (Revised)

## Objective

Import all Sage 200 Manufacturing BOM (Bill of Materials) and BOO (Bill of Operations) CSV/XLSX exports into the ETHOS MK.I PostgreSQL database. The data lives in `D:\Ethos\Bom Database` and covers 5 distinct Sage export types across multiple product families. The imported data must be queryable by product code, product family, and operation type to support downstream design, quoting, and production planning.

---

## Step 0 — File Inventory

There are **5 file types** and **22 files** in total:

### 0.1 StockItemsProfessional (10 files)
Master stock item register — every finished good, sub-assembly, raw material, and purchased part.

| File | Format | Product Family |
|------|--------|----------------|
| `StockItemsProfessional CSV MME Jan26 (Flood Door).csv` | CSV | Flood Door |
| `StockItemsProfessional CSV MME Jan26 (Flood Gate).csv` | CSV | Flood Gate |
| `StockItemsProfessional CSV MME Jan26 (Flood Glazing Wall).csv` | CSV | Flood Glazing Wall |
| `StockItemsProfessional CSV MME Jan26 (Fixings).csv` | CSV | Fixings |
| `StockItemsProfessional CSV MME Jan26 (Fixings).xlsx` | XLSX | Fixings (duplicate) |
| `StockItemsProfessional CSV MME Jan26 (Raw).csv` | CSV | Raw Materials |
| `StockItemsProfessional CSV MME Jan26 (Raw).xlsx` | XLSX | Raw Materials (duplicate) |
| `StockItemsProfessional CSV MME Jan26 (Stop Log).csv` | CSV | Stop Log |
| `StockItemsProfessional CSV MME Jan26 (Stop Log).xlsx` | XLSX | Stop Log (duplicate) |
| `StockItemsProfessional CSV MME Jan26 (Rack).xlsx` | XLSX | Rack (**XLSX only — no CSV**) |

> **Note:** Where both CSV and XLSX exist, prefer the CSV. For Rack, an XLSX parser is required (use `xlsx` or `exceljs` npm package).

### 0.2 BOM Header CSV (3 files)
Top-level BOM header — one row per finished-good / sub-assembly that has a bill of materials.

| File | Product Family |
|------|----------------|
| `BOM Header CSV MME Jan26 (Flood Door).csv` | Flood Door |
| `BOM Header CSV MME Jan26 (Flood Gate).csv` | Flood Gate |
| `BOM Header CSV MME Jan26 (Flood Glazing Wall).csv` | Flood Glazing Wall |

### 0.3 Component Header CVS (3 files)
BOM component lines — the child items / materials that make up each BOM header.

| File | Product Family |
|------|----------------|
| `Component Header CVS MME Jan26 (Flood Door Combined).csv` | Flood Door |
| `Component Header CVS MME Jan26 (Flood Gate Combined).csv` | Flood Gate |
| `Component Header CVS MME Jan26 (Flood Glazing Wall Combined).csv` | Flood Glazing Wall |

> **Note:** File prefix is "CVS" not "CSV" (typo in Sage export). Handle accordingly.

### 0.4 MSE Stock Item CSV (3 files)
Manufacturing settings per stock item — MRP rules, BOM item type, warehouse, scrap %, batch sizes.

| File | Product Family |
|------|----------------|
| `MSE Stock Item CSV MME Jan26 (Flood Door).csv` | Flood Door |
| `MSE Stock Item CSV MME Jan26 (Flood Gate).csv` | Flood Gate |
| `MSE Stock Item CSV MME Jan26 (Flood Glazing Wall).csv` | Flood Glazing Wall |

### 0.5 OperationStockItems CSV (3 files)
Bill of Operations (BOO) routing — manufacturing steps with labour hours, machine times, and subcontract details.

| File | Product Family |
|------|----------------|
| `OperationStockItems CSV MME Jan26 (Flood Door).csv` | Flood Door |
| `OperationStockItems CSV MME Jan26 (Flood Gate).csv` | Flood Gate |
| `OperationStockItems CSV MME Jan26 (Flood Glazing Wall).csv` | Flood Glazing Wall |

---

## Step 1 — CSV/XLSX Column Mapping

### 1.1 StockItemsProfessional Columns

Core fields:
```
Stock item code          → stockCode (PK, unique identifier e.g. "DFD-0001")
Stock item name          → name
Product group            → productGroup (e.g. "FG-FD", "RM-PP", "RM-EX", "SUB-AS")
Tax code                 → taxCode
Stock item description   → description
Manufacturer's name      → manufacturerName
Manufacturer's part number → manufacturerPartNo
Commodity code           → commodityCode
Net mass                 → netMass
Stock take days          → stockTakeDays
Allow Sales order        → allowSalesOrder (boolean: 1=true, 0=false)
```

Supplier fields:
```
Supplier                 → supplierRef
Supplier lead time       → supplierLeadTime
Supplier lead time unit  → supplierLeadTimeUnit
Supplier minimum quantity → supplierMinQty
Supplier usual order quantity → supplierUsualQty
Supplier part number     → supplierPartNo
```

Other:
```
Alternative item         → alternativeItemCode
Alternative item name    → alternativeItemName
Memo                     → memo
Barcode                  → barcode
```

Analysis key/value pairs (AnalysisName\1 through AnalysisName\20):
These are **dynamic** but in practice follow a known pattern. Parse them into structured fields:
```
AnalysisName\1  = "Product Family"       → productFamily (e.g. "Flood Door", "Flood Gate", "Stop Log")
AnalysisName\2  = "Item Set Type"        → itemSetType (e.g. "Double", "Single")
AnalysisName\3  = "Product Operation Type" → operationType (e.g. "Hinged", "Sliding")
AnalysisName\4  = "Material Composition"  → materialComposition (e.g. "Mild Steel", "Aluminium")
AnalysisName\5  = "Automation"           → automation (e.g. "Manual")
AnalysisName\6  = "Flooding Rating"      → floodingRating (e.g. "Standard", "None")
AnalysisName\7  = "Security Rating"      → securityRating (e.g. "None", "C5")
AnalysisName\8  = "Fire Rating"          → fireRating (e.g. "None", "E15")
AnalysisName\9  = "Blast Rating"         → blastRating
AnalysisName\10 = "Pressure Rating"      → pressureRating (e.g. "None")
AnalysisName\11 = "Thermal Rating"       → thermalRating (e.g. "None")
```

> **Important:** Not every stock item has analysis values populated (e.g. Fixings and Raw items leave them blank). Values 12-20 appear unused — store any non-empty ones in a JSON `extraAnalysis` field as a safety net.

Accounting fields (store but low priority for UI):
```
Asset of stock - account number/cost centre/department
Revenue - account number/cost centre/department
Accrued receipts - account number/cost centre/department
Issues - account number/cost centre/department
```

### 1.2 BOM Header Columns

```
Header Reference         → headerRef (PK, matches StockItemsProfessional.stockCode, e.g. "DFD-0001")
Description              → description
Manufacturing Instructions → manufacturingInstructions
Quality Standard         → qualityStandard
Effective From           → effectiveFrom (date, nullable)
Effective To             → effectiveTo (date, nullable)
Default Cost Quantity    → defaultCostQty (integer)
Use Only in BOM Module   → bomModuleOnly (boolean)
Revision                 → revision (string, nullable — for version tracking)
Default Build Quantity   → defaultBuildQty (integer)
Change Reference         → changeRef (string, nullable)
Component Traceability   → componentTraceability (boolean)
```

### 1.3 Component Header (BOM Lines) Columns

```
Header Reference (BOM Reference) → headerRef (FK → BOM Header)
Stock Code               → stockCode (FK → StockItem)
Description              → description
Notes                    → notes
Sequence Number          → sequenceNo (integer, ordering within BOM)
Quantity                 → quantity (decimal)
Instruction              → instruction
Unit of MEachsure        → unitOfMeasure (note: Sage export has typo "MEachsure")
Scrap Percentage         → scrapPercent (decimal)
Fixed Quantity           → fixedQuantity (boolean)
Use Only in BOM Module   → bomModuleOnly (boolean)
```

### 1.4 MSE Stock Item (Manufacturing Settings) Columns

```
StockCode                → stockCode (FK → StockItem)
AggregateDays            → aggregateDays (integer)
WOBatchMinQty            → woBatchMinQty (integer)
WOBatchMaxQty            → woBatchMaxQty (integer)
CanCancelWO              → canCancelWo (boolean)
CanCancelPO              → canCancelPo (boolean)
MRPReplenishmentRulesTypeID → mrpRulesTypeId (integer)
MRPReplenishmentMultipleValue → mrpMultipleValue (integer)
Linked                   → linked (boolean)
UseDemandWarehouse       → useDemandWarehouse (boolean)
UseWOCompletionWarehouse → useWoCompletionWarehouse (boolean)
ApplyReorderLevelAfterMaximum → applyReorderAfterMax (boolean)
ReplenishmentHorizonDays → replenishmentHorizonDays (integer)
BuiltBoughtDefaultMake   → defaultMake (boolean, TRUE = "Make", FALSE = "Buy")
BulkIssue                → bulkIssue (boolean)
BomItemType              → bomItemType (integer: 1=Stock, 2=Non-stock, 3=BOM, etc.)
DefaultWOWarehouse       → defaultWarehouse (string, e.g. "HOME")
ScrapPercent             → scrapPercent (decimal)
CostHeadingName          → costHeading (string, e.g. "Materials")
```

### 1.5 OperationStockItems (BOO Routing) Columns

Core:
```
Header Reference (BOM Reference) → headerRef (FK → BOM Header)
Sequence Number          → sequenceNo (integer, e.g. 10, 20, 30 — operation order)
Operation Reference      → operationRef (string code, e.g. "CUTTING", "WELDING", "ASSEMBLY")
Operation Description    → operationDescription (e.g. "Cutting & Kitting", "Fabrication & Welding")
Subcontract              → isSubcontract (boolean)
Nonprinting              → nonPrinting (boolean)
Shrinkage                → shrinkage (decimal)
Overlap Percentage       → overlapPercent (decimal, e.g. 100)
```

Run time:
```
Run-Time Hours           → runTimeHours (integer)
Run-Time Minutes         → runTimeMinutes (integer)
Run-Time Seconds         → runTimeSeconds (integer)
Quantity Per Run         → quantityPerRun (integer)
```

Delay:
```
Delay Hours              → delayHours (integer)
Delay Minutes            → delayMinutes (integer)
Delay Seconds            → delaySeconds (integer)
```

Setup:
```
Setup Hours              → setupHours (integer)
Setup Minutes            → setupMinutes (integer)
Setup Seconds            → setupSeconds (integer)
Setup Rate               → setupRate (decimal)
```

Labour:
```
Labour Reference         → labourRef (string, e.g. "Cutter", "WELDER_1", "Assembly", "Painting")
Labour Description       → labourDescription
Labour Notes             → labourNotes
Labour Rate              → labourRate (decimal)
Labour Hours             → labourHours (integer)
Labour Minutes           → labourMinutes (integer)
Labour Seconds           → labourSeconds (integer)
Setup Labour Resource Reference → setupLabourRef
Setup Labour Resource Description → setupLabourDesc
```

Machine (may be empty for manual operations):
```
Machine Reference        → machineRef
Machine Description      → machineDescription
Machine Notes            → machineNotes
Machine Rate             → machineRate (decimal)
Machine Hours            → machineHours (integer)
Machine Minutes          → machineMinutes (integer)
Machine Seconds          → machineSeconds (integer)
Setup Machine Resource Reference → setupMachineRef
Setup Machine Resource Description → setupMachineDesc
```

Tooling & subcontract:
```
Tooling Resource Reference → toolingRef
Tooling Resource Description → toolingDesc
Tooling Cost             → toolingCost (decimal)
Tooling Quantity         → toolingQty (integer)
Supplier Account Reference → supplierAccountRef
Order Reference          → orderRef
Order Details            → orderDetails
Lead Time                → leadTime (integer)
Saturday                 → saturday (boolean)
Sunday                   → sunday (boolean)
```

Subcontract quantity breaks (5 tiers — store as JSON array):
```
Subcontract Quantity Break From/To/Cost/Rate per Item/Hours Offsite 1..5
→ subcontractBreaks: Json  // [{from, to, cost, ratePerItem, hoursOffsite}, ...]
```

Flags:
```
LabourIsResourceGroup    → labourIsResourceGroup (boolean)
MachineIsResourceGroup   → machineIsResourceGroup (boolean)
```

Notes field:
```
Notes                    → notes
```

---

## Step 2 — Prisma Schema (New Models)

All new models are prefixed with `Sage` to clearly separate from existing ETHOS BOM models (`BaseBomItem`, `DesignBomLine`, `SpecBomMapping`, etc.).

```prisma
// ============================================================
// SAGE BOM/BOO IMPORT TABLES
// ============================================================

model SageStockItem {
  id                    String   @id @default(cuid())
  stockCode             String   @unique              // "DFD-0001", "PP-FIX-M10-0001", "RAW-CHS-0001"
  name                  String                        // "Double Flood Door"
  description           String?
  productGroup          String?                       // "FG-FD", "RM-PP", "RM-EX", "SUB-AS"
  taxCode               String?
  manufacturerName      String?
  manufacturerPartNo    String?
  commodityCode         String?
  netMass               Decimal? @db.Decimal(12, 4)
  stockTakeDays         Int?
  allowSalesOrder       Boolean  @default(false)
  barcode               String?
  memo                  String?

  // Supplier
  supplierRef           String?
  supplierLeadTime      Int?
  supplierLeadTimeUnit  String?
  supplierMinQty        Decimal? @db.Decimal(10, 2)
  supplierUsualQty      Decimal? @db.Decimal(10, 2)
  supplierPartNo        String?

  // Alternative
  alternativeItemCode   String?
  alternativeItemName   String?

  // Sage Analysis Fields (parsed from AnalysisName/Value pairs)
  productFamily         String?                       // "Flood Door", "Flood Gate", "Stop Log", etc.
  itemSetType           String?                       // "Double", "Single"
  operationType         String?                       // "Hinged", "Sliding"
  materialComposition   String?                       // "Mild Steel", "Aluminium"
  automation            String?                       // "Manual"
  floodingRating        String?                       // "Standard", "None"
  securityRating        String?                       // "None", "C5"
  fireRating            String?                       // "None", "E15"
  blastRating           String?
  pressureRating        String?                       // "None"
  thermalRating         String?                       // "None"
  extraAnalysis         Json?                         // Any analysis pairs 12-20 that have values

  // Accounting (stored for completeness, low UI priority)
  accountingData        Json?                         // {assetOfStock, revenue, accruedReceipts, issues}

  // Manufacturing settings (from MSE Stock Item files)
  bomItemType           Int?                          // 1=Stock, 2=Non-stock, 3=BOM
  defaultMake           Boolean?                      // TRUE=Make, FALSE=Buy
  defaultWarehouse      String?                       // "HOME"
  costHeading           String?                       // "Materials"
  scrapPercent          Decimal? @db.Decimal(5, 2)
  woBatchMinQty         Int?
  woBatchMaxQty         Int?
  bulkIssue             Boolean?
  mrpRulesTypeId        Int?
  mseData               Json?                         // Remaining MSE fields as JSON

  // Source tracking
  sourceFile            String?                       // Which file this was imported from
  importedAt            DateTime @default(now())
  updatedAt             DateTime @updatedAt

  // Relations
  bomHeader             SageBomHeader?
  componentLines        SageBomComponent[]            // Where this item is used AS a component
  operations            SageBomOperation[]

  @@index([productGroup])
  @@index([productFamily])
  @@index([stockCode])
  @@map("sage_stock_items")
}

model SageBomHeader {
  id                      String   @id @default(cuid())
  headerRef               String   @unique            // "DFD-0001" — matches stockCode
  description             String?
  manufacturingInstructions String?
  qualityStandard         String?
  effectiveFrom           DateTime?
  effectiveTo             DateTime?
  defaultCostQty          Int      @default(1)
  defaultBuildQty         Int      @default(1)
  bomModuleOnly           Boolean  @default(false)
  revision                String?
  changeRef               String?
  componentTraceability   Boolean  @default(false)

  // Source tracking
  sourceFile              String?
  importedAt              DateTime @default(now())
  updatedAt               DateTime @updatedAt

  // Relations
  stockItem               SageStockItem     @relation(fields: [headerRef], references: [stockCode])
  components              SageBomComponent[]
  operations              SageBomOperation[]

  @@index([headerRef])
  @@map("sage_bom_headers")
}

model SageBomComponent {
  id              String   @id @default(cuid())
  headerRef       String                              // FK → SageBomHeader.headerRef
  stockCode       String                              // FK → SageStockItem.stockCode (the child part)
  description     String?
  notes           String?
  sequenceNo      Int                                 // Ordering (10, 20, 30...)
  quantity        Decimal  @db.Decimal(10, 4)
  instruction     String?
  unitOfMeasure   String?                             // "Each", "Metres", etc.
  scrapPercent    Decimal  @default(0) @db.Decimal(5, 2)
  fixedQuantity   Boolean  @default(false)
  bomModuleOnly   Boolean  @default(false)

  // Source tracking
  sourceFile      String?
  importedAt      DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // Relations
  bomHeader       SageBomHeader   @relation(fields: [headerRef], references: [headerRef])
  stockItem       SageStockItem   @relation(fields: [stockCode], references: [stockCode])

  @@index([headerRef])
  @@index([stockCode])
  @@map("sage_bom_components")
}

model SageBomOperation {
  id                    String   @id @default(cuid())
  headerRef             String                        // FK → SageBomHeader.headerRef
  stockCode             String                        // FK → SageStockItem.stockCode (same as headerRef typically)
  sequenceNo            Int                           // 10, 20, 30... operation order
  operationRef          String                        // "CUTTING", "WELDING", "ASSEMBLY", etc.
  operationDescription  String?                       // "Cutting & Kitting", "Fabrication & Welding"
  isSubcontract         Boolean  @default(false)
  nonPrinting           Boolean  @default(false)
  shrinkage             Decimal? @db.Decimal(5, 2)
  overlapPercent        Decimal? @db.Decimal(5, 2)

  // Run time (total production time for the operation)
  runTimeHours          Int      @default(0)
  runTimeMinutes        Int      @default(0)
  runTimeSeconds        Int      @default(0)
  quantityPerRun        Int      @default(1)

  // Delay between operations
  delayHours            Int      @default(0)
  delayMinutes          Int      @default(0)
  delaySeconds          Int      @default(0)

  // Setup time
  setupHours            Int      @default(0)
  setupMinutes          Int      @default(0)
  setupSeconds          Int      @default(0)
  setupRate             Decimal? @db.Decimal(10, 2)

  // Labour
  labourRef             String?                       // "Cutter", "WELDER_1", "Assembly", "Painting"
  labourDescription     String?
  labourNotes           String?
  labourRate            Decimal? @db.Decimal(10, 2)
  labourHours           Int      @default(0)
  labourMinutes         Int      @default(0)
  labourSeconds         Int      @default(0)
  setupLabourRef        String?
  setupLabourDesc       String?

  // Machine
  machineRef            String?
  machineDescription    String?
  machineNotes          String?
  machineRate           Decimal? @db.Decimal(10, 2)
  machineHours          Int      @default(0)
  machineMinutes        Int      @default(0)
  machineSeconds        Int      @default(0)
  setupMachineRef       String?
  setupMachineDesc      String?

  // Tooling
  toolingRef            String?
  toolingDesc           String?
  toolingCost           Decimal? @db.Decimal(10, 2)
  toolingQty            Int?

  // Subcontract details
  supplierAccountRef    String?
  orderRef              String?
  orderDetails          String?
  leadTime              Int?
  saturday              Boolean  @default(false)
  sunday                Boolean  @default(false)
  subcontractBreaks     Json?                         // [{from, to, cost, ratePerItem, hoursOffsite}, ...]

  // Flags
  labourIsResourceGroup Boolean  @default(false)
  machineIsResourceGroup Boolean @default(false)
  notes                 String?

  // Computed convenience fields
  totalRunTimeMinutes   Decimal? @db.Decimal(10, 2)   // Auto-calculated: hours*60 + minutes + seconds/60
  totalLabourMinutes    Decimal? @db.Decimal(10, 2)   // Auto-calculated: labourHours*60 + labourMinutes + labourSeconds/60

  // Source tracking
  sourceFile            String?
  importedAt            DateTime @default(now())
  updatedAt             DateTime @updatedAt

  // Relations
  bomHeader             SageBomHeader   @relation(fields: [headerRef], references: [headerRef])
  parentStockItem       SageStockItem   @relation(fields: [stockCode], references: [stockCode])

  @@index([headerRef])
  @@index([stockCode])
  @@index([operationRef])
  @@map("sage_bom_operations")
}
```

---

## Step 3 — Import Script Logic

### 3.1 Dependencies

```bash
npm install csv-parse xlsx
```

- `csv-parse` — streaming CSV parser (handles quoted fields, commas in values)
- `xlsx` — XLSX parser (required for Rack file and optional XLSX duplicates)

### 3.2 Import Order (respects foreign keys)

1. **SageStockItem** — Parse all StockItemsProfessional files (CSV first, XLSX for Rack)
2. **SageStockItem update** — Merge MSE Stock Item data into existing SageStockItem rows by stockCode
3. **SageBomHeader** — Parse all BOM Header CSV files
4. **SageBomComponent** — Parse all Component Header CVS files
5. **SageBomOperation** — Parse all OperationStockItems CSV files

### 3.3 Deduplication Rules

- **StockItemsProfessional**: The same `stockCode` may appear in multiple product-family files (e.g. a fixing used by Flood Door AND Flood Gate). Use **upsert** on `stockCode` — first insert wins for core fields, but merge `productFamily` from the file context.
- **MSE Stock Item**: One row per stockCode. Match to existing SageStockItem and update manufacturing fields.
- **BOM Header / Component / Operation**: Unique by `(headerRef)` for headers, `(headerRef, sequenceNo)` for components and operations.

### 3.4 Parsing Rules

1. **Boolean fields**: Sage exports `TRUE`/`FALSE` as strings, and `1`/`0` for `allowSalesOrder`. Normalise all to JS booleans.
2. **Analysis pairs**: Loop `AnalysisName\1` through `AnalysisName\20`. Match known names (Product Family, Item Set Type, etc.) to structured fields. Any remaining non-empty pairs go into `extraAnalysis` JSON.
3. **Time fields**: Operation times are split across Hours/Minutes/Seconds columns. Also compute `totalRunTimeMinutes` and `totalLabourMinutes` as convenience decimals.
4. **Subcontract breaks**: Columns `Subcontract Quantity Break From 1` through `...5`. Collect non-empty break tiers into a JSON array.
5. **Empty strings**: Treat empty CSV values as `null`, not empty string.
6. **Decimal precision**: Quantities use `Decimal(10,4)`, costs use `Decimal(10,2)`, percentages use `Decimal(5,2)`.
7. **XLSX parsing** (Rack file): Use `xlsx.readFile()` → `xlsx.utils.sheet_to_json()` to get the same row objects as CSV parsing produces.

### 3.5 Script Location

Create the import script at:
```
scripts/sage-bom-import.ts
```

Run with:
```bash
npx tsx scripts/sage-bom-import.ts
```

### 3.6 Logging

- Print progress per file: `Importing StockItemsProfessional (Flood Door)... 45 items`
- Print totals at end: `Done! Imported: 312 stock items, 89 BOM headers, 1,247 components, 534 operations`
- Print any skipped/error rows with file name + line number

---

## Step 4 — Integration with Existing Models

The new `Sage*` tables are **read-only reference data** — they represent the Sage master data snapshot. They do NOT replace existing ETHOS models. Integration points:

1. **DesignBomLine.partNumber** — Can be looked up against `SageStockItem.stockCode` to pull description, supplier info, and cost heading
2. **BaseBomItem** — Future: auto-populate variant BOM templates from Sage BOM components
3. **Product.partCode** — May reference a `SageStockItem.stockCode` for finished goods
4. **ProductFamily** — The existing `ProductFamily` model codes should align with `SageStockItem.productFamily` values

> Do NOT create foreign key constraints between Sage tables and existing ETHOS tables at this stage. The Sage data is an imported snapshot; linking will be done in a later phase via application logic.

---

## Step 5 — Verification Queries

After import, verify with:

```sql
-- Count totals
SELECT 'stock_items' as t, COUNT(*) FROM sage_stock_items
UNION ALL SELECT 'bom_headers', COUNT(*) FROM sage_bom_headers
UNION ALL SELECT 'bom_components', COUNT(*) FROM sage_bom_components
UNION ALL SELECT 'bom_operations', COUNT(*) FROM sage_bom_operations;

-- Stock items by product group
SELECT "productGroup", COUNT(*) FROM sage_stock_items GROUP BY "productGroup" ORDER BY COUNT(*) DESC;

-- Stock items by product family
SELECT "productFamily", COUNT(*) FROM sage_stock_items WHERE "productFamily" IS NOT NULL GROUP BY "productFamily";

-- BOM with most components
SELECT h."headerRef", h.description, COUNT(c.id) as component_count
FROM sage_bom_headers h
JOIN sage_bom_components c ON c."headerRef" = h."headerRef"
GROUP BY h."headerRef", h.description
ORDER BY component_count DESC LIMIT 10;

-- Total labour hours by operation type
SELECT o."operationRef", o."operationDescription",
  COUNT(*) as count,
  SUM(o."totalLabourMinutes") / 60 as total_hours
FROM sage_bom_operations o
GROUP BY o."operationRef", o."operationDescription"
ORDER BY total_hours DESC;
```

---

## Step 6 — Admin UI (Future)

After import, build a read-only admin page at `/admin/sage-bom` with:
- Stock item search/browse (filterable by product group, product family)
- BOM explorer: click a header → see components tree + operations routing
- Operation summary: total hours per product, labour breakdown

This is **out of scope** for the import task but noted for planning.
