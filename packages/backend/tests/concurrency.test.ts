import { describe, it, expect } from "vitest";
import { getServer, createTestFixtures } from "./setup.js";
import { db } from "../src/db/connection.js";
import { couriers } from "../src/db/schema.js";

describe("Optimistic Concurrency Control (OCC)", () => {
  it("detects conflict when two operators edit the same order concurrently", async () => {
    const server = getServer();
    const { order, courier: courier1 } = await createTestFixtures();

    const [courier2] = await db
      .insert(couriers)
      .values({
        name: "Второй Курьер",
        phone: "+7 (999) 000-00-02",
      })
      .returning();

    // 1. Operator A and Operator B both see order at version 1
    const orderVersion = order.version; // 1

    // 2. Operator B updates order: assigns Courier 2
    const resB = await server.inject({
      method: "PATCH",
      url: `/api/orders/${order.id}/courier`,
      payload: { courierId: courier2.id, version: orderVersion },
    });
    expect(resB.statusCode).toBe(200);
    expect(resB.json().version).toBe(2);
    expect(resB.json().courierId).toBe(courier2.id);

    // 3. Operator A still has stale version 1 and tries to assign Courier 1
    const resA = await server.inject({
      method: "PATCH",
      url: `/api/orders/${order.id}/courier`,
      payload: { courierId: courier1.id, version: orderVersion }, // version 1 is now stale!
    });

    // Must return HTTP 409 Conflict with detailed context about current courier
    expect(resA.statusCode).toBe(409);
    expect(resA.json().code).toBe("CONCURRENCY_CONFLICT");
    expect(resA.json().message).toContain("Конфликт версий");
    expect(resA.json().message).toContain("Второй Курьер");

    // 4. Operator A refreshes data, gets version 2, and retries successfully
    const refreshed = await server.inject({
      method: "GET",
      url: `/api/orders/${order.id}`,
    });
    expect(refreshed.statusCode).toBe(200);
    expect(refreshed.json().version).toBe(2);

    const retryRes = await server.inject({
      method: "PATCH",
      url: `/api/orders/${order.id}/courier`,
      payload: { courierId: courier1.id, version: refreshed.json().version },
    });
    expect(retryRes.statusCode).toBe(200);
    expect(retryRes.json().version).toBe(3);
    expect(retryRes.json().courierId).toBe(courier1.id);
  });

  it("handles race condition with concurrent Promise.all: exactly one succeeds, one gets 409", async () => {
    const server = getServer();
    const { order } = await createTestFixtures();

    // Fire two simultaneous status update requests with version 1
    const [res1, res2] = await Promise.all([
      server.inject({
        method: "PATCH",
        url: `/api/orders/${order.id}/status`,
        payload: { status: "accepted", version: order.version },
      }),
      server.inject({
        method: "PATCH",
        url: `/api/orders/${order.id}/status`,
        payload: { status: "accepted", version: order.version },
      }),
    ]);

    const statusCodes = [res1.statusCode, res2.statusCode].sort();
    // One must be 200 OK, the other must be 409 Conflict
    expect(statusCodes).toEqual([200, 409]);
  });

  it("provides detailed warning with current status when status is changed concurrently", async () => {
    const server = getServer();
    const { order } = await createTestFixtures();

    // 1. Operator B changes status to 'accepted'
    const resB = await server.inject({
      method: "PATCH",
      url: `/api/orders/${order.id}/status`,
      payload: { status: "accepted", version: order.version },
    });
    expect(resB.statusCode).toBe(200);

    // 2. Operator A tries to change status with stale version
    const resA = await server.inject({
      method: "PATCH",
      url: `/api/orders/${order.id}/status`,
      payload: { status: "accepted", version: order.version },
    });
    expect(resA.statusCode).toBe(409);
    expect(resA.json().code).toBe("CONCURRENCY_CONFLICT");
    expect(resA.json().message).toContain("Конфликт версий");
    expect(resA.json().message).toContain("Принят");
  });
});

