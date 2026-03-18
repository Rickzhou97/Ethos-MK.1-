import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { prisma } from "@/lib/db"

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const BASE_SYSTEM_PROMPT = `You are UPEE AI, an intelligent assistant embedded in the UPEE Mk.1 business management system built for MM Engineered Solutions Ltd — a steel fabrication and engineering company.

You help users with:
- Answering questions about their real project data (provided below as context)
- Planning design work, production schedules, and resource allocation
- Understanding production stages and workflows
- Navigating the system (CRM, Design, Production, Planning, Installation modules)
- General business and engineering queries

Production stages flow: AWAITING → CUTTING → FABRICATION → FITTING → SHOTBLASTING → PAINTING → PACKING → COMPLETED
Project lifecycle: OPPORTUNITY → QUOTATION → DESIGN → DESIGN_FREEZE → MANUFACTURE → INSTALLATION → REVIEW → COMPLETE
Design card statuses: QUEUED → IN_PROGRESS → REVIEW → COMPLETE (or ON_HOLD)
Design job types: GA_DRAWING, PRODUCTION_DRAWINGS, BOM_FINALISATION, DESIGN_REVIEW
Design job statuses: BLOCKED → READY → IN_PROGRESS → SUBMITTED → APPROVED → SIGNED_OFF (or REJECTED)

Keep responses concise and helpful. Use the live data context below to answer data questions accurately. When discussing design plans, reference specific designers, products, and timelines from the data. If asked about something not in the context, say you don't have that specific detail and suggest where to find it in the system.`

async function getDatabaseContext() {
  try {
    const [
      projectStats,
      recentProjects,
      productionOverview,
      customerCount,
      highPriorityProjects,
      designStats,
      designCards,
      designerWorkload,
      activeProducts,
      ncrSummary,
      recentNCRs,
      capacityData,
    ] = await Promise.all([
      // Project counts by status
      prisma.project.groupBy({
        by: ["projectStatus"],
        _count: { id: true },
      }),
      // Recent/active projects with key details
      prisma.project.findMany({
        where: {
          projectStatus: { notIn: ["COMPLETE", "OPPORTUNITY"] },
        },
        select: {
          projectNumber: true,
          name: true,
          projectStatus: true,
          priority: true,
          targetCompletion: true,
          estimatedValue: true,
          customer: { select: { name: true } },
          coordinator: { select: { name: true } },
          projectManager: { select: { name: true } },
          _count: { select: { products: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 25,
      }),
      // Production tasks overview
      prisma.productionTask.groupBy({
        by: ["stage", "status"],
        _count: { id: true },
      }),
      // Customer count
      prisma.customer.count(),
      // High priority projects
      prisma.project.findMany({
        where: { priority: { in: ["HIGH", "CRITICAL"] } },
        select: {
          projectNumber: true,
          name: true,
          projectStatus: true,
          priority: true,
          targetCompletion: true,
          customer: { select: { name: true } },
        },
        take: 10,
      }),
      // Design cards summary by status
      prisma.productDesignCard.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
      // Detailed design cards (active + queued)
      prisma.productDesignCard.findMany({
        where: {
          status: { in: ["IN_PROGRESS", "REVIEW", "QUEUED", "ON_HOLD"] },
        },
        select: {
          status: true,
          targetStartDate: true,
          targetEndDate: true,
          actualStartDate: true,
          estimatedHours: true,
          actualHours: true,
          assignedDesigner: { select: { name: true } },
          product: {
            select: {
              partCode: true,
              description: true,
              quantity: true,
              designEstimatedHours: true,
              project: {
                select: {
                  projectNumber: true,
                  name: true,
                  priority: true,
                  targetCompletion: true,
                },
              },
            },
          },
          jobCards: {
            select: {
              jobType: true,
              status: true,
              assignedTo: { select: { name: true } },
              reviewer: { select: { name: true } },
              estimatedHours: true,
              actualHours: true,
              startedAt: true,
              submittedAt: true,
            },
          },
        },
        orderBy: [
          { status: "asc" },
          { targetEndDate: "asc" },
        ],
        take: 50,
      }),
      // Designer workload (group by designer)
      prisma.productDesignCard.groupBy({
        by: ["assignedDesignerId"],
        where: {
          status: { in: ["IN_PROGRESS", "QUEUED"] },
          assignedDesignerId: { not: null },
        },
        _count: { id: true },
        _sum: { estimatedHours: true },
      }),
      // Active products with design/production dates
      prisma.product.findMany({
        where: {
          currentDepartment: { in: ["DESIGN", "PRODUCTION"] },
        },
        select: {
          partCode: true,
          description: true,
          quantity: true,
          currentDepartment: true,
          productionStatus: true,
          designTargetDate: true,
          designCompletionDate: true,
          designEstimatedHours: true,
          productionTargetDate: true,
          productionPlannedStart: true,
          allocatedDesignerId: true,
          designer: { select: { name: true } },
          project: {
            select: {
              projectNumber: true,
              name: true,
              priority: true,
            },
          },
        },
        orderBy: { designTargetDate: "asc" },
        take: 40,
      }),
      // NCR summary
      prisma.nonConformanceReport.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
      // Recent open NCRs
      prisma.nonConformanceReport.findMany({
        where: { status: { in: ["OPEN", "INVESTIGATING"] } },
        select: {
          ncrNumber: true,
          title: true,
          severity: true,
          status: true,
          costImpact: true,
          originStage: true,
          parentProject: {
            select: { projectNumber: true, name: true },
          },
        },
        orderBy: { raisedDate: "desc" },
        take: 10,
      }),
      // Department capacity
      prisma.departmentCapacity.findMany({
        select: {
          department: true,
          displayName: true,
          hoursPerWeek: true,
          headcount: true,
        },
      }),
    ])

    // Resolve designer names for workload
    const designerIds = designerWorkload
      .map((d) => d.assignedDesignerId)
      .filter((id): id is string => id !== null)
    const designers = designerIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: designerIds } },
          select: { id: true, name: true },
        })
      : []
    const designerMap = Object.fromEntries(designers.map((d) => [d.id, d.name]))

    // Format into a concise context string
    const lines: string[] = []

    lines.push("=== LIVE DATABASE CONTEXT ===")
    lines.push(`Data as of: ${new Date().toLocaleString("en-GB")}`)
    lines.push("")

    // Project summary
    lines.push("PROJECT SUMMARY:")
    const totalProjects = projectStats.reduce((sum, s) => sum + s._count.id, 0)
    lines.push(`Total projects: ${totalProjects}`)
    for (const s of projectStats) {
      lines.push(`  ${s.projectStatus}: ${s._count.id}`)
    }
    lines.push(`Total customers: ${customerCount}`)
    lines.push("")

    // High priority
    if (highPriorityProjects.length > 0) {
      lines.push("HIGH PRIORITY PROJECTS:")
      for (const p of highPriorityProjects) {
        lines.push(`  ${p.projectNumber} - ${p.name} (${p.priority}, ${p.projectStatus}) — ${p.customer?.name || "No customer"}, Target: ${p.targetCompletion ? new Date(p.targetCompletion).toLocaleDateString("en-GB") : "Not set"}`)
      }
      lines.push("")
    }

    // Active projects
    lines.push("ACTIVE PROJECTS (most recent):")
    for (const p of recentProjects) {
      lines.push(`  ${p.projectNumber} - ${p.name}`)
      lines.push(`    Status: ${p.projectStatus}, Priority: ${p.priority || "NORMAL"}, Products: ${p._count.products}`)
      lines.push(`    Customer: ${p.customer?.name || "—"}, PM: ${p.projectManager?.name || "—"}, Coordinator: ${p.coordinator?.name || "—"}`)
      if (p.estimatedValue) lines.push(`    Value: £${Number(p.estimatedValue).toLocaleString()}`)
      if (p.targetCompletion) lines.push(`    Target: ${new Date(p.targetCompletion).toLocaleDateString("en-GB")}`)
    }
    lines.push("")

    // Department capacity
    if (capacityData.length > 0) {
      lines.push("DEPARTMENT CAPACITY (weekly):")
      for (const c of capacityData) {
        lines.push(`  ${c.displayName || c.department}: ${c.hoursPerWeek}hrs/week, ${c.headcount} staff`)
      }
      lines.push("")
    }

    // Design overview
    if (designStats.length > 0) {
      lines.push("DESIGN CARDS SUMMARY:")
      for (const s of designStats) {
        lines.push(`  ${s.status}: ${s._count.id}`)
      }
      lines.push("")
    }

    // Designer workload
    if (designerWorkload.length > 0) {
      lines.push("DESIGNER WORKLOAD (active + queued cards):")
      for (const d of designerWorkload) {
        const name = d.assignedDesignerId ? designerMap[d.assignedDesignerId] || "Unknown" : "Unassigned"
        lines.push(`  ${name}: ${d._count.id} cards, ${d._sum.estimatedHours || 0} estimated hours`)
      }
      lines.push("")
    }

    // Detailed design cards
    if (designCards.length > 0) {
      lines.push("DESIGN CARDS (detailed):")
      for (const card of designCards) {
        const proj = card.product?.project
        const prod = card.product
        lines.push(`  [${card.status}] ${proj?.projectNumber || "?"} - ${prod?.description || "?"} (Qty: ${prod?.quantity || "?"})`)
        lines.push(`    Project: ${proj?.name || "?"}, Priority: ${proj?.priority || "NORMAL"}`)
        lines.push(`    Designer: ${card.assignedDesigner?.name || "Unassigned"}`)
        lines.push(`    Est Hours: ${card.estimatedHours || "—"}, Actual: ${card.actualHours || "—"}`)
        if (card.targetStartDate) lines.push(`    Target Start: ${new Date(card.targetStartDate).toLocaleDateString("en-GB")}`)
        if (card.targetEndDate) lines.push(`    Target End: ${new Date(card.targetEndDate).toLocaleDateString("en-GB")}`)
        if (card.actualStartDate) lines.push(`    Actually Started: ${new Date(card.actualStartDate).toLocaleDateString("en-GB")}`)
        // Job cards
        if (card.jobCards.length > 0) {
          lines.push(`    Job Cards:`)
          for (const jc of card.jobCards) {
            lines.push(`      ${jc.jobType}: ${jc.status}, Assigned: ${jc.assignedTo?.name || "—"}, Reviewer: ${jc.reviewer?.name || "—"}, Est: ${jc.estimatedHours || "—"}h`)
          }
        }
      }
      lines.push("")
    }

    // Active products in design/production
    if (activeProducts.length > 0) {
      lines.push("PRODUCTS IN DESIGN/PRODUCTION:")
      for (const p of activeProducts) {
        lines.push(`  ${p.project?.projectNumber || "?"} - ${p.description || p.partCode || "?"} (Qty: ${p.quantity || "?"})`)
        lines.push(`    Dept: ${p.currentDepartment}, Production Stage: ${p.productionStatus || "—"}`)
        lines.push(`    Designer: ${p.designer?.name || "—"}`)
        if (p.designTargetDate) lines.push(`    Design Target: ${new Date(p.designTargetDate).toLocaleDateString("en-GB")}`)
        if (p.designCompletionDate) lines.push(`    Design Completed: ${new Date(p.designCompletionDate).toLocaleDateString("en-GB")}`)
        if (p.productionTargetDate) lines.push(`    Production Target: ${new Date(p.productionTargetDate).toLocaleDateString("en-GB")}`)
        if (p.productionPlannedStart) lines.push(`    Production Start: ${new Date(p.productionPlannedStart).toLocaleDateString("en-GB")}`)
      }
      lines.push("")
    }

    // Production overview
    if (productionOverview.length > 0) {
      lines.push("PRODUCTION TASKS:")
      const stageMap: Record<string, Record<string, number>> = {}
      for (const t of productionOverview) {
        if (!stageMap[t.stage]) stageMap[t.stage] = {}
        stageMap[t.stage][t.status] = t._count.id
      }
      for (const [stage, statuses] of Object.entries(stageMap)) {
        const parts = Object.entries(statuses).map(([s, c]) => `${s}: ${c}`).join(", ")
        lines.push(`  ${stage}: ${parts}`)
      }
      lines.push("")
    }

    // NCR summary
    if (ncrSummary.length > 0) {
      lines.push("NCR SUMMARY:")
      for (const s of ncrSummary) {
        lines.push(`  ${s.status}: ${s._count.id}`)
      }
      lines.push("")
    }

    // Open NCRs
    if (recentNCRs.length > 0) {
      lines.push("OPEN NCRs:")
      for (const ncr of recentNCRs) {
        lines.push(`  ${ncr.ncrNumber} - ${ncr.title} (${ncr.severity}, ${ncr.status})`)
        lines.push(`    Project: ${ncr.parentProject?.projectNumber || "?"} - ${ncr.parentProject?.name || "?"}`)
        if (ncr.originStage) lines.push(`    Origin: ${ncr.originStage}`)
        if (ncr.costImpact) lines.push(`    Cost Impact: £${Number(ncr.costImpact).toLocaleString()}`)
      }
      lines.push("")
    }

    return lines.join("\n")
  } catch (error) {
    console.error("Failed to fetch database context:", error)
    return "(Database context unavailable)"
  }
}

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json()

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Messages array is required" },
        { status: 400 }
      )
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "AI service not configured" },
        { status: 503 }
      )
    }

    // Fetch live database context
    const dbContext = await getDatabaseContext()
    const systemPrompt = `${BASE_SYSTEM_PROMPT}\n\n${dbContext}`

    const response = await client.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 2048,
      system: systemPrompt,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    })

    const text =
      response.content[0].type === "text" ? response.content[0].text : ""

    return NextResponse.json({ response: text })
  } catch (error) {
    console.error("Chat API error:", error)
    return NextResponse.json(
      { error: "Failed to get AI response" },
      { status: 500 }
    )
  }
}
