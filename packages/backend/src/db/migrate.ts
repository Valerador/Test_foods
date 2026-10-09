import { client } from "./connection.js";

export async function runMigrations() {
  console.log("Running database migrations...");

  // 1. Enable pg_trgm extension
  await client`CREATE EXTENSION IF NOT EXISTS pg_trgm;`;

  // 2. Create order_status enum type if it does not exist
  await client`
    DO $$ BEGIN
      CREATE TYPE order_status AS ENUM (
        'new', 'accepted', 'preparing', 'ready', 'picked_up', 'delivered', 'cancelled'
      );
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `;

  // 3. Create restaurants table
  await client`
    CREATE TABLE IF NOT EXISTS restaurants (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      phone TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
  await client`CREATE INDEX IF NOT EXISTS idx_restaurants_name ON restaurants(name);`;

  // 4. Create couriers table
  await client`
    CREATE TABLE IF NOT EXISTS couriers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      phone TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
  await client`CREATE INDEX IF NOT EXISTS idx_couriers_name ON couriers(name);`;

  // 5. Create orders table
  await client`
    CREATE TABLE IF NOT EXISTS orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      status order_status NOT NULL DEFAULT 'new',
      customer_name TEXT NOT NULL,
      customer_phone TEXT,
      restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE RESTRICT,
      courier_id UUID REFERENCES couriers(id) ON DELETE SET NULL,
      delivery_address TEXT NOT NULL,
      amount NUMERIC(10, 2) NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  // Create indexes for orders
  await client`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);`;
  await client`CREATE INDEX IF NOT EXISTS idx_orders_restaurant ON orders(restaurant_id);`;
  await client`CREATE INDEX IF NOT EXISTS idx_orders_courier ON orders(courier_id);`;
  await client`CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);`;
  // GIN trigram index for fuzzy address matching
  await client`CREATE INDEX IF NOT EXISTS idx_orders_address_trgm ON orders USING gin (delivery_address gin_trgm_ops);`;

  // 6. Create order_audit_logs table
  await client`
    CREATE TABLE IF NOT EXISTS order_audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      action_type TEXT NOT NULL,
      old_status order_status,
      new_status order_status,
      courier_id UUID REFERENCES couriers(id) ON DELETE SET NULL,
      details TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
  await client`CREATE INDEX IF NOT EXISTS idx_audit_order_id ON order_audit_logs(order_id);`;
  await client`CREATE INDEX IF NOT EXISTS idx_audit_created_at ON order_audit_logs(created_at);`;

  console.log("Migrations applied successfully!");
}

// Allow direct execution
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("migrate.ts")) {
  runMigrations()
    .then(() => {
      console.log("Migration complete.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Migration failed:", err);
      process.exit(1);
    });
}
