# Roselet — 社区情绪花圃

## Problem

社区成员缺少一种仪式性的、非竞争性的情绪表达渠道。现有工具（社交媒体、打卡 App、论坛）都以曝光量和互动数为驱动，让情绪表达变成了社交表演。Roselet 要做的是反向的事：让用户在一个安静的夜晚，轻轻种下一朵玫瑰，然后离开——不看排名，不等点赞，只是照料自己的情绪。

## Evidence

- 产品设计决策（PRODUCT.md）明确拒绝的四类参照物均来自已有产品失败模式的观察：SaaS 风格看板、社交计数、游戏化积分、治愈系渐变。
- 代码层面的设计选择（DESIGN.md）体现了同一判断：彻底移除计数排行信号，情绪辉光不作装饰。
- 假设 — 需通过真实用户种花后的情绪反馈验证（问卷 / NPS / 留存率）。

## Users

- **Primary**: 泛社区参与者——任何想在某个团队/社群活动中安静表达情绪的人。触发场景：线下活动扫码、团建破冰、夜晚独自打开链接。不需要技术背景，不需要懂区块链。
- **Not for**: 寻求社交曝光、需要点赞反馈来维持动力的用户；需要实时聊天或帖子讨论的用户；习惯 SaaS 工作台界面的工具型用户。

## Hypothesis

We believe **提供一套仪式感完整、视觉深邃、情绪与声音三位一体的种花体验** will **让社区成员在表达情绪后感到轻盈，而非焦虑** for **任何参与社区活动的个体**. We'll know we're right when **种花完成率（进入 /plant 到成功种下）≥ 60%，且用户在完成后不立即离开花圃（停留 ≥ 30s）**.

## Success Metrics

| Metric | Target | How measured |
|---|---|---|
| 种花完成率 | ≥ 60% | /plant 访问 → POST /api/rose 成功 |
| 种花后花圃停留时间 | ≥ 30s | 前端埋点 / WebSocket 连接时长 |
| 音效开启率 | ≥ 40% | isMuted() 状态统计 |
| 返回率（7 天内再次访问） | ≥ 20% | JWT 令牌续期次数 |

## Scope

### MVP（已完成 / Production-ready）

**Web 端（Next.js 15 + shadcn UI）**

核心三屏流程：
1. **首页** (`/`) — 规则介绍（玫瑰=感恩/尖刺=焦虑/花苞=期待）+ 「种一朵玫瑰」入口
2. **种花页** (`/plant`) — 选色（红/白/黄）→ 可交互 2D 玫瑰（3 个发光热点）→ 点击弹出对话框依次填写三类情绪 → 种植成功烟花动画 + 自动播放玫瑰专属音乐
3. **花圃页** (`/garden`) — 玻璃卡片网格 + 颜色筛选 + 分页加载 + WebSocket 实时更新

延伸功能：
- **玫瑰详情页** (`/rose/[id]`) — 完整情绪内容 + AI 回复 + 点赞/取消 + 「听这朵玫瑰」示波器 + 编辑/删除（仅 owner）
- **个人花圃** (`/my`) — 当前用户的所有玫瑰，分页
- **用户资料** (`/profile`) — 昵称、注册时间、种花统计（总数 + 三色分布）
- **情绪示波器** (`/oscilloscope`) — 预设情绪 + 文字实时驱动利萨如图形
- **登录页** (`/login`) — 昵称注册（无密码）+ JWT 存储 + redirect 跳回

**后端（Rust + Axum + PostgreSQL）**

| 端点 | 说明 |
|---|---|
| `POST /api/auth/register` | 昵称注册，返回 access_token + refresh_token |
| `POST /api/auth/refresh` | 无感刷新（7 天 refresh 换 15 分钟 access） |
| `POST /api/auth/logout` | 撤销 refresh_token |
| `GET /health` | 健康检查（数据库状态 + 版本号） |
| `POST /api/rose` | 种花（强制 JWT，后台异步 AI 回复） |
| `PUT /api/rose/:id` | 编辑玫瑰（仅 owner） |
| `DELETE /api/rose/:id` | 删除玫瑰（仅 owner） |
| `GET /api/garden` | 花圃列表（分页 + ?color= 筛选） |
| `GET /api/rose/:id` | 单朵玫瑰详情 |
| `GET /api/my/roses` | 个人花圃（需 JWT，分页） |
| `GET /api/user/profile` | 用户资料 + 统计（需 JWT） |
| `POST /api/rose/:id/like` | 点赞/取消（需 JWT） |
| `GET /api/ws` | WebSocket 实时推送新玫瑰 |
| `GET /swagger` | Swagger UI（OpenAPI 3.0） |

安全：双令牌（Access 15min / Refresh 7天，DB SHA-256 哈希）+ 令牌桶限流（30 req/60s）

**Rust WASM 模块（crates/recommend）**

| 模块 | 导出函数 | 作用 |
|---|---|---|
| `emotion.rs` | `analyze_text()` | 文本 → 情绪类型 + 强度 + 音频参数 |
| `audio.rs` | `rose_to_sound_params_wasm()` | 玫瑰属性 → 示波器参数 |
| `color.rs` | `color_emoji/color_label/color_options()` | 颜色元数据单一事实来源 |
| `petal.rs` | `generate_petals_wasm()` | 确定性花瓣轨迹（seed → 两端像素级一致） |
| `datefmt.rs` | `format_date_wasm()` | 日期格式化（中文相对时间） |
| `garden.rs` | `compute_layout/filter_roses()` | 花圃布局 + 过滤 |
| `plant.rs` | `validate_plant_input/format_plant_request_wasm()` | 种花表单校验（防注入） |
| `store.rs` | `store_dispatch/store_get_snapshot()` | 全局认证状态机 |
| `api_client.rs` | `build_garden_url/build_plant_body()` | URL + 请求体构造 |

**微信小程序（Taro 4 + React 18）**

- 5 个页面：首页/登录/花圃/种花/玫瑰详情
- 双令牌静默刷新（Promise 复用锁防并发）
- WXWebAssembly 补丁（BannerPlugin 注入 document mock）
- WASM 降级策略（加载失败不影响核心种花流程）
- 统一 NavBar（动态安全区适配）

**测试覆盖**

| 层 | 数量 | 说明 |
|---|---|---|
| Rust 后端 | 87 (76 + 11 需 DB) | 集成 + 单元 |
| Rust WASM | 69 | 含 audio 12 + color 3 |
| Web 前端 | 86 | 15 套件 |
| 小程序 | 42 | 5 套件 |
| **合计** | **284** | |

**基础设施**
- Docker Compose 一键部署（PostgreSQL + 后端 + 前端）
- GitHub Actions CI/CD（含 PostgreSQL service）
- CORS / 结构化日志（tracing）/ Swagger 文档

### Out of scope（显式排除）

- 排行榜、热度计数、「最受欢迎玫瑰」等竞争信号 — 核心价值相悖
- 私信/评论/回复 — 保持单向仪式感，不变社交平台
- 密码登录、OAuth、手机号注册 — 现阶段昵称够用，降低摩擦
- 推送通知（站内信 / APNs / FCM） — 打扰情绪表达的安静
- 游戏化积分/勋章 — 明确 anti-reference

### 待完成里程碑

| # | 里程碑 | 用户可见变化 | Status | 说明 |
|---|---|---|---|---|
| 1 | feedback 路由上线 | 用户可提交文字反馈 | pending | routes/feedback.rs 已写，未注册；007 迁移未应用 |
| 2 | Web `/about` 页面 | 版本信息 + 帮助折叠 + 反馈表单 | pending | 依赖里程碑 1 |
| 3 | 小程序关于页面 | 同上，微信端 | pending | 依赖里程碑 1 |
| 4 | 小程序真机联调 | 微信中完整跑通种花流程 | pending | 需 AppID + 后端运行 |
| 5 | register 端点双令牌改造 | 安全加固（30天 JWT → 双令牌） | pending | 当前安全债，register 仍发单 token |
| 6 | Web3 上链（Ethereum + Solana） | 用户可选择将精选一句话永久上链为 NFT | pending | ChainAdapter trait 已设计 |

## Open Questions

- [ ] 种花完成率基线是多少？需要第一批真实用户数据才能定目标（当前 60% 为假设）
- [ ] AI 回复对用户体验的实际影响如何？当前无 API Key 时静默跳过，用户是否注意到有无回复
- [ ] 小程序 vs Web 端用户行为是否有显著差异？需真机联调数据
- [ ] Web3 上链功能是否有真实用户需求？还是工程实验性质更强

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| 小程序真机 WASM 崩溃 | Medium | High | BannerPlugin 已注入 document mock；build-smoke.test 验证；降级策略保底 |
| AI 回复 API Key 未配置 | High | Low | ai.rs 已实现优雅跳过（None），前端展示区域条件渲染 |
| register 端点 30天 token 被盗用 | Low | Medium | 双令牌改造已列为 milestone 5，优先级高于 Web3 |
| 小程序代码包体积超限 | Low | Medium | 当前 684KB + 120KB WASM，微信限制 2MB 主包，尚有余量 |
| 情绪内容无内容审核 | Medium | Medium | TBD — 需评估是否需要关键词过滤或人工审核 |

---

*Status: ACTIVE — 产品核心功能已上线，文档补录当前实现状态。待完成里程碑见 Delivery Milestones 表。*
