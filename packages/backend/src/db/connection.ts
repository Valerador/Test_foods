import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import postgres from "postgres";
import * as schema from "./schema.js";
import dotenv from "dotenv";
import net from "net";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

dotenv.config();

function getWorkspaceDataDir(): string {
  try {
    let cur = path.dirname(fileURLToPath(import.meta.url));
    while (cur && path.dirname(cur) !== cur) {
      const pkgPath = path.join(cur, "package.json");
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
        if (pkg.workspaces) {
          return path.resolve(cur, ".data", "orderflow_db");
        }
      }
      cur = path.dirname(cur);
    }
  } catch {
    // fallback
  }
  return path.resolve(process.cwd(), ".data", "orderflow_db");
}

const connectionString =
  process.env.DATABASE_URL || "postgresql://postgres:postgrespassword@localhost:5432/orderflow";

function isPostgresReachable(port = 5432, host = "127.0.0.1"): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(600);
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("error", () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

// Parse port and host from connectionString if applicable
let targetPort = 5432;
let targetHost = "127.0.0.1";
try {
  const url = new URL(connectionString);
  targetPort = Number(url.port) || 5432;
  targetHost = url.hostname || "127.0.0.1";
} catch {
  // fallback default
}

const isLivePostgresAvailable =
  process.env.USE_PGLITE !== "true" &&
  process.env.NODE_ENV !== "test" &&
  (await isPostgresReachable(targetPort, targetHost));

export let isUsingPglite = !isLivePostgresAvailable;
let pgliteInstance: PGlite | null = null;
let postgresClient: any = null;

if (isLivePostgresAvailable) {
  postgresClient = postgres(connectionString, {
    max: 20,
    idle_timeout: 20,
    connect_timeout: 3,
    onnotice: () => {},
  });
} else {
  // Embedded PostgreSQL with persistent data directory for dev, in-memory for tests
  const isTest = process.env.NODE_ENV === "test";
  const dataDir = isTest
    ? undefined
    : getWorkspaceDataDir();

  if (dataDir && !fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  pgliteInstance = dataDir
    ? new PGlite(dataDir, { extensions: { pg_trgm } })
    : new PGlite({ extensions: { pg_trgm } });
}

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { PgliteDatabase } from "drizzle-orm/pglite";

export type AppDatabase = PgliteDatabase<typeof schema> | PostgresJsDatabase<typeof schema>;

export const db: AppDatabase = isUsingPglite
  ? (drizzlePglite(pgliteInstance!, { schema }) as AppDatabase)
  : (drizzlePostgres(postgresClient, { schema }) as AppDatabase);

/**
 * Universal raw tagged template executor that works identically on both postgres.js and PGlite
 */
export async function client(strings: TemplateStringsArray, ...values: any[]): Promise<any> {
  let query = strings[0];
  for (let i = 0; i < values.length; i++) {
    query += values[i] + strings[i + 1];
  }

  if (isUsingPglite && pgliteInstance) {
    return await pgliteInstance.exec(query);
  } else if (postgresClient) {
    return await postgresClient.unsafe(query);
  }
}

export async function closeDbConnection() {
  if (postgresClient) {
    await postgresClient.end({ timeout: 2 });
  }
  if (pgliteInstance) {
    await pgliteInstance.close();
  }
}
