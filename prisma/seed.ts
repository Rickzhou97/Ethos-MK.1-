import { config } from "dotenv"
config()

async function loadPrisma() {
  const pg = await import("pg")
  const adapterMod = await import("@prisma/adapter-pg")
  const mod = await import("../src/generated/prisma/client.js")

  const pool = new pg.default.Pool({ connectionString: process.env.DATABASE_URL })
  const adapter = new adapterMod.PrismaPg(pool)
  return new mod.PrismaClient({ adapter })
}

let prisma: any

async function main() {
  prisma = await loadPrisma()
  console.log("Seeding database...")

  // Clean existing data
  await prisma.document.deleteMany()
  await prisma.purchaseOrderLine.deleteMany()
  await prisma.purchaseOrder.deleteMany()
  await prisma.quoteLine.deleteMany()
  await prisma.quote.deleteMany()
  await prisma.product.deleteMany()
  await prisma.productCatalogue.deleteMany()
  await prisma.project.deleteMany()
  await prisma.customerContact.deleteMany()
  await prisma.customer.deleteMany()
  await prisma.supplierContact.deleteMany()
  await prisma.supplier.deleteMany()
  await prisma.user.deleteMany()

  // ========================================
  // USERS (Designers & Coordinators)
  // ========================================
  console.log("Creating users...")
  // Default password for all seeded users: password123
  const { hash } = await import("bcryptjs")
  const defaultHash = await hash("password123", 10)

  const users = await Promise.all([
    prisma.user.create({ data: { name: "James Morton", email: "james.morton@mme.co.uk", passwordHash: defaultHash, role: "ADMIN" } }),
    prisma.user.create({ data: { name: "Gregg Hughes", email: "gregg.hughes@mme.co.uk", passwordHash: defaultHash, role: "PROJECT_COORDINATOR" } }),
    prisma.user.create({ data: { name: "Kelan Taylor", email: "kelan.taylor@mme.co.uk", passwordHash: defaultHash, role: "PROJECT_COORDINATOR" } }),
    prisma.user.create({ data: { name: "Shaun Griffiths", email: "shaun.griffiths@mme.co.uk", passwordHash: defaultHash, role: "PROJECT_COORDINATOR" } }),
    prisma.user.create({ data: { name: "Samuel Roberts", email: "samuel.roberts@mme.co.uk", passwordHash: defaultHash, role: "PROJECT_COORDINATOR" } }),
    prisma.user.create({ data: { name: "Andrew Robinson", email: "andrew.robinson@mme.co.uk", passwordHash: defaultHash, role: "PROJECT_COORDINATOR" } }),
    prisma.user.create({ data: { name: "Reece Hobson", email: "reece.hobson@mme.co.uk", passwordHash: defaultHash, role: "PROJECT_COORDINATOR" } }),
    prisma.user.create({ data: { name: "Dave Howells", email: "dave.howells@mme.co.uk", passwordHash: defaultHash, role: "PROJECT_COORDINATOR" } }),
    prisma.user.create({ data: { name: "Richard Guest", email: "richard.guest@mme.co.uk", passwordHash: defaultHash, role: "PROJECT_COORDINATOR" } }),
    prisma.user.create({ data: { name: "Corey Thomas", email: "corey.thomas@mme.co.uk", passwordHash: defaultHash, role: "PROJECT_COORDINATOR" } }),
    prisma.user.create({ data: { name: "Stephen McDermid", email: "stephen.mcdermid@mme.co.uk", passwordHash: defaultHash, role: "PROJECT_COORDINATOR" } }),
    prisma.user.create({ data: { name: "Marc Pridmore", email: "marc.pridmore@mme.co.uk", passwordHash: defaultHash, role: "PROJECT_COORDINATOR" } }),
    prisma.user.create({ data: { name: "Martin McDermid", email: "martin.mcdermid@mme.co.uk", passwordHash: defaultHash, role: "PROJECT_COORDINATOR" } }),
    prisma.user.create({ data: { name: "Adam Parry", email: "adam.parry@mme.co.uk", passwordHash: defaultHash, role: "ESTIMATOR" } }),
  ])

  const userMap = Object.fromEntries(users.map((u) => [u.name, u]))

  // ========================================
  // CUSTOMERS
  // ========================================
  console.log("Creating customers...")
  const customers = await Promise.all([
    prisma.customer.create({ data: { name: "BAM Nuttall Limited", customerType: "MAIN_CONTRACTOR", paymentTerms: "60 days" } }),
    prisma.customer.create({ data: { name: "SP Energy Networks", customerType: "UTILITY", paymentTerms: "30 days" } }),
    prisma.customer.create({ data: { name: "UK Power Networks", customerType: "UTILITY", paymentTerms: "30 days" } }),
    prisma.customer.create({ data: { name: "National Grid", customerType: "UTILITY", paymentTerms: "30 days" } }),
    prisma.customer.create({ data: { name: "Scottish Power", customerType: "UTILITY", paymentTerms: "30 days" } }),
    prisma.customer.create({ data: { name: "Skanska", customerType: "MAIN_CONTRACTOR", paymentTerms: "60 days" } }),
    prisma.customer.create({ data: { name: "JN Bentley", customerType: "MAIN_CONTRACTOR", paymentTerms: "45 days" } }),
    prisma.customer.create({ data: { name: "Graham Construction", customerType: "MAIN_CONTRACTOR", paymentTerms: "60 days" } }),
    prisma.customer.create({ data: { name: "Conack", customerType: "DIRECT", paymentTerms: "30 days" } }),
    prisma.customer.create({ data: { name: "Enisca Browne", customerType: "MAIN_CONTRACTOR", paymentTerms: "45 days" } }),
    prisma.customer.create({ data: { name: "Volker Stevin", customerType: "MAIN_CONTRACTOR", paymentTerms: "45 days" } }),
    prisma.customer.create({ data: { name: "Palmer Construction", customerType: "MAIN_CONTRACTOR", paymentTerms: "30 days" } }),
    prisma.customer.create({ data: { name: "Ducron Construction Ltd", customerType: "MAIN_CONTRACTOR", paymentTerms: "30 days" } }),
    prisma.customer.create({ data: { name: "Charles Brand Group Limited", customerType: "MAIN_CONTRACTOR", paymentTerms: "30 days" } }),
    prisma.customer.create({ data: { name: "Luddon Construction Ltd", customerType: "MAIN_CONTRACTOR", paymentTerms: "30 days" } }),
    prisma.customer.create({ data: { name: "John Sisk & Son Limited", customerType: "MAIN_CONTRACTOR", paymentTerms: "60 days" } }),
    prisma.customer.create({ data: { name: "Alun Griffiths (Contractors) Ltd", customerType: "MAIN_CONTRACTOR", paymentTerms: "30 days" } }),
    prisma.customer.create({ data: { name: "Manweb", customerType: "UTILITY", paymentTerms: "30 days" } }),
  ])

  const custMap = Object.fromEntries(customers.map((c) => [c.name, c]))

  // ========================================
  // SUPPLIERS
  // ========================================
  console.log("Creating suppliers...")
  await Promise.all([
    prisma.supplier.create({ data: { name: "Joseph Ash Galvanising", whatTheySupply: "Hot-dip galvanising", paymentTerms: "30 days" } }),
    prisma.supplier.create({ data: { name: "Metalweb", whatTheySupply: "Steel stockholders", paymentTerms: "30 days" } }),
    prisma.supplier.create({ data: { name: "Barrett Steel", whatTheySupply: "Steel stockholders", paymentTerms: "30 days" } }),
    prisma.supplier.create({ data: { name: "Viking Rubber", whatTheySupply: "Rubber seals", paymentTerms: "30 days" } }),
    prisma.supplier.create({ data: { name: "Brammer Buck & Hickman", whatTheySupply: "Fixings and hardware", paymentTerms: "30 days" } }),
    prisma.supplier.create({ data: { name: "Nationwide Platforms", whatTheySupply: "Access equipment hire", paymentTerms: "30 days" } }),
  ])

  // ========================================
  // PRODUCT CATALOGUE
  // ========================================
  console.log("Creating product catalogue...")
  const catalogueItems = [
    { partCode: "AFB-0001", description: "Aluminium flood barrier" },
    { partCode: "AFGW-0001", description: "Aluminium Flood Glass Wall" },
    { partCode: "BFDSFG-0001", description: "Bi-Folding Double Flood Gate" },
    { partCode: "BFSFG-0001", description: "Bi-Folding Single Flood Gate" },
    { partCode: "BW-0001", description: "Blast Window" },
    { partCode: "DB-0001", description: "Demountable Barrier - 200mm board height" },
    { partCode: "DB-0002", description: "Demountable Barrier - 300mm board height" },
    { partCode: "DB-0003", description: "Demountable Barrier - 100mm board depth" },
    { partCode: "DBD-0001", description: "Double Blast Door - Type Low Response Level" },
    { partCode: "DBD-0003", description: "Double Blast Door - Type HRL" },
    { partCode: "DBG-0001", description: "Double Bund Gate" },
    { partCode: "DBGEXC3-0001", description: "Double Bund Gate - EXC3" },
    { partCode: "DFD-0001", description: "Double Flood Door" },
    { partCode: "DFG-0001", description: "Double Flood Gate" },
    { partCode: "DFGEXC3-0001", description: "Double Flood Gate - EXC3" },
    { partCode: "FFSBG-0001", description: "Face-Fixed Single Bund Gate" },
    { partCode: "FFSFG-0001", description: "Face-Fixed Single Flood Gate" },
    { partCode: "FLOODWALL", description: "Steel Flood Wall" },
    { partCode: "FPC-0001", description: "Flood Cabinet - four-sided with single access" },
    { partCode: "FPC-0002", description: "Flood Cabinet - four-sided with double access" },
    { partCode: "FPK-0001", description: "Flood Kiosk" },
    { partCode: "HDBG-0001", description: "Hydraulic Double Bund Gate" },
    { partCode: "HDFG-0001", description: "Hydraulic Double Flood Gate" },
    { partCode: "HDFGEXC3-0001", description: "Hydraulic Double Flood Gate - EXC3" },
    { partCode: "L151-0002", description: "L151 Double Door" },
    { partCode: "PFG-0001", description: "Pedestrian Flood Gate" },
    { partCode: "PFGEXC3-0001", description: "Pedestrian Flood Gate - EXC3" },
    { partCode: "PV-0001", description: "Pivot Barrier" },
    { partCode: "SBD-0001", description: "Single Blast Door - Type LRL" },
    { partCode: "SBD-0003", description: "Single Blast Door - Type HRL" },
    { partCode: "SBG-0001", description: "Single Bund Gate" },
    { partCode: "SBGEXC3-0001", description: "Single Bund Gate - EXC3" },
    { partCode: "SFD-0001", description: "Single Flood Door" },
    { partCode: "SFDC5-0001", description: "C5 Security Single Flood Door" },
    { partCode: "SFG-0001", description: "Single Flood Gate" },
    { partCode: "SFG-0002", description: "Single Flood Gate with Integrated Palisade Fence" },
    { partCode: "SFGEXC3-0001", description: "Single Flood Gate - EXC3" },
    { partCode: "SFGEXC3-0002", description: "Single Flood Gate with Integrated Palisade Fence - EXC3" },
    { partCode: "SLSFG-0001", description: "Sliding Single Flood Gate" },
    { partCode: "TRANS-0001", description: "Transom above doorset" },
    { partCode: "VB-0001", description: "Vent Barrier" },
  ]

  await prisma.productCatalogue.createMany({ data: catalogueItems })

  // ========================================
  // PROJECTS & PRODUCTS (from real tracker data)
  // ========================================
  console.log("Creating projects and products...")

  // Project 200710 - Essex Flood Gates Package 2
  const p200710 = await prisma.project.create({
    data: {
      projectNumber: "200710",
      name: "Essex Flood Gates Package 2",
      customerId: custMap["BAM Nuttall Limited"].id,
      coordinatorId: userMap["Richard Guest"].id,
      projectManagerId: userMap["Richard Guest"].id,
      projectType: "BESPOKE_MAJOR",
      workStream: "COMMUNITY",
      salesStage: "ORDER",
      projectStatus: "INSTALLATION",
      contractType: "NEC",
      siteLocation: "Essex, UK",
      enquiryReceived: new Date("2024-06-01"),
      orderReceived: new Date("2025-01-15"),
      targetCompletion: new Date("2026-06-30"),
    },
  })

  // Products for 200710
  const essexProducts = [
    { partCode: "DB-0001", description: "Demountable Barrier - 200mm board height", details: "Mill Beach 7 - Demountable Barrier", jobNo: "200710-12-1", dept: "PLANNING" as const, designStatus: "Signed off", prodStatus: "COMPLETED" as const, designer: "Gregg Hughes", due: "2026-01-05" },
    { partCode: "DB-0001", description: "Demountable Barrier - 200mm board height", details: "Highams Farm - Demountable Barrier", jobNo: "200710-5-1", dept: "PLANNING" as const, designStatus: "Signed off", prodStatus: "COMPLETED" as const, designer: "Gregg Hughes", due: "2026-01-09" },
    { partCode: "DB-0001", description: "Demountable Barrier - 200mm board height", details: "Sandford Mill - Demountable Barrier", jobNo: "200710-4-1", dept: "PLANNING" as const, designStatus: "Signed off", prodStatus: "COMPLETED" as const, designer: "Gregg Hughes", due: "2026-01-15" },
    { partCode: "SFGEXC3-0001", description: "Single Flood Gate - EXC3", details: "Bounds Farm - Single Flood Gate - EXC3", jobNo: "200710-1-1", dept: "REVIEW" as const, designStatus: "Signed off", prodStatus: "COMPLETED" as const, designer: "Gregg Hughes", due: "2026-03-24" },
    { partCode: "SFGEXC3-0001", description: "Single Flood Gate - EXC3", details: "Sandford Mill - Single Flood Gate - EXC3", jobNo: "200710-4-2", dept: "INSTALLATION" as const, designStatus: "Signed off", prodStatus: "COMPLETED" as const, designer: "Gregg Hughes", due: "2026-04-01" },
    { partCode: "DFGEXC3-0001", description: "Double Flood Gate - EXC3", details: "Highams Farm - Double Flood Gate - EXC3", jobNo: "200710-5-2", dept: "PRODUCTION" as const, designStatus: "Signed off", prodStatus: "FABRICATION" as const, designer: "Gregg Hughes", due: "2026-04-15" },
    { partCode: "HDFGEXC3-0001", description: "Hydraulic Double Flood Gate - EXC3", details: "Springfield Basin - HDFG", jobNo: "200710-6-1", dept: "DESIGN" as const, designStatus: "GA Design", prodStatus: null, designer: "Gregg Hughes", due: "2026-05-01" },
    { partCode: "SFGEXC3-0001", description: "Single Flood Gate - EXC3", details: "Heybridge - SFG - EXC3", jobNo: "200710-7-1", dept: "DESIGN" as const, designStatus: "Awaiting Calcs", prodStatus: null, designer: "Gregg Hughes", due: "2026-05-15" },
    { partCode: "PFG-0001", description: "Pedestrian Flood Gate", details: "Springfield Basin - PFG", jobNo: "200710-6-2", dept: "DESIGN" as const, designStatus: "Pre-Design", prodStatus: null, designer: "Gregg Hughes", due: "2026-05-20" },
    { partCode: "FLOODWALL", description: "Steel Flood Wall", details: "Chelmsford - Flood Wall Section A", jobNo: "200710-8-1", dept: "DESIGN" as const, designStatus: "Pre-Design", prodStatus: null, designer: "Gregg Hughes", due: "2026-06-01" },
  ]

  for (const p of essexProducts) {
    await prisma.product.create({
      data: {
        projectId: p200710.id,
        partCode: p.partCode,
        description: p.description,
        additionalDetails: p.details,
        productJobNumber: p.jobNo,
        quantity: 1,
        currentDepartment: p.dept,
        designStatus: p.designStatus,
        productionStatus: p.prodStatus,
        allocatedDesignerId: userMap[p.designer]?.id,
        coordinatorId: userMap["Richard Guest"].id,
        requiredCompletionDate: new Date(p.due),
      },
    })
  }

  // Project 101485 - NEGED Substations
  const p101485 = await prisma.project.create({
    data: {
      projectNumber: "101485",
      name: "NEGED Substations",
      customerId: custMap["SP Energy Networks"].id,
      coordinatorId: userMap["Corey Thomas"].id,
      projectManagerId: userMap["Corey Thomas"].id,
      projectType: "STANDARD",
      workStream: "UTILITIES",
      salesStage: "ORDER",
      projectStatus: "MANUFACTURE",
      contractType: "FRAMEWORK_CALLOFF",
      siteLocation: "North East England",
      enquiryReceived: new Date("2025-03-01"),
      orderReceived: new Date("2025-06-01"),
      targetCompletion: new Date("2026-04-30"),
    },
  })

  const negedProducts = [
    { partCode: "SFD-0001", description: "Single Flood Door", details: "Chester-le-Street Primary", jobNo: "101485-1-1", dept: "PRODUCTION" as const, prodStatus: "PAINTING" as const, designer: "Kelan Taylor", due: "2026-02-15" },
    { partCode: "SFD-0001", description: "Single Flood Door", details: "Spennymoor Primary", jobNo: "101485-2-1", dept: "PRODUCTION" as const, prodStatus: "FABRICATION" as const, designer: "Kelan Taylor", due: "2026-02-20" },
    { partCode: "DFD-0001", description: "Double Flood Door", details: "Darlington Primary", jobNo: "101485-3-1", dept: "PRODUCTION" as const, prodStatus: "FITTING" as const, designer: "Kelan Taylor", due: "2026-02-28" },
    { partCode: "SFD-0001", description: "Single Flood Door", details: "Barnard Castle Primary", jobNo: "101485-4-1", dept: "PRODUCTION" as const, prodStatus: "CUTTING" as const, designer: "Kelan Taylor", due: "2026-03-05" },
    { partCode: "DFD-0001", description: "Double Flood Door", details: "Consett Primary", jobNo: "101485-5-1", dept: "DESIGN" as const, prodStatus: null, designer: "Kelan Taylor", due: "2026-03-15" },
    { partCode: "SFD-0001", description: "Single Flood Door", details: "Bishop Auckland Primary", jobNo: "101485-6-1", dept: "DESIGN" as const, prodStatus: null, designer: "Kelan Taylor", due: "2026-03-20" },
    { partCode: "TRANS-0001", description: "Transom above doorset", details: "Chester-le-Street Transom", jobNo: "101485-1-2", dept: "PRODUCTION" as const, prodStatus: "PAINTING" as const, designer: "Kelan Taylor", due: "2026-02-15" },
    { partCode: "SFD-0001", description: "Single Flood Door", details: "Hexham Primary", jobNo: "101485-7-1", dept: "PLANNING" as const, prodStatus: null, designer: "Kelan Taylor", due: "2026-04-01" },
  ]

  for (const p of negedProducts) {
    await prisma.product.create({
      data: {
        projectId: p101485.id,
        partCode: p.partCode,
        description: p.description,
        additionalDetails: p.details,
        productJobNumber: p.jobNo,
        quantity: 1,
        currentDepartment: p.dept,
        productionStatus: p.prodStatus,
        allocatedDesignerId: userMap[p.designer]?.id,
        coordinatorId: userMap["Corey Thomas"].id,
        requiredCompletionDate: new Date(p.due),
      },
    })
  }

  // Project 200670 - Paignton & Preston
  const p200670 = await prisma.project.create({
    data: {
      projectNumber: "200670",
      name: "Paignton & Preston Coastal Flood Defence",
      customerId: custMap["Skanska"].id,
      coordinatorId: userMap["Stephen McDermid"].id,
      projectManagerId: userMap["James Morton"].id,
      projectType: "BESPOKE_MAJOR",
      workStream: "COMMUNITY",
      salesStage: "ORDER",
      projectStatus: "DESIGN",
      contractType: "NEC",
      siteLocation: "Devon, UK",
      enquiryReceived: new Date("2024-09-01"),
      orderReceived: new Date("2025-04-01"),
      targetCompletion: new Date("2026-09-30"),
    },
  })

  const paigntonProducts = [
    { partCode: "SFGEXC3-0001", description: "Single Flood Gate - EXC3", details: "Preston Seafront - SFG 1", jobNo: "200670-1-1", dept: "DESIGN" as const, designer: "Shaun Griffiths", due: "2026-04-01" },
    { partCode: "SFGEXC3-0001", description: "Single Flood Gate - EXC3", details: "Preston Seafront - SFG 2", jobNo: "200670-1-2", dept: "DESIGN" as const, designer: "Shaun Griffiths", due: "2026-04-15" },
    { partCode: "DFGEXC3-0001", description: "Double Flood Gate - EXC3", details: "Paignton Harbour - DFG", jobNo: "200670-2-1", dept: "DESIGN" as const, designer: "Shaun Griffiths", due: "2026-05-01" },
    { partCode: "HDFGEXC3-0001", description: "Hydraulic Double Flood Gate - EXC3", details: "Paignton Harbour - HDFG", jobNo: "200670-3-1", dept: "PLANNING" as const, designer: "Shaun Griffiths", due: "2026-06-01" },
    { partCode: "FLOODWALL", description: "Steel Flood Wall", details: "Preston Beach - Flood Wall Section", jobNo: "200670-4-1", dept: "PLANNING" as const, designer: "Shaun Griffiths", due: "2026-07-01" },
    { partCode: "DB-0001", description: "Demountable Barrier - 200mm board height", details: "Paignton Promenade - Demountable", jobNo: "200670-5-1", dept: "PLANNING" as const, designer: "Shaun Griffiths", due: "2026-08-01" },
  ]

  for (const p of paigntonProducts) {
    await prisma.product.create({
      data: {
        projectId: p200670.id,
        partCode: p.partCode,
        description: p.description,
        additionalDetails: p.details,
        productJobNumber: p.jobNo,
        quantity: 1,
        currentDepartment: p.dept,
        allocatedDesignerId: userMap[p.designer]?.id,
        coordinatorId: userMap["Stephen McDermid"].id,
        requiredCompletionDate: new Date(p.due),
      },
    })
  }

  // Project 200672 - Bustleholme
  const p200672 = await prisma.project.create({
    data: {
      projectNumber: "200672",
      name: "Bustleholme Flood Defence - National Grid",
      customerId: custMap["National Grid"].id,
      coordinatorId: userMap["Marc Pridmore"].id,
      projectManagerId: userMap["Marc Pridmore"].id,
      projectType: "BESPOKE_MAJOR",
      workStream: "BUND_CONTAINMENT",
      salesStage: "ORDER",
      projectStatus: "MANUFACTURE",
      contractType: "STANDARD",
      siteLocation: "West Bromwich, West Midlands",
      enquiryReceived: new Date("2024-11-01"),
      orderReceived: new Date("2025-03-01"),
      targetCompletion: new Date("2026-05-31"),
    },
  })

  const bustleholmeProducts = [
    { partCode: "DBGEXC3-0001", description: "Double Bund Gate - EXC3", details: "Transformer Bay 1 - DBG", jobNo: "200672-1-1", dept: "PRODUCTION" as const, prodStatus: "PACKING" as const, designer: "Samuel Roberts", due: "2026-02-10" },
    { partCode: "SBGEXC3-0001", description: "Single Bund Gate - EXC3", details: "Transformer Bay 2 - SBG", jobNo: "200672-2-1", dept: "PRODUCTION" as const, prodStatus: "PAINTING" as const, designer: "Samuel Roberts", due: "2026-02-15" },
    { partCode: "DBGEXC3-0001", description: "Double Bund Gate - EXC3", details: "Transformer Bay 3 - DBG", jobNo: "200672-3-1", dept: "PRODUCTION" as const, prodStatus: "SHOTBLASTING" as const, designer: "Samuel Roberts", due: "2026-02-20" },
    { partCode: "FLOODWALL", description: "Steel Flood Wall", details: "Perimeter Flood Wall Section A", jobNo: "200672-4-1", dept: "PRODUCTION" as const, prodStatus: "FABRICATION" as const, designer: "Samuel Roberts", due: "2026-03-01" },
    { partCode: "FLOODWALL", description: "Steel Flood Wall", details: "Perimeter Flood Wall Section B", jobNo: "200672-4-2", dept: "PRODUCTION" as const, prodStatus: "CUTTING" as const, designer: "Samuel Roberts", due: "2026-03-15" },
    { partCode: "SBG-0001", description: "Single Bund Gate", details: "Access Gate - North", jobNo: "200672-5-1", dept: "DESIGN" as const, designer: "Samuel Roberts", due: "2026-04-01" },
  ]

  for (const p of bustleholmeProducts) {
    await prisma.product.create({
      data: {
        projectId: p200672.id,
        partCode: p.partCode,
        description: p.description,
        additionalDetails: p.details,
        productJobNumber: p.jobNo,
        quantity: 1,
        currentDepartment: p.dept,
        productionStatus: p.prodStatus || null,
        allocatedDesignerId: userMap[p.designer]?.id,
        coordinatorId: userMap["Marc Pridmore"].id,
        requiredCompletionDate: new Date(p.due),
      },
    })
  }

  // Project 200401 - Bolney
  const p200401 = await prisma.project.create({
    data: {
      projectNumber: "200401",
      name: "Bolney",
      customerId: custMap["Ducron Construction Ltd"].id,
      coordinatorId: userMap["Richard Guest"].id,
      projectManagerId: userMap["Richard Guest"].id,
      projectType: "STANDARD",
      workStream: "UTILITIES",
      salesStage: "ORDER",
      projectStatus: "INSTALLATION",
      contractType: "STANDARD",
      siteLocation: "Bolney, West Sussex",
      enquiryReceived: new Date("2024-08-01"),
      orderReceived: new Date("2024-12-01"),
      targetCompletion: new Date("2026-03-31"),
    },
  })

  const bolneyProducts = [
    { partCode: "SFD-0001", description: "Single Flood Door", details: "Bolney Sub - Door 1", jobNo: "200401-1-1", dept: "INSTALLATION" as const, prodStatus: "COMPLETED" as const, designer: "Kelan Taylor", due: "2026-02-01" },
    { partCode: "SFD-0001", description: "Single Flood Door", details: "Bolney Sub - Door 2", jobNo: "200401-1-2", dept: "INSTALLATION" as const, prodStatus: "COMPLETED" as const, designer: "Kelan Taylor", due: "2026-02-01" },
    { partCode: "DFD-0001", description: "Double Flood Door", details: "Bolney Sub - Double Door", jobNo: "200401-2-1", dept: "INSTALLATION" as const, prodStatus: "COMPLETED" as const, designer: "Kelan Taylor", due: "2026-02-15" },
    { partCode: "SBG-0001", description: "Single Bund Gate", details: "Bolney Sub - Bund Gate", jobNo: "200401-3-1", dept: "PRODUCTION" as const, prodStatus: "DISPATCHED" as const, designer: "Kelan Taylor", due: "2026-02-20" },
  ]

  for (const p of bolneyProducts) {
    await prisma.product.create({
      data: {
        projectId: p200401.id,
        partCode: p.partCode,
        description: p.description,
        additionalDetails: p.details,
        productJobNumber: p.jobNo,
        quantity: 1,
        currentDepartment: p.dept,
        productionStatus: p.prodStatus || null,
        allocatedDesignerId: userMap[p.designer]?.id,
        coordinatorId: userMap["Richard Guest"].id,
        requiredCompletionDate: new Date(p.due),
      },
    })
  }

  // Project 101339 - SP Johnstone Primary
  const p101339 = await prisma.project.create({
    data: {
      projectNumber: "101339",
      name: "SP Johnstone Primary",
      customerId: custMap["SP Energy Networks"].id,
      coordinatorId: userMap["Corey Thomas"].id,
      projectManagerId: userMap["Corey Thomas"].id,
      projectType: "STANDARD",
      workStream: "UTILITIES",
      salesStage: "ORDER",
      projectStatus: "REVIEW",
      contractType: "FRAMEWORK_CALLOFF",
      siteLocation: "Johnstone, Scotland",
      enquiryReceived: new Date("2025-01-01"),
      orderReceived: new Date("2025-04-01"),
      targetCompletion: new Date("2026-01-31"),
    },
  })

  const johnstoneProducts = [
    { partCode: "SFD-0001", description: "Single Flood Door", details: "Johnstone Primary - Door 1", jobNo: "101339-1-1", dept: "REVIEW" as const, prodStatus: "COMPLETED" as const },
    { partCode: "SFD-0001", description: "Single Flood Door", details: "Johnstone Primary - Door 2", jobNo: "101339-1-2", dept: "REVIEW" as const, prodStatus: "COMPLETED" as const },
    { partCode: "DFD-0001", description: "Double Flood Door", details: "Johnstone Primary - Double Door", jobNo: "101339-2-1", dept: "REVIEW" as const, prodStatus: "COMPLETED" as const },
    { partCode: "TRANS-0001", description: "Transom above doorset", details: "Johnstone Primary - Transom 1", jobNo: "101339-1-3", dept: "REVIEW" as const, prodStatus: "COMPLETED" as const },
    { partCode: "TRANS-0001", description: "Transom above doorset", details: "Johnstone Primary - Transom 2", jobNo: "101339-1-4", dept: "REVIEW" as const, prodStatus: "COMPLETED" as const },
  ]

  for (const p of johnstoneProducts) {
    await prisma.product.create({
      data: {
        projectId: p101339.id,
        partCode: p.partCode,
        description: p.description,
        additionalDetails: p.details,
        productJobNumber: p.jobNo,
        quantity: 1,
        currentDepartment: p.dept,
        productionStatus: p.prodStatus || null,
        allocatedDesignerId: userMap["Kelan Taylor"]?.id,
        coordinatorId: userMap["Corey Thomas"].id,
        requiredCompletionDate: new Date("2026-01-31"),
      },
    })
  }

  // Project 101328 - Rudninkai Blast
  const p101328 = await prisma.project.create({
    data: {
      projectNumber: "101328",
      name: "RUDNINKAI TRAINING AREA - Ammunition Storage",
      coordinatorId: userMap["Marc Pridmore"].id,
      projectManagerId: userMap["James Morton"].id,
      projectType: "BESPOKE_MAJOR",
      workStream: "BLAST",
      salesStage: "ORDER",
      projectStatus: "MANUFACTURE",
      contractType: "STANDARD",
      siteLocation: "Lithuania",
      enquiryReceived: new Date("2024-07-01"),
      orderReceived: new Date("2025-02-01"),
      targetCompletion: new Date("2026-06-30"),
    },
  })

  const blastProducts = [
    { partCode: "SBD-0001", description: "Single Blast Door - Type LRL", details: "Building A - SBD", jobNo: "101328-1-1", dept: "PRODUCTION" as const, prodStatus: "FITTING" as const },
    { partCode: "SBD-0001", description: "Single Blast Door - Type LRL", details: "Building B - SBD", jobNo: "101328-2-1", dept: "PRODUCTION" as const, prodStatus: "FABRICATION" as const },
    { partCode: "DBD-0003", description: "Double Blast Door - Type HRL", details: "Building C - DBD", jobNo: "101328-3-1", dept: "PRODUCTION" as const, prodStatus: "CUTTING" as const },
    { partCode: "DBD-0003", description: "Double Blast Door - Type HRL", details: "Building D - DBD", jobNo: "101328-4-1", dept: "DESIGN" as const },
    { partCode: "BW-0001", description: "Blast Window", details: "Building A - BW 1", jobNo: "101328-1-2", dept: "PRODUCTION" as const, prodStatus: "PAINTING" as const },
    { partCode: "BW-0001", description: "Blast Window", details: "Building A - BW 2", jobNo: "101328-1-3", dept: "PRODUCTION" as const, prodStatus: "PAINTING" as const },
    { partCode: "BW-0001", description: "Blast Window", details: "Building B - BW 1", jobNo: "101328-2-2", dept: "PRODUCTION" as const, prodStatus: "SHOTBLASTING" as const },
    { partCode: "SBD-0003", description: "Single Blast Door - Type HRL", details: "Building E - SBD HRL", jobNo: "101328-5-1", dept: "DESIGN" as const },
  ]

  for (const p of blastProducts) {
    await prisma.product.create({
      data: {
        projectId: p101328.id,
        partCode: p.partCode,
        description: p.description,
        additionalDetails: p.details,
        productJobNumber: p.jobNo,
        quantity: 1,
        currentDepartment: p.dept,
        productionStatus: p.prodStatus || null,
        allocatedDesignerId: userMap["Dave Howells"]?.id,
        coordinatorId: userMap["Marc Pridmore"].id,
        requiredCompletionDate: new Date("2026-06-30"),
      },
    })
  }

  // A few more opportunity-stage projects
  await prisma.project.create({
    data: {
      projectNumber: "101271",
      name: "Marina Quarter - Flood Doors Cork",
      customerId: custMap["Conack"].id,
      projectType: "BESPOKE_MAJOR",
      workStream: "BESPOKE",
      salesStage: "OPPORTUNITY",
      projectStatus: "OPPORTUNITY",
      siteLocation: "Cork, Ireland",
      enquiryReceived: new Date("2025-06-01"),
    },
  })

  await prisma.project.create({
    data: {
      projectNumber: "101362",
      name: "Oxford FAS",
      customerId: custMap["Graham Construction"].id,
      projectType: "BESPOKE_MAJOR",
      workStream: "COMMUNITY",
      salesStage: "OPPORTUNITY",
      projectStatus: "OPPORTUNITY",
      siteLocation: "Oxford, UK",
      enquiryReceived: new Date("2025-08-01"),
    },
  })

  await prisma.project.create({
    data: {
      projectNumber: "200598",
      name: "Weir Mill Flood Doors",
      customerId: custMap["John Sisk & Son Limited"].id,
      coordinatorId: userMap["Richard Guest"].id,
      projectManagerId: userMap["Richard Guest"].id,
      projectType: "BESPOKE_MAJOR",
      workStream: "COMMUNITY",
      salesStage: "ORDER",
      projectStatus: "DESIGN",
      contractType: "STANDARD",
      siteLocation: "Stockport, UK",
      enquiryReceived: new Date("2025-03-01"),
      orderReceived: new Date("2025-07-01"),
      targetCompletion: new Date("2026-08-31"),
    },
  })

  await prisma.project.create({
    data: {
      projectNumber: "200615",
      name: "Barmouth Viaduct Garden",
      customerId: custMap["Alun Griffiths (Contractors) Ltd"].id,
      coordinatorId: userMap["Stephen McDermid"].id,
      projectManagerId: userMap["Corey Thomas"].id,
      projectType: "BESPOKE_MAJOR",
      workStream: "COMMUNITY",
      salesStage: "ORDER",
      projectStatus: "DESIGN",
      contractType: "NEC",
      siteLocation: "Barmouth, Wales",
      enquiryReceived: new Date("2025-05-01"),
      orderReceived: new Date("2025-09-01"),
      targetCompletion: new Date("2026-07-31"),
    },
  })

  console.log("Seeding complete!")
  console.log(`Created: ${users.length} users, ${customers.length} customers, ${catalogueItems.length} catalogue items`)

  const projectCount = await prisma.project.count()
  const productCount = await prisma.product.count()
  console.log(`Created: ${projectCount} projects, ${productCount} products`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
