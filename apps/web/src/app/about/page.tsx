import { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { FeedbackForm } from "@/components/feedback-form";
import { StarBottle } from "@/components/star-bottle";
import { StarParticles } from "@/components/star-particles";

export const metadata: Metadata = {
  title: "留言 - Roselet",
  description: "为花圃留下你的声音",
};

export default function AboutPage() {
  return (
    <main className="min-h-screen relative flex flex-col items-center px-4 pt-24 pb-16">
      <StarParticles />

      {/* 标题 — 毛笔字，浮在星空中的仪式性文字 */}
      <h1
        className="text-4xl font-light tracking-widest text-slate-200 mb-16"
        style={{ fontFamily: '"Ma Shan Zheng", "STXingkai", "KaiTi", cursive' }}
      >
        留言
      </h1>

      {/* 反馈瓶 — 最大最亮，页面视觉重心 */}
      <StarBottle
        delay={0}
        glowColor="rgba(244,63,94,0.2)"
        className="w-full max-w-lg mb-12 p-8"
      >
        <h2 className="text-sm text-slate-400 tracking-wide mb-6">
          为花圃留下你的声音
        </h2>
        <FeedbackForm />
      </StarBottle>

      {/* 项目瓶 + 开发者瓶 — 更小更淡 */}
      <div className="w-full max-w-lg grid grid-cols-1 sm:grid-cols-2 gap-6">
        <StarBottle
          delay={200}
          glowColor="rgba(167,139,250,0.12)"
          className="p-6"
        >
          <h3
            className="text-lg tracking-wider text-slate-200 mb-4"
            style={{ fontFamily: '"Ma Shan Zheng", "STXingkai", "KaiTi", cursive' }}
          >
            玫瑰源
          </h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            一个社区情绪花园。在这里种下一朵玫瑰，用颜色和文字承载感恩、期待或焦虑。AI
            会为它生成专属回应，Rust 驱动的声音引擎将情感转化为波形。
          </p>
        </StarBottle>

        <StarBottle
          delay={400}
          glowColor="rgba(234,179,8,0.1)"
          className="p-6"
        >
          <h3
            className="text-lg tracking-wider text-slate-200 mb-4"
            style={{ fontFamily: '"Ma Shan Zheng", "STXingkai", "KaiTi", cursive' }}
          >
            寻月隐君
          </h3>
          <p className="text-sm text-slate-400 leading-relaxed mb-4">
            全栈开发者，在虚空里用代码种花。
          </p>
          <p className="text-xs bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2 text-rose-300/80 leading-relaxed">
            如果大家有需要，可以关注我的微信公众号《寻月隐君》
          </p>
          <div className="flex gap-3 mt-4">
            <Link
              href="https://github.com/qiaopengjun5162"
              target="_blank"
              className={buttonVariants({
                variant: "outline",
                size: "sm",
                className: "border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/5 text-xs",
              })}
            >
              GitHub
            </Link>
            <Link
              href="mailto:qiaopengjun5162@gmail.com"
              className={buttonVariants({
                variant: "outline",
                size: "sm",
                className: "border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/5 text-xs",
              })}
            >
              Email
            </Link>
          </div>
        </StarBottle>
      </div>

      {/* 底部星云 */}
      <footer className="mt-20 text-center">
        <p className="text-xs text-slate-600 tracking-wider">
          Roselet v1.0.0 · MIT
        </p>
      </footer>
    </main>
  );
}
