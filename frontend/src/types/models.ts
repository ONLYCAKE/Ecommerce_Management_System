export interface User { id: number; email: string; password?: string; firstName?: string | null; lastName?: string | null; mustChangePassword: boolean; isArchived: boolean; roleId: number; createdAt: Date; updatedAt: Date; }
export interface Role { id: number; name: string; createdAt: Date; }
export interface Permission { id: number; key: string; name: string; }
export interface RolePermission { id: number; roleId: number; permissionId: number; enabled: boolean; createdAt: Date; }
export interface Buyer { id: number; name: string; email: string; phone: string; address: string; }
export interface Supplier { id: number; name: string; email: string; phone: string; address: string; }
export interface Product { id: number; sku: string; title: string; description?: string | null; category?: string | null; price: number; stock: number; supplierId?: number | null; createdAt: Date; }
export interface InvoiceItem { id: number; title: string; description?: string | null; qty: number; price: number; gst: number; discountPct: number; amount: number; invoiceId: number; productId?: number | null; }
export interface Invoice { id: number; invoiceNo: string; buyerId: number; supplierId: number; paymentMethod: string; total: number; serviceCharge: number; balance: number; status: string; createdAt: Date; updatedAt: Date; items?: InvoiceItem[] }
