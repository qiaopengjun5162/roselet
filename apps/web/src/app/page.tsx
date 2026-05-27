import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-rose-50 to-white p-4">
      <div className="max-w-2xl text-center space-y-8">
        <h1 className="text-4xl font-bold text-rose-800">Roselet</h1>
        <p className="text-xl text-rose-600">一起来种一个玫瑰花圃吧</p>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-rose-500">玫瑰</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                在社区的这一周，一件让你感到幸福或感恩的事情是什么？
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-amber-500">尖刺</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                现在有什么让你感到焦虑或者需要帮助的事情吗？
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-green-500">花苞</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                你现在有什么期待的事情吗？这周有什么新灵感想要实现呢？
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-4 justify-center">
          <Link href="/plant">
            <Button size="lg" className="bg-rose-500 hover:bg-rose-600">
              种一朵玫瑰
            </Button>
          </Link>
          <Link href="/garden">
            <Button size="lg" variant="outline">
              参观花圃
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
