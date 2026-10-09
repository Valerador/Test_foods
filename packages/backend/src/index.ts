import dotenv from "dotenv";
import { buildServer } from "./server.js";

dotenv.config();

const port = Number(process.env.PORT) || 3001;
const host = process.env.HOST || "0.0.0.0";

async function start() {
  const server = await buildServer();

  try {
    await server.listen({ port, host });
    console.log(`Foodster Backend listening on http://${host}:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

start();
