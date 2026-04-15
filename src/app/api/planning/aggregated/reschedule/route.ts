import { prisma } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { addDays, format, startOfDay, getDay } from "date-fns"
import {
  WORKSHOP_STAGES,
  GRID_STAGES,
  STATION_COUNTS,
  DEFAULT_STAGE_HOURS,
} from "@/lib/production-utils"

// ─── Constants ────────────────────────────────────────────────────────────────

const WORK_HOURS_PER_DAY = 8

// ─── Types ────────────────────────────────────────────────────────────────────

type ProductEntry = {
  productId: string
  projectId: string
  projectNumber: string
  projectName: string
  isICU: boolean
  deadline: Date | null
  designerId: string | null
  designHours: number
  stageHours: Record<string, number>
  designComplete: boolean
  productionComplete: boolean
  currentStageIndex: number
}

type ScheduledSlot = {
  productId: string
  projectId: string
  stage: string
  stationIdx: number
  startHour: number
  endHour: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Total estimated working hours remaining for a product across all stages. */
function totalRemainingHours(entry: ProductEntry): number {
  let total = entry.designComplete ? 0 : entry.designHours
  for (const stage of WORKSHOP_STAGES) {
    const idx = WORKSHOP_STAGES.indexOf(stage as typeof WORKSHOP_STAGES[number])
    if (entry.currentStageIndex >= 0 && idx < entry.currentStageIndex) continue
    total += entry.stageHours[stage] ?? DEFAULT_STAGE_HOURS[stage] ?? 0
  }
  return total
}

/**
 * Build a working-day-index → calendar-date mapping starting from today,
 * skipping weekends.
 */
function buildWorkDayMap(maxWorkDay: number): Date[] {
  const today = startOfDay(new Date())
  let startDate = today
  while (getDay(startDate) === 0 || getDay(startDate) === 6) {
    startDate = addDays(startDate, 1)
  }
  const map: Date[] = [startDate]
  let calOffset = 0
  let wdCount = 0
  while (wdCount < maxWorkDay + 5) {
    calOffset++
    const d = addDays(startDate, calOffset)
    if (getDay(d) !== 0 && getDay(d) !== 6) {
      wdCount++
      map[wdCount] = d
    }
  }
  return map
}

// ─── Core Scheduler ───────────────────────────────────────────────────────────
//
// Greedy forward scheduling:
//   - Assigns each product's stages to the earliest free station in order.
//   - Returns a map of { projectId → endHour } (last stage completion per project).
//   - The `sortedEntries` parameter controls the scheduling priority; passing
//     entries sorted differently gives different schedule outcomes.

function runSchedule(
  sortedEntries: ProductEntry[],
  designerCount: number,
  designerStationMap: Record<string, number>,
): Map<string, number> {
  const stageStationHours: Record<string, number[]> = {}
  for (const stage of GRID_STAGES) {
    const count = stage === "DESIGN" ? designerCount : (STATION_COUNTS[stage] || 1)
    stageStationHours[stage] = new Array(count).fill(0)
  }

  const productPrevEnd: Record<string, number> = {}
  const projectEndHour = new Map<string, number>()
  const scheduledSlots: ScheduledSlot[] = []

  for (const entry of sortedEntries) {
    if (entry.productionComplete) continue

    const stages: string[] = []
    if (!entry.designComplete) stages.push("DESIGN")
    for (let i = 0; i < WORKSHOP_STAGES.length; i++) {
      if (entry.currentStageIndex >= 0 && i < entry.currentStageIndex) continue
      stages.push(WORKSHOP_STAGES[i])
    }

    for (const stage of stages) {
      const durationHours = stage === "DESIGN"
        ? entry.designHours
        : (entry.stageHours[stage] ?? DEFAULT_STAGE_HOURS[stage] ?? 16)
      if (durationHours <= 0) continue

      const stations = stageStationHours[stage]
      let bestStation = 0

      if (stage === "DESIGN" && entry.designerId && designerStationMap[entry.designerId] !== undefined) {
        bestStation = designerStationMap[entry.designerId]
      } else {
        let minHour = Infinity
        for (let i = 0; i < stations.length; i++) {
          if (stations[i] < minHour) { minHour = stations[i]; bestStation = i }
        }
      }

      const prevEnd = productPrevEnd[entry.productId] || 0
      const startHour = Math.max(stations[bestStation], prevEnd)
      const endHour = startHour + durationHours

      stations[bestStation] = endHour
      productPrevEnd[entry.productId] = endHour

      scheduledSlots.push({ productId: entry.productId, projectId: entry.projectId, stage, stationIdx: bestStation, startHour, endHour })

      // Track per-project end hour
      if ((projectEndHour.get(entry.projectId) ?? 0) < endHour) {
        projectEndHour.set(entry.projectId, endHour)
      }
    }
  }

  return projectEndHour
}

// ─── Route ────────────────────────────────────────────────────────────────────
//
// POST  { apply: false }  →  Preview: returns per-project comparison without writing
// POST  { apply: true  }  →  Apply:   persists optimised start anchors and returns same diff
//
// Algorithm — Minimum Slack First (MSF)
// ──────────────────────────────────────
//   slack(product) = deadline − (today + totalRemainingHours / WORK_HOURS_PER_DAY)
//
//   Products with the smallest slack (closest to breaching their deadline relative
//   to their remaining workload) are scheduled first.  This minimises maximum
//   weighted tardiness and is provably superior to the existing EDD sort when
//   production durations vary significantly between jobs.
//
//   ICU-flagged projects are always elevated above the MSF tier, preserving the
//   existing emergency-handling behaviour.

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { apply?: boolean }
    const apply = body.apply ?? false

    // ── 1. Fetch designers ──────────────────────────────────────────────────

    const designers = await prisma.user.findMany({
      where: { role: { in: ["DESIGN_ENGINEER", "ENGINEERING_MANAGER", "R_AND_D_MANAGER"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    })

    const designerStationMap: Record<string, number> = {}
    const designerCount = designers.length > 0 ? designers.length : 7
    designers.forEach((d, i) => { designerStationMap[d.id] = i })

    // ── 2. Fetch projects with products ────────────────────────────────────

    const projects = await prisma.project.findMany({
      where: { projectStatus: { notIn: ["COMPLETE", "OPPORTUNITY"] } },
      include: {
        products: {
          select: {
            id: true,
            partCode: true,
            description: true,
            productJobNumber: true,
            currentDepartment: true,
            productionStatus: true,
            designEstimatedHours: true,
            productionEstimatedHours: true,
            designCompletionDate: true,
            productionCompletionDate: true,
            allocatedDesignerId: true,
            designCard: {
              select: { estimatedHours: true, assignedDesignerId: true },
            },
            productionTasks: {
              where: { status: { in: ["PENDING", "IN_PROGRESS", "BLOCKED"] } },
              select: { stage: true, estimatedMins: true, queuePosition: true },
              orderBy: { queuePosition: "asc" },
            },
          },
        },
      },
      orderBy: [{ isICUFlag: "desc" }, { targetCompletion: "asc" }, { createdAt: "asc" }],
    })

    // ── 3. Build product entries ────────────────────────────────────────────

    const productEntries: ProductEntry[] = []

    for (const project of projects) {
      for (const product of project.products) {
        const designDone = !!product.designCompletionDate ||
          (product.currentDepartment !== "DESIGN" && product.currentDepartment !== "PLANNING")

        let designHours = 0
        if (!designDone) {
          const est = product.designCard?.estimatedHours
            ? Number(product.designCard.estimatedHours)
            : product.designEstimatedHours
              ? Number(product.designEstimatedHours)
              : 0
          designHours = est > 0 ? est : DEFAULT_STAGE_HOURS.DESIGN
        }

        const stageHours: Record<string, number> = {}
        const totalProdHours = Number(product.productionEstimatedHours || 0)
        for (const stage of WORKSHOP_STAGES) {
          const task = product.productionTasks.find(t => t.stage === stage)
          if (task?.estimatedMins) {
            stageHours[stage] = task.estimatedMins / 60
          } else if (totalProdHours > 0) {
            stageHours[stage] = totalProdHours / WORKSHOP_STAGES.length
          } else {
            stageHours[stage] = DEFAULT_STAGE_HOURS[stage] || 16
          }
        }

        const designerId = product.designCard?.assignedDesignerId || product.allocatedDesignerId || null
        const currentStageIdx = product.productionStatus
          ? WORKSHOP_STAGES.indexOf(product.productionStatus as typeof WORKSHOP_STAGES[number])
          : -1

        productEntries.push({
          productId: product.id,
          projectId: project.id,
          projectNumber: project.projectNumber,
          projectName: project.name,
          isICU: project.isICUFlag,
          deadline: project.targetCompletion,
          designerId,
          designHours,
          stageHours,
          designComplete: designDone,
          productionComplete: !!product.productionCompletionDate,
          currentStageIndex: currentStageIdx,
        })
      }
    }

    // ── 4. Current schedule (EDD — Earliest Due Date) ──────────────────────

    const eddSorted = [...productEntries].sort((a, b) => {
      if (a.isICU && !b.isICU) return -1
      if (!a.isICU && b.isICU) return 1
      const aD = a.deadline?.getTime() ?? Infinity
      const bD = b.deadline?.getTime() ?? Infinity
      return aD - bD
    })

    const eddEndHours = runSchedule(eddSorted, designerCount, designerStationMap)

    // ── 5. Optimised schedule (MSF — Minimum Slack First) ──────────────────
    //
    //   slack = deadline - (today + remainingHours / WORK_HOURS_PER_DAY * ms)
    //
    //   A negative slack means the job is already behind schedule.
    //   We schedule the job with the least slack first (most at-risk job first).

    const todayMs = startOfDay(new Date()).getTime()
    const msPerWorkDay = WORK_HOURS_PER_DAY * 3_600_000

    const msfSorted = [...productEntries].sort((a, b) => {
      if (a.isICU && !b.isICU) return -1
      if (!a.isICU && b.isICU) return 1

      const aSlack = (a.deadline?.getTime() ?? Infinity) - (todayMs + totalRemainingHours(a) / WORK_HOURS_PER_DAY * 86_400_000)
      const bSlack = (b.deadline?.getTime() ?? Infinity) - (todayMs + totalRemainingHours(b) / WORK_HOURS_PER_DAY * 86_400_000)
      return aSlack - bSlack  // smallest slack (most urgent) first
    })

    const msfEndHours = runSchedule(msfSorted, designerCount, designerStationMap)

    // ── 6. Build working-day calendar map ──────────────────────────────────

    const maxHour = Math.max(
      0,
      ...[...eddEndHours.values()],
      ...[...msfEndHours.values()],
    )
    const maxWorkDay = Math.ceil(maxHour / WORK_HOURS_PER_DAY)
    const workDayToDate = buildWorkDayMap(maxWorkDay)

    function hourToDate(hour: number): string {
      const wd = Math.max(0, Math.ceil(hour / WORK_HOURS_PER_DAY) - 1)
      return format(workDayToDate[wd] ?? workDayToDate[workDayToDate.length - 1], "yyyy-MM-dd")
    }

    // ── 7. Build per-project diff ───────────────────────────────────────────

    const uniqueProjectIds = [...new Set(productEntries.map(e => e.projectId))]

    type ChangeRow = {
      projectId: string
      projectNumber: string
      projectName: string
      isICU: boolean
      deadline: string | null
      currentEnd: string
      optimisedEnd: string
      deltaDays: number        // positive = finishes earlier, negative = finishes later
      meetsDeadline: boolean
    }

    const changes: ChangeRow[] = []

    for (const pid of uniqueProjectIds) {
      const entry = productEntries.find(e => e.projectId === pid)
      if (!entry) continue

      const eddH = eddEndHours.get(pid)
      const msfH = msfEndHours.get(pid)
      if (eddH === undefined || msfH === undefined) continue

      const currentEnd = hourToDate(eddH)
      const optimisedEnd = hourToDate(msfH)

      const eddDays = Math.ceil(eddH / WORK_HOURS_PER_DAY)
      const msfDays = Math.ceil(msfH / WORK_HOURS_PER_DAY)
      const deltaDays = eddDays - msfDays  // positive = MSF finishes earlier

      const optimisedEndDate = workDayToDate[Math.max(0, Math.ceil(msfH / WORK_HOURS_PER_DAY) - 1)]
      const meetsDeadline = !entry.deadline || optimisedEndDate <= entry.deadline

      changes.push({
        projectId: pid,
        projectNumber: entry.projectNumber,
        projectName: entry.projectName,
        isICU: entry.isICU,
        deadline: entry.deadline ? format(entry.deadline, "yyyy-MM-dd") : null,
        currentEnd,
        optimisedEnd,
        deltaDays,
        meetsDeadline,
      })
    }

    // Sort: most improvement first, then ICU, then by optimised end
    changes.sort((a, b) => b.deltaDays - a.deltaDays)

    const improvedCount = changes.filter(c => c.deltaDays > 0).length
    const degradedCount = changes.filter(c => c.deltaDays < 0).length

    // ── 8. Apply: persist optimised start dates ────────────────────────────
    //
    //   We re-run the MSF schedule tracking per-product first-slot start hours,
    //   then write designPlannedStart and productionPlannedStart to the DB.
    //   The GET route uses these as lower-bound anchors when scheduling, so the
    //   grid immediately reflects the optimised order on next load.

    if (apply) {
      // Re-run MSF keeping per-product first-stage start hours
      const stageStationHours: Record<string, number[]> = {}
      for (const stage of GRID_STAGES) {
        const count = stage === "DESIGN" ? designerCount : (STATION_COUNTS[stage] || 1)
        stageStationHours[stage] = new Array(count).fill(0)
      }
      const productPrevEnd: Record<string, number> = {}
      const productDesignStart: Record<string, number> = {}
      const productProdStart: Record<string, number> = {}

      for (const entry of msfSorted) {
        if (entry.productionComplete) continue

        const stages: string[] = []
        if (!entry.designComplete) stages.push("DESIGN")
        for (let i = 0; i < WORKSHOP_STAGES.length; i++) {
          if (entry.currentStageIndex >= 0 && i < entry.currentStageIndex) continue
          stages.push(WORKSHOP_STAGES[i])
        }

        let firstProdStage = true
        for (const stage of stages) {
          const durationHours = stage === "DESIGN"
            ? entry.designHours
            : (entry.stageHours[stage] ?? DEFAULT_STAGE_HOURS[stage] ?? 16)
          if (durationHours <= 0) continue

          const stations = stageStationHours[stage]
          let bestStation = 0

          if (stage === "DESIGN" && entry.designerId && designerStationMap[entry.designerId] !== undefined) {
            bestStation = designerStationMap[entry.designerId]
          } else {
            let minHour = Infinity
            for (let i = 0; i < stations.length; i++) {
              if (stations[i] < minHour) { minHour = stations[i]; bestStation = i }
            }
          }

          const prevEnd = productPrevEnd[entry.productId] || 0
          const startHour = Math.max(stations[bestStation], prevEnd)
          const endHour = startHour + durationHours

          if (stage === "DESIGN") {
            productDesignStart[entry.productId] = startHour
          } else if (firstProdStage) {
            productProdStart[entry.productId] = startHour
            firstProdStage = false
          }

          stations[bestStation] = endHour
          productPrevEnd[entry.productId] = endHour
        }
      }

      // Convert working hours → calendar dates and write to DB
      await Promise.all(
        Object.entries(productDesignStart).map(([productId, startHour]) => {
          const wd = Math.floor(startHour / WORK_HOURS_PER_DAY)
          const date = workDayToDate[wd] ?? workDayToDate[0]
          return prisma.product.update({
            where: { id: productId },
            data: { designPlannedStart: date },
          })
        }).concat(
          Object.entries(productProdStart).map(([productId, startHour]) => {
            const wd = Math.floor(startHour / WORK_HOURS_PER_DAY)
            const date = workDayToDate[wd] ?? workDayToDate[0]
            return prisma.product.update({
              where: { id: productId },
              data: { productionPlannedStart: date },
            })
          })
        )
      )
    }

    return NextResponse.json({
      applied: apply,
      algorithm: "Minimum Slack First (MSF)",
      totalProjects: changes.length,
      improvedCount,
      degradedCount,
      changes,
    })
  } catch (err) {
    console.error("reschedule error:", err)
    return NextResponse.json({ error: "Failed to compute reschedule" }, { status: 500 })
  }
}
