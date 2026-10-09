export type OrderStatus =
  | "new"
  | "accepted"
  | "preparing"
  | "ready"
  | "picked_up"
  | "delivered"
  | "cancelled";

export interface Restaurant {
  id: string;
  name: string;
  address: string;
  phone?: string | null;
}

export interface Courier {
  id: string;
  name: string;
  phone?: string | null;
  activeOrdersCount: number;
  isAvailable: boolean;
}

export interface OrderAuditLog {
  id: string;
  orderId: string;
  actionType: string;
  oldStatus: OrderStatus | null;
  newStatus: OrderStatus | null;
  courierId: string | null;
  courierName?: string | null;
  details: string;
  createdAt: string;
}

export interface Order {
  id: string;
  status: OrderStatus;
  customerName: string;
  customerPhone?: string | null;
  restaurantId: string;
  courierId: string | null;
  deliveryAddress: string;
  amount: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  restaurant?: Restaurant;
  courier?: Courier | null;
  auditLogs?: OrderAuditLog[];
}

export interface OrdersResponse {
  items: Order[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface OrderFilters {
  status?: OrderStatus | "";
  restaurantId?: string | "";
  search?: string;
  sortBy?: "createdAt" | "updatedAt" | "amount" | "status";
  sortOrder?: "asc" | "desc";
  page: number;
  limit: number;
}
