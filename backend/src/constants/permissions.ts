export const PERMISSIONS = {
  USER_READ: 'user.read',
  USER_CREATE: 'user.create',
  USER_UPDATE: 'user.update',
  USER_DELETE: 'user.delete',

  ROLE_READ: 'role.read',
  ROLE_CREATE: 'role.create',
  ROLE_UPDATE: 'role.update',
  ROLE_DELETE: 'role.delete',

  PERMISSION_READ: 'permission.read',
  PERMISSION_CREATE: 'permission.create',
  PERMISSION_UPDATE: 'permission.update',
  PERMISSION_DELETE: 'permission.delete',

  SUPPLIER_READ: 'supplier.read',
  SUPPLIER_CREATE: 'supplier.create',
  SUPPLIER_UPDATE: 'supplier.update',
  SUPPLIER_DELETE: 'supplier.delete',

  BUYER_READ: 'buyer.read',
  BUYER_CREATE: 'buyer.create',
  BUYER_UPDATE: 'buyer.update',
  BUYER_DELETE: 'buyer.delete',

  PRODUCT_READ: 'product.read',
  PRODUCT_CREATE: 'product.create',
  PRODUCT_UPDATE: 'product.update',
  PRODUCT_DELETE: 'product.delete',

  INVOICE_READ: 'invoice.read',
  INVOICE_CREATE: 'invoice.create',
  INVOICE_UPDATE: 'invoice.update',
  INVOICE_DELETE: 'invoice.delete',

  ORDER_READ: 'order.read',
  ORDER_CREATE: 'order.create',
};

export const ADMIN_PERMISSIONS = [
  'user.read', 'user.create', 'user.update',
  'role.read',
  'permission.read',
  'supplier.read','supplier.create','supplier.update',
  'buyer.read','buyer.create','buyer.update',
  'product.read','product.create','product.update',
  'invoice.read','invoice.create','invoice.update',
  'order.read','order.create'
] as const;

export const EMPLOYEE_PERMISSIONS = [
  'user.read',
  'role.read',
  'permission.read',
  'supplier.read',
  'buyer.read',
  'product.read',
  'invoice.read',
  'order.read'
] as const;
