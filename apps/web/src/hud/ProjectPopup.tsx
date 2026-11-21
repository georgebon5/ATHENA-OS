import { useState } from "react";
import { useStore } from "@/store/useStore";
import { getProjectById } from "@/layers/ProjectsLayer";
import type { CityProject } from "@/opendata/athensGovClient";

const STATUS_CFG: Record<CityProject["status"], { label: string; color: string; icon: string }> = {
  planned:     { label: "Προγραμματισμένο", color: "#e8d9c5", icon: "📋" },
  in_progress: { label: "Σε εξέλιξη",      color: "#00e5ff", icon: "🔧" },
  completed:   { label: "Ολοκληρώθηκε",    color: "#2ee6c9", icon: "✓" },
};

/** Ενδεικτικές εικόνες ανά κατηγορία έργου — πραγματικές Wikimedia Commons φωτογραφίες */
const CATEGORY_RENDER: Record<string, string> = {
  "Οδοποιία":              "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Smooth_new_sidewalk_with_tactile_paving.jpg/640px-Smooth_new_sidewalk_with_tactile_paving.jpg",
  "Αστικές Συγκοινωνίες":  "https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/Bus_lane_in_Madrid_01.jpg/640px-Bus_lane_in_Madrid_01.jpg",
  "Πρασινισμός":           "https://upload.wikimedia.org/wikipedia/commons/thumb/a/af/Parkbomen.jpg/640px-Parkbomen.jpg",
  "Αστικοί Χώροι":        "https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Monastiraki_Square_-_panoramio_%281%29.jpg/640px-Monastiraki_Square_-_panoramio_%281%29.jpg",
  "Κυκλοφορία":           "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/LED_traffic_light.jpg/640px-LED_traffic_light.jpg",
  "Βιώσιμη Κινητικότητα":  "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Bike_lane_on_road.JPG/640px-Bike_lane_on_road.JPG",
  "Ενέργεια":             "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d8/LED_streetlight.jpg/640px-LED_streetlight.jpg",
};

/** Εικόνες ανά project id — πιο συγκεκριμένες renders ανά έργο */
const PROJECT_RENDER: Record<string, string> = {
  "proj-007": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0f/Cycling_in_Copenhagen.jpg/640px-Cycling_in_Copenhagen.jpg",
  "proj-005": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Monastiraki_Square_-_panoramio_%281%29.jpg/640px-Monastiraki_Square_-_panoramio_%281%29.jpg",
  "proj-003": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/06/Nicosia_linear_park_2.jpg/640px-Nicosia_linear_park_2.jpg",
};

const DEFAULT_RENDER = "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/New_york_times_702702823.jpg/640px-New_york_times_702702823.jpg";

/** Εκτιμώμενη ολοκλήρωση ανά status + budget */
function estimateCompletion(p: CityProject): string {
  if (p.status === "completed") return "Ολοκληρώθηκε";
  const budget = p.budget ?? 500_000;
  if (p.status === "in_progress") {
    if (budget < 400_000) return "~Μάρτιος 2027";
    if (budget < 800_000) return "~Ιούνιος 2027";
    return "~Δεκέμβριος 2027";
  }
  // planned
  if (budget < 400_000) return "~Σεπτέμβριος 2027";
  return "~2028";
}

export function ProjectPopup() {
  const id = useStore((s) => s.pickedProjectId);
  const close = useStore((s) => s.setPickedProjectId);
  const [imgError, setImgError] = useState(false);

  const project = id ? getProjectById(id) : null;
  if (!project) return null;

  const st = STATUS_CFG[project.status];
  const renderUrl = imgError
    ? DEFAULT_RENDER
    : (PROJECT_RENDER[project.id] ?? CATEGORY_RENDER[project.category] ?? DEFAULT_RENDER);
  const eta = estimateCompletion(project);

  return (
    <div className="pointer-events-auto fixed bottom-24 left-1/2 z-20 -translate-x-1/2 animate-fadeUp">
      <div
        className="glass-strong w-[380px] max-w-[92vw] overflow-hidden rounded-2xl shadow-glowStrong"
        style={{ borderColor: st.color, borderWidth: 1 }}
      >
        {/* Render image */}
        <div className="relative">
          <img
            key={id}
            src={renderUrl}
            alt={project.title}
            className="h-40 w-full object-cover"
            onError={() => setImgError(true)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          {/* Status badge */}
          <span
            className="absolute left-3 top-3 flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider backdrop-blur-md"
            style={{ background: `${st.color}20`, color: st.color, border: `1px solid ${st.color}44` }}
          >
            <span>{st.icon}</span>
            {st.label}
          </span>
          {/* Close */}
          <button
            type="button"
            onClick={() => { close(null); setImgError(false); }}
            className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-[16px] leading-none text-white/70 backdrop-blur-md hover:text-white"
            aria-label="Κλείσιμο"
          >
            ×
          </button>
          {/* Title at bottom */}
          <div className="absolute inset-x-0 bottom-0 px-4 pb-3 pt-6">
            <span className="text-[16px] font-bold text-white">{project.title}</span>
          </div>
        </div>

        {/* Details */}
        <div className="space-y-3 px-4 py-3.5">
          {project.description && (
            <p className="text-[13px] leading-relaxed text-chalk/70">{project.description}</p>
          )}

          {/* ETA */}
          {project.status !== "completed" && (
            <div
              className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5"
              style={{ background: `${st.color}10`, border: `1px solid ${st.color}25` }}
            >
              <span className="text-[18px]">🕐</span>
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wider text-chalk/40">Εκτιμώμενη ολοκλήρωση</div>
                <div className="text-[15px] font-bold" style={{ color: st.color }}>{eta}</div>
              </div>
            </div>
          )}

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-2">
            {project.district && <InfoItem label="Περιοχή" value={project.district} />}
            <InfoItem label="Κατηγορία" value={project.category} />
            {project.budget != null && (
              <InfoItem label="Προϋπολογισμός" value={`€${(project.budget / 1000).toFixed(0)} χιλ.`} />
            )}
          </div>

          {/* Location */}
          <div className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-3 py-2">
            <span className="text-[13px] text-chalk/30">📍</span>
            <span className="data text-[11px] text-chalk/40">
              {project.coordinates[1].toFixed(5)}, {project.coordinates[0].toFixed(5)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/[0.03] px-3 py-2">
      <div className="hud-label text-[9px] text-chalk/35">{label}</div>
      <div className="mt-0.5 text-[13px] font-medium text-chalk/75">{value}</div>
    </div>
  );
}
