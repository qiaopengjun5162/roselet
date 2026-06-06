"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { getHealth, type HealthResponse } from "@/lib/api";

type LoadState = "loading" | "ready" | "error";

export function AboutHealth() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [state, setState] = useState<LoadState>("loading");

  const load = useCallback(() => {
    setState("loading");
    getHealth()
      .then((next) => {
        setHealth(next);
        setState("ready");
      })
      .catch(() => {
        setHealth(null);
        setState("error");
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const ok = health?.status === "ok" && health.database === "healthy";

  return (
    <section className="mt-5 rounded-lg border border-white/10 bg-black/20 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="text-xs font-medium tracking-wider text-slate-300">运行状态</h4>
          <p className="mt-1 text-[11px] text-slate-500">
            {state === "loading" && "正在读取 /health"}
            {state === "error" && "暂时无法读取后端状态"}
            {state === "ready" && (ok ? "花圃服务正常" : "花圃服务降级")}
          </p>
        </div>
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            state === "ready" && ok
              ? "bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.8)]"
              : state === "error"
                ? "bg-rose-400 shadow-[0_0_14px_rgba(251,113,133,0.8)]"
                : "bg-amber-300 shadow-[0_0_14px_rgba(252,211,77,0.7)]"
          }`}
          aria-label={state === "ready" && ok ? "服务正常" : "服务异常或加载中"}
        />
      </div>

      {health && (
        <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
          <div className="rounded-md bg-white/[0.03] px-2 py-1.5">
            <dt className="text-slate-500">版本</dt>
            <dd className="mt-0.5 text-slate-300">{health.version}</dd>
          </div>
          <div className="rounded-md bg-white/[0.03] px-2 py-1.5">
            <dt className="text-slate-500">数据库</dt>
            <dd className="mt-0.5 text-slate-300">{health.database}</dd>
          </div>
        </dl>
      )}

      {state === "error" && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3 h-7 border-white/10 bg-transparent text-xs text-slate-300 hover:bg-white/5"
          onClick={load}
        >
          重试
        </Button>
      )}
    </section>
  );
}
