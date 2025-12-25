# Application User Flow Documentation

## Document Information

**System Name**: Business Management System (ERP)  
**Document Version**: 1.0  
**Last Updated**: 2025-12-25  
**Purpose**: Complete user workflow documentation for all pages and features

---

## 1. Authentication and Access Flow

### 1.1 Login Process

**Initial State**:
- User lands on login page at `/login`
- Login form displays with email and password fields
- Demo credentials are shown below the form for testing purposes

**User Actions**:
1. User enters email and password
2. User clicks "Sign in" button
3. System validates credentials against backend API
4. System stores JWT token and user object in localStorage

**Post-Login Behavior**:
- If credentials are valid:
  - User object contains: email, role (SuperAdmin/Admin/Employee), permissions array
  - If user has `mustChangePassword` flag set to true:
    - System redirects to `/change-password` page
    - User must change password before accessing system
  - If user does not need to change password:
    - System redirects to `/dashboard` or previously attempted route
- If credentials are invalid:
  - Error message displays: "Invalid credentials. Please try again."
  - User remains on login page

**Available Test Credentials**:
- SuperAdmin: `superadmin@ems.com` / `Super@123`
- Admin: `admin@ems.com` / `Admin@123`
- Employee: `employee@ems.com` / `Emp@123`

### 1.2 Role Detection and Permission Loading

**System Behavior After Login**:
1. User role is extracted from JWT token
2. User permissions are loaded from user object
3. Frontend permission system activates
4. Navigation menu visibility is controlled by permissions
5. Page access is protected by ProtectedRoute component

**Permission Structure**:
- Permissions are strings in format: `resource.action`
- Examples: `user.create`, `invoice.update`, `buyer.delete`
- SuperAdmin has implicit access to all permissions
- Admin and Employee have explicit permission lists

---

## 2. Dashboard Page Flow

### 2.1 Initial Page Load

**What User Sees**:
- Six summary cards displaying system metrics:
  - Total Users count
  - Suppliers count
  - Buyers count
  - Products count
  - Invoices (Draft) count
  - Invoices (Completed) count
- Period selector dropdown (defaulted to "This Month")
- Total Revenue display (calculated from selected period)
- Sales Analytics area chart showing last 12 months revenue
- Two report quick-action buttons
- Recent Products table

### 2.2 Period Selector Behavior

**Available Options**:
- This Week
- This Month (default)
- Last Month
- Quarter (3 Months)
- This Year

**When User Changes Period**:
1. System makes API call to `/stats?period={selected_period}`
2. All metrics update based on new period
3. Revenue chart data refreshes
4. Total Revenue recalculates

### 2.3 Report Buttons

**Sale Report Button**:
- Navigates to Invoices page with date filters applied
- Automatically calculates start date based on selected period
- URL format: `/invoices?status=all&from=YYYY-MM-DD&to=YYYY-MM-DD`

**Daybook Report Button**:
- Navigates to Invoices page filtered to today's date only
- URL format: `/invoices?from=YYYY-MM-DD&to=YYYY-MM-DD&report=daybook`

### 2.4 Recent Products Display

**Table Shows**:
- Product Title
- Supplier Name (or "-" if not assigned)
- Price (formatted as INR currency)
- Stock count with color coding:
  - Green background: stock > 50
  - Yellow background: stock 10-50
  - Red background: stock < 10
- Creation date (formatted as DD/MM/YYYY)

---

## 3. Users Page Flow

### 3.1 Page Load Behavior

**Initial Display**:
- Summary cards showing:
  - Total Users count
  - Active Users count
  - Admin count
  - Employee count
- Search and filter bar
- DataTable with user listing
- "Create User" button (visible only if user has `user.create` permission)

### 3.2 User Listing Table

**Columns Displayed** (all left-aligned):
- Name (sortable)
- Email (sortable)
- Role (sortable, displays as badge: SuperAdmin/Admin/Employee)
- Status (sortable, shows Active/Inactive badge)
- Created At (sortable, formatted date)
- Actions (Edit/Delete buttons based on permissions)

**Sorting Behavior**:
- Click column header to sort ascending
- Click again to sort descending
- Click third time to remove sorting
- Only one column can be sorted at a time

**Search Behavior**:
- User can search by: name, email
- Search is case-insensitive
- Results filter in real-time as user types

### 3.3 Permission-Based Actions

**If User Has `user.create` Permission**:
- "Create User" button is visible
- Clicking opens user creation modal or navigates to `/users/new`

**If User Has `user.update` Permission**:
- Edit button (pencil icon) appears in Actions column
- Clicking navigates to `/users/{id}/edit`

**If User Has `user.delete` Permission**:
- Delete button (trash icon) appears in Actions column
- Clicking shows confirmation dialog
- Confirming sends DELETE request to backend

**If User Lacks Permissions**:
- Corresponding buttons are hidden
- No placeholders or disabled states shown
- Table remains functional for viewing

### 3.4 User Creation Flow

**When Creating User**:
1. User fills form with: name, email, password, role
2. Role dropdown shows: SuperAdmin, Admin, Employee
3. User can assign permissions if role is Admin or Employee
4. SuperAdmin role does not require explicit permissions
5. On save, backend creates user and returns created object
6. Page redirects to users list with success message

### 3.5 User Edit Flow

**When Editing User**:
1. System loads existing user data into form
2. Email field is typically read-only (depends on implementation)
3. User can change: name, role, password (optional), permissions
4. Permission checkboxes update based on role selection
5. Saving sends PUT request to `/users/{id}`
6. Page redirects to users list after successful update

---

## 4. Roles and Permissions Page Flow

### 4.1 Roles Page

**Initial Display**:
- Summary cards:
  - Total Roles count
  - Active Roles count
- DataTable showing all roles
- "Create Role" button (if user has `role.create` permission)

**Role Listing Columns**:
- Name (sortable, left-aligned)
- Description (left-aligned)
- Users Count (center-aligned, shows number of users with this role)
- Created At (sortable, left-aligned)
- Actions (Edit/Delete buttons)

**Role Creation**:
1. User clicks "Create Role"
2. Form opens with fields: name, description
3. After creating role, user can navigate to permissions assignment
4. URL: `/roles/{id}/edit` or `/roles/{id}/permissions`

### 4.2 Permissions Page

**What User Sees**:
- Complete list of all system permissions
- Permissions grouped by resource (users, buyers, suppliers, products, invoices, etc.)
- Each permission shows: resource, action (create/read/update/delete)
- Search bar to filter permissions by name

**Permission Categories**:
- User Management: user.create, user.read, user.update, user.delete
- Buyer Management: buyer.create, buyer.read, buyer.update, buyer.delete
- Supplier Management: supplier.create, supplier.read, supplier.update, supplier.delete
- Product Management: product.create, product.read, product.update, product.delete
- Invoice Management: invoice.create, invoice.read, invoice.update, invoice.delete
- Role Management: role.create, role.read, role.update, role.delete
- Permission Management: permission.create, permission.read, permission.update, permission.delete

**Permission Assignment Flow**:
1. Admin navigates to role edit page
2. Checkboxes appear next to each permission
3. Admin selects/deselects permissions
4. Changes save to database
5. Users with that role immediately gain/lose access

**Real-Time Effect**:
- When permissions change for a role, all users with that role are affected
- Users currently logged in will see changes after next page load or token refresh
- No logout required for permission updates to take effect

---

## 5. Buyers Page Flow

### 5.1 Initial Display

**Summary Cards Show**:
- Total Buyers count
- Active Buyers count
- Archived Buyers count

**Search and Filter Bar**:
- Search input: searches by name, email, phone
- Filter results update in real-time

**Buyer Table Columns** (all left-aligned):
- Name (sortable, clickable link to buyer ledger)
- Email (sortable)
- Phone (sortable)
- Address (displays full 7-field address: line1, line2, area, city, state, country, postal code)
- Created At (sortable, formatted date)
- Actions (Edit/Archive/Delete buttons)

### 5.2 Buyer Name Link Behavior

**When User Clicks Buyer Name**:
- System navigates to `/buyers/{id}`
- BuyerLedger page opens
- Shows buyer's complete transaction history:
  - All invoices for this buyer
  - Payment records
  - Outstanding balance
  - Transaction ledger with tabs

### 5.3 Address Display Rules

**Full Address Format**:
```
{addressLine1}, {addressLine2}
{area}, {city}
{state}, {country} - {postalCode}
```
- If addressLine2 is empty, it is omitted
- All fields displayed in single table cell with line breaks

### 5.4 Buyer Actions

**Create Buyer**:
- Button visible if user has `buyer.create` permission
- Opens creation form with fields: name, email, phone, GSTIN, and 7 address fields
- All fields required except addressLine2 and GSTIN
- On save, buyer added to list

**Edit Buyer**:
- Pencil icon visible if user has `buyer.update` permission
- Opens edit form with pre-filled data
- User can modify all fields
- Saving updates buyer record

**Archive Buyer**:
- Archive button appears for active buyers
- Clicking archives the buyer (soft delete)
- Archived buyers can be filtered and restored

**Delete Buyer**:
- Trash icon visible if user has `buyer.delete` permission
- Confirmation dialog appears before deletion
- Hard delete removes buyer permanently

### 5.5 Buyer Ledger Flow

**Ledger Page Tabs**:
- Ledger: Complete transaction history with running balance
- Invoices: All invoices for this buyer (with status badges)
- Payments: All payment records against invoices

**Ledger Tab Shows**:
- Date, Description, Invoice Number
- Debit (invoice amount), Credit (payment amount)
- Running Balance
- Color coding: red for debit, green for credit

---

## 6. Suppliers Page Flow

### 6.1 Supplier Listing

**Summary Cards**:
- Total Suppliers count
- Active Suppliers count

**Table Columns** (all left-aligned):
- Name (sortable)
- Email (sortable)
- Phone (sortable)
- City (sortable)
- State (sortable)
- Created At (sortable)
- Actions (Edit/Delete buttons)

### 6.2 City and State Display Logic

**How Address is Shown**:
- Only city and state are displayed in main table (not full address)
- Full address available in edit/detail view
- Format: "{city}, {state}"

### 6.3 Supplier-Product Association

**When Viewing Suppliers**:
- Table does not show product count in main view
- Product association is visible when creating/editing products
- Products can be linked to suppliers via supplier selection dropdown

**When Creating Product**:
- User selects supplier from dropdown
- Supplier list populated from all active suppliers
- Product is then associated with selected supplier

---

## 7. Products Page Flow

### 7.1 Initial Display

**Summary Cards Show**:
- Total Products count
- Total Stock (sum of all product stock)
- Low Stock count (products with stock < threshold)
- Out of Stock count (products with stock = 0)

**Search Functionality**:
- Search bar searches by: SKU, product title, price
- Case-insensitive search
- Real-time filtering

**Table Columns** (mixed alignment):
- SKU (left-aligned, sortable)
- Title (left-aligned, sortable)
- Category (left-aligned, sortable)
- Supplier (left-aligned, shows supplier name or "-")
- Price (right-aligned, sortable, formatted as INR)
- Stock (center-aligned, sortable, color-coded badge)
- Actions (center-aligned, Edit/Delete buttons)

### 7.2 Stock Visibility and Color Coding

**Stock Display Logic**:
- High stock (> 50): Green badge
- Medium stock (10-50): Yellow badge
- Low stock (< 10): Red badge
- Out of stock (0): Red badge with "Out of Stock" text

**Stock Count Interpretation**:
- Stock is a simple integer count
- No units shown (assumes pieces)
- Can be edited to any positive integer

### 7.3 Sorting Behavior

**How Sorting Works**:
- Click column header once: Sort ascending
- Click again: Sort descending
- Click third time: Remove sort, return to default order
- Visual indicator (arrow icon) shows current sort state
- Only one column sorted at a time

### 7.4 Product Creation Flow

**Create Product Form Fields**:
1. SKU (text, required, unique)
2. Title (text, required)
3. Description (textarea, optional)
4. Category (text, optional)
5. Supplier (dropdown, optional, select from existing suppliers)
6. Price (number, required, formatted as INR)
7. Stock (number, required, default 0)
8. HSN Code (text, optional, for GST)
9. Tax Type (radio: With Tax / Without Tax)
10. Tax Rate (number, shown only if "With Tax" selected, default 18%)

**On Save**:
- Backend validates SKU uniqueness
- Product created and added to list
- User redirected to products page

---

## 8. Invoice Creation Flow

### 8.1 Step-by-Step Creation Process

**Step 1: Initial Page Load**
- System fetches next available invoice number from backend
- Invoice number displayed in header (read-only)
- All form fields empty
- Product selection dropdown loads all products

**Step 2: Select Customer (Buyer)**
- User clicks buyer selection dropdown
- Dropdown shows all active buyers with name and email
- User selects buyer
- Selected buyer's address and GSTIN display in form
- Tax calculation mode determined by buyer's state vs seller's state

**Step 3: Set Invoice Details**
- Invoice Date (date picker, defaults to today)
- Due Date (date picker, must be >= Invoice Date)
- Delivery Date/Time (optional datetime picker)
- Payment Time (optional time picker)
- Reference Number (optional text field)

**Step 4: Add Products**

**Product Selection Behavior (Enhanced)**:
- Product search dropdown displays all products
- User can search by product name or SKU
- User can scan barcode (barcode scanners send product SKU + Enter key)
- Quantity input field defaults to 1

**When User Selects a Product**:
1. System checks if product already exists in items table
2. If product exists:
   - Quantity is incremented by selected amount
   - No duplicate row created
   - Totals recalculate automatically
3. If product does NOT exist:
   - New row added to invoice items table
   - Product details populated: title, price, HSN code, tax rate

**After Adding Product**:
- Product disappears from selection dropdown immediately
- Prevents accidental duplicate additions
- Product reappears if row is deleted

**Invoice Items Table Shows**:
- HSN Code (left-aligned, editable)
- Product Name (left-aligned, editable text)
- Quantity (center-aligned, editable number, min 1)
- Unit Price (right-aligned, editable number)
- Discount % (right-aligned, editable number, 0-100)
- Tax Rate % (right-aligned, editable number)
- Total (right-aligned, auto-calculated, read-only)
- Delete button (removes row, restores product to dropdown)

**Calculation Logic**:
- Line Total = Quantity × Unit Price × (1 - Discount/100) × (1 + Tax/100)
- Subtotal = Sum of (Quantity × Unit Price × (1 - Discount/100)) for all items
- Tax Amount = Sum of tax portions for all items
- Tax Type:
  - If buyer state = Gujarat (seller state): CGST + SGST (tax split 50/50)
  - If buyer state ≠ Gujarat: IGST (full tax amount)
- Grand Total = Subtotal + Tax Amount

**Step 5: Optional Sections**

**Extra Charges (Collapsible)**:
- User can add delivery fees, handling charges, etc.
- Each charge has: name, amount
- Charges added to grand total

**Notes (Collapsible)**:
- Free-text field for invoice notes
- Saved with invoice

**Signature Upload**:
- User can upload signature image
- Image stored and displayed on invoice PDF

**Step 6: Payment Entry (Optional)**

**Payment Panel Shows**:
- Grand total amount
- Payment entry fields can be added
- Each payment has: amount, payment mode (Cash/Card/UPI/etc.), note
- Multiple payments can be added
- Total received amount calculated
- Balance displayed (Grand Total - Total Received)

**Step 7: Save Options**

**Three Save Buttons Available**:

1. **Save as Draft**:
   - Saves invoice with status "Draft"
   - Validation relaxed: items and dates not required
   - Can be edited later
   - Does not affect inventory or accounting

2. **Save & Print**:
   - Saves invoice with status "Processing"
   - Full validation applied
   - Redirects to print preview page
   - Invoice PDF generation triggered

3. **Save Invoice**:
   - Saves invoice with status "Processing" or "Completed" based on payment
   - Full validation applied
   - Redirects to invoices list page

### 8.2 Quantity Handling Rules

**Incrementing Quantity**:
- If product already in table, selecting it again adds to existing quantity
- Example: Product A at qty 2, user adds qty 3 → final qty becomes 5
- No manual merging required

**Quantity Limits**:
- Minimum: 1 (enforced by input field)
- Maximum: No limit enforced (user responsible for stock management)
- Can manually edit quantity in table after adding

### 8.3 Price Calculation Flow

**How Prices Work**:
1. Product added with default price from product master
2. User can override unit price in table
3. Discount applied as percentage
4. Tax applied based on product tax configuration
5. If product has "With Tax" flag:
   - Tax rate defaults from product (usually 18%)
   - User can override tax rate
6. If product has "Without Tax" flag:
   - Tax rate defaults to 0%

**Tax Calculation Example**:
- Product: ₹1000, Qty: 2, Discount: 10%, Tax: 18%
- Subtotal: 2 × 1000 × (1 - 0.10) = ₹1800
- Tax: 1800 × 0.18 = ₹324
- Line Total: 1800 + 324 = ₹2124

### 8.4 Save vs Finalize Behavior

**Draft Status**:
- Invoice number reserved but not finalized
- Can be edited freely
- Does not appear in reports
- No accounting impact

**Processing Status**:
- Invoice finalized
- Can still be edited (depending on permissions)
- Appears in sales reports
- Partial payments allowed

**Completed Status**:
- Invoice fully paid
- Balance = 0
- Edit restrictions may apply
- Appears in completed invoices filter

---

## 9. Invoice Edit Flow

### 9.1 Loading Existing Invoice

**When User Opens Edit Page** (`/invoices/{invoiceNo}/edit`):
1. System loads invoice data from backend
2. All fields populated with existing values:
   - Buyer information
   - Invoice dates
   - Existing items table
   - Payment records
   - Notes and signature
3. Product selection dropdown excludes already-added products
4. Same duplicate prevention logic applies as create flow

### 9.2 Product Quantity Update Logic

**When Editing Existing Invoice**:
- User can change quantity directly in table (inline editing)
- User can select same product from dropdown to increment quantity
- User can delete rows to remove products
- Deleting row makes product available in dropdown again
- All totals recalculate automatically on any change

### 9.3 Restrictions on Finalized Invoices

**Edit Permissions**:
- SuperAdmin can edit any invoice
- Users with `invoice.update` permission can edit
- Users without permission see view-only mode

**Status-Based Restrictions**:
- Draft invoices: Fully editable
- Processing invoices: Editable but with warnings
- Completed invoices: Edit may be restricted or logged

**Cannot Be Edited**:
- Invoice number (always read-only)
- Payment records directly (must use payment flow)
- Finalized status (cannot revert to draft)

### 9.4 Status Recalculation

**How Status Updates**:
- System recalculates balance after edit
- If balance > 0 and previous status was "Completed":
  - Status may change to "Processing" or "Partial"
- If balance = 0:
  - Status automatically becomes "Completed"
- Status changes happen on backend based on payment amount

---

## 10. Proforma Invoice Flow

### 10.1 Proforma vs Regular Invoice

**Key Differences**:
- Proforma Invoice is a quotation/estimate
- Does NOT affect inventory or accounts
- Does NOT generate revenue
- Status: Draft or Converted
- Can be converted to regular invoice

### 10.2 Proforma Creation Process

**Similar to Invoice Creation**:
1. Select buyer
2. Set proforma date
3. Set validity date (optional, quote expiry)
4. Add products (same table structure as invoice)
5. Add terms and conditions (optional text)
6. Add signature
7. Save

**Unique Fields**:
- Proforma Date (instead of Invoice Date)
- Valid Till (quote expiration date)
- Terms (payment/delivery terms as text)
- Status: "Draft" or "Converted"

### 10.3 Product Handling in Proforma

**Same Logic as Invoices**:
- Product selection dropdown filters already-added products
- Selecting existing product increments quantity
- Duplicate prevention enforced
- Product disappears from dropdown after adding
- Deleting row restores product to dropdown

**Calculation Rules**:
- Same tax calculation as invoices
- Same discount application
- Extra charges can be added
- Totals calculated identically

### 10.4 Conversion to Invoice

**When Converting Proforma to Invoice**:
1. User clicks "Convert to Invoice" button on proforma detail page
2. System creates new invoice copying all proforma details:
   - Buyer
   - Products and quantities
   - Prices and discounts
   - Tax rates
   - Notes
3. New invoice number generated
4. Proforma status changes to "Converted"
5. Link maintained between proforma and invoice
6. User redirected to new invoice edit page

**Converted Proforma Restrictions**:
- Cannot be edited after conversion
- Status permanently set to "Converted"
- Original proforma record maintained for reference

---

## 11. Payments Flow

### 11.1 Adding Payment to Invoice

**Payment Entry Points**:
1. During invoice creation (Payment Panel)
2. During invoice edit (Payment Panel)
3. From invoices list (Payment icon button)
4. From buyer ledger (Pay button)

**Payment Form Fields**:
- Amount (number, max = outstanding balance)
- Payment Mode (dropdown: Cash, Card, UPI, Bank Transfer, Cheque, Other)
- Payment Note (optional text)
- Round Off (optional number for cash rounding)

### 11.2 Partial vs Full Payment Logic

**Payment Validation**:
- Payment amount cannot exceed outstanding balance
- Payment amount must be > 0
- Multiple partial payments allowed
- System tracks all payments against invoice

**Balance Calculation**:
- Outstanding Balance = Grand Total - Sum of All Payments
- Balance displayed in real-time
- Color coding: Green if fully paid, Amber if partial, Red if unpaid

**Status Update After Payment**:
- If balance > 0: Status = "Processing" or "Partial"
- If balance = 0: Status = "Completed"
- If overpayment: Error message (not allowed)

### 11.3 Payment Status Updates

**Status Badge Colors**:
- Draft: Gray badge
- Processing: Yellow badge
- Partial: Orange badge
- Completed: Green badge
- Unpaid: Red badge

**Invoice List Filtering by Status**:
- User can filter invoices by status using dropdown
- Options: All, Draft, Processing, Partial, Completed
- Filter updates list immediately

### 11.4 Restrictions on Draft Invoices

**Payment Rules for Draft Invoices**:
- Payments CANNOT be added to draft invoices
- Payment panel disabled or hidden
- User must finalize invoice first (save as Processing)
- Error message shown if attempted: "Cannot add payment to draft invoice"

### 11.5 Payment Records Page

**What User Sees**:
- Summary cards:
  - Total Payments count
  - Total Amount Received
  - Today's Payments count
  - Pending Payments
- Complete payment history table
- Columns: Payment Date, Invoice No, Buyer Name, Amount, Payment Mode, Status
- Search and filter functionality
- Pagination

---

## 12. Global Table Behavior (Common Across Pages)

### 12.1 DataTable Component Behavior

**Used On Pages**:
- Users, Roles, Permissions
- Buyers, Suppliers, Products
- Invoices, Proforma Invoices
- Payment Records, Orders

**Standard Features**:
1. Sortable columns (click header to sort)
2. Search/filter bar above table
3. Pagination controls below table
4. Rows per page selector (5, 10, 25, 50, 100)
5. Page indicator showing "Page X of Y"
6. Navigation buttons: First (<<), Previous (<), Next (>), Last (>>)

### 12.2 Sorting Behavior Rules

**Consistent Across All Tables**:
- Click column header: Sort ascending
- Click again: Sort descending
- Click third time: Remove sort
- Arrow icon indicates sort direction (up/down)
- Only one column sorted at a time
- Sorting is client-side (all data loaded, then sorted)

**Sort Icon Shown When**:
- Column is currently sorted
- Hover over sortable column header

### 12.3 Search Behavior

**How Search Works**:
- Search input above table
- Searches across multiple fields (varies by page)
- Case-insensitive matching
- Partial match supported (substring search)
- Updates results in real-time (no search button needed)
- Cleared by clicking X icon in search field

**What Gets Searched** (page-specific):
- Users: name, email
- Buyers: name, email, phone
- Suppliers: name, email, phone
- Products: SKU, title, price (as text)
- Invoices: invoice number, buyer name

### 12.4 Alignment Consistency

**Left-Aligned Columns**:
- Text fields: names, emails, addresses, descriptions
- IDs and codes: SKU, invoice numbers
- Dates (formatted text)

**Right-Aligned Columns**:
- Numeric values: prices, amounts, totals
- Currency values (INR formatted)
- Percentages

**Center-Aligned Columns**:
- Status badges
- Stock counts (in colored badges)
- Action buttons
- Small icons

### 12.5 Action Column Behavior

**Standard Actions Available**:
- View (eye icon): Open detail page
- Edit (pencil icon): Open edit form/page
- Delete (trash icon): Delete record with confirmation
- Archive (archive icon): Soft delete (some pages)
- Custom actions (page-specific)

**Action Button Display Rules**:
- Buttons only shown if user has permission
- Hidden completely (not disabled) if permission lacking
- Hover shows tooltip with action name
- Confirmation modal shown before destructive actions

### 12.6 Pagination Behavior

**Pagination Layout** (Bottom of Table):
```
Rows per page: [10 ▼]          Page 1 of 5  [<<][<][>][>>]
^LEFT SIDE                                         ^RIGHT SIDE
```

**Left Side**:
- "Rows per page:" label
- Dropdown with options: 5, 10, 25, 50, 100
- Default: 10 rows per page

**Right Side**:
- Page indicator: "Page X of Y"
- First page button (<<): Jumps to page 1
- Previous page (<): Goes back one page
- Next page (>): Goes forward one page
- Last page (>>): Jumps to last page

**Pagination Logic**:
- When changing rows per page, resets to page 1
- Disabled buttons (gray, not clickable) when at first/last page
- Total pages calculated as: ceil(total records / page size)
- Client-side pagination (all data loaded, then paginated)

---

## 13. Permission Enforcement Flow

### 13.1 Backend Permission Evaluation

**How Backend Checks Permissions**:
1. Request arrives with JWT token
2. Token decoded to extract user ID and role
3. User's permissions loaded from database
4. If user is SuperAdmin: All permissions granted automatically
5. If user is Admin or Employee: Check permission array
6. Permission format: `resource.action` (e.g., `buyer.create`)
7. If permission exists: Allow action
8. If permission missing: Return 403 Forbidden error

**Backend Endpoints Protection**:
- All CRUD endpoints protected by permission guards
- GET requests: require `resource.read`
- POST requests: require `resource.create`
- PUT/PATCH requests: require `resource.update`
- DELETE requests: require `resource.delete`

### 13.2 Frontend UI Enable/Disable Behavior

**Permission Check Locations**:
1. Navigation menu items (show/hide based on read permission)
2. Create buttons (show only if create permission)
3. Edit buttons in tables (show only if update permission)
4. Delete buttons in tables (show only if delete permission)
5. Form submit buttons (enable/disable based on permission)

**UI Patterns**:
- Elements are HIDDEN (not just disabled) if permission lacking
- No visual clue that feature exists
- No "you don't have permission" tooltips on hidden elements
- Clean UI without permission indicators

**Example Permission Checks**:
```
// User Create Button
if (canCreate('user')) {
  // Show button
} else {
  // Do not render button at all
}
```

### 13.3 Real-Time Permission Updates

**How Permission Changes Propagate**:
1. Admin changes user's role or permissions in backend
2. Change saved to database
3. User currently logged in does NOT see changes immediately
4. Changes take effect:
   - On next page load/refresh
   - After token refresh (if implemented)
   - After user logs out and logs back in

**No Real-Time WebSocket Updates**:
- System does not push permission changes via WebSocket
- User must perform action to refresh token/session
- Safe approach prevents mid-session permission confusion

### 13.4 Role Hierarchy Behavior

**SuperAdmin**:
- Has ALL permissions implicitly
- Can create, read, update, delete everything
- Can manage users, roles, permissions
- Cannot be deleted or downgraded by other users
- Hardcoded bypass for permission checks

**Admin**:
- Has permissions explicitly assigned via role
- Typically has broad permissions but not SuperAdmin level
- Can manage users and inventory if granted permissions
- Cannot modify SuperAdmin users
- Cannot grant permissions they don't have

**Employee**:
- Has minimal permissions explicitly assigned
- Typically read-only or limited write access
- Cannot access user management (unless explicitly granted)
- Cannot modify roles or permissions
- Can view and create invoices if granted permission

---

## 14. Error Handling and Validation Flow

### 14.1 Common User Errors

**Empty Required Fields**:
- Form validation prevents submission
- Red border appears on invalid fields
- Error message displays below field: "{Field name} is required"
- Submit button remains enabled but triggers validation on click

**Invalid Data Format**:
- Email validation: Must contain @ and domain
- Phone validation: Numeric only (depends on field)
- Date validation: Due date cannot be before invoice date
- Number validation: Price and quantity must be positive

**Duplicate Entries**:
- SKU must be unique across products
- Email must be unique across users
- Backend returns 409 Conflict error
- Frontend shows: "SKU already exists. Please use a different SKU."

**Permission Denied Errors**:
- If user tries to access restricted page via URL
- System redirects to dashboard or shows 403 error page
- Message: "You do not have permission to access this page"
- User is not logged out

**Network Errors**:
- If API call fails due to network issue
- Error message: "Network error. Please check your connection."
- User can retry action
- Loading indicator disappears

### 14.2 Validation Messages

**Field-Level Validation**:
- Displayed immediately below invalid field
- Red text color
- Clear, actionable message
- Example: "Email must be in valid format (e.g., user@example.com)"

**Form-Level Validation**:
- Displayed at top of form in red box
- Lists all validation errors
- Example: "Please fix the following errors: Email is required, Password is too short"

**Success Messages**:
- Displayed as toast/notification (green)
- Auto-dismiss after 3-5 seconds
- Example: "User created successfully"

**Error Messages from Backend**:
- Displayed at top of form or as toast (red)
- Show backend error message verbatim
- Example: "Failed to create user: Email already exists"

### 14.3 Access Denial Behavior

**When User Lacks Permission**:
1. User tries to access restricted page
2. ProtectedRoute component checks permissions
3. If permission missing:
   - User redirected to `/dashboard` with error message
   - Or 403 error page shown (depends on implementation)
   - Message: "Access denied. You don't have permission to view this page."
4. User is NOT logged out
5. Can navigate to allowed pages normally

**When API Returns 403**:
- Error toast displays: "Permission denied"
- User remains on current page
- Form submission fails
- No data changed

**When Token Expires**:
- API returns 401 Unauthorized
- User redirected to `/login`
- Current page URL saved to redirect back after login
- Message: "Session expired. Please log in again."

---

## 15. Footer and Global Layout Flow

### 15.1 Footer Visibility

**Footer Component Location**:
- Appears at bottom of all authenticated pages
- Fixed to bottom (sticky footer) or flows with content (depends on implementation)
- Not shown on login page

**Footer Content**:
- Copyright text: "© 2024 Business Management System. All rights reserved."
- Company name or branding
- Links to privacy policy, terms of service (if implemented)
- Version number (if displayed)

### 15.2 Copyright Behavior

**Copyright Display Rules**:
- Static text, does not change based on user
- Year may be dynamic (current year from JavaScript)
- Format: "© {Year} {Company Name}"
- Always visible in footer

### 15.3 Global Consistency Rules

**Layout Structure** (on all pages):
1. Top: Topbar (navigation, user menu, logout)
2. Left: Sidebar (navigation menu)
3. Center: Main content area (page-specific)
4. Bottom: Footer

**Topbar Elements**:
- Company logo/name (left)
- Breadcrumb or page title (center)
- User email and role display (right)
- Logout button (right)
- Help/settings icons (if implemented)

**Sidebar Navigation**:
- Dashboard link (always visible)
- Users, Roles, Permissions (if has read permission)
- Buyers, Suppliers (if has read permission)
- Products (if has read permission)
- Invoices, Proforma Invoices (if has read permission)
- Payments (if has read permission)
- Orders (if has read permission)
- Settings (if implemented)

**Active Page Indicator**:
- Current page link highlighted in sidebar (blue background)
- Other links: gray text, hover shows blue
- Icons change color with active state

**Logout Flow**:
1. User clicks logout button
2. Confirmation dialog may appear (optional)
3. Token removed from localStorage
4. User object removed from localStorage
5. User redirected to `/login`
6. Session ended, cannot access authenticated pages

---

## 16. Additional Workflows

### 16.1 Orders Page Flow

**Similar to Invoices**:
- Summary cards: Total Orders, Total Amount, Processing, Completed
- DataTable with sortable columns
- Columns: Invoice No, Date, Status, Total, Actions
- Status badges with color coding
- Pagination at bottom

**Order Status Logic**:
- Draft: Not yet processed
- Processing: In progress
- Completed: Fulfilled and delivered
- Cancelled: Cancelled (if implemented)

**Actions Available**:
- View PDF: Opens invoice PDF
- Edit: Opens edit page (for drafts)
- Mark as Completed (if has permission)

### 16.2 Proforma List Page Flow

**Summary Cards**:
- Total Proformas
- Total Amount
- Draft Count
- Converted Count

**Table Columns**:
- Proforma No, Buyer, Date, Status, Amount, Actions

**Status Types**:
- Draft: Not yet finalized
- Converted: Converted to invoice (shows linked invoice number)

**Actions**:
- View: Opens proforma detail page
- Edit: Opens edit page (only for drafts)
- Convert: Converts to invoice (only for drafts)
- Delete: Removes proforma (only for drafts)

---

## 17. Advanced Features

### 17.1 Barcode Scanning

**How It Works**:
- Barcode scanner connected to computer acts as keyboard input
- Scans product SKU and sends it followed by Enter key
- Product search field detects Enter key press
- Searches for product by exact SKU match
- If found, adds product to invoice automatically
- If not found, shows error: "Product not found"

**User Experience**:
1. User focuses on product search field
2. User scans barcode with scanner
3. Product auto-added to invoice
4. Search field clears
5. Ready for next scan
6. Quantity defaults to 1 (can be changed before scanning)

### 17.2 Invoice PDF Generation

**When PDF is Generated**:
- User clicks "Save & Print" button
- User clicks "View PDF" from invoice list
- User selects "Print" option from invoice detail page

**PDF Content**:
- Company header with logo and address
- Invoice number and date
- Buyer details (name, address, GSTIN)
- Invoice items table (HSN, name, qty, price, tax, total)
- Tax breakdown (CGST/SGST or IGST)
- Grand total with words
- Payment details (if payments exist)
- Notes (if added)
- Signature (if uploaded)
- Footer with terms and conditions

**PDF Behavior**:
- Opens in new browser tab
- Can be printed or saved
- Not editable
- Backend generates using PDF library

### 17.3 Search with Autocomplete

**Product Search in Invoice Creation**:
- Dropdown shows all products initially
- User types to filter products
- Results update in real-time
- Displays: Product name, SKU, price, stock
- User can click or press Enter to select
- Supports keyboard navigation (arrow keys)

**Buyer/Supplier Selection**:
- Similar autocomplete behavior
- Shows name and email in dropdown
- Filtered as user types
- Can scroll through results
- Click to select

---

## 18. System-Wide Rules

### 18.1 Date and Time Handling

**Date Format**:
- Display: DD/MM/YYYY (Indian format)
- Input: Date picker (calendar widget)
- API: YYYY-MM-DD (ISO format)
- Timezone: Server timezone used

**Time Format**:
- Display: 12-hour with AM/PM or 24-hour (depends on locale)
- Input: Time picker widget
- API: HH:mm format

### 18.2 Currency Formatting

**INR Display**:
- Prefix: ₹ symbol
- Separator: Comma for thousands (Indian numbering: 1,00,000)
- Decimals: Always 2 decimal places (₹1,234.56)
- Negative: No negative amounts allowed in invoices

**Number Input**:
- Accepts only positive numbers
- Two decimal places enforced
- Validation prevents negative values

### 18.3 Soft Delete vs Hard Delete

**Soft Delete** (Archive):
- Record marked as deleted but not removed from database
- `deleted_at` timestamp set
- Still appears in database
- Can be restored
- Used for: Buyers, Suppliers (if implemented)

**Hard Delete**:
- Record permanently removed from database
- Cannot be recovered
- Used for: Draft invoices, test data
- Requires confirmation dialog

---

## Appendix: Permission Matrix

| Resource | Create | Read | Update | Delete | Notes |
|----------|--------|------|--------|--------|-------|
| Users | user.create | user.read | user.update | user.delete | SuperAdmin only for SuperAdmin users |
| Roles | role.create | role.read | role.update | role.delete | Affects permission management |
| Permissions | permission.create | permission.read | permission.update | permission.delete | Rarely granted to non-SuperAdmin |
| Buyers | buyer.create | buyer.read | buyer.update | buyer.delete | Soft delete available |
| Suppliers | supplier.create | supplier.read | supplier.update | supplier.delete | - |
| Products | product.create | product.read | product.update | product.delete | - |
| Invoices | invoice.create | invoice.read | invoice.update | invoice.delete | Draft only for delete |
| Proforma Invoices | proforma.create | proforma.read | proforma.update | proforma.delete | Draft only for delete |
| Payments | payment.create | payment.read | payment.update | payment.delete | Linked to invoices |
| Orders | order.create | order.read | order.update | order.delete | Similar to invoices |

---

**End of User Flow Documentation**

This document provides a complete view of how users interact with the system from login to individual feature usage. All workflows are based on actual implementation and observed behavior.
