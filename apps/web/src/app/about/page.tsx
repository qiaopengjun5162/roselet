import { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { getUser } from "@/lib/api";
import { FeedbackForm } from "@/components/feedback-form";
import { ColorEmoji, ColorLabel } from "@/components/color-meta";

export const metadata: Metadata = {
  title: "关于我们 - Roselet",
  description: "了解 Roselet 项目、开发者信息、提交反馈",
};

export default function AboutPage() {
  const user = getUser();

  return (
    <main className="min-h-screen py-8 px-4 relative">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* 标题 */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-slate-100 mb-4">关于 Roselet</h1>
          <p className="text-slate-300 text-lg">社区破冰互动 Web 应用</p>
        </div>

        {/* 特性展示 */}
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="bg-gradient-to-br from-red-500/10 to-transparent border-red-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-red-300">
                <ColorEmoji color="red" className="text-2xl" /> 情感表达
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-slate-300">
                通过玫瑰、花苞、尖刺三种形式，安全地表达感恩、期待与焦虑
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/10 to-transparent border-purple-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-purple-300">
                <span className="text-2xl">🎵</span> 音频体验
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-slate-300">
                每一朵花都有独特的音频参数，转换为示波器可视化艺术
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-pink-500/10 to-transparent border-pink-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-pink-300">
                <span className="text-2xl">🤖</span> AI 回复
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-slate-300">
                AI 生成个性化回复，让每一份情感都得到温暖回应
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        <Separator className="my-8 bg-slate-700/50" />

        {/* 项目介绍 */}
        <Card className="bg-slate-900/60 backdrop-blur-sm border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-slate-100">项目简介</CardTitle>
            <CardDescription className="text-slate-400">
              Roselet 是一个创新的社区互动平台，让用户通过种下玫瑰来表达情感
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="text-center p-4 rounded-lg bg-gradient-to-br from-red-500/10 to-red-500/5 border border-red-500/20">
                <ColorEmoji color="red" className="text-3xl mb-2 block" />
                <h3 className="font-semibold text-red-300"><ColorLabel color="red" /></h3>
                <p className="text-sm text-slate-400 mt-1">感谢身边的人和事</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-gradient-to-br from-yellow-500/10 to-yellow-500/5 border border-yellow-500/20">
                <ColorEmoji color="yellow" className="text-3xl mb-2 block" />
                <h3 className="font-semibold text-yellow-300"><ColorLabel color="yellow" /></h3>
                <p className="text-sm text-slate-400 mt-1">对未来的美好期许</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-gradient-to-br from-gray-500/10 to-gray-500/5 border border-gray-500/20">
                <div className="text-3xl mb-2">🌵</div>
                <h3 className="font-semibold text-gray-300">尖刺（焦虑）</h3>
                <p className="text-sm text-slate-400 mt-1">表达内心的不安与担忧</p>
              </div>
            </div>
            <p className="text-slate-300 leading-relaxed">
              每一朵花都是一个情感载体，它们汇聚成社区的花圃，让彼此的心灵得到连接和治愈。
              通过 Rust WASM 驱动的音频引擎，将情感转化为独特的声音体验。
              AI 生成个性化回复，让每一份分享都得到温暖回应。
            </p>
          </CardContent>
        </Card>

        {/* 技术栈 */}
        <Card className="bg-slate-900/60 backdrop-blur-sm border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-slate-100">技术栈</CardTitle>
            <CardDescription className="text-slate-400">
              我们使用现代化的技术栈构建高性能的应用
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
                    <span className="text-red-400">⚙️</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-slate-200">后端</h4>
                    <p className="text-sm text-slate-400">高性能、类型安全</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 ml-13">
                  <Badge variant="secondary" className="bg-red-500/10 text-red-300 border-red-500/20">Rust</Badge>
                  <Badge variant="secondary" className="bg-red-500/10 text-red-300 border-red-500/20">Axum</Badge>
                  <Badge variant="secondary" className="bg-red-500/10 text-red-300 border-red-500/20">SQLx</Badge>
                  <Badge variant="secondary" className="bg-red-500/10 text-red-300 border-red-500/20">PostgreSQL</Badge>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                    <span className="text-blue-400">🎨</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-slate-200">前端</h4>
                    <p className="text-sm text-slate-400">现代化、组件化</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 ml-13">
                  <Badge variant="secondary" className="bg-blue-500/10 text-blue-300 border-blue-500/20">Next.js 15</Badge>
                  <Badge variant="secondary" className="bg-blue-500/10 text-blue-300 border-blue-500/20">React 18</Badge>
                  <Badge variant="secondary" className="bg-blue-500/10 text-blue-300 border-blue-500/20">TypeScript</Badge>
                  <Badge variant="secondary" className="bg-blue-500/10 text-blue-300 border-blue-500/20">Tailwind CSS</Badge>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                    <span className="text-green-400">📱</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-slate-200">小程序</h4>
                    <p className="text-sm text-slate-400">跨平台、高性能</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 ml-13">
                  <Badge variant="secondary" className="bg-green-500/10 text-green-300 border-green-500/20">Taro 4</Badge>
                  <Badge variant="secondary" className="bg-green-500/10 text-green-300 border-green-500/20">React 18</Badge>
                  <Badge variant="secondary" className="bg-green-500/10 text-green-300 border-green-500/20">TypeScript</Badge>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                    <span className="text-purple-400">🧠</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-slate-200">AI & WASM</h4>
                    <p className="text-sm text-slate-400">智能、低延迟</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 ml-13">
                  <Badge variant="secondary" className="bg-purple-500/10 text-purple-300 border-purple-500/20">OpenAI API</Badge>
                  <Badge variant="secondary" className="bg-purple-500/10 text-purple-300 border-purple-500/20">Rust WASM</Badge>
                  <Badge variant="secondary" className="bg-purple-500/10 text-purple-300 border-purple-500/20">情绪分析</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 开发者信息 */}
        <Card className="bg-slate-900/60 backdrop-blur-sm border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-slate-100">开发者信息</CardTitle>
            <CardDescription className="text-slate-400">
              项目由全栈开发者创建，专注于创造美好的用户体验
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-6">
              <div className="relative">
                <div className="w-20 h-20 bg-gradient-to-br from-rose-500 via-pink-500 to-purple-500 rounded-2xl flex items-center justify-center text-white text-3xl font-bold shadow-lg">
                  Q
                </div>
                <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-green-500 rounded-full border-4 border-slate-900 flex items-center justify-center">
                  <span className="text-white text-xs">✓</span>
                </div>
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <h3 className="text-xl font-semibold text-slate-100">寻月隐君</h3>
                  <p className="text-slate-400">全栈开发者 · 开源爱好者</p>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  致力于通过代码创造价值，相信技术的力量可以连接人心，让世界变得更美好。
                  拥有丰富的前后端开发经验，热爱探索新技术和创新解决方案。
                </p>
                <div className="text-sm bg-rose-500/10 border border-rose-500/20 rounded-lg p-3 mt-4">
                  <p className="text-rose-300">
                    🌙 如果大家有需要，可以关注我的微信公众号《寻月隐君》
                  </p>
                </div>
                <div className="flex gap-3 pt-2">
                  <Link href="https://github.com/qiaopengjun5162" target="_blank" className={buttonVariants({ variant: "outline", size: "sm", className: "border-slate-600 text-slate-300 hover:bg-slate-800" })}>
                    <span className="mr-2">📁</span> GitHub
                  </Link>
                  <Link href="mailto:qiaopengjun5162@gmail.com" className={buttonVariants({ variant: "outline", size: "sm", className: "border-slate-600 text-slate-300 hover:bg-slate-800" })}>
                    <span className="mr-2">📧</span> Email
                  </Link>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 反馈表单 */}
        <Card className="bg-slate-900/60 backdrop-blur-sm border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-slate-100 flex items-center gap-2">
              <span className="text-rose-400">💬</span> 意见反馈
            </CardTitle>
            <CardDescription className="text-slate-400">
              您的意见对我们非常重要，帮助我们不断改进产品体验
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <span className="text-rose-400">✨</span>
                <span>我们会认真每一条反馈，并在后续版本中持续改进</span>
              </div>
              <FeedbackForm />
            </div>
          </CardContent>
        </Card>

        {/* 版本信息 */}
        <Card className="bg-slate-900/60 backdrop-blur-sm border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-slate-100 flex items-center gap-2">
              <span className="text-blue-400">🚀</span> 版本信息
            </CardTitle>
            <CardDescription className="text-slate-400">
              当前版本和项目状态
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">版本</span>
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-300 border-blue-500/20">v1.0.0</Badge>
                </div>
              </div>
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">更新</span>
                  <span className="text-slate-100">2024年6月</span>
                </div>
              </div>
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">协议</span>
                  <Badge variant="outline" className="bg-green-500/10 text-green-300 border-green-500/20">MIT</Badge>
                </div>
              </div>
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">状态</span>
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-300 border-amber-500/20">开发中</Badge>
                </div>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-700/50">
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-400">
                  🌟 Star our GitHub repo to support the project
                </div>
                <Link href="https://github.com/qiaopengjun5162/roselet" target="_blank" className={buttonVariants({ variant: "outline", size: "sm", className: "border-slate-600 text-slate-300 hover:bg-slate-800" })}>
                  查看源代码
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}