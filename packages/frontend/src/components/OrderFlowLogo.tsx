export function OrderFlowIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect width="24" height="24" rx="6" fill="#2563eb" />
      <path
        d="M7 8.5L12 5.5L17 8.5M7 8.5L12 11.5M7 8.5V14.5L12 17.5M17 8.5L12 11.5M17 8.5V14.5L12 17.5M12 11.5V17.5"
        stroke="white"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function OrderFlowLogo() {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <div className="h-6 w-6 shrink-0 shadow-xs rounded-md overflow-hidden">
        <OrderFlowIcon />
      </div>
      <div className="flex items-center gap-1.5 leading-none">
        <span className="text-[17px] font-bold tracking-tight text-slate-900">
          Order<span className="text-blue-600">Flow</span>
        </span>
        <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 border border-slate-200/80 px-1.5 py-0.5 rounded tracking-wider uppercase">
          Ops
        </span>
      </div>
    </div>
  );
}
