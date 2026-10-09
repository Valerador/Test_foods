import { useState } from "react";
import {
  X,
  Store,
  User,
  MapPin,
  Bike,
  AlertTriangle,
  History,
  ArrowRight,
} from "lucide-react";
import { StatusBadge } from "./StatusBadge.js";
import type { Order, Courier, OrderStatus } from "../types.js";

interface OrderDetailDrawerProps {
  order: Order | null;
  couriers: Courier[];
  isOpen: boolean;
  isLoading?: boolean;
  onClose: () => void;
  onUpdateStatus: (id: string, status: OrderStatus, version: number) => Promise<void>;
  onAssignCourier: (id: string, courierId: string | null, version: number) => Promise<void>;
  onCancelOrder: (id: string, version: number, reason?: string) => Promise<void>;
  isUpdating: boolean;
  concurrencyError: string | null;
  onClearConcurrencyError: () => void;
}

export function OrderDetailDrawer({
  order,
  couriers,
  isOpen,
  isLoading = false,
  onClose,
  onUpdateStatus,
  onAssignCourier,
  onCancelOrder,
  isUpdating,
  concurrencyError,
  onClearConcurrencyError,
}: OrderDetailDrawerProps) {
  const [selectedCourierId, setSelectedCourierId] = useState<string>("");
  const [showCancelPrompt, setShowCancelPrompt] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  if (!isOpen) return null;

  // If order is still loading from API, show drawer with skeleton immediately
  if (isLoading && !order) {
    return (
      <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
        <div className="fixed inset-0 bg-slate-900/40 transition-opacity" onClick={onClose} />
        <div className="relative w-full max-w-xl bg-white shadow-2xl z-10 flex flex-col h-full border-l border-slate-200">
          <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
            <div className="space-y-2">
              <div className="h-4 w-24 bg-slate-200 rounded-sm animate-pulse" />
              <div className="h-5 w-48 bg-slate-200 rounded-sm animate-pulse" />
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-5 space-y-4 animate-pulse">
            <div className="grid grid-cols-2 gap-3">
              <div className="h-16 bg-slate-100 rounded-lg" />
              <div className="h-16 bg-slate-100 rounded-lg" />
            </div>
            <div className="h-28 bg-slate-100 rounded-lg" />
            <div className="h-24 bg-slate-100 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (!order) return null;

  // FSM Next Valid Transitions
  const NEXT_STATUS_MAP: Record<OrderStatus, { next: OrderStatus; label: string } | null> = {
    new: { next: "accepted", label: "Принять в работу" },
    accepted: { next: "preparing", label: "Начать приготовление" },
    preparing: { next: "ready", label: "Заказ готов" },
    ready: { next: "picked_up", label: "Курьер забрал заказ" },
    picked_up: { next: "delivered", label: "Заказ доставлен" },
    delivered: null,
    cancelled: null,
  };

  const nextStep = NEXT_STATUS_MAP[order.status];
  const canCancel = ["new", "accepted", "preparing", "ready"].includes(order.status);
  const isTerminal = ["delivered", "cancelled"].includes(order.status);
  const isOrderActiveForCourier = ["ready", "picked_up"].includes(order.status);
  const currentCourier = order.courierId ? (couriers.find((c) => c.id === order.courierId) || (order.courier?.id ? order.courier : null)) : null;
  const currentCourierCount = currentCourier?.activeOrdersCount ?? order.courier?.activeOrdersCount ?? 0;

  const handleStatusChange = async (status: OrderStatus) => {
    setActionError(null);
    try {
      await onUpdateStatus(order.id, status, order.version);
    } catch (err: any) {
      if (err.statusCode !== 409) {
        setActionError(err.message || "Ошибка обновления статуса");
      }
    }
  };

  const handleCourierAssign = async () => {
    setActionError(null);
    try {
      const courierId = selectedCourierId === "none" ? null : selectedCourierId || null;
      await onAssignCourier(order.id, courierId, order.version);
    } catch (err: any) {
      if (err.statusCode !== 409) {
        setActionError(err.message || "Ошибка назначения курьера");
      }
    }
  };

  const handleConfirmCancel = async () => {
    setActionError(null);
    try {
      await onCancelOrder(order.id, order.version, cancelReason);
      setShowCancelPrompt(false);
      setCancelReason("");
    } catch (err: any) {
      if (err.statusCode !== 409) {
        setActionError(err.message || "Ошибка отмены заказа");
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="relative w-full max-w-xl bg-white shadow-2xl z-10 flex flex-col h-full border-l border-slate-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-slate-500">#{order.id.slice(0, 8)}</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-200/80 text-slate-700">
                  v{order.version}
                </span>
                <StatusBadge status={order.status} size="sm" />
              </div>
              <h2 className="text-base font-semibold text-slate-900 mt-0.5">
                Заказ от {order.customerName}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
            title="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Concurrency conflict error banner */}
        {concurrencyError && (
          <div className="bg-amber-50 border-b border-amber-200 p-3.5 flex items-start justify-between gap-3 text-xs text-amber-800">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Конфликт одновременного редактирования</p>
                <p className="mt-0.5">{concurrencyError}</p>
              </div>
            </div>
            <button
              onClick={onClearConcurrencyError}
              className="text-amber-700 hover:text-amber-900 font-medium shrink-0 cursor-pointer"
            >
              Закрыть
            </button>
          </div>
        )}

        {/* Action Error banner (non-concurrency) */}
        {actionError && (
          <div className="bg-rose-50 border-b border-rose-200 p-3 flex items-start gap-2 text-xs text-rose-800">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">Ошибка операции</p>
              <p>{actionError}</p>
            </div>
            <button
              onClick={() => setActionError(null)}
              className="text-rose-600 hover:text-rose-800 p-1 cursor-pointer"
              title="Закрыть уведомление"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Main Info Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg">
              <span className="text-slate-400 font-medium">Сумма заказа</span>
              <div className="text-base font-bold text-slate-900 mt-0.5">
                {Number(order.amount).toLocaleString("ru-RU")} ₽
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg">
              <span className="text-slate-400 font-medium">Время создания</span>
              <div className="font-medium text-slate-800 mt-0.5">
                {new Date(order.createdAt).toLocaleDateString("ru-RU", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          </div>

          {/* Delivery & Client details */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Детали доставки
            </h3>
            <div className="bg-slate-50 border border-slate-100 rounded-lg p-3.5 space-y-2.5 text-xs">
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-slate-400">Адрес доставки</span>
                  <p className="font-medium text-slate-900">{order.deliveryAddress}</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 pt-2 border-t border-slate-200/60">
                <Store className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-slate-400">Ресторан</span>
                  <p className="font-medium text-slate-900">
                    {order.restaurant?.name || "Ресторан"}
                  </p>
                  <p className="text-slate-500">{order.restaurant?.address}</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 pt-2 border-t border-slate-200/60">
                <User className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-slate-400">Клиент</span>
                  <p className="font-medium text-slate-900">{order.customerName}</p>
                  {order.customerPhone && (
                    <p className="text-slate-500">{order.customerPhone}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Courier Assignment */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Назначенный курьер
              </h3>
              {order.courier?.id && (
                <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-sm border border-emerald-200">
                  Назначен
                </span>
              )}
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-lg p-3.5 space-y-3 text-xs">
              {order.courier?.id ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bike className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="text-slate-900 font-semibold text-sm">
                        {order.courier.name}
                      </span>
                    </div>
                    <span
                      className={`text-[11px] font-medium px-2 py-0.5 rounded-sm border ${
                        currentCourierCount >= 3
                          ? "bg-rose-50 text-rose-700 border-rose-200"
                          : "bg-slate-100 text-slate-700 border-slate-200"
                      }`}
                    >
                      {currentCourierCount}/3 активных доставок
                    </span>
                  </div>
                  {order.courier.phone && (
                    <div className="text-slate-500 text-xs pl-6">
                      Телефон: {order.courier.phone}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-slate-500">
                  <Bike className="w-4 h-4 text-slate-400" />
                  <span className="font-medium">Курьер еще не назначен</span>
                </div>
              )}

              {!isTerminal && (
                <div className="space-y-2 pt-2 border-t border-slate-200/60">
                  <div className="flex gap-2">
                    <select
                      value={selectedCourierId || order.courierId || ""}
                      onChange={(e) => setSelectedCourierId(e.target.value)}
                      disabled={isUpdating}
                      aria-label="Выбрать курьера"
                      className="flex-1 py-1.5 px-2.5 bg-white border border-slate-200 rounded-md text-xs text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-slate-900 cursor-pointer disabled:opacity-50"
                    >
                      <option value="">-- Выберите курьера --</option>
                      {order.courierId && order.status !== "picked_up" && (
                        <option value="none">Снять курьера</option>
                      )}
                      {couriers.map((c) => {
                        const isOverLimit = c.activeOrdersCount >= 3 && isOrderActiveForCourier && c.id !== order.courierId;
                        return (
                          <option
                            key={c.id}
                            value={c.id}
                            disabled={isOverLimit}
                          >
                            {c.name} ({c.activeOrdersCount}/3 акт. доставок)
                            {isOverLimit ? " - Занят" : ""}
                          </option>
                        );
                      })}
                    </select>

                    <button
                      onClick={handleCourierAssign}
                      disabled={isUpdating || !selectedCourierId || selectedCourierId === order.courierId}
                      className="px-3 py-1.5 bg-slate-900 text-white rounded-md text-xs font-medium hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    >
                      {isUpdating ? "..." : "Применить"}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Правило: курьер не может иметь более 3 активных доставок одновременно.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Operational Status Actions (FSM) */}
          {!isTerminal && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Управление заказом
              </h3>

              <div className="flex flex-wrap gap-2">
                {/* Next valid lifecycle step button */}
                {nextStep && (
                  <button
                    onClick={() => handleStatusChange(nextStep.next)}
                    disabled={isUpdating}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-600 text-white text-xs font-medium rounded-md hover:bg-emerald-700 disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    <span>{nextStep.label}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Cancel button */}
                {canCancel && !showCancelPrompt && (
                  <button
                    onClick={() => setShowCancelPrompt(true)}
                    disabled={isUpdating}
                    className="py-2 px-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-md hover:bg-rose-100 disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    Отменить заказ
                  </button>
                )}
              </div>

              {/* Cancellation prompt */}
              {showCancelPrompt && (
                <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-lg space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-rose-900">Подтверждение отмены</span>
                    <button
                      onClick={() => setShowCancelPrompt(false)}
                      className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                      title="Закрыть форму отмены"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Причина отмены (опционально)..."
                    className="w-full py-1.5 px-2 bg-white border border-rose-200 rounded text-xs text-rose-900 focus:outline-hidden focus:ring-1 focus:ring-rose-500"
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setShowCancelPrompt(false)}
                      className="px-2.5 py-1 bg-white border border-slate-200 rounded text-slate-600 hover:bg-slate-50 cursor-pointer"
                    >
                      Назад
                    </button>
                    <button
                      onClick={handleConfirmCancel}
                      disabled={isUpdating}
                      className="px-2.5 py-1 bg-rose-600 text-white rounded font-medium hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
                    >
                      Подтвердить отмену
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Audit Log Timeline */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <History className="w-3.5 h-3.5" />
              <span>Audit Log (История изменений)</span>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-lg p-4">
              {order.auditLogs && order.auditLogs.length > 0 ? (
                <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                  {order.auditLogs.map((log) => {
                    const timeStr = new Date(log.createdAt).toLocaleTimeString("ru-RU", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    });
                    const dateStr = new Date(log.createdAt).toLocaleDateString("ru-RU", {
                      day: "2-digit",
                      month: "2-digit",
                    });

                    return (
                      <div key={log.id} className="relative text-xs">
                        {/* Dot indicator */}
                        <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-slate-900 ring-4 ring-slate-50" />
                        
                        <div className="flex items-center justify-between text-slate-400 text-[11px]">
                          <span className="font-medium text-slate-700">{log.actionType}</span>
                          <span>{dateStr} {timeStr}</span>
                        </div>
                        <p className="text-slate-800 font-medium mt-0.5">{log.details}</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center py-2">
                  Записи аудита отсутствуют
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
