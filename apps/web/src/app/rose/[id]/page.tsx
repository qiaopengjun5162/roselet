import { RoseDetailClient } from "./client";
import { SAME_ORIGIN, resolveApiBase } from "@/lib/api-base";

export async function generateStaticParams() {
  // 静态导出时需要预渲染玫瑰详情页；优先从后端拉取公共玫瑰 ID，失败则保留占位。
  try {
    // 构建期没有页面 origin，同源模式（相对路径）在这里取不到绝对地址，直接留占位。
    const raw = process.env.NEXT_PUBLIC_API_URL;
    if (!raw || raw === SAME_ORIGIN) return [{ id: "placeholder" }];
    const apiUrl = resolveApiBase(raw);
    const res = await fetch(`${apiUrl}/api/garden?per_page=200`, { next: { revalidate: 60 } });
    if (!res.ok) return [{ id: "placeholder" }];
    const json = await res.json();
    const ids = (json.data as { id: string }[]).map((rose) => ({ id: String(rose.id) }));
    return [...ids, { id: "placeholder" }];
  } catch {
    return [{ id: "placeholder" }];
  }
}

export default async function RosePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RoseDetailClient id={id} />;
}
