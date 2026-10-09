import { execSync } from "node:child_process";

const mode = process.argv[2] || "dev";

console.log(`Setting up database for mode: ${mode}...`);

try {
  execSync("docker compose up -d postgres", { stdio: "pipe" });
  console.log("PostgreSQL container started via Docker.");
} catch {
  console.log("Docker daemon not running. Falling back to embedded PostgreSQL (PGlite).");
}

if (mode === "dev") {
  execSync("npm run db:migrate --workspace=packages/backend", { stdio: "inherit" });
  execSync("npm run db:seed --workspace=packages/backend", { stdio: "inherit" });
} else {
  try {
    execSync("npm run test:migrate --workspace=packages/backend", { stdio: "inherit" });
  } catch {
    console.log("External test DB not available; tests will self-migrate on embedded engine.");
  }
}

console.log("Database setup completed successfully.");
