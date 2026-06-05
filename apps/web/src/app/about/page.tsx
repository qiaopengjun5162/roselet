import { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { FeedbackBottle } from "@/components/feedback-bottle";
import { StarBottle } from "@/components/star-bottle";
import { StarParticles } from "@/components/star-particles";

export const metadata: Metadata = {
  title: "留言 - Roselet",
  description: "为花圃留下你的声音",
};

export default function AboutPage() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-[#080e0c] flex flex-col">
      <StarParticles />

      {/* 标题 — 浮在星座上方的毛笔字 */}
      <h1
        className="absolute top-6 left-1/2 -translate-x-1/2 text-3xl md:text-4xl font-light tracking-widest text-slate-200/90 z-10"
        style={{ fontFamily: '"Ma Shan Zheng", "STXingkai", "KaiTi", cursive' }}
      >
        留言
      </h1>

      {/* 三栏星轨画布 */}
      <div className="flex-1 flex flex-col md:flex-row items-center justify-center gap-6 md:gap-8 px-4 md:px-10 pt-16 pb-4 z-10">
        {/* 左栏: 项目瓶 — 顶部对齐，微上浮 */}
        <div className="w-full md:w-1/4 flex items-start justify-center md:self-start md:mt-6">
          <StarBottle
            delay={100}
            glowColor="rgba(167,139,250,0.12)"
            className="w-full max-w-xs p-5 md:p-6"
          >
            <h3
              className="text-base md:text-lg tracking-wider text-slate-200 mb-3"
              style={{ fontFamily: '"Ma Shan Zheng", "STXingkai", "KaiTi", cursive' }}
            >
              玫瑰源
            </h3>
            <p className="text-xs md:text-sm text-slate-400 leading-relaxed">
              一个社区情绪花园。在这里种下一朵玫瑰，用颜色和文字承载感恩、期待或焦虑。AI
              会为它生成专属回应，Rust 驱动的声音引擎将情感转化为波形。
            </p>
          </StarBottle>
        </div>

        {/* 中栏: 反馈瓶 — 略下沉，视觉重心，辉光随情绪实时渐变 */}
        <div className="w-full md:w-2/5 flex items-center justify-center md:self-center md:-mt-4">
          <FeedbackBottle />
        </div>

        {/* 右栏: 开发者瓶 — 中部微偏上 */}
        <div className="w-full md:w-1/4 flex items-center justify-center md:self-start md:mt-16">
          <StarBottle
            delay={200}
            glowColor="rgba(234,179,8,0.1)"
            className="w-full max-w-xs p-5 md:p-6"
          >
            <h3
              className="text-base md:text-lg tracking-wider text-slate-200 mb-3"
              style={{ fontFamily: '"Ma Shan Zheng", "STXingkai", "KaiTi", cursive' }}
            >
              寻月隐君
            </h3>
            <p className="text-xs md:text-sm text-slate-400 leading-relaxed mb-3">
              全栈开发者，在虚空里用代码种花。
            </p>
            <p className="text-[11px] md:text-xs bg-rose-500/10 border border-rose-500/20 rounded-lg px-2 md:px-3 py-1.5 md:py-2 text-rose-300/80 leading-relaxed">
              关注微信公众号《寻月隐君》
            </p>
            <div className="flex gap-2 md:gap-3 mt-3 md:mt-4">
              <Link
                href="https://github.com/qiaopengjun5162"
                target="_blank"
                className={buttonVariants({
                  variant: "outline",
                  size: "sm",
                  className:
                    "border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/5 text-[11px] md:text-xs h-7 md:h-8",
                })}
              >
                GitHub
              </Link>
              <Link
                href="mailto:qiaopengjun5162@gmail.com"
                className={buttonVariants({
                  variant: "outline",
                  size: "sm",
                  className:
                    "border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/5 text-[11px] md:text-xs h-7 md:h-8",
                })}
              >
                Email
              </Link>
            </div>
          </StarBottle>
        </div>
      </div>

      {/* 版本 — 浮在左下角的微光 */}
      <p className="absolute bottom-3 left-4 text-[10px] md:text-xs text-slate-600 tracking-wider z-10">
        Roselet v1.0.0 · MIT
      </p>
    </div>
  );
}
