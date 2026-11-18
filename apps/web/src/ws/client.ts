import type { WsEvent } from "@/types/contracts";

export interface WsClientOptions {
  url: string;
  onEvent: (ev: WsEvent) => void;
  onStatus?: (connected: boolean, latencyMs?: number) => void;
}

/**
 * Απλός WebSocket client με auto-reconnect (exponential backoff μέχρι 5s)
 * και heartbeat ping κάθε 10s για μέτρηση latency.
 */
export class WsClient {
  private ws: WebSocket | null = null;
  private opts: WsClientOptions;
  private reconnectDelay = 500;
  private pingHandle: number | null = null;
  private lastPingAt = 0;
  private closedByUser = false;

  constructor(opts: WsClientOptions) {
    this.opts = opts;
  }

  connect(): void {
    this.closedByUser = false;
    this.open();
  }

  close(): void {
    this.closedByUser = true;
    if (this.pingHandle) window.clearInterval(this.pingHandle);
    this.ws?.close();
  }

  private open(): void {
    try {
      this.ws = new WebSocket(this.opts.url);
    } catch (err) {
      console.error("[ws] connect failed", err);
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.reconnectDelay = 500;
      this.opts.onStatus?.(true);
      this.startPing();
    };

    this.ws.onmessage = (evt) => {
      let data: unknown;
      try {
        data = JSON.parse(evt.data);
      } catch {
        return;
      }
      if (!data || typeof data !== "object") return;
      const msg = data as { type?: string; payload?: unknown };
      if (msg.type === "pong") {
        this.opts.onStatus?.(true, performance.now() - this.lastPingAt);
        return;
      }
      if (typeof msg.type !== "string") return;
      this.opts.onEvent(msg as WsEvent);
    };

    this.ws.onclose = () => {
      this.opts.onStatus?.(false);
      if (this.pingHandle) {
        window.clearInterval(this.pingHandle);
        this.pingHandle = null;
      }
      if (!this.closedByUser) this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      // το onclose θα κληθεί μετά, κρατάμε το reconnect εκεί
      this.ws?.close();
    };
  }

  private scheduleReconnect(): void {
    const delay = Math.min(this.reconnectDelay, 5000);
    this.reconnectDelay = Math.min(this.reconnectDelay * 1.8, 5000);
    window.setTimeout(() => this.open(), delay);
  }

  private startPing(): void {
    if (this.pingHandle) window.clearInterval(this.pingHandle);
    this.pingHandle = window.setInterval(() => {
      if (this.ws?.readyState !== WebSocket.OPEN) return;
      this.lastPingAt = performance.now();
      try {
        this.ws.send(JSON.stringify({ type: "ping" }));
      } catch {
        // ignore
      }
    }, 10_000);
  }
}
