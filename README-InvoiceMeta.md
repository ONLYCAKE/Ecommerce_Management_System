# InvoiceMeta Component - Implementation Guide

## Overview

This document describes the implementation of the `InvoiceMeta` component, a reusable React component that provides four types of date/time pickers for invoice management.

## Features

- **Invoice Date Picker**: Date-only selection (format: dd-MM-yyyy)
- **Due Date Picker**: Date-only selection with validation (format: dd-MM-yyyy)
- **Delivery Date & Time Picker**: Combined date and time selection (format: dd-MM-yyyy HH:mm)
- **Payment Time Picker**: Time-only selection (format: HH:mm)
- Human-readable preview text for all selections
- Full keyboard accessibility with ARIA labels
- Clearable inputs
- Responsive design with Tailwind CSS

## Installation

### Prerequisites

- Node.js 16+ and npm/yarn
- Existing React + TypeScript project

### Install Dependencies

```bash
cd frontend
npm install react-datepicker date-fns @types/react-datepicker
```

Or with yarn:

```bash
cd frontend
yarn add react-datepicker date-fns @types/react-datepicker
```

## Development

### Start Development Server

```bash
cd frontend
npm run dev
```

The application will be available at `http://localhost:5173` (or your configured port).

### File Structure

```
frontend/
├── src/
│   ├── components/
│   │   └── invoice/
│   │       ├── InvoiceMeta.tsx          # Main component
│   │       ├── InvoiceMeta.css          # Fallback styles
│   │       └── __tests__/
│   │           └── InvoiceMeta.test.tsx # Unit tests
│   └── pages/
│       └── invoices/
│           ├── InvoiceCreate.tsx        # Updated integration
│           └── __tests__/
│               └── InvoiceCreate.integration.test.tsx
```

## Usage

### Basic Example

```tsx
import { useState } from 'react'
import InvoiceMeta from './components/invoice/InvoiceMeta'

function MyInvoiceForm() {
  const [invoiceDate, setInvoiceDate] = useState<Date | null>(new Date())
  const [dueDate, setDueDate] = useState<Date | null>(new Date())
  const [deliveryDateTime, setDeliveryDateTime] = useState<Date | null>(null)
  const [paymentTime, setPaymentTime] = useState<Date | null>(null)

  return (
    <InvoiceMeta
      invoiceDate={invoiceDate}
      dueDate={dueDate}
      deliveryDateTime={deliveryDateTime}
      paymentTime={paymentTime}
      setInvoiceDate={setInvoiceDate}
      setDueDate={setDueDate}
      setDeliveryDateTime={setDeliveryDateTime}
      setPaymentTime={setPaymentTime}
    />
  )
}
```

### With Validation

```tsx
import { useState } from 'react'
import InvoiceMeta from './components/invoice/InvoiceMeta'

function MyInvoiceForm() {
  const [invoiceDate, setInvoiceDate] = useState<Date | null>(new Date())
  const [dueDate, setDueDate] = useState<Date | null>(new Date())
  const [dateError, setDateError] = useState<string>('')

  // Validate dates
  const validateDates = () => {
    if (invoiceDate && dueDate && dueDate < invoiceDate) {
      setDateError('Due date cannot be before invoice date')
      return false
    }
    setDateError('')
    return true
  }

  return (
    <InvoiceMeta
      invoiceDate={invoiceDate}
      dueDate={dueDate}
      deliveryDateTime={null}
      paymentTime={null}
      setInvoiceDate={setInvoiceDate}
      setDueDate={setDueDate}
      setDeliveryDateTime={() => {}}
      setPaymentTime={() => {}}
      dateError={dateError}
    />
  )
}
```

### Formatting Dates for API

```tsx
const handleSave = async () => {
  // Format dates for API payload
  const formattedInvoiceDate = invoiceDate 
    ? invoiceDate.toISOString().substring(0, 10) // YYYY-MM-DD
    : ''
  
  const formattedDueDate = dueDate 
    ? dueDate.toISOString().substring(0, 10) // YYYY-MM-DD
    : ''
  
  const formattedDeliveryDateTime = deliveryDateTime 
    ? deliveryDateTime.toISOString() // Full ISO: 2025-12-15T14:30:00.000Z
    : undefined
  
  const formattedPaymentTime = paymentTime 
    ? paymentTime.toISOString().substring(11, 16) // HH:mm
    : undefined

  const payload = {
    invoiceDate: formattedInvoiceDate,
    dueDate: formattedDueDate,
    deliveryDateTime: formattedDeliveryDateTime,
    paymentTime: formattedPaymentTime,
    // ... other fields
  }

  await api.post('/invoices', payload)
}
```

## Testing

### Run All Tests

```bash
cd frontend
npm test
```

### Run Specific Test Files

```bash
# Component unit tests
npm test InvoiceMeta.test.tsx

# Integration tests
npm test InvoiceCreate.integration.test.tsx

# Watch mode
npm test -- --watch
```

### Test Coverage

```bash
npm test -- --coverage
```

### Backend API Tests

```bash
cd backend
npm test invoice.api.test.ts
```

## Component API

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `invoiceDate` | `Date \| null` | Yes | Current invoice date value |
| `dueDate` | `Date \| null` | Yes | Current due date value |
| `deliveryDateTime` | `Date \| null` | Yes | Current delivery date/time value |
| `paymentTime` | `Date \| null` | Yes | Current payment time value |
| `setInvoiceDate` | `(d: Date \| null) => void` | Yes | Callback when invoice date changes |
| `setDueDate` | `(d: Date \| null) => void` | Yes | Callback when due date changes |
| `setDeliveryDateTime` | `(d: Date \| null) => void` | Yes | Callback when delivery date/time changes |
| `setPaymentTime` | `(d: Date \| null) => void` | Yes | Callback when payment time changes |
| `className` | `string` | No | Additional CSS classes |
| `dateError` | `string` | No | Error message to display for date validation |

## Validation Rules

1. **Invoice Date**: Required field
2. **Due Date**: Must be greater than or equal to invoice date
3. **Delivery Date/Time**: Optional
4. **Payment Time**: Optional

## Date Format Reference

| Field | Input Format | Display Format | API Format |
|-------|-------------|----------------|------------|
| Invoice Date | dd-MM-yyyy | "Wednesday, December 10th, 2025" | YYYY-MM-DD |
| Due Date | dd-MM-yyyy | "Friday, December 20th, 2025" | YYYY-MM-DD |
| Delivery Date/Time | dd-MM-yyyy HH:mm | "Wed, Dec 15th, 2025 @ 2:30 PM" | ISO 8601 |
| Payment Time | HH:mm | "2:30 PM" | HH:mm |

## Accessibility

- All pickers have proper `aria-label` attributes
- Keyboard navigation supported:
  - Tab to navigate between pickers
  - Arrow keys to navigate calendar
  - Enter to select date
  - Escape to close picker
- Screen reader compatible
- Focus indicators visible

## Styling

The component uses Tailwind CSS for primary styling with a fallback CSS file for react-datepicker specific styles.

### Customization

To customize colors, edit `InvoiceMeta.css`:

```css
/* Primary color */
.react-datepicker__day--selected {
  background-color: #4f46e5; /* Change to your brand color */
}
```

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Troubleshooting

### Dates not displaying correctly

Ensure `date-fns` is installed and imported correctly:

```bash
npm install date-fns
```

### Styles not applying

Make sure to import the CSS file in your component:

```tsx
import 'react-datepicker/dist/react-datepicker.css'
import './InvoiceMeta.css'
```

### TypeScript errors

Ensure type definitions are installed:

```bash
npm install --save-dev @types/react-datepicker
```

## Example API Payload

```json
{
  "invoiceNo": "INV-001",
  "buyerId": 1,
  "invoiceDate": "2025-12-10",
  "dueDate": "2025-12-20",
  "deliveryDateTime": "2025-12-15T14:30:00.000Z",
  "paymentTime": "14:30",
  "status": "Processing",
  "items": [
    {
      "productId": 1,
      "title": "Test Product",
      "qty": 1,
      "price": 100,
      "gst": 18,
      "discountPct": 0
    }
  ],
  "paymentMethod": "Cash",
  "serviceCharge": 0
}
```

## Curl Example

```bash
curl -X POST http://localhost:5000/api/invoices \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "invoiceNo": "INV-001",
    "buyerId": 1,
    "invoiceDate": "2025-12-10",
    "dueDate": "2025-12-20",
    "deliveryDateTime": "2025-12-15T14:30:00.000Z",
    "paymentTime": "14:30",
    "status": "Processing",
    "items": [{
      "title": "Product",
      "qty": 1,
      "price": 100,
      "gst": 18,
      "discountPct": 0
    }],
    "paymentMethod": "Cash",
    "serviceCharge": 0
  }'
```

## Changelog

### Added Files
- `frontend/src/components/invoice/InvoiceMeta.tsx` - Main component
- `frontend/src/components/invoice/InvoiceMeta.css` - Fallback styles
- `frontend/src/components/invoice/__tests__/InvoiceMeta.test.tsx` - Unit tests
- `frontend/src/pages/invoices/__tests__/InvoiceCreate.integration.test.tsx` - Integration tests
- `backend/src/__tests__/invoice.api.test.ts` - API test skeleton

### Modified Files
- `frontend/package.json` - Added dependencies
- `frontend/src/pages/invoices/InvoiceCreate.tsx` - Integrated InvoiceMeta component

### Changes Summary
1. Replaced string-based date inputs with Date objects
2. Added new fields: `deliveryDateTime` and `paymentTime`
3. Implemented date range validation (dueDate >= invoiceDate)
4. Updated API payload formatting for proper date/time handling
5. Added comprehensive test coverage

## License

This component is part of the TASK-3 project.

## Support

For issues or questions, please contact the development team or create an issue in the project repository.
