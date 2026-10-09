import { describe, it, expect } from "vitest";
import { getServer, createTestFixtures } from "./setup.js";
import { db } from "../src/db/connection.js";
import { orders } from "../src/db/schema.js";

describe("Boundary and Edge Case Scenarios", () => {
  describe("1. Address Search with Special Characters and SQL Injection", () => {
    it("safely handles special characters (%, ', \\, _) without server crash or SQL injection", async () => {
      const server = getServer();
      const { restaurant } = await createTestFixtures();

      await db.insert(orders).values([
        {
          status: "new",
          customerName: "Спец Символ 1",
          restaurantId: restaurant.id,
          deliveryAddress: "ул. 100% Победы, д. 1_A",
          amount: "500.00",
        },
        {
          status: "new",
          customerName: "Спец Символ 2",
          restaurantId: restaurant.id,
          deliveryAddress: "ул. Д'Артаньяна, д. 2\\3",
          amount: "700.00",
        },
        {
          status: "new",
          customerName: "Обычный Клиент",
          restaurantId: restaurant.id,
          deliveryAddress: "Невский проспект, дом 10",
          amount: "1000.00",
        },
      ]);

      // 1. Search with single quote (')
      const resSingleQuote = await server.inject({
        method: "GET",
        url: "/api/orders?search='",
      });
      expect(resSingleQuote.statusCode).toBe(200);

      // 2. Search with percent (%)
      const resPercent = await server.inject({
        method: "GET",
        url: "/api/orders?search=%",
      });
      expect(resPercent.statusCode).toBe(200);

      // 3. Search with backslash (\)
      const resBackslash = await server.inject({
        method: "GET",
        url: "/api/orders?search=\\",
      });
      expect(resBackslash.statusCode).toBe(200);

      // 4. Search with underscore (_)
      const resUnderscore = await server.inject({
        method: "GET",
        url: "/api/orders?search=_",
      });
      expect(resUnderscore.statusCode).toBe(200);

      // 5. Search with SQL injection attempt (' OR 1=1 --)
      const resSqlInjection = await server.inject({
        method: "GET",
        url: "/api/orders?search=' OR 1=1 --",
      });
      expect(resSqlInjection.statusCode).toBe(200);
      // Ensure it doesn't return all orders bypass or crash
      const injectionData = resSqlInjection.json();
      expect(injectionData).toBeDefined();

      // 6. Search specifically finding address with special characters
      const resAddressWithQuote = await server.inject({
        method: "GET",
        url: "/api/orders?search=Артаньян",
      });
      expect(resAddressWithQuote.statusCode).toBe(200);
      expect(resAddressWithQuote.json().items.length).toBeGreaterThanOrEqual(1);
      expect(resAddressWithQuote.json().items[0].deliveryAddress).toContain("Д'Артаньяна");
    });
  });

  describe("2. Invalid and Non-existent UUID in Route Parameters and Queries", () => {
    it("returns 400 Bad Request with validation issues when route :id is not a valid UUID", async () => {
      const server = getServer();

      // GET /api/orders/:id with invalid UUID
      const getRes = await server.inject({
        method: "GET",
        url: "/api/orders/not-a-valid-uuid-123",
      });
      expect(getRes.statusCode).toBe(400);
      const getBody = getRes.json();
      expect(getBody.error).toBe("Bad Request");
      expect(getBody.issues[0].path).toBe("id");
      expect(getBody.issues[0].message).toMatch(/uuid/i);

      // PATCH /api/orders/:id/status with invalid UUID
      const patchStatusRes = await server.inject({
        method: "PATCH",
        url: "/api/orders/invalid-uuid/status",
        payload: { status: "ready", version: 1 },
      });
      expect(patchStatusRes.statusCode).toBe(400);
      expect(patchStatusRes.json().issues[0].path).toBe("id");

      // PATCH /api/orders/:id/courier with invalid UUID
      const patchCourierRes = await server.inject({
        method: "PATCH",
        url: "/api/orders/12345/courier",
        payload: { courierId: null, version: 1 },
      });
      expect(patchCourierRes.statusCode).toBe(400);

      // POST /api/orders/:id/cancel with invalid UUID
      const cancelRes = await server.inject({
        method: "POST",
        url: "/api/orders/xyz/cancel",
        payload: { version: 1 },
      });
      expect(cancelRes.statusCode).toBe(400);
    });

    it("returns 400 Bad Request when query parameters contain invalid UUIDs", async () => {
      const server = getServer();

      const queryRes1 = await server.inject({
        method: "GET",
        url: "/api/orders?restaurantId=not-a-uuid",
      });
      expect(queryRes1.statusCode).toBe(400);
      expect(queryRes1.json().issues[0].path).toBe("restaurantId");

      const queryRes2 = await server.inject({
        method: "GET",
        url: "/api/orders?courierId=not-a-uuid",
      });
      expect(queryRes2.statusCode).toBe(400);
      expect(queryRes2.json().issues[0].path).toBe("courierId");
    });

    it("returns 404 Not Found when valid UUID does not exist in database", async () => {
      const server = getServer();
      const nonExistentId = "a0000000-0000-0000-0000-000000000000";

      const res = await server.inject({
        method: "GET",
        url: `/api/orders/${nonExistentId}`,
      });
      expect(res.statusCode).toBe(404);
      expect(res.json().code).toBe("NOT_FOUND");
    });
  });

  describe("3. Blocking Transition to 'ready' when Assigned Courier has 3 Active Deliveries", () => {
    it("blocks transition to 'ready' if courier is assigned and already has 3 active deliveries (ready/picked_up)", async () => {
      const server = getServer();
      const { restaurant, courier } = await createTestFixtures();

      // Create 3 active deliveries assigned to this courier (2 ready, 1 picked_up)
      const [order1] = await db
        .insert(orders)
        .values({
          status: "ready",
          customerName: "Активный Клиент 1",
          restaurantId: restaurant.id,
          courierId: courier.id,
          deliveryAddress: "ул. Пушкина, д. 1",
          amount: "1000.00",
          version: 1,
        })
        .returning();

      await db.insert(orders).values([
        {
          status: "ready",
          customerName: "Активный Клиент 2",
          restaurantId: restaurant.id,
          courierId: courier.id,
          deliveryAddress: "ул. Пушкина, д. 2",
          amount: "1000.00",
          version: 1,
        },
        {
          status: "picked_up",
          customerName: "Активный Клиент 3",
          restaurantId: restaurant.id,
          courierId: courier.id,
          deliveryAddress: "ул. Пушкина, д. 3",
          amount: "1000.00",
          version: 1,
        },
      ]);

      // Create a 4th order in 'preparing' status with courier assigned in advance
      const [order4] = await db
        .insert(orders)
        .values({
          status: "preparing",
          customerName: "Клиент В Очереди",
          restaurantId: restaurant.id,
          courierId: courier.id,
          deliveryAddress: "ул. Пушкина, д. 4",
          amount: "1500.00",
          version: 1,
        })
        .returning();

      // Kitchen finishes preparation and tries to set order4 status to 'ready'
      const readyRes = await server.inject({
        method: "PATCH",
        url: `/api/orders/${order4.id}/status`,
        payload: { status: "ready", version: 1 },
      });

      // MUST be blocked because courier already has 3 active orders!
      expect(readyRes.statusCode).toBe(422);
      expect(readyRes.json().code).toBe("BUSINESS_RULE_VIOLATION");
      expect(readyRes.json().message).toContain("назначенный курьер уже выполняет максимум (3) активных доставок");

      // Verify that order4 status is still 'preparing' and version is still 1
      const checkRes = await server.inject({
        method: "GET",
        url: `/api/orders/${order4.id}`,
      });
      expect(checkRes.json().status).toBe("preparing");
      expect(checkRes.json().version).toBe(1);

      // Now one of active deliveries completes (ready -> picked_up -> delivered)
      await server.inject({
        method: "PATCH",
        url: `/api/orders/${order1.id}/status`,
        payload: { status: "picked_up", version: 1 },
      });
      await server.inject({
        method: "PATCH",
        url: `/api/orders/${order1.id}/status`,
        payload: { status: "delivered", version: 2 },
      });

      // Now courier has only 2 active orders. Kitchen re-attempts to move order4 to 'ready'
      const retryReadyRes = await server.inject({
        method: "PATCH",
        url: `/api/orders/${order4.id}/status`,
        payload: { status: "ready", version: 1 },
      });

      expect(retryReadyRes.statusCode).toBe(200);
      expect(retryReadyRes.json().status).toBe("ready");
      expect(retryReadyRes.json().version).toBe(2);
    });
  });

  describe("4. Pagination and Filtering Boundaries", () => {
    it("returns correct pagination metadata for empty results", async () => {
      const server = getServer();

      const res = await server.inject({
        method: "GET",
        url: "/api/orders?search=СовершенноНесуществующийАдрес12345",
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.items).toEqual([]);
      expect(data.pagination.total).toBe(0);
      expect(data.pagination.page).toBe(1);
      expect(data.pagination.totalPages).toBe(1);
    });

    it("rejects invalid page and limit values with 400 Bad Request", async () => {
      const server = getServer();

      // page = 0 (min is 1)
      const resPageZero = await server.inject({
        method: "GET",
        url: "/api/orders?page=0",
      });
      expect(resPageZero.statusCode).toBe(400);

      // limit > 100 (max is 100)
      const resLimitTooHigh = await server.inject({
        method: "GET",
        url: "/api/orders?limit=200",
      });
      expect(resLimitTooHigh.statusCode).toBe(400);

      // invalid sortBy enum
      const resBadSort = await server.inject({
        method: "GET",
        url: "/api/orders?sortBy=hackedColumn",
      });
      expect(resBadSort.statusCode).toBe(400);
    });
  });
});
