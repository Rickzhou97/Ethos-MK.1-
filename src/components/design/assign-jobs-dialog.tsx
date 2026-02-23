"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

type JobCard = {
  id: string
  jobType: string
  status: string
  assignedToId: string | null
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
  assignedDesigner: { id: string; name: string } | null
  jobCards: JobCard[]
}

type Designer = { id: string; name: string }

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectNumber: string
  projectName: string
  designCards: DesignCard[]
  designers: Designer[]
}

const JOB_LABELS: Record<string, string> = {
  GA_DRAWING: "GA Drawing",
  PRODUCTION_DRAWINGS: "Production Drawings",
  BOM_FINALISATION: "BOM Finalisation",
  DESIGN_REVIEW: "Design Review",
}

const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  BLOCKED: { bg: "bg-gray-100", text: "text-gray-500" },
  READY: { bg: "bg-slate-100", text: "text-slate-600" },
  IN_PROGRESS: { bg: "bg-blue-100", text: "text-blue-700" },
  SUBMITTED: { bg: "bg-amber-100", text: "text-amber-700" },
  APPROVED: { bg: "bg-emerald-100", text: "text-emerald-700" },
  SIGNED_OFF: { bg: "bg-green-100", text: "text-green-700" },
  REJECTED: { bg: "bg-red-100", text: "text-red-700" },
}

export function AssignJobsDialog({ open, onOpenChange, projectNumber, projectName, designCards, designers }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [assignments, setAssignments] = useState<Record<string, string>>(() => {
    // Pre-fill with current assignments
    const map: Record<string, string> = {}
    for (const card of designCards) {
      for (const jc of card.jobCards) {
        if (jc.assignedToId) map[jc.id] = jc.assignedToId
      }
    }
    return map
  })

  if (!open) return null

  async function handleAssign(jobCardId: string, designerId: string) {
    if (!designerId) return
    setSaving((s) => ({ ...s, [jobCardId]: true }))

    try {
      const res = await fetch(`/api/design/jobs/${jobCardId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ designerId }),
      })

      if (res.ok) {
        setAssignments((a) => ({ ...a, [jobCardId]: designerId }))
        router.refresh()
      }
    } finally {
      setSaving((s) => ({ ...s, [jobCardId]: false }))
    }
  }

  // Assignable job types (GA and Production Drawings primarily, but allow all)
  const assignableTypes = ["GA_DRAWING", "PRODUCTION_DRAWINGS", "BOM_FINALISATION", "DESIGN_REVIEW"]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={() => onOpenChange(false)} />

      {/* Dialog */}
      <div className="relative bg-white rounded-lg shadow-xl border border-border w-full max-w-3xl mx-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border shrink-0">
          <h3 className="text-lg font-semibold text-gray-900">Assign Jobs to Designers</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            {projectNumber} — {projectName}
          </p>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-6 py-4">
          {designCards.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-gray-500">No design cards found for this project.</p>
              <p className="text-xs text-gray-400 mt-1">Activate design on products first using the &quot;+ Activate Design&quot; button on the project card.</p>
            </div>
          ) : (
          <div className="space-y-6">
            {designCards.map((card) => (
              <div key={card.id} className="border border-border rounded-lg overflow-hidden">
                {/* Product header */}
                <div className="bg-gray-50 px-4 py-2.5 border-b border-border">
                  <div className="text-sm font-medium text-gray-900">{card.product.description}</div>
                  <div className="text-xs text-gray-500 font-mono">
                    {card.product.productJobNumber || card.product.partCode}
                    {card.assignedDesigner && (
                      <span className="ml-2 text-indigo-500">
                        Card designer: {card.assignedDesigner.name}
                      </span>
                    )}
                  </div>
                </div>

                {/* Job cards table */}
                <div className="divide-y divide-border">
                  {card.jobCards
                    .filter((jc) => assignableTypes.includes(jc.jobType))
                    .map((jc) => {
                      const badge = STATUS_BADGE[jc.status] || STATUS_BADGE.BLOCKED
                      const currentDesignerId = assignments[jc.id] || ""
                      const isSaving = saving[jc.id]

                      return (
                        <div key={jc.id} className="flex items-center gap-3 px-4 py-2.5">
                          {/* Job type */}
                          <div className="w-[160px] shrink-0">
                            <span className="text-sm text-gray-700">{JOB_LABELS[jc.jobType] || jc.jobType}</span>
                          </div>

                          {/* Status badge */}
                          <div className="w-[100px] shrink-0">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.bg} ${badge.text}`}>
                              {jc.status.replace(/_/g, " ")}
                            </span>
                          </div>

                          {/* Designer select */}
                          <div className="flex-1">
                            <select
                              className="w-full rounded-md border border-border px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none disabled:opacity-50 disabled:bg-gray-50"
                              value={currentDesignerId}
                              disabled={isSaving || jc.status === "SIGNED_OFF"}
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleAssign(jc.id, e.target.value)
                                }
                              }}
                            >
                              <option value="">Unassigned</option>
                              {designers.map((d) => (
                                <option key={d.id} value={d.id}>
                                  {d.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Saving indicator */}
                          <div className="w-6 shrink-0">
                            {isSaving && (
                              <svg className="w-4 h-4 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                            )}
                          </div>
                        </div>
                      )
                    })}
                </div>
              </div>
            ))}
          </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border bg-gray-50 rounded-b-lg shrink-0">
          <div className="flex justify-end">
            <button
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-border rounded-lg hover:bg-gray-50"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
