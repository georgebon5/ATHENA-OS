import type { VoteChoice, VoteTally } from "@athena-os/contracts";
import { CHOICES } from "../lib/labels";

export function Results({ tally, mine }: { tally: VoteTally; mine: VoteChoice | null }) {
  const total = tally.yes + tally.no + tally.maybe;
  return (
    <section className="rounded-2xl bg-white p-5 shadow-card animate-rise" aria-live="polite">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-bold">Αποτελέσματα, live</h2>
        <span className="flex items-center gap-2 text-[13px] text-muted">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yes opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-yes" />
          </span>
          <span className="tabular-nums">{total}</span> {total === 1 ? "ψήφος" : "ψήφοι"}
        </span>
      </div>
      <ul className="mt-4 space-y-3">
        {CHOICES.map((c) => {
          const n = tally[c.value];
          const pct = total ? Math.round((n / total) * 100) : 0;
          return (
            <li key={c.value}>
              <div className="mb-1 flex justify-between text-[15px]">
                <span className="font-semibold">
                  {c.label}
                  {mine === c.value && <span className="ml-2 rounded-full bg-ink px-2 py-0.5 text-[12px] font-medium text-white">η ψήφος σου</span>}
                </span>
                <span className="tabular-nums text-muted">
                  {pct}% · {n}
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-paper">
                <div className={`h-full rounded-full ${c.tone} transition-[width] duration-700 ease-out`} style={{ width: `${pct}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-[13px] text-muted">Τα αποτελέσματα εμφανίζονται ζωντανά και στη μεγάλη οθόνη, πάνω στον χάρτη.</p>
    </section>
  );
}
