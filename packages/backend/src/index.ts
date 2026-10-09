import dotenv from "dotenv";
import { sql } from "drizzle-orm";
import { buildServer } from "./server.js";
import { runMigrations } from "./db/migrate.js";
import { runSeed } from "./db/seed.js";
import { db } from "./db/connection.js";
import { orders } from "./db/schema.js";

dotenv.config();

const port = Number(process.env.PORT) || 3001;
const host = process.env.HOST || "0.0.0.0";

async function start() {
  try {
    // 1. Ensure schema and extensions exist
    await runMigrations();

    // 2. If database is freshly initialized, automatically populate initial seed dataset
    try {
      const orderCountRes = await db.select({ count: sql<number>`count(*)` }).from(orders);
      const count = Number(orderCountRes[0]?.count ?? 0);
      if (count === 0) {
        console.log("No existing orders found. Automatically populating initial seed dataset...");
        await runSeed();
      }
    } catch (seedErr) {
      console.warn("Auto-seed verification warning:", seedErr);
    }

    const server = await buildServer();
    await server.listen({ port, host });
    console.log(`Foodster Backend listening on http://${host}:${port}`);
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

start();
