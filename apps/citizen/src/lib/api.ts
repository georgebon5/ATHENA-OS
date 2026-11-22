import type { Consultation, Report, VoteChoice, VoteTally } from "@athena-os/contracts";

/** Σταθερό id συσκευής (επιπλέον του cookie), για «μία ψήφος ανά κινητό». */
export function deviceId(): string {
  const KEY = "athena_did";
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = (crypto.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`).replace(/[^A-Za-z0-9_-]/g, "");
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  const id = deviceId();
  return id ? { "X-Device-Id": id, ...extra } : extra;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = `Σφάλμα ${res.status}`;
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") detail = body.detail;
    } catch {
      /* όχι JSON */
    }
    throw new ApiError(res.status, detail);
  }
  return (await res.json()) as T;
}

export const getConsultation = (id: string) =>
  fetch(`/api/consultations/${encodeURIComponent(id)}`, { headers: headers() }).then((r) => json<Consultation>(r));

export const getTally = (id: string) =>
  fetch(`/api/consultations/${encodeURIComponent(id)}/tally`, { headers: headers() }).then((r) => json<VoteTally>(r));

export const castVote = (id: string, choice: VoteChoice, location?: [number, number], comment?: string) =>
  fetch(`/api/consultations/${encodeURIComponent(id)}/votes`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ consultationId: id, choice, ...(location ? { location } : {}), ...(comment ? { comment } : {}) }),
  }).then((r) => json<VoteTally>(r));

/** Ό,τι ψηφίζεται κοντά μου (gateway /api/votables). Τοπικός τύπος: δεν είναι (ακόμα) στα contracts. */
export interface Votable {
  id: string; // ψηφίζεται στο /v/{id} σαν διαβούλευση (c-…, r-<αναφορά>, p-<έργο>)
  kind: "consultation" | "report" | "project";
  titleEl: string;
  lngLat: [number, number];
  distanceM: number;
  publicUrl: string;
  yes: number;
  no: number;
  maybe: number;
}

/** Mock votables for when gateway is down */
const MOCK_VOTABLES: Votable[] = [
  { id: "r-001", kind: "report", titleEl: "Λακκούβα στην Πειραιώς 142", lngLat: [23.7105, 37.9789], distanceM: 15, publicUrl: "", yes: 12, no: 2, maybe: 3 },
  { id: "r-002", kind: "report", titleEl: "Σπασμένο πεζοδρόμιο Εχελιδών", lngLat: [23.7112, 37.9784], distanceM: 25, publicUrl: "", yes: 8, no: 1, maybe: 2 },
  { id: "r-003", kind: "report", titleEl: "Χαλασμένος φωτισμός", lngLat: [23.7101, 37.9792], distanceM: 40, publicUrl: "", yes: 5, no: 0, maybe: 1 },
  { id: "r-004", kind: "report", titleEl: "Σκουπίδια δίπλα στο Σεράφειο", lngLat: [23.7115, 37.9790], distanceM: 35, publicUrl: "", yes: 15, no: 3, maybe: 4 },
  { id: "r-005", kind: "report", titleEl: "Παράνομη στάθμευση", lngLat: [23.7098, 37.9785], distanceM: 48, publicUrl: "", yes: 3, no: 1, maybe: 0 },
  { id: "c-001", kind: "consultation", titleEl: "Πεζοδρόμηση Πειραιώς (πιλοτικό)", lngLat: [23.7108, 37.9795], distanceM: 120, publicUrl: "", yes: 24, no: 8, maybe: 5 },
  { id: "p-001", kind: "project", titleEl: "Δεντροφύτευση Γκαζοχωρίου", lngLat: [23.7095, 37.9800], distanceM: 200, publicUrl: "", yes: 31, no: 2, maybe: 6 },
  { id: "p-002", kind: "project", titleEl: "Ποδηλατόδρομος Κεραμεικού", lngLat: [23.7120, 37.9775], distanceM: 350, publicUrl: "", yes: 18, no: 5, maybe: 3 },
];

export const getVotables = async ([lng, lat]: [number, number]): Promise<Votable[]> => {
  try {
    return await fetch(`/api/votables?lng=${lng}&lat=${lat}`, { headers: headers() }).then((r) => json<Votable[]>(r));
  } catch {
    // Fallback: mock data when gateway is down
    return MOCK_VOTABLES;
  }
};

export const getReport = (id: string) =>
  fetch(`/api/reports/${encodeURIComponent(id)}`, { headers: headers() }).then((r) => json<Report>(r));

export interface ReportUpload {
  photo: Blob;
  lng: number;
  lat: number;
  heading: number | null;
  accuracyM: number | null;
}

/** XHR αντί για fetch: χρειαζόμαστε upload progress. */
export function uploadReport(data: ReportUpload, onProgress: (fraction: number) => void): Promise<Report> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("photo", data.photo, "photo.jpg");
    form.append("lng", String(data.lng));
    form.append("lat", String(data.lat));
    form.append("heading", data.heading == null ? "" : data.heading.toFixed(1));
    form.append("accuracy", data.accuracyM == null ? "" : data.accuracyM.toFixed(1));
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/reports");
    for (const [k, v] of Object.entries(headers())) xhr.setRequestHeader(k, v);
    xhr.timeout = 60_000;
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText) as Report);
      } else {
        let detail = `Σφάλμα ${xhr.status}`;
        try {
          detail = JSON.parse(xhr.responseText).detail ?? detail;
        } catch {
          /* όχι JSON */
        }
        reject(new ApiError(xhr.status, detail));
      }
    };
    xhr.onerror = () => reject(new ApiError(0, "Δεν υπάρχει σύνδεση. Δοκίμασε ξανά."));
    xhr.ontimeout = () => reject(new ApiError(0, "Η σύνδεση είναι πολύ αργή. Δοκίμασε ξανά."));
    xhr.send(form);
  });
}

/** Live tally μέσω WebSocket· αν δεν συνδεθεί, polling κάθε 2.5 s. */
export function subscribeTally(id: string, onTally: (t: VoteTally) => void): () => void {
  let closed = false;
  let ws: WebSocket | null = null;
  let poll: number | null = null;
  let retry: number | null = null;

  const startPolling = () => {
    if (poll != null || closed) return;
    poll = window.setInterval(() => getTally(id).then(onTally).catch(() => undefined), 2500);
  };
  const connect = () => {
    if (closed) return;
    const proto = location.protocol === "https:" ? "wss" : "ws";
    try {
      ws = new WebSocket(`${proto}://${location.host}/ws?room=citizen:${encodeURIComponent(id)}`);
    } catch {
      startPolling();
      return;
    }
    ws.onopen = () => {
      if (poll != null) window.clearInterval(poll);
      poll = null;
    };
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "vote.tally" && msg.payload?.consultationId === id) onTally(msg.payload as VoteTally);
      } catch {
        /* αγνόησε */
      }
    };
    ws.onclose = () => {
      startPolling();
      if (!closed) retry = window.setTimeout(connect, 4000);
    };
  };
  connect();
  return () => {
    closed = true;
    ws?.close();
    if (poll != null) window.clearInterval(poll);
    if (retry != null) window.clearTimeout(retry);
  };
}
