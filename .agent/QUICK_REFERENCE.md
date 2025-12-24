# 🚀 Quick Reference - Global Table UI System

## Import Statement Template
```typescript
import DataTable, { Column } from '../components/common/DataTable'
import SummaryCards, { SummaryCard } from '../components/common/SummaryCards'
import SearchAndFilterBar, { FilterCheckbox } from '../components/common/SearchAndFilterBar'
import TableActions, { ActionButton } from '../components/common/TableActions'
import StatusBadge from '../components/common/StatusBadge'
import { useTableSort, useTablePagination } from '../hooks/useTableFeatures'
import { IconName } from 'lucide-react' // Your icons
```

## Page Structure Template
```typescript
export default function YourPage() {
  // 1. State
  const [items, setItems] = useState([])
  const [q, setQ] = useState("")
  const [archived, setArchived] = useState(false)
  
  // 2. Hooks
  const filtered = useMemo(() => 
    items.filter(item => /* search logic */), [items, q]
  )
  const { sortColumn, sortDirection, handleSort, sortedData } = useTableSort(filtered)
  const { currentPage, pageSize, paginatedData, setPage, setPageSize } = 
    useTablePagination(sortedData, 10)
  
  // 3. Summary Cards
  const summaryCards: SummaryCard[] = useMemo(() => [
    { title: 'Card 1', value: 100, icon: Icon1, color: 'blue' },
    { title: 'Card 2', value: 50, icon: Icon2, color: 'green' },
    { title: 'Card 3', value: 25, icon: Icon3, color: 'purple' },
    { title: 'Card 4', value: 10, icon: Icon4, color: 'orange' }
  ], [items])
  
  // 4. Columns
  const columns: Column[] = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      align: 'left',
      render: (row) => <span className="font-semibold">{row.name}</span>
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (row) => <TableActions actions={[...]} />
    }
  ]
  
  // 5. Render
  return (
    <div className="space-y-6">
      <SummaryCards cards={summaryCards} />
      <SearchAndFilterBar 
        searchValue={q}
        onSearchChange={setQ}
        searchPlaceholder="Search..."
        filters={<FilterCheckbox ... />}
        actions={<button className="btn-primary">Add</button>}
      />
      <DataTable
        columns={columns}
        data={paginatedData}
        currentPage={currentPage}
        totalPages={Math.max(1, Math.ceil(sortedData.length / pageSize))}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={handleSort}
      />
    </div>
  )
}
```

## Color Guide
- **blue**: Primary, Info, Users
- **green**: Success, Active, Suppliers
- **purple**: Roles, Premium
- **orange**: Warning, Archive, Low Stock  
- **red**: Danger, Delete, Error
- **teal**: Buyers (suggested)
- **indigo**: Permissions (suggested)
- **gray**: Neutral

## Icon Quick Reference
```typescript
import {
  // Actions
  Plus, Pencil, Trash2, Archive, RotateCcw, Save, ArrowLeft,
  // Resources
  Users, Package, Truck, ShoppingCart, FileText,
  // Status
  CheckCircle, AlertTriangle, Clock, TrendingUp,
  // Features
  Shield, KeyRound, Award, Lock, Crown,
  // Contact
  Phone, Mail, MapPin, Home,
  // Data
  BarChart3, Box, DollarSign
} from 'lucide-react'
```

## Common Patterns

### Action Buttons
```typescript
const actions: ActionButton[] = [
  { label: 'Edit', icon: Pencil, onClick: () => {}, color: 'blue', show: canUpdate('resource') },
  { label: 'Delete', icon: Trash2, onClick: () => {}, color: 'red', show: canDelete('resource') },
  { label: 'Archive', icon: Archive, onClick: () => {}, color: 'orange', show: canDelete('resource') }
]
```

### Status Badge
```typescript
<StatusBadge label="Active" variant="success" size="sm" />
<StatusBadge label={count} variant="info" size="sm" />
```

### Address Simplification
```typescript
render: (row) => {
  const location = [row.city, row.state].filter(Boolean).join(', ') || '-'
  const fullAddress = [row.line1, row.line2, row.city, row.state].filter(Boolean).join(', ')
  return <span title={fullAddress}>{location}</span>
}
```

### Right-Aligned Numbers
```typescript
{
  key: 'price',
  label: 'Price',
  sortable: true,
  align: 'right',
  render: (row) => <span className="font-medium">{formatINR(row.price)}</span>
}
```

## File Locations
- Components: `src/components/common/`
- Hooks: `src/hooks/`
- Pages: `src/pages/`
- Styles: `src/styles.css`
- Docs: `.agent/`
