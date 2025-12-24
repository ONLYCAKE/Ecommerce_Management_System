# Project Structure & Architecture

## Monorepo Organization

```
TASK-3/
├── backend-v2/          # Main backend application (Node.js/Express)
├── frontend/            # React frontend application
├── backend/             # Legacy backend (NestJS - deprecated)
└── .amazonq/           # AI assistant rules and memory bank
```

## Backend Architecture (backend-v2/)

### Core Structure
```
backend-v2/
├── src/
│   ├── controllers/     # Request handlers and business logic
│   ├── routes/         # API endpoint definitions
│   ├── middleware/     # Authentication, rate limiting, validation
│   ├── services/       # Business logic and external integrations
│   ├── utils/          # Helper functions and utilities
│   ├── types/          # TypeScript type definitions
│   └── config/         # Configuration files
├── prisma/             # Database schema and migrations
├── scripts/            # Utility scripts for maintenance
├── uploads/            # File storage for invoices
└── __tests__/          # API integration tests
```

### Key Components
- **Controllers**: Handle HTTP requests, validate input, coordinate with services
- **Routes**: Define API endpoints with middleware chains
- **Middleware**: JWT authentication, role-based permissions, rate limiting
- **Services**: Email service, invoice status management, reminder system
- **Prisma**: Database ORM with comprehensive schema for business entities

## Frontend Architecture (frontend/)

### Core Structure
```
frontend/
├── src/
│   ├── pages/          # Route components and main views
│   ├── components/     # Reusable UI components
│   ├── hooks/          # Custom React hooks
│   ├── context/        # React context providers
│   ├── api/            # API client configuration
│   ├── utils/          # Helper functions and utilities
│   ├── types/          # TypeScript interfaces
│   └── styles/         # Global CSS and styling
├── public/             # Static assets
└── test/               # Test configuration and utilities
```

### Component Organization
- **Pages**: Feature-specific pages with CRUD operations
- **Components**: Modular UI components (Sidebar, Topbar, Modals, Forms)
- **Invoice Components**: Specialized components for invoice management
- **Common Components**: Reusable components like CountryStateCitySelect

## Database Schema (Prisma)

### Core Entities
- **User**: Authentication and user management
- **Role/Permission**: RBAC system implementation
- **Supplier/Buyer**: Business entity management
- **Product**: Inventory and catalog management
- **Invoice/InvoiceItem**: Transaction and billing system
- **Payment**: Financial tracking and records
- **Order/OrderItem**: Order management system

### Relationships
- Users have Roles with specific Permissions
- Products belong to Suppliers
- Invoices link Buyers with Products through InvoiceItems
- Payments track Invoice settlement
- Comprehensive foreign key relationships ensure data integrity

## Architectural Patterns

### Backend Patterns
- **MVC Architecture**: Controllers handle requests, services contain business logic
- **Middleware Chain**: Authentication → Authorization → Rate Limiting → Route Handler
- **Repository Pattern**: Prisma ORM abstracts database operations
- **Service Layer**: Separate business logic from HTTP concerns
- **Event-Driven**: Socket.IO for real-time notifications

### Frontend Patterns
- **Component-Based Architecture**: React functional components with hooks
- **Context Pattern**: Global state management for auth and confirmations
- **Custom Hooks**: Reusable logic extraction (useAuth, useInvoiceTotals)
- **Route-Based Code Splitting**: Organized by feature/page
- **Compound Components**: Complex UI components with multiple parts

### Security Architecture
- **JWT Authentication**: Stateless token-based auth
- **Role-Based Access Control**: Granular permission system
- **Route Protection**: Frontend and backend route guards
- **Input Validation**: Zod schemas for type-safe validation
- **Rate Limiting**: API protection against abuse

## Development Workflow
- **Monorepo Setup**: Root package.json with workspace scripts
- **Database Migrations**: Prisma migration system with version control
- **Type Safety**: Full TypeScript implementation across stack
- **Testing**: Integration tests for critical API endpoints
- **Hot Reload**: Development servers with live reloading