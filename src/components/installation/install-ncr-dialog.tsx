"use client"

import { useState } from "react"
import { X } from "lucide-react"

export type InstallNcrData = {
  ncrTitle: string
  ncrDescription: string
  ncrSeverity: string
  ncrCostImpact: number | null
  ncrRootCause: string
}

export function InstallNcrDialog({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (data: InstallNcrData) => void
}) {
  const [data, setData] = useState<InstallNcrData>({
    ncrTitle: "",
    ncrDescription: "",
    ncrSeverity: "MINOR",
    ncrCostImpact: null,
    ncrRootCause: "INSTALLATION_ERROR",
  })
  const [submitting, setSubmitting] = useState(false)

  if (!open) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    onSubmit(data)
    setSubmitting(false)
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-lg shadow-xl border border-gray-200 w-full max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
            <h3 className="text-base font-semibold text-gray-900">
              Reject — Create NCR
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content */}
          <div className="px-5 py-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                NCR Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={data.ncrTitle}
                onChange={(e) => setData({ ...data, ncrTitle: e.target.value })}
                required
                placeholder="Brief title for the NCR"
                className="w-full rounded border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Description
              </label>
              <textarea
                value={data.ncrDescription}
                onChange={(e) => setData({ ...data, ncrDescription: e.target.value })}
                rows={3}
                placeholder="Describe the issue found..."
                className="w-full rounded border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Severity
                </label>
                <select
                  value={data.ncrSeverity}
                  onChange={(e) => setData({ ...data, ncrSeverity: e.target.value })}
                  className="w-full rounded border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="MINOR">Minor</option>
                  <option value="MAJOR">Major</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Root Cause
                </label>
                <select
                  value={data.ncrRootCause}
                  onChange={(e) => setData({ ...data, ncrRootCause: e.target.value })}
                  className="w-full rounded border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="INSTALLATION_ERROR">Installation Error</option>
                  <option value="DESIGN_ERROR">Design Error</option>
                  <option value="MATERIAL_DEFECT">Material Defect</option>
                  <option value="TRANSPORT_DAMAGE">Transport Damage</option>
                  <option value="SITE_CONDITION">Site Condition</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Cost Impact (£)
              </label>
              <input
                type="number"
                value={data.ncrCostImpact ?? ""}
                onChange={(e) =>
                  setData({
                    ...data,
                    ncrCostImpact: e.target.value ? parseFloat(e.target.value) : null,
                  })
                }
                step="0.01"
                min="0"
                placeholder="0.00"
                className="w-full rounded border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200 bg-gray-50 rounded-b-lg">
            <button
              type="button"
              onClick={onClose}
              className="rounded px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !data.ncrTitle}
              className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {submitting ? "Creating NCR..." : "Reject & Create NCR"}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
