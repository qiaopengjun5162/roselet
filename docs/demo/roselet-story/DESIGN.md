# Roselet 三步交互故事 · DESIGN

## 全局视觉约定

### ① 画布与安全区
- 画布 1280×720，页面 padding 60px；内容区 1160×600（x 60–1220，y 60–660）。
- 页尾位置 y=670，字号 14px；封面与结尾页不设页尾。
- 封面 / 结尾可出血；内容页元素保持在安全区内。

### ② 配色方案（拼贴纸感）
- 主色 accent：`#E07A5F`（赤陶红，用于关键按钮 / 编号 / 结论）
- 底色 bg：`#F4ECD8`（纸黄）
- 文字：ink `#3D405B`，secondary `#6B6472`，muted `#948C82`
- 卡片底 surface：`#FFFDF7`；分隔线 line：`#D9CEBA`
- 点缀色：绿 `#81B29A`，黄 `#F2CC8F`，深红 `#C9584C`
- 深色块 deep_bg：`#2F3B34`，深底文字 on_deep：`#F4ECD8`
- 面积纪律：主色 ≤10%，纸黄底 ≥60%，点缀色合计 ≤20%。

### ③ 字体系统
- 中文标题：思源宋体（Source Han Serif SC / Noto Serif SC）Bold
- 中文正文：思源黑体（Source Han Sans SC / Noto Sans SC）Regular
- 英文 / 数字：Playfair Display（仅标题与标签）
- 字号阶梯：封面主标 88px；页面主标 36px；卡片小标 24px；正文 18–20px；标签 16px；页脚 14px。

### ④ 视觉母题
- 手绘纸片：图片统一白色 8px 边框 + 轻微旋转（-3° / 2° / -1°），像贴在纸上的便签照片。
- 眉标：每页左上角「ROSE · THORN · BUD」小字 + 赤陶红短竖条，仅一处，不下放卡片。
- 关键问题用「手写标签」式的浅色底块承载，不用统一卡片网格。

### ⑤ 配图清单
| 文件 | 用途 | 生成方式 | 真实内容 | 使用页 |
| --- | --- | --- | --- | --- |
| `assets/ref_handdrawn.jpg` | 灵感证据 / collage 主视觉 | material（用户上传） | 手绘 Rose Thorn Bud 检查图，粉玫瑰 | P2 |
| `assets/ref_minimal.jpg` | 灵感证据 / 对照小图 | material（用户上传） | 简约 Rose Bud Thorn 检查图，橙玫瑰 | P2 |
| `assets/rose_crop.png` | 主角图 | material 裁剪 | 手绘粉色玫瑰花朵特写 | P1 / P4 |

全部图片已逐张核对：内容贴合、比例可用、清晰度足够、同为手绘插画风格，不混用摄影 / 3D。

## 逐页设计

### P1 封面
- title: 一起来种一个玫瑰花圃吧
- type: cover
- role: hero
- rhythm: peak
- layout: 大字报 + 右侧纸片主视觉
- visual: L1 `rose_crop.png`（右侧 360×316，白边纸片 -3°）
- density: 字数约 45 / 图片 1 张 / 留白约 45%
- anti_pattern: 禁止居中大标题 + 三等分卡片；禁止把玫瑰缩小成装饰 icon
- description: 用一句标语建立产品气质：三种情绪、一座花圃。右侧手绘玫瑰纸片是唯一主视觉，标题占左侧主要空间。

### P2 灵感来源：Rose, Bud, Thorn
- title: 灵感来自一个经典的破冰游戏
- type: content
- role: supporting
- rhythm: valley
- layout: 左图右文（7:3，主视觉为两张叠放纸片）
- visual: L1 `ref_handdrawn.jpg`（540×540）+ L2 `ref_minimal.jpg`（280×279，右下叠放）
- density: 字数约 210 / 图片 2 张 / 留白约 22%
- anti_pattern: 禁止把三个问题做成等宽卡片横排；禁止图注压在手绘图上
- description: 用两张用户提供的原型图说明灵感；右侧依次列出玫瑰 / 尖刺 / 花苞三个问题，讲清每个符号对应的表达任务。

### P3 第一屏：规则介绍
- title: 第一屏 · 先讲清三种花
- type: content
- role: supporting
- rhythm: valley
- layout: 左标题色块 + 右内容（m）
- visual: 结构化界面 mock：三行问题条 + 底部 CTA「种一朵玫瑰」
- density: 字数约 240 / 图片 0 张 / 留白约 25%
- anti_pattern: 禁止三张等宽卡片；禁止在 mock 里塞真实截图
- description: 复刻用户描述的第一个界面：进入后看到规则介绍，三行文案分别解释玫瑰、尖刺、花苞，底部按钮进入下一屏。

### P4 第二屏：种花交互
- title: 第二屏 · 点亮三个光点
- type: content
- role: hero
- rhythm: peak
- layout: 左流程说明 + 右交互 mock（非对称 4:6）
- visual: SVG 手绘玫瑰 + 三个发光点 + 颜色圆点 + 弹窗占位提示；L1 `rose_crop.png` 作为纸片小图
- density: 字数约 190 / 图片 1 张 / 留白约 30%
- anti_pattern: 禁止把三种颜色做成大色块铺底；禁止用 Emoji 代替图标
- description: 展示选颜色、拖动玫瑰、点击花瓣 / 花苞 / 尖刺光点后弹出输入框；淡色提示在打字时消失；三个都填完按钮才亮起。

### P5 第三屏：种入花圃
- title: 第三屏 · 它长在花圃里了
- type: content
- role: hero
- rhythm: peak
- layout: 全宽视觉叙事 + 底部结论条
- visual: SVG 花圃剪影（多色玫瑰依次长出）+ 月光圆 + 结论文字
- density: 字数约 90 / 图片 0 张 / 留白约 40%
- anti_pattern: 禁止等宽卡片；禁止在结论条上加描边或阴影
- description: 用动画式构图表现玫瑰被种进花圃，各色玫瑰共同生长；出现「谢谢你在社区种下的玫瑰」，强调这里没有计数和排名。

### P6 结尾
- title: 为社区种一朵玫瑰吧
- type: ending
- role: hero
- rhythm: peak
- layout: 收束金句 + 落款
- visual: 顶部一行手写风格小字，底部线上地址
- density: 字数约 50 / 图片 0 张 / 留白约 55%
- anti_pattern: 禁止只写「谢谢」占满整页；禁止添加二维码占位图
- description: 收束到项目标语与线上入口，给观众一个明确的行动指向。
