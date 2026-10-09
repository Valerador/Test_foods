import type { OrderStatus } from "../../db/schema.js";

/**
 * Finite State Machine (FSM) defining valid order status transitions.
 *
 * Base lifecycle:
 * new -> accepted -> preparing -> ready -> picked_up -> delivered
 *
 * Cancellation:
 * Allowed only BEFORE picked_up (i.e., new, accepted, preparing, ready).
 * Forbidden from picked_up, delivered, and cancelled.
 */

export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  new: ["accepted", "cancelled"],
  accepted: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["picked_up", "cancelled"],
  picked_up: ["delivered"], // Cannot be cancelled once picked up
  delivered: [], // Terminal state
  cancelled: [], // Terminal state
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return false;
  const allowed = ALLOWED_TRANSITIONS[from] || [];
  return allowed.includes(to);
}

export function getAllowedTransitions(currentStatus: OrderStatus): OrderStatus[] {
  return ALLOWED_TRANSITIONS[currentStatus] || [];
}

export function canCancelOrder(currentStatus: OrderStatus): boolean {
  return ["new", "accepted", "preparing", "ready"].includes(currentStatus);
}
