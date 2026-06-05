import { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { getUser } from "@/lib/api";
import { FeedbackForm } from "@/components/feedback-form";

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
              <div className="text-center p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                <div className="text-2xl mb-2">🌹</div>
                <h3 className="font-semibold text-slate-100">玫瑰（感恩）</h3>
                <p className="text-sm text-slate-400 mt-1">感谢身边的人和事</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <div className="text-2xl mb-2">🌸</div>
                <h3 className="font-semibold text-slate-100">花苞（期待）</h3>
                <p className="text-sm text-slate-400 mt-1">对未来的美好期许</p>
              </div>
              <div className="text-center p-4 rounded-lg border border-slate-600/50">
                <div className="text-2xl mb-2">🌵</div>
                <h3 className="font-semibold text-slate-100">尖刺（焦虑）</h3>
                <p className="text-sm text-slate-400 mt-1">表达内心的不安与担忧</p>
              </div>
            </div>
            <p className="text-slate-300">
              每一朵花都是一个情感载体，它们汇聚成社区的花圃，让彼此的心灵得到连接和治愈。
              通过 AI 生成个性化回复，让每一份情感都得到回应。
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
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium text-slate-200 mb-2">后端</h4>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">Rust</Badge>
                  <Badge variant="secondary">Axum</Badge>
                  <Badge variant="secondary">SQLx</Badge>
                  <Badge variant="secondary">PostgreSQL</Badge>
                </div>
              </div>
              <div>
                <h4 className="font-medium text-slate-200 mb-2">前端</h4>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">Next.js 15</Badge>
                  <Badge variant="secondary">React 18</Badge>
                  <Badge variant="secondary">TypeScript</Badge>
                  <Badge variant="secondary">Tailwind CSS</Badge>
                </div>
              </div>
              <div>
                <h4 className="font-medium text-slate-200 mb-2">小程序</h4>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">Taro 4</Badge>
                  <Badge variant="secondary">React 18</Badge>
                  <Badge variant="secondary">TypeScript</Badge>
                </div>
              </div>
              <div>
                <h4 className="font-medium text-slate-200 mb-2">AI & WASM</h4>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">OpenAI API</Badge>
                  <Badge variant="secondary">Rust WASM</Badge>
                  <Badge variant="secondary">情绪分析</Badge>
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
              项目由前端开发者开发，专注于创造美好的用户体验
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-gradient-to-br from-rose-500 to-pink-500 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                Q
              </div>
              <div>
                <h3 className="font-semibold text-slate-100">乔朋君</h3>
                <p className="text-slate-400">全栈开发者</p>
                <div className="flex space-x-4 mt-2">
                  <Link href="https://github.com/qiaopengjun5162" target="_blank" className="text-slate-400 hover:text-slate-100">
                    GitHub
                  </Link>
                  <Link href="mailto:qiaopengjun5162@gmail.com" className="text-slate-400 hover:text-slate-100">
                    Email
                  </Link>
                </div>
              </div>
            </div>
            <p className="text-slate-300">
              致力于通过代码创造价值，相信技术的力量可以连接人心，让世界变得更美好。
              Roselet 是对社区互动的一次探索和尝试。
            </p>
          </CardContent>
        </Card>

        {/* 反馈表单 */}
        <Card className="bg-slate-900/60 backdrop-blur-sm border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-slate-100">意见反馈</CardTitle>
            <CardDescription className="text-slate-400">
              您的意见对我们非常重要，帮助我们不断改进
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FeedbackForm />
          </CardContent>
        </Card>

        {/* 版本信息 */}
        <Card className="bg-slate-900/60 backdrop-blur-sm border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-slate-100">版本信息</CardTitle>
            <CardDescription className="text-slate-400">
              当前版本和项目状态
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-400">当前版本</p>
                <p className="text-slate-100">v1.0.0</p>
              </div>
              <div>
                <p className="text-slate-400">最后更新</p>
                <p className="text-slate-100">2024年6月</p>
              </div>
              <div>
                <p className="text-slate-400">开源协议</p>
                <p className="text-slate-100">MIT License</p>
              </div>
              <div>
                <p className="text-slate-400">项目状态</p>
                <p className="text-slate-100">开发中</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-700/50">
              <Link href="https://github.com/qiaopengjun5162/roselet" target="_blank">
                <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800">
                  查看源代码
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}