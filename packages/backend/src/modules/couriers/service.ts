import { eq, sql } from "drizzle-orm";
import { db } from "../../db/connection.js";
import { couriers, orders } from "../../db/schema.js";

export class CourierService {
  async listCouriers() {
    // List all couriers and calculate their active orders (ready / picked_up)
    const result = await db
      .select({
        id: couriers.id,
        name: couriers.name,
        phone: couriers.phone,
        createdAt: couriers.createdAt,
        activeOrdersCount: sql<number>`(
          SELECT count(*)::int
          FROM orders
          WHERE orders.courier_id = ${couriers.id}
            AND orders.status IN ('ready', 'picked_up')
        )`,
      })
      .from(couriers)
      .orderBy(couriers.name);

    return result.map((c: any) => ({
      ...c,
      activeOrdersCount: Number(c.activeOrdersCount || 0),
      isAvailable: Number(c.activeOrdersCount || 0) < 3,
    }));
  }
}

export const courierService = new CourierService();
