import type { Rose } from "@/lib/api";
import { resolveApiBase, sameOriginWsBase } from "@/lib/api-base";

function resolveWsBase(): string {
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;

  const apiBase = resolveApiBase(
    process.env.NEXT_PUBLIC_READ_API_URL
      || process.env.NEXT_PUBLIC_WORKER_API_URL
      || process.env.NEXT_PUBLIC_API_URL,
  );

  // 同源（相对路径）时跟着页面走：https 页面必须用 wss，否则连不上。
  if (!apiBase) return sameOriginWsBase();

  if (apiBase.startsWith("https://")) return apiBase.replace("https://", "wss://");
  if (apiBase.startsWith("http://")) return apiBase.replace("http://", "ws://");

  return apiBase;
}

export type RoseHandler = (rose: Rose) => void;

export function connectGardenWs(onRose: RoseHandler): () => void {
  const base = resolveWsBase();
  // 生产构建里拿不到 location（不可能发生在浏览器里，但别让它抛异常）：
  // WebSocket 不接受相对地址，宁可不连，也不要冒着把页面搞崩的风险猜一个。
  if (!base) return () => {};

  const ws = new WebSocket(`${base}/api/ws`);

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
