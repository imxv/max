# Max 3D — AI 3D 模型生成器

文本/图片一键生成 3D，预览 → 精修双阶段，积分计费，生成记录、评分反馈、相似模型检索与重用，内置安全代理直连查看 GLB。

关键代码参考：
- 生成 API：`src/app/api/generate/route.ts`
- 前端生成器：`src/components/ModelGenerator.tsx`
- 在线预览与代理：`src/components/ModelViewer.tsx`、`src/app/api/proxy-model/route.ts`
- 相似检索与重用：`src/app/api/models/similar/route.ts`、`src/app/api/models/reuse/route.ts`
- 模型列表/评分：`src/app/api/models/**`、`src/components/ModelRating.tsx`
- 积分体系：`src/lib/credits.ts`、`src/app/api/credits/**`
- 数据模型：`prisma/schema.prisma`

---

## 1) 面向用户与用户故事

- 目标用户
  - 游戏与 XR 从业者/独立开发者：快速产出可用 3D 融入原型迭代。
  - 电商与营销设计师：需要批量/快速的交互展示资产。
  - 教育/创客/学生：无重型 DCC 工具与 GPU 资源，希望低门槛体验 3D 生产。
- 主要痛点
  - 传统建模成本高、速度慢、工具链重；AI 生成效果不稳，易反复试错浪费调用额度。
  - 结果难沉淀：好的模型找不到、糟糕的模型反复生成。
- 用户故事
  - 作为设计师，我用一句话或一张照片，30–90 秒内得到预览白模，满意后再一键精修贴图输出 GLB/FBX。
  - 作为独立开发者，我先搜索相似描述，命中则直接重用（不花积分），否则再发起生成。
  - 作为团队成员，我给生成结果打分与问题标签，系统据此调整参数与供应商路由，减少“失败单”。

---

## 2) 功能与优先级

- 已实现（P0）
  - 文本→3D 预览与精修双阶段；图片→3D 预览（白模无贴图以省积分）。
  - 任务轮询与结果入库、缩略图显示、在线模型预览（`@google/model-viewer`）。
  - 相似模型检索 + 一键重用（0 积分）。
  - 模型评分与评论闭环；积分初始化/扣费/统计/历史；Clerk 登录。
- 计划中的（P1）
  - 生成结果下载与分享链接；任务 Webhook（替代轮询）。
  - 相似检索升级为向量检索（嵌入 + 向量库），更稳的召回率。
  - 多供应商路由与降级（按质量/价格/时延 AB 路由）。
- 展望（P2）
  - 网格后处理（简化/修复/重拓扑/贴图 bake）、AR 导出（USDZ）。
  - 管理后台指标与规则调整，提示工程与模板库。

本次开发聚焦 P0：双阶段生成、相似检索与重用、积分闭环、在线预览与评分。

---

## 3) 3D 生成 API 选择

- 采用：Meshy（`https://api.meshy.ai`）
  - 支持文本→3D、图片→3D；原生预览/精修两阶段；输出 GLB/FBX，质量稳定；集成简单。
- 对比简述
  - Meshy：质量稳定、参数清晰（preview/refine）、速度较快、生态完善，适合产品化。
  - Tripo/Luma/Replicate 等：各有优势，但在“上线速度 + 成本可控 + 双阶段契合积分”的综合权衡下，优先 Meshy。
- 代码说明
  - 生成路由：`src/app/api/generate/route.ts`（当前使用测试用占位 key，开发可直接用，生产建议改为环境变量）。

---

## 4) 效果评估与持续迭代

- 关键指标（自动 + 人工）
  - 成功率/失败率、平均时延（预览/精修拆分）、每个可接受模型的积分成本（CPP）。
  - 预览→精修转化率；用户评分均值/分布；问题标签（网格破损/纹理模糊/不符描述等）。
  - 网格/材质客观指标：面数、文件大小、PBR 完整度、缩略图可视质量。
  - 相似检索命中率与重用占比（节省了多少次调用）。
- 评估系统设计（最小闭环）
  - 数据采集：任务生命周期/耗时、评分与预设问题项、相似检索命中日志。
  - 自动离线评估（计划）：拉取 GLB 渲染多视图 → 文本-图像相似（CLIP 类）+ 网格统计（面数/法线/材质），生成 CompositeScore。
  - 策略回路：低分提示模板优化；针对低相关度场景切换供应商或参数；失败样本进入黑名单与改写建议；相似阈值动态调节。
  - A/B 与回放：同一提示不同参数/供应商生成小样对比，选优策略上线。

---

## 5) 如何减少第三方调用

- 策略清单
  - 检索优先 → 重用已有模型（0 积分）。
  - 双阶段闸门：先预览（低成本），确认后再精修（高成本）。
  - 文本规范化与提示复用；速率限制与二次确认；失败缓存与避坑提示。
- 已落地方案
  - 生成前调用 `POST /api/models/similar` 展示候选（`src/app/api/models/similar/route.ts` + `src/components/SimilarModelsDialog.tsx`）。
  - 命中则 `POST /api/models/reuse`（`src/app/api/models/reuse/route.ts`）直接复用，积分 0；未命中再走 `/api/generate`。
- 后续优化
  - 检索算法升级为嵌入向量；为 GLB 建立内容哈希与几何指纹，避免重复存储与下载。

---

## 快速开始

- 依赖
  - Node.js 18+；pnpm 或 npm；PostgreSQL（示例用 Supabase）。
  - Clerk（登录），Meshy API（3D 生成）。
- 环境变量（开发示例）
  ```env
  # Clerk
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
  CLERK_SECRET_KEY=

  # Supabase / Postgres
  SUPABASE_URL=
  SUPABASE_KEY=
  DATABASE_URL=
  DIRECT_URL=

  # 3D Provider（开发期：当前路由内置了测试 key，可先不配置）
  # MESHY_API_KEY=
  ```
- 启动
  - 安装依赖：`pnpm i`
  - 初始化数据库：`pnpm db:generate && pnpm db:push && pnpm db:seed`
  - 本地开发：`pnpm dev` → 打开 `http://localhost:3000`

> 提醒：当前 `src/app/api/generate/route.ts` 使用测试用占位 key（常量）。上线前请切换为读取环境变量并配置生产 key。

---

## 产品与技术要点

- 双阶段生成：预览快/低成本 → 确认后精修贴图高质输出。
- 相似检索与重用：命中直接复用模型（0 积分），从源头降本提速。
- 评分反馈闭环：打分 + 预设问题标签，驱动参数与路由策略优化。
- 在线预览：`@google/model-viewer` + 安全代理，绕过跨域限制，流畅查看 GLB。
- 模块清晰：前端/路由/API/数据层职责分离，易扩展与替换供应商。

---

## 积分与费用模型

- 费用映射（见 `src/lib/credits.ts`）
  - `text-to-3d-preview`: 5
  - `text-to-3d-optimized`: 10
  - `image-generation`: 5
- 扣费时机
  - 调用第三方成功后入账；重用不扣费；交易明细与统计可在 API 查看。

---

## 安全与合规

- 代理白名单：`/api/proxy-model` 仅允许 meshy.ai 域名。
- 权限隔离：Clerk 登录态与管理员能力（`src/lib/admin.ts`、`src/app/api/admin/**`）。
- 生产建议：将第三方 API key 使用环境变量；开启速率限制与回调验签。

---

## 路线图（精简）

- P0：Webhook 稳定性、结果下载分享、失败重试。
- P1：向量检索、跨供应商 AB 路由、质量看板。
- P2：网格后处理、AR 导出、模板与批量、团队协作。

---

## 开发者参考（关键文件）

- 生成 API：`src/app/api/generate/route.ts`
- 前端生成器：`src/components/ModelGenerator.tsx`
- 相似检索：`src/app/api/models/similar/route.ts`
- 模型重用：`src/app/api/models/reuse/route.ts`
- 模型查看：`src/components/ModelViewer.tsx`
- 代理下载：`src/app/api/proxy-model/route.ts`
- 积分体系：`src/lib/credits.ts`、`src/app/api/credits/**`
- 数据模型：`prisma/schema.prisma`
