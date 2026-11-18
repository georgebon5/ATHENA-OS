import { useEffect } from "react";

export default function App() {
  useEffect(() => {
    document.title = "ATHENA OS — Live";
  }, []);
  return (
    <div className="h-screen w-screen bg-ink text-chalk flex items-center justify-center">
      <div className="text-center">
        <div className="text-5xl font-display tracking-tight text-athena">ATHENA OS</div>
        <div className="mt-2 text-sm text-chalk/60">Το 3D της Αθήνας φορτώνει…</div>
      </div>
    </div>
  );
}
