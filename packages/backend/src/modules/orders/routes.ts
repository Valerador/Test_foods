import type { FastifyPluginAsync } from "fastify";
import { orderService } from "./service.js";
import {
  orderQuerySchema,
  orderIdParamSchema,
  updateStatusBodySchema,
  assignCourierBodySchema,
  cancelOrderBodySchema,
} from "./schemas.js";

export const orderRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/orders - List orders with filtering, sorting, pagination, and fuzzy search
  fastify.get("/", async (req, reply) => {
    const query = orderQuerySchema.parse(req.query);
    const result = await orderService.listOrders(query);
    return reply.send(result);
  });

  // GET /api/orders/:id - Single order details with audit history
  fastify.get("/:id", async (req, reply) => {
    const { id } = orderIdParamSchema.parse(req.params);
    const order = await orderService.getOrderById(id);
    return reply.send(order);
  });

  // PATCH /api/orders/:id/status - Update order status (FSM + OCC)
  fastify.patch("/:id/status", async (req, reply) => {
    const { id } = orderIdParamSchema.parse(req.params);
    const body = updateStatusBodySchema.parse(req.body);
    const updated = await orderService.updateStatus(id, body);
    return reply.send(updated);
  });

  // PATCH /api/orders/:id/courier - Assign or reassign courier (Limit + OCC)
  fastify.patch("/:id/courier", async (req, reply) => {
    const { id } = orderIdParamSchema.parse(req.params);
    const body = assignCourierBodySchema.parse(req.body);
    const updated = await orderService.assignCourier(id, body);
    return reply.send(updated);
  });

  // POST /api/orders/:id/cancel - Cancel order (Business rule + OCC)
  fastify.post("/:id/cancel", async (req, reply) => {
    const { id } = orderIdParamSchema.parse(req.params);
    const body = cancelOrderBodySchema.parse(req.body);
    const cancelled = await orderService.cancelOrder(id, body);
    return reply.send(cancelled);
  });
};
