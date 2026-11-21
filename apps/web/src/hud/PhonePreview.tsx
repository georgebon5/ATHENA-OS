import { useState } from "react";

const CITIZEN_URL = import.meta.env.DEV ? "http://localhost:5174/c/" : "/c/";

/**
 * iPhone-style frame που δείχνει το citizen app σε iframe.
 * Toggle κουμπί κάτω-αριστερά · slide-in animation.
 */
export function PhonePreview() {
  const [open, setOpen] = useState(false);
  const [route, setRoute] = useState<"/" | "/r">("/" );

  return (
    <>
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`pointer-events-auto fixed bottom-24 left-6 z-30 flex h-11 items-center gap-2 rounded-xl px-4 text-[13px] font-bold tracking-wide transition-all duration-300 ${
          open
            ? "bg-holo/20 text-holo ring-1 ring-holo/40"
            : "bg-[rgba(5,49,93,0.7)] text-chalk/60 ring-1 ring-white/10 hover:text-chalk hover:ring-holo/30"
        }`}
        title="Προεπισκόπηση citizen app (κινητό)"
      >
        <PhoneIcon />
        {open ? "Κλείσε κινητό" : "Citizen view"}
      </button>

      {/* Phone frame */}
      <div
        className={`pointer-events-auto fixed bottom-6 left-6 z-20 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          open
            ? "translate-x-0 opacity-100"
            : "-translate-x-[120%] opacity-0 pointer-events-none"
        }`}
      >
        {/* Route tabs */}
        <div className="mb-2 flex gap-1 rounded-lg bg-[rgba(5,49,93,0.8)] p-1 backdrop-blur-md">
          <TabBtn active={route === "/"} onClick={() => setRoute("/")}>
            Κοντά μου
          </TabBtn>
          <TabBtn active={route === "/r"} onClick={() => setRoute("/r")}>
            Αναφορά
          </TabBtn>
        </div>

        {/* iPhone shell */}
        <div className="relative h-[680px] w-[340px] overflow-hidden rounded-[44px] border-[3px] border-[#2a2a2e] bg-black shadow-[0_20px_80px_-20px_rgba(0,0,0,0.9),0_0_40px_-10px_rgba(121,183,228,0.3)]">
          {/* Notch / Dynamic Island */}
          <div className="absolute left-1/2 top-2 z-10 h-[28px] w-[100px] -translate-x-1/2 rounded-full bg-black" />

          {/* Status bar glow */}
          <div className="absolute inset-x-0 top-0 z-10 h-12 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />

          {/* iframe */}
          <iframe
            src={`${CITIZEN_URL}${route === "/r" ? "r" : ""}`}
            className="h-full w-full border-0 bg-[#031b35]"
            title="ATHENA OS Citizen App"
            allow="camera;geolocation"
          />

          {/* Home indicator */}
          <div className="absolute bottom-2 left-1/2 z-10 h-[5px] w-[120px] -translate-x-1/2 rounded-full bg-white/30" />
        </div>
      </div>
    </>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-md py-1.5 text-[11px] font-semibold uppercase tracking-wider transition ${
        active ? "bg-holo/20 text-holo" : "text-chalk/40 hover:text-chalk/60"
      }`}
    >
      {children}
    </button>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
      <line x1="12" y1="18" x2="12" y2="18" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
