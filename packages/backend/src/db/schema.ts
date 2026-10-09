import {
  pgTable,
  text,
  timestamp,
  integer,
  numeric,
  uuid,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

export const orderStatusEnum = pgEnum("order_status", [
  "new",
  "accepted",
  "preparing",
  "ready",
  "picked_up",
  "delivered",
  "cancelled",
]);

export const restaurants = pgTable(
  "restaurants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    address: text("address").notNull(),
    phone: text("phone"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_restaurants_name").on(table.name),
  ]
);

export const couriers = pgTable(
  "couriers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    phone: text("phone"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_couriers_name").on(table.name),
  ]
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    status: orderStatusEnum("status").default("new").notNull(),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone"),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "restrict" }),
    courierId: uuid("courier_id").references(() => couriers.id, {
      onDelete: "set null",
    }),
    deliveryAddress: text("delivery_address").notNull(),
    amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
    version: integer("version").default(1).notNull(), // Optimistic Concurrency Control
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_orders_status").on(table.status),
    index("idx_orders_restaurant").on(table.restaurantId),
    index("idx_orders_courier").on(table.courierId),
    index("idx_orders_created_at").on(table.createdAt),
    // GIN trigram index for fuzzy address search with typo tolerance
    index("idx_orders_address_trgm").using("gin", sql`${table.deliveryAddress} gin_trgm_ops`),
  ]
);

export const orderAuditLogs = pgTable(
  "order_audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    actionType: text("action_type").notNull(), // e.g. "status_changed", "courier_assigned", "order_cancelled"
    oldStatus: orderStatusEnum("old_status"),
    newStatus: orderStatusEnum("new_status"),
    courierId: uuid("courier_id").references(() => couriers.id, { onDelete: "set null" }),
    details: text("details").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_audit_order_id").on(table.orderId),
    index("idx_audit_created_at").on(table.createdAt),
  ]
);

// Relations
export const restaurantsRelations = relations(restaurants, ({ many }) => ({
  orders: many(orders),
}));

export const couriersRelations = relations(couriers, ({ many }) => ({
  orders: many(orders),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  restaurant: one(restaurants, {
    fields: [orders.restaurantId],
    references: [restaurants.id],
  }),
  courier: one(couriers, {
    fields: [orders.courierId],
    references: [couriers.id],
  }),
  auditLogs: many(orderAuditLogs),
}));

export const orderAuditLogsRelations = relations(orderAuditLogs, ({ one }) => ({
  order: one(orders, {
    fields: [orderAuditLogs.orderId],
    references: [orders.id],
  }),
  courier: one(couriers, {
    fields: [orderAuditLogs.courierId],
    references: [couriers.id],
  }),
}));

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type Restaurant = typeof restaurants.$inferSelect;
export type Courier = typeof couriers.$inferSelect;
export type OrderAuditLog = typeof orderAuditLogs.$inferSelect;
export type OrderStatus = (typeof orderStatusEnum.enumValues)[number];
