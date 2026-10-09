import { describe, it, expect } from "vitest";
import { getServer, createTestFixtures } from "./setup.js";
import { canTransition, canCancelOrder } from "../src/modules/orders/fsm.js";

describe("FSM Status Transitions & Cancellation", () => {
  it("FSM unit check: valid lifecycle transitions", () => {
    expect(canTransition("new", "accepted")).toBe(true);
    expect(canTransition("accepted", "preparing")).toBe(true);
    expect(canTransition("preparing", "ready")).toBe(true);
    expect(canTransition("ready", "picked_up")).toBe(true);
    expect(canTransition("picked_up", "delivered")).toBe(true);
  });

  it("FSM unit check: valid cancellation states", () => {
    expect(canCancelOrder("new")).toBe(true);
    expect(canCancelOrder("accepted")).toBe(true);
    expect(canCancelOrder("preparing")).toBe(true);
    expect(canCancelOrder("ready")).toBe(true);
    // Cancellation forbidden from picked_up, delivered, cancelled
    expect(canCancelOrder("picked_up")).toBe(false);
    expect(canCancelOrder("delivered")).toBe(false);
    expect(canCancelOrder("cancelled")).toBe(false);
  });

  it("API Integration: step through full valid lifecycle via PATCH /api/orders/:id/status", async () => {
    const server = getServer();
    const { order } = await createTestFixtures();

    // 1. new -> accepted
    let res = await server.inject({
      method: "PATCH",
      url: `/api/orders/${order.id}/status`,
      payload: { status: "accepted", version: 1 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("accepted");
    expect(res.json().version).toBe(2);

    // 2. accepted -> preparing
    res = await server.inject({
      method: "PATCH",
      url: `/api/orders/${order.id}/status`,
      payload: { status: "preparing", version: 2 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("preparing");
    expect(res.json().version).toBe(3);

    // 3. preparing -> ready
    res = await server.inject({
      method: "PATCH",
      url: `/api/orders/${order.id}/status`,
      payload: { status: "ready", version: 3 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("ready");
    expect(res.json().version).toBe(4);

    // 4. ready -> picked_up
    res = await server.inject({
      method: "PATCH",
      url: `/api/orders/${order.id}/status`,
      payload: { status: "picked_up", version: 4 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("picked_up");
    expect(res.json().version).toBe(5);

    // 5. picked_up -> delivered
    res = await server.inject({
      method: "PATCH",
      url: `/api/orders/${order.id}/status`,
      payload: { status: "delivered", version: 5 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("delivered");
    expect(res.json().version).toBe(6);
  });

  it("API Integration: rejects invalid transitions with HTTP 422", async () => {
    const server = getServer();
    const { order } = await createTestFixtures();

    // Trying new -> delivered (skipping steps)
    const res = await server.inject({
      method: "PATCH",
      url: `/api/orders/${order.id}/status`,
      payload: { status: "delivered", version: 1 },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().code).toBe("BUSINESS_RULE_VIOLATION");
    expect(res.json().message).toContain("Недопустимый переход статуса");
  });

  it("API Integration: cancels order before picked_up, but rejects after picked_up with HTTP 422", async () => {
    const server = getServer();
    const { order } = await createTestFixtures();

    // Move to ready
    await server.inject({
      method: "PATCH",
      url: `/api/orders/${order.id}/status`,
      payload: { status: "accepted", version: 1 },
    });
    await server.inject({
      method: "PATCH",
      url: `/api/orders/${order.id}/status`,
      payload: { status: "preparing", version: 2 },
    });
    await server.inject({
      method: "PATCH",
      url: `/api/orders/${order.id}/status`,
      payload: { status: "ready", version: 3 },
    });
    await server.inject({
      method: "PATCH",
      url: `/api/orders/${order.id}/status`,
      payload: { status: "picked_up", version: 4 },
    });

    // Try to cancel picked_up order
    const cancelRes = await server.inject({
      method: "POST",
      url: `/api/orders/${order.id}/cancel`,
      payload: { version: 5, reason: "Клиент передумал" },
    });

    expect(cancelRes.statusCode).toBe(422);
    expect(cancelRes.json().message).toContain("Заказ нельзя отменить: на этапе 'picked_up'");
  });
});
