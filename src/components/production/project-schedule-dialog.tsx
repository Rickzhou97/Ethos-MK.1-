"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { WORKSHOP_STAGES, STAGE_DISPLAY_NAMES, DEFAULT_STAGE_HOURS } from "@/lib/production-utils"

type Product = {
  id: string
  partCode: string
  description: string
  quantity: number
  productionStatus: string | null
  productionPlannedStart?: string | null
  productionTargetDate?: string | null
  designCard?: { id: string } | null
}

type Props = {
  open: boolean
  onClose: () => void
  project: {
    id: string
    projectNumber: string
    name: string
    targetCompletion: string | null
    products: Product[]
  }
}

const WORKING_HOURS_PER_DAY = 8

function addWorkingDays(start: Date, days: number): Date {
  const d = new Date(start)
  let added = 0
  while (added < days) {
    d.setDate(d.getDate() + 1)
    if (d.getDay() !== 0 && d.getDay() !== 6) added++
  }
  return d
}

export function ProjectScheduleDialog({ open, onClose, project }: Props) {
  const [startDate, setStartDate] = useState("")
  const [stageHours, setStageHours] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState(false)

  // Initialize from product data
  useEffect(() => {
    if (!open) return
    // Find earliest productionPlannedStart
    const starts = project.products
      .map((p) => p.productionPlannedStart)
      .filter(Boolean) as string[]
    if (starts.length > 0) {
      const earliest = new Date(starts.sort()[0])
      setStartDate(earliest.toISOString().split("T")[0])
    } else {
      setStartDate("")
    }
    // Initialize stage hours from defaults
    const hours: Record<string, number> = {}
    for (const stage of WORKSHOP_STAGES) {
      hours[stage] = DEFAULT_STAGE_HOURS[stage] || 0
    }
    setStageHours(hours)
  }, [open, project])

  if (!open) return null

  const totalHours = WORKSHOP_STAGES.reduce((sum, s) => sum + (stageHours[s] || 0), 0)
  const totalDays = Math.ceil(totalHours / WORKING_HOURS_PER_DAY)

  const startObj = startDate ? new Date(startDate) : null
  const endDate = startObj ? addWorkingDays(startObj, totalDays) : null

  const dateFmt: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }

  async function handleSaveStartDate() {
    if (!startDate) return
    setSaving(true)
    try {
      // Save productionPlannedStart on all products
      await Promise.all(
        project.products.map((p) =>
          fetch(`/api/products/${p.id}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productionPlannedStart: startDate }),
          })
        )
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <div className="text-xs font-mono text-gray-400">{project.projectNumber}</div>
            <div className="text-lg font-semibold text-gray-900">{project.name}</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Schedule Section */}
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Production Schedule</h3>

          {/* Start Date + DDL row */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Start Date</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="flex-1 text-sm border border-gray-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                />
                <button
                  onClick={handleSaveStartDate}
                  disabled={saving || !startDate}
                  className="text-xs px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 font-medium"
                >
                  {saving ? "..." : "Save"}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Deadline (DDL)</label>
              <div className={`text-sm font-semibold px-2.5 py-1.5 rounded-md border ${
                project.targetCompletion && new Date(project.targetCompletion) < new Date()
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-gray-200 bg-gray-50 text-gray-800"
              }`}>
                {project.targetCompletion
                  ? new Date(project.targetCompletion).toLocaleDateString("en-GB", dateFmt)
                  : "Not set"}
              </div>
            </div>
          </div>

          {/* Stage hours (editable) */}
          <div className="space-y-1.5">
            <div className="text-xs text-gray-500 font-medium">Estimated Time per Stage</div>
            <div className="grid grid-cols-3 gap-2">
              {WORKSHOP_STAGES.map((stage) => (
                <div key={stage} className="flex items-center justify-between bg-gray-50 rounded-md px-2.5 py-1.5 border border-gray-100">
                  <span className="text-xs text-gray-600">{STAGE_DISPLAY_NAMES[stage]}</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      value={stageHours[stage] || 0}
                      onChange={(e) => setStageHours((prev) => ({ ...prev, [stage]: Number(e.target.value) || 0 }))}
                      className="w-12 text-xs text-right border border-gray-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                    <span className="text-[10px] text-gray-400">h</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-gray-200">
              <span className="text-xs font-semibold text-gray-600">Total</span>
              <span className="text-xs font-semibold text-gray-800 font-mono">{totalHours}h ({totalDays} working days)</span>
            </div>
          </div>

          {/* Estimated End */}
          <div className="mt-3 flex items-center justify-between bg-blue-50 rounded-md px-3 py-2 border border-blue-200">
            <span className="text-xs font-medium text-blue-700">Estimated End Date</span>
            <span className={`text-sm font-bold ${
              endDate && project.targetCompletion && endDate > new Date(project.targetCompletion)
                ? "text-red-600"
                : "text-green-700"
            }`}>
              {endDate ? endDate.toLocaleDateString("en-GB", dateFmt) : "Set a start date"}
            </span>
          </div>
        </div>

        {/* Products Section */}
        <div className="px-5 py-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Products ({project.products.length})
          </h3>
          <div className="space-y-2">
            {project.products.map((product) => {
              const stageName = STAGE_DISPLAY_NAMES[product.productionStatus || ""] || product.productionStatus || "Awaiting"
              const stageColor =
                product.productionStatus === "COMPLETED" ? "bg-green-100 text-green-700" :
                product.productionStatus === "PACKING" ? "bg-cyan-100 text-cyan-700" :
                product.productionStatus === "PAINTING" ? "bg-teal-100 text-teal-700" :
                product.productionStatus === "SHOTBLASTING" ? "bg-lime-100 text-lime-700" :
                product.productionStatus === "FITTING" ? "bg-yellow-100 text-yellow-700" :
                product.productionStatus === "FABRICATION" ? "bg-amber-100 text-amber-700" :
                product.productionStatus === "CUTTING" ? "bg-orange-100 text-orange-700" :
                "bg-gray-100 text-gray-600"

              return (
                <div key={product.id} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-900 truncate">{product.description}</div>
                    <div className="text-xs text-gray-400 font-mono">{product.partCode} {product.quantity > 1 ? `x${product.quantity}` : ""}</div>
                  </div>
                  <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-medium ${stageColor}`}>
                    {stageName}
                  </span>
                  {product.designCard?.id ? (
                    <Link
                      href={`/design/bom/${product.designCard.id}`}
                      className="shrink-0 text-[10px] font-medium px-2.5 py-1 rounded-md bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      BOM
                    </Link>
                  ) : (
                    <span className="shrink-0 text-[10px] text-gray-300 px-2.5 py-1">No BOM</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
