import { StatusBadge } from "./StatusBadge.js";
import { Clock, Store, MapPin, Bike, ChevronRight, Inbox, RefreshCw } from "lucide-react";
import type { Order } from "../types.js";

interface OrdersTableProps {
  orders: Order[];
  isLoading: boolean;
  onSelectOrder: (order: Order) => void;
  selectedOrderId?: string | null;
}

export function OrdersTable({
  orders,
  isLoading,
  onSelectOrder,
  selectedOrderId,
}: OrdersTableProps) {
  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="h-4 w-32 bg-slate-100 rounded-sm animate-pulse" />
          <div className="h-4 w-20 bg-slate-100 rounded-sm animate-pulse" />
        </div>
        <div className="divide-y divide-slate-100">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="p-4 flex items-center gap-4 animate-pulse">
              <div className="h-4 w-20 bg-slate-100 rounded-sm" />
              <div className="h-6 w-24 bg-slate-100 rounded-md" />
              <div className="h-4 w-32 bg-slate-100 rounded-sm flex-1" />
              <div className="h-4 w-28 bg-slate-100 rounded-sm" />
              <div className="h-4 w-24 bg-slate-100 rounded-sm" />
              <div className="h-4 w-16 bg-slate-100 rounded-sm" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-xs">
        <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
          <Inbox className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-semibold text-slate-900">Заказы не найдены</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          По заданным критериям фильтрации или поисковому запросу ничего не найдено. Попробуйте сбросить фильтры.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-slate-50/75 border-b border-slate-200 text-xs font-medium text-slate-500 uppercase tracking-wider">
              <th className="py-3 px-3">ID</th>
              <th className="py-3 px-3">Статус</th>
              <th className="py-3 px-3">Клиент</th>
              <th className="py-3 px-3">Ресторан</th>
              <th className="py-3 px-3">Курьер</th>
              <th className="py-3 px-3">Адрес доставки</th>
              <th className="py-3 px-3 text-right">Сумма</th>
              <th className="py-3 px-3">Создан</th>
              <th className="py-3 px-3">Обновлен</th>
              <th className="py-3 px-3 text-center">Действие</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.map((order) => {
              const isSelected = order.id === selectedOrderId;
              const createdDateStr = new Date(order.createdAt).toLocaleDateString("ru-RU", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              });
              const updatedDateStr = order.updatedAt
                ? new Date(order.updatedAt).toLocaleDateString("ru-RU", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "—";

              return (
                <tr
                  key={order.id}
                  onClick={() => onSelectOrder(order)}
                  className={`transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-slate-100/90 font-medium"
                      : "hover:bg-slate-50/80"
                  }`}
                >
                  {/* ID */}
                  <td className="py-3 px-3 font-mono text-xs text-slate-500">
                    #{order.id.slice(0, 8)}
                  </td>

                  {/* Status */}
                  <td className="py-3 px-3 whitespace-nowrap">
                    <StatusBadge status={order.status} size="sm" />
                  </td>

                  {/* Customer */}
                  <td className="py-3 px-3">
                    <div className="font-medium text-slate-900">{order.customerName}</div>
                    {order.customerPhone && (
                      <div className="text-xs text-slate-500">{order.customerPhone}</div>
                    )}
                  </td>

                  {/* Restaurant */}
                  <td className="py-3 px-3 text-slate-700 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <Store className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{order.restaurant?.name || "Ресторан"}</span>
                    </div>
                  </td>

                  {/* Courier */}
                  <td className="py-3 px-3 text-slate-700 whitespace-nowrap">
                    {order.courier?.id ? (
                      <div>
                        <div className="flex items-center gap-1.5 font-medium">
                          <Bike className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>{order.courier.name}</span>
                        </div>
                        {typeof order.courier.activeOrdersCount === "number" && (
                          <div className="text-[11px] text-slate-400 pl-5">
                            {order.courier.activeOrdersCount}/3 акт. доставок
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">Не назначен</span>
                    )}
                  </td>

                  {/* Address */}
                  <td className="py-3 px-3 text-slate-600 max-w-[200px] truncate" title={order.deliveryAddress}>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{order.deliveryAddress}</span>
                    </div>
                  </td>

                  {/* Amount */}
                  <td className="py-3 px-3 text-right font-medium text-slate-900 whitespace-nowrap">
                    {Number(order.amount).toLocaleString("ru-RU")} ₽
                  </td>

                  {/* Created At */}
                  <td className="py-3 px-3 text-xs text-slate-500 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{createdDateStr}</span>
                    </div>
                  </td>

                  {/* Updated At */}
                  <td className="py-3 px-3 text-xs text-slate-500 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 text-slate-400" />
                      <span>{updatedDateStr}</span>
                    </div>
                  </td>

                  {/* Action */}
                  <td className="py-3 px-3 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectOrder(order);
                      }}
                      className="p-1 rounded-md text-slate-400 hover:text-slate-900 hover:bg-slate-200/60 transition-colors cursor-pointer"
                      title="Открыть детали заказа"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
