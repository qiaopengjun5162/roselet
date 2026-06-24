"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getRose, updateRose, deleteRose, getUser, toggleLike, type Rose, type UpdateRose } from "@/lib/api";
import { playClick, playPlant, playLike } from "@/lib/sound";
import { RosePlayer } from "@/components/rose-player";
import { colorEmoji, colorLabel } from "@/lib/recommend";

const COLORS = ["red", "white", "yellow"];

export function RoseDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const [rose, setRose] = useState<Rose | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<UpdateRose>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const user = getUser();
  const isOwner = user && rose && rose.user_id === user.id;

  useEffect(() => {
    getRose(id)
      .then(setRose)
      .catch(() => setError("玫瑰不存在"))
      .finally(() => setLoading(false));
  }, [id]);

  function startEdit() {
    if (!rose) return;
    playClick();
    setEditData({
      color: rose.color,
      gratitude: rose.gratitude ?? undefined,
      anxiety: rose.anxiety ?? undefined,
      hope: rose.hope ?? undefined,
    });
    setEditing(true);
  }

  async function handleSave() {
    if (!rose) return;
    setSaving(true);
    try {
      const updated = await updateRose(rose.id, editData);
      setRose(updated);
      setEditing(false);
      playPlant();
    } catch {
      setError("保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!rose || !confirm("确定要删除这朵玫瑰吗？")) return;
    setDeleting(true);
    try {
      await deleteRose(rose.id);
      router.push("/garden");
    } catch {
      setError("删除失败");
      setDeleting(false);
    }
  }

  async function handleLike() {
    if (!rose) return;
    if (!user) {
      router.push(`/login?redirect=/rose/${rose.id}`);
      return;
    }
    try {
      const res = await toggleLike(rose.id);
      setRose({ ...rose, like_count: res.like_count });
      playLike();
    } catch {
      // ignore
    }
  }

  if (loading) {
    return (
      <main className="relative h-full px-4 pb-8 pt-16 z-10">
        <div className="max-w-2xl mx-auto text-center py-20">
          <p className="text-slate-400 animate-pulse">加载中...</p>
        </div>
      </main>
    );
  }

  if (error || !rose) {
    return (
      <main className="relative h-full px-4 pb-8 pt-10 z-10">
        <div className="max-w-2xl mx-auto text-center py-20 space-y-4">
          <p className="text-red-500">{error || "玫瑰不存在"}</p>
          <Link href="/garden">
            <Button variant="outline">返回花圃</Button>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="relative h-full px-4 pb-8 pt-10 z-10">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/garden">
            <Button variant="ghost" size="sm" className="text-slate-300 hover:text-rose-300 hover:bg-white/5">← 返回花圃</Button>
          </Link>
          {isOwner && !editing && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={startEdit} className="border-white/20 text-slate-300 hover:border-white/40">编辑</Button>
              <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
                {deleting ? "删除中..." : "删除"}
              </Button>
            </div>
          )}
        </div>

        <Card className="glass-card border-0 bg-transparent">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <span className="text-4xl">{colorEmoji(rose.color)}</span>
              <div>
                <h1 className="text-2xl font-bold text-slate-100">{colorLabel(rose.color)}</h1>
                <p className="text-sm text-slate-400 font-normal">
                  {rose.nickname && <span className="mr-2">{rose.nickname}</span>}
                  {new Date(rose.created_at).toLocaleString("zh-CN")}
                </p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {editing ? (
              <div className="space-y-4">
                <div className="flex gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setEditData({ ...editData, color: c })}
                      className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
                        editData.color === c
                          ? "border-rose-500 bg-rose-50 text-rose-700"
                          : "border-gray-200 hover:border-rose-300"
                      }`}
                    >
                      {colorEmoji(c)} {colorLabel(c)}
                    </button>
                  ))}
                </div>
                <div>
                  <label className="text-sm font-medium text-rose-600">感恩</label>
                  <textarea
                    value={editData.gratitude ?? ""}
                    onChange={(e) => setEditData({ ...editData, gratitude: e.target.value || null })}
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-white/15 bg-white/5 text-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-rose-400"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-amber-600">焦虑</label>
                  <textarea
                    value={editData.anxiety ?? ""}
                    onChange={(e) => setEditData({ ...editData, anxiety: e.target.value || null })}
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-white/15 bg-white/5 text-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-rose-400"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-green-600">期待</label>
                  <textarea
                    value={editData.hope ?? ""}
                    onChange={(e) => setEditData({ ...editData, hope: e.target.value || null })}
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-white/15 bg-white/5 text-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-rose-400"
                    rows={2}
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setEditing(false)}>取消</Button>
                  <Button onClick={handleSave} disabled={saving} className="bg-rose-500 hover:bg-rose-600">
                    {saving ? "保存中..." : "保存"}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {rose.gratitude && (
                  <div className="space-y-2">
                    <h3 className="font-medium text-rose-600">感恩</h3>
                    <p className="text-base leading-relaxed bg-rose-900/20 border border-rose-500/20 p-4 rounded-lg text-slate-200">{rose.gratitude}</p>
                  </div>
                )}
                {rose.anxiety && (
                  <div className="space-y-2">
                    <h3 className="font-medium text-amber-600">焦虑</h3>
                    <p className="text-base leading-relaxed bg-amber-900/20 border border-amber-500/20 p-4 rounded-lg text-slate-200">{rose.anxiety}</p>
                  </div>
                )}
                {rose.hope && (
                  <div className="space-y-2">
                    <h3 className="font-medium text-green-600">期待</h3>
                    <p className="text-base leading-relaxed bg-green-900/20 border border-green-500/20 p-4 rounded-lg text-slate-200">{rose.hope}</p>
                  </div>
                )}
                {rose.is_gift && rose.recipient_nickname && (
                  <div className="space-y-2 pt-4 border-t border-pink-500/20">
                    <p className="text-sm text-purple-400">
                      {rose.user_id && user && rose.user_id === user.id
                        ? `💝 你送给了 ${rose.recipient_nickname}`
                        : rose.recipient_nickname && user && rose.recipient_nickname === user.nickname
                          ? `💝 ${rose.nickname || "匿名"} 送给了你`
                          : `💝 ${rose.nickname || "匿名"} 送给了 ${rose.recipient_nickname}`
                      }
                    </p>
                  </div>
                )}
                {rose.ai_reply && (
                  <div className="space-y-2 pt-4 border-t border-white/10">
                    <h3 className="font-medium text-purple-600">AI 回复</h3>
                    <p className="text-base leading-relaxed bg-purple-900/20 border border-purple-500/20 p-4 rounded-lg text-slate-300 italic">{rose.ai_reply}</p>
                  </div>
                )}
                <div className="pt-4 border-t border-white/10 flex items-center gap-4 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLike}
                  >
                    {rose.like_count > 0 ? `❤️ ${rose.like_count}` : "❤️ 点赞"}
                  </Button>
                </div>
                <div className="pt-2 flex justify-center">
                  <RosePlayer rose={rose} canvasSize={160} />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {!editing && (
          <div className="text-center">
            <Link href="/plant">
              <Button className="bg-rose-500 hover:bg-rose-600">种一朵玫瑰</Button>
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
