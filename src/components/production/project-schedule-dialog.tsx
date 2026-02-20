"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { WORKSHOP_STAGES, STAGE_DISPLAY_NAMES, DEFAULT_STAGE_HOURS, STAGE_HOUR_FIELDS } from "@/lib/production-utils"

type Product = {
  id: string
  partCode: string
  description: string
  quantity: number
  productionStatus: string | null
  productionPlannedStart?: string | null
  productionTargetDate?: string | null
  designCard?: { id: string } | null
  // Per-stage hours
  productionCuttingHours?: number | null
  productionFabricationHours?: number | null
  productionFittingHours?: number | null
  productionShotblastingHours?: number | null
  productionPaintingHours?: number | null
  productionPackingHours?: number | null
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

function getProductHours(product: Product, stage: string): number {
  const field = STAGE_HOUR_FIELDS[stage] as keyof Product
  const val = product[field]
  return val != null ? Number(val) : 0
}

export function ProjectScheduleDialog({ open, onClose, project }: Props) {
  const [startDate, setStartDate] = useState("")
  // Per-product, per-stage hours: { [productId]: { [stage]: hours } }
  const [productHours, setProductHours] = useState<Record<string, Record<string, number>>>({})
  const [saving, setSaving] = useState(false)
  const [savingHours, setSavingHours] = useState<Record<string, boolean>>({})

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
    // Initialize per-product stage hours from DB or defaults
    const hours: Record<string, Record<string, number>> = {}
    for (const p of project.products) {
      hours[p.id] = {}
      for (const stage of WORKSHOP_STAGES) {
        const dbVal = getProductHours(p, stage)
        hours[p.id][stage] = dbVal || DEFAULT_STAGE_HOURS[stage] || 0
      }
    }
    setProductHours(hours)
  }, [open, project])

  if (!open) return null

  // Calculate totals
  const productTotals: Record<string, number> = {}
  let grandTotal = 0
  for (const p of project.products) {
    const total = WORKSHOP_STAGES.reduce((sum, s) => sum + (productHours[p.id]?.[s] || 0), 0)
    productTotals[p.id] = total
    grandTotal += total
  }
  const grandTotalDays = Math.ceil(grandTotal / WORKING_HOURS_PER_DAY)

  // Find max product total for end date estimation (parallel production)
  const maxProductHours = Math.max(...project.products.map((p) => productTotals[p.id] || 0), 0)
  const maxProductDays = Math.ceil(maxProductHours / WORKING_HOURS_PER_DAY)

  const startObj = startDate ? new Date(startDate) : null
  const endDate = startObj ? addWorkingDays(startObj, maxProductDays) : null

  const dateFmt: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }

  function updateProductStageHours(productId: string, stage: string, value: number) {
    setProductHours((prev) => ({
      ...prev,
      [productId]: { ...prev[productId], [stage]: value },
    }))
  }

  async function handleSaveStartDate() {
    if (!startDate) return
    setSaving(true)
    try {
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

  async function handleSaveProductHours(productId: string) {
    const hours = productHours[productId]
    if (!hours) return
    setSavingHours((prev) => ({ ...prev, [productId]: true }))
    try {
      const body: Record<string, number> = {}
      for (const stage of WORKSHOP_STAGES) {
        body[STAGE_HOUR_FIELDS[stage]] = hours[stage] || 0
      }
      await fetch(`/api/products/${productId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    } finally {
      setSavingHours((prev) => ({ ...prev, [productId]: false }))
    }
  }

  async function handleSaveAll() {
    setSaving(true)
    try {
      const promises: Promise<unknown>[] = []
      if (startDate) {
        for (const p of project.products) {
          promises.push(
            fetch(`/api/products/${p.id}/status`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ productionPlannedStart: startDate }),
            })
          )
        }
      }
      for (const p of project.products) {
        const hours = productHours[p.id]
        if (!hours) continue
        const body: Record<string, number> = {}
        for (const stage of WORKSHOP_STAGES) {
          body[STAGE_HOUR_FIELDS[stage]] = hours[stage] || 0
        }
        promises.push(
          fetch(`/api/products/${p.id}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        )
      }
      await Promise.all(promises)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto mx-4"
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

        {/* Schedule Header */}
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Production Schedule</h3>

          {/* Start Date + DDL row */}
          <div className="grid grid-cols-2 gap-4 mb-3">
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

          {/* Estimated End */}
          <div className="flex items-center justify-between bg-blue-50 rounded-md px-3 py-2 border border-blue-200">
            <span className="text-xs font-medium text-blue-700">Estimated End Date (longest product)</span>
            <span className={`text-sm font-bold ${
              endDate && project.targetCompletion && endDate > new Date(project.targetCompletion)
                ? "text-red-600"
                : "text-green-700"
            }`}>
              {endDate ? endDate.toLocaleDateString("en-GB", dateFmt) : "Set a start date"}
            </span>
          </div>
        </div>

        {/* Per-Product Time Table */}
        <div className="px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">
              Product Time Estimates ({project.products.length} products)
            </h3>
            <button
              onClick={handleSaveAll}
              disabled={saving}
              className="text-xs px-4 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {saving ? "Saving..." : "Save All"}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 pr-2 text-gray-500 font-semibold min-w-[160px]">Product</th>
                  <th className="text-left py-2 pr-1 text-gray-500 font-semibold w-[50px]">Stage</th>
                  {WORKSHOP_STAGES.map((stage) => (
                    <th key={stage} className="text-center py-2 px-1 text-gray-500 font-semibold w-[65px]">
                      {STAGE_DISPLAY_NAMES[stage]}
                    </th>
                  ))}
                  <th className="text-right py-2 pl-2 text-gray-600 font-bold w-[60px]">Total</th>
                  <th className="py-2 pl-2 w-[60px]"></th>
                </tr>
              </thead>
              <tbody>
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
                  const totalH = productTotals[product.id] || 0
                  const totalD = Math.ceil(totalH / WORKING_HOURS_PER_DAY)

                  return (
                    <tr key={product.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                      <td className="py-2 pr-2">
                        <div className="flex items-center gap-2">
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-gray-900 truncate">{product.description}</div>
                            <div className="text-[10px] text-gray-400 font-mono">{product.partCode} {product.quantity > 1 ? `x${product.quantity}` : ""}</div>
                          </div>
                          {product.designCard?.id && (
                            <Link
                              href={`/design/bom/${product.designCard.id}`}
                              className="shrink-0 text-[9px] font-medium px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              BOM
                            </Link>
                          )}
                        </div>
                      </td>
                      <td className="py-2 pr-1">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-medium ${stageColor}`}>
                          {stageName}
                        </span>
                      </td>
                      {WORKSHOP_STAGES.map((stage) => (
                        <td key={stage} className="py-1.5 px-0.5">
                          <input
                            type="number"
                            min={0}
                            step={0.5}
                            value={productHours[product.id]?.[stage] ?? 0}
                            onChange={(e) => updateProductStageHours(product.id, stage, Number(e.target.value) || 0)}
                            className="w-full text-xs text-center border border-gray-200 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                          />
                        </td>
                      ))}
                      <td className="py-2 pl-2 text-right">
                        <span className="text-xs font-semibold text-gray-800 font-mono">{totalH}h</span>
                        <div className="text-[9px] text-gray-400">{totalD}d</div>
                      </td>
                      <td className="py-2 pl-2">
                        <button
                          onClick={() => handleSaveProductHours(product.id)}
                          disabled={savingHours[product.id]}
                          className="text-[10px] px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50 font-medium"
                        >
                          {savingHours[product.id] ? "..." : "Save"}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {/* Totals row */}
              <tfoot>
                <tr className="border-t-2 border-gray-300">
                  <td colSpan={2} className="py-2 pr-2 text-xs font-bold text-gray-700">Project Total</td>
                  {WORKSHOP_STAGES.map((stage) => {
                    const stageTotal = project.products.reduce(
                      (sum, p) => sum + (productHours[p.id]?.[stage] || 0), 0
                    )
                    return (
                      <td key={stage} className="py-2 px-0.5 text-center text-xs font-semibold text-gray-600 font-mono">
                        {stageTotal}h
                      </td>
                    )
                  })}
                  <td className="py-2 pl-2 text-right">
                    <span className="text-xs font-bold text-gray-900 font-mono">{grandTotal}h</span>
                    <div className="text-[9px] text-gray-500">{grandTotalDays}d</div>
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
