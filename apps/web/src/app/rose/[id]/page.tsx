"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getRose, updateRose, deleteRose, getUser, toggleLike, type Rose, type UpdateRose } from "@/lib/api";
import { playClick, playPlant, playLike } from "@/lib/sound";

const COLOR_MAP: Record<string, { emoji: string; label: string; bg: string }> = {
  red: { emoji: "🌹", label: "红玫瑰", bg: "from-red-50 to-white" },
  white: { emoji: "🤍", label: "白玫瑰", bg: "from-gray-50 to-white" },
  yellow: { emoji: "💛", label: "黄玫瑰", bg: "from-amber-50 to-white" },
};

const COLORS = ["red", "white", "yellow"];
const COLOR_LABELS: Record<string, string> = { red: "红", white: "白", yellow: "黄" };

export default function RoseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
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
      <main className="min-h-screen bg-gradient-to-b from-rose-50 to-white p-4">
        <div className="max-w-2xl mx-auto text-center py-20">
          <p className="text-muted-foreground animate-pulse">加载中...</p>
        </div>
      </main>
    );
  }

  if (error || !rose) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-rose-50 to-white p-4">
        <div className="max-w-2xl mx-auto text-center py-20 space-y-4">
          <p className="text-red-500">{error || "玫瑰不存在"}</p>
          <Link href="/garden">
            <Button variant="outline">返回花圃</Button>
          </Link>
        </div>
      </main>
    );
  }

  const meta = COLOR_MAP[rose.color] || { emoji: "🌹", label: "玫瑰", bg: "from-rose-50 to-white" };

  return (
    <main className={`min-h-screen bg-gradient-to-b ${meta.bg} p-4`}>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/garden">
            <Button variant="ghost" size="sm">← 返回花圃</Button>
          </Link>
          {isOwner && !editing && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={startEdit}>编辑</Button>
              <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
                {deleting ? "删除中..." : "删除"}
              </Button>
            </div>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <span className="text-4xl">{meta.emoji}</span>
              <div>
                <h1 className="text-2xl">{meta.label}</h1>
                <p className="text-sm text-muted-foreground font-normal">
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
                      {COLOR_LABELS[c]}
                    </button>
                  ))}
                </div>
                <div>
                  <label className="text-sm font-medium text-rose-600">感恩</label>
                  <textarea
                    value={editData.gratitude ?? ""}
                    onChange={(e) => setEditData({ ...editData, gratitude: e.target.value || null })}
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-input bg-background text-sm"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-amber-600">焦虑</label>
                  <textarea
                    value={editData.anxiety ?? ""}
                    onChange={(e) => setEditData({ ...editData, anxiety: e.target.value || null })}
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-input bg-background text-sm"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-green-600">期待</label>
                  <textarea
                    value={editData.hope ?? ""}
                    onChange={(e) => setEditData({ ...editData, hope: e.target.value || null })}
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-input bg-background text-sm"
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
                    <p className="text-lg leading-relaxed bg-rose-50 p-4 rounded-lg">{rose.gratitude}</p>
                  </div>
                )}
                {rose.anxiety && (
                  <div className="space-y-2">
                    <h3 className="font-medium text-amber-600">焦虑</h3>
                    <p className="text-lg leading-relaxed bg-amber-50 p-4 rounded-lg">{rose.anxiety}</p>
                  </div>
                )}
                {rose.hope && (
                  <div className="space-y-2">
                    <h3 className="font-medium text-green-600">期待</h3>
                    <p className="text-lg leading-relaxed bg-green-50 p-4 rounded-lg">{rose.hope}</p>
                  </div>
                )}
                {rose.ai_reply && (
                  <div className="space-y-2 pt-4 border-t">
                    <h3 className="font-medium text-purple-600">AI 回复</h3>
                    <p className="text-lg leading-relaxed bg-purple-50 p-4 rounded-lg italic">{rose.ai_reply}</p>
                  </div>
                )}
                <div className="pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLike}
                    disabled={!user}
                  >
                    {rose.like_count > 0 ? `${rose.like_count} likes` : "like"}
                  </Button>
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
