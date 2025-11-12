// src/utils/permissions.js

// Safely parse JSON from localStorage
function safeParse(json, fallback = null) {
  try {
    return JSON.parse(json);
  } catch (e) {
    console.warn('[DEBUG] permissions.safeParse: failed to parse JSON');
    return fallback;
  }
}

// Read current user from localStorage (safe)
export function getUser() {
  const raw = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
  return raw ? safeParse(raw, null) : null;
}
// Back-compat alias if existing code imports getCurrentUser
export const getCurrentUser = getUser;

// Build a permission key like "product.create"
export function buildPermission(module, action) {
  const mod = String(module || '').trim().toLowerCase();
  const act = String(action || '').trim().toLowerCase();
  const key = `${mod}.${act}`;
  console.debug('[DEBUG] permissions.buildPermission', { role: getUser()?.role || 'Guest', permissionKey: key });
  return key;
}

// Check if user has an explicit permission key
export function hasPermission(key) {
  const user = getUser();
  const role = user?.role || 'Guest';
  const perms = Array.isArray(user?.permissions) ? user.permissions : [];
  const allowed = perms.includes(String(key));
  console.debug('[DEBUG] permissions.hasPermission', { role, permissionKey: key, result: allowed });
  return allowed;
}

function evaluate(module, action) {
  const user = getUser();
  const role = user?.role || 'Guest';
  const key = buildPermission(module, action);

  // Full access for SuperAdmin/Admin
  if (role === 'SuperAdmin' || role === 'Admin') {
    console.debug('[DEBUG] permissions.evaluate', { role, permissionKey: key, result: true });
    return true;
  }

  const result = hasPermission(key);
  console.debug('[DEBUG] permissions.evaluate', { role, permissionKey: key, result });
  return result;
}

export function canCreate(module) {
  return evaluate(module, 'create');
}

export function canUpdate(module) {
  return evaluate(module, 'update');
}

export function canDelete(module) {
  return evaluate(module, 'delete');
}

export function canRead(module) {
  return evaluate(module, 'read');
}

export function readOnly() {
  const user = getUser();
  const role = user?.role || 'Guest';
  const result = role === 'Employee';
  console.debug('[DEBUG] permissions.readOnly', { role, result });
  return result;
}

// Example usage:
// if (canCreate('product')) console.log('✅ Can create a product');
// if (!canDelete('user')) console.log('🚫 Cannot delete user');
