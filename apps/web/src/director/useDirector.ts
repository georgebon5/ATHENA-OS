import { useEffect, useState } from "react";
import { useStore } from "@/store/useStore";
import type { DemoBeat } from "@/types/contracts";
import { triggerBeat, triggerText } from "./directorApi";
import { playFallback } from "./fallback";

const BEATS: DemoBeat[] = [
  "INTRO",
  "PITCH",
  "SENSE",
  "SIMULATE",
  "ENGAGE",
  "DECISION",
  "CLOSE",
];

/**
 * Hook που κρατά τον director σε state και χειρίζεται τα keybindings
 * ­— ενεργοποιείται με `?director=1` στο URL ή με Ctrl+D.
 */
export function useDirector(): {
  director: boolean;
  promptOpen: boolean;
  openPrompt: () => void;
  closePrompt: () => void;
  submitPrompt: (text: string) => Promise<void>;
} {
  const director = useStore((s) => s.director);
  const setDirector = useStore((s) => s.setDirector);
  const setBeat = useStore((s) => s.setBeat);
  const reset = useStore((s) => s.reset);
  const [promptOpen, setPromptOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("director") === "1") setDirector(true);
  }, [setDirector]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      // Ctrl+D ανοίγει/κλείνει τον director
      if (ev.ctrlKey && (ev.key === "d" || ev.key === "D")) {
        ev.preventDefault();
        setDirector(!useStore.getState().director);
        return;
      }
      if (!useStore.getState().director) return;
      if (promptOpen) return;

      if (ev.key >= "1" && ev.key <= "7") {
        const beat = BEATS[parseInt(ev.key, 10) - 1];
        setBeat(beat);
        void triggerBeat(beat);
        return;
      }
      if (ev.key === "f" || ev.key === "F") {
        playFallback(useStore.getState().beat);
        return;
      }
      if (ev.key === "t" || ev.key === "T") {
        setPromptOpen(true);
        return;
      }
      if (ev.key === "r" || ev.key === "R") {
        reset();
        setBeat("INTRO");
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [promptOpen, reset, setBeat, setDirector]);

  return {
    director,
    promptOpen,
    openPrompt: () => setPromptOpen(true),
    closePrompt: () => setPromptOpen(false),
    submitPrompt: async (text: string) => {
      await triggerText(text);
      setPromptOpen(false);
    },
  };
}
