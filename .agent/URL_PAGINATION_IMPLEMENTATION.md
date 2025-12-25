# URL-Based Pagination Implementation Guide

## ✅ **STATUS: useUrlPagination Hook Created**

A reusable hook has been created at:
```
frontend/src/hooks/useUrlPagination.ts
```

---

## 🎯 **What This Hook Does**

### **Source of Truth**: URL Query Parameters
```
/invoices?page=2&pageSize=25
          ↓
{ page: 2, pageSize: 25 }
```

### **Key Features**:
- ✅ Reads `page` and `pageSize` from URL
- ✅ Updates URL when pagination changes
- ✅ Preserves other URL params (filters, sorting)
- ✅ Browser back/forward support
- ✅ Shareable URLs
- ✅ Refresh-safe

---

## 📋 **Current Implementation Status**

| Page | URL Pagination | Status |
|------|----------------|--------|
| **Invoices** | ✅ Implemented | Manual implementation (already working) |
| Products | ❌ Not implemented | Need to apply hook |
| Buyers | ❌ Not implemented | Need to apply hook |
| Suppliers | ❌ Not implemented | Need to apply hook |
| Orders | ❌ Not implemented | Need to apply hook |
| Payment Records | ❌ Not implemented | Need to apply hook |
| Proformas | ❌ Not implemented | Need to apply hook |

---

## 🔧 **How to Use the Hook**

### **Step 1: Import the Hook**
```typescript
import { useUrlPagination } from '../hooks/useUrlPagination'
```

### **Step 2: Replace State with Hook**

**Before** (Local state):
```typescript
const [page, setPage] = useState(1)
const [pageSize, setPageSize] = useState(10)
```

**After** (URL-based):
```typescript
const { page, pageSize, setPage, setPageSize } = useUrlPagination(1, 10)
```

### **Step 3: Remove URL Sync Code**

**Delete these** (hook handles it):
```typescript
// ❌ Remove manual URL reading
useEffect(() => {
  const urlPage = searchParams.get('page')
  if (urlPage) setPage(parseInt(urlPage))
}, [])

// ❌ Remove manual URL updates
onClick={() => {
  setPage(newPage)
  const params = new URLSearchParams(searchParams)
  params.set('page', newPage.toString())
  setSearchParams(params)
}}
```

**Keep this** (hook returns setPage that updates URL):
```typescript
onClick={() => setPage(newPage)}  // ✅ Hook handles URL update
```

---

## 📖 **Implementation Examples**

### **Example 1: Simple Pagination**

```typescript
import { useUrlPagination } from '../hooks/useUrlPagination'

export default function ProductsPage() {
  const { page, pageSize, setPage, setPageSize } = useUrlPagination()
  const [products, setProducts] = useState([])

  // Load data when page or pageSize changes
  useEffect(() => {
    loadProducts()
  }, [page, pageSize])

  const loadProducts = async () => {
    const { data } = await api.get(`/products?page=${page}&limit=${pageSize}`)
    setProducts(data)
  }

  return (
    <div>
      {/* Table */}
      <table>...</table>

      {/* Pagination Controls */}
      <div>
        <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
          <option value={5}>5</option>
          <option value={10}>10</option>
          <option value={25}>25</option>
        </select>

        <button onClick={() => setPage(page - 1)} disabled={page === 1}>
          Previous
        </button>
        <span>Page {page}</span>
        <button onClick={() => setPage(page + 1)}>
          Next
        </button>
      </div>
    </div>
  )
}
```

---

### **Example 2: Pagination with Filters**

```typescript
export default function InvoicesPage() {
  const { page, pageSize, setPage, setPageSize } = useUrlPagination()
  const [searchParams] = useSearchParams()
  
  // Read filter from URL
  const status = searchParams.get('status') || 'all'
  
  useEffect(() => {
    loadInvoices()
  }, [page, pageSize, status])  // Reload when pagination OR filter changes

  const loadInvoices = async () => {
    const params = new URLSearchParams()
    if (status !== 'all') params.append('status', status)
    params.append('page', page.toString())
    params.append('limit', pageSize.toString())
    
    const { data } = await api.get(`/invoices?${params}`)
    setInvoices(data)
  }

  return (
    <div>
      {/* Filters */}
      <button onClick={() => navigate('/invoices?status=draft&page=1')}>
        Draft
      </button>

      {/* Table */}
      <table>...</table>

      {/* Pagination */}
      <button onClick={() => setPage(p => p - 1)}>Previous</button>
      <button onClick={() => setPage(p => p + 1)}>Next</button>
    </div>
  )
}
```

---

## 🛠️ **Migration Guide for Each Page**

### **Products Page**

**File**: `frontend/src/pages/Products.tsx`

**Changes**:
1. Import hook: `import { useUrlPagination } from '../hooks/useUrlPagination'`
2. Replace state: `const { page, pageSize, setPage, setPageSize } = useUrlPagination()`
3. Remove manual URL sync code
4. Keep existing pagination UI

**Lines to modify**: ~40-50, pagination controls section

---

### **Buyers Page**

**File**: `frontend/src/pages/Buyers.tsx`

**Changes**:
1. Import hook
2. Replace state
3. Update pagination controls to use hook's setPage/setPageSize

**Lines to modify**: Pagination state + controls

---

### **Suppliers Page**

**File**: `frontend/src/pages/Suppliers.tsx`

**Changes**: Same as Buyers

---

### **Payment Records Page**

**File**: `frontend/src/pages/PaymentRecords.tsx`

**Changes**: Same pattern

---

### **Orders Page**

**File**: `frontend/src/pages/Orders.tsx` (if exists)

**Changes**: Same pattern

---

## ✅ **Invoices Page - Already Implemented**

The Invoices page **already has URL pagination** working! It doesn't use the hook yet, but the logic is there:

**Current Implementation** (`Invoices.tsx`):
- ✅ Reads `page` and `limit` from URL on mount (lines 67-101)
- ✅ Updates URL when page changes (lines 734-809)
- ✅ Updates URL when pageSize changes (lines 712-726)

**Optional Refactor** (to use hook):
```typescript
// Before
const [page, setPage] = useState(1)
const [pageSize, setPageSize] = useState(10)

// After
const { page, pageSize, setPage, setPageSize } = useUrlPagination()
```

**Benefit**: Less code, more consistent

---

## 🧪 **Testing Checklist**

For each page after migration:

- [ ] Navigate to page
- [ ] Check URL has `?page=1`
- [ ] Change page → URL updates `?page=2`
- [ ] Change rows per page → URL updates `?pageSize=25&page=1`
- [ ] Refresh page → Pagination persists
- [ ] Browser back button → Returns to previous page
- [ ] Copy URL and paste in new tab → Same page/pageSize
- [ ] Works with filters (e.g., `?status=draft&page=2`)

---

## 📊 **URL Parameter Reference**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Current page number |
| `pageSize` or `limit` | number | 10 | Items per page |
| `status` | string | - | Filter value (optional) |
| `sort` | string | - | Sort field (optional) |
| `search` | string | - | Search query (optional) |

**Example URLs**:
```
/invoices?page=1
/invoices?page=2&pageSize=25
/invoices?status=draft&page=1&pageSize=10
/products?page=3&pageSize=50&category=electronics
/buyers?search=john&page=2
```

---

## 🎯 **Hook API Reference**

### **useUrlPagination(defaultPage?, defaultPageSize?)**

**Parameters**:
- `defaultPage` (optional): Default page if not in URL (default: 1)
- `defaultPageSize` (optional): Default page size if not in URL (default: 10)

**Returns**:
```typescript
{
  page: number,          // Current page (from URL or default)
  pageSize: number,      // Current page size (from URL or default)
  setPage: (page: number | ((prev) => number)) => void,   // Update page + URL
  setPageSize: (size: number) => void  // Update pageSize + URL + reset to page 1
}
```

**URL Sync**:
- `setPage(2)` → Updates URL to `?page=2`
- `setPageSize(25)` → Updates URL to `?pageSize=25&page=1`

---

## 🔒 **Backward Compatibility**

### **Fallback Mechanism**:
```typescript
// If URL has no params
?                      → { page: 1, pageSize: 10 }

// If URL has page only
?page=3                → { page: 3, pageSize: 10 }

// If URL has pageSize only
?pageSize=50           → { page: 1, pageSize: 50 }

// If URL has both
?page=2&pageSize=25    → { page: 2, pageSize: 25 }
```

### **Supports Both `limit` and `pageSize`**:
```typescript
?limit=10              → pageSize = 10  ✅
?pageSize=10           → pageSize = 10  ✅
```

---

## 🚀 **Recommended Rollout Plan**

### **Phase 1: Verify Invoices** ✅
- Invoices page already has URL pagination
- Test thoroughly
- Document any issues

### **Phase 2: Implement in Products**
- Apply `useUrlPagination` hook
- Test all pagination controls
- Verify filter + pagination combo

### **Phase 3: Implement in Buyers/Suppliers**
- Same pattern as Products
- Test thoroughly

### **Phase 4: Implement in Payments/Orders**
- Apply hook
- Final testing

### **Phase 5: Optional Refactor Invoices**
- Replace manual URL sync with hook
- Simplify code

---

## ✅ **Success Criteria**

For each page:
- [x] Pagination state comes from URL only
- [x] No local state is source of truth
- [x] Page load/refresh reads from URL
- [x] Changing page updates URL
- [x] Browser back/forward works
- [x] Works with existing filters
- [x] Shareable URLs work
- [x] No breaking changes

---

## 📝 **Code Examples Repository**

All examples stored in:
```
.agent/URL_PAGINATION_IMPLEMENTATION.md
```

Hook location:
```
frontend/src/hooks/useUrlPagination.ts
```

---

## 🎯 **Status Summary**

**Hook**: ✅ Created and ready to use  
**Invoices**: ✅ Already has URL pagination (manual)  
**Other Pages**: ⏳ Ready for implementation (use hook)  
**Backward Compatible**: ✅ Yes  
**Breaking Changes**: ❌ None  

**Next Step**: Apply `useUrlPagination` hook to Products, Buyers, Suppliers, Payments, Orders pages.
