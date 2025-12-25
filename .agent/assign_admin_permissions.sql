-- =====================================================
-- ADMIN ROLE PERMISSION SETUP SCRIPT
-- =====================================================
-- Purpose: Assign READ, CREATE, UPDATE permissions to Admin role
-- NO DELETE PERMISSIONS FOR ADMIN
-- Database: PostgreSQL / Prisma
-- Date: 2025-12-25
-- =====================================================

-- Step 1: Verify Admin role exists
SELECT id, name FROM "Role" WHERE name = 'Admin';
-- Expected: Should return one row with id (usually 2)

-- =====================================================
-- MAIN SCRIPT: Assign Admin Permissions (READ, CREATE, UPDATE ONLY)
-- =====================================================

-- Delete existing Admin role permissions (clean slate)
DELETE FROM "RolePermission" 
WHERE "roleId" = (SELECT id FROM "Role" WHERE name = 'Admin');

-- Insert Admin permissions (READ, CREATE, UPDATE only - NO DELETE)
INSERT INTO "RolePermission" ("roleId", "permissionId", enabled)
SELECT 
    (SELECT id FROM "Role" WHERE name = 'Admin'),
    p.id,
    true
FROM "Permission" p
WHERE p.key IN (
    -- User permissions (no delete)
    'user.read', 'user.create', 'user.update',
    
    -- Buyer permissions (no delete)
    'buyer.read', 'buyer.create', 'buyer.update',
    
    -- Supplier permissions (no delete)
    'supplier.read', 'supplier.create', 'supplier.update',
    
    -- Product permissions (no delete)
    'product.read', 'product.create', 'product.update',
    
    -- Invoice permissions (no delete)
    'invoice.read', 'invoice.create', 'invoice.update',
    
    -- Proforma permissions (no delete)
    'proforma.read', 'proforma.create', 'proforma.update',
    
    -- Payment permissions (no delete)
    'payment.read', 'payment.create', 'payment.update',
    
    -- Order permissions (no delete, if exists)
    'order.read', 'order.create', 'order.update',
    
    -- Report permissions (read only)
    'report.read',
    
    -- Role permissions (read only)
    'role.read',
    
    -- Permission permissions (read only)
    'permission.read'
);

-- =====================================================
-- VERIFICATION QUERY
-- =====================================================

-- Check how many permissions were assigned
SELECT 
    r.name as role_name,
    COUNT(rp.id) as permission_count,
    STRING_AGG(p.key, ', ' ORDER BY p.key) as permissions
FROM "Role" r
LEFT JOIN "RolePermission" rp ON r.id = rp."roleId" AND rp.enabled = true
LEFT JOIN "Permission" p ON rp."permissionId" = p.id
WHERE r.name = 'Admin'
GROUP BY r.name;

-- Expected output:
-- role_name | permission_count | permissions
-- Admin     | 24-26           | buyer.create, buyer.read, buyer.update, invoice.create, ...

-- =====================================================
-- DETAILED VERIFICATION - Group by Permission Type
-- =====================================================

-- See permissions grouped by action type
SELECT 
    CASE 
        WHEN p.key LIKE '%.read' THEN 'READ'
        WHEN p.key LIKE '%.create' THEN 'CREATE'
        WHEN p.key LIKE '%.update' THEN 'UPDATE'
        WHEN p.key LIKE '%.delete' THEN 'DELETE'
        ELSE 'OTHER'
    END as action_type,
    COUNT(*) as count,
    STRING_AGG(p.key, ', ' ORDER BY p.key) as permissions
FROM "RolePermission" rp
JOIN "Permission" p ON rp."permissionId" = p.id
WHERE rp."roleId" = (SELECT id FROM "Role" WHERE name = 'Admin')
  AND rp.enabled = true
GROUP BY action_type
ORDER BY action_type;

-- Expected output:
-- action_type | count | permissions
-- CREATE      | 8     | buyer.create, invoice.create, ...
-- READ        | 10    | buyer.read, invoice.read, ...
-- UPDATE      | 8     | buyer.update, invoice.update, ...
-- DELETE      | 0     | (none - correct!)

-- =====================================================
-- VERIFY NO DELETE PERMISSIONS
-- =====================================================

-- This should return 0 rows (no delete permissions)
SELECT p.key 
FROM "RolePermission" rp
JOIN "Permission" p ON rp."permissionId" = p.id
WHERE rp."roleId" = (SELECT id FROM "Role" WHERE name = 'Admin')
  AND rp.enabled = true
  AND p.key LIKE '%.delete';

-- Expected: (0 rows) - CORRECT!

-- =====================================================
-- END OF SCRIPT
-- =====================================================

-- After running this script:
-- 1. Logout and login as Naisargi (or any Admin user)
-- 2. Check "Manage Permissions" - should show ~24-26 permissions enabled
-- 3. Role permissions should be CHECKED by default
-- 4. NO DELETE permissions should be enabled
