export function canDelete(role){ return role === 'SuperAdmin' }
export function canCreate(role){ return role === 'SuperAdmin' || role === 'Admin' }
export function canUpdate(role){ return role === 'SuperAdmin' || role === 'Admin' }
export function readOnly(role){ return role === 'Employee' }
