import { beforeAll, afterAll, beforeEach } from "vitest";
import { client, db, closeDbConnection } from "../src/db/connection.js";
import { runMigrations } from "../src/db/migrate.js";
import { buildServer } from "../src/server.js";
import { restaurants, couriers, orders, orderAuditLogs } from "../src/db/schema.js";
import type { FastifyInstance } from "fastify";

let server: FastifyInstance;

export function getServer() {
  return server;
}

beforeAll(async () => {
  // Run migrations to ensure all tables, enums, and extensions exist
  await runMigrations();
  server = await buildServer();
  await server.ready();
});

beforeEach(async () => {
  // Truncate tables before each test to guarantee complete test isolation
  await client`TRUNCATE TABLE order_audit_logs, orders, couriers, restaurants CASCADE;`;
});

afterAll(async () => {
  if (server) {
    await server.close();
  }
  await closeDbConnection();
});

// Test fixtures helper
export async function createTestFixtures() {
  const [restaurant] = await db
    .insert(restaurants)
    .values({
      name: "Тестовый Ресторан",
      address: "ул. Тверская, д. 1",
      phone: "+7 (495) 000-00-01",
    })
    .returning();

  const [courier] = await db
    .insert(couriers)
    .values({
      name: "Тестовый Курьер",
      phone: "+7 (999) 000-00-01",
    })
    .returning();

  const [order] = await db
    .insert(orders)
    .values({
      status: "new",
      customerName: "Тестовый Клиент",
      customerPhone: "+7 (916) 000-00-01",
      restaurantId: restaurant.id,
      deliveryAddress: "ул. Арбат, д. 10, кв. 5",
      amount: "1500.00",
      version: 1,
    })
    .returning();

  return { restaurant, courier, order };
}
