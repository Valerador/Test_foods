import Fastify from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import { ZodError } from "zod";
import { orderRoutes } from "./modules/orders/routes.js";
import { courierRoutes } from "./modules/couriers/routes.js";
import { restaurantRoutes } from "./modules/restaurants/routes.js";
import {
  ConcurrencyConflictError,
  BusinessRuleError,
  NotFoundError,
} from "./modules/orders/service.js";

export async function buildServer() {
  const fastify = Fastify({
    logger: process.env.NODE_ENV === "test" ? false : {
      level: "info",
      transport: {
        target: "pino-pretty",
        options: {
          translateTime: "HH:MM:ss Z",
          ignore: "pid,hostname",
        },
      },
    },
  });

  // Plugins
  await fastify.register(cors, {
    origin: true, // Allow frontend dev server and any origin in dev
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  });

  await fastify.register(sensible);

  // Custom Error Handler
  fastify.setErrorHandler((error, request, reply) => {
    // 1. Zod Validation Error -> 400
    if (error instanceof ZodError) {
      return reply.status(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: "Ошибка валидации входных данных",
        issues: error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      });
    }

    // 2. Concurrency Conflict (OCC) -> 409
    if (error instanceof ConcurrencyConflictError) {
      return reply.status(409).send({
        statusCode: 409,
        error: "Conflict",
        message: error.message,
        code: "CONCURRENCY_CONFLICT",
      });
    }

    // 3. Business Rule Validation / FSM Error -> 422
    if (error instanceof BusinessRuleError) {
      return reply.status(422).send({
        statusCode: 422,
        error: "Unprocessable Entity",
        message: error.message,
        code: "BUSINESS_RULE_VIOLATION",
      });
    }

    // 4. Resource Not Found -> 404
    if (error instanceof NotFoundError) {
      return reply.status(404).send({
        statusCode: 404,
        error: "Not Found",
        message: error.message,
        code: "NOT_FOUND",
      });
    }

    // 5. Default Fastify error handling
    const err = error as { statusCode?: number; name?: string; message?: string };
    if (err && err.statusCode) {
      return reply.status(err.statusCode).send({
        statusCode: err.statusCode,
        error: err.name || "Error",
        message: err.message || "An error occurred",
      });
    }

    // 6. Internal Server Error -> 500
    request.log.error(error);
    return reply.status(500).send({
      statusCode: 500,
      error: "Internal Server Error",
      message: "Произошла непредвиденная ошибка сервера",
    });
  });

  // Health check route
  fastify.get("/api/health", async () => {
    return { status: "ok", timestamp: new Date().toISOString() };
  });

  // Module routes
  await fastify.register(orderRoutes, { prefix: "/api/orders" });
  await fastify.register(courierRoutes, { prefix: "/api/couriers" });
  await fastify.register(restaurantRoutes, { prefix: "/api/restaurants" });

  return fastify;
}
