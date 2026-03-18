"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd"
import { cn } from "@/lib/utils"
import { CREW_COLORS, CREW_MEMBER_ROLES, EQUIPMENT_TYPES, EQUIPMENT_TYPE_LABELS } from "@/lib/install-utils"
import { Users, Truck, Wrench, HardHat, GripVertical, Plus, Package, Settings } from "lucide-react"

// ---------- Types ----------

interface Worker {
  id: string
  name: string
  role: string
}

interface CrewMember {
  id: string
  workerId: string
  role: string | null
  worker: Worker
}

interface Equipment {
  id: string
  crewId: string | null
  name: string
  type: string
  registration: string | null
  notes: string | null
  isAvailable: boolean
}

interface Crew {
  id: string
  name: string
  code: string
  isActive: boolean
  notes: string | null
  members: CrewMember[]
  equipment: Equipment[]
}

interface Props {
  initialCrews: Crew[]
  initialPoolWorkers: Worker[]
  initialPoolEquipment: Equipment[]
  allWorkers: Worker[]
}

// ---------- Helpers ----------

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function avatarColor(name: string) {
  const colors = [
    "bg-blue-500",
    "bg-emerald-500",
    "bg-purple-500",
    "bg-orange-500",
    "bg-rose-500",
    "bg-cyan-500",
    "bg-amber-500",
    "bg-indigo-500",
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

function roleBadgeClass(role: string | null) {
  switch (role) {
    case "Lead":
      return "bg-blue-100 text-blue-700"
    case "Installer":
      return "bg-green-100 text-green-700"
    case "Apprentice":
      return "bg-amber-100 text-amber-700"
    default:
      return "bg-gray-100 text-gray-600"
  }
}

function equipmentIcon(type: string) {
  switch (type) {
    case "VEHICLE":
      return <Truck className="h-4 w-4 text-blue-500" />
    case "PLANT":
      return <HardHat className="h-4 w-4 text-orange-500" />
    case "TOOL":
    default:
      return <Wrench className="h-4 w-4 text-gray-500" />
  }
}

// ---------- Component ----------

export function CrewManagement({
  initialCrews,
  initialPoolWorkers,
  initialPoolEquipment,
  allWorkers,
}: Props) {
  const router = useRouter()
  const [crews, setCrews] = useState<Crew[]>(initialCrews)
  const [poolWorkers, setPoolWorkers] = useState<Worker[]>(initialPoolWorkers)
  const [poolEquipment, setPoolEquipment] = useState<Equipment[]>(initialPoolEquipment)

  // Create crew form
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newCrewName, setNewCrewName] = useState("")
  const [newCrewCode, setNewCrewCode] = useState("")
  const [creating, setCreating] = useState(false)

  // Add equipment form
  const [showAddEquipment, setShowAddEquipment] = useState(false)
  const [newEquipName, setNewEquipName] = useState("")
  const [newEquipType, setNewEquipType] = useState<string>("TOOL")
  const [newEquipReg, setNewEquipReg] = useState("")
  const [addingEquipment, setAddingEquipment] = useState(false)

  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const markBusy = (key: string, val: boolean) =>
    setBusy((prev) => ({ ...prev, [key]: val }))

  // ---------- Create crew ----------

  const handleCreateCrew = useCallback(async () => {
    if (!newCrewName.trim() || !newCrewCode.trim()) return
    setCreating(true)
    try {
      const res = await fetch("/api/installation/crews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCrewName.trim(), code: newCrewCode.trim().toUpperCase() }),
      })
      if (!res.ok) throw new Error(await res.text())
      const crew = await res.json()
      setCrews((prev) => [...prev, { ...crew, members: [], equipment: [] }])
      setNewCrewName("")
      setNewCrewCode("")
      setShowCreateForm(false)
      router.refresh()
    } catch (err) {
      console.error("Failed to create crew", err)
      alert("Failed to create crew. Check console for details.")
    } finally {
      setCreating(false)
    }
  }, [newCrewName, newCrewCode, router])

  // ---------- Toggle active ----------

  const toggleActive = useCallback(
    async (crew: Crew) => {
      const key = `toggle-${crew.id}`
      markBusy(key, true)
      try {
        const res = await fetch(`/api/installation/crews/${crew.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: !crew.isActive }),
        })
        if (!res.ok) throw new Error(await res.text())
        setCrews((prev) =>
          prev.map((c) => (c.id === crew.id ? { ...c, isActive: !c.isActive } : c))
        )
      } catch (err) {
        console.error("Failed to toggle crew status", err)
      } finally {
        markBusy(key, false)
      }
    },
    []
  )

  // ---------- Add pool equipment ----------

  const handleAddEquipment = useCallback(async () => {
    if (!newEquipName.trim()) return
    setAddingEquipment(true)
    try {
      // Create equipment without a crew (pool) — use a dummy crew endpoint
      // but the equipment API needs a crewId in the URL. We'll create via
      // the crew equipment endpoint of the first crew, then immediately reassign to pool.
      // Actually, let's just create with crewId null directly via a workaround:
      // We'll POST to the first crew, then PATCH to null.
      // Better approach: if we have crews, use the first crew's endpoint then PATCH to pool.
      // If no crews exist, we can't create equipment (need at least one crew).
      if (crews.length === 0) {
        alert("Create at least one crew first before adding equipment.")
        return
      }
      const tempCrewId = crews[0].id
      const res = await fetch(`/api/installation/crews/${tempCrewId}/equipment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newEquipName.trim(),
          type: newEquipType,
          registration: newEquipReg.trim() || null,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      const equip = await res.json()

      // Now reassign to pool (crewId: null)
      const patchRes = await fetch(`/api/installation/equipment/${equip.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crewId: null }),
      })
      if (!patchRes.ok) throw new Error(await patchRes.text())
      const poolEquip = await patchRes.json()

      setPoolEquipment((prev) => [...prev, poolEquip])
      setNewEquipName("")
      setNewEquipType("TOOL")
      setNewEquipReg("")
      setShowAddEquipment(false)
      router.refresh()
    } catch (err) {
      console.error("Failed to add equipment", err)
      alert("Failed to add equipment.")
    } finally {
      setAddingEquipment(false)
    }
  }, [newEquipName, newEquipType, newEquipReg, crews, router])

  // ---------- Drag and Drop ----------

  const handleDragEnd = useCallback(
    async (result: DropResult) => {
      const { draggableId, source, destination } = result
      if (!destination) return
      if (source.droppableId === destination.droppableId && source.index === destination.index) return

      const isWorker = draggableId.startsWith("worker-")
      const isEquip = draggableId.startsWith("equip-")

      if (isWorker) {
        const workerId = draggableId.replace("worker-", "")
        const srcIsPool = source.droppableId === "pool-workers"
        const dstIsPool = destination.droppableId === "pool-workers"
        const srcCrewId = srcIsPool ? null : source.droppableId.replace("crew-workers-", "")
        const dstCrewId = dstIsPool ? null : destination.droppableId.replace("crew-workers-", "")

        // Find worker data
        let workerData: Worker | undefined
        let memberData: CrewMember | undefined

        if (srcIsPool) {
          workerData = poolWorkers.find((w) => w.id === workerId)
        } else {
          const srcCrew = crews.find((c) => c.id === srcCrewId)
          memberData = srcCrew?.members.find((m) => m.worker.id === workerId)
          workerData = memberData?.worker
        }
        if (!workerData) return

        // Optimistic state update
        if (srcIsPool && dstCrewId) {
          // Pool → Crew
          setPoolWorkers((prev) => prev.filter((w) => w.id !== workerId))
          setCrews((prev) =>
            prev.map((c) =>
              c.id === dstCrewId
                ? {
                    ...c,
                    members: [
                      ...c.members,
                      {
                        id: `temp-${workerId}`,
                        workerId,
                        role: "Installer",
                        worker: workerData!,
                      },
                    ],
                  }
                : c
            )
          )
        } else if (!srcIsPool && dstIsPool && srcCrewId) {
          // Crew → Pool
          setCrews((prev) =>
            prev.map((c) =>
              c.id === srcCrewId
                ? { ...c, members: c.members.filter((m) => m.worker.id !== workerId) }
                : c
            )
          )
          setPoolWorkers((prev) => [...prev, workerData!])
        } else if (!srcIsPool && !dstIsPool && srcCrewId && dstCrewId) {
          // Crew A → Crew B
          const role = memberData?.role || "Installer"
          setCrews((prev) =>
            prev.map((c) => {
              if (c.id === srcCrewId) {
                return { ...c, members: c.members.filter((m) => m.worker.id !== workerId) }
              }
              if (c.id === dstCrewId) {
                return {
                  ...c,
                  members: [
                    ...c.members,
                    { id: `temp-${workerId}`, workerId, role, worker: workerData! },
                  ],
                }
              }
              return c
            })
          )
        }

        // API calls
        try {
          if (srcIsPool && dstCrewId) {
            // Pool → Crew: POST member
            await fetch(`/api/installation/crews/${dstCrewId}/members`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ workerId, role: "Installer" }),
            })
          } else if (!srcIsPool && dstIsPool && srcCrewId && memberData) {
            // Crew → Pool: DELETE member
            await fetch(`/api/installation/crews/${srcCrewId}/members/${memberData.id}`, {
              method: "DELETE",
            })
          } else if (!srcIsPool && !dstIsPool && srcCrewId && dstCrewId && memberData) {
            // Crew A → Crew B: DELETE from A, POST to B
            await fetch(`/api/installation/crews/${srcCrewId}/members/${memberData.id}`, {
              method: "DELETE",
            })
            await fetch(`/api/installation/crews/${dstCrewId}/members`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ workerId, role: memberData.role || "Installer" }),
            })
          }
          router.refresh()
        } catch (err) {
          console.error("Failed to move worker", err)
          // Revert on error by refreshing
          router.refresh()
        }
      }

      if (isEquip) {
        const equipId = draggableId.replace("equip-", "")
        const srcIsPool = source.droppableId === "pool-equipment"
        const dstIsPool = destination.droppableId === "pool-equipment"
        const srcCrewId = srcIsPool ? null : source.droppableId.replace("crew-equipment-", "")
        const dstCrewId = dstIsPool ? null : destination.droppableId.replace("crew-equipment-", "")

        // Find equipment data
        let equipData: Equipment | undefined
        if (srcIsPool) {
          equipData = poolEquipment.find((e) => e.id === equipId)
        } else {
          const srcCrew = crews.find((c) => c.id === srcCrewId)
          equipData = srcCrew?.equipment.find((e) => e.id === equipId)
        }
        if (!equipData) return

        // Optimistic state update
        if (srcIsPool && dstCrewId) {
          // Pool → Crew
          setPoolEquipment((prev) => prev.filter((e) => e.id !== equipId))
          setCrews((prev) =>
            prev.map((c) =>
              c.id === dstCrewId
                ? { ...c, equipment: [...c.equipment, { ...equipData!, crewId: dstCrewId }] }
                : c
            )
          )
        } else if (!srcIsPool && dstIsPool && srcCrewId) {
          // Crew → Pool
          setCrews((prev) =>
            prev.map((c) =>
              c.id === srcCrewId
                ? { ...c, equipment: c.equipment.filter((e) => e.id !== equipId) }
                : c
            )
          )
          setPoolEquipment((prev) => [...prev, { ...equipData!, crewId: null }])
        } else if (!srcIsPool && !dstIsPool && srcCrewId && dstCrewId) {
          // Crew A → Crew B
          setCrews((prev) =>
            prev.map((c) => {
              if (c.id === srcCrewId) {
                return { ...c, equipment: c.equipment.filter((e) => e.id !== equipId) }
              }
              if (c.id === dstCrewId) {
                return {
                  ...c,
                  equipment: [...c.equipment, { ...equipData!, crewId: dstCrewId }],
                }
              }
              return c
            })
          )
        }

        // API call: always PATCH with new crewId
        try {
          await fetch(`/api/installation/equipment/${equipId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ crewId: dstCrewId }),
          })
          router.refresh()
        } catch (err) {
          console.error("Failed to move equipment", err)
          router.refresh()
        }
      }
    },
    [crews, poolWorkers, poolEquipment, router]
  )

  // ---------- Render ----------

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="space-y-6">
        {/* ---------- Crew Cards Grid ---------- */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {crews.map((crew, idx) => {
            const colors = CREW_COLORS[idx % Object.keys(CREW_COLORS).length]
            return (
              <div
                key={crew.id}
                className={cn(
                  "rounded-lg border-2 bg-white shadow-sm overflow-hidden",
                  crew.isActive ? colors.border : "border-gray-200 opacity-70"
                )}
              >
                {/* Header */}
                <div className={cn("px-4 py-3 flex items-center justify-between", colors.bg)}>
                  <div className="flex items-center gap-2">
                    <Users className={cn("h-4 w-4", colors.text)} />
                    <span className={cn("font-semibold text-sm", colors.text)}>{crew.name}</span>
                    <span
                      className={cn(
                        "text-[10px] font-mono px-1.5 py-0.5 rounded",
                        colors.bg,
                        colors.text,
                        "border border-current/20"
                      )}
                    >
                      {crew.code}
                    </span>
                  </div>
                  <button
                    onClick={() => toggleActive(crew)}
                    disabled={!!busy[`toggle-${crew.id}`]}
                    className={cn(
                      "text-[10px] font-medium px-2 py-0.5 rounded-full transition-colors",
                      crew.isActive
                        ? "bg-green-100 text-green-700 hover:bg-green-200"
                        : "bg-gray-200 text-gray-500 hover:bg-gray-300"
                    )}
                  >
                    {crew.isActive ? "Active" : "Inactive"}
                  </button>
                </div>

                {/* Workers Droppable */}
                <Droppable droppableId={`crew-workers-${crew.id}`}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={cn(
                        "px-4 py-3 space-y-1.5 min-h-[80px] transition-colors",
                        snapshot.isDraggingOver && "bg-blue-50 border-blue-300 border-dashed border rounded-md mx-2 my-1"
                      )}
                    >
                      <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                        Workers ({crew.members.length})
                      </div>
                      {crew.members.length === 0 && !snapshot.isDraggingOver ? (
                        <div className="flex flex-col items-center justify-center py-3 text-gray-400 text-xs">
                          <Users className="h-5 w-5 mb-1" />
                          <span>Drop workers here</span>
                        </div>
                      ) : (
                        crew.members.map((m, mIdx) => (
                          <Draggable
                            key={m.worker.id}
                            draggableId={`worker-${m.worker.id}`}
                            index={mIdx}
                          >
                            {(dragProvided, dragSnapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                className={cn(
                                  "flex items-center gap-2.5 py-1.5 px-2 rounded-md border border-gray-100 bg-white cursor-grab hover:scale-[1.01] transition-all",
                                  dragSnapshot.isDragging && "shadow-lg opacity-90 rotate-1"
                                )}
                              >
                                <GripVertical className="h-3.5 w-3.5 text-gray-300 shrink-0" />
                                <div
                                  className={cn(
                                    "h-7 w-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0",
                                    avatarColor(m.worker.name)
                                  )}
                                >
                                  {getInitials(m.worker.name)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-gray-800 truncate">
                                    {m.worker.name}
                                  </div>
                                  <div className="text-[10px] text-gray-400">{m.worker.role}</div>
                                </div>
                                <span
                                  className={cn(
                                    "text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0",
                                    roleBadgeClass(m.role)
                                  )}
                                >
                                  {m.role ?? "Member"}
                                </span>
                              </div>
                            )}
                          </Draggable>
                        ))
                      )}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>

                {/* Divider */}
                <div className="border-t border-gray-100 mx-4" />

                {/* Equipment Droppable */}
                <Droppable droppableId={`crew-equipment-${crew.id}`}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={cn(
                        "px-4 py-3 space-y-1.5 min-h-[60px] transition-colors",
                        snapshot.isDraggingOver && "bg-green-50 border-green-300 border-dashed border rounded-md mx-2 my-1"
                      )}
                    >
                      <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                        Equipment ({crew.equipment.length})
                      </div>
                      {crew.equipment.length === 0 && !snapshot.isDraggingOver ? (
                        <div className="flex flex-col items-center justify-center py-2 text-gray-400 text-xs">
                          <Package className="h-4 w-4 mb-0.5" />
                          <span>Drop equipment here</span>
                        </div>
                      ) : (
                        crew.equipment.map((eq, eIdx) => (
                          <Draggable
                            key={eq.id}
                            draggableId={`equip-${eq.id}`}
                            index={eIdx}
                          >
                            {(dragProvided, dragSnapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                className={cn(
                                  "flex items-center gap-2.5 py-1.5 px-2 rounded-md border border-gray-100 bg-white cursor-grab hover:scale-[1.01] transition-all",
                                  dragSnapshot.isDragging && "shadow-lg opacity-90 rotate-1"
                                )}
                              >
                                <GripVertical className="h-3.5 w-3.5 text-gray-300 shrink-0" />
                                {equipmentIcon(eq.type)}
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-gray-800 truncate">
                                    {eq.name}
                                  </div>
                                  {eq.registration && (
                                    <div className="text-[10px] text-gray-400 font-mono">
                                      {eq.registration}
                                    </div>
                                  )}
                                </div>
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 shrink-0">
                                  {EQUIPMENT_TYPE_LABELS[eq.type] || eq.type}
                                </span>
                              </div>
                            )}
                          </Draggable>
                        ))
                      )}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            )
          })}
        </div>

        {/* ---------- Create Crew ---------- */}
        {showCreateForm ? (
          <div className="max-w-md border border-gray-200 rounded-lg p-4 bg-white shadow-sm space-y-3">
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Create New Crew
            </h3>
            <input
              type="text"
              placeholder="Crew name (e.g. Alpha Team)"
              value={newCrewName}
              onChange={(e) => setNewCrewName(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
            <input
              type="text"
              placeholder="Code (e.g. ALPHA)"
              value={newCrewCode}
              onChange={(e) => setNewCrewCode(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 uppercase focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreateCrew}
                disabled={creating || !newCrewName.trim() || !newCrewCode.trim()}
                className="flex-1 text-sm font-medium bg-blue-600 text-white rounded-md py-2 hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {creating ? "Creating..." : "Create Crew"}
              </button>
              <button
                onClick={() => {
                  setShowCreateForm(false)
                  setNewCrewName("")
                  setNewCrewCode("")
                }}
                className="text-sm font-medium text-gray-500 hover:text-gray-700 px-4 py-2"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center gap-2 text-sm font-medium bg-blue-600 text-white rounded-md px-4 py-2 hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create Crew
          </button>
        )}

        {/* ---------- Resource Pool ---------- */}
        <div className="rounded-lg border border-gray-200 bg-gray-50/50 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-200 bg-white flex items-center gap-2">
            <Package className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-semibold text-gray-700">Resource Pool</span>
            <span className="text-[10px] text-gray-400 ml-1">
              Drag resources from here into crews
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-0 md:gap-0">
            {/* Pool Workers */}
            <div className="border-b md:border-b-0 md:border-r border-gray-200">
              <div className="px-4 py-2 border-b border-gray-100 bg-white/50">
                <span className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  Unassigned Workers ({poolWorkers.length})
                </span>
              </div>
              <Droppable droppableId="pool-workers">
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      "p-3 space-y-1.5 min-h-[100px] transition-colors",
                      snapshot.isDraggingOver && "bg-blue-50"
                    )}
                  >
                    {poolWorkers.length === 0 && !snapshot.isDraggingOver ? (
                      <div className="flex flex-col items-center justify-center py-6 text-gray-400 text-xs">
                        <Users className="h-5 w-5 mb-1 opacity-50" />
                        <span>All workers assigned</span>
                      </div>
                    ) : (
                      poolWorkers.map((w, wIdx) => (
                        <Draggable
                          key={w.id}
                          draggableId={`worker-${w.id}`}
                          index={wIdx}
                        >
                          {(dragProvided, dragSnapshot) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              {...dragProvided.dragHandleProps}
                              className={cn(
                                "flex items-center gap-2.5 py-1.5 px-2 rounded-md border border-gray-100 bg-white cursor-grab hover:scale-[1.01] transition-all",
                                dragSnapshot.isDragging && "shadow-lg opacity-90 rotate-1"
                              )}
                            >
                              <GripVertical className="h-3.5 w-3.5 text-gray-300 shrink-0" />
                              <div
                                className={cn(
                                  "h-7 w-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0",
                                  avatarColor(w.name)
                                )}
                              >
                                {getInitials(w.name)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-800 truncate">
                                  {w.name}
                                </div>
                                <div className="text-[10px] text-gray-400">{w.role}</div>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))
                    )}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>

            {/* Pool Equipment */}
            <div>
              <div className="px-4 py-2 border-b border-gray-100 bg-white/50 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
                  <Wrench className="h-3.5 w-3.5" />
                  Unassigned Equipment ({poolEquipment.length})
                </span>
                {!showAddEquipment && (
                  <button
                    onClick={() => setShowAddEquipment(true)}
                    className="text-[10px] font-medium text-blue-600 hover:text-blue-800 flex items-center gap-0.5"
                  >
                    <Plus className="h-3 w-3" />
                    Add
                  </button>
                )}
              </div>
              <Droppable droppableId="pool-equipment">
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      "p-3 space-y-1.5 min-h-[100px] transition-colors",
                      snapshot.isDraggingOver && "bg-green-50"
                    )}
                  >
                    {/* Add Equipment Form */}
                    {showAddEquipment && (
                      <div className="space-y-2 p-2 border border-gray-200 rounded-md bg-white mb-2">
                        <input
                          type="text"
                          placeholder="Equipment name"
                          value={newEquipName}
                          onChange={(e) => setNewEquipName(e.target.value)}
                          className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <div className="flex gap-2">
                          <select
                            value={newEquipType}
                            onChange={(e) => setNewEquipType(e.target.value)}
                            className="flex-1 text-xs border border-gray-300 rounded px-2 py-1.5 bg-white focus:ring-1 focus:ring-blue-500"
                          >
                            {EQUIPMENT_TYPES.map((t) => (
                              <option key={t} value={t}>
                                {EQUIPMENT_TYPE_LABELS[t]}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            placeholder="Reg (optional)"
                            value={newEquipReg}
                            onChange={(e) => setNewEquipReg(e.target.value)}
                            className="flex-1 text-xs border border-gray-300 rounded px-2 py-1.5 focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={handleAddEquipment}
                            disabled={addingEquipment || !newEquipName.trim()}
                            className="flex-1 text-xs font-medium bg-blue-600 text-white rounded py-1.5 hover:bg-blue-700 disabled:opacity-50"
                          >
                            {addingEquipment ? "Adding..." : "Add Equipment"}
                          </button>
                          <button
                            onClick={() => {
                              setShowAddEquipment(false)
                              setNewEquipName("")
                              setNewEquipReg("")
                            }}
                            className="text-xs text-gray-500 hover:text-gray-700 px-2"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {poolEquipment.length === 0 && !snapshot.isDraggingOver && !showAddEquipment ? (
                      <div className="flex flex-col items-center justify-center py-6 text-gray-400 text-xs">
                        <Package className="h-5 w-5 mb-1 opacity-50" />
                        <span>All equipment assigned</span>
                      </div>
                    ) : (
                      poolEquipment.map((eq, eIdx) => (
                        <Draggable
                          key={eq.id}
                          draggableId={`equip-${eq.id}`}
                          index={eIdx}
                        >
                          {(dragProvided, dragSnapshot) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              {...dragProvided.dragHandleProps}
                              className={cn(
                                "flex items-center gap-2.5 py-1.5 px-2 rounded-md border border-gray-100 bg-white cursor-grab hover:scale-[1.01] transition-all",
                                dragSnapshot.isDragging && "shadow-lg opacity-90 rotate-1"
                              )}
                            >
                              <GripVertical className="h-3.5 w-3.5 text-gray-300 shrink-0" />
                              {equipmentIcon(eq.type)}
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-800 truncate">
                                  {eq.name}
                                </div>
                                {eq.registration && (
                                  <div className="text-[10px] text-gray-400 font-mono">
                                    {eq.registration}
                                  </div>
                                )}
                              </div>
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 shrink-0">
                                {EQUIPMENT_TYPE_LABELS[eq.type] || eq.type}
                              </span>
                            </div>
                          )}
                        </Draggable>
                      ))
                    )}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          </div>
        </div>
      </div>
    </DragDropContext>
  )
}
