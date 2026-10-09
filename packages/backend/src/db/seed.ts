import { db, client } from "./connection.js";
import { restaurants, couriers, orders, orderAuditLogs } from "./schema.js";
import type { OrderStatus } from "./schema.js";

const RESTAURANT_NAMES = [
  "Додо Пицца",
  "Бургер Кинг",
  "Вкусно — и точка",
  "Теремок",
  "Якитория",
  "Шоколадница",
  "Папа Джонс",
  "Фо Бо Ханой",
  "Frank by Баста",
  "Surf Coffee",
  "Тануки",
  "Чайхона №1",
  "BB&Burgers",
  "Pho Fighters",
  "Rostic's",
  "Osteria Mario",
  "Cofix",
  "Корчма Тарас Бульба",
  "Subway",
  "АндерСон",
];

const COURIER_NAMES = [
  "Иван Смирнов",
  "Алексей Петров",
  "Мария Кузнецова",
  "Дмитрий Соколов",
  "Сергей Васильев",
  "Елена Попова",
  "Андрей Новиков",
  "Михаил Федоров",
  "Ольга Морозова",
  "Артем Волков",
  "Никита Алексеев",
  "Анна Лебедева",
  "Кирилл Семенов",
  "Павел Егоров",
  "Роман Козлов",
  "Максим Степанов",
  "Илья Николаев",
  "Виктор Макаров",
  "Денис Захаров",
  "Евгений Зайцев",
];

const STREETS = [
  "ул. Тверская, д. ",
  "пр-т Мира, д. ",
  "Ленинский пр-т, д. ",
  "ул. Новый Арбат, д. ",
  "ул. Профсоюзная, д. ",
  "ул. Красная Пресня, д. ",
  "ул. Бауманская, д. ",
  "ул. Садовая-Кудринская, д. ",
  "ул. Вавилова, д. ",
  "Кутузовский пр-т, д. ",
  "ул. Большая Дмитровка, д. ",
  "ул. Маросейка, д. ",
  "ул. Покровка, д. ",
  "ул. Пятницкая, д. ",
  "Ленинградский пр-т, д. ",
  "ул. Новослободская, д. ",
  "ул. Сущевский Вал, д. ",
  "Цветной бульвар, д. ",
  "ул. Сретенка, д. ",
  "ул. Таганская, д. ",
];

const CUSTOMERS = [
  "Александр", "Екатерина", "Максим", "Анастасия", "Владимир",
  "Дарья", "Константин", "Полина", "Олег", "Виктория",
  "Георгий", "Ксения", "Тимофей", "Алиса", "Валерий",
  "Татьяна", "Глеб", "Вероника", "Григорий", "Наталья"
];

export async function runSeed() {
  console.log("Starting database seed...");

  // Clean existing data
  await client`TRUNCATE TABLE order_audit_logs, orders, couriers, restaurants CASCADE;`;

  // 1. Seed 20 Restaurants
  console.log("Seeding 20 restaurants...");
  const createdRestaurants = await db
    .insert(restaurants)
    .values(
      RESTAURANT_NAMES.map((name, i) => ({
        name,
        address: `${STREETS[i % STREETS.length]}${10 + i * 3}`,
        phone: `+7 (495) 100-${String(1000 + i).slice(1)}`,
      }))
    )
    .returning();

  // 2. Seed 20 Couriers
  console.log("Seeding 20 couriers...");
  const createdCouriers = await db
    .insert(couriers)
    .values(
      COURIER_NAMES.map((name, i) => ({
        name,
        phone: `+7 (999) 200-${String(2000 + i).slice(1)}`,
      }))
    )
    .returning();

  // 3. Seed 200 Orders
  console.log("Seeding 200 orders...");
  const statuses: OrderStatus[] = [
    "new", "accepted", "preparing", "ready", "picked_up", "delivered", "cancelled"
  ];

  // Distribution weights: more realistic ops distribution
  // new: 25, accepted: 25, preparing: 35, ready: 30, picked_up: 30, delivered: 40, cancelled: 15 = 200
  const statusCounts: Record<OrderStatus, number> = {
    new: 25,
    accepted: 25,
    preparing: 35,
    ready: 30,
    picked_up: 30,
    delivered: 40,
    cancelled: 15,
  };

  const ordersToInsert = [];
  const now = Date.now();

  // Track active count per courier to strictly comply with max 3 active rule
  const courierActiveCount = new Map<string, number>();
  createdCouriers.forEach((c: any) => courierActiveCount.set(c.id, 0));

  for (const [status, count] of Object.entries(statusCounts) as [OrderStatus, number][]) {
    for (let i = 0; i < count; i++) {
      const restaurant = createdRestaurants[Math.floor(Math.random() * createdRestaurants.length)];
      const customer = CUSTOMERS[Math.floor(Math.random() * CUSTOMERS.length)];
      const street = STREETS[Math.floor(Math.random() * STREETS.length)];
      const houseNumber = Math.floor(Math.random() * 90) + 1;
      const aptNumber = Math.floor(Math.random() * 200) + 1;
      const address = `${street}${houseNumber}, кв. ${aptNumber}`;
      const amount = (Math.floor(Math.random() * 350) * 10 + 490).toFixed(2);

      // Random creation time in past 5 days
      const createdAtOffset = Math.floor(Math.random() * 5 * 24 * 60 * 60 * 1000);
      const createdAt = new Date(now - createdAtOffset);
      const updatedAt = new Date(createdAt.getTime() + Math.floor(Math.random() * 60 * 60 * 1000));

      let assignedCourierId: string | null = null;

      // Assign courier if status is ready, picked_up, or delivered
      if (["ready", "picked_up"].includes(status)) {
        // Must satisfy limit of 3 active deliveries
        const availableCouriers = createdCouriers.filter(
          (c: any) => (courierActiveCount.get(c.id) || 0) < 3
        );
        if (availableCouriers.length > 0) {
          const picked = availableCouriers[Math.floor(Math.random() * availableCouriers.length)];
          assignedCourierId = picked.id;
          courierActiveCount.set(picked.id, (courierActiveCount.get(picked.id) || 0) + 1);
        }
      } else if (status === "delivered") {
        // Delivered is not active, can assign any courier
        assignedCourierId = createdCouriers[Math.floor(Math.random() * createdCouriers.length)].id;
      }

      ordersToInsert.push({
        status,
        customerName: customer,
        customerPhone: `+7 (916) ${Math.floor(Math.random() * 900 + 100)}-${Math.floor(Math.random() * 90 + 10)}-${Math.floor(Math.random() * 90 + 10)}`,
        restaurantId: restaurant.id,
        courierId: assignedCourierId,
        deliveryAddress: address,
        amount,
        version: 1,
        createdAt,
        updatedAt,
      });
    }
  }

  const createdOrders = await db.insert(orders).values(ordersToInsert).returning();

  // 4. Generate Audit Logs for each order
  console.log("Generating audit logs for orders...");
  const auditLogsToInsert = [];

  for (const ord of createdOrders) {
    const courier = ord.courierId
      ? createdCouriers.find((c: any) => c.id === ord.courierId)
      : null;

    // Step 1: order_created
    auditLogsToInsert.push({
      orderId: ord.id,
      actionType: "order_created",
      oldStatus: null,
      newStatus: "new" as OrderStatus,
      courierId: null,
      details: "Заказ оформлен клиентом",
      createdAt: ord.createdAt,
    });

    if (ord.status === "cancelled") {
      auditLogsToInsert.push({
        orderId: ord.id,
        actionType: "order_cancelled",
        oldStatus: "new" as OrderStatus,
        newStatus: "cancelled" as OrderStatus,
        courierId: null,
        details: "Заказ отменен оператором",
        createdAt: ord.updatedAt,
      });
      continue;
    }

    if (["accepted", "preparing", "ready", "picked_up", "delivered"].includes(ord.status)) {
      auditLogsToInsert.push({
        orderId: ord.id,
        actionType: "status_changed",
        oldStatus: "new" as OrderStatus,
        newStatus: "accepted" as OrderStatus,
        courierId: null,
        details: "Заказ подтвержден рестораном",
        createdAt: new Date(ord.createdAt.getTime() + 5 * 60 * 1000),
      });
    }

    if (["preparing", "ready", "picked_up", "delivered"].includes(ord.status)) {
      auditLogsToInsert.push({
        orderId: ord.id,
        actionType: "status_changed",
        oldStatus: "accepted" as OrderStatus,
        newStatus: "preparing" as OrderStatus,
        courierId: null,
        details: "Ресторан начал приготовление",
        createdAt: new Date(ord.createdAt.getTime() + 10 * 60 * 1000),
      });
    }

    if (["ready", "picked_up", "delivered"].includes(ord.status)) {
      auditLogsToInsert.push({
        orderId: ord.id,
        actionType: "status_changed",
        oldStatus: "preparing" as OrderStatus,
        newStatus: "ready" as OrderStatus,
        courierId: null,
        details: "Заказ приготовлен, ожидает выдачи",
        createdAt: new Date(ord.createdAt.getTime() + 25 * 60 * 1000),
      });

      if (courier) {
        auditLogsToInsert.push({
          orderId: ord.id,
          actionType: "courier_assigned",
          oldStatus: "ready" as OrderStatus,
          newStatus: "ready" as OrderStatus,
          courierId: courier.id,
          details: `Назначен курьер ${courier.name}`,
          createdAt: new Date(ord.createdAt.getTime() + 27 * 60 * 1000),
        });
      }
    }

    if (["picked_up", "delivered"].includes(ord.status)) {
      auditLogsToInsert.push({
        orderId: ord.id,
        actionType: "status_changed",
        oldStatus: "ready" as OrderStatus,
        newStatus: "picked_up" as OrderStatus,
        courierId: ord.courierId,
        details: courier
          ? `Курьер ${courier.name} забрал заказ`
          : "Курьер забрал заказ",
        createdAt: new Date(ord.createdAt.getTime() + 35 * 60 * 1000),
      });
    }

    if (ord.status === "delivered") {
      auditLogsToInsert.push({
        orderId: ord.id,
        actionType: "status_changed",
        oldStatus: "picked_up" as OrderStatus,
        newStatus: "delivered" as OrderStatus,
        courierId: ord.courierId,
        details: "Заказ успешно доставлен клиенту",
        createdAt: ord.updatedAt,
      });
    }
  }

  // Batch insert audit logs
  console.log(`Inserting ${auditLogsToInsert.length} audit logs...`);
  // Insert in chunks of 100 to avoid parameter limit
  for (let i = 0; i < auditLogsToInsert.length; i += 100) {
    const chunk = auditLogsToInsert.slice(i, i + 100);
    await db.insert(orderAuditLogs).values(chunk);
  }

  console.log("Database seed completed successfully!");
}

// Allow direct execution
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("seed.ts")) {
  runSeed()
    .then(() => {
      console.log("Seed script completed.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Seed script failed:", err);
      process.exit(1);
    });
}
