/**
 * Κουμπί "Citizen App" → ανοίγει το citizen PWA σε νέο tab.
 * Ξεχωριστό tab = μηδέν conflicts με Cesium, μηδέν iframe nesting bugs.
 */
const CITIZEN_URL = import.meta.env.DEV ? "http://localhost:5174/c/" : "/c/";

export function PhonePreview() {
  return (
    <button
      type="button"
      onClick={() => window.open(CITIZEN_URL, "_blank")}
      className="pointer-events-auto fixed bottom-24 left-6 z-30 flex h-12 items-center gap-2.5 rounded-2xl bg-[rgba(5,49,93,0.75)] px-5 text-[13px] font-bold tracking-wide text-chalk/50 ring-1 ring-white/10 backdrop-blur-md transition hover:text-chalk hover:ring-holo/30 hover:shadow-[0_0_20px_-6px_rgba(121,183,228,0.4)]"
      title="Άνοιξε το citizen app σε νέο tab"
    >
      <PhoneIcon />
      Citizen App
      <span className="ml-1 rounded bg-white/10 px-1.5 py-0.5 text-[9px] tracking-widest text-chalk/40">NEW TAB</span>
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
