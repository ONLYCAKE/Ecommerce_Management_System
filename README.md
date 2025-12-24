# E-commerce Management Admin Portal

Professional, modern, and responsive admin portal for managing users, roles, permissions, suppliers, buyers, products, and orders. Tech stack:

- Backend: Node.js, Express, Prisma, PostgreSQL
- Frontend: React (Vite), TailwindCSS, React Router, Axios

## Monorepo Structure

- backend/
- frontend/

## Environment

Create .env files from provided examples.

- backend/.env
```
PORT=5000
JWT_SECRET=super_secret_jwt_for_dev
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/task3?schema=postgres
```
- frontend/.env
```
VITE_API_URL=http://localhost:5000
```

Postgres DB required: database name `task3`, schema `postgres` (included in DATABASE_URL above)

## Install & Run (two terminals)

Terminal 1 (backend):
```
cd backend
npm install
npx prisma migrate reset
npm run dev
```

Terminal 2 (frontend):
```
cd frontend
npm install
npm run dev
```

Or via root scripts (still use two terminals):
```
npm run dev:backend
npm run dev:frontend
```

Backend runs at http://localhost:5000
Frontend runs at http://localhost:5173

## Default Credentials


- ceo@company.com / Super@123 (SuperAdmin)
- admin.team@company.com / Admin@123 (Admin)
- staff@company.com / Emp@123 (Employee)

On first login, users are required to change the password.

## Features

- Auth: JWT login, first-time password change
- Users: list, create, update, soft-delete (archive); search, pagination, archived filter
- Roles & Permissions: assign permissions to roles (SuperAdmin full CRUD; others read-only)
- Suppliers: CRUD (Admin cannot delete; Employee read-only)
- Buyers: CRUD (Admin cannot delete; Employee read-only)
- Products: CRUD with supplier linking (Admin create/update; Employee read-only)
- Orders: create and read; totals and items
- Middleware: JWT auth + role-based route guard with permission keys
- UI: Sidebar with collapse, Topbar with user info, dashboard cards, rounded inputs/cards, modals, responsive

## Notes

- Prisma uses DATABASE_URL; ensure your Postgres is reachable and the `task3` database exists.
- TailwindCSS theme tokens (primary, secondary, accent, text) and fonts (Inter, Manrope) are configured in `frontend/tailwind.config.js`. Restart Vite after changes.
- Currency formatting uses INR (₹) via `formatINR` helper.
- Any IDE CSS lint warnings for `@tailwind` or `@apply` can be ignored; they compile correctly.
- Server reads `PORT` (and is compatible with `BACKEND_PORT`).

## Scripts

Backend (from backend/):
- prisma:generate
- prisma:migrate
- prisma:seed
- dev

Frontend (from frontend/):
- dev
- build
- preview
