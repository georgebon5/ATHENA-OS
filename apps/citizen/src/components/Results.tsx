import type { VoteChoice, VoteTally } from "@athena-os/contracts";
import { CHOICES } from "../lib/labels";

export function Results({ tally, mine }: { tally: VoteTally; mine: VoteChoice | null }) {
  const total = tally.yes + tally.no + tally.maybe;
  return (
    <section className="card p-5 animate-rise" aria-live="polite">
      <div className="flex items-baseline justify-between">
        <h2 className="hud-label">Αποτελέσματα · live</h2>
        <span className="flex items-center gap-2 text-[13px] text-muted">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yes opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-yes" />
          </span>
          <span className="font-mono tabular-nums text-chalk">{total}</span> {total === 1 ? "ψήφος" : "ψήφοι"}
        </span>
      </div>
      <ul className="mt-5 space-y-4">
        {CHOICES.map((c) => {
          const n = tally[c.value];
          const pct = total ? Math.round((n / total) * 100) : 0;
          return (
            <li key={c.value}>
              <div className="mb-1.5 flex items-center justify-between text-[15px]">
                <span className="flex items-center gap-2 font-semibold">
                  {c.label}
                  {mine === c.value && (
                    <span className="rounded-full bg-gradient-to-r from-holo to-plasma px-2 py-0.5 text-[11px] font-bold text-void">η ψήφος σου</span>
                  )}
                </span>
                <span className="font-mono tabular-nums text-muted">
                  <span className="text-chalk">{pct}%</span> · {n}
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-paper shadow-[inset_0_0_0_1px_rgba(255,95,184,0.12)]">
                <div
                  className={`h-full rounded-full ${c.tone} transition-[width] duration-700 ease-out`}
                  style={{ width: `${pct}%`, boxShadow: "0 0 12px currentColor" }}
                />
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-5 text-[13px] text-muted">Τα αποτελέσματα εμφανίζονται ζωντανά και στη μεγάλη οθόνη, πάνω στον χάρτη.</p>
    </section>
  );
}
