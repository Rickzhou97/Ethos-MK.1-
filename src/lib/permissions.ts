// Role-based access control — defines what each role can do

export type Permission =
  | "projects:read" | "projects:create" | "projects:edit" | "projects:delete"
  | "quotes:read" | "quotes:create" | "quotes:edit" | "quotes:delete" | "quotes:approve"
  | "products:read" | "products:edit"
  | "purchasing:read" | "purchasing:create" | "purchasing:edit"
  | "finance:read" | "finance:edit"
  | "customers:read" | "customers:create" | "customers:edit"
  | "suppliers:read" | "suppliers:create" | "suppliers:edit"
  | "team:read" | "team:edit"
  | "catalogue:read" | "catalogue:edit"
  | "reports:read"
  | "import:use"
  | "settings:admin"
  | "variations:read" | "variations:create" | "variations:edit"
  | "ncrs:read" | "ncrs:create" | "ncrs:edit"
  | "audit:read"
  | "portal:manage"
  | "crm:read" | "crm:create" | "crm:edit" | "crm:delete" | "crm:convert"
  | "design:read" | "design:manage" | "design:assign"
  | "design:start" | "design:review" | "design:signoff"
  | "design:handover-create" | "design:handover-acknowledge"
  | "production:read" | "production:manage" | "production:inspect"

const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  ADMIN: [
    "projects:read", "projects:create", "projects:edit", "projects:delete",
    "quotes:read", "quotes:create", "quotes:edit", "quotes:delete", "quotes:approve",
    "products:read", "products:edit",
    "purchasing:read", "purchasing:create", "purchasing:edit",
    "finance:read", "finance:edit",
    "customers:read", "customers:create", "customers:edit",
    "suppliers:read", "suppliers:create", "suppliers:edit",
    "team:read", "team:edit",
    "catalogue:read", "catalogue:edit",
    "reports:read", "import:use", "settings:admin",
    "variations:read", "variations:create", "variations:edit",
    "ncrs:read", "ncrs:create", "ncrs:edit",
    "audit:read", "portal:manage",
    "crm:read", "crm:create", "crm:edit", "crm:delete", "crm:convert",
    "design:read", "design:manage", "design:assign",
    "design:start", "design:review", "design:signoff",
    "design:handover-create", "design:handover-acknowledge",
    "production:read", "production:manage", "production:inspect",
  ],
  ESTIMATOR: [
    "projects:read", "projects:create",
    "quotes:read", "quotes:create", "quotes:edit",
    "products:read",
    "purchasing:read",
    "finance:read",
    "customers:read", "customers:create", "customers:edit",
    "suppliers:read",
    "catalogue:read", "catalogue:edit",
    "reports:read",
    "variations:read", "variations:create",
    "ncrs:read",
    "crm:read", "crm:create", "crm:edit", "crm:convert",
  ],
  PROJECT_COORDINATOR: [
    "projects:read", "projects:create", "projects:edit",
    "quotes:read",
    "products:read", "products:edit",
    "purchasing:read", "purchasing:create", "purchasing:edit",
    "finance:read",
    "customers:read",
    "suppliers:read", "suppliers:create",
    "catalogue:read",
    "reports:read",
    "variations:read", "variations:create", "variations:edit",
    "ncrs:read", "ncrs:create", "ncrs:edit",
    "team:read",
    "crm:read",
    "design:read", "design:manage", "design:assign", "design:handover-create",
    "production:read",
  ],
  DESIGNER: [
    "projects:read",
    "quotes:read",
    "products:read", "products:edit",
    "purchasing:read",
    "customers:read",
    "suppliers:read",
    "catalogue:read",
    "ncrs:read", "ncrs:create",
    "team:read",
    "design:read", "design:start", "design:review",
    "production:read",
  ],
  PRODUCTION_MANAGER: [
    "projects:read",
    "quotes:read",
    "products:read", "products:edit",
    "purchasing:read", "purchasing:create",
    "finance:read",
    "customers:read",
    "suppliers:read",
    "catalogue:read",
    "reports:read",
    "ncrs:read", "ncrs:create", "ncrs:edit",
    "team:read",
    "design:read", "design:handover-acknowledge",
    "production:read", "production:manage", "production:inspect",
  ],
  SALES_DIRECTOR: [
    "projects:read",
    "quotes:read", "quotes:create", "quotes:edit", "quotes:approve",
    "products:read",
    "purchasing:read",
    "finance:read",
    "customers:read", "customers:create", "customers:edit",
    "suppliers:read",
    "catalogue:read",
    "reports:read",
    "crm:read", "crm:create", "crm:edit", "crm:convert",
    "design:read",
    "production:read",
  ],
  VIEWER: [
    "projects:read",
    "quotes:read",
    "products:read",
    "purchasing:read",
    "finance:read",
    "customers:read",
    "suppliers:read",
    "catalogue:read",
    "reports:read",
    "team:read",
    "ncrs:read",
    "variations:read",
    "crm:read",
  ],
}

export function hasPermission(role: string, permission: Permission): boolean {
  const perms = ROLE_PERMISSIONS[role]
  if (!perms) return false
  return perms.includes(permission)
}

export function hasAnyPermission(role: string, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(role, p))
}

export function getPermissions(role: string): Permission[] {
  return ROLE_PERMISSIONS[role] || []
}

export function canEdit(role: string): boolean {
  return role !== "VIEWER"
}
