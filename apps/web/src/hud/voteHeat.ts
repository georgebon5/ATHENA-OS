// Χρώμα ανά πλήθος ψήφων: λίγες → γαλάζιο, οι περισσότερες → σκούρο κόκκινο («κρίσιμο»).
// Κλίμακα μπλε→κόκκινο (ColorBrewer RdYlBu), σχετική με το πιο ψηφισμένο κοντά σου.
const HEAT: [number, string][] = [
  [0, "#79b7e4"],
  [0.18, "#e0f3f8"],
  [0.38, "#fee090"],
  [0.6, "#fdae61"],
  [0.8, "#d73027"],
  [1, "#7f0000"],
];
// ponytail: «κρίσιμο» θέλει ≥3 ψήφους, για να μη γίνεται κόκκινη μία μοναχική ψήφος· ρύθμισέ το για το demo
const MIN_CRITICAL = 3;

export function voteHeat(votes: number, maxVotes: number): { bg: string; fg: string; critical: boolean } {
  const t = Math.min(1, votes / Math.max(maxVotes, MIN_CRITICAL));
  const k = HEAT.findIndex(([s]) => s >= t);
  const [s0, c0] = HEAT[Math.max(0, k - 1)];
  const [s1, c1] = HEAT[k];
  const f = s1 === s0 ? 0 : (t - s0) / (s1 - s0);
  const mix = (i: number) => Math.round(parseInt(c0.slice(i, i + 2), 16) * (1 - f) + parseInt(c1.slice(i, i + 2), 16) * f);
  const [r, g, b] = [mix(1), mix(3), mix(5)];
  // Σκούρο κείμενο σε ανοιχτό φόντο, λευκό σε σκούρο
  return { bg: `rgb(${r}, ${g}, ${b})`, fg: 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#05315d" : "#ffffff", critical: t >= 0.8 };
}

// Δοκιμαστικές ψήφοι ΜΟΝΟ στην οθόνη (τίποτα δεν γράφεται στη βάση), για να φαίνεται η κλίμακα.
// Ανοιχτές by default· κλείνουν με το κουμπί και ο browser θυμάται την επιλογή. ?mockVotes=0|1 στο URL την παρακάμπτει.
const MOCK_KEY = "athena_mock_votes";

export function initialMockVotes(): boolean {
  const q = new URLSearchParams(location.search).get("mockVotes");
  if (q !== null) return q !== "0";
  try {
    return localStorage.getItem(MOCK_KEY) !== "0";
  } catch {
    return true;
  }
}

export function saveMockVotes(on: boolean): void {
  try {
    localStorage.setItem(MOCK_KEY, on ? "1" : "0");
  } catch {
    /* private mode: απλώς δεν θυμάται */
  }
}

// Κατά σειρά λίστας (πρώτο = περισσότερες), ώστε από πάνω προς τα κάτω να φαίνεται όλη η κλίμακα κόκκινο → μπλε.
const MOCK_SPREAD = [31, 24, 18, 13, 9, 6, 4, 2, 1, 0];

export function withMockVotes<T extends { yes: number }>(items: T[]): T[] {
  return items.map((i, k) => ({ ...i, yes: i.yes + (MOCK_SPREAD[k] ?? 0) }));
}
