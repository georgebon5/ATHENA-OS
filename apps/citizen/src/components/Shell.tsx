import type { ReactNode } from "react";

export function Shell({ children, subtitle }: { children: ReactNode; subtitle?: string }) {
  return (
    <div className="min-h-full flex flex-col">
      <header className="sticky top-0 z-10 border-b border-holo/15 bg-void/70 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-md items-center gap-3 px-5 py-3.5">
          <LogoMark />
          <div className="min-w-0 leading-tight">
            <div className="flex items-baseline gap-1.5">
              <span className="font-display pr-0.5 text-[26px] font-black italic leading-none holo-text">ATHENA</span>
              <span className="-skew-x-6 rounded-sm bg-holo px-1 font-display text-[12px] font-black italic text-void">OS</span>
            </div>
            <div className="truncate text-[13px] text-muted">{subtitle ?? "Δήμος Αθηναίων · η πόλη σε ακούει"}</div>
          </div>
          <span className="ml-auto flex items-center gap-1.5 rounded-full bg-yes/10 px-2.5 py-1 font-display text-[11px] font-bold tracking-[0.18em] text-yes">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yes opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-yes" />
            </span>
            LIVE
          </span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-5 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-5">{children}</main>
    </div>
  );
}

/** Το σήμα της ATHENA (ίδιο με την κεντρική οθόνη). */
export function LogoMark({ size = 38 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="shrink-0 drop-shadow-[0_0_10px_rgba(121, 183, 228,0.55)]">
      <defs>
        <linearGradient id="athena-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#79b7e4" />
          <stop offset="1" stopColor="#ffffff" />
        </linearGradient>
      </defs>
      <path d="M32 7 53.6 19.5v25L32 57 10.4 44.5v-25Z" fill="rgba(3, 27, 53,0.6)" stroke="url(#athena-mark)" strokeWidth="2.5" />
      <circle cx="24" cy="31" r="6.5" fill="none" stroke="#79b7e4" strokeWidth="2.5" />
      <circle cx="40" cy="31" r="6.5" fill="none" stroke="#ffffff" strokeWidth="2.5" />
      <circle cx="24" cy="31" r="2.2" fill="#79b7e4" />
      <circle cx="40" cy="31" r="2.2" fill="#ffffff" />
      <path d="M28.5 41.5 32 45l3.5-3.5" fill="none" stroke="url(#athena-mark)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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
