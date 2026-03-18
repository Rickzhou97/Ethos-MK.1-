"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import {
  MapPin,
  Eye,
  Edit,
  X,
  Package,
  AlertTriangle,
  Trash2,
  Save,
  GripVertical,
  FileText,
  StickyNote,
} from "lucide-react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Product {
  id: string
  partCode: string
  description: string
  installStatus: string | null
  installTargetDate: string | null
  installPlannedStart: string | null
  installCompletionDate: string | null
  installEstimatedHours: number | string | null
}

interface Ncr {
  id: string
  ncrNumber: string
  title: string
  severity: string
  status: string
}

interface Annotation {
  id: string
  documentId: string
  productId: string | null
  pageNumber: number
  xPercent: number | string
  yPercent: number | string
  label: string | null
  notes: string | null
  pinType: string
  product: (Product & { ncrs: Ncr[] }) | null
}

interface Document {
  id: string
  filename: string
  filePath: string
  description: string | null
  uploadedAt: string
}

interface Project {
  id: string
  projectNumber: string
  name: string
  products: Product[]
  documents: Document[]
}

interface DesignVisualizerProps {
  projects: Project[]
}

// ---------------------------------------------------------------------------
// Pin colour helper
// ---------------------------------------------------------------------------

const IN_PROGRESS_STAGES = ["SITE_PREP", "DELIVERY", "INSTALL", "CONNECTIONS", "TESTING"]
const COMPLETED_STAGES = ["COMPLETED", "HANDOVER"]

function getPinColor(annotation: Annotation): string {
  if (annotation.pinType === "NOTE") return "bg-yellow-400 border-yellow-600"
  if (!annotation.product) return "bg-gray-400 border-gray-600"

  const hasOpenNcrs = annotation.product.ncrs && annotation.product.ncrs.length > 0
  if (hasOpenNcrs) return "bg-red-500 border-red-700"

  const status = annotation.product.installStatus
  if (!status) return "bg-gray-400 border-gray-600"
  if (COMPLETED_STAGES.includes(status)) return "bg-green-500 border-green-700"
  if (IN_PROGRESS_STAGES.includes(status)) return "bg-blue-500 border-blue-700"
  return "bg-gray-400 border-gray-600"
}

function getStatusBadge(status: string | null) {
  if (!status) return { label: "No Status", cls: "bg-gray-100 text-gray-700" }
  const map: Record<string, { label: string; cls: string }> = {
    SITE_PREP: { label: "Site Prep", cls: "bg-orange-100 text-orange-700" },
    DELIVERY: { label: "Delivery", cls: "bg-blue-100 text-blue-700" },
    INSTALL: { label: "Install", cls: "bg-indigo-100 text-indigo-700" },
    CONNECTIONS: { label: "Connections", cls: "bg-purple-100 text-purple-700" },
    TESTING: { label: "Testing", cls: "bg-amber-100 text-amber-700" },
    HANDOVER: { label: "Handover", cls: "bg-green-100 text-green-700" },
    COMPLETED: { label: "Completed", cls: "bg-emerald-100 text-emerald-700" },
  }
  return map[status] ?? { label: status, cls: "bg-gray-100 text-gray-700" }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DesignVisualizer({ projects }: DesignVisualizerProps) {
  // Selection state
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id ?? "")
  const [selectedDocId, setSelectedDocId] = useState<string>("")
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [selectedAnnotation, setSelectedAnnotation] = useState<Annotation | null>(null)

  // Edit mode
  const [editMode, setEditMode] = useState(false)
  const [placingPin, setPlacingPin] = useState(false)
  const [newPinPos, setNewPinPos] = useState<{ x: number; y: number } | null>(null)
  const [newPinProductId, setNewPinProductId] = useState<string>("")
  const [newPinType, setNewPinType] = useState<string>("PRODUCT")
  const [newPinLabel, setNewPinLabel] = useState("")
  const [newPinNotes, setNewPinNotes] = useState("")

  // Drag state
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const viewerRef = useRef<HTMLDivElement>(null)

  // Derived
  const selectedProject = projects.find((p) => p.id === selectedProjectId)
  const documents = selectedProject?.documents ?? []
  const products = selectedProject?.products ?? []
  const selectedDoc = documents.find((d) => d.id === selectedDocId)

  // Auto-select first document when project changes
  useEffect(() => {
    if (documents.length > 0) {
      setSelectedDocId(documents[0].id)
    } else {
      setSelectedDocId("")
    }
    setSelectedAnnotation(null)
  }, [selectedProjectId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch annotations when doc changes
  useEffect(() => {
    if (!selectedDocId) {
      setAnnotations([])
      return
    }
    fetchAnnotations()
  }, [selectedDocId]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchAnnotations = useCallback(async () => {
    if (!selectedDocId) return
    try {
      const res = await fetch(`/api/documents/${selectedDocId}/annotations`)
      if (res.ok) {
        const data = await res.json()
        setAnnotations(data)
      }
    } catch (err) {
      console.error("Failed to fetch annotations:", err)
    }
  }, [selectedDocId])

  // ------ Pin placement ------

  const handleViewerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!editMode || !selectedDocId) return
    const rect = viewerRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setNewPinPos({ x, y })
    setPlacingPin(true)
    setNewPinProductId("")
    setNewPinType("PRODUCT")
    setNewPinLabel("")
    setNewPinNotes("")
  }

  const saveNewPin = async () => {
    if (!newPinPos || !selectedDocId) return
    try {
      const res = await fetch(`/api/documents/${selectedDocId}/annotations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: newPinProductId || null,
          pageNumber: 1,
          xPercent: newPinPos.x,
          yPercent: newPinPos.y,
          label: newPinLabel || null,
          notes: newPinNotes || null,
          pinType: newPinType,
        }),
      })
      if (res.ok) {
        setPlacingPin(false)
        setNewPinPos(null)
        await fetchAnnotations()
      }
    } catch (err) {
      console.error("Failed to save annotation:", err)
    }
  }

  const deleteAnnotation = async (id: string) => {
    try {
      const res = await fetch(`/api/documents/${selectedDocId}/annotations/${id}`, {
        method: "DELETE",
      })
      if (res.ok) {
        setAnnotations((prev) => prev.filter((a) => a.id !== id))
        if (selectedAnnotation?.id === id) setSelectedAnnotation(null)
      }
    } catch (err) {
      console.error("Failed to delete annotation:", err)
    }
  }

  // ------ Drag to reposition ------

  const handleMouseDown = (e: React.MouseEvent, annotationId: string) => {
    if (!editMode) return
    e.stopPropagation()
    e.preventDefault()
    setDraggingId(annotationId)
  }

  useEffect(() => {
    if (!draggingId) return

    const handleMouseMove = (e: MouseEvent) => {
      const rect = viewerRef.current?.getBoundingClientRect()
      if (!rect) return
      const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
      const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100))
      setAnnotations((prev) =>
        prev.map((a) => (a.id === draggingId ? { ...a, xPercent: x, yPercent: y } : a))
      )
    }

    const handleMouseUp = async () => {
      const ann = annotations.find((a) => a.id === draggingId)
      if (ann) {
        try {
          await fetch(`/api/documents/${selectedDocId}/annotations/${draggingId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              xPercent: Number(ann.xPercent),
              yPercent: Number(ann.yPercent),
            }),
          })
        } catch (err) {
          console.error("Failed to update pin position:", err)
        }
      }
      setDraggingId(null)
    }

    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [draggingId, annotations, selectedDocId])

  // ------ Render ------

  return (
    <div className="flex h-full gap-0">
      {/* ====== LEFT: Document Viewer (70%) ====== */}
      <div className="flex w-[70%] flex-col border-r border-gray-200">
        {/* Toolbar */}
        <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-2">
          {/* Project selector */}
          <select
            className="rounded border border-gray-300 px-2 py-1.5 text-sm"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
          >
            {projects.length === 0 && <option value="">No installation projects</option>}
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.projectNumber} - {p.name}
              </option>
            ))}
          </select>

          {/* Document selector */}
          <select
            className="max-w-[260px] truncate rounded border border-gray-300 px-2 py-1.5 text-sm"
            value={selectedDocId}
            onChange={(e) => {
              setSelectedDocId(e.target.value)
              setSelectedAnnotation(null)
            }}
          >
            {documents.length === 0 && <option value="">No drawings</option>}
            {documents.map((d) => (
              <option key={d.id} value={d.id}>
                {d.filename}
              </option>
            ))}
          </select>

          <div className="flex-1" />

          {/* Pin count */}
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <MapPin className="h-3.5 w-3.5" />
            {annotations.length} pin{annotations.length !== 1 ? "s" : ""}
          </span>

          {/* Edit mode toggle */}
          <button
            onClick={() => {
              setEditMode(!editMode)
              setPlacingPin(false)
              setNewPinPos(null)
            }}
            className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition ${
              editMode
                ? "bg-blue-600 text-white"
                : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            {editMode ? <Edit className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {editMode ? "Editing" : "View"}
          </button>
        </div>

        {/* Document display area */}
        <div className="relative flex-1 overflow-auto bg-gray-100">
          {!selectedDocId ? (
            <div className="flex h-full flex-col items-center justify-center text-gray-400">
              <FileText className="mb-3 h-16 w-16" />
              <p className="text-lg font-medium">No drawing selected</p>
              <p className="text-sm">Select a project with uploaded drawings to begin</p>
            </div>
          ) : (
            <div
              ref={viewerRef}
              className={`relative mx-auto my-4 aspect-[1.414/1] max-h-[calc(100%-2rem)] w-[calc(100%-2rem)] bg-white shadow-lg ${
                editMode ? "cursor-crosshair" : ""
              }`}
              onClick={handleViewerClick}
            >
              {/* If we have a filePath, try to show it as image */}
              {selectedDoc?.filePath ? (
                <img
                  src={`/${selectedDoc.filePath}`}
                  alt={selectedDoc.filename}
                  className="pointer-events-none h-full w-full object-contain"
                  onError={(e) => {
                    // If image fails to load, hide it (the placeholder behind will show)
                    ;(e.target as HTMLImageElement).style.display = "none"
                  }}
                />
              ) : null}

              {/* Placeholder overlay when no image or image fails */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300">
                <FileText className="mb-2 h-20 w-20" />
                <p className="text-lg font-medium">{selectedDoc?.filename}</p>
                <p className="text-sm">Drawing preview</p>
              </div>

              {/* Annotation pins */}
              {annotations.map((ann) => {
                const x = Number(ann.xPercent)
                const y = Number(ann.yPercent)
                const isSelected = selectedAnnotation?.id === ann.id
                const pinColor = getPinColor(ann)
                return (
                  <div
                    key={ann.id}
                    className={`absolute z-10 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 shadow-md transition-transform ${pinColor} ${
                      isSelected ? "h-8 w-8 scale-110 ring-2 ring-white" : "h-6 w-6"
                    } ${editMode ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"} ${
                      draggingId === ann.id ? "opacity-70" : ""
                    }`}
                    style={{ left: `${x}%`, top: `${y}%` }}
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedAnnotation(ann)
                    }}
                    onMouseDown={(e) => handleMouseDown(e, ann.id)}
                    title={ann.label || ann.product?.partCode || "Pin"}
                  >
                    {ann.pinType === "NOTE" ? (
                      <StickyNote className="h-3 w-3 text-white" />
                    ) : (
                      <Package className="h-3 w-3 text-white" />
                    )}
                  </div>
                )
              })}

              {/* New pin being placed (preview) */}
              {newPinPos && placingPin && (
                <div
                  className="absolute z-20 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 animate-pulse items-center justify-center rounded-full border-2 border-blue-400 bg-blue-300 shadow-lg"
                  style={{ left: `${newPinPos.x}%`, top: `${newPinPos.y}%` }}
                >
                  <MapPin className="h-3.5 w-3.5 text-white" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ====== RIGHT: Detail Panel (30%) ====== */}
      <div className="flex w-[30%] flex-col bg-white">
        {/* New pin form */}
        {placingPin && newPinPos ? (
          <div className="flex flex-col gap-3 border-b border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <MapPin className="h-4 w-4 text-blue-600" />
                New Pin
              </h3>
              <button
                onClick={() => {
                  setPlacingPin(false)
                  setNewPinPos(null)
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Pin Type</label>
              <select
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                value={newPinType}
                onChange={(e) => setNewPinType(e.target.value)}
              >
                <option value="PRODUCT">Product</option>
                <option value="NOTE">Note</option>
              </select>
            </div>

            {newPinType === "PRODUCT" && (
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Product</label>
                <select
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  value={newPinProductId}
                  onChange={(e) => setNewPinProductId(e.target.value)}
                >
                  <option value="">Select product...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.partCode} - {p.description}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Label</label>
              <input
                type="text"
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                placeholder="Pin label..."
                value={newPinLabel}
                onChange={(e) => setNewPinLabel(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Notes</label>
              <textarea
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                rows={2}
                placeholder="Optional notes..."
                value={newPinNotes}
                onChange={(e) => setNewPinNotes(e.target.value)}
              />
            </div>

            <button
              onClick={saveNewPin}
              disabled={newPinType === "PRODUCT" && !newPinProductId}
              className="flex items-center justify-center gap-1.5 rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              Save Pin
            </button>
          </div>
        ) : null}

        {/* Selected annotation detail */}
        {selectedAnnotation && !placingPin ? (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">
                {selectedAnnotation.pinType === "NOTE" ? "Note" : "Product Pin"}
              </h3>
              <div className="flex items-center gap-1">
                {editMode && (
                  <button
                    onClick={() => deleteAnnotation(selectedAnnotation.id)}
                    className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600"
                    title="Delete pin"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => setSelectedAnnotation(null)}
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Label */}
            {selectedAnnotation.label && (
              <p className="mt-2 text-sm font-medium text-gray-700">{selectedAnnotation.label}</p>
            )}

            {/* Notes */}
            {selectedAnnotation.notes && (
              <p className="mt-1 text-sm text-gray-500">{selectedAnnotation.notes}</p>
            )}

            {/* Product details */}
            {selectedAnnotation.product && (
              <div className="mt-4 space-y-3">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <div className="flex items-start gap-2">
                    <Package className="mt-0.5 h-4 w-4 text-gray-400" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900">
                        {selectedAnnotation.product.partCode}
                      </p>
                      <p className="text-xs text-gray-500">
                        {selectedAnnotation.product.description}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Status badge */}
                <div>
                  <p className="mb-1 text-xs font-medium text-gray-500">Install Status</p>
                  {(() => {
                    const badge = getStatusBadge(selectedAnnotation.product.installStatus)
                    return (
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.cls}`}
                      >
                        {badge.label}
                      </span>
                    )
                  })()}
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-2">
                  <DateField
                    label="Planned Start"
                    value={selectedAnnotation.product.installPlannedStart}
                  />
                  <DateField
                    label="Target Date"
                    value={selectedAnnotation.product.installTargetDate}
                  />
                  <DateField
                    label="Completion"
                    value={selectedAnnotation.product.installCompletionDate}
                  />
                  <div>
                    <p className="text-xs text-gray-500">Est. Hours</p>
                    <p className="text-sm font-medium text-gray-900">
                      {selectedAnnotation.product.installEstimatedHours ?? "-"}
                    </p>
                  </div>
                </div>

                {/* NCRs */}
                {selectedAnnotation.product.ncrs &&
                  selectedAnnotation.product.ncrs.length > 0 && (
                    <div>
                      <p className="mb-1.5 flex items-center gap-1 text-xs font-medium text-red-600">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Open NCRs ({selectedAnnotation.product.ncrs.length})
                      </p>
                      <div className="space-y-1.5">
                        {selectedAnnotation.product.ncrs.map((ncr) => (
                          <div
                            key={ncr.id}
                            className="rounded border border-red-200 bg-red-50 px-2.5 py-1.5"
                          >
                            <p className="text-xs font-medium text-red-800">{ncr.ncrNumber}</p>
                            <p className="text-xs text-red-600">{ncr.title}</p>
                            <span
                              className={`mt-0.5 inline-block rounded text-[10px] font-medium ${
                                ncr.severity === "CRITICAL"
                                  ? "bg-red-200 text-red-800"
                                  : ncr.severity === "MAJOR"
                                    ? "bg-orange-200 text-orange-800"
                                    : "bg-yellow-200 text-yellow-800"
                              } px-1.5 py-0.5`}
                            >
                              {ncr.severity}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            )}

            {/* Position info */}
            <div className="mt-4 rounded border border-gray-100 bg-gray-50 px-3 py-2">
              <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
                Position
              </p>
              <p className="text-xs text-gray-500">
                x: {Number(selectedAnnotation.xPercent).toFixed(1)}% &nbsp; y:{" "}
                {Number(selectedAnnotation.yPercent).toFixed(1)}%
              </p>
              {editMode && (
                <p className="mt-1 text-[10px] text-gray-400">
                  <GripVertical className="inline h-3 w-3" /> Drag pin to reposition
                </p>
              )}
            </div>
          </div>
        ) : !placingPin ? (
          /* Empty state */
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center text-gray-400">
            <MapPin className="mb-3 h-10 w-10" />
            <p className="text-sm font-medium">No pin selected</p>
            <p className="mt-1 text-xs">
              {editMode
                ? "Click on the drawing to place a pin, or click an existing pin to view details"
                : "Click a pin on the drawing to view product details"}
            </p>
          </div>
        ) : null}

        {/* Legend */}
        <div className="border-t border-gray-200 bg-gray-50 px-4 py-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            Legend
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            <LegendItem color="bg-gray-400" label="No status" />
            <LegendItem color="bg-blue-500" label="In progress" />
            <LegendItem color="bg-green-500" label="Complete" />
            <LegendItem color="bg-red-500" label="Has NCRs" />
            <LegendItem color="bg-yellow-400" label="Note" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function DateField({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-medium text-gray-900">
        {value ? new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "-"}
      </p>
    </div>
  )
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      <span className="text-[10px] text-gray-600">{label}</span>
    </div>
  )
}
