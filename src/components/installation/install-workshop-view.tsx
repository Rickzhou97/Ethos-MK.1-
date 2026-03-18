"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  INSTALL_STAGES,
  INSTALL_STAGE_DISPLAY_NAMES,
} from "@/lib/install-utils"
import {
  Users,
  X,
  Plus,
  Truck,
  Wrench,
  HardHat,
  FileText,
  Check,
  Circle,
  AlertCircle,
  ChevronDown,
  MapPin,
  ExternalLink,
} from "lucide-react"

// ─── Types ───

type CrewMember = {
  id: string
  role: string | null
  worker: { id: string; name: string; role: string }
}

type CrewEquipment = {
  id: string
  name: string
  type: string
  registration: string | null
  notes: string | null
  isAvailable: boolean
}

type CrewInstruction = {
  id: string
  title: string
  type: string
  fileUrl: string | null
  notes: string | null
  document: { filename: string; filePath: string } | null
}

type Crew = {
  id: string
  name: string
  code: string
  isActive: boolean
  members: CrewMember[]
  equipment: CrewEquipment[]
  instructions: CrewInstruction[]
}

type TaskProduct = {
  partCode: string
  description: string
  quantity: number
  installTargetDate: string | null
  project: {
    projectNumber: string
    name: string
    priority: string
    siteLocation: string | null
    customer: { name: string } | null
  }
}

type InstallTask = {
  id: string
  productId: string
  projectId: string
  stage: string
  status: string
  assignedTo: string | null
  startedAt: string | null
  completedAt: string | null
  inspectionStatus: string | null
  ncrId: string | null
  product: TaskProduct
}

interface TeamDashboardProps {
  crews: Crew[]
  tasksByCrewId: Record<string, InstallTask[]>
}

// ─── Cell Status Helpers ───

type CellInfo = {
  dot: string
  label: string
  color: string
  bgColor: string
  actionable: "start" | "complete" | "inspect" | "none"
}

function getCellInfo(task: InstallTask | undefined): CellInfo {
  if (!task) {
    return { dot: "", label: "\u2014", color: "text-gray-400", bgColor: "bg-gray-50", actionable: "none" }
  }
  if (task.status === "PENDING") {
    return { dot: "bg-yellow-400", label: "Ready", color: "text-yellow-700", bgColor: "bg-yellow-50", actionable: "start" }
  }
  if (task.status === "IN_PROGRESS") {
    return { dot: "bg-blue-500", label: "Live", color: "text-blue-700", bgColor: "bg-blue-50", actionable: "complete" }
  }
  if (task.status === "REWORK") {
    return { dot: "bg-red-500", label: "Rework", color: "text-red-700", bgColor: "bg-red-50", actionable: "start" }
  }
  if (task.status === "COMPLETED" && task.inspectionStatus === "PENDING") {
    return { dot: "bg-green-500", label: "Inspect", color: "text-green-700", bgColor: "bg-green-50", actionable: "inspect" }
  }
  if (task.status === "COMPLETED" && task.inspectionStatus === "ACCEPTED") {
    return { dot: "", label: "Done", color: "text-green-600", bgColor: "bg-green-50/50", actionable: "none" }
  }
  if (task.status === "COMPLETED" && task.inspectionStatus === "REJECTED") {
    return { dot: "", label: "NCR", color: "text-red-600", bgColor: "bg-red-50", actionable: "none" }
  }
  return { dot: "bg-gray-400", label: task.status, color: "text-gray-600", bgColor: "bg-gray-50", actionable: "none" }
}

// ─── Main Component ───

export function InstallWorkshopView({ crews, tasksByCrewId }: TeamDashboardProps) {
  const router = useRouter()
  const [selectedCrewId, setSelectedCrewId] = useState<string>(crews[0]?.id || "")
  const [localTasks, setLocalTasks] = useState<Record<string, InstallTask[]>>(tasksByCrewId)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [openCell, setOpenCell] = useState<string | null>(null)

  // Member add form
  const [showAddMember, setShowAddMember] = useState(false)
  const [availableWorkers, setAvailableWorkers] = useState<Array<{ id: string; name: string; role: string }>>([])
  const [newMemberWorkerId, setNewMemberWorkerId] = useState("")
  const [newMemberRole, setNewMemberRole] = useState("Installer")
  const [loadingWorkers, setLoadingWorkers] = useState(false)

  // Equipment add form
  const [showAddEquipment, setShowAddEquipment] = useState(false)
  const [eqName, setEqName] = useState("")
  const [eqType, setEqType] = useState("TOOL")
  const [eqRegistration, setEqRegistration] = useState("")
  const [eqNotes, setEqNotes] = useState("")

  // Instruction add form
  const [showAddInstruction, setShowAddInstruction] = useState(false)
  const [instrTitle, setInstrTitle] = useState("")
  const [instrType, setInstrType] = useState("OTHER")
  const [instrFileUrl, setInstrFileUrl] = useState("")
  const [instrNotes, setInstrNotes] = useState("")

  const selectedCrew = crews.find((c) => c.id === selectedCrewId)
  const crewTasks = localTasks[selectedCrewId] || []

  // Build unique products from tasks
  const productMap = new Map<string, { product: TaskProduct; productId: string; tasks: Map<string, InstallTask> }>()
  for (const task of crewTasks) {
    if (!productMap.has(task.productId)) {
      productMap.set(task.productId, { product: task.product, productId: task.productId, tasks: new Map() })
    }
    productMap.get(task.productId)!.tasks.set(task.stage, task)
  }
  const productRows = Array.from(productMap.values())

  // Refresh tasks for current crew
  const refreshTasks = useCallback(async (crewId: string) => {
    try {
      const res = await fetch(`/api/installation/tasks?crewId=${crewId}`)
      if (res.ok) {
        const json = await res.json()
        setLocalTasks((prev) => ({ ...prev, [crewId]: json.tasks || json }))
      }
    } catch (err) {
      console.error("Failed to refresh tasks:", err)
    }
  }, [])

  // Task actions
  async function handleStart(taskId: string) {
    const assignedTo = prompt("Assign to (worker name):")
    if (!assignedTo) return
    setActionLoading(taskId)
    try {
      const res = await fetch(`/api/installation/tasks/${taskId}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedTo }),
      })
      if (res.ok) {
        setOpenCell(null)
        await refreshTasks(selectedCrewId)
      }
    } finally {
      setActionLoading(null)
    }
  }

  async function handleComplete(taskId: string) {
    setActionLoading(taskId)
    try {
      const res = await fetch(`/api/installation/tasks/${taskId}/complete`, { method: "POST" })
      if (res.ok) {
        setOpenCell(null)
        await refreshTasks(selectedCrewId)
      }
    } finally {
      setActionLoading(null)
    }
  }

  async function handleInspect(taskId: string, decision: "ACCEPTED" | "REJECTED") {
    setActionLoading(taskId)
    try {
      const res = await fetch(`/api/installation/tasks/${taskId}/inspect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, inspectedBy: "Workshop Inspector" }),
      })
      if (res.ok) {
        setOpenCell(null)
        await refreshTasks(selectedCrewId)
      }
    } finally {
      setActionLoading(null)
    }
  }

  // Member actions
  async function fetchWorkers() {
    setLoadingWorkers(true)
    try {
      const res = await fetch("/api/production/workers")
      if (res.ok) {
        const json = await res.json()
        setAvailableWorkers(json.workers || json)
      }
    } finally {
      setLoadingWorkers(false)
    }
  }

  async function handleAddMember() {
    if (!newMemberWorkerId) return
    try {
      const res = await fetch(`/api/installation/crews/${selectedCrewId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workerId: newMemberWorkerId, role: newMemberRole }),
      })
      if (res.ok) {
        setShowAddMember(false)
        setNewMemberWorkerId("")
        router.refresh()
      }
    } catch (err) {
      console.error("Failed to add member:", err)
    }
  }

  async function handleRemoveMember(memberId: string) {
    try {
      const res = await fetch(`/api/installation/crews/${selectedCrewId}/members/${memberId}`, {
        method: "DELETE",
      })
      if (res.ok) router.refresh()
    } catch (err) {
      console.error("Failed to remove member:", err)
    }
  }

  // Equipment actions
  async function handleAddEquipment() {
    if (!eqName.trim()) return
    try {
      const res = await fetch(`/api/installation/crews/${selectedCrewId}/equipment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: eqName, type: eqType, registration: eqRegistration || null, notes: eqNotes || null }),
      })
      if (res.ok) {
        setShowAddEquipment(false)
        setEqName("")
        setEqRegistration("")
        setEqNotes("")
        router.refresh()
      }
    } catch (err) {
      console.error("Failed to add equipment:", err)
    }
  }

  async function handleRemoveEquipment(eqId: string) {
    try {
      const res = await fetch(`/api/installation/crews/${selectedCrewId}/equipment/${eqId}`, {
        method: "DELETE",
      })
      if (res.ok) router.refresh()
    } catch (err) {
      console.error("Failed to remove equipment:", err)
    }
  }

  // Instruction actions
  async function handleAddInstruction() {
    if (!instrTitle.trim()) return
    try {
      const res = await fetch(`/api/installation/crews/${selectedCrewId}/instructions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: instrTitle, type: instrType, fileUrl: instrFileUrl || null, notes: instrNotes || null }),
      })
      if (res.ok) {
        setShowAddInstruction(false)
        setInstrTitle("")
        setInstrFileUrl("")
        setInstrNotes("")
        router.refresh()
      }
    } catch (err) {
      console.error("Failed to add instruction:", err)
    }
  }

  async function handleRemoveInstruction(instrId: string) {
    try {
      const res = await fetch(`/api/installation/crews/${selectedCrewId}/instructions/${instrId}`, {
        method: "DELETE",
      })
      if (res.ok) router.refresh()
    } catch (err) {
      console.error("Failed to remove instruction:", err)
    }
  }

  const roleBadge = (role: string | null) => {
    const r = role || "Installer"
    const colors: Record<string, string> = {
      Lead: "bg-blue-100 text-blue-700",
      Installer: "bg-green-100 text-green-700",
      Apprentice: "bg-amber-100 text-amber-700",
    }
    return colors[r] || "bg-gray-100 text-gray-700"
  }

  const typeIcon = (type: string) => {
    if (type === "VEHICLE") return <Truck className="h-4 w-4 text-blue-500" />
    if (type === "PLANT") return <HardHat className="h-4 w-4 text-amber-500" />
    return <Wrench className="h-4 w-4 text-gray-500" />
  }

  const instrTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      METHOD_STATEMENT: "bg-blue-100 text-blue-700",
      RISK_ASSESSMENT: "bg-orange-100 text-orange-700",
      DRAWING: "bg-purple-100 text-purple-700",
      OTHER: "bg-gray-100 text-gray-700",
    }
    return colors[type] || "bg-gray-100 text-gray-700"
  }

  return (
    <div className="space-y-6">
      {/* Crew Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {crews.map((crew) => (
          <button
            key={crew.id}
            onClick={() => setSelectedCrewId(crew.id)}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-full transition-colors whitespace-nowrap flex items-center gap-2",
              selectedCrewId === crew.id
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            <Users className="h-3.5 w-3.5" />
            {crew.name}
            <span className={cn(
              "text-xs px-1.5 py-0.5 rounded-full",
              selectedCrewId === crew.id ? "bg-blue-500 text-blue-100" : "bg-gray-200 text-gray-500"
            )}>
              {(localTasks[crew.id] || []).length}
            </span>
          </button>
        ))}
      </div>

      {!selectedCrew ? (
        <div className="text-center text-gray-400 py-16">No crews available</div>
      ) : (
        <>
          {/* Section 1: Task Matrix */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-sm font-semibold text-gray-900">Task Matrix</h2>
              <p className="text-xs text-gray-500 mt-0.5">{selectedCrew.name} ({selectedCrew.code}) - {productRows.length} product{productRows.length !== 1 ? "s" : ""} assigned</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap sticky left-0 bg-gray-50 z-10 min-w-[220px]">
                      Product
                    </th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[120px]">
                      Project
                    </th>
                    {INSTALL_STAGES.map((stage) => (
                      <th
                        key={stage}
                        className="text-center px-3 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[100px]"
                      >
                        {INSTALL_STAGE_DISPLAY_NAMES[stage]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {productRows.length === 0 && (
                    <tr>
                      <td colSpan={2 + INSTALL_STAGES.length} className="text-center py-12 text-gray-400">
                        No tasks assigned to this crew
                      </td>
                    </tr>
                  )}
                  {productRows.map(({ product, productId, tasks: taskMap }, rowIdx) => (
                    <tr
                      key={productId}
                      className={cn(
                        "border-b border-gray-100 hover:bg-gray-50/50 transition-colors",
                        rowIdx % 2 === 1 && "bg-gray-50/30"
                      )}
                    >
                      {/* Product column */}
                      <td className="px-4 py-3 sticky left-0 bg-white z-10">
                        <div className="font-medium text-gray-900 text-sm leading-tight">{product.description}</div>
                        <div className="text-xs text-gray-400 font-mono mt-0.5">{product.partCode}</div>
                        {product.project.siteLocation && (
                          <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                            <MapPin className="h-2.5 w-2.5" />
                            {product.project.siteLocation}
                          </div>
                        )}
                      </td>

                      {/* Project column */}
                      <td className="px-3 py-3">
                        <div className="text-xs font-medium text-gray-700">{product.project.projectNumber}</div>
                        <div className="text-xs text-gray-400 truncate max-w-[120px]">{product.project.name}</div>
                      </td>

                      {/* Stage columns */}
                      {INSTALL_STAGES.map((stage) => {
                        const task = taskMap.get(stage)
                        const cell = getCellInfo(task)
                        const cellKey = `${productId}-${stage}`
                        const isOpen = openCell === cellKey
                        const isLoading = task && actionLoading === task.id

                        return (
                          <td key={stage} className="px-2 py-2 text-center relative">
                            <button
                              onClick={() => {
                                if (!task || cell.actionable === "none") return
                                setOpenCell(isOpen ? null : cellKey)
                              }}
                              disabled={!task || cell.actionable === "none"}
                              className={cn(
                                "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors w-full justify-center",
                                cell.bgColor,
                                cell.color,
                                task && cell.actionable !== "none" && "hover:ring-1 hover:ring-gray-300 cursor-pointer",
                                !task && "cursor-default"
                              )}
                            >
                              {cell.dot && <span className={cn("w-2 h-2 rounded-full shrink-0", cell.dot)} />}
                              {cell.label === "Done" && <Check className="h-3 w-3 text-green-600" />}
                              {cell.label === "NCR" && <X className="h-3 w-3 text-red-600" />}
                              <span>{cell.label}</span>
                              {task && cell.actionable !== "none" && <ChevronDown className="h-2.5 w-2.5 opacity-50" />}
                            </button>

                            {/* Action dropdown */}
                            {isOpen && task && (
                              <div className="absolute top-full left-1/2 -translate-x-1/2 z-20 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 p-2 min-w-[140px]">
                                {cell.actionable === "start" && (
                                  <button
                                    onClick={() => handleStart(task.id)}
                                    disabled={!!isLoading}
                                    className="w-full text-left px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 rounded-md disabled:opacity-50"
                                  >
                                    {isLoading ? "Starting..." : "Start Task"}
                                  </button>
                                )}
                                {cell.actionable === "complete" && (
                                  <button
                                    onClick={() => handleComplete(task.id)}
                                    disabled={!!isLoading}
                                    className="w-full text-left px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 rounded-md disabled:opacity-50"
                                  >
                                    {isLoading ? "Completing..." : "Complete Task"}
                                  </button>
                                )}
                                {cell.actionable === "inspect" && (
                                  <div className="space-y-1">
                                    <button
                                      onClick={() => handleInspect(task.id, "ACCEPTED")}
                                      disabled={!!isLoading}
                                      className="w-full text-left px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50 rounded-md disabled:opacity-50"
                                    >
                                      {isLoading ? "..." : "Approve"}
                                    </button>
                                    <button
                                      onClick={() => handleInspect(task.id, "REJECTED")}
                                      disabled={!!isLoading}
                                      className="w-full text-left px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 rounded-md disabled:opacity-50"
                                    >
                                      {isLoading ? "..." : "Reject (NCR)"}
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2 & 3: Team Members + Equipment side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Section 2: Team Members */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Team Members</h2>
                  <p className="text-xs text-gray-500 mt-0.5">{selectedCrew.members.length} active member{selectedCrew.members.length !== 1 ? "s" : ""}</p>
                </div>
                <button
                  onClick={() => {
                    setShowAddMember(true)
                    if (availableWorkers.length === 0) fetchWorkers()
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Member
                </button>
              </div>

              <div className="p-4 space-y-2">
                {selectedCrew.members.length === 0 && (
                  <div className="text-center text-gray-400 py-6 text-sm">No members assigned</div>
                )}
                {selectedCrew.members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-600">
                        {member.worker.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{member.worker.name}</div>
                        <div className="text-xs text-gray-400">{member.worker.role}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", roleBadge(member.role))}>
                        {member.role || "Installer"}
                      </span>
                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        title="Remove member"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Add member inline form */}
                {showAddMember && (
                  <div className="border border-blue-200 rounded-lg p-3 bg-blue-50/30 space-y-2 mt-2">
                    <div className="text-xs font-medium text-gray-700">Add Team Member</div>
                    <select
                      value={newMemberWorkerId}
                      onChange={(e) => setNewMemberWorkerId(e.target.value)}
                      className="w-full text-xs border border-gray-300 rounded-md px-2.5 py-1.5 bg-white"
                    >
                      <option value="">
                        {loadingWorkers ? "Loading workers..." : "Select a worker"}
                      </option>
                      {availableWorkers.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name} ({w.role})
                        </option>
                      ))}
                    </select>
                    <select
                      value={newMemberRole}
                      onChange={(e) => setNewMemberRole(e.target.value)}
                      className="w-full text-xs border border-gray-300 rounded-md px-2.5 py-1.5 bg-white"
                    >
                      <option value="Lead">Lead</option>
                      <option value="Installer">Installer</option>
                      <option value="Apprentice">Apprentice</option>
                    </select>
                    <div className="flex gap-2">
                      <button
                        onClick={handleAddMember}
                        className="flex-1 text-xs font-medium bg-blue-600 text-white rounded-md px-3 py-1.5 hover:bg-blue-500 transition-colors"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => setShowAddMember(false)}
                        className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Section 3: Vehicles & Equipment */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Vehicles & Equipment</h2>
                  <p className="text-xs text-gray-500 mt-0.5">{selectedCrew.equipment.length} item{selectedCrew.equipment.length !== 1 ? "s" : ""}</p>
                </div>
                <button
                  onClick={() => setShowAddEquipment(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Equipment
                </button>
              </div>

              <div className="p-4 space-y-2">
                {selectedCrew.equipment.length === 0 && (
                  <div className="text-center text-gray-400 py-6 text-sm">No equipment assigned</div>
                )}
                {selectedCrew.equipment.map((eq) => (
                  <div key={eq.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-3">
                      {typeIcon(eq.type)}
                      <div>
                        <div className="text-sm font-medium text-gray-900">{eq.name}</div>
                        <div className="text-xs text-gray-400">
                          {eq.registration && <span>{eq.registration} &middot; </span>}
                          {eq.notes || eq.type}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full font-medium",
                        eq.isAvailable ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                      )}>
                        {eq.isAvailable ? "Available" : "In Use"}
                      </span>
                      <button
                        onClick={() => handleRemoveEquipment(eq.id)}
                        className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        title="Remove equipment"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Add equipment inline form */}
                {showAddEquipment && (
                  <div className="border border-blue-200 rounded-lg p-3 bg-blue-50/30 space-y-2 mt-2">
                    <div className="text-xs font-medium text-gray-700">Add Equipment</div>
                    <input
                      type="text"
                      placeholder="Equipment name"
                      value={eqName}
                      onChange={(e) => setEqName(e.target.value)}
                      className="w-full text-xs border border-gray-300 rounded-md px-2.5 py-1.5 bg-white"
                    />
                    <select
                      value={eqType}
                      onChange={(e) => setEqType(e.target.value)}
                      className="w-full text-xs border border-gray-300 rounded-md px-2.5 py-1.5 bg-white"
                    >
                      <option value="VEHICLE">Vehicle</option>
                      <option value="PLANT">Plant</option>
                      <option value="TOOL">Tool</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Registration (optional)"
                      value={eqRegistration}
                      onChange={(e) => setEqRegistration(e.target.value)}
                      className="w-full text-xs border border-gray-300 rounded-md px-2.5 py-1.5 bg-white"
                    />
                    <input
                      type="text"
                      placeholder="Notes (optional)"
                      value={eqNotes}
                      onChange={(e) => setEqNotes(e.target.value)}
                      className="w-full text-xs border border-gray-300 rounded-md px-2.5 py-1.5 bg-white"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleAddEquipment}
                        className="flex-1 text-xs font-medium bg-blue-600 text-white rounded-md px-3 py-1.5 hover:bg-blue-500 transition-colors"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => setShowAddEquipment(false)}
                        className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 4: Installation Instructions */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Installation Instructions</h2>
                <p className="text-xs text-gray-500 mt-0.5">{selectedCrew.instructions.length} document{selectedCrew.instructions.length !== 1 ? "s" : ""}</p>
              </div>
              <button
                onClick={() => setShowAddInstruction(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Instruction
              </button>
            </div>

            <div className="p-4 space-y-2">
              {selectedCrew.instructions.length === 0 && (
                <div className="text-center text-gray-400 py-6 text-sm">No instructions attached</div>
              )}
              {selectedCrew.instructions.map((instr) => (
                <div key={instr.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-gray-400" />
                    <div>
                      <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                        {instr.title}
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", instrTypeBadge(instr.type))}>
                          {instr.type.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400">
                        {instr.document?.filename || instr.notes || "No file attached"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {(instr.fileUrl || instr.document?.filePath) && (
                      <a
                        href={instr.fileUrl || instr.document?.filePath || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                        title="Open document"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                    <button
                      onClick={() => handleRemoveInstruction(instr.id)}
                      className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                      title="Remove instruction"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Add instruction inline form */}
              {showAddInstruction && (
                <div className="border border-blue-200 rounded-lg p-3 bg-blue-50/30 space-y-2 mt-2">
                  <div className="text-xs font-medium text-gray-700">Add Instruction</div>
                  <input
                    type="text"
                    placeholder="Title"
                    value={instrTitle}
                    onChange={(e) => setInstrTitle(e.target.value)}
                    className="w-full text-xs border border-gray-300 rounded-md px-2.5 py-1.5 bg-white"
                  />
                  <select
                    value={instrType}
                    onChange={(e) => setInstrType(e.target.value)}
                    className="w-full text-xs border border-gray-300 rounded-md px-2.5 py-1.5 bg-white"
                  >
                    <option value="METHOD_STATEMENT">Method Statement</option>
                    <option value="RISK_ASSESSMENT">Risk Assessment</option>
                    <option value="DRAWING">Drawing</option>
                    <option value="OTHER">Other</option>
                  </select>
                  <input
                    type="text"
                    placeholder="File URL (optional)"
                    value={instrFileUrl}
                    onChange={(e) => setInstrFileUrl(e.target.value)}
                    className="w-full text-xs border border-gray-300 rounded-md px-2.5 py-1.5 bg-white"
                  />
                  <input
                    type="text"
                    placeholder="Notes (optional)"
                    value={instrNotes}
                    onChange={(e) => setInstrNotes(e.target.value)}
                    className="w-full text-xs border border-gray-300 rounded-md px-2.5 py-1.5 bg-white"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddInstruction}
                      className="flex-1 text-xs font-medium bg-blue-600 text-white rounded-md px-3 py-1.5 hover:bg-blue-500 transition-colors"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => setShowAddInstruction(false)}
                      className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
