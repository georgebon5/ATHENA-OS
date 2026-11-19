import { ReportScreen } from "./screens/ReportScreen";
import { VoteScreen } from "./screens/VoteScreen";

/** Δύο οθόνες, χωρίς router βιβλιοθήκη: /c/r (αναφορά) και /c/v/{id} (διαβούλευση). */
export function App() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const path = window.location.pathname.slice(base.length) || "/";
  const vote = path.match(/^\/v\/([A-Za-z0-9_-]{1,64})\/?$/);
  if (vote) return <VoteScreen id={vote[1]} />;
  return <ReportScreen />;
}
