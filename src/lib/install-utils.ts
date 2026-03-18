// ============================================================
// Installation Module Utilities
// ============================================================

export const INSTALL_STAGES = [
  "SITE_PREP",
  "DELIVERY",
  "INSTALL",
  "CONNECTIONS",
  "TESTING",
  "HANDOVER",
] as const

export type InstallStage = (typeof INSTALL_STAGES)[number]

export const INSTALL_STAGE_DISPLAY_NAMES: Record<string, string> = {
  SITE_PREP: "Site Prep",
  DELIVERY: "Delivery",
  INSTALL: "Install",
  CONNECTIONS: "Connections",
  TESTING: "Testing",
  HANDOVER: "Handover",
  COMPLETED: "Completed",
}

export const INSTALL_STAGE_BORDER_COLORS: Record<string, string> = {
  SITE_PREP: "border-t-orange-500",
  DELIVERY: "border-t-blue-500",
  INSTALL: "border-t-indigo-500",
  CONNECTIONS: "border-t-purple-500",
  TESTING: "border-t-amber-500",
  HANDOVER: "border-t-green-500",
  COMPLETED: "border-t-emerald-500",
}

export const INSTALL_STAGE_BG_TINTS: Record<string, string> = {
  SITE_PREP: "bg-orange-50",
  DELIVERY: "bg-blue-50",
  INSTALL: "bg-indigo-50",
  CONNECTIONS: "bg-purple-50",
  TESTING: "bg-amber-50",
  HANDOVER: "bg-green-50",
  COMPLETED: "bg-emerald-50",
}

export const INSTALL_STAGE_TEXT_COLORS: Record<string, string> = {
  SITE_PREP: "text-orange-700",
  DELIVERY: "text-blue-700",
  INSTALL: "text-indigo-700",
  CONNECTIONS: "text-purple-700",
  TESTING: "text-amber-700",
  HANDOVER: "text-green-700",
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
