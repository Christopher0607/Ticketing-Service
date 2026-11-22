# Crazy Monkey 票务 · Ticketing Service

马来西亚粉丝之间的**门票转让平台**。持票人（不一定是主办方）把手上的票挂出来，自己定价；平台不赚差价，只向买卖双方收透明服务费（默认买家 3% + 卖家 3%，后台可调，每张订单记录下单时的费率）。

> 同公司的 [crazy-monkey](https://github.com/Christopher0607/crazy-monkey) 是**演唱会团购**站；这里是**二手转让市场**。两边共用黑金品牌，设置 `GROUPBUY_URL` 后导航会链接到团购站。

## 功能一览

**买家**
- 首页：焦点活动轮播、按类别 / 城市浏览、热门活动、近期活动、最新上架门票、常见问题
- 找活动：搜索、类别、时间（今天 / 本周末 / 7 天 / 30 天）、城市、排序（最近 / 最便宜 / 最热门）、分页
- 活动页：张数筛选、价格排序、原价与加价标示、卖家评分与成交数、座位图、Google Maps / Waze 导航、WhatsApp / Facebook 分享、相似活动、收藏（有新票自动发邮件）
- 下单锁票 45 分钟；DuitNow / 银行转账付款，手机上传截图（浏览器自动压缩）
- 我的账户：订单（按状态筛选）、收藏、个人资料、修改密码；确认收票后可评价卖家

**卖家**
- 申请成为卖家（WhatsApp 号码）、收款账户、挂单（必须填原价，可设平台加价上限）
- 卖家中心：在售挂单、已售、待结算、已结算统计；改价、减少张数、下架；公开卖家主页（评分、评价、在售门票）

**平台 / 管理员**
- 托管付款：买家付款 → 卖家官方转票 → 买家确认 → 活动开始 24 小时后才结算给卖家
- 后台：成交额 / 佣金统计；核对付款截图、待结算、退款申请、卖家申请、挂单审核；活动管理（海报、座位图、场馆地址）；用户管理（搜索、停用账户）；**导出 CSV 对账**（与公司银行流水核对）；费率与收款信息设置
- 邮件通知（Resend）：付款确认、请卖家转票、已转票、退款、结算，以及给管理员的新付款 / 新申请提醒
- 服务条款、隐私政策（PDPA）、退款与买家保障政策（英文为准 + 中文翻译，**草稿，待律师审核**）、关于我们、帮助中心
- 中英双语、手机底部导航、可添加到主屏幕（PWA）、SEO（sitemap、robots、Google 活动结构化数据）
- 安全：Supabase 上所有表启用行级安全（RLS）、付款截图私有存储、上传图片重新编码、登录限流、管理员页面权限校验

## 上线方案 A：Netlify + Supabase（全免费，推荐起步）

| 服务 | 用途 | 免费额度（以官网为准） |
| --- | --- | --- |
| [Netlify](https://www.netlify.com/pricing/) | 运行网站 | 每月 300 credits，允许商业用途 |
| [Supabase](https://supabase.com/pricing) | 数据库 + 图片 / 截图存储 | 500 MB 数据库、1 GB 文件、5 GB 流量；7 天无活动会暂停（网站每小时的定时任务会保持活跃） |
| [Resend](https://resend.com/pricing) | 注册验证、找回密码、订单通知邮件 | 免费额度起步 |
| 域名 | `.com` 约 RM50–70 / 年 | — |

> Supabase 只能放数据库和文件，不能运行网站本身，所以网站放 Netlify（团购站已经在用）。海报和截图直接从 Supabase 的 CDN 加载，不占 Netlify 流量。

### 步骤

1. **Supabase**：用 Google 登录 → New project（Region 选 **Southeast Asia (Singapore)**，设置数据库密码并记下来）。
   - Project Settings → Database → **Connection string**：复制 *Transaction pooler*（端口 6543）和 *Session pooler*（端口 5432）两条连接串。
   - 同一页 **SSL Configuration → Download certificate**，下载 CA 证书。
   - Project Settings → **API**：复制 Project URL 和 `service_role`（或 secret）key。⚠️ 这个 key 绝不能公开。
2. **Netlify**：用 GitHub 登录 → Add new site → Import from Git → 选 `Ticketing-Service`，**分支选 `main`**。构建设置会自动读取 `netlify.toml`。
3. 复制 [`.env.netlify.example`](.env.netlify.example)，填好上面拿到的值（`DATABASE_SSL_CA` 粘贴证书全文），然后在 Netlify：Site configuration → Environment variables → **Import from a .env file**。
4. Netlify → Deploys → **Trigger deploy**。正式部署时会先自动执行数据库迁移（建表、开启 RLS、创建 `media` 和 `private` 两个存储桶）。
5. **创建管理员**（在自己电脑上执行一次）：

   ```sh
   git clone https://github.com/Christopher0607/Ticketing-Service.git && cd Ticketing-Service && npm ci
   DATABASE_URL="Session pooler 连接串" DATABASE_SSL_CA="$(cat 下载的证书.crt)" \
   ADMIN_EMAIL=你的邮箱 ADMIN_PASSWORD='至少14位的强密码' npm run db:admin
   ```

6. **绑定域名**：Netlify → Domain management → Add a domain，按提示修改 DNS，HTTPS 自动开通。把 `APP_URL` 改成正式域名后重新部署。
7. 登录后台 → **设置**：填收款银行、户名、账号、DuitNow ID，上传 DuitNow 收款码 → **活动**：发布活动、上传海报。
8. 用手机完整走一遍：注册 → 申请卖家 → 挂票 → 另一个账号买票 → 上传截图 → 后台确认收款 → 转票 → 确认 → 评价。

### 分支说明

- `main` = 正式网站。推送到 `main` 会触发 Netlify 正式部署（并迁移数据库）。
- 其他分支 / Pull Request = Netlify 预览网址，**不会**迁移数据库。想让预览有独立数据，可再开一个免费的 Supabase 项目给预览用。
- Netlify 免费额度按 credits 计算，正式部署也会消耗额度，建议功能做好、测试通过后再合并到 `main`。

### 免费方案的注意事项

- Supabase 免费版**不含自动备份**。建议每周在 Supabase 后台导出一次，或有收入后升级 Pro（约 US$25 / 月，含每日备份）。
- Netlify 函数单次请求上限约 6 MB：网站在浏览器里先压缩照片再上传，正常使用不会超出。
- 流量变大后，可以把网站换到 VPS（方案 B），代码不用改。

## 上线方案 B：一台 VPS

整套服务（网站 + 数据库 + 自动 HTTPS + 定时任务 + 每日备份）用 `docker compose` 跑在一台 VPS 上（约 RM20–45 / 月）。文件默认存在数据库里；也可以同时填 `SUPABASE_URL` 用 Supabase 存储。

```sh
git clone https://github.com/Christopher0607/Ticketing-Service.git && cd Ticketing-Service
cp .env.production.example .env.production   # 填 DOMAIN、APP_URL、POSTGRES_PASSWORD、JOB_SECRET 等
docker compose --env-file .env.production up -d --build
docker compose --env-file .env.production run --rm app node scripts/database.mjs admin
```

数据库每天备份到 `./backups`（保留 14 天）。更新：`git pull && docker compose --env-file .env.production up -d --build`。

## 上线前清单

- [ ] **律师审核**服务条款、隐私政策、退款政策（`/legal/terms`、`/legal/privacy`、`/legal/refunds`，文字在 [`content/legal.ts`](content/legal.ts)）。审核后设置 `LEGAL_REVIEWED=true` 去掉“草稿”提示。
- [ ] PDPA 第 7(3) 条要求隐私通知同时提供**马来文和英文**版本，请律师一并准备马来文版。
- [ ] 填写 `COMPANY_NAME`、`COMPANY_REG_NO`、`COMPANY_ADDRESS`（显示在页脚和法律文件里）。
- [ ] 开好公司银行户口，填进后台收款信息；每月用后台“导出对账”CSV 核对流水。人工收款模式下，钱先进公司户口再转给卖家，规模大了请咨询会计 / 律师关于代收款的合规要求。
- [ ] 只上架允许转让的活动（实名制票要特别注意），发布活动时填写官方转让政策链接。必要时在后台设置“最高加价”。
- [ ] 配置 Resend 发件域名（注册验证、找回密码和通知邮件都需要）。
- [ ] 设置 `SUPPORT_WHATSAPP`、`SUPPORT_EMAIL`、`ADMIN_NOTIFY_EMAIL`。

## 本地运行

需要 Node.js 22.13+ 和 PostgreSQL 16+（或 `npm run db:local` 启动嵌入式数据库，需非 root 用户）。

```sh
npm ci
cp .env.example .env.local
npm run db:migrate
npm run db:seed      # 本地示例活动、两个卖家、评价（只在本地 demo 模式可用）
npm run dev
```

打开 http://localhost:3000 。演示账号密码都是 `CrazyMonkey2027!`：`buyer@example.test`、`seller@example.test`、`seller2@example.test`、`admin@example.test`。想体验 DuitNow 流程，把 `PAYMENT_MODE` 改成 `manual`。

## 测试

```sh
npm test && npm run build && npm run typecheck
npx playwright install chromium
STORAGE_MOCK_KEY=test-service-key node tests/support/storage-mock.mjs 54321 &
npm run start &                                   # demo 模式，端口 3000（文件存数据库）
PAYMENT_MODE=manual APP_URL=http://localhost:3002 SUPABASE_URL=http://127.0.0.1:54321 \
  SUPABASE_SERVICE_ROLE_KEY=test-service-key npm run start -- --port 3002 &
EXPECT_REMOTE_STORAGE=true MANUAL_BASE_URL=http://localhost:3002 npm run test:e2e
```

浏览器测试覆盖：抢票并发防超卖、费率快照、转票、确认、退款、结算、预留过期释放、中英切换、筛选排序、卖家主页、结构化数据、法律页面、sitemap、注册同意条款、收藏、资料修改、卖家改价、CSV 导出、停用账户、评价，以及 DuitNow 全流程（Supabase 存储、海报、加价上限、截图隐私、核对 / 拒绝、人工退款与打款）。

## Stripe（暂不启用）

代码保留了 Stripe Connect（信用卡 / FPX，自动给卖家打款）。门票转售属于 Stripe 需要事先审批的类别，开通前请先联系 Stripe 确认。启用方法：`PAYMENT_MODE=stripe`，设置 `STRIPE_SECRET_KEY`、`STRIPE_WEBHOOK_SECRET`、`STRIPE_CONNECT_WEBHOOK_SECRET`；平台 webhook `POST /api/stripe/webhook`，Connect webhook `POST /api/stripe/connect`。

## 技术栈

Next.js 16（App Router、Server Actions）· TypeScript · PostgreSQL（`pg`，SQL 迁移在 `db/`）· Supabase Storage（REST API，无额外依赖）· sharp · Resend · Netlify 或 Docker + Caddy。

示例图片来自 [Unsplash](https://unsplash.com/license)。Manrope 和 Oswald 字体使用 [SIL Open Font License](public/fonts/oswald-OFL.txt)。
