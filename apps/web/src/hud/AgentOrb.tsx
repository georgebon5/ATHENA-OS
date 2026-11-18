import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useStore } from "@/store/useStore";

const MOOD_COLORS: Record<string, string> = {
  neutral: "#7bd1ff",
  alert: "#ff9a5a",
  proud: "#55e6c1",
};

/**
 * Το «πρόσωπο» της ATHENA: ένα orb που αναπνέει, και όταν μιλάει
 * παίζει audio + δείχνει waveform.
 */
export function AgentOrb() {
  const speech = useStore((s) => s.agentSpeech);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [intensity, setIntensity] = useState(0);
  const rafRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    if (!speech) return;
    if (!speech.audioUrl) {
      setIntensity(0.45);
      const t = window.setTimeout(() => setIntensity(0), 2800);
      return () => window.clearTimeout(t);
    }
    const audio = audioRef.current;
    if (!audio) return;
    audio.src = speech.audioUrl;

    let ctx: AudioContext | null = null;
    try {
      ctx = new AudioContext();
      const src = ctx.createMediaElementSource(audio);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      src.connect(analyser);
      analyser.connect(ctx.destination);
      analyserRef.current = analyser;
      const buf = new Uint8Array(analyser.frequencyBinCount);
      const loop = () => {
        analyser.getByteFrequencyData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i];
        setIntensity(Math.min(1, sum / buf.length / 140));
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    } catch (err) {
      console.warn("[orb] WebAudio failed", err);
    }
    void audio.play().catch(() => {
      // auto-play block — αγνοούμε, το orb συνεχίζει να αναπνέει
    });

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ctx?.close().catch(() => {});
      analyserRef.current = null;
    };
  }, [speech]);

  const color = MOOD_COLORS[speech?.mood ?? "neutral"];

  return (
    <div className="pointer-events-none fixed left-1/2 bottom-28 -translate-x-1/2 flex flex-col items-center gap-3">
      <motion.div
        className="relative w-24 h-24 rounded-full"
        animate={{ scale: 1 + intensity * 0.18 }}
        transition={{ type: "spring", stiffness: 180, damping: 16 }}
        style={{
          background: `radial-gradient(circle at 30% 30%, ${color}, #0b0f14 70%)`,
          boxShadow: `0 0 ${24 + intensity * 40}px ${color}`,
        }}
      >
        <div
          className="absolute inset-2 rounded-full border animate-breathe"
          style={{ borderColor: `${color}66` }}
        />
        <div
          className="absolute inset-5 rounded-full"
          style={{
            background: `radial-gradient(circle, ${color}cc, transparent 70%)`,
            opacity: 0.5 + intensity * 0.5,
          }}
        />
      </motion.div>
      <audio ref={audioRef} />
    </div>
  );
}
