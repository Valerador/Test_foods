export function FoodsterIcon({ className = "w-full h-full" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 90 150"
      className={className}
      fill="#172554"
      aria-hidden="true"
    >
      <path
        d="M76 12H45a30 30 0 0 0-30 25L5 83h21l-10 51 51-77H34l2-10a11 11 0 0 1 12-10h23Z"
        fill="#2563eb"
      />
      <path
        d="M74 14H45a28 28 0 0 0-28 23L7 81h21l-8 43 43-65H32l2-12a13 13 0 0 1 12-12h24Z"
        fill="#FFF"
      />
      <path d="m76 12 9 6-5 25-9-6Z" fill="#1d4ed8" />
      <path
        d="M71 37H46a11 11 0 0 0-10 9l-2 11h9l2-10a5 5 0 0 1 5-4h30Z"
        fill="#1e3a8a"
      />
      <path d="m36 46-2 11h9Z" fill="#1d4ed8" />
      <path d="m67 57 9 6-51 77-9-6ZM5 83l9 6h11l1-6Z" fill="#1e3a8a" />
    </svg>
  );
}

export function FoodsterLogo() {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <div className="h-7 w-[17px] shrink-0">
        <FoodsterIcon />
      </div>
      <div className="flex items-center gap-1.5 leading-none">
        <span className="text-[18px] font-black italic tracking-wide text-blue-600">
          FOODSTER
        </span>
        <span className="text-[11px] font-bold text-slate-700 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded tracking-tight">
          OPS
        </span>
      </div>
    </div>
  );
}
