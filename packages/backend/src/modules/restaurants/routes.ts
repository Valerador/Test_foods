import type { FastifyPluginAsync } from "fastify";
import { restaurantService } from "./service.js";

export const restaurantRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/restaurants - List all restaurants
  fastify.get("/", async (req, reply) => {
    const restaurants = await restaurantService.listRestaurants();
    return reply.send(restaurants);
  });
};
