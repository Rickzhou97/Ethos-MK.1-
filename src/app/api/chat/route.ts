import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { prisma } from "@/lib/db"

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const BASE_SYSTEM_PROMPT = `You are UPEE AI, an intelligent assistant embedded in the UPEE Mk.1 business management system built for MM Engineered Solutions Ltd — a steel fabrication and engineering company.

You help users with:
- Answering questions about their real project data (provided below as context)
- Understanding production stages and workflows
- Navigating the system (CRM, Design, Production, Planning, Installation modules)
- General business and engineering queries

Production stages flow: AWAITING → CUTTING → FABRICATION → FITTING → SHOTBLASTING → PAINTING → PACKING → COMPLETED
Project lifecycle: OPPORTUNITY → QUOTATION → DESIGN → DESIGN_FREEZE → MANUFACTURE → INSTALLATION → REVIEW → COMPLETE

Keep responses concise and helpful. Use the live data context below to answer data questions accurately. If asked about something not in the context, say you don't have that specific detail and suggest where to find it in the system.`

async function getDatabaseContext() {
  try {
    const [
      projectStats,
      recentProjects,
      productionOverview,
      customerCount,
      highPriorityProjects,
      designStats,
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
        take: 20,
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
      // Design cards overview
      prisma.productDesignCard.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
    ])

    // Format into a concise context string
    const lines: string[] = []

    lines.push("=== LIVE DATABASE CONTEXT ===")
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

    // Design overview
    if (designStats.length > 0) {
      lines.push("DESIGN CARDS:")
      for (const s of designStats) {
        lines.push(`  ${s.status}: ${s._count.id}`)
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
      max_tokens: 1024,
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
