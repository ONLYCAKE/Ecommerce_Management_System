// src/utils/permissions.ts

/* ------------------------------------------------------------
   Type Definitions
------------------------------------------------------------ */
export interface User {
  role: string;
  permissions?: string[];
}

export type PermissionKey = string;

/* ------------------------------------------------------------
   Safe JSON Parser
------------------------------------------------------------ */
function safeParse<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    console.warn('[DEBUG] permissions.safeParse: JSON parse failed');
    return fallback;
  }
}

/* ------------------------------------------------------------
   Get Current User from localStorage
------------------------------------------------------------ */
export function getUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("user");
  return safeParse<User | null>(raw, null);
}

// Backwards compatibility
export const getCurrentUser = getUser;

/* ------------------------------------------------------------
   Build permission key → "product.create"
------------------------------------------------------------ */
export function buildPermission(module: string, action: string): PermissionKey {
  const mod = String(module || "").trim().toLowerCase();
  const act = String(action || "").trim().toLowerCase();
  const key = `${mod}.${act}`;

  console.debug("[DEBUG] permissions.buildPermission", {
    role: getUser()?.role || "Guest",
    permissionKey: key,
  });

  return key;
}

/* ------------------------------------------------------------
   Check explicit permissions
------------------------------------------------------------ */
export function hasPermission(key: PermissionKey): boolean {
  const user = getUser();
  const perms = Array.isArray(user?.permissions) ? user.permissions : [];

  const allowed = perms.includes(key);

  console.debug("[DEBUG] permissions.hasPermission", {
    role: user?.role || "Guest",
    permissionKey: key,
    result: allowed,
  });

  return allowed;
}

/* ------------------------------------------------------------
   Main evaluator
------------------------------------------------------------ */
function evaluate(module: string, action: string): boolean {
  const user = getUser();
  const role = user?.role || "Guest";
  const key = buildPermission(module, action);

  // Only SuperAdmin has automatic full access
  if (role === "SuperAdmin") {
    console.debug("[DEBUG] permissions.evaluate", { role, permissionKey: key, result: true, reason: "SuperAdmin auto-grant" });
    return true;
  }

  // All other roles (including Admin) must check explicit permissions
  const result = hasPermission(key);

  console.debug("[DEBUG] permissions.evaluate", {
    role,
    permissionKey: key,
    result,
    reason: result ? "explicit permission granted" : "permission denied"
  });

  return result;
}

/* ------------------------------------------------------------
   Permission Helpers
------------------------------------------------------------ */
export function canCreate(module: string): boolean {
  return evaluate(module, "create");
}

export function canUpdate(module: string): boolean {
  return evaluate(module, "update");
}

export function canDelete(module: string): boolean {
  return evaluate(module, "delete");
}

export function canRead(module: string): boolean {
  return evaluate(module, "read");
}

/* ------------------------------------------------------------
   Read-only Mode (for UI disabling)
------------------------------------------------------------ */
export function readOnly(): boolean {
  const user = getUser();
  const role = user?.role || "Guest";
  const isReadOnly = role === "Employee";

  console.debug("[DEBUG] permissions.readOnly", { role, result: isReadOnly });

  return isReadOnly;
}
