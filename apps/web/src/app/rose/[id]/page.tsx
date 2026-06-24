import { RoseDetailClient } from "./client";

export async function generateStaticParams() {
  // 静态导出时需要预渲染玫瑰详情页；优先从后端拉取公共玫瑰 ID，失败则保留占位。
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) return [{ id: "placeholder" }];
    const res = await fetch(`${apiUrl}/api/garden?per_page=200`, { next: { revalidate: 60 } });
    if (!res.ok) return [{ id: "placeholder" }];
    const json = await res.json();
    const ids = (json.data as { id: string }[]).map((rose) => ({ id: String(rose.id) }));
    return ids.length > 0 ? ids : [{ id: "placeholder" }];
  } catch {
    return [{ id: "placeholder" }];
  }
}

export default async function RosePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RoseDetailClient id={id} />;
}
