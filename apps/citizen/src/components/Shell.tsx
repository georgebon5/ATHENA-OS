import type { ReactNode } from "react";

export function Shell({ children, subtitle }: { children: ReactNode; subtitle?: string }) {
  return (
    <div className="min-h-full flex flex-col">
      <header className="bg-ink text-white pt-[env(safe-area-inset-top)]">
        <div className="mx-auto max-w-md px-5 py-4 flex items-center gap-3">
          <span className="relative grid place-items-center h-9 w-9 rounded-full bg-athena/15 shadow-glow" aria-hidden>
            <span className="h-3 w-3 rounded-full bg-athena" />
          </span>
          <div className="leading-tight">
            <div className="font-semibold tracking-[0.2em] text-[15px]">ATHENA</div>
            <div className="text-[13px] text-white/70">{subtitle ?? "Δήμος Αθηναίων · η πόλη σε ακούει"}</div>
          </div>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-md px-5 pt-5 pb-[calc(env(safe-area-inset-bottom)+24px)]">{children}</main>
    </div>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block h-5 w-5 animate-spin rounded-full border-[3px] border-current border-r-transparent ${className}`}
      role="status"
      aria-label="Φόρτωση"
    />
  );
}
