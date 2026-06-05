---
name: Roselet
description: 为社区种一朵玫瑰吧，情绪仪式的数字花圃
colors:
  void-black: "#080e0c"
  void-black-alt: "#0a0b14"
  star-white: "#e2e8f0"
  star-white-dim: "#94a3b8"
  star-white-muted: "#64748b"
  glow-gratitude: "#eab308"
  glow-anxiety: "#0ea5e9"
  glow-hope: "#d946ef"
  accent-rose: "#f43f5e"
  accent-rose-dim: "#fb7185"
  accent-amber: "#fbbf24"
  glass-surface: "#ffffff0d"
  glass-border: "#ffffff1a"
typography:
  display:
    fontFamily: '"Ma Shan Zheng", "STXingkai", "KaiTi", cursive'
    fontSize: "clamp(1.5rem, 4vw, 2.5rem)"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "0.04em"
  body:
    fontFamily: '"PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", system-ui, sans-serif'
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: '"PingFang SC", system-ui, sans-serif'
    fontSize: "0.8125rem"
    fontWeight: 400
    letterSpacing: "0.02em"
  mono:
    fontFamily: "var(--font-geist-mono), ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
rounded:
  pill: "9999px"
  card: "1rem"
  sm: "0.5rem"
spacing:
  xs: "0.25rem"
  sm: "0.75rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2.5rem"
components:
  nav-link:
    backgroundColor: "transparent"
    textColor: "{colors.star-white-dim}"
    rounded: "{rounded.pill}"
    padding: "0.375rem 0.75rem"
  nav-link-active:
    backgroundColor: "#f43f5e26"
    textColor: "{colors.accent-rose-dim}"
    rounded: "{rounded.pill}"
    padding: "0.375rem 0.75rem"
  button-primary:
    backgroundColor: "{colors.accent-rose}"
    textColor: "{colors.star-white}"
    rounded: "{rounded.pill}"
    padding: "0.5rem 1.5rem"
  button-primary-hover:
    backgroundColor: "#e11d48"
    textColor: "{colors.star-white}"
    rounded: "{rounded.pill}"
    padding: "0.5rem 1.5rem"
  button-ghost:
    backgroundColor: "#ffffff0d"
    textColor: "{colors.accent-rose-dim}"
    rounded: "{rounded.pill}"
    padding: "0.375rem 1rem"
  glass-card:
    backgroundColor: "{colors.glass-surface}"
    textColor: "{colors.star-white}"
    rounded: "{rounded.card}"
    padding: "{spacing.md}"
  input-field:
    backgroundColor: "#1e293b99"
    textColor: "{colors.star-white}"
    rounded: "{rounded.sm}"
    padding: "0.625rem 0.75rem"
---

# Design System: Roselet

## 1. Overview

**Creative North Star: "月下花圃"**

Roselet 是一座深夜里的花圃，只有月光照亮它的轮廓。界面不是工具，是场所：用户走进来，在黑暗中找到自己的那朵花，轻轻种下，然后离开。场所感意味着边界消融，元素从虚空中浮现，不被卡片框住。情绪发光，但不喧嚣；颜色附着于每种情绪类型，而非装饰 UI 本身。

字体选择是刻意的：Ma Shan Zheng 的毛笔笔触为标题和情绪词带来手迹感，让数字界面有了仪式质地。背景是宇宙级别的深黑，不是深灰。宇宙里有光，那些光是用户种下的每一朵玫瑰发出的霓虹余晖。

这个系统拒绝一切会让人想到"打卡 App"或"SaaS 仪表板"的视觉语言。它不属于 2024 年的任何流行趋势，它属于某个安静的夜晚。

**Key Characteristics:**
- 极深背景（接近纯黑，带微量色相）+ 低不透明度毛玻璃浮层
- 三色情绪光晕系统：琥珀（感恩）/ 天蓝（焦虑）/ 品红（期待）
- 毛笔字与系统 CJK 字体的双字体体系
- 霓虹辉光作为状态反馈，不作装饰
- 无硬性卡片边框，无计数排行，无竞争信号

## 2. Colors: 情绪星图

三种情绪色是唯一的饱和色，其余一切保持深邃克制。

### Primary
- **玫瑰红 / Accent Rose** (`#f43f5e`): 导航激活态、主要 CTA 按钮、登录入口。玫瑰本身的颜色，出现面积不超过界面的 10%。
- **琥珀辉 / Glow Gratitude** (`#eab308`): 感恩（玫瑰）的辉光色，仅用于该情绪类型的 box-shadow 和 icon 着色。

### Secondary
- **天际蓝 / Glow Anxiety** (`#0ea5e9`): 焦虑（尖刺）的辉光色，仅用于该情绪类型的辉光和 icon。
- **品红辉 / Glow Hope** (`#d946ef`): 期待（花苞）的辉光色，仅用于该情绪类型。

### Neutral
- **虚空黑 / Void Black** (`#080e0c`): 主背景基础色，带极微量绿相（如苔藓湿润的泥土）。
- **深空黑 / Void Alt** (`#0a0b14`): 页面 body 背景，带极微量靛相（如深夜天穹）。CyberBackground 组件覆盖其上。
- **星光白 / Star White** (`#e2e8f0`): 主要正文颜色。
- **暗星白 / Star White Dim** (`#94a3b8`): 次要文字、日期、辅助标签。
- **消隐白 / Star White Muted** (`#64748b`): 占位符、禁用态文字。
- **玻璃面 / Glass Surface** (`#ffffff0d`): 卡片背景（白色 5% 透明度）。
- **玻璃边 / Glass Border** (`#ffffff1a`): 卡片边框（白色 10% 透明度）。

### Named Rules
**情绪专属规则。** 三种辉光色（琥珀/天蓝/品红）是情绪的语言，不是装饰工具。它们仅出现在与对应情绪类型直接相关的元素上；不得随意将任意一种用作通用强调色或按钮色。

**玫瑰红克制规则。** `#f43f5e` 是 UI 的唯一强调色，出现频率不超过任意屏幕的 10%。它的稀有是它力量的来源。

## 3. Typography: 双笔体系

**Display Font:** Ma Shan Zheng（毛笔楷书，Google Fonts）with KaiTi, cursive fallback
**Body Font:** PingFang SC, Microsoft YaHei, Hiragino Sans GB, system-ui, sans-serif
**Mono Font:** Geist Mono, ui-monospace, monospace

**Character:** 毛笔字带来呼吸感和手迹感，让情绪词和标题有重量；系统 CJK 字体负责可读性。两者之间的跨度是刻意的，不是系统性的不一致。

### Hierarchy
- **Display** (weight 400, clamp 1.5–2.5rem, lh 1.3): 页面大标题、情绪类型名、种花仪式文字。仅用 Ma Shan Zheng。
- **Headline** (weight 500, 1.125rem, lh 1.4): 区块标题、弹出框标题。系统字体。
- **Body** (weight 400, 0.9375rem, lh 1.6): 情绪内容正文、用户输入文字、卡片内容。最大行宽 65ch。
- **Label** (weight 400, 0.8125rem, lh 1.4): 导航链接、日期、辅助信息。letter-spacing 0.02em。
- **Mono** (weight 400, 0.75rem): 字符计数器、技术性数字信息。

### Named Rules
**毛笔仅作仪式用。** Ma Shan Zheng 仅用于情绪词、标语、种花仪式文字等承载仪式重量的场合。表单标签、错误提示、导航链接，一律用系统字体。

## 4. Elevation: 辉光代替阴影

这个系统是平面的，用色调分层而非几何阴影表达层次。毛玻璃（backdrop-blur: 12px）是唯一的物理深度机制，用于浮层卡片；它的使用有克制，不滥用于每个容器。

情绪辉光（glow）是功能性状态信号，不是装饰：鼠标悬停在玫瑰卡片上时，该卡片发出对应情绪颜色的辉光，表达"这朵花活着"的感知。

### Shadow Vocabulary
- **情绪辉光 / Emotion Glow** (`0 0 20px {glow-color-0.55}, 0 0 40px {glow-color-0.15}`): 仅用于玫瑰卡片悬停态，颜色随情绪类型变化。
- **焦点辉光 / Focus Halo** (`0 0 0 2px {accent-rose-0.4}`): 键盘焦点时的表单元素辉光。不使用实线描边 outline。

### Named Rules
**辉光不用于装饰。** 任何没有状态含义的辉光效果一律禁止，无论颜色多美。辉光意味着"这里有情绪，这里有生命"，滥用后这个含义消失。

## 5. Components

### Buttons
- **Shape:** 全圆角胶囊（border-radius: 9999px），不使用方角或微圆角。
- **Primary:** 玫瑰红底（`#f43f5e`），白字，上下 padding 0.5rem，左右 1.5rem。悬停加深至 `#e11d48`，translateY(-1px)，过渡 150ms ease-out。
- **Ghost:** 白色 8% 透明底，玫瑰红字，用于次要 CTA（如"取消"）。
- **Focus:** box-shadow 玫瑰红辉光，无 outline。
- **Disabled:** opacity 0.4，pointer-events: none，不改变颜色。

### Navigation Links
- **Style:** 胶囊形，默认 `text-slate-400`，悬停 `text-slate-200 + bg-white/5`。
- **Active:** `bg-rose-500/15`，`text-rose-300`，font-weight 500。
- **无下划线，无底部激活线，无侧边指示条。**

### Glass Cards（玫瑰卡片/内容容器）
- **Background:** `rgba(255,255,255,0.05)` + backdrop-blur 12px。
- **Border:** `1px solid rgba(255,255,255,0.10)`，悬停时增强到 0.20。
- **Corner:** border-radius 1rem（16px）。
- **Elevation:** 无 box-shadow，悬停时情绪辉光激活（见 Elevation）。
- **Internal Padding:** 1rem。
- **禁止在卡片内部嵌套另一层卡片。**

### Inputs / Textarea
- **Style:** 深色半透明背景（`#1e293b` ~60% 不透明），`border: 1px solid slate-600`，border-radius 0.5rem。
- **Focus:** border 变为 `rose-400`，叠加玫瑰红辉光 ring（`ring-rose-400/20`）。无传统 outline。
- **Placeholder:** `text-slate-500`，消隐白。
- **Error:** border 变为 `red-500/30`，背景 `red-500/5`，辅以 `role="alert"` 区块（非 border-left 条纹）。

### 情绪辉光标识（Signature Component）
三种情绪类型在视觉上的唯一区分方式：颜色辉光 + emoji 标识。
- 🌹 感恩（红玫瑰）→ 琥珀辉光 `glow-gratitude`
- 🌵 焦虑（尖刺）→ 天蓝辉光 `glow-anxiety`
- 🌱 期待（花苞）→ 品红辉光 `glow-hope`

不得用 badge、tag、数字标注区分情绪类型，只用颜色和 emoji。

## 6. Do's and Don'ts

### Do:
- **Do** 让背景是宇宙级别的深黑（lightness < 8%），不是深灰（lightness > 15%）。
- **Do** 用毛笔字（Ma Shan Zheng）承载仪式性文字，如种花引导语、情绪词、标语。
- **Do** 用情绪辉光表达卡片的活性状态，不用通用灰色阴影。
- **Do** 让玻璃卡片从背景中浮现（低透明度），而非挂在白底上。
- **Do** 保持 prefers-reduced-motion：所有动效须有静态降级。
- **Do** 让错误提示用完整边框或背景色块呈现，而非侧边条纹。
- **Do** 在每朵玫瑰上用情绪颜色+emoji 作为唯一识别标记，不加数字计数。

### Don't:
- **Don't** 使用侧边条纹（`border-left > 1px`）作为卡片、列表项、告警的强调色。现有 RoseCard 的 `border-l-2` 是技术债，不得扩展此模式。
- **Don't** 使用渐变文字（`background-clip: text` + gradient background）。情绪表达用实色，用 weight 或 size 强调，不用视觉噪音。
- **Don't** 把毛玻璃用作装饰性背景层。backdrop-blur 是深度机制，仅用于真正浮起的容器。
- **Don't** 使用任何计数排名信号：点赞数排行、热度数字、「本周种花最多用户」类信息。情绪不参与竞争。
- **Don't** 引入 Headspace 风格的粉紫马卡龙色调。高明度治愈系配色与「月下花圃」气质相悖。
- **Don't** 按 Linear/Jira 风格排列信息：规矩网格、圆角死板卡片、深蓝主色。我们要的是花圃，不是看板。
- **Don't** 在卡片内嵌套卡片。
- **Don't** 用游戏化语言：勋章、连续打卡提示、积分、排行榜。种花的纯粹性不需要奖励系统维持。
- **Don't** 在任何屏幕上让玫瑰红（`#f43f5e`）占据超过 10% 的面积。
