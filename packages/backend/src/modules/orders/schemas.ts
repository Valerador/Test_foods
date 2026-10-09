import { z } from "zod";

export const orderStatusSchema = z.enum([
  "new",
  "accepted",
  "preparing",
  "ready",
  "picked_up",
  "delivered",
  "cancelled",
]);

export const orderQuerySchema = z.object({
  status: orderStatusSchema.optional(),
  restaurantId: z.string().uuid().optional(),
  courierId: z.string().uuid().optional(),
  search: z.string().max(255).optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "amount", "status"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const orderIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const updateStatusBodySchema = z.object({
  status: orderStatusSchema,
  version: z.number().int().min(1),
});

export const assignCourierBodySchema = z.object({
  courierId: z.string().uuid().nullable(),
  version: z.number().int().min(1),
});

export const cancelOrderBodySchema = z.object({
  version: z.number().int().min(1),
  reason: z.string().optional(),
});

export type OrderQuery = z.infer<typeof orderQuerySchema>;
export type UpdateStatusBody = z.infer<typeof updateStatusBodySchema>;
export type AssignCourierBody = z.infer<typeof assignCourierBodySchema>;
export type CancelOrderBody = z.infer<typeof cancelOrderBodySchema>;
