# Technology Stack & Development

## Backend Technology Stack

### Core Framework & Runtime
- **Node.js**: JavaScript runtime environment
- **Express.js**: Web application framework
- **TypeScript**: Type-safe JavaScript development
- **TSX**: TypeScript execution and hot reload

### Database & ORM
- **PostgreSQL**: Primary database system
- **Prisma**: Modern database toolkit and ORM
- **Database**: `task3` with `postgres` schema
- **Connection**: `postgresql://postgres:postgres@localhost:5432/task3?schema=postgres`

### Authentication & Security
- **JWT (jsonwebtoken)**: Token-based authentication
- **bcryptjs**: Password hashing and verification
- **express-rate-limit**: API rate limiting protection
- **CORS**: Cross-origin resource sharing configuration

### External Services & Integrations
- **Mailtrap**: Email service for development and testing
- **Nodemailer**: Email sending functionality
- **Socket.IO**: Real-time bidirectional communication
- **PDFKit**: PDF generation for invoices

### Validation & Utilities
- **Zod**: Schema validation and type inference
- **dotenv**: Environment variable management

## Frontend Technology Stack

### Core Framework & Build Tools
- **React 18**: Modern React with hooks and concurrent features
- **Vite**: Fast build tool and development server
- **TypeScript**: Type-safe frontend development

### UI & Styling
- **TailwindCSS**: Utility-first CSS framework
- **Lucide React**: Modern icon library
- **React Icons**: Additional icon components
- **PostCSS**: CSS processing and optimization

### State Management & Routing
- **React Router DOM**: Client-side routing
- **React Context**: Global state management
- **Custom Hooks**: Reusable stateful logic

### Form Handling & UI Components
- **React Select**: Advanced select components
- **React DatePicker**: Date selection components
- **React Quill**: Rich text editor
- **React Hot Toast**: Toast notifications
- **Headless UI**: Unstyled accessible UI components

### Data Visualization & External APIs
- **Recharts**: Chart and data visualization library
- **Axios**: HTTP client for API requests
- **Country State City**: Geographic data library
- **Date-fns**: Date manipulation utilities

### Testing Framework
- **Vitest**: Fast unit testing framework
- **Testing Library**: React component testing utilities
- **JSDOM**: DOM implementation for testing

## Development Commands

### Backend (backend-v2/)
```bash
npm run dev              # Start development server with hot reload
npm run start           # Production server start
npm run prisma:generate # Generate Prisma client
npm run prisma:migrate  # Run database migrations
npm run seed            # Seed database with initial data
npm run db:setup        # Complete database setup
npm run reset:password  # Reset user passwords utility
```

### Frontend (frontend/)
```bash
npm run dev            # Start Vite development server
npm run build          # Production build
npm run preview        # Preview production build
npm run test           # Run unit tests
npm run test:ui        # Run tests with UI
npm run test:coverage  # Generate test coverage report
```

### Root Level Scripts
```bash
npm run dev:backend    # Install and start backend
npm run dev:frontend   # Install and start frontend
```

## Environment Configuration

### Backend Environment (.env)
```
PORT=5000
JWT_SECRET=super_secret_jwt_for_dev
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/task3?schema=postgres
```

### Frontend Environment (.env)
```
VITE_API_URL=http://localhost:5000
```

## Development Servers
- **Backend**: http://localhost:5000
- **Frontend**: http://localhost:5173

## Database Setup Requirements
- PostgreSQL server running locally
- Database named `task3` created
- Schema `postgres` (default)
- Prisma migrations applied
- Seed data loaded for initial users and roles

## Build & Deployment
- **Backend**: TypeScript compilation with TSX
- **Frontend**: Vite build system with optimized production bundles
- **Database**: Prisma migration system for schema versioning
- **Assets**: Static file serving for uploads and public assets

## Development Tools
- **Hot Reload**: Both frontend and backend support live reloading
- **Type Checking**: Full TypeScript support across the stack
- **Linting**: ESLint configuration for code quality
- **Testing**: Integration and unit testing capabilities
- **Database Tools**: Prisma Studio for database inspection