# NestJS Backend Migration Plan (Strict)

## Objective
Safely migrate the Express.js backend located in `backend-v2/` into a NestJS backend located in `backend/` with 100% functional parity.

This is a framework migration ONLY.
Business logic, database schema, and behavior must remain identical.

---

## Absolute Rules (Non-Negotiable)

1. `backend-v2/` is READ-ONLY
   - Do NOT edit, refactor, rename, or reformat any file inside it
   - Treat it as the single source of truth

2. `backend/` is the ONLY writable target
   - All NestJS code must be created here

3. Prisma Rules
   - Copy Prisma schema as-is
   - Do NOT modify `schema.prisma`
   - Do NOT modify `.env`
   - Do NOT create or run migrations
   - Database structure must remain untouched

4. Language Rules
   - TypeScript only
   - No JavaScript files
   - No mixed syntax

5. Logic Rules
   - No business logic refactoring
   - No optimization
   - No renaming of logic variables
   - No change in calculations, rounding, or conditions

6. API Rules
   - Same routes
   - Same HTTP methods
   - Same request payloads
   - Same response shapes
   - Same error messages and status codes

---

## Migration Order (Must Follow)

1. NestJS base setup (AppModule, main.ts)
2. PrismaModule + PrismaService
3. Auth module (login, JWT, /me)
4. Users, Roles, Permissions
5. Buyers, Suppliers, Products
6. Invoices (most critical)
7. Payments (dual recalculation logic)
8. Email + Reminder services
9. Socket.IO event system

Each module must fully work before moving to the next.

---

## Express → NestJS Mapping Rules

- routes/*.ts → controller.ts
- controllers/*.ts → service.ts
- middleware/auth.ts → AuthGuard
- requirePermission → PermissionGuard
- rateLimit middleware → NestJS ThrottlerGuard
- prisma.ts → PrismaService (DI-based)

---

## Validation Requirement

After migrating each module:
- Compare behavior with backend-v2
- Ensure DB output is identical
- Ensure no extra fields are added or removed

If mismatch found:
- STOP
- FIX
- DO NOT CONTINUE

---

## Forbidden Actions

- No redesign
- No new patterns
- No DTO re-shaping unless required by NestJS
- No guessing missing logic
- No deleting endpoints

This migration prioritizes safety over speed.
