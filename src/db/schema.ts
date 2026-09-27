import {
  pgTable,
  pgEnum,
  serial,
  varchar,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// ============
// ENUMS
// ============
export const userRoleEnum = pgEnum("user_role", ["admin", "manager", "vendor"]);
export const paymentMethodEnum = pgEnum("payment_method", [
  "cash",
  "mobile_money",
  "transfer",
  "credit",
  "other",
]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "paid",
  "partial",
  "unpaid",
]);
export const stockMovementTypeEnum = pgEnum("stock_movement_type", [
  "entry",
  "sale",
  "loss",
  "damaged",
  "return_to_supplier",
  "internal_use",
  "correction",
  "inventory",
  "other",
]);
export const saleTypeEnum = pgEnum("sale_type", ["retail", "wholesale", "special"]);
export const priceTypeEnum = pgEnum("price_type", [
  "retail",
  "wholesale",
  "special",
  "promotional",
  "custom",
]);
export const syncStatusEnum = pgEnum("sync_status", [
  "pending",
  "syncing",
  "synced",
  "failed",
]);

// Helper for created/updated timestamps
const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
};

// ============
// TABLES
// ============

// Store settings (single row)
export const storeSettings = pgTable("store_settings", {
  id: serial("id").primaryKey(),
  storeName: varchar("store_name", { length: 255 }).notNull().default("Ma Boutique"),
  currency: varchar("currency", { length: 10 }).notNull().default("FCFA"),
  address: text("address"),
  phone: varchar("phone", { length: 50 }),
  lowStockThreshold: integer("low_stock_threshold").notNull().default(5),
  enableVoiceFeedback: boolean("enable_voice_feedback").notNull().default(true),
  logoUrl: text("logo_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Users
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    username: varchar("username", { length: 100 }).notNull(),
    fullName: varchar("full_name", { length: 255 }).notNull(),
    // Fiche collaborateur
    phone: varchar("phone", { length: 50 }),
    email: varchar("email", { length: 255 }),
    address: text("address"),
    notes: text("notes"),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    role: userRoleEnum("role").notNull().default("vendor"),
    active: boolean("active").notNull().default(true),
    // Stored as a bcrypt hash, not as plaintext.
    pinCode: varchar("pin_code", { length: 255 }),
    permissions: jsonb("permissions").$type<string[]>().default([]),
    deviceId: varchar("device_id", { length: 255 }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("users_username_idx").on(t.username)]
);

// Categories
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  active: boolean("active").notNull().default(true),
  ...timestamps,
});

// Suppliers
export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  company: varchar("company", { length: 255 }),
  address: text("address"),
  email: varchar("email", { length: 255 }),
  notes: text("notes"),
  totalPurchases: numeric("total_purchases", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),
  debt: numeric("debt", { precision: 12, scale: 2 }).notNull().default("0"),
  active: boolean("active").notNull().default(true),
  ...timestamps,
});

// Customers
export const customers = pgTable(
  "customers",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 50 }),
    company: varchar("company", { length: 255 }),
    address: text("address"),
    email: varchar("email", { length: 255 }),
    type: varchar("type", { length: 50 }).default("retail"), // retail / wholesale
    totalPurchases: numeric("total_purchases", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    debt: numeric("debt", { precision: 12, scale: 2 }).notNull().default("0"),
    notes: text("notes"),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (t) => [index("customers_phone_idx").on(t.phone), index("customers_name_idx").on(t.name)]
);

// Products
export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    sku: varchar("sku", { length: 100 }),
    barcode: varchar("barcode", { length: 100 }),
    categoryId: integer("category_id").references(() => categories.id),
    supplierId: integer("supplier_id").references(() => suppliers.id),
    brand: varchar("brand", { length: 100 }),
    model: varchar("model", { length: 100 }),
    compatibility: text("compatibility"),
    description: text("description"),
    imageUrl: text("image_url"),
    purchasePrice: numeric("purchase_price", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    retailPrice: numeric("retail_price", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    wholesalePrice: numeric("wholesale_price", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    specialPrice: numeric("special_price", { precision: 12, scale: 2 }),
    promotionalPrice: numeric("promotional_price", { precision: 12, scale: 2 }),
    stock: integer("stock").notNull().default(0),
    minStock: integer("min_stock").notNull().default(5),
    location: varchar("location", { length: 100 }),
    active: boolean("active").notNull().default(true),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("products_barcode_idx").on(t.barcode),
    index("products_sku_idx").on(t.sku),
    index("products_name_idx").on(t.name),
    index("products_category_idx").on(t.categoryId),
    index("products_stock_idx").on(t.stock),
  ]
);

// Sales
export const sales = pgTable(
  "sales",
  {
    id: serial("id").primaryKey(),
    saleNumber: varchar("sale_number", { length: 50 }).notNull(),
    customerId: integer("customer_id").references(() => customers.id),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    saleType: saleTypeEnum("sale_type").notNull().default("retail"),
    itemsTotal: numeric("items_total", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    discountAmount: numeric("discount_amount", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    taxAmount: numeric("tax_amount", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    totalAmount: numeric("total_amount", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    totalCost: numeric("total_cost", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    profit: numeric("profit", { precision: 12, scale: 2 }).notNull().default("0"),
    paymentMethod: paymentMethodEnum("payment_method").notNull().default("cash"),
    paymentStatus: paymentStatusEnum("payment_status").notNull().default("paid"),
    amountPaid: numeric("amount_paid", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    amountDue: numeric("amount_due", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    notes: text("notes"),
    isOffline: boolean("is_offline").notNull().default(false),
    localId: varchar("local_id", { length: 255 }), // idempotency key for offline sync
    deviceId: varchar("device_id", { length: 255 }),
    syncedAt: timestamp("synced_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("sales_local_id_idx").on(t.localId),
    index("sales_user_id_idx").on(t.userId),
    index("sales_customer_id_idx").on(t.customerId),
    index("sales_created_at_idx").on(t.createdAt),
    index("sales_sale_number_idx").on(t.saleNumber),
  ]
);

// Sale Items
export const saleItems = pgTable(
  "sale_items",
  {
    id: serial("id").primaryKey(),
    saleId: integer("sale_id")
      .notNull()
      .references(() => sales.id, { onDelete: "cascade" }),
    productId: integer("product_id").references(() => products.id),
    productName: varchar("product_name", { length: 255 }).notNull(),
    productSku: varchar("product_sku", { length: 100 }),
    quantity: integer("quantity").notNull(),
    purchasePriceAtTime: numeric("purchase_price_at_time", {
      precision: 12,
      scale: 2,
    }).notNull(),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
    priceType: priceTypeEnum("price_type").notNull().default("retail"),
    subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
    subtotalCost: numeric("subtotal_cost", { precision: 12, scale: 2 }).notNull(),
    profit: numeric("profit", { precision: 12, scale: 2 }).notNull(),
    ...timestamps,
  },
  (t) => [
    index("sale_items_sale_id_idx").on(t.saleId),
    index("sale_items_product_id_idx").on(t.productId),
  ]
);

// Purchases (stock entries from suppliers)
export const purchases = pgTable(
  "purchases",
  {
    id: serial("id").primaryKey(),
    purchaseNumber: varchar("purchase_number", { length: 50 }).notNull(),
    supplierId: integer("supplier_id").references(() => suppliers.id),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    invoiceNumber: varchar("invoice_number", { length: 100 }),
    totalAmount: numeric("total_amount", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    paymentMethod: paymentMethodEnum("payment_method").notNull().default("cash"),
    amountPaid: numeric("amount_paid", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    amountDue: numeric("amount_due", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    notes: text("notes"),
    isOffline: boolean("is_offline").notNull().default(false),
    localId: varchar("local_id", { length: 255 }),
    deviceId: varchar("device_id", { length: 255 }),
    purchaseDate: timestamp("purchase_date", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("purchases_local_id_idx").on(t.localId),
    index("purchases_supplier_id_idx").on(t.supplierId),
    index("purchases_user_id_idx").on(t.userId),
    index("purchases_purchase_date_idx").on(t.purchaseDate),
  ]
);

// Purchase Items
export const purchaseItems = pgTable(
  "purchase_items",
  {
    id: serial("id").primaryKey(),
    purchaseId: integer("purchase_id")
      .notNull()
      .references(() => purchases.id, { onDelete: "cascade" }),
    productId: integer("product_id").references(() => products.id),
    productName: varchar("product_name", { length: 255 }).notNull(),
    quantity: integer("quantity").notNull(),
    unitCost: numeric("unit_cost", { precision: 12, scale: 2 }).notNull(),
    subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
    ...timestamps,
  },
  (t) => [
    index("purchase_items_purchase_id_idx").on(t.purchaseId),
    index("purchase_items_product_id_idx").on(t.productId),
  ]
);

// Stock Movements (single source of truth for all stock changes)
export const stockMovements = pgTable(
  "stock_movements",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id),
    movementType: stockMovementTypeEnum("movement_type").notNull(),
    quantity: integer("quantity").notNull(), // positive = in, negative = out
    stockBefore: integer("stock_before").notNull(),
    stockAfter: integer("stock_after").notNull(),
    unitCost: numeric("unit_cost", { precision: 12, scale: 2 }),
    referenceType: varchar("reference_type", { length: 50 }), // 'sale', 'purchase', 'inventory', 'manual', etc.
    referenceId: integer("reference_id"),
    referenceLocalId: varchar("reference_local_id", { length: 255 }),
    userId: integer("user_id").references(() => users.id),
    note: text("note"),
    ...timestamps,
  },
  (t) => [
    index("stock_movements_product_id_idx").on(t.productId),
    index("stock_movements_type_idx").on(t.movementType),
    index("stock_movements_created_at_idx").on(t.createdAt),
    index("stock_movements_reference_idx").on(t.referenceType, t.referenceId),
  ]
);

// Inventories
export const inventories = pgTable("inventories", {
  id: serial("id").primaryKey(),
  inventoryNumber: varchar("inventory_number", { length: 50 }).notNull(),
  // Titre lisible choisi par l'utilisateur (ex : « Comptage mensuel »).
  label: varchar("label", { length: 255 }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  // draft | completed | archived
  status: varchar("status", { length: 20 }).notNull().default("draft"),
  // Inventaire partiel : si renseigné, seule cette catégorie est comptée.
  categoryId: integer("category_id").references(() => categories.id),
  notes: text("notes"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  ...timestamps,
});

export const inventoryItems = pgTable(
  "inventory_items",
  {
    id: serial("id").primaryKey(),
    inventoryId: integer("inventory_id")
      .notNull()
      .references(() => inventories.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id),
    systemStock: integer("system_stock").notNull(),
    countedStock: integer("counted_stock"),
    difference: integer("difference"),
    note: text("note"),
    ...timestamps,
  },
  (t) => [
    index("inventory_items_inventory_id_idx").on(t.inventoryId),
    index("inventory_items_product_id_idx").on(t.productId),
  ]
);

// Payments (for both sales and purchases; credits tracked here too)
export const payments = pgTable(
  "payments",
  {
    id: serial("id").primaryKey(),
    paymentableType: varchar("paymentable_type", { length: 50 }).notNull(), // 'sale' or 'purchase'
    paymentableId: integer("paymentable_id").notNull(),
    customerId: integer("customer_id").references(() => customers.id),
    supplierId: integer("supplier_id").references(() => suppliers.id),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    method: paymentMethodEnum("method").notNull(),
    reference: varchar("reference", { length: 255 }),
    note: text("note"),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    isOffline: boolean("is_offline").notNull().default(false),
    localId: varchar("local_id", { length: 255 }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("payments_local_id_idx").on(t.localId),
    index("payments_paymentable_idx").on(t.paymentableType, t.paymentableId),
    index("payments_customer_id_idx").on(t.customerId),
    index("payments_supplier_id_idx").on(t.supplierId),
  ]
);

// Customer Debt payments/history - additional tracking
export const customerDebtLogs = pgTable(
  "customer_debt_logs",
  {
    id: serial("id").primaryKey(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    saleId: integer("sale_id").references(() => sales.id),
    paymentId: integer("payment_id").references(() => payments.id),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    type: varchar("type", { length: 20 }).notNull(), // 'charge' (added debt) or 'payment' (reduced debt)
    note: text("note"),
    userId: integer("user_id").references(() => users.id),
    ...timestamps,
  },
  (t) => [index("customer_debt_logs_customer_idx").on(t.customerId)]
);

// Supplier Debt logs
export const supplierDebtLogs = pgTable(
  "supplier_debt_logs",
  {
    id: serial("id").primaryKey(),
    supplierId: integer("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    purchaseId: integer("purchase_id").references(() => purchases.id),
    paymentId: integer("payment_id").references(() => payments.id),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    type: varchar("type", { length: 20 }).notNull(), // 'charge' or 'payment'
    note: text("note"),
    userId: integer("user_id").references(() => users.id),
    ...timestamps,
  },
  (t) => [index("supplier_debt_logs_supplier_idx").on(t.supplierId)]
);

// Audit log
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => users.id),
    username: varchar("username", { length: 100 }),
    action: varchar("action", { length: 100 }).notNull(),
    entityType: varchar("entity_type", { length: 50 }).notNull(),
    entityId: varchar("entity_id", { length: 100 }),
    oldValues: jsonb("old_values"),
    newValues: jsonb("new_values"),
    ip: varchar("ip", { length: 50 }),
    deviceId: varchar("device_id", { length: 255 }),
    note: text("note"),
    ...timestamps,
  },
  (t) => [
    index("audit_logs_user_id_idx").on(t.userId),
    index("audit_logs_action_idx").on(t.action),
    index("audit_logs_entity_idx").on(t.entityType, t.entityId),
    index("audit_logs_created_at_idx").on(t.createdAt),
  ]
);

// Sync operations queue
export const syncOperations = pgTable(
  "sync_operations",
  {
    id: serial("id").primaryKey(),
    localId: varchar("local_id", { length: 255 }).notNull(),
    deviceId: varchar("device_id", { length: 255 }).notNull(),
    userId: integer("user_id"),
    operationType: varchar("operation_type", { length: 100 }).notNull(),
    entityType: varchar("entity_type", { length: 100 }).notNull(),
    data: jsonb("data").notNull(),
    status: syncStatusEnum("status").notNull().default("pending"),
    errorMessage: text("error_message"),
    attempts: integer("attempts").notNull().default(0),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    syncedAt: timestamp("synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("sync_ops_local_id_idx").on(t.localId),
    index("sync_ops_status_idx").on(t.status),
    index("sync_ops_device_idx").on(t.deviceId),
    index("sync_ops_created_idx").on(t.createdAt),
  ]
);

// Sessions (for cookie-based auth)
export const sessions = pgTable(
  "sessions",
  {
    id: serial("id").primaryKey(),
    token: varchar("token", { length: 255 }).notNull(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ipAddress: varchar("ip_address", { length: 50 }),
    userAgent: text("user_agent"),
  },
  (t) => [
    uniqueIndex("sessions_token_idx").on(t.token),
    index("sessions_user_id_idx").on(t.userId),
    index("sessions_expires_idx").on(t.expiresAt),
  ]
);

// ============
// RELATIONS
// ============
export const usersRelations = relations(users, ({ many }) => ({
  sales: many(sales),
  purchases: many(purchases),
  auditLogs: many(auditLogs),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const suppliersRelations = relations(suppliers, ({ many }) => ({
  products: many(products),
  purchases: many(purchases),
}));

export const customersRelations = relations(customers, ({ many }) => ({
  sales: many(sales),
  debtLogs: many(customerDebtLogs),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  supplier: one(suppliers, {
    fields: [products.supplierId],
    references: [suppliers.id],
  }),
  saleItems: many(saleItems),
  stockMovements: many(stockMovements),
}));

export const salesRelations = relations(sales, ({ one, many }) => ({
  customer: one(customers, {
    fields: [sales.customerId],
    references: [customers.id],
  }),
  user: one(users, { fields: [sales.userId], references: [users.id] }),
  items: many(saleItems),
  payments: many(payments),
}));

export const saleItemsRelations = relations(saleItems, ({ one }) => ({
  sale: one(sales, { fields: [saleItems.saleId], references: [sales.id] }),
  product: one(products, {
    fields: [saleItems.productId],
    references: [products.id],
  }),
}));

export const purchasesRelations = relations(purchases, ({ one, many }) => ({
  supplier: one(suppliers, {
    fields: [purchases.supplierId],
    references: [suppliers.id],
  }),
  user: one(users, { fields: [purchases.userId], references: [users.id] }),
  items: many(purchaseItems),
  payments: many(payments),
}));

export const purchaseItemsRelations = relations(purchaseItems, ({ one }) => ({
  purchase: one(purchases, {
    fields: [purchaseItems.purchaseId],
    references: [purchases.id],
  }),
  product: one(products, {
    fields: [purchaseItems.productId],
    references: [products.id],
  }),
}));

export const stockMovementsRelations = relations(stockMovements, ({ one }) => ({
  product: one(products, {
    fields: [stockMovements.productId],
    references: [products.id],
  }),
  user: one(users, {
    fields: [stockMovements.userId],
    references: [users.id],
  }),
}));

export const inventoriesRelations = relations(inventories, ({ one, many }) => ({
  user: one(users, { fields: [inventories.userId], references: [users.id] }),
  items: many(inventoryItems),
}));

export const inventoryItemsRelations = relations(inventoryItems, ({ one }) => ({
  inventory: one(inventories, {
    fields: [inventoryItems.inventoryId],
    references: [inventories.id],
  }),
  product: one(products, {
    fields: [inventoryItems.productId],
    references: [products.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  user: one(users, { fields: [payments.userId], references: [users.id] }),
  customer: one(customers, {
    fields: [payments.customerId],
    references: [customers.id],
  }),
  supplier: one(suppliers, {
    fields: [payments.supplierId],
    references: [suppliers.id],
  }),
}));
