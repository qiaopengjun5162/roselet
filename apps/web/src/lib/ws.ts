import type { Rose } from "@/lib/api";

function resolveWsBase(): string {
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;

  const apiBase = process.env.NEXT_PUBLIC_READ_API_URL
    || process.env.NEXT_PUBLIC_API_URL;

  if (apiBase) {
    if (apiBase.startsWith("https://")) return apiBase.replace("https://", "wss://");
    if (apiBase.startsWith("http://")) return apiBase.replace("http://", "ws://");
  }

  return "ws://localhost:3001";
}

export type RoseHandler = (rose: Rose) => void;

export function connectGardenWs(onRose: RoseHandler): () => void {
  const ws = new WebSocket(`${resolveWsBase()}/api/ws`);

  ws.onmessage = (event) => {
    try {
      const rose = JSON.parse(event.data) as Rose;
      onRose(rose);
    } catch {
      // ignore malformed messages
    }
  };

  ws.onerror = () => {
    ws.close();
  };

  return () => {
    ws.close();
  };
}
