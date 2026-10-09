import { Search, X, RotateCcw, ArrowUpDown } from "lucide-react";
import type { OrderFilters, OrderStatus, Restaurant } from "../types.js";

interface FilterBarProps {
  filters: OrderFilters;
  onChange: (filters: OrderFilters) => void;
  restaurants: Restaurant[];
}

const STATUS_OPTIONS: { value: OrderStatus | ""; label: string }[] = [
  { value: "", label: "Все статусы" },
  { value: "new", label: "Новые" },
  { value: "accepted", label: "Приняты" },
  { value: "preparing", label: "Готовятся" },
  { value: "ready", label: "Готовы к выдаче" },
  { value: "picked_up", label: "В пути" },
  { value: "delivered", label: "Доставлены" },
  { value: "cancelled", label: "Отменены" },
];

export function FilterBar({ filters, onChange, restaurants }: FilterBarProps) {
  const isFiltered = Boolean(filters.status || filters.restaurantId || filters.search);

  const handleReset = () => {
    onChange({
      ...filters,
      status: "",
      restaurantId: "",
      search: "",
      page: 1,
    });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        {/* Search by delivery address */}
        <div className="relative md:col-span-5">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={filters.search || ""}
            onChange={(e) => onChange({ ...filters, search: e.target.value, page: 1 })}
            placeholder="Поиск по адресу (с опечатками)..."
            className="w-full pl-9 pr-8 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900 focus:bg-white transition-colors"
          />
          {filters.search && (
            <button
              onClick={() => onChange({ ...filters, search: "", page: 1 })}
              className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter by Status */}
        <div className="md:col-span-3">
          <select
            value={filters.status || ""}
            onChange={(e) =>
              onChange({ ...filters, status: e.target.value as OrderStatus | "", page: 1 })
            }
            aria-label="Фильтр по статусу"
            className="w-full py-2 px-3 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900 focus:bg-white transition-colors cursor-pointer"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Filter by Restaurant */}
        <div className="md:col-span-4">
          <select
            value={filters.restaurantId || ""}
            onChange={(e) => onChange({ ...filters, restaurantId: e.target.value, page: 1 })}
            aria-label="Фильтр по ресторану"
            className="w-full py-2 px-3 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900 focus:bg-white transition-colors cursor-pointer"
          >
            <option value="">Все рестораны ({restaurants.length})</option>
            {restaurants.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Secondary bar: Sorting, reset and counter */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-medium text-slate-700">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <span>Сортировка:</span>
          </div>

          <button
            onClick={() => {
              if (filters.sortBy === "createdAt") {
                onChange({ ...filters, sortOrder: filters.sortOrder === "desc" ? "asc" : "desc" });
              } else {
                onChange({ ...filters, sortBy: "createdAt", sortOrder: "desc" });
              }
            }}
            className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
              filters.sortBy === "createdAt"
                ? "bg-slate-900 text-white font-medium"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700"
            }`}
          >
            По дате {filters.sortBy === "createdAt" && (filters.sortOrder === "desc" ? "↓" : "↑")}
          </button>

          <button
            onClick={() => {
              if (filters.sortBy === "amount") {
                onChange({ ...filters, sortOrder: filters.sortOrder === "desc" ? "asc" : "desc" });
              } else {
                onChange({ ...filters, sortBy: "amount", sortOrder: "desc" });
              }
            }}
            className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
              filters.sortBy === "amount"
                ? "bg-slate-900 text-white font-medium"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700"
            }`}
          >
            По сумме {filters.sortBy === "amount" && (filters.sortOrder === "desc" ? "↓" : "↑")}
          </button>

          <button
            onClick={() => {
              if (filters.sortBy === "status") {
                onChange({ ...filters, sortOrder: filters.sortOrder === "desc" ? "asc" : "desc" });
              } else {
                onChange({ ...filters, sortBy: "status", sortOrder: "asc" });
              }
            }}
            className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
              filters.sortBy === "status"
                ? "bg-slate-900 text-white font-medium"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700"
            }`}
          >
            По статусу {filters.sortBy === "status" && (filters.sortOrder === "desc" ? "↓" : "↑")}
          </button>
        </div>

        {isFiltered && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Сбросить фильтры</span>
          </button>
        )}
      </div>
    </div>
  );
}
