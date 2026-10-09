import type { FastifyPluginAsync } from "fastify";
import { courierService } from "./service.js";

export const courierRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/couriers - List couriers with active load
  fastify.get("/", async (req, reply) => {
    const couriers = await courierService.listCouriers();
    return reply.send(couriers);
  });
};
