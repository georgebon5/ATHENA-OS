import type { LngLat } from "@athena-os/contracts";
import { SERAFIO } from "../lib/sensors";

// Σχηματικός χάρτης της περιοχής του demo (χωρίς tiles / βιβλιοθήκες: φορτώνει αμέσως).
const BBOX = { w: 23.7, s: 37.97, e: 23.73, n: 37.99 };
const W = 320;
const H = 240;
const STREETS: { name?: string; pts: LngLat[]; main?: boolean }[] = [
  {
    name: "Πειραιώς",
    main: true,
    pts: [
      [23.7, 37.9695],
      [23.705, 37.974],
      [23.708, 37.977],
      [23.7108, 37.9787],
      [23.7155, 37.9815],
      [23.722, 37.9845],
      [23.73, 37.9855],
    ],
  },
  { pts: [[23.7135, 37.9792], [23.7215, 37.9775], [23.73, 37.9762]] }, // Ερμού
  { pts: [[23.708, 37.9845], [23.716, 37.9832], [23.73, 37.9822]] }, // Αγ. Κωνσταντίνου / Μεγ. Αλεξάνδρου
  { pts: [[23.7195, 37.9768], [23.7205, 37.973], [23.7232, 37.9705]] }, // Απ. Παύλου
  { pts: [[23.7, 37.9772], [23.7065, 37.9757]] }, // Ρουφ
  { pts: [[23.712, 37.99], [23.7135, 37.9815]] }, // Κωνσταντινουπόλεως
];
const AREAS: { name: string; at: LngLat }[] = [
  { name: "ΓΚΑΖΙ", at: [23.7095, 37.9805] },
  { name: "ΚΕΡΑΜΕΙΚΟΣ", at: [23.7185, 37.9795] },
  { name: "ΘΗΣΕΙΟ", at: [23.7225, 37.9745] },
  { name: "ΡΟΥΦ", at: [23.703, 37.9745] },
];

function project([lng, lat]: LngLat): [number, number] {
  return [((lng - BBOX.w) / (BBOX.e - BBOX.w)) * W, ((BBOX.n - lat) / (BBOX.n - BBOX.s)) * H];
}

export function MiniMap({
  at,
  heading,
  approximate,
  points = [],
  caption,
}: {
  at: LngLat;
  heading: number | null;
  approximate?: boolean;
  points?: { lngLat: LngLat; color: string }[];
  caption?: string;
}) {
  const inside = at[0] >= BBOX.w && at[0] <= BBOX.e && at[1] >= BBOX.s && at[1] <= BBOX.n;
  const [x, y] = project(inside ? at : SERAFIO);
  const [sx, sy] = project(SERAFIO);
  return (
    <figure className="card overflow-hidden">
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label="Η θέση της αναφοράς στον χάρτη">
        <defs>
          <radialGradient id="glow">
            <stop offset="0" stopColor="#79b7e4" stopOpacity="0.5" />
            <stop offset="1" stopColor="#79b7e4" stopOpacity="0" />
          </radialGradient>
        </defs>
        {STREETS.map((s, i) => (
          <polyline
            key={i}
            points={s.pts.map((p) => project(p).join(",")).join(" ")}
            fill="none"
            stroke={s.main ? "#79b7e4" : "#1d4a78"}
            strokeOpacity={s.main ? 0.55 : 1}
            strokeWidth={s.main ? 5 : 3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {AREAS.map((a) => {
          const [ax, ay] = project(a.at);
          return (
            <text key={a.name} x={ax} y={ay} fill="#8fb1d1" fontSize="9" letterSpacing="2" textAnchor="middle">
              {a.name}
            </text>
          );
        })}
        <text x={project([23.7215, 37.9838])[0]} y={project([23.7215, 37.9838])[1] - 6} fill="#79b7e4" fontSize="10" opacity="0.8">
          Πειραιώς
        </text>
        <rect x={sx - 4} y={sy - 4} width="8" height="8" fill="#ffffff" opacity="0.8" transform={`rotate(45 ${sx} ${sy})`} />
        <text x={sx + 8} y={sy + 14} fill="#ffffff" fontSize="9" opacity="0.8">
          Σεράφειο
        </text>
        {points.map((p, i) => {
          const [px, py] = project(p.lngLat);
          return <circle key={i} cx={px} cy={py} r="4.5" fill={p.color} stroke="#031b35" strokeWidth="1.5" />;
        })}
        <circle cx={x} cy={y} r="34" fill="url(#glow)" />
        {heading != null && (
          <path d={`M ${x} ${y} L ${x - 11} ${y - 30} A 32 32 0 0 1 ${x + 11} ${y - 30} Z`} fill="#79b7e4" opacity="0.35" transform={`rotate(${heading} ${x} ${y})`} />
        )}
        <g style={{ transformOrigin: `${x}px ${y}px` }}>
          <circle cx={x} cy={y} r="10" fill="none" stroke="#79b7e4" strokeWidth="2" className="animate-pulseRing" style={{ transformOrigin: `${x}px ${y}px` }} />
        </g>
        <circle cx={x} cy={y} r="7" fill="#79b7e4" stroke="#031b35" strokeWidth="2.5" />
      </svg>
      <figcaption className="flex justify-between gap-3 border-t border-holo/10 px-4 py-2.5 text-[13px] text-chalk/75">
        <span>{caption ?? (approximate ? "Κατά προσέγγιση: Σεράφειο" : inside ? "Η αναφορά σου στον χάρτη" : "Εκτός της περιοχής του χάρτη")}</span>
        <span className="font-mono tabular-nums text-chalk/50">
          {at[1].toFixed(5)}, {at[0].toFixed(5)}
        </span>
      </figcaption>
    </figure>
  );
}
