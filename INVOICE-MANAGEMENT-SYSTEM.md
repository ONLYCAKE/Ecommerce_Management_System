# Backend Architecture (10 Q\&A)

# What is the backend architecture of your project?

Answer:
It follows a Modular MVC-like structure —
===

# Routes → define API endpoints

# Controllers → business logic

# Middleware → authentication \& permissions

# Prisma ORM → database access

# Socket.io → realtime updates

# PDF Service → generate invoice PDFs

# What is the role of Routes in your backend?

Answer:
Routes connect an HTTP endpoint (like /api/invoices) to the correct controller function.
===

# Why do we use Controllers?

Answer:
To keep code clean.
Routes should NOT contain business logic — controllers handle validation, database calls, PDF generation, and socket events.
===

# What is Middleware used for?

Answer:
Middleware runs before the controller.
It is used for:
✔ Authentication
✔ Permissions
✔ Logging
✔ Input validation
===

# What is Prisma?

Answer:
Prisma is an ORM that converts JavaScript function calls into SQL queries.
===

# Why use Prisma instead of direct SQL?

# Answer:

# Auto-complete

# Schema managed in one file

# Safer queries

# Easier migrations

# Cleaner code

# What is the use of schema.prisma?

Answer:
It defines tables, relations, and database configuration.
===

# How does database migration work in Prisma?

Answer:
When schema changes:
npx prisma migrate dev
→ Prisma generates SQL migration → Applies to DB.
===

# What is the purpose of normalization in invoice items?

Answer:
Invoice = Header
Invoice Items = Separate table
Reason:
===

# No duplicate product data

# Better performance

# Cleaner relational design

# Can you explain the invoice creation flow?

# Answer:

# Frontend sends invoice data

# Route → Controller

# Controller validates

# Prisma creates invoice

# Prisma creates invoice items

# PDF generated

# Socket.io sends “invoice created” event

# Response returned

🔐 Authentication \& Permissions (8 Q\&A)
11. How does authentication work in your system?
===

# Answer:

# User logs in

# Server returns JWT token

# Frontend stores token

# Axios sends token in Authorization header

# Auth middleware verifies token

# What is JWT and why use it?

Answer:
JWT = JSON Web Token.
Used because:
===

# No session storage

# Stateless

# Fast

# Secure

# What is inside a JWT token?

# Answer:

# User ID

# Role

# Expiry time

# Signed with secret key

# What is the purpose of auth.js middleware?

# Answer:

# Check token

# Decode user

# Attach user to req

# Block unauthorized access

# What is role-based permission?

Answer:
Different users get different access:
Example:
===

# Admin → create/delete invoice

# Employee → view only

# What is the difference between Authentication \& Authorization?

Answer:
Authentication → Who are you?
Authorization → What can you do?
===

# How do you protect APIs in backend?

Answer:
Using middleware:
router.get("/", authenticate, roleCheck(...))
===

# What happens if a JWT is expired or invalid?

Answer:
Middleware returns 401 Unauthorized.
===

🧩 Frontend (React) Q\&A (6 Questions)
19. What is AuthContext in your frontend?
===

Answer:
It stores:
===

# Logged-in user

# Token

Login/Logout functions
Used by all protected pages.
===

# What does Axios Interceptor do?

Answer:
It automatically attaches the JWT token to every API request.
===

# What is the flow of a frontend request?

Answer:
Page → API Client → Backend Route → Controller → DB → Response.
===

# How do you handle restricted pages in React?

Answer:
Using Protected Routes + AuthContext.
===

# How does your invoice page work?

# Answer:

# Fetch invoices

# Display list

# Edit, delete, print PDF

# Create new invoice form

# How do you update UI after any invoice is created?

Answer:
Via Socket.io real-time updates.
===

📄 PDF \& Realtime Q\&A (6 Questions)
25. How do you generate PDF in your project?
===

Answer:
PDF is generated using HTML template + library (like puppeteer/pdfkit).
===

# Why generate invoice PDF on the backend?

# Answer:

# Security

# Consistency

# Backend has correct data

# No dependency on browser

# How does Socket.io work?

# Answer:

# Server emits event

Connected clients receive it
Example:
io.emit("invoice\_created", newInvoice)
===

# Why use realtime events in an invoice system?

Answer:
To auto-refresh dashboards without reload.
===

# What happens when an invoice is updated?

# Answer:

# Prisma updates

# PDF regenerated (if needed)

# Socket event emitted

# UI updates

# What is a correct API response structure?

# Answer:

{
success: true,
message: "Invoice created",
data: { ... }
}
===

