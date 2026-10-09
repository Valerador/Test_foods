import { eq, and, sql, desc, asc, count } from "drizzle-orm";
import { db } from "../../db/connection.js";
import {
  orders,
  orderAuditLogs,
  restaurants,
  couriers,
  type OrderStatus,
} from "../../db/schema.js";
import { canTransition, canCancelOrder } from "./fsm.js";
import type {
  OrderQuery,
  UpdateStatusBody,
  AssignCourierBody,
  CancelOrderBody,
} from "./schemas.js";

export class ConcurrencyConflictError extends Error {
  public statusCode = 409;
  constructor(message = "Конфликт версий: заказ был изменен другим оператором. Пожалуйста, обновите страницу.") {
    super(message);
    this.name = "ConcurrencyConflictError";
  }
}

export class BusinessRuleError extends Error {
  public statusCode = 422;
  constructor(message: string) {
    super(message);
    this.name = "BusinessRuleError";
  }
}

export class NotFoundError extends Error {
  public statusCode = 404;
  constructor(message = "Заказ не найден") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class OrderService {
  /**
   * List orders with filters, sorting, pagination, and fuzzy address search
   */
  async listOrders(query: OrderQuery) {
    const { status, restaurantId, courierId, search, sortBy, sortOrder, page, limit } = query;
    const offset = (page - 1) * limit;

    const conditions = [];

    if (status) {
      conditions.push(eq(orders.status, status));
    }
    if (restaurantId) {
      conditions.push(eq(orders.restaurantId, restaurantId));
    }
    if (courierId) {
      conditions.push(eq(orders.courierId, courierId));
    }
    if (search && search.trim().length > 0) {
      const trimmed = search.trim();
      // Using pg_trgm fuzzy matching + ILIKE for robust address search with typo tolerance
      conditions.push(
        sql`(${orders.deliveryAddress} ILIKE ${`%${trimmed}%`} OR similarity(${orders.deliveryAddress}, ${trimmed}) > 0.2)`
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Determine sort column
    let orderColumn: any = orders.createdAt;
    if (sortBy === "updatedAt") orderColumn = orders.updatedAt;
    if (sortBy === "amount") orderColumn = orders.amount;
    if (sortBy === "status") orderColumn = orders.status;

    const orderDirection = sortOrder === "asc" ? asc(orderColumn) : desc(orderColumn);

    // Get total count
    const [totalResult] = await db
      .select({ total: count() })
      .from(orders)
      .where(whereClause);

    const total = Number(totalResult?.total || 0);

    // Fetch items with joined restaurant and courier
    const items = await db
      .select({
        id: orders.id,
        status: orders.status,
        customerName: orders.customerName,
        customerPhone: orders.customerPhone,
        restaurantId: orders.restaurantId,
        courierId: orders.courierId,
        deliveryAddress: orders.deliveryAddress,
        amount: orders.amount,
        version: orders.version,
        createdAt: orders.createdAt,
        updatedAt: orders.updatedAt,
        restaurant: {
          id: restaurants.id,
          name: restaurants.name,
          address: restaurants.address,
        },
        courier: {
          id: couriers.id,
          name: couriers.name,
          phone: couriers.phone,
        },
      })
      .from(orders)
      .leftJoin(restaurants, eq(orders.restaurantId, restaurants.id))
      .leftJoin(couriers, eq(orders.courierId, couriers.id))
      .where(whereClause)
      .orderBy(orderDirection)
      .limit(limit)
      .offset(offset);

    return {
      items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Get single order details with full audit logs history
   */
  async getOrderById(id: string) {
    const [order] = await db
      .select({
        id: orders.id,
        status: orders.status,
        customerName: orders.customerName,
        customerPhone: orders.customerPhone,
        restaurantId: orders.restaurantId,
        courierId: orders.courierId,
        deliveryAddress: orders.deliveryAddress,
        amount: orders.amount,
        version: orders.version,
        createdAt: orders.createdAt,
        updatedAt: orders.updatedAt,
        restaurant: {
          id: restaurants.id,
          name: restaurants.name,
          address: restaurants.address,
          phone: restaurants.phone,
        },
        courier: {
          id: couriers.id,
          name: couriers.name,
          phone: couriers.phone,
        },
      })
      .from(orders)
      .leftJoin(restaurants, eq(orders.restaurantId, restaurants.id))
      .leftJoin(couriers, eq(orders.courierId, couriers.id))
      .where(eq(orders.id, id));

    if (!order) {
      throw new NotFoundError(`Заказ с id ${id} не найден`);
    }

    // Fetch audit logs in chronological order
    const auditLogs = await db
      .select({
        id: orderAuditLogs.id,
        orderId: orderAuditLogs.orderId,
        actionType: orderAuditLogs.actionType,
        oldStatus: orderAuditLogs.oldStatus,
        newStatus: orderAuditLogs.newStatus,
        courierId: orderAuditLogs.courierId,
        details: orderAuditLogs.details,
        createdAt: orderAuditLogs.createdAt,
        courierName: couriers.name,
      })
      .from(orderAuditLogs)
      .leftJoin(couriers, eq(orderAuditLogs.courierId, couriers.id))
      .where(eq(orderAuditLogs.orderId, id))
      .orderBy(asc(orderAuditLogs.createdAt));

    return {
      ...order,
      auditLogs,
    };
  }

  /**
   * Update order status with FSM checks and OCC
   */
  async updateStatus(id: string, body: UpdateStatusBody) {
    const { status: newStatus, version: requestedVersion } = body;

    return await db.transaction(async (tx: any) => {
      // 1. Fetch current order with row lock
      const [current] = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, id))
        .for("update");

      if (!current) {
        throw new NotFoundError();
      }

      // 2. Optimistic Concurrency Control check
      if (current.version !== requestedVersion) {
        throw new ConcurrencyConflictError(
          `Конфликт версий: заказ был изменен другим оператором (актуальная версия ${current.version}, передана ${requestedVersion}).`
        );
      }

      // 3. FSM validation
      if (!canTransition(current.status, newStatus)) {
        throw new BusinessRuleError(
          `Недопустимый переход статуса: нельзя перевести заказ из '${current.status}' в '${newStatus}'.`
        );
      }

      // 4. If moving to 'ready' or 'picked_up' and courier is already assigned, ensure courier limit is not exceeded
      if (["ready", "picked_up"].includes(newStatus) && current.courierId) {
        // Lock courier row to serialize operations on this courier
        await tx
          .select()
          .from(couriers)
          .where(eq(couriers.id, current.courierId))
          .for("update");

        const [activeCountResult] = await tx
          .select({ count: count() })
          .from(orders)
          .where(
            and(
              eq(orders.courierId, current.courierId),
              sql`${orders.status} IN ('ready', 'picked_up')`,
              sql`${orders.id} != ${id}`
            )
          );

        const activeCount = Number(activeCountResult?.count || 0);
        if (activeCount >= 3) {
          throw new BusinessRuleError(
            `Невозможно перевести заказ в '${newStatus}': назначенный курьер уже выполняет максимум (3) активных доставок.`
          );
        }
      }

      const now = new Date();

      // 5. Atomic OCC update
      const [updated] = await tx
        .update(orders)
        .set({
          status: newStatus,
          version: current.version + 1,
          updatedAt: now,
        })
        .where(and(eq(orders.id, id), eq(orders.version, requestedVersion)))
        .returning();

      if (!updated) {
        throw new ConcurrencyConflictError();
      }

      // 6. Record in Audit Log
      await tx.insert(orderAuditLogs).values({
        orderId: id,
        actionType: "status_changed",
        oldStatus: current.status,
        newStatus,
        courierId: current.courierId,
        details: `Статус изменен с '${current.status}' на '${newStatus}'`,
        createdAt: now,
      });

      return updated;
    });
  }

  /**
   * Assign or change courier with active delivery limit check and OCC
   */
  async assignCourier(id: string, body: AssignCourierBody) {
    const { courierId, version: requestedVersion } = body;

    return await db.transaction(async (tx: any) => {
      // 1. Fetch current order with row lock
      const [current] = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, id))
        .for("update");

      if (!current) {
        throw new NotFoundError();
      }

      // 2. OCC check
      if (current.version !== requestedVersion) {
        throw new ConcurrencyConflictError(
          `Конфликт версий: заказ был изменен другим оператором (актуальная версия ${current.version}, передана ${requestedVersion}).`
        );
      }

      // 3. If assigning a new courier, validate courier & active deliveries limit
      let courierName = "";
      if (courierId) {
        // Lock courier row to serialize concurrent assignments to this courier
        const [courier] = await tx
          .select()
          .from(couriers)
          .where(eq(couriers.id, courierId))
          .for("update");

        if (!courier) {
          throw new NotFoundError(`Курьер с id ${courierId} не найден`);
        }
        courierName = courier.name;

        // Check if order is active (ready or picked_up)
        const isOrderActive = ["ready", "picked_up"].includes(current.status);

        if (isOrderActive) {
          // Count active deliveries for this courier (excluding current order if courier was already assigned)
          const [activeCountResult] = await tx
            .select({ count: count() })
            .from(orders)
            .where(
              and(
                eq(orders.courierId, courierId),
                sql`${orders.status} IN ('ready', 'picked_up')`,
                sql`${orders.id} != ${id}`
              )
            );

          const activeCount = Number(activeCountResult?.count || 0);

          if (activeCount >= 3) {
            throw new BusinessRuleError(
              `Курьер ${courierName} не может взять заказ: у него уже ${activeCount} активных доставок (максимум 3).`
            );
          }
        }
      }

      const now = new Date();

      // 4. Atomic OCC update
      const [updated] = await tx
        .update(orders)
        .set({
          courierId: courierId,
          version: current.version + 1,
          updatedAt: now,
        })
        .where(and(eq(orders.id, id), eq(orders.version, requestedVersion)))
        .returning();

      if (!updated) {
        throw new ConcurrencyConflictError();
      }

      // 5. Audit log
      const actionType = courierId
        ? current.courierId
          ? "courier_reassigned"
          : "courier_assigned"
        : "courier_unassigned";

      const details = courierId
        ? current.courierId
          ? `Курьер переназначен на ${courierName}`
          : `Назначен курьер ${courierName}`
        : "Курьер снят с заказа";

      await tx.insert(orderAuditLogs).values({
        orderId: id,
        actionType,
        oldStatus: current.status,
        newStatus: current.status,
        courierId,
        details,
        createdAt: now,
      });

      return updated;
    });
  }

  /**
   * Cancel order with FSM validation and OCC
   */
  async cancelOrder(id: string, body: CancelOrderBody) {
    const { version: requestedVersion, reason } = body;

    return await db.transaction(async (tx: any) => {
      // 1. Fetch current order with row lock
      const [current] = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, id))
        .for("update");

      if (!current) {
        throw new NotFoundError();
      }

      // 2. OCC check
      if (current.version !== requestedVersion) {
        throw new ConcurrencyConflictError(
          `Конфликт версий: заказ был изменен другим оператором (актуальная версия ${current.version}, передана ${requestedVersion}).`
        );
      }

      // 3. FSM cancellation check: forbidden if picked_up, delivered, cancelled
      if (!canCancelOrder(current.status)) {
        throw new BusinessRuleError(
          `Заказ нельзя отменить: на этапе '${current.status}' отмена запрещена бизнес-правилами платформы.`
        );
      }

      const now = new Date();

      // 4. Atomic OCC update
      const [updated] = await tx
        .update(orders)
        .set({
          status: "cancelled",
          version: current.version + 1,
          updatedAt: now,
        })
        .where(and(eq(orders.id, id), eq(orders.version, requestedVersion)))
        .returning();

      if (!updated) {
        throw new ConcurrencyConflictError();
      }

      // 5. Audit log
      await tx.insert(orderAuditLogs).values({
        orderId: id,
        actionType: "order_cancelled",
        oldStatus: current.status,
        newStatus: "cancelled",
        courierId: current.courierId,
        details: reason ? `Заказ отменен: ${reason}` : "Заказ отменен оператором",
        createdAt: now,
      });

      return updated;
    });
  }
}

export const orderService = new OrderService();
