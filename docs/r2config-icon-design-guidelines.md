# R2Config 图标设计调整规范

> 本文只描述 **R2Config
> 参数页面的图标设计与使用规则**，用于指导现有页面改造。\
> 目标不是增加更多装饰图标，而是建立一套克制、统一、有语义的 Icon
> System，让页面更像专门的 Configuration Console，而不是通用 Admin
> 模板。

------------------------------------------------------------------------

## 1. 总体原则

R2Config 的图标分成四类，必须区分处理：

1.  **产品导航图标**：侧边栏、菜单、操作按钮。
2.  **配置域（Group）图标**：App、Features、Onboarding、Payment 等。
3.  **数据类型图标**：Object、Array、String、Number、Boolean、Null。
4.  **业务数据图标**：例如 App List 中 MobiKwik 自己的 App Icon。

不要把这四类图标混成同一种视觉语言。

------------------------------------------------------------------------

## 2. 产品导航图标

导航和普通操作统一使用 **Lucide Icons**。

推荐映射：

``` tsx
import {
  SlidersHorizontal,
  Boxes,
  Users,
  ShieldCheck,
  ScrollText,
  Pencil,
  Trash2,
  Copy,
  MoreVertical,
  Eye,
  ExternalLink,
} from "lucide-react"
```

对应：

``` text
参数          SlidersHorizontal
应用          Boxes
后台账号      Users
权限组        ShieldCheck
系统日志      ScrollText

编辑          Pencil
删除          Trash2
复制          Copy
更多          MoreVertical
查看          Eye
打开链接      ExternalLink
```

### 规则

-   默认尺寸：`16px`
-   Sidebar 一级菜单可使用：`18px`
-   Stroke 保持 Lucide 默认风格。
-   默认颜色使用 `muted-foreground`。
-   Active 状态允许跟随主题 Accent。
-   不给普通导航图标单独加彩色背景。
-   不混用多个 Icon Library。

推荐：

``` tsx
<SlidersHorizontal className="size-4 text-muted-foreground" />
```

Active：

``` tsx
<SlidersHorizontal className="size-4 text-foreground" />
```

------------------------------------------------------------------------

# 3. Group 图标

Group Icon 的作用是：

> 帮助用户快速识别配置域。

不是为了装饰页面。

建议映射：

``` text
App           AppWindow
Features      Zap
Onboarding    Sprout
Payment       CreditCard
General       Boxes
Others        Boxes
```

实现：

``` tsx
import {
  AppWindow,
  Zap,
  Sprout,
  CreditCard,
  Boxes,
} from "lucide-react"

const groupIcons = {
  App: AppWindow,
  Features: Zap,
  Onboarding: Sprout,
  Payment: CreditCard,
}
```

Fallback：

``` tsx
const Icon = groupIcons[group.name.toLowerCase()] ?? Boxes
```

匹配不区分大小写；`feature` / `billing` 也分别映射到 Zap / CreditCard。
实现见 `frontend/app/(dashboard)/params/param-presentation.tsx` 的 `GroupIcon`。

------------------------------------------------------------------------

## 3.1 Group Icon 的配色

> 2026-09-20 调整：最初版本要求 Group Icon 常态中性色，落地后整页过灰，
> 决定给 Group 容器加**低饱和淡色底**。这是有意的取舍，不是遗漏。

规则：

-   图标本身仍然是 Lucide，尺寸 16px。
-   容器 32 × 32，`rounded-md`，带 1px 边框。
-   底色从固定的 6 色调色板里按**分组名哈希**选取，同名永远同色；
    不允许人工指定，也不允许新增颜色。
-   底色透明度 10%、边框 20%，图标用同色系 600（暗色主题 300）。
    不用实底、不用渐变、不用高饱和。

调色板（Tailwind）：

``` text
indigo   emerald   amber   rose   sky   violet
```

实现：

``` tsx
<span className="flex size-8 items-center justify-center rounded-md border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
  <AppWindow className="size-4" />
</span>
```

仍然不建议：

``` text
🟣 App     ← 实底高饱和色块
```

统一：

``` text
Icon: 同色系 600 / 300
Title: foreground
Description: muted foreground
```

------------------------------------------------------------------------

# 4. 数据类型图标

这一类不要完全依赖 Lucide。

对于 Configuration / Developer Tool，建议直接使用非常明确的符号：

``` text
{ }   Object / JSON
[ ]   Array
Aa    String / Text
#     Number
●     Boolean
∅     Null
```

它们比普通通用图标更容易形成 R2Config 自己的视觉语言。

------------------------------------------------------------------------

## 4.1 Object / JSON

推荐：

``` text
{ }
```

显示：

``` text
{ }  JSON · 6 fields
```

React：

``` tsx
<span className="font-mono text-primary">{`{ }`}</span>
```

不要用一个普通"文件"图标代表 JSON。

------------------------------------------------------------------------

## 4.2 Array

推荐：

``` text
[ ]
```

显示：

``` text
[ ]  Array · 3 items
```

Array 与 Object 一眼就能区分。

------------------------------------------------------------------------

## 4.3 String

推荐：

``` text
Aa
```

显示：

``` text
Aa  Text
```

相比 Lucide `Type`，直接使用 `Aa` 更直观。

------------------------------------------------------------------------

## 4.4 Number

推荐：

``` text
#
```

显示：

``` text
#  Number
```

------------------------------------------------------------------------

## 4.5 Boolean

Boolean 不建议使用一个抽象 Icon。

在列表 Value 区域直接使用：

``` text
Enabled      ●
Disabled     ○
```

或者 shadcn `Switch`。

在 JSON Builder 的"选择数据类型"菜单中可以使用：

``` text
◉ Boolean
```

------------------------------------------------------------------------

## 4.6 Null

推荐：

``` text
∅
```

显示：

``` text
∅ Null
```

------------------------------------------------------------------------

# 5. Type Icon 容器

JSON/Object/Array 等需要强调时，可以使用统一的小型 Type Icon Container。

例如：

``` text
┌────┐
│ {} │
└────┘
```

尺寸建议：

``` text
Container: 32 × 32
Radius: 8px
Icon/Text: 14–16px
```

样式（subtle primary：主色打到 8% 底、20% 边框，字用主色）：

``` tsx
<div
  className="
    flex size-8 items-center justify-center
    rounded-lg
    border border-primary/20
    bg-primary/8
    font-mono
    text-sm
    text-primary
  "
>
  {"{ }"}
</div>
```

这一套在列表值卡、JSON Builder 根标签、类型选择菜单里都是同一个组件
（`TypeTile` / `JSON_TYPE_SYMBOLS`），不要各处自己画。

不要：

-   大面积渐变
-   Glow
-   强阴影
-   每种 Type 一个高饱和颜色

------------------------------------------------------------------------

# 6. Status Icon

状态图标才允许使用明确的语义颜色。

推荐：

``` text
Production / Live    Green
Staging              Amber
Development          Neutral / Blue-gray
Warning              Amber
Error                 Red
Success               Green
Info                  Blue / Accent
```

例如：

``` text
● Production · Live
```

这里绿色是合理的，因为它表达 **状态**。

------------------------------------------------------------------------

## 6.1 Production

推荐：

``` text
● Production
```

或：

``` text
● Production · Live
```

不要使用复杂 Server Icon。

Production 的重点是状态识别。

------------------------------------------------------------------------

## 6.2 Warning

Production 修改提示：

``` text
△ You are editing the production environment.
```

这里使用：

``` tsx
AlertTriangle
```

并允许 Amber。

------------------------------------------------------------------------

# 7. Action Icon

Row 右侧操作保持非常克制。

推荐：

``` text
编辑     Pencil
删除     Trash2
更多     MoreVertical
复制     Copy
查看     Eye
```

正常状态：

``` text
muted-foreground
```

Hover：

``` text
foreground
```

危险操作 hover：

``` text
destructive
```

例如：

``` tsx
<Button variant="ghost" size="icon">
  <Pencil className="size-4" />
</Button>
```

Delete：

``` tsx
<Button
  variant="ghost"
  size="icon"
  className="hover:text-destructive"
>
  <Trash2 className="size-4" />
</Button>
```

------------------------------------------------------------------------

# 8. 不要同时显示 Edit + Delete 两个强操作

参数 Row 默认建议：

``` text
✎    ⋮
```

即：

``` text
Pencil
MoreVertical
```

More Menu：

``` text
View details
Duplicate
Copy key
────────────
Delete
```

这样比：

``` text
✎  🗑
```

长期并排更克制，也降低误删风险。

如果当前产品已经习惯直接显示 Delete，可以暂时保留，但 Delete 不要比 Edit
更醒目。

------------------------------------------------------------------------

# 9. 业务数据图标

这一类和 UI Icon 完全不同。

例如：

``` json
{
  "name": "MobiKwik",
  "icon": "https://cdn.example.com/mobikwik.png"
}
```

这里必须优先使用业务数据自己的图片：

``` tsx
<img
  src={app.icon}
  alt=""
  className="size-8 rounded-lg object-cover"
/>
```

显示：

``` text
┌────┐
│Logo│  MobiKwik
└────┘  https://example.com/mobikwik.apk
```

不要用 Lucide `AppWindow` 替代真实 App Icon。

------------------------------------------------------------------------

# 10. Business Icon Fallback

远程 Icon 加载失败时：

``` text
┌────┐
│ M  │
└────┘
MobiKwik
```

Fallback 顺序：

``` text
remote icon
    ↓ fail
first letter avatar
    ↓ unavailable
generic AppWindow
```

例如：

``` tsx
MobiKwik → M
PhonePe  → P
Paytm    → P
```

Fallback 应该保持中性背景。

例外：参数页顶部的**应用头像**（当前应用的首字母）用主色实底
`bg-primary text-primary-foreground`——它是整页唯一的品牌锚点，
不属于业务数据 fallback。

------------------------------------------------------------------------

# 11. Icon 尺寸体系

只保留几个固定尺寸：

``` text
12px   metadata / very small
14px   compact inline
16px   default
18px   sidebar
20px   group heading
24px   special empty state
```

绝大部分页面：

``` text
16px
```

就够了。

不要出现：

``` text
15px
17px
19px
21px
```

这种随机尺寸。

------------------------------------------------------------------------

# 12. Icon Container 尺寸

如果图标需要背景容器：

``` text
Icon 16px → Container 32px
Icon 18px → Container 36px
Icon 20px → Container 40px
```

R2Config 参数页推荐 Group：

``` text
32 × 32
```

不要做到 40--48px，参数页是高密度 Console，不是 Marketing Dashboard。

------------------------------------------------------------------------

# 13. 颜色规则

最重要的一条：

> **默认图标使用中性色，状态图标才使用语义颜色。**

建议：

``` text
Navigation       Neutral
Group            低饱和淡色底（按名字哈希，见 §3.1）
Action           Neutral
JSON Type        Subtle primary（见 §5）
App 头像         Primary 实底（见 §10）

Production       Green
Success          Green
Warning          Amber
Error            Red
Destructive      Red
```

不要：

``` text
JSON       Blue
Array      Purple
String     Cyan
Number     Pink
```

即：JSON 类型之间**不**用颜色区分，靠 `{ } [ ] Aa #` 符号区分；
Group 允许淡色，但只能是调色板里的低透明度色，不能实底。

------------------------------------------------------------------------

# 14. Sidebar 示例

推荐：

``` text
工作台

☷  参数
▣  应用


访问控制

♙  后台账号
♧  权限组


审计

▤  系统日志
```

实际实现继续使用 Lucide，不使用 Emoji。

Active：

``` text
┌───────────────────┐
│ ☷  参数            │
└───────────────────┘
```

Active 背景可以使用：

``` text
accent / muted
```

Icon 不需要额外彩色方块。

------------------------------------------------------------------------

# 15. Group Header 示例

推荐：

``` text
┌───────────────────────────────────────────────────────┐
│ ▣  App                                  3 parameters │
│    Application behavior and content configuration.  │
└───────────────────────────────────────────────────────┘
```

Icon 容器按 §3.1 带淡色底；不要实底高饱和色块：

``` text
🟣 ▣ App    ← 不要
```

Group Icon 是信息辅助，不是主视觉。

------------------------------------------------------------------------

# 16. JSON Value 示例

Object：

``` text
┌──────────────────────────────────────────┐
│ { }   JSON · 6 fields            Public │
│                                          │
│ visible      true                        │
│ title        HiHello                     │
│ maxShows     3                       ›   │
└──────────────────────────────────────────┘
```

Array：

``` text
┌──────────────────────────────────────────┐
│ [ ]   Array · 3 items            Public │
│                                          │
│ 1   Welcome                             │
│ 2   Permissions                         │
│ 3   Getting Started                 ›   │
└──────────────────────────────────────────┘
```

这里 `{ }` / `[ ]` 本身就是 Type Identity。

不需要额外再放：

``` text
JSON icon + JSON badge + JSON text
```

避免信息重复。

------------------------------------------------------------------------

# 17. JSON Builder 类型选择

Add Item / Add Field 时：

``` text
Choose type

Aa   String
#    Number
◉    Boolean
{ }  Object
[ ]  Array
∅    Null
```

这一组符号建议成为 R2Config 固定的 JSON 类型语言。

------------------------------------------------------------------------

# 18. 不建议的设计

避免下面几类做法。

### 18.1 每个东西都有 Icon

例如：

``` text
Key        🔑
Type       ◇
Visibility 👁
Value      ◆
```

没必要。

Label 本身已经足够清楚。

------------------------------------------------------------------------

### 18.2 大量彩色 Icon Box

不要把每个 Icon 都变成：

``` text
┌────┐
│ ⚡ │
└────┘
```

只有 Group / Type Preview 等少数场景需要 Container。

------------------------------------------------------------------------

### 18.3 Emoji

正式产品 UI 不使用：

``` text
⚡
🌱
💳
📦
```

文档草图可以用，实际页面使用 Lucide / Typography Symbol。

------------------------------------------------------------------------

### 18.4 混用 Icon 风格

禁止同时出现：

``` text
Lucide outline
Heroicons solid
FontAwesome
自定义粗线 SVG
Emoji
```

UI Icon 统一 Lucide。

------------------------------------------------------------------------

# 19. 最终规则总结

实现时按下面规则即可：

``` text
UI / Navigation
→ Lucide Icons
→ Neutral color
→ 16px default

Group
→ Lucide Icons
→ 16px，容器 32px
→ 低饱和淡色底，按名字哈希取色

JSON Type
→ Typography Symbols
→ { } [ ] Aa # ◉ ∅
→ Subtle primary 容器
→ 不依赖普通业务 Icon

Status
→ Lucide / Dot
→ Semantic colors allowed

Action
→ Lucide
→ Neutral by default
→ Destructive only on hover / confirmation

Business Data
→ Real remote image
→ Letter avatar fallback
→ Generic icon last fallback
```

------------------------------------------------------------------------

# 20. 最终目标

图标系统应该帮助 R2Config 建立这种感觉：

> **Developer Tool / Configuration Console**

而不是：

> **彩色 SaaS Admin Dashboard**

因此整体关键词是：

``` text
克制
统一
语义明确
高信息密度
Developer-oriented
少装饰
状态才用颜色
```

最重要的三条：

1.  **UI Icon 统一 Lucide。**
2.  **JSON Type 使用 `{ } [ ] Aa # ◉ ∅` 建立自己的视觉语言。**
3.  **状态色只给状态用；Group 和 JSON 类型的颜色是低饱和的辅助色，不做实底。**
