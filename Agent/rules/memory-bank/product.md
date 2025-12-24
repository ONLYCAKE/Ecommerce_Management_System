# E-commerce Management Admin Portal

## Project Purpose
Professional, modern, and responsive admin portal for comprehensive business management including users, roles, permissions, suppliers, buyers, products, orders, invoices, and payments. Built as a complete business management solution with role-based access control and financial tracking capabilities.

## Key Features & Capabilities

### User Management & Authentication
- JWT-based authentication with secure login system
- Role-based access control (SuperAdmin, Admin, Employee)
- User creation, updates, soft-delete (archive) functionality
- Search, pagination, and archived user filtering
- First-time password change requirement for security
- User profile management with detailed information

### Role & Permission System
- Granular permission management system
- Role assignment with specific permission keys
- SuperAdmin: Full CRUD access to all resources
- Admin: Limited delete permissions on critical resources
- Employee: Read-only access to most resources
- Dynamic permission checking middleware

### Business Entity Management
- **Suppliers**: Complete CRUD operations with address management
- **Buyers**: Customer management with GST information and detailed addresses
- **Products**: Product catalog with supplier linking, HSN codes, and tax configuration
- **Orders**: Order creation and tracking with item management

### Invoice & Payment System
- Complete invoice lifecycle management (Draft, Sent, Paid, Overdue, Cancelled)
- Proforma invoice generation and conversion
- Payment tracking with partial payment support
- Automated invoice status calculations and reminders
- PDF generation for invoices with customizable templates
- Email integration for invoice delivery
- Round-off calculations and tax management

### Financial Features
- Payment records and ledger management
- Buyer ledger with outstanding balance tracking
- Invoice totals calculation with taxes and discounts
- Currency formatting in INR (₹)
- Financial reporting and statistics

### Advanced Capabilities
- Real-time notifications via Socket.IO
- Email service integration with Mailtrap
- Rate limiting for API security
- Comprehensive audit trails
- Data archiving instead of hard deletes
- Automated reminder system for overdue invoices

## Target Users & Use Cases

### SuperAdmin Users
- Complete system administration
- User and role management
- System configuration and maintenance
- Full access to all business operations

### Admin Users
- Business operations management
- Customer and supplier relationship management
- Invoice and payment processing
- Limited administrative functions

### Employee Users
- Data entry and basic operations
- Read-only access to business information
- Order processing and basic customer service
- Limited modification capabilities

### Business Use Cases
- Small to medium business invoice management
- B2B transaction processing
- Customer relationship management
- Supplier management and procurement
- Financial tracking and reporting
- Multi-user business operations with role segregation