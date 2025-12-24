
# Backend-v2 Express.js - Complete Logic & Functionality Reference
**Generated**: 2025-12-23  
**Purpose**: Comprehensive documentation of backend-v2 architecture, logic, and functionality for maintaining 100% parity

---

## 🏗️ ARCHITECTURE OVERVIEW

### **Technology Stack**
- **Framework**: Express.js + TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT (JSON Web Tokens)
- **Real-time**: Socket.io for events
- **PDF Generation**: PDFKit
- **Email**: Nodemailer

### **Project Structure**
```
backend-v2/src/
├── app.ts                 # Express app configuration
├── server.ts              # HTTP + Socket.io server
├── prisma.ts              # Prisma client instance
├── routes/                # 12 route modules
├── controllers/           # Business logic controllers
├── services/              # Core business services
├── middleware/            # Auth, rate limiting
├── constants/             # Permissions,config
├── types/                 # TypeScript definitions
├── utils/                 # Validation helpers
└── scripts/               # Maintenance scripts
```

---

## 📡 COMPLETE API ROUTE MAPPING

### **1. INVOICES** (`/api/invoices`) - 14 routes

| HTTP | Route | Permission | Middleware | Purpose |
|------|-------|------------|------------|---------|
| GET | `/` | INVOICE_READ | - | List all invoices with filtering |
| GET | `/next-no` | INVOICE_CREATE | - | Generate next invoice number |
| GET | `/summary` | INVOICE_READ | - | Get invoice statistics |
| GET | `/generate/:invoiceNo` | INVOICE_READ | - | Generate PDF (inline) |
| GET | `/:invoiceNo/download` | INVOICE_READ | - | Download PDF (attachment) |
| POST | `/` | INVOICE_CREATE | - | Create new invoice |
| PUT | `/:invoiceNo` | INVOICE_UPDATE | - | Update invoice |
| POST | `/mark-complete/:invoiceNo` | INVOICE_UPDATE | - | Mark as complete |
| POST | `/:invoiceNo/send-email` | INVOICE_READ | emailLimiter | Email invoice to buyer |
| POST | `/:invoiceNo/send-reminder` | INVOICE_READ | emailLimiter | Send payment reminder |
| POST | `/bulk/send-reminders` | INVOICE_READ | emailLimiter | Bulk send reminders |
| GET | `/:invoiceNo/reminders` | INVOICE_READ | - | Get reminder history |
| POST | `/:invoiceNo/finalize` | INVOICE_UPDATE | - | Convert draft to final |
| GET | `/:invoiceNo` | INVOICE_READ | - | Get single invoice |

### **2. PAYMENTS** (`/api/payments`) - 5 routes

| HTTP | Route | Permission | Middleware | Purpose |
|------|-------|------------|------------|---------|
| GET | `/records` | INVOICE_READ | - | All payment records (formatted) |
| GET | `/invoice/:invoiceNo` | INVOICE_READ | - | Payments for specific invoice |
| POST | `/` | INVOICE_UPDATE | paymentLimiter | Create payment |
| PUT | `/:id` | INVOICE_UPDATE | paymentLimiter | Update payment |
| DELETE | `/:id` | INVOICE_UPDATE | paymentLimiter | Delete payment |

### **3. PRODUCTS** (`/api/products`) - 6 routes

| HTTP | Route | Permission | Purpose |
|------|-------|------------|---------|
| GET | `/` | PRODUCT_READ | List products (plain array) |
| POST | `/` | PRODUCT_CREATE | Create product |
| PUT | `/:id` | PRODUCT_UPDATE | Update product |
| DELETE | `/:id` | PRODUCT_DELETE | Soft delete (archive) |
| PATCH | `/:id/restore` | PRODUCT_UPDATE | Restore archived product |
| DELETE | `/:id/permanent` | PRODUCT_DELETE | Hard delete (with validation) |

### **4. BUYERS** (`/api/buyers`) - 6 routes

Same pattern as Products with sorting support (sortBy, dir params)

### **5. SUPPLIERS** (`/api/suppliers`) - 6 routes

Same pattern as Products with dual validation (products + invoices)

### **6. PROFORMA INVOICES** (`/api/proforma-invoices`) - 7 routes

| HTTP | Route | Permission | Purpose |
|------|-------|------------|---------|
| GET | `/` | INVOICE_READ | List all proformas |
| POST | `/` | INVOICE_CREATE | Create proforma |
| GET | `/:id/pdf` | INVOICE_READ | Generate proforma PDF |
| POST | `/:id/convert` | INVOICE_CREATE | Convert to draft invoice |
| GET | `/:id` | INVOICE_READ | Get proforma |
| PUT | `/:id` | INVOICE_UPDATE | Update proforma |
| DELETE | `/:id` | INVOICE_UPDATE | Delete draft proforma |

### **7. USERS** (`/api/users`) - 6 routes

PAGINATED (returns `{items, total, page, pageSize}`)

### **8. ROLES** (`/api/roles`) - 7routes

Includes permission management sub-routes

### **9. STATS** (`/api/stats`) - 1 route

Period-based dashboard statistics

### **10. AUTH** (`/api/auth`) - 3 routes

| HTTP | Route | Middleware | Purpose |
|------|-------|------------|---------|
| POST | `/login` | loginLimiter | User login (JWT) |
| POST | `/change-password` | authenticate | Change password |
| GET | `/me` | authenticate | Get current user + permissions |

### **11. ORDERS** (`/api/orders`) - 5 routes

Legacy placeholder module (not actively used)

---

## 🔒 AUTHENTICATION & AUTHORIZATION

### **JWT Authentication**
- **Secret**: From `JWT_SECRET` environment variable
- **Expiry**: 8 hours
- **Payload**: `{ id, role }`
- **Header**: `Authorization: Bearer <token>`

### **Permission System**
- **Middleware**: `requirePermission(permission)`
- **Role-based**: Each role has enabled permissions
- **Dynamic**: Permissions can be toggled per role
- **Validation**: On every protected route

### **Permissions List** (from `constants/permissions.ts`):
```typescript
INVOICE_READ, INVOICE_CREATE, INVOICE_UPDATE, INVOICE_DELETE
PRODUCT_READ, PRODUCT_CREATE, PRODUCT_UPDATE, PRODUCT_DELETE
BUYER_READ, BUYER_CREATE, BUYER_UPDATE, BUYER_DELETE
SUPPLIER_READ, SUPPLIER_CREATE, SUPPLIER_UPDATE, SUPPLIER_DELETE
USER_READ, USER_CREATE, USER_UPDATE, USER_DELETE
ROLE_READ, ROLE_CREATE, ROLE_UPDATE, ROLE_DELETE
```

---

## 💰 INVOICE STATUS CALCULATION - CORE LOGIC

### **`invoiceStatusService.ts` - SINGLE SOURCE OF TRUTH**

**Status Rules** (from lines 17-22):
```typescript
- Draft: Manually set, PRESERVED until finalized
- Cancelled: Manually set, NEVER recalculated
- Unpaid: receivedAmount === 0 (non-draft only)
- Partial: 0 < receivedAmount < total (0.01 tolerance)
- Paid: receivedAmount >= total
```

**Algorithm** (from `recalculateAndUpdateInvoiceStatus()`):
```typescript
1. Fetch invoice + payments
2. Calculate receivedAmount = SUM(payments.amount)
3. Calculate balance = total - receivedAmount
4. IF status === 'Draft' → Keep Draft, update balance only
5. IF status === 'Cancelled' → Preserve, no changes
6. ELSE determine status:
   - receivedAmount === 0 → Unpaid
   - balance > 0.01 → Partial
   - else → Paid (balance = 0)
7. Update invoice.status and invoice.balance
8. Emit event (unless skipEmit = true)
```

**Critical Features**:
- **Transaction support**: Can run inside Prisma transaction
- **Event control**: `skipEmit` for batch operations
- **Rounding**: Uses `roundToTwoDecimals()` for precision
- **Audit logging**: Logs every status change

---

## 📝 INVOICE CREATION FLOW

### **`createInvoice()` - invoiceController.ts lines 58-362**

**Steps**:
1. **Parse Input**: Extract invoice data + items + payments
2. **Validate**: Check buyerId, at least one item
3. **Generate Invoice Number**:
   ```typescript
   INV-YYYYMM-NNNN  // e.g., INV-202512-0001
   // Excludes drafts from sequence if status !== 'Draft'
   ```
4. **Normalize Items**:
   - Calculate `amount = (qty × price) + GST`
   - Apply discount if present
   - Set defaults for missing fields
5. **Calculate Total**: SUM(items.amount) + serviceCharge
6. **Create Invoice** (in transaction):
   - Insert invoice record
   - Insert invoice items
   - Insert payments (if provided)
7. **Recalculate Status**:
   - First inside transaction with `skipEmit: true`
   - Then outside transaction to emit event
8. **Return**: Complete invoice with relationships

---

## 🔄 INVOICE FINALIZATION FLOW

### **`finalizeInvoice()` - invoiceController.ts lines 1454-1536**

**Critical Logic** (MUST match exactly):
```typescript
1. Find draft invoice (status MUST be 'Draft')
2. Validate:
   - Must have buyerId
   - Must have at least 1 item
3. Generate NEW invoice number:
   prefix = `INV-${year}${month}-`
   Find last NON-DRAFT invoice with this prefix
   nextCounter = lastNumber + 1
   newInvoiceNo = `INV-202512-${counter.padStart(4, '0')}`
4. Update invoice:
   - invoiceNo = newInvoiceNo
   - status = 'Unpaid'
5. Recalculate status (will change to Paid/Partial if payments exist)
6. Optional: Send email to buyer
7. Emit 'invoice.updated' event
8. Return finalized invoice
```

**Key Point**: Invoice number CHANGES from `DRAFT-XXX` to `INV-YYYYMM-NNNN`

---

## 💳 PAYMENT CREATION FLOW

### **`createPayment()` - paymentController.ts lines 22-108**

**Steps**:
1. **Find Invoice**: By `invoiceNo` or `invoiceId`
2. **Validate Amount**: Must be > 0
3. **Calculate Remaining Balance**:
   ```typescript
   received = SUM(existing payments)
   remaining = invoice.total - received
   ```
4. **Validate Overpayment**:
   ```typescript
   if (amount > remaining + 0.01) {
     return 400: Cannot exceed remaining balance
   }
   ```
5. **Create Payment** (in transaction):
   ```typescript
   await prisma.$transaction(async (tx) => {
     payment = await tx.payment.create({invoiceId, amount, method, date})
     await recalculateStatus(invoiceId, {skipEmit: true, transaction: tx})
   })
   ```
6. **Recalculate Status** (outside transaction for event emission)
7. **Return**: Created payment

**Critical**: Uses TWO recalculate calls (inside+outside transaction)

---

## 📄 PDF GENERATION

### **`generateInvoicePdf()` - invoiceController.ts lines 541-1222**

**Features**:
- **Library**: PDFKit
- **Page Size**: A4 (595.28 × 841.89 pixels)
-**Margins**: 40px
- **Layout**:
  1. Company header with logo
  2. Invoice metadata (number, date, status)
  3. Bill To section
  4. Items table (8 columns)
  5. Totals summary
  6. Payment history
  7. Notes & terms
  8. Signature section

**Color Scheme**:
```typescript
primary: '#1a202c', accent: '#3182ce'
success: '#38a169', text: '#2d3748'
```

**Download vs View**:
- `Content-Disposition: inline` → View in browser
- `Content-Disposition: attachment` → Download

---

## ⚡ RATE LIMITING

### **`rateLimit.ts`**

**Limiters**:
```typescript
// Login attempts
loginLimiter: 5 requests / 15 minutes

// Email operations
emailLimiter: 10 requests / 1 minute

// Payment operations
paymentLimiter: 20 requests / 1 minute
```

**Implementation**: `express-rate-limit` middleware

---

## 🔔 EVENT SYSTEM

### **`eventService.ts` + Socket.io**

**Events Emitted**:
```typescript
'invoice.created' → {invoice}
'invoice.updated' → {invoice}
'payment.created' → {payment, invoice}
'payment.deleted' → {paymentId, invoiceId}
'permissions.updated' → {roleId, updatedPermissions}
```

**Usage**: Real-time UI updates without polling

---

## 🛡️ VALIDATION RULES

### **Invoice Validation**:
- ❌ Cannot update cancelled invoices
- ❌ Cannot manually change status
- ❌ Cannot reduce total below received payments
- ❌ Draft cannot receive payments (must finalize first)

### **Payment Validation**:
- ✅ Amount must be > 0
- ✅ Cannot exceed remaining balance (+ 0.01 tolerance)
- ❌ Cannot add to draft or cancelled invoices

### **Delete Validation**:
- **Buyer**: Check for related invoices
- **Supplier**: Check for related products AND invoices
- **Product**: Check for related invoice items

---

## 📊 RESPONSE FORMATS

### **Pagination** (ONLY for Users):
```json
{
  "items": [...],
  "total": 100,
  "page": 1,
  "pageSize": 10
}
```

### **Plain Arrays** (Products, Buyers, Suppliers, Proforma):
```json
[...items]
```

### **Success Responses**:
```json
{ok: true}  // For DELETE operations
entity      // For CREATE/UPDATE (return entity directly)
```

---

## 🔧 UTILITY SERVICES

### **1. Email Service** (`emailService.ts`)
- **Provider**: Nodemailer
- **Transport**: SMTP (from env variables)
- **Templates**: Invoice emails, reminders
- **Attachments**: PDF invoices

### **2. Reminder Service** (`reminderService.ts`)
- **Track**: Invoice reminder history
- **Bulk**: Send reminders to overdue invoices
- **Storage**: `invoiceReminder` table

### **3. Round-off Config** (`roundOffConfig.ts`)
```typescript
roundToTwoDecimals(num) => Math.round(num * 100) / 100
```

---

## 📜 MAINTENANCE SCRIPTS

### **`scripts/` directory**:
1. **recalculateInvoiceStatuses.ts**: Bulk recalculate all
2. **verifyInvoiceStatus.ts**: Audit status correctness
3. **markAllInvoicesPaid.ts**: Test script
4. **deleteUnpaidInvoices.ts**: Cleanup script

---

## 🎯 CRITICAL IMPLEMENTATION PATTERNS

### **Pattern 1: Transaction + Dual Recalculate**
```typescript
await prisma.$transaction(async (tx) => {
  await createPayment(tx)
  await recalculateStatus(id, {skipEmit: true, transaction: tx})
})
await recalculateStatus(id) // Emit event
```

### **Pattern 2: Invoice Number Generation**
```typescript
where: {
  invoiceNo: {startsWith: prefix},
  status: {not: 'Draft'}  // Exclude drafts!
}
orderBy: {createdAt: 'desc'}
```

### **Pattern 3: Status Preservation**
```typescript
if (status === 'Draft' || status === 'Cancelled') {
  return; // Never auto-recalculate
}
```

### **Pattern 4: Tolerance for Rounding**
```typescript
if (balance > 0.01) {
  status = 'Partial';
} else {
  status = 'Paid';
  balance = 0; // Exactly zero
}
```

---

## 📌 KEY DIFFERENCES FROM TYPICAL REST APIs

1. **No pagination** for most resources (except Users)
2. **String identifiers** for invoices (`:invoiceNo` not `:id`)
3. **Transaction-based** status calculation
4. **Dual emit pattern** (skipEmit + emit)
5. **Status is derived**, never manually set
6. **Draft status preserved** until explicit finalization

---

## ✅ PARITY CHECKLIST FOR NESTJS

- [ ] All 63 routes implemented
- [ ] Invoice number generation excludes drafts
- [ ] Finalization changes invoice number
- [ ] Transaction + dual recalculate pattern
- [ ] Payment overpayment validation
- [ ] Status preservation (Draft/Cancelled)
- [ ] Rate limiting (login, email, payment)
- [ ] PDF generation with PDFKit
- [ ] Socket.io event emission
- [ ] Permission-based authorization
- [ ] Plain arrays (not paginated) for most resources
- [ ] String invoiceNo parameters
- [ ] Rounding to 2 decimals
- [ ] Foreign key validation on deletes

---

*Generated from backend-v2 codebase analysis*  
*For NestJS implementation reference*  
*Maintain 100% functional parity*
