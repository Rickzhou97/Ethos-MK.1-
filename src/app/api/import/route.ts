import { prisma } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { type, rows } = body as { type: string; rows: Record<string, string>[] }

  if (!type || !rows || !Array.isArray(rows)) {
    return NextResponse.json({ error: "type and rows required" }, { status: 400 })
  }

  const errors: string[] = []
  let success = 0

  if (type === "customers") {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      if (!r.name) { errors.push(`Row ${i + 1}: Name is required`); continue }
      try {
        await prisma.customer.create({
          data: {
            name: r.name,
            customerType: mapCustomerType(r.customerType),
            email: r.email || null,
            phone: r.phone || null,
            address: r.address || null,
            paymentTerms: r.paymentTerms || null,
            notes: r.notes || null,
          },
        })
        success++
      } catch (e: unknown) {
        errors.push(`Row ${i + 1} (${r.name}): ${e instanceof Error ? e.message : "Unknown error"}`)
      }
    }
  }

  else if (type === "suppliers") {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      if (!r.name) { errors.push(`Row ${i + 1}: Name is required`); continue }
      try {
        await prisma.supplier.create({
          data: {
            name: r.name,
            email: r.email || null,
            phone: r.phone || null,
            address: r.address || null,
            whatTheySupply: r.whatTheySupply || null,
            paymentTerms: r.paymentTerms || null,
            notes: r.notes || null,
          },
        })
        success++
      } catch (e: unknown) {
        errors.push(`Row ${i + 1} (${r.name}): ${e instanceof Error ? e.message : "Unknown error"}`)
      }
    }
  }

  else if (type === "nominal-codes") {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      if (!r.code || !r.description) { errors.push(`Row ${i + 1}: Code and description required`); continue }
      try {
        await prisma.nominalCode.create({
          data: {
            code: r.code.trim(),
            description: r.description.trim(),
            category: mapCostCategory(r.category),
            active: true,
          },
        })
        success++
      } catch (e: unknown) {
        errors.push(`Row ${i + 1} (${r.code}): ${e instanceof Error ? e.message : "Unknown error"}`)
      }
    }
  }

  else if (type === "projects") {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      if (!r.name) { errors.push(`Row ${i + 1}: Project name is required`); continue }

      try {
        // Look up customer by name if provided
        let customerId: string | null = null
        if (r.customer) {
          const customer = await prisma.customer.findFirst({
            where: { name: { contains: r.customer, mode: "insensitive" } },
            select: { id: true },
          })
          if (customer) customerId = customer.id
        }

        // Look up coordinator by name if provided
        let coordinatorId: string | null = null
        if (r.coordinator) {
          const user = await prisma.user.findFirst({
            where: { name: { contains: r.coordinator, mode: "insensitive" } },
            select: { id: true },
          })
          if (user) coordinatorId = user.id
        }

        // Auto-generate project number
        const lastProject = await prisma.project.findFirst({
          orderBy: { projectNumber: "desc" },
          select: { projectNumber: true },
        })
        let nextNumber = 100001
        if (lastProject) {
          const lastNum = parseInt(lastProject.projectNumber, 10)
          if (!isNaN(lastNum)) nextNumber = lastNum + 1
        }

        // Use provided project number if it exists and is unique
        let projectNumber = String(nextNumber)
        if (r.projectNumber) {
          const existing = await prisma.project.findUnique({
            where: { projectNumber: r.projectNumber.trim() },
          })
          if (!existing) projectNumber = r.projectNumber.trim()
        }

        await prisma.project.create({
          data: {
            projectNumber,
            name: r.name,
            customerId,
            coordinatorId,
            projectType: r.projectType === "BESPOKE_MAJOR" ? "BESPOKE_MAJOR" : "STANDARD",
            workStream: mapWorkStream(r.workStream),
            salesStage: mapSalesStage(r.salesStage),
            projectStatus: mapProjectStatus(r.projectStatus),
            estimatedValue: r.estimatedValue ? parseFloat(r.estimatedValue.replace(/[£,]/g, "")) || null : null,
            contractValue: r.contractValue ? parseFloat(r.contractValue.replace(/[£,]/g, "")) || null : null,
            siteLocation: r.siteLocation || null,
            notes: r.notes || null,
            enquiryReceived: r.enquiryReceived ? new Date(r.enquiryReceived) : null,
            targetCompletion: r.targetCompletion ? new Date(r.targetCompletion) : null,
          },
        })
        success++
      } catch (e: unknown) {
        errors.push(`Row ${i + 1} (${r.name}): ${e instanceof Error ? e.message : "Unknown error"}`)
      }
    }
  }

  else if (type === "products") {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      if (!r.partCode && !r.description) { errors.push(`Row ${i + 1}: Part code or description required`); continue }

      try {
        // Look up project by number
        let projectId: string | null = null
        if (r.projectNumber) {
          const project = await prisma.project.findUnique({
            where: { projectNumber: r.projectNumber.trim() },
            select: { id: true },
          })
          if (project) projectId = project.id
        }
        if (!projectId) { errors.push(`Row ${i + 1}: Project ${r.projectNumber || "?"} not found`); continue }

        // Look up designer by name
        let designerId: string | null = null
        if (r.designer) {
          const user = await prisma.user.findFirst({
            where: { name: { contains: r.designer, mode: "insensitive" } },
            select: { id: true },
          })
          if (user) designerId = user.id
        }

        await prisma.product.create({
          data: {
            projectId,
            partCode: r.partCode || r.description?.substring(0, 30) || "IMPORT",
            description: r.description || r.partCode || "",
            additionalDetails: r.additionalDetails || null,
            quantity: r.quantity ? parseInt(r.quantity, 10) || 1 : 1,
            productJobNumber: r.jobNumber || null,
            allocatedDesignerId: designerId,
            currentDepartment: mapDepartment(r.department),
            drawingNumber: r.drawingNumber || null,
            notes: r.notes || null,
            requiredCompletionDate: r.requiredDate ? new Date(r.requiredDate) : null,
          },
        })
        success++
      } catch (e: unknown) {
        errors.push(`Row ${i + 1} (${r.partCode || r.description}): ${e instanceof Error ? e.message : "Unknown error"}`)
      }
    }
  }

  else if (type === "stock-prices") {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      const stockCode = (r.stockCode || r["Stock item code"] || "").trim()
      if (!stockCode) { errors.push(`Row ${i + 1}: Stock item code is required`); continue }

      try {
        const rawPrice = r.averageBuyingPrice || r["Average Buying Price"] || ""
        const price = rawPrice ? parseFloat(rawPrice.replace(/[£,\s]/g, "")) : null
        const leadTime = r.leadTime || r["Lead Time"] || ""
        const parsedLeadTime = leadTime ? parseInt(leadTime, 10) : null
        const name = r.name || r["Stock item name"] || stockCode
        const productGroup = r.productGroup || r["Product group"] || null
        const uom = r.unitOfMeasure || r.UoM || null
        const supplier = r.supplier || r.Supplier || null
        const notes = r.notes || r.Notes || null

        await prisma.sageStockItem.upsert({
          where: { stockCode },
          update: {
            name,
            ...(productGroup && { productGroup }),
            ...(uom && { unitOfMeasure: uom }),
            ...(price !== null && !isNaN(price) && { averageBuyingPrice: price }),
            ...(supplier && { supplierRef: supplier }),
            ...(parsedLeadTime !== null && !isNaN(parsedLeadTime) && { supplierLeadTime: parsedLeadTime }),
            ...(notes && { memo: notes }),
          },
          create: {
            stockCode,
            name,
            productGroup,
            unitOfMeasure: uom,
            averageBuyingPrice: price !== null && !isNaN(price) ? price : null,
            supplierRef: supplier,
            supplierLeadTime: parsedLeadTime !== null && !isNaN(parsedLeadTime) ? parsedLeadTime : null,
            memo: notes,
          },
        })
        success++
      } catch (e: unknown) {
        errors.push(`Row ${i + 1} (${stockCode}): ${e instanceof Error ? e.message : "Unknown error"}`)
      }
    }
  }

  else {
    return NextResponse.json({ error: `Unknown import type: ${type}` }, { status: 400 })
  }

  return NextResponse.json({ success, errors })
}

// Mapping helpers — fuzzy match common variations
function mapCustomerType(val?: string): "MAIN_CONTRACTOR" | "UTILITY" | "COUNCIL" | "DIRECT" | "DEFENCE" | "OTHER" {
  if (!val) return "OTHER"
  const v = val.toUpperCase().replace(/[_\s-]/g, "")
  if (v.includes("MAIN") || v.includes("CONTRACTOR")) return "MAIN_CONTRACTOR"
  if (v.includes("UTIL")) return "UTILITY"
  if (v.includes("COUNCIL") || v.includes("LOCAL")) return "COUNCIL"
  if (v.includes("DIRECT")) return "DIRECT"
  if (v.includes("DEFEN") || v.includes("MOD")) return "DEFENCE"
  return "OTHER"
}

function mapCostCategory(val?: string): "MATERIALS" | "LABOUR" | "PLANT_HIRE" | "SUB_CONTRACT" | "TRANSPORT" | "OVERHEADS" | "PRELIMS" | "DESIGN" | "OTHER" {
  if (!val) return "OTHER"
  const v = val.toUpperCase().replace(/[_\s-]/g, "")
  if (v.includes("MATERIAL") || v.includes("STEEL") || v.includes("RAW")) return "MATERIALS"
  if (v.includes("LABOUR") || v.includes("LABOR") || v.includes("WAGE")) return "LABOUR"
  if (v.includes("PLANT") || v.includes("HIRE") || v.includes("EQUIP")) return "PLANT_HIRE"
  if (v.includes("SUB") || v.includes("CONTRACT")) return "SUB_CONTRACT"
  if (v.includes("TRANSPORT") || v.includes("DELIVERY") || v.includes("HAULAGE")) return "TRANSPORT"
  if (v.includes("OVERHEAD") || v.includes("ADMIN")) return "OVERHEADS"
  if (v.includes("PRELIM")) return "PRELIMS"
  if (v.includes("DESIGN") || v.includes("DRAW")) return "DESIGN"
  return "OTHER"
}

function mapWorkStream(val?: string): "COMMUNITY" | "UTILITIES" | "BESPOKE" | "BLAST" | "BUND_CONTAINMENT" | "REFURBISHMENT" | "ADHOC" {
  if (!val) return "ADHOC"
  const v = val.toUpperCase().replace(/[_\s-]/g, "")
  if (v.includes("COMMUNITY")) return "COMMUNITY"
  if (v.includes("UTIL")) return "UTILITIES"
  if (v.includes("BESPOKE")) return "BESPOKE"
  if (v.includes("BLAST")) return "BLAST"
  if (v.includes("BUND") || v.includes("CONTAINMENT")) return "BUND_CONTAINMENT"
  if (v.includes("REFURB")) return "REFURBISHMENT"
  return "ADHOC"
}

function mapSalesStage(val?: string): "OPPORTUNITY" | "QUOTED" | "ORDER" {
  if (!val) return "OPPORTUNITY"
  const v = val.toUpperCase().replace(/[_\s-]/g, "")
  if (v.includes("ORDER") || v.includes("WON") || v.includes("ACCEPTED")) return "ORDER"
  if (v.includes("QUOT")) return "QUOTED"
  return "OPPORTUNITY"
}

function mapProjectStatus(val?: string): "OPPORTUNITY" | "QUOTATION" | "DESIGN" | "MANUFACTURE" | "INSTALLATION" | "REVIEW" | "COMPLETE" {
  if (!val) return "OPPORTUNITY"
  const v = val.toUpperCase().replace(/[_\s-]/g, "")
  if (v.includes("COMPLETE") || v.includes("CLOSED") || v.includes("DONE")) return "COMPLETE"
  if (v.includes("REVIEW") || v.includes("SNAG")) return "REVIEW"
  if (v.includes("INSTALL") || v.includes("SITE")) return "INSTALLATION"
  if (v.includes("MANU") || v.includes("PROD") || v.includes("FAB")) return "MANUFACTURE"
  if (v.includes("DESIGN") || v.includes("DRAW")) return "DESIGN"
  if (v.includes("QUOT")) return "QUOTATION"
  return "OPPORTUNITY"
}

function mapDepartment(val?: string): "PLANNING" | "DESIGN" | "PRODUCTION" | "INSTALLATION" | "REVIEW" | "COMPLETE" {
  if (!val) return "PLANNING"
  const v = val.toUpperCase().replace(/[_\s-]/g, "")
  if (v.includes("COMPLETE") || v.includes("DONE")) return "COMPLETE"
  if (v.includes("REVIEW")) return "REVIEW"
  if (v.includes("INSTALL") || v.includes("SITE")) return "INSTALLATION"
  if (v.includes("PROD") || v.includes("FAB") || v.includes("MANU")) return "PRODUCTION"
  if (v.includes("DESIGN") || v.includes("DRAW")) return "DESIGN"
  return "PLANNING"
}
