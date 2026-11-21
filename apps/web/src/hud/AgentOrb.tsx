import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useStore } from "@/store/useStore";

const MOOD_COLORS: Record<string, [string, string]> = {
  neutral: ["#79b7e4", "#ffffff"],
  alert: ["#ffd84d", "#ff4b3e"],
  proud: ["#2ee6c9", "#79b7e4"],
};

const BARS = 28;

/**
 * Ο «πυρήνας» της ATHENA: ολογραφικό orb με δαχτυλίδια που γυρίζουν και
 * ακτίνα κυματομορφής που αντιδρά στη φωνή της (WebAudio analyser).
 */
export function AgentOrb() {
  const speech = useStore((s) => s.agentSpeech);
  const thinking = useStore((s) => s.thinking.length > 0 || (s.simProgress !== null && s.simProgress < 1));
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [levels, setLevels] = useState<number[]>(() => Array(BARS).fill(0));
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!speech) return;
    if (!speech.audioUrl) {
      // Χωρίς φωνή: «ομιλία» με ήπιο συνθετικό παλμό όσο διαβάζεται ο υπότιτλος
      const started = performance.now();
      const loop = (now: number) => {
        const t = (now - started) / 1000;
        if (t > 3.2) return setLevels(Array(BARS).fill(0));
        setLevels(Array.from({ length: BARS }, (_, i) => 0.25 + 0.35 * Math.abs(Math.sin(t * 7 + i * 0.7))));
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }
    const audio = audioRef.current;
    if (!audio) return;
    audio.src = speech.audioUrl;

    let ctx: AudioContext | null = null;
    try {
      ctx = new AudioContext();
      const src = ctx.createMediaElementSource(audio);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      src.connect(analyser);
      analyser.connect(ctx.destination);
      const buf = new Uint8Array(analyser.frequencyBinCount);
      const loop = () => {
        analyser.getByteFrequencyData(buf);
        setLevels(Array.from({ length: BARS }, (_, i) => buf[i % buf.length] / 255));
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    } catch (err) {
      console.warn("[orb] WebAudio failed", err);
    }
    void audio.play().catch(() => {
      // auto-play block — το orb συνεχίζει να αναπνέει
    });
    audio.onended = () => setLevels(Array(BARS).fill(0));

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ctx?.close().catch(() => {});
    };
  }, [speech]);

  const [c1, c2] = MOOD_COLORS[speech?.mood ?? "neutral"];
  const energy = levels.reduce((a, b) => a + b, 0) / BARS;

  return (
    <div className="pointer-events-none relative h-[112px] w-[112px] shrink-0">
      {/* Ακτίνα κυματομορφής */}
      <svg viewBox="-60 -60 120 120" className="absolute inset-0 h-full w-full">
        {levels.map((l, i) => {
          const a = (i / BARS) * Math.PI * 2;
          const r0 = 40;
          const r1 = r0 + 4 + l * 16;
          return (
            <line
              key={i}
              x1={Math.cos(a) * r0}
              y1={Math.sin(a) * r0}
              x2={Math.cos(a) * r1}
              y2={Math.sin(a) * r1}
              stroke={i % 2 ? c2 : c1}
              strokeWidth={2}
              strokeLinecap="round"
              opacity={0.35 + l * 0.65}
            />
          );
        })}
      </svg>
      {/* Δαχτυλίδια */}
      <div
        className={`absolute inset-[14px] rounded-full ${thinking ? "animate-spin-fast" : "animate-spin-slow"}`}
        style={{ background: `conic-gradient(from 0deg, transparent 0 60%, ${c1} 75%, transparent 76% 100%)`, mask: "radial-gradient(circle, transparent 62%, #000 63%)", WebkitMask: "radial-gradient(circle, transparent 62%, #000 63%)" }}
      />
      <div
        className="absolute inset-[20px] rounded-full animate-spin-slower"
        style={{ border: `1px dashed ${c2}88` }}
      />
      {/* Πυρήνας */}
      <motion.div
        className="absolute inset-[30px] rounded-full"
        animate={{ scale: 1 + energy * 0.25 }}
        transition={{ type: "spring", stiffness: 220, damping: 14 }}
        style={{
          background: `radial-gradient(circle at 35% 30%, #ffffff 0%, ${c1} 22%, ${c2} 62%, #031b35 100%)`,
          boxShadow: `0 0 ${26 + energy * 50}px ${c1}, 0 0 ${60 + energy * 80}px ${c2}66`,
        }}
      >
        <div className="absolute inset-0 rounded-full animate-breathe" style={{ boxShadow: `inset 0 0 18px ${c1}` }} />
      </motion.div>
      <audio ref={audioRef} />
    </div>
  );
}
