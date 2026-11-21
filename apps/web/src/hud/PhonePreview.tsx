import { useEffect } from "react";
import { useStore } from "@/store/useStore";
import { cameraController } from "@/cesium/cameraShots";
import { SERAFIO_LNGLAT, HEIGHT } from "@/cesium/constants";

const ATTICA = { w: 23.3, s: 37.6, e: 24.2, n: 38.4 };

/**
 * Toggle: Admin ↔ Citizen mode.
 * Citizen mode: κάμερα πάνω από τον χρήστη, καθαρό UI (κρύβονται τα admin panels),
 * ελεύθερο roam στο 3D, NearbyPanel δείχνει τις αναφορές/προτάσεις κοντά.
 */
export function PhonePreview() {
  const citizenMode = useStore((s) => s.citizenMode);
  const setCitizenMode = useStore((s) => s.setCitizenMode);

  // Fly camera to user location when entering citizen mode
  useEffect(() => {
    if (!citizenMode) return;
    if (!("geolocation" in navigator)) {
      cameraController.flyTo({ lngLat: SERAFIO_LNGLAT, heightM: HEIGHT.nearby, headingDeg: 0, pitchDeg: -60, durationS: 2.5 });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const at: [number, number] = [p.coords.longitude, p.coords.latitude];
        const inAttica = at[0] > ATTICA.w && at[0] < ATTICA.e && at[1] > ATTICA.s && at[1] < ATTICA.n;
        const target = inAttica ? at : SERAFIO_LNGLAT;
        cameraController.flyTo({ lngLat: target, heightM: HEIGHT.nearby, headingDeg: 0, pitchDeg: -60, durationS: 2.5 });
      },
      () => {
        cameraController.flyTo({ lngLat: SERAFIO_LNGLAT, heightM: HEIGHT.nearby, headingDeg: 0, pitchDeg: -60, durationS: 2.5 });
      },
      { timeout: 6000, maximumAge: 300_000 },
    );
  }, [citizenMode]);

  // Keyboard shortcut: C toggles citizen mode
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "c" || e.key === "C") setCitizenMode(!citizenMode);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [citizenMode, setCitizenMode]);

  return (
    <button
      type="button"
      onClick={() => setCitizenMode(!citizenMode)}
      className={`pointer-events-auto fixed bottom-24 left-6 z-30 flex h-12 items-center gap-2.5 rounded-2xl px-5 text-[13px] font-bold tracking-wide transition-all duration-300 ${
        citizenMode
          ? "bg-holo/20 text-holo ring-2 ring-holo/50 shadow-[0_0_24px_-6px_rgba(121,183,228,0.5)]"
          : "bg-[rgba(5,49,93,0.75)] text-chalk/50 ring-1 ring-white/10 backdrop-blur-md hover:text-chalk hover:ring-holo/30"
      }`}
      title="C = εναλλαγή Admin ↔ Citizen"
    >
      {citizenMode ? (
        <>
          <EyeIcon />
          <span>Citizen Mode</span>
          <span className="ml-1 rounded bg-holo/20 px-1.5 py-0.5 text-[10px] tracking-widest text-holo/80">ON</span>
        </>
      ) : (
        <>
          <ShieldIcon />
          <span>Admin Mode</span>
        </>
      )}
    </button>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
