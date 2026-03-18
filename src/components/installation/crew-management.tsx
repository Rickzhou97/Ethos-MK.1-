"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { CREW_COLORS, CREW_MEMBER_ROLES } from "@/lib/install-utils"
import { Users, Plus, Trash2, Shield, UserPlus, Settings } from "lucide-react"

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

interface Crew {
  id: string
  name: string
  code: string
  isActive: boolean
  notes: string | null
  members: CrewMember[]
}

interface Props {
  initialCrews: Crew[]
  availableWorkers: Worker[]
}

// ---------- Component ----------

export function CrewManagement({ initialCrews, availableWorkers }: Props) {
  const router = useRouter()
  const [crews, setCrews] = useState<Crew[]>(initialCrews)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newCrewName, setNewCrewName] = useState("")
  const [newCrewCode, setNewCrewCode] = useState("")
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState<Record<string, boolean>>({})

  // Track which crew has the "add member" panel open
  const [addingTo, setAddingTo] = useState<string | null>(null)
  const [selectedWorker, setSelectedWorker] = useState("")
  const [selectedRole, setSelectedRole] = useState<string>(CREW_MEMBER_ROLES[0])

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
      setCrews((prev) => [...prev, { ...crew, members: [] }])
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

  // ---------- Add member ----------

  const handleAddMember = useCallback(
    async (crewId: string) => {
      if (!selectedWorker) return
      const key = `add-${crewId}`
      markBusy(key, true)
      try {
        const res = await fetch(`/api/installation/crews/${crewId}/members`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workerId: selectedWorker, role: selectedRole }),
        })
        if (!res.ok) throw new Error(await res.text())
        const member = await res.json()
        setCrews((prev) =>
          prev.map((c) =>
            c.id === crewId ? { ...c, members: [...c.members, member] } : c
          )
        )
        setSelectedWorker("")
        setSelectedRole(CREW_MEMBER_ROLES[0])
        setAddingTo(null)
      } catch (err) {
        console.error("Failed to add member", err)
        alert("Failed to add member. They may already be assigned to this crew.")
      } finally {
        markBusy(key, false)
      }
    },
    [selectedWorker, selectedRole]
  )

  // ---------- Remove member ----------

  const handleRemoveMember = useCallback(
    async (crewId: string, memberId: string) => {
      const key = `rm-${memberId}`
      markBusy(key, true)
      try {
        const res = await fetch(`/api/installation/crews/${crewId}/members/${memberId}`, {
          method: "DELETE",
        })
        if (!res.ok) throw new Error(await res.text())
        setCrews((prev) =>
          prev.map((c) =>
            c.id === crewId
              ? { ...c, members: c.members.filter((m) => m.id !== memberId) }
              : c
          )
        )
      } catch (err) {
        console.error("Failed to remove member", err)
      } finally {
        markBusy(key, false)
      }
    },
    []
  )

  // Workers not already assigned to a given crew
  const freeWorkers = (crewId: string) => {
    const assignedIds = new Set(
      crews.find((c) => c.id === crewId)?.members.map((m) => m.workerId) ?? []
    )
    return availableWorkers.filter((w) => !assignedIds.has(w.id))
  }

  const roleBadge = (role: string | null) => {
    switch (role) {
      case "Lead":
        return "bg-amber-100 text-amber-800"
      case "Installer":
        return "bg-blue-100 text-blue-800"
      case "Apprentice":
        return "bg-gray-100 text-gray-700"
      default:
        return "bg-gray-100 text-gray-600"
    }
  }

  // ---------- Render ----------

  return (
    <div className="space-y-6">
      {/* Crew grid */}
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
                      colors.text
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

              {/* Members */}
              <div className="px-4 py-3 space-y-2 min-h-[80px]">
                {crew.members.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-4 text-gray-400 text-xs">
                    <Users className="h-5 w-5 mb-1" />
                    <span>No members assigned</span>
                  </div>
                ) : (
                  crew.members.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0"
                    >
                      <div className="flex items-center gap-2">
                        {m.role === "Lead" && (
                          <Shield className="h-3.5 w-3.5 text-amber-500" />
                        )}
                        <span className="text-sm text-gray-800">{m.worker.name}</span>
                        <span
                          className={cn(
                            "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                            roleBadge(m.role)
                          )}
                        >
                          {m.role ?? "Member"}
                        </span>
                      </div>
                      <button
                        onClick={() => handleRemoveMember(crew.id, m.id)}
                        disabled={!!busy[`rm-${m.id}`]}
                        className="text-gray-400 hover:text-red-500 transition-colors p-0.5"
                        title="Remove member"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Add member */}
              <div className="px-4 pb-3">
                {addingTo === crew.id ? (
                  <div className="space-y-2 border-t border-gray-100 pt-3">
                    <select
                      value={selectedWorker}
                      onChange={(e) => setSelectedWorker(e.target.value)}
                      className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select worker...</option>
                      {freeWorkers(crew.id).map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={selectedRole}
                      onChange={(e) => setSelectedRole(e.target.value)}
                      className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {CREW_MEMBER_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAddMember(crew.id)}
                        disabled={!selectedWorker || !!busy[`add-${crew.id}`]}
                        className="flex-1 text-xs font-medium bg-blue-600 text-white rounded-md py-1.5 hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        {busy[`add-${crew.id}`] ? "Adding..." : "Add"}
                      </button>
                      <button
                        onClick={() => {
                          setAddingTo(null)
                          setSelectedWorker("")
                        }}
                        className="text-xs font-medium text-gray-500 hover:text-gray-700 px-3 py-1.5"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setAddingTo(crew.id)
                      setSelectedWorker("")
                      setSelectedRole(CREW_MEMBER_ROLES[0])
                    }}
                    className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-gray-500 hover:text-blue-600 border border-dashed border-gray-300 hover:border-blue-400 rounded-md py-1.5 transition-colors"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Add Member
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Create crew */}
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
    </div>
  )
}
