import { describe, it, expect } from "vitest";
import { getServer, createTestFixtures } from "./setup.js";
import { db } from "../src/db/connection.js";
import { orders } from "../src/db/schema.js";

describe("Courier Active Deliveries Limit (Max 3)", () => {
  it("enforces maximum 3 active deliveries (ready/picked_up) per courier", async () => {
    const server = getServer();
    const { restaurant, courier } = await createTestFixtures();

    // Create 3 active orders in 'ready' status already assigned to this courier
    for (let i = 1; i <= 3; i++) {
      await db.insert(orders).values({
        status: "ready",
        customerName: `Клиент ${i}`,
        restaurantId: restaurant.id,
        courierId: courier.id,
        deliveryAddress: `ул. Ленина, д. ${i}`,
        amount: "1000.00",
        version: 1,
      });
    }

    // Create a 4th order in 'ready' status with no courier yet
    const [fourthOrder] = await db
      .insert(orders)
      .values({
        status: "ready",
        customerName: "Клиент 4",
        restaurantId: restaurant.id,
        deliveryAddress: "ул. Ленина, д. 4",
        amount: "1200.00",
        version: 1,
      })
      .returning();

    // Attempt to assign courier to fourth active order
    const res = await server.inject({
      method: "PATCH",
      url: `/api/orders/${fourthOrder.id}/courier`,
      payload: { courierId: courier.id, version: 1 },
    });

    expect(res.statusCode).toBe(422);
    expect(res.json().code).toBe("BUSINESS_RULE_VIOLATION");
    expect(res.json().message).toContain("не может взять заказ: у него уже 3 активных доставок");
  });

  it("allows assigning courier once one of active deliveries transitions to delivered", async () => {
    const server = getServer();
    const { restaurant, courier } = await createTestFixtures();

    // Create 3 active orders
    const createdActive = [];
    for (let i = 1; i <= 3; i++) {
      const [ord] = await db
        .insert(orders)
        .values({
          status: "ready",
          customerName: `Клиент ${i}`,
          restaurantId: restaurant.id,
          courierId: courier.id,
          deliveryAddress: `ул. Мира, д. ${i}`,
          amount: "800.00",
          version: 1,
        })
        .returning();
      createdActive.push(ord);
    }

    // Deliver one of them (ready -> picked_up -> delivered)
    await server.inject({
      method: "PATCH",
      url: `/api/orders/${createdActive[0].id}/status`,
      payload: { status: "picked_up", version: 1 },
    });
    await server.inject({
      method: "PATCH",
      url: `/api/orders/${createdActive[0].id}/status`,
      payload: { status: "delivered", version: 2 },
    });

    // Now courier has only 2 active deliveries!
    // Create new order in 'ready'
    const [newOrder] = await db
      .insert(orders)
      .values({
        status: "ready",
        customerName: "Новый Клиент",
        restaurantId: restaurant.id,
        deliveryAddress: "ул. Лесная, д. 10",
        amount: "1500.00",
        version: 1,
      })
      .returning();

    // Assigning courier now succeeds!
    const assignRes = await server.inject({
      method: "PATCH",
      url: `/api/orders/${newOrder.id}/courier`,
      payload: { courierId: courier.id, version: 1 },
    });

    expect(assignRes.statusCode).toBe(200);
    expect(assignRes.json().courierId).toBe(courier.id);
  });
});
