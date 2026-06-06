import type { Rose } from "@/lib/api";

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001";

export type RoseHandler = (rose: Rose) => void;

export function connectGardenWs(onRose: RoseHandler): () => void {
  const ws = new WebSocket(`${WS_BASE}/api/ws`);

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
