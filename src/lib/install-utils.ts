// ============================================================
// Installation Module Utilities
// ============================================================

export const INSTALL_STAGES = [
  "PREPARATION",
  "CIVIL_WORKS",
  "LIFTING",
  "INSTALLATION",
  "SEALING",
  "INSPECTION",
] as const

export type InstallStage = (typeof INSTALL_STAGES)[number]

export const INSTALL_STAGE_DISPLAY_NAMES: Record<string, string> = {
  PREPARATION: "Preparation",
  CIVIL_WORKS: "Civil Works",
  LIFTING: "Lifting",
  INSTALLATION: "Installation",
  SEALING: "Sealing",
  INSPECTION: "Inspection",
  COMPLETED: "Completed",
}

export const INSTALL_STAGE_COLORS_HEX: Record<string, string> = {
  PREPARATION: "#f97316",   // orange
  CIVIL_WORKS: "#3b82f6",   // blue
  LIFTING: "#8b5cf6",       // violet
  INSTALLATION: "#6366f1",  // indigo
  SEALING: "#06b6d4",       // cyan
  INSPECTION: "#22c55e",    // green
  COMPLETED: "#10b981",     // emerald
}

export const INSTALL_STAGE_BORDER_COLORS: Record<string, string> = {
  PREPARATION: "border-t-orange-500",
  CIVIL_WORKS: "border-t-blue-500",
  LIFTING: "border-t-violet-500",
  INSTALLATION: "border-t-indigo-500",
  SEALING: "border-t-cyan-500",
  INSPECTION: "border-t-green-500",
  COMPLETED: "border-t-emerald-500",
}

export const INSTALL_STAGE_BG_TINTS: Record<string, string> = {
  PREPARATION: "bg-orange-50",
  CIVIL_WORKS: "bg-blue-50",
  LIFTING: "bg-violet-50",
  INSTALLATION: "bg-indigo-50",
  SEALING: "bg-cyan-50",
  INSPECTION: "bg-green-50",
  COMPLETED: "bg-emerald-50",
}

export const INSTALL_STAGE_TEXT_COLORS: Record<string, string> = {
  PREPARATION: "text-orange-700",
  CIVIL_WORKS: "text-blue-700",
  LIFTING: "text-violet-700",
  INSTALLATION: "text-indigo-700",
  SEALING: "text-cyan-700",
  INSPECTION: "text-green-700",
  COMPLETED: "text-emerald-700",
}

export const TASK_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  BLOCKED: "Blocked",
  ON_HOLD: "On Hold",
  REWORK: "Rework",
}

export const TASK_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-green-100 text-green-700",
  BLOCKED: "bg-red-100 text-red-700",
  ON_HOLD: "bg-amber-100 text-amber-700",
  REWORK: "bg-orange-100 text-orange-700",
}

export const CREW_MEMBER_ROLES = ["Lead", "Installer", "Apprentice"] as const

export function getNextInstallStage(current: string): string | null {
  const idx = INSTALL_STAGES.indexOf(current as InstallStage)
  if (idx === -1 || idx >= INSTALL_STAGES.length - 1) return null
  return INSTALL_STAGES[idx + 1]
}

export function getPrevInstallStage(current: string): string | null {
  const idx = INSTALL_STAGES.indexOf(current as InstallStage)
  if (idx <= 0) return null
  return INSTALL_STAGES[idx - 1]
}

export function getInstallCardScheduleColor(targetDate: Date | string | null): string {
  if (!targetDate) return "border-l-gray-300"
  const target = typeof targetDate === "string" ? new Date(targetDate) : targetDate
  const now = new Date()
  const diffDays = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return "border-l-red-500"
  if (diffDays <= 3) return "border-l-amber-500"
  if (diffDays <= 7) return "border-l-yellow-400"
  return "border-l-green-500"
}

// Default crew colors for UI identification
export const CREW_COLORS: Record<number, { bg: string; text: string; border: string }> = {
  0: { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-400" },
  1: { bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-400" },
  2: { bg: "bg-purple-100", text: "text-purple-700", border: "border-purple-400" },
  3: { bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-400" },
  4: { bg: "bg-rose-100", text: "text-rose-700", border: "border-rose-400" },
}

// Equipment types
export const EQUIPMENT_TYPES = ["VEHICLE", "PLANT", "TOOL"] as const
export const EQUIPMENT_TYPE_LABELS: Record<string, string> = {
  VEHICLE: "Vehicle",
  PLANT: "Plant",
  TOOL: "Tool",
}

// Instruction types
export const INSTRUCTION_TYPES = ["METHOD_STATEMENT", "RISK_ASSESSMENT", "DRAWING", "OTHER"] as const
export const INSTRUCTION_TYPE_LABELS: Record<string, string> = {
  METHOD_STATEMENT: "Method Statement",
  RISK_ASSESSMENT: "Risk Assessment",
  DRAWING: "Drawing",
  OTHER: "Other",
}

// Expense categories
export const EXPENSE_CATEGORIES = ["FUEL", "MATERIALS", "HIRE", "ACCOMMODATION", "TRAVEL", "SUBSISTENCE", "PPE", "OTHER"] as const

export const EXPENSE_CATEGORY_COLORS: Record<string, string> = {
  FUEL: "bg-blue-100 text-blue-700",
  MATERIALS: "bg-amber-100 text-amber-700",
  HIRE: "bg-purple-100 text-purple-700",
  ACCOMMODATION: "bg-green-100 text-green-700",
  TRAVEL: "bg-cyan-100 text-cyan-700",
  SUBSISTENCE: "bg-orange-100 text-orange-700",
  PPE: "bg-gray-100 text-gray-700",
  OTHER: "bg-slate-100 text-slate-700",
}
