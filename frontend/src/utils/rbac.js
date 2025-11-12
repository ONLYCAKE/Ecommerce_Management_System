// export function canDelete(role){ return role === 'SuperAdmin' }
// export function canCreate(role){ return role === 'SuperAdmin' || role === 'Admin' }
// export function canUpdate(role){ return role === 'SuperAdmin' || role === 'Admin' }
// export function readOnly(role){ return role === 'Employee' }
// permissions.js

// Helper: Get user permissions safely from localStorage
function getUserPermissions() {
  try {
    const user = JSON.parse(localStorage.getItem('user'));
    console.log('[DEBUG] Loaded user from localStorage:', user);
    return user?.permissions || [];
  } catch (err) {
    console.error('[ERROR] Failed to parse user from localStorage:', err);
    return [];
  }
}

// Helper: Check if user has a specific permission
function hasPermission(permissionKey) {
  const permissions = getUserPermissions();
  const result = permissions.includes(permissionKey);
  console.log(`[DEBUG] Checking permission "${permissionKey}": ${result}`);
  return result;
}

// Dynamic access functions
export function canDelete(role, permissionKey = 'delete') {
  const result =
    role === 'SuperAdmin' ||
    role === 'Admin' ||
    hasPermission(permissionKey);
  console.log(`[DEBUG] canDelete | role=${role}, permission=${permissionKey}, result=${result}`);
  return result;
}

export function canCreate(role, permissionKey = 'create') {
  const result =
    role === 'SuperAdmin' ||
    role === 'Admin' ||
    hasPermission(permissionKey);
  console.log(`[DEBUG] canCreate | role=${role}, permission=${permissionKey}, result=${result}`);
  return result;
}

export function canUpdate(role, permissionKey = 'update') {
  const result =
    role === 'SuperAdmin' ||
    role === 'Admin' ||
    hasPermission(permissionKey);
  console.log(`[DEBUG] canUpdate | role=${role}, permission=${permissionKey}, result=${result}`);
  return result;
}

export function readOnly(role) {
  const result = role === 'Employee';
  console.log(`[DEBUG] readOnly | role=${role}, result=${result}`);
  return result;
}
