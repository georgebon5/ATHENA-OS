import { useState } from "react";
import { useStore } from "@/store/useStore";
import { categoryLabel } from "@/layers/ReportsLayer";
import type { ReportCategory, ReportStatus } from "@/types/contracts";

const SEVERITY_COLOR: Record<number, string> = {
  1: "#2ee6c9", 2: "#9fe68a", 3: "#ffd84d", 4: "#ff9a5a", 5: "#ff4b3e",
};

const ETA_DAYS: Record<string, Record<number, number>> = {
  pothole: { 1: 30, 2: 21, 3: 14, 4: 7, 5: 3 },
  sidewalk_damage: { 1: 60, 2: 45, 3: 30, 4: 14, 5: 7 },
  waste: { 1: 7, 2: 5, 3: 3, 4: 2, 5: 1 },
  lighting: { 1: 14, 2: 10, 3: 7, 4: 3, 5: 1 },
  obstruction: { 1: 7, 2: 5, 3: 3, 4: 2, 5: 1 },
  graffiti: { 1: 45, 2: 30, 3: 21, 4: 14, 5: 7 },
  accessibility: { 1: 90, 2: 60, 3: 45, 4: 21, 5: 10 },
  heat_exposure: { 1: 90, 2: 60, 3: 45, 4: 30, 5: 14 },
  other: { 1: 30, 2: 21, 3: 14, 4: 7, 5: 3 },
};

function estimateEta(category: string, severity: number): string {
  const days = ETA_DAYS[category]?.[severity] ?? ETA_DAYS.other[severity] ?? 14;
  if (days <= 1) return "~1 ημέρα";
  if (days < 7) return `~${days} ημέρες`;
  const weeks = Math.round(days / 7);
  if (weeks <= 4) return `~${weeks} εβδομάδ${weeks === 1 ? "α" : "ες"}`;
  const months = Math.round(days / 30);
  return `~${months} μήν${months === 1 ? "ας" : "ες"}`;
}

/** Returns true only if the report has a real user photo */
function hasRealPhoto(reportId: string, photoUrl: string): boolean {
  if (!photoUrl) return false;
  if (reportId.startsWith("r-seed")) return false;
  if (photoUrl.includes("placeholder") || photoUrl.startsWith("/mock") || photoUrl.includes("/media/photos/seed")) return false;
  return true;
}

function deriveStatus(r: { classification?: unknown; status?: ReportStatus }): ReportStatus {
  if (r.status) return r.status;
  return r.classification ? "classified" : "pending";
}

const STATUS_CFG: Record<ReportStatus, { label: string; color: string; bg: string }> = {
  pending:     { label: "Αναμονή",      color: "#ffd84d", bg: "rgba(255,216,77,0.15)" },
  classified:  { label: "Ταξινομήθηκε", color: "#79b7e4", bg: "rgba(121,183,228,0.15)" },
  in_progress: { label: "Σε εξέλιξη",   color: "#ff9a5a", bg: "rgba(255,154,90,0.15)" },
  resolved:    { label: "Επιλύθηκε",    color: "#2ee6c9", bg: "rgba(46,230,201,0.15)" },
  rejected:    { label: "Απορρίφθηκε",  color: "#ff4b3e", bg: "rgba(255,75,62,0.15)" },
};

export function ReportPopup() {
  const id = useStore((s) => s.pickedReportId);
  const report = useStore((s) => (id ? s.reports[id] : null));
  const close = useStore((s) => s.setPickedReportId);
  const upsertReport = useStore((s) => s.upsertReport);
  const [imgError, setImgError] = useState(false);

  if (!report) return null;

  const c = report.classification;
  const severity = c?.severity ?? 3;
  const sevColor = SEVERITY_COLOR[severity] ?? "#79b7e4";
  const category = c?.category ?? "other";
  const status = deriveStatus(report);
  const st = STATUS_CFG[status];
  const eta = estimateEta(category, severity);
  const showPhoto = hasRealPhoto(report.id, report.photoUrl) && !imgError;
  const timeAgo = formatTimeAgo(report.createdAt);
  const isOpen = status !== "resolved" && status !== "rejected";

  const handleAssign = () => {
    upsertReport({ ...report, status: "in_progress" });
  };

  const handleResolve = () => {
    upsertReport({ ...report, status: "resolved" });
  };

  return (
    <div className="pointer-events-auto fixed bottom-[100px] right-[300px] z-20 animate-fadeUp">
      <div
        className="glass-strong w-[320px] max-w-[92vw] overflow-hidden rounded-2xl shadow-glowStrong"
        style={{ borderColor: sevColor, borderWidth: 1 }}
      >
        {/* Photo — only if real */}
        {showPhoto && (
          <div className="relative">
            <img
              key={id}
              src={report.photoUrl}
              alt={c ? categoryLabel(c.category) : "Αναφορά"}
              className="h-36 w-full object-cover"
              onError={() => setImgError(true)}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          </div>
        )}

        {/* Header */}
        <div className="flex items-start gap-3 px-4 pt-3.5 pb-1">
          <span
            className="mt-1 inline-block h-3 w-3 flex-shrink-0 rounded-full"
            style={{ background: sevColor, boxShadow: `0 0 8px ${sevColor}` }}
          />
          <div className="min-w-0 flex-1">
            <div className="text-[16px] font-bold text-chalk/90">
              {c ? categoryLabel(c.category) : "Νέα αναφορά"}
            </div>
            {c?.summaryEl && (
              <p className="mt-0.5 text-[13px] leading-relaxed text-chalk/60">{c.summaryEl}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {c && (
              <span
                className="data rounded-md px-2 py-0.5 text-[11px] font-bold"
                style={{ background: `${sevColor}20`, color: sevColor }}
              >
                {severity}/5
              </span>
            )}
            <button
              type="button"
              onClick={() => { close(null); setImgError(false); }}
              className="flex h-6 w-6 items-center justify-center rounded-full text-[14px] text-chalk/40 hover:text-chalk/80 transition-colors"
              aria-label="Κλείσιμο"
            >
              ×
            </button>
          </div>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 px-4 py-2 text-[11px] text-chalk/40">
          <span
            className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase"
            style={{ background: st.bg, color: st.color }}
          >
            {st.label}
          </span>
          {c?.department && <span>{c.department}</span>}
          <span className="ml-auto">{timeAgo}</span>
        </div>

        {/* ETA */}
        {isOpen && (
          <div className="mx-4 mb-2 flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: `${sevColor}08`, border: `1px solid ${sevColor}18` }}>
            <div className="text-[11px] text-chalk/40">Εκτ. επίλυση</div>
            <div className="text-[13px] font-semibold" style={{ color: sevColor }}>{eta}</div>
          </div>
        )}

        {/* Action buttons — pending/classified: both buttons */}
        {isOpen && status !== "in_progress" && (
          <div className="flex gap-2 px-4 pb-3.5 pt-1">
            <button
              onClick={handleAssign}
              className="flex-1 rounded-xl py-2 text-[12px] font-semibold transition-all hover:scale-[1.02] active:scale-95"
              style={{
                background: "rgba(121,183,228,0.12)",
                color: "#79b7e4",
                border: "1px solid #79b7e418",
              }}
            >
              Ανάθεση στην υπηρεσία
            </button>
            <button
              onClick={handleResolve}
              className="flex-1 rounded-xl bg-cool/15 py-2 text-[12px] font-semibold text-cool transition-all hover:bg-cool/25 hover:scale-[1.02] active:scale-95"
              style={{ border: "1px solid rgba(46,230,201,0.18)" }}
            >
              Επιλύθηκε
            </button>
          </div>
        )}

        {/* In progress — assigned, waiting for resolution */}
        {status === "in_progress" && (
          <div className="px-4 pb-3.5 pt-1 flex flex-col gap-2">
            <div className="rounded-lg px-3 py-2 text-center text-[12px] font-semibold" style={{ background: "rgba(255,154,90,0.12)", color: "#ff9a5a", border: "1px solid rgba(255,154,90,0.2)" }}>
              Ανατέθηκε στην αρμόδια υπηρεσία
            </div>
            <button
              onClick={handleResolve}
              className="w-full rounded-xl bg-cool/15 py-2 text-[12px] font-semibold text-cool transition-all hover:bg-cool/25 hover:scale-[1.02] active:scale-95"
              style={{ border: "1px solid rgba(46,230,201,0.18)" }}
            >
              Επιλύθηκε
            </button>
          </div>
        )}

        {/* Resolved confirmation */}
        {status === "resolved" && (
          <div className="mx-4 mb-3 rounded-lg bg-cool/10 px-3 py-2 text-center text-[12px] font-semibold text-cool" style={{ border: "1px solid rgba(46,230,201,0.2)" }}>
            Το αίτημα επιλύθηκε
          </div>
        )}
      </div>
    </div>
  );
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - Date.parse(iso);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Μόλις τώρα";
  if (mins < 60) return `${mins} λεπτά πριν`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ώρ${hours === 1 ? "α" : "ες"} πριν`;
  const days = Math.floor(hours / 24);
  return `${days} ημέρ${days === 1 ? "α" : "ες"} πριν`;
}
