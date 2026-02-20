"use client"

import Link from "next/link"
import { JOB_TYPE_LABELS } from "@/lib/design-utils"
import { TaskActionButtons } from "./task-action-buttons"

type JobCard = {
  id: string
  designCardId: string
  jobType: string
  status: string
  sortOrder: number
  assignedToId: string | null
  reviewerId: string | null
  startedAt: string | null
  submittedAt: string | null
  approvedAt: string | null
  signedOffAt: string | null
  rejectedAt: string | null
  reviewNotes: string | null
  rejectionReason: string | null
  estimatedHours: number | null
  actualHours: number | null
  notes: string | null
}

type DesignCard = {
  id: string
  status: string
  product: {
    id: string
    description: string
    partCode: string
    productJobNumber: string | null
  }
  project: {
    id: string
    projectNumber: string
    name: string
  }
  assignedDesigner: { id: string; name: string } | null
  jobCards: JobCard[]
}

// Determine which column a product card belongs to based on its job cards
function getProductStage(card: DesignCard): string {
  if (card.status === "COMPLETE") return "COMPLETE"
  if (card.status === "QUEUED") return "QUEUED"

  // Find the current active job
  const activeJob = card.jobCards.find(
    (j) => j.status === "IN_PROGRESS" || j.status === "SUBMITTED" || j.status === "REJECTED"
  ) || card.jobCards.find((j) => j.status === "APPROVED") || card.jobCards.find((j) => j.status === "READY")

  if (activeJob) return activeJob.jobType

  // All done but card not complete?
  return "DESIGN_REVIEW"
}

const COLUMNS = [
  { id: "QUEUED", label: "To Do", borderColor: "border-t-gray-400", bg: "bg-gray-50/50" },
  { id: "GA_DRAWING", label: "GA Drawing", borderColor: "border-t-blue-400", bg: "bg-blue-50/30" },
  { id: "PRODUCTION_DRAWINGS", label: "Prod Drawings", borderColor: "border-t-indigo-400", bg: "bg-indigo-50/30" },
  { id: "BOM_FINALISATION", label: "BOM", borderColor: "border-t-amber-400", bg: "bg-amber-50/30" },
  { id: "DESIGN_REVIEW", label: "Design Review", borderColor: "border-t-purple-400", bg: "bg-purple-50/30" },
  { id: "COMPLETE", label: "Complete", borderColor: "border-t-green-500", bg: "bg-green-50/30" },
]

export function MyWorkBoard({ cards }: { cards: DesignCard[] }) {
  // Group by stage — flat product list, no project grouping
  const grouped: Record<string, DesignCard[]> = {}
  for (const col of COLUMNS) {
    grouped[col.id] = []
  }
  for (const card of cards) {
    const stage = getProductStage(card)
    if (grouped[stage]) {
      grouped[stage].push(card)
    } else {
      grouped["QUEUED"].push(card)
    }
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {COLUMNS.map((col) => {
        const colCards = grouped[col.id]
        return (
          <div
            key={col.id}
            className={`flex flex-col rounded-lg border border-border ${col.borderColor} border-t-4 min-w-[260px] max-w-[300px] flex-1 shrink-0 ${col.bg}`}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
              <span className="text-xs font-semibold uppercase text-gray-700">{col.label}</span>
              <span className="flex items-center justify-center h-5 min-w-5 rounded-full bg-gray-200 px-1.5 text-[10px] font-semibold text-gray-600">
                {colCards.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex flex-col gap-2 p-2 overflow-y-auto max-h-[calc(100vh-260px)] min-h-[80px]">
              {colCards.map((card) => (
                <ProductWorkCard key={card.id} card={card} />
              ))}
              {colCards.length === 0 && (
                <div className="py-6 text-center text-xs text-gray-400">
                  No tasks
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ProductWorkCard({ card }: { card: DesignCard }) {
  // Find the current active job card for action buttons
  const activeJob = card.jobCards.find(
    (j) => j.status === "IN_PROGRESS" || j.status === "SUBMITTED" || j.status === "REJECTED" || j.status === "READY" || j.status === "APPROVED"
  )

  return (
    <>
      <div className="rounded-lg border border-border bg-white p-3 shadow-sm">
        {/* Product info — PRIMARY focus */}
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-900 truncate">{card.product.description}</div>
            <div className="text-xs text-gray-500 font-mono mt-0.5">
              {card.product.productJobNumber || card.product.partCode}
            </div>
          </div>
          <Link
            href={`/design/bom/${card.id}`}
            className="p-1 text-gray-400 hover:text-amber-600 transition-colors shrink-0"
            title="Edit BOM"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </Link>
        </div>

        {/* Small project ref */}
        <div className="mt-1.5">
          <Link href={`/projects/${card.project.id}`} className="text-[10px] text-gray-400 hover:text-blue-500 hover:underline">
            {card.project.projectNumber} — {card.project.name}
          </Link>
        </div>

        {/* Job cards progress — 4 mini bars */}
        <div className="flex gap-1 mt-2">
          {card.jobCards.map((jc) => {
            const color =
              jc.status === "SIGNED_OFF" ? "bg-green-500" :
              jc.status === "APPROVED" ? "bg-emerald-400" :
              jc.status === "SUBMITTED" ? "bg-amber-400" :
              jc.status === "IN_PROGRESS" ? "bg-blue-400" :
              jc.status === "READY" ? "bg-slate-300" :
              jc.status === "REJECTED" ? "bg-red-400" :
              "bg-gray-200"
            const labels: Record<string, string> = {
              GA_DRAWING: "GA",
              PRODUCTION_DRAWINGS: "Prod",
              BOM_FINALISATION: "BOM",
              DESIGN_REVIEW: "Review",
            }
            return (
              <div key={jc.id} className="flex-1">
                <Link href={`/design/jobs/${jc.id}`}>
                  <div className={`h-2 rounded-full ${color} hover:opacity-80 cursor-pointer`} title={`${labels[jc.jobType] || jc.jobType}: ${jc.status.replace(/_/g, " ")}`} />
                </Link>
                <p className="text-[8px] text-gray-400 mt-0.5 text-center">{labels[jc.jobType] || jc.jobType}</p>
              </div>
            )
          })}
        </div>

        {/* Action button for the active job */}
        {activeJob && (
          <div className="mt-2 pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-500">
                {JOB_TYPE_LABELS[activeJob.jobType] || activeJob.jobType}
              </span>
              <TaskActionButtons jobCard={{ id: activeJob.id, status: activeJob.status, rejectionReason: activeJob.rejectionReason }} />
            </div>
          </div>
        )}

        {/* Completed indicator with link to project for handover */}
        {card.status === "COMPLETE" && !activeJob && (
          <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-green-600">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-xs font-medium">Design Complete</span>
            </div>
            <Link
              href={`/projects/${card.project.id}`}
              className="text-[10px] text-blue-600 hover:text-blue-700 hover:underline font-medium"
            >
              View Project
            </Link>
          </div>
        )}
      </div>

    </>
  )
}
