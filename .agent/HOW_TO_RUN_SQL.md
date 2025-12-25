# How to Run the SQL Script

## File Created
📄 `.agent/assign_admin_permissions.sql`

---

## Method 1: Using pgAdmin (GUI)

1. Open **pgAdmin**
2. Connect to your database
3. Right-click on database → **Query Tool**
4. **Open file**: `.agent/assign_admin_permissions.sql`
5. Click **Execute** (▶️ button)
6. Check output for verification

---

## Method 2: Using psql (Command Line)

### Step 1: Open Terminal in project root
```bash
cd "c:\Users\Divy\Desktop\Internship Task\TASK-3"
```

### Step 2: Run the SQL script
```bash
# Replace with your actual database connection details
psql -U postgres -d your_database_name -f .agent/assign_admin_permissions.sql
```

**Or connect first, then run**:
```bash
psql -U postgres -d your_database_name

# Inside psql:
\i .agent/assign_admin_permissions.sql
```

---

## Method 3: Using Database GUI (DBeaver, TablePlus, etc.)

1. Open your database tool
2. Connect to database
3. Open SQL editor
4. Copy content from `.agent/assign_admin_permissions.sql`
5. Paste and execute

---

## Method 4: Via Prisma Studio (If available)

1. Run: `npx prisma studio`
2. Browse to **RolePermission** table
3. Manually add permissions (tedious, not recommended)

---

## What the Script Does

1. ✅ Deletes existing Admin role permissions (clean slate)
2. ✅ Assigns ~28 permissions to Admin role:
   - User: read, create, update
   - Buyer: full CRUD
   - Supplier: full CRUD
   - Product: full CRUD
   - Invoice: full CRUD
   - Proforma: full CRUD
   - Payment: read, create, update
   - Report: read
3. ✅ Runs verification query showing permission count

---

## Expected Output

```sql
 role_name | permission_count | permissions
-----------+------------------+---------------------------
 Admin     | 28               | buyer.create, buyer.delete, buyer.read, buyer.update, invoice.create, ...
```

---

## After Running

1. **Logout** and login again (or refresh)
2. Open "Manage Permissions" for **Naisargi**
3. **Should now show**:
   - "28 of 39 permissions enabled" ✅
   - Admin role permissions **CHECKED** ✅
   - Can toggle other permissions

---

## Troubleshooting

### Error: "relation 'Role' does not exist"
**Fix**: Check table names - might be lowercase `role` instead of `"Role"`
```sql
-- Try this instead:
SELECT * FROM role WHERE name = 'Admin';
```

### Error: "role 'Admin' not found"
**Fix**: Role name might be different (e.g., 'admin', 'ADMIN')
```sql
-- Check actual role names:
SELECT * FROM "Role";
```

### No errors but permissions still 0
**Fix**: Clear cache and refresh browser (Ctrl+Shift+R)

---

## Quick Database Connection Check

```bash
# From backend directory
cd backend
npm run prisma:studio
# Opens Prisma Studio to browse data
```

Or check connection string in `.env`:
```
DATABASE_URL="postgresql://user:password@localhost:5432/dbname"
```

---

## Need Help?

Show me the error message or output from running the script!
