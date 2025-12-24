# Development Guidelines & Patterns

## Code Quality Standards

### TypeScript Implementation
- **Strict Type Safety**: Full TypeScript implementation across both frontend and backend
- **Interface Definitions**: Comprehensive type definitions in dedicated `types/` directories
- **Type Assertions**: Minimal use of `any` type, prefer proper type definitions
- **Generic Types**: Extensive use of generics for reusable components and functions

### Error Handling Patterns
- **Try-Catch Blocks**: Consistent error handling in all async operations
- **Error Logging**: Structured error logging with `console.error('[ERROR] functionName:', err)`
- **User-Friendly Messages**: Backend returns structured error responses with meaningful messages
- **Non-Blocking Operations**: Email and notification failures don't break main operations

### Code Organization
- **Modular Structure**: Clear separation of concerns with dedicated directories
- **Single Responsibility**: Functions and components focus on single tasks
- **Consistent Naming**: PascalCase for components, camelCase for functions and variables
- **File Naming**: Descriptive names matching their primary export

## Backend Development Patterns

### Controller Architecture
```typescript
// Standard controller pattern with comprehensive error handling
export const controllerFunction = async (req: Request, res: Response) => {
  try {
    // Input validation
    const { param1, param2 } = req.body as any;
    
    // Business logic with database operations
    const result = await prisma.model.operation();
    
    // Success response
    res.json(result);
  } catch (err: any) {
    console.error('[ERROR] controllerFunction:', err);
    res.status(500).json({ message: 'Descriptive error message', error: err.message });
  }
};
```

### Database Operations
- **Prisma ORM**: Consistent use of Prisma for all database operations
- **Transaction Support**: Use `prisma.$transaction()` for multi-step operations
- **Include Relationships**: Explicit relationship loading with `include` parameter
- **Soft Deletes**: Archive pattern instead of hard deletes using `isArchived` fields

### API Response Patterns
- **Consistent Structure**: Standardized JSON responses across all endpoints
- **Status Codes**: Proper HTTP status codes (200, 201, 400, 404, 500)
- **Error Messages**: Descriptive error messages for client consumption
- **Data Validation**: Input validation before processing

### Security Implementation
- **Rate Limiting**: Tiered rate limiting based on endpoint sensitivity
- **JWT Authentication**: Stateless token-based authentication
- **Permission Middleware**: Role-based access control with granular permissions
- **Input Sanitization**: Validation and sanitization of all user inputs

## Frontend Development Patterns

### React Component Structure
```typescript
// Standard functional component with hooks
export default function ComponentName() {
  const { user } = useAuth()
  const navigate = useNavigate()
  
  // State management
  const [data, setData] = useState<Type[]>([])
  const [loading, setLoading] = useState(true)
  
  // Computed values
  const canPerformAction = useMemo(() => 
    (user?.permissions || []).includes('action.permission'), [user]
  )
  
  // API calls
  const loadData = async () => {
    try {
      setLoading(true)
      const { data } = await api.get('/endpoint')
      setData(data)
    } catch (error) {
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }
  
  // Effects
  useEffect(() => {
    loadData()
  }, [])
  
  return (
    <div className="p-8 min-h-screen bg-gray-50">
      {/* Component JSX */}
    </div>
  )
}
```

### State Management
- **React Hooks**: useState, useEffect, useMemo, useCallback for local state
- **Context API**: Global state for authentication and confirmations
- **Custom Hooks**: Reusable logic extraction (useAuth, useInvoiceTotals)
- **URL State**: Search parameters for filters and navigation state

### UI/UX Patterns
- **TailwindCSS**: Utility-first CSS with consistent design tokens
- **Responsive Design**: Mobile-first approach with responsive breakpoints
- **Loading States**: Consistent loading indicators and skeleton screens
- **Toast Notifications**: User feedback for actions using react-hot-toast

## Data Handling Patterns

### Calculation Consistency
```typescript
// Consistent rounding to 2 decimal places
function roundToTwoDecimals(value: number): number {
    return Math.round(value * 100) / 100
}

// Apply rounding before database saves
const total = roundToTwoDecimals(rawTotal);
```

### Date/Time Handling
- **ISO Format**: Use ISO 8601 format for date storage and transmission
- **Local Display**: Format dates for user display using `toLocaleDateString()`
- **Timezone Awareness**: Handle timezone differences in date calculations
- **Validation**: Validate date ranges and logical constraints

### Currency Formatting
```typescript
// Consistent currency formatting
const formatCurrency = (amount: number) => `₹${amount.toFixed(2)}`
```

## Testing Patterns

### Integration Testing
- **Supertest**: API endpoint testing with real HTTP requests
- **Database Setup**: Test database with proper setup and teardown
- **Authentication**: Token-based auth testing with proper headers
- **Data Validation**: Test input validation and error responses

### Component Testing
- **Testing Library**: React component testing with user interactions
- **Mock Services**: Mock API calls and external dependencies
- **Accessibility**: Test for accessibility compliance
- **User Scenarios**: Test complete user workflows

## Performance Optimization

### Database Optimization
- **Indexed Fields**: Use database indexes for frequently queried fields
- **Selective Loading**: Load only required fields and relationships
- **Pagination**: Implement pagination for large datasets
- **Query Optimization**: Optimize complex queries and avoid N+1 problems

### Frontend Optimization
- **Code Splitting**: Route-based code splitting for faster loading
- **Memoization**: Use useMemo and useCallback for expensive calculations
- **Lazy Loading**: Lazy load components and images when appropriate
- **Bundle Optimization**: Optimize build output with Vite

## Real-time Features

### Socket.IO Implementation
- **Event-Driven**: Use events for real-time updates
- **Namespace Organization**: Organize events by feature domain
- **Error Handling**: Handle connection errors gracefully
- **Cleanup**: Proper cleanup of socket connections

## Documentation Standards

### Code Comments
- **Function Headers**: Document complex functions with purpose and parameters
- **Business Logic**: Explain complex business rules and calculations
- **API Documentation**: Document API endpoints with examples
- **Configuration**: Document environment variables and setup requirements

### Naming Conventions
- **Descriptive Names**: Use clear, descriptive names for variables and functions
- **Consistent Patterns**: Follow established naming patterns throughout codebase
- **Avoid Abbreviations**: Use full words unless abbreviation is widely understood
- **Context-Aware**: Names should make sense within their context