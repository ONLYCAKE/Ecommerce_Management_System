/* ------------------------------------------------------------------------
   permissions.ts (FINAL + FIXED)
   Fully typed, safe, and compatible with updated permission workflow
------------------------------------------------------------------------ */

export interface User {
  role: string;
  permissions?: string[];
}

/* -----------------------------------------------
   Get user safely from localStorage
----------------------------------------------- */
function getUser(): User | null {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

/* -----------------------------------------------
   Extract permission list safely
----------------------------------------------- */
function getUserPermissions(): string[] {
  const user = getUser();
  return Array.isArray(user?.permissions) ? user!.permissions : [];
}

/* -----------------------------------------------
   Permission checker
----------------------------------------------- */
function hasPermission(permissionKey: string): boolean {
  return getUserPermissions().includes(permissionKey);
}

/* -----------------------------------------------
   MAIN EXPORTS — dynamic CRUD access
----------------------------------------------- */

export function canCreate(module: string): boolean {
  const user = getUser();
  if (!user) return false;

  if (user.role === "SuperAdmin" || user.role === "Admin") return true;

  return hasPermission(`${module.toLowerCase()}.create`);
}

export function canUpdate(module: string): boolean {
  const user = getUser();
  if (!user) return false;

  if (user.role === "SuperAdmin" || user.role === "Admin") return true;

  return hasPermission(`${module.toLowerCase()}.update`);
}

export function canDelete(module: string): boolean {
  const user = getUser();
  if (!user) return false;

  if (user.role === "SuperAdmin" || user.role === "Admin") return true;

  return hasPermission(`${module.toLowerCase()}.delete`);
}

export function canRead(module: string): boolean {
  const user = getUser();
  if (!user) return false;

  if (user.role === "SuperAdmin" || user.role === "Admin") return true;

  return hasPermission(`${module.toLowerCase()}.read`);
}

/* -----------------------------------------------
   Read-only mode (Employee)
----------------------------------------------- */
export function readOnly(): boolean {
  const user = getUser();
  if (!user) return true; // default fail-safe
  return user.role === "Employee";
}
