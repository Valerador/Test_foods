import { describe, it, expect } from "vitest";
import { getServer, createTestFixtures } from "./setup.js";
import { db } from "../src/db/connection.js";
import { orders, restaurants } from "../src/db/schema.js";

describe("Orders Listing, Filtering, Search & Audit Trail", () => {
  it("filters orders by status and restaurant", async () => {
    const server = getServer();
    const { restaurant, courier } = await createTestFixtures();

    const [restaurant2] = await db
      .insert(restaurants)
      .values({
        name: "Второй Ресторан",
        address: "ул. Садовая, д. 5",
      })
      .returning();

    // Create 3 orders with different statuses and restaurants
    await db.insert(orders).values([
      {
        status: "preparing",
        customerName: "Клиент А",
        restaurantId: restaurant.id,
        deliveryAddress: "ул. Тверская, д. 10",
        amount: "500.00",
      },
      {
        status: "ready",
        customerName: "Клиент Б",
        restaurantId: restaurant.id,
        deliveryAddress: "ул. Тверская, д. 20",
        amount: "800.00",
      },
      {
        status: "preparing",
        customerName: "Клиент В",
        restaurantId: restaurant2.id,
        deliveryAddress: "ул. Садовая, д. 30",
        amount: "1200.00",
      },
    ]);

    // 1. Filter by status 'preparing'
    const statusRes = await server.inject({
      method: "GET",
      url: "/api/orders?status=preparing",
    });
    expect(statusRes.statusCode).toBe(200);
    const statusData = statusRes.json();
    expect(statusData.items.length).toBe(2);
    expect(statusData.items.every((o: any) => o.status === "preparing")).toBe(true);

    // 2. Filter by restaurant 1 AND status 'preparing'
    const comboRes = await server.inject({
      method: "GET",
      url: `/api/orders?status=preparing&restaurantId=${restaurant.id}`,
    });
    expect(comboRes.statusCode).toBe(200);
    const comboData = comboRes.json();
    expect(comboData.items.length).toBe(1);
    expect(comboData.items[0].customerName).toBe("Клиент А");
  });

  it("supports fuzzy address search with typo tolerance (pg_trgm)", async () => {
    const server = getServer();
    const { restaurant } = await createTestFixtures();

    await db.insert(orders).values([
      {
        status: "new",
        customerName: "Иван",
        restaurantId: restaurant.id,
        deliveryAddress: "Новослободская улица, дом 45",
        amount: "900.00",
      },
      {
        status: "new",
        customerName: "Петр",
        restaurantId: restaurant.id,
        deliveryAddress: "Проспект Вернадского, дом 12",
        amount: "1100.00",
      },
    ]);

    // Search with intentional typo: 'Новаслобоцкая'
    const searchRes = await server.inject({
      method: "GET",
      url: "/api/orders?search=Новаслобоцкая",
    });
    expect(searchRes.statusCode).toBe(200);
    const data = searchRes.json();
    expect(data.items.length).toBeGreaterThanOrEqual(1);
    expect(data.items[0].deliveryAddress).toContain("Новослободская");
  });

  it("verifies audit trail when updating order status and assigning courier", async () => {
    const server = getServer();
    const { order, courier } = await createTestFixtures();

    // 1. Change status to accepted
    await server.inject({
      method: "PATCH",
      url: `/api/orders/${order.id}/status`,
      payload: { status: "accepted", version: 1 },
    });

    // 2. Assign courier
    await server.inject({
      method: "PATCH",
      url: `/api/orders/${order.id}/courier`,
      payload: { courierId: courier.id, version: 2 },
    });

    // 3. Get single order details with audit trail
    const detailRes = await server.inject({
      method: "GET",
      url: `/api/orders/${order.id}`,
    });

    expect(detailRes.statusCode).toBe(200);
    const detail = detailRes.json();
    expect(detail.version).toBe(3);
    expect(detail.auditLogs.length).toBe(2);

    expect(detail.auditLogs[0].actionType).toBe("status_changed");
    expect(detail.auditLogs[0].oldStatus).toBe("new");
    expect(detail.auditLogs[0].newStatus).toBe("accepted");

    expect(detail.auditLogs[1].actionType).toBe("courier_assigned");
    expect(detail.auditLogs[1].courierId).toBe(courier.id);
  });
});
