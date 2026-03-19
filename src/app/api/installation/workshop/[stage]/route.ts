import { prisma } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"

const INSTALLATION_STAGES = [
  "PREPARATION",
  "CIVIL_WORKS",
  "LIFTING",
  "INSTALLATION",
  "SEALING",
  "INSPECTION",
]

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ stage: string }> }
) {
  const { stage } = await params

  if (!INSTALLATION_STAGES.includes(stage)) {
    return NextResponse.json(
      { error: `Invalid stage: ${stage}` },
      { status: 400 }
    )
  }

  const { searchParams } = new URL(request.url)
  const crewId = searchParams.get("crewId")

  const where: Record<string, unknown> = { stage }
  if (crewId) where.crewId = crewId

  const tasks = await prisma.installationTask.findMany({
    where,
    include: {
      product: {
        select: {
          id: true,
          partCode: true,
          description: true,
          quantity: true,
          installTargetDate: true,
          installStatus: true,
        },
      },
      project: {
        select: {
          id: true,
          projectNumber: true,
          name: true,
          priority: true,
          customer: { select: { name: true } },
          siteLocation: true,
        },
      },
      crew: true,
    },
    orderBy: { queuePosition: "asc" },
  })

  const active = tasks.filter((t) => t.status === "IN_PROGRESS")
  const pending = tasks.filter(
    (t) => t.status === "PENDING" || t.status === "REWORK"
  )

  const completedToday = tasks.filter((t) => {
    if (!t.completedAt) return false
    const today = new Date()
    const completed = new Date(t.completedAt)
    return (
      completed.getFullYear() === today.getFullYear() &&
      completed.getMonth() === today.getMonth() &&
      completed.getDate() === today.getDate()
    )
  })

  const stats = {
    totalCount: tasks.length,
    activeCount: active.length,
    pendingCount: pending.length,
    completedTodayCount: completedToday.length,
  }

  return NextResponse.json({ tasks, stats })
}
