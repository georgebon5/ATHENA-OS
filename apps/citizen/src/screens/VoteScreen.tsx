import { useEffect, useState } from "react";
import type { Consultation, VoteChoice, VoteTally } from "@athena-os/contracts";
import { Shell, Spinner } from "../components/Shell";
import { BeforeAfter } from "../components/BeforeAfter";
import { Results } from "../components/Results";
import { ApiError, castVote, getConsultation, getTally, subscribeTally } from "../lib/api";
import { CHOICES, NEIGHBORHOODS } from "../lib/labels";

const storeKey = (id: string) => `athena_vote_${id}`;

function remembered(id: string): VoteChoice | null {
  try {
    const v = localStorage.getItem(storeKey(id));
    return v === "yes" || v === "no" || v === "maybe" ? v : null;
  } catch {
    return null;
  }
}

export function VoteScreen({ id }: { id: string }) {
  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mine, setMine] = useState<VoteChoice | null>(() => remembered(id));
  const [showResults, setShowResults] = useState(() => remembered(id) != null);
  const [tally, setTally] = useState<VoteTally | null>(null);
  const [pending, setPending] = useState<VoteChoice | null>(null);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [hood, setHood] = useState("");
  const [comment, setComment] = useState("");
  const [showComment, setShowComment] = useState(false);

  useEffect(() => {
    getConsultation(id)
      .then(setConsultation)
      .catch((e: ApiError) => setLoadError(e.status === 404 ? "Η διαβούλευση δεν βρέθηκε ή έχει κλείσει." : e.message));
  }, [id]);

  useEffect(() => {
    if (!showResults) return;
    getTally(id).then(setTally).catch(() => undefined);
    return subscribeTally(id, setTally);
  }, [id, showResults]);

  const vote = async (choice: VoteChoice) => {
    if (pending) return;
    setPending(choice);
    setVoteError(null);
    try {
      const location = NEIGHBORHOODS.find((n) => n.name === hood)?.lngLat ?? undefined;
      const t = await castVote(id, choice, location, comment.trim() || undefined);
      setTally(t);
      setMine(choice);
      setShowResults(true);
      navigator.vibrate?.(40);
      try {
        localStorage.setItem(storeKey(id), choice);
      } catch {
        /* private mode */
      }
    } catch (e) {
      const err = e as ApiError;
      setVoteError(err.status === 429 ? "Μία ψήφος τη φορά. Δοκίμασε ξανά σε λίγο." : err.message);
    } finally {
      setPending(null);
    }
  };

  if (loadError) {
    return (
      <Shell subtitle="Διαβούλευση">
        <div className="rounded-2xl bg-white p-6 shadow-card">
          <h1 className="text-xl font-bold">Κάτι δεν πήγε καλά</h1>
          <p className="mt-2 text-muted">{loadError}</p>
        </div>
      </Shell>
    );
  }
  if (!consultation) {
    return (
      <Shell subtitle="Διαβούλευση">
        <div className="space-y-4">
          <div className="aspect-[4/3] w-full animate-pulse rounded-2xl bg-line" />
          <div className="h-8 w-4/5 animate-pulse rounded bg-line" />
          <div className="h-16 animate-pulse rounded-2xl bg-line" />
        </div>
      </Shell>
    );
  }

  return (
    <Shell subtitle="Ανοιχτή διαβούλευση · Δήμος Αθηναίων">
      <div className="space-y-5">
        <BeforeAfter before={consultation.beforeUrl} after={consultation.afterUrl} />
        <h1 className="text-[23px] font-bold leading-snug">{consultation.questionEl}</h1>

        {showResults && tally ? (
          <>
            <Results tally={tally} mine={mine} />
            <button type="button" className="btn-secondary" onClick={() => setShowResults(false)}>
              Άλλαξε την ψήφο σου
            </button>
          </>
        ) : (
          <>
            <label className="block">
              <span className="mb-1.5 block text-[14px] font-semibold text-muted">Πού μένεις; (προαιρετικό)</span>
              <select value={hood} onChange={(e) => setHood(e.target.value)} className="field">
                <option value="">Δεν θέλω να πω</option>
                {NEIGHBORHOODS.map((n) => (
                  <option key={n.name} value={n.name}>
                    {n.name}
                  </option>
                ))}
              </select>
            </label>

            {showComment ? (
              <label className="block animate-rise">
                <span className="mb-1.5 block text-[14px] font-semibold text-muted">Σχόλιο (προαιρετικό)</span>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value.slice(0, 500))}
                  rows={3}
                  className="field resize-none"
                  placeholder="Τι πρέπει να ξέρει ο Δήμος;"
                />
              </label>
            ) : (
              <button type="button" className="text-[15px] font-semibold text-athenaDeep underline-offset-4 hover:underline" onClick={() => setShowComment(true)}>
                + Πρόσθεσε σχόλιο
              </button>
            )}

            <div className="grid grid-cols-1 gap-3" role="group" aria-label="Η ψήφος σου">
              {CHOICES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  disabled={!!pending}
                  onClick={() => vote(c.value)}
                  className={`flex h-[68px] items-center justify-center gap-3 rounded-2xl ${c.tone} text-[22px] font-bold text-white shadow-card transition active:scale-[0.98] disabled:opacity-70 ${
                    mine === c.value ? "ring-4 ring-ink/20" : ""
                  }`}
                >
                  {pending === c.value ? <Spinner /> : c.label}
                </button>
              ))}
            </div>
            {voteError && <p className="rounded-xl bg-no/10 px-4 py-3 text-[15px] font-medium text-no">{voteError}</p>}
            <p className="text-center text-[13px] text-muted">Μία ψήφος ανά κινητό. Μπορείς να την αλλάξεις όσο είναι ανοιχτή η διαβούλευση.</p>
          </>
        )}
      </div>
    </Shell>
  );
}
