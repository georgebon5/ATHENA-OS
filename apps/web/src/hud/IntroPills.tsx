import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "@/store/useStore";
import { useFootfall } from "@/opendata/useFootfall";
import { useEnvSensors } from "@/opendata/useEnvSensors";

export function IntroPills() {
  const beat = useStore((s) => s.beat);
  const buses = useStore((s) => s.buses.length);
  const { total: footfall } = useFootfall();
  const { reading: env } = useEnvSensors();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (beat !== "INTRO") { setVisible(false); return; }
    const show = window.setTimeout(() => setVisible(true), 1800);
    const hide = window.setTimeout(() => setVisible(false), 10000);
    return () => { window.clearTimeout(show); window.clearTimeout(hide); };
  }, [beat]);

  const pills = [
    {
      icon: "🚌",
      text: `${buses > 0 ? buses : 24} λεωφορεία σε κίνηση τώρα`,
    },
    {
      icon: "🌡️",
      text: env ? `${env.temperature.toFixed(1)}° · AQI ${env.aqi}` : "22.1° · AQI 2",
    },
    {
      icon: "👥",
      text: `${footfall > 0 ? footfall.toLocaleString("el-GR") : "2.590"} επισκέπτες σήμερα`,
    },
  ];

  return (
    <AnimatePresence>
      {visible && (
        <div className="pointer-events-none fixed bottom-28 left-1/2 z-10 -translate-x-1/2 flex flex-col items-center gap-1.5">
          {pills.map((pill, i) => (
            <motion.div
              key={pill.icon}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6, transition: { duration: 0.4 } }}
              transition={{ delay: i * 0.45, duration: 0.55, ease: "easeOut" }}
              className="flex items-center gap-2 rounded-full border border-chalk/8 bg-void/55 px-3.5 py-1 backdrop-blur-sm"
            >
              <span className="text-[12px] leading-none">{pill.icon}</span>
              <span className="hud-label text-[10px] tracking-wide text-chalk/55">{pill.text}</span>
            </motion.div>
          ))}
        </div>
      )}
    </AnimatePresence>
  );
}
