import type {
  OrdersResponse,
  Order,
  Restaurant,
  Courier,
  OrderFilters,
  OrderStatus,
} from "../types.js";

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    let errorData = { message: "Ошибка сети", code: "UNKNOWN_ERROR" };
    try {
      errorData = await res.json();
    } catch {
      // ignore
    }
    throw new ApiError(res.status, errorData.code || "API_ERROR", errorData.message || res.statusText);
  }

  return res.json();
}

export const api = {
  async getOrders(filters: OrderFilters): Promise<OrdersResponse> {
    const params = new URLSearchParams();
    if (filters.status) params.set("status", filters.status);
    if (filters.restaurantId) params.set("restaurantId", filters.restaurantId);
    if (filters.search?.trim()) params.set("search", filters.search.trim());
    if (filters.sortBy) params.set("sortBy", filters.sortBy);
    if (filters.sortOrder) params.set("sortOrder", filters.sortOrder);
    params.set("page", String(filters.page));
    params.set("limit", String(filters.limit));

    return request<OrdersResponse>(`/api/orders?${params.toString()}`);
  },

  async getOrder(id: string): Promise<Order> {
    return request<Order>(`/api/orders/${id}`);
  },

  async updateOrderStatus(id: string, status: OrderStatus, version: number): Promise<Order> {
    return request<Order>(`/api/orders/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, version }),
    });
  },

  async assignCourier(id: string, courierId: string | null, version: number): Promise<Order> {
    return request<Order>(`/api/orders/${id}/courier`, {
      method: "PATCH",
      body: JSON.stringify({ courierId, version }),
    });
  },

  async cancelOrder(id: string, version: number, reason?: string): Promise<Order> {
    return request<Order>(`/api/orders/${id}/cancel`, {
      method: "POST",
      body: JSON.stringify({ version, reason }),
    });
  },

  async getRestaurants(): Promise<Restaurant[]> {
    return request<Restaurant[]>("/api/restaurants");
  },

  async getCouriers(): Promise<Courier[]> {
    return request<Courier[]>("/api/couriers");
  },
};
