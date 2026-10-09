import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "./lib/api.js";
import { FilterBar } from "./components/FilterBar.js";
import { OrdersTable } from "./components/OrdersTable.js";
import { Pagination } from "./components/Pagination.js";
import { OrderDetailDrawer } from "./components/OrderDetailDrawer.js";
import {
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { FoodsterLogo } from "./components/FoodsterLogo.js";
import type { OrderFilters, OrderStatus, Order } from "./types.js";

export function App() {
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState<OrderFilters>({
    status: "",
    restaurantId: "",
    search: "",
    sortBy: "createdAt",
    sortOrder: "desc",
    page: 1,
    limit: 20,
  });

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedOrderRow, setSelectedOrderRow] = useState<Order | null>(null);
  const [concurrencyError, setConcurrencyError] = useState<string | null>(null);

  // 1. Fetch orders list
  const {
    data: ordersData,
    isLoading: isOrdersLoading,
    isFetching: isOrdersFetching,
    error: ordersError,
    refetch: refetchOrders,
  } = useQuery({
    queryKey: ["orders", filters],
    queryFn: () => api.getOrders(filters),
    refetchInterval: 15000, // automatic background poll every 15s
  });

  // 2. Fetch restaurants list for filters
  const { data: restaurants = [] } = useQuery({
    queryKey: ["restaurants"],
    queryFn: api.getRestaurants,
  });

  // 3. Fetch couriers list with active workload
  const { data: couriers = [], refetch: refetchCouriers } = useQuery({
    queryKey: ["couriers"],
    queryFn: api.getCouriers,
  });

  // 4. Fetch selected order with detailed audit logs (with instant placeholder from table row)
  const { data: selectedOrder, isLoading: isSelectedOrderLoading } = useQuery({
    queryKey: ["order", selectedOrderId],
    queryFn: () => (selectedOrderId ? api.getOrder(selectedOrderId) : null),
    enabled: Boolean(selectedOrderId),
    placeholderData: selectedOrderRow || undefined,
  });

  // Helper to handle mutation errors (specifically 409 Concurrency Conflict)
  const handleMutationError = (err: unknown) => {
    if (err instanceof ApiError && err.statusCode === 409) {
      setConcurrencyError(err.message);
      // Immediately invalidate cache to fetch fresh version from backend
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      if (selectedOrderId) {
        queryClient.invalidateQueries({ queryKey: ["order", selectedOrderId] });
      }
    } else {
      setConcurrencyError(null);
    }
  };

  // Mutations
  const updateStatusMutation = useMutation({
    mutationFn: ({
      id,
      status,
      version,
    }: {
      id: string;
      status: OrderStatus;
      version: number;
    }) => api.updateOrderStatus(id, status, version),
    onSuccess: () => {
      setConcurrencyError(null);
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["order", selectedOrderId] });
      refetchCouriers();
    },
    onError: handleMutationError,
  });

  const assignCourierMutation = useMutation({
    mutationFn: ({
      id,
      courierId,
      version,
    }: {
      id: string;
      courierId: string | null;
      version: number;
    }) => api.assignCourier(id, courierId, version),
    onSuccess: () => {
      setConcurrencyError(null);
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["order", selectedOrderId] });
      refetchCouriers();
    },
    onError: handleMutationError,
  });

  const cancelOrderMutation = useMutation({
    mutationFn: ({
      id,
      version,
      reason,
    }: {
      id: string;
      version: number;
      reason?: string;
    }) => api.cancelOrder(id, version, reason),
    onSuccess: () => {
      setConcurrencyError(null);
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["order", selectedOrderId] });
      refetchCouriers();
    },
    onError: handleMutationError,
  });

  const isMutating =
    updateStatusMutation.isPending ||
    assignCourierMutation.isPending ||
    cancelOrderMutation.isPending;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          {/* Logo & Product Title */}
          <FoodsterLogo />

          {/* Refresh action */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                refetchOrders();
                refetchCouriers();
              }}
              disabled={isOrdersFetching}
              className="p-1.5 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer disabled:opacity-50"
              title="Обновить данные"
            >
              <RefreshCw
                className={`w-4 h-4 ${isOrdersFetching ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full flex-1 space-y-4">
        {/* Error banner if network fails */}
        {ordersError && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3 text-xs text-rose-800">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">Не удалось загрузить заказы</p>
              <p className="mt-0.5 text-rose-700">
                {ordersError instanceof Error ? ordersError.message : "Ошибка сервера"}
              </p>
              <button
                onClick={() => refetchOrders()}
                className="mt-2 text-rose-900 font-semibold underline cursor-pointer"
              >
                Повторить попытку
              </button>
            </div>
          </div>
        )}

        {/* Filters and search */}
        <FilterBar
          filters={filters}
          onChange={setFilters}
          restaurants={restaurants}
        />

        {/* Orders Table */}
        <OrdersTable
          orders={ordersData?.items || []}
          isLoading={isOrdersLoading}
          onSelectOrder={(order) => {
            setSelectedOrderId(order.id);
            setSelectedOrderRow(order);
          }}
          selectedOrderId={selectedOrderId}
        />

        {/* Pagination */}
        {ordersData && ordersData.pagination.total > 0 && (
          <Pagination
            page={ordersData.pagination.page}
            totalPages={ordersData.pagination.totalPages}
            totalItems={ordersData.pagination.total}
            limit={ordersData.pagination.limit}
            onPageChange={(page) => setFilters({ ...filters, page })}
            onLimitChange={(limit) => setFilters({ ...filters, limit, page: 1 })}
          />
        )}
      </main>

      {/* Order Detail Drawer */}
      <OrderDetailDrawer
        order={selectedOrder || null}
        couriers={couriers}
        isOpen={Boolean(selectedOrderId)}
        isLoading={isSelectedOrderLoading}
        onClose={() => {
          setSelectedOrderId(null);
          setSelectedOrderRow(null);
        }}
        onUpdateStatus={async (id, status, version) => {
          await updateStatusMutation.mutateAsync({ id, status, version });
        }}
        onAssignCourier={async (id, courierId, version) => {
          await assignCourierMutation.mutateAsync({ id, courierId, version });
        }}
        onCancelOrder={async (id, version, reason) => {
          await cancelOrderMutation.mutateAsync({ id, version, reason });
        }}
        isUpdating={isMutating}
        concurrencyError={concurrencyError}
        onClearConcurrencyError={() => setConcurrencyError(null)}
      />

      {/* Minimalist Footer */}
      <footer className="border-t border-slate-200 bg-white py-3 text-center text-xs text-slate-400">
        Foodster Delivery Platform &copy; 2026. Операционный контур управления заказами.
      </footer>
    </div>
  );
}
