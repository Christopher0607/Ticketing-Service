# Crazy Monkey 票务 · Ticketing Service

马来西亚粉丝之间的**门票转让平台**。持票人（不一定是主办方）把手上的票挂出来，自己定价；平台不赚差价，只向买卖双方收透明服务费（默认买家 3% + 卖家 3%，后台随时可调，每张订单会记录下单当时的费率）。

> 同公司的 [crazy-monkey](https://github.com/Christopher0607/crazy-monkey) 项目是**演唱会团购**（开票前收定金、帮抢票）。这里是**二手转让市场**。两边共用黑金品牌，设置 `GROUPBUY_URL` 后网站导航会链接到团购站。

## 核心功能

| | |
| --- | --- |
| 托管付款 | 买家付款给平台 → 卖家官方转票 → 买家确认收到 → 活动开始 24 小时后才结算给卖家；出问题可退款 |
| 三种付款方式 | `manual`：DuitNow QR / 银行转账 + 上传付款截图，后台人工核对（零手续费，建议先用这个上线）<br>`stripe`：信用卡 / FPX，Stripe Connect 自动打款（需 Stripe 批准）<br>`demo`：本地演示 |
| 防超卖 | 下单即锁票 45 分钟（PostgreSQL 行锁），超时自动释放 |
| 原价透明 | 卖家必须填写票面原价，买家看到“原价 RM168 · 比原价 +12.5%”；后台可设最高加价（例如 0% = 只能原价卖），为马来西亚可能出台的反黄牛法预留 |
| 人工审核 | 卖家申请（含 WhatsApp 号码）、挂单购票证明、付款截图都由管理员审核 |
| 活动海报 | 后台上传海报，自动压缩为 WebP 存进数据库，带长期缓存（不需要另买存储） |
| 中英双语 | 按浏览器语言自动选择，右上角一键切换 |
| 手机体验 | 底部导航栏，可“添加到主屏幕”当 App 用（PWA），不用上架 App Store |
| 管理后台 | 成交额 / 佣金统计、待核对付款、待结算、退款申请、卖家申请、挂单审核、活动管理、费率和收款信息设置 |

## 本地运行

需要 Node.js 22.13+ 和 PostgreSQL 16+（也可以用自带的嵌入式数据库，需非 root 用户）。

```sh
npm ci
cp .env.example .env.local
npm run db:local        # 可选：启动嵌入式 PostgreSQL（端口 5442）
```

另开一个终端：

```sh
npm run db:migrate
npm run db:seed
npm run dev
```

打开 http://localhost:3000 。演示账号密码都是 `CrazyMonkey2027!`（仅本地 seed 会创建）：

| 角色 | 邮箱 |
| --- | --- |
| 买家 | `buyer@example.test` |
| 卖家 | `seller@example.test` |
| 管理员 | `admin@example.test` |

想体验 DuitNow 人工付款流程，把 `.env.local` 里的 `PAYMENT_MODE` 改成 `manual` 再启动。

## 测试

```sh
npm test                 # 单元测试（费率、日期、翻译完整性）
npm run typecheck
npm run build
npx playwright install chromium
npm run start &          # demo 模式，端口 3000
PAYMENT_MODE=manual npm run start -- --port 3002 &
MANUAL_BASE_URL=http://localhost:3002 npm run test:e2e
```

浏览器测试覆盖：抢票并发防超卖、费率快照、转票、确认、退款、结算、预留过期释放、中英切换，以及 DuitNow 全流程（海报上传、加价上限、付款截图隐私、核对 / 拒绝、人工退款、人工打款）。请使用专门的本地测试数据库。

## 上线部署（一台 VPS，最省钱）

整套服务（网站 + 数据库 + 自动 HTTPS + 定时任务 + 每日备份）用一个 `docker compose` 跑在一台 VPS 上。

1. **买 VPS**：2 vCPU / 2–4 GB 内存 / Ubuntu 24.04 就够用。选新加坡机房延迟最低。装好 Docker。
2. **买域名**，在域名商（或免费的 Cloudflare DNS）把 `@` 和 `www` 的 A 记录指向 VPS IP。
3. 在服务器上：

   ```sh
   git clone https://github.com/Christopher0607/Ticketing-Service.git && cd Ticketing-Service
   cp .env.production.example .env.production
   nano .env.production     # 填 DOMAIN、APP_URL、POSTGRES_PASSWORD、JOB_SECRET 等
   docker compose --env-file .env.production up -d --build
   # 创建第一个管理员（先在 .env.production 填 ADMIN_EMAIL / ADMIN_PASSWORD，建完后删掉）
   docker compose --env-file .env.production run --rm app node scripts/database.mjs admin
   ```

4. 用管理员登录 → **后台 → 设置**：填收款银行、户名、账号、DuitNow ID，上传 DuitNow 收款码 → **活动** 里发布活动、上传海报。
5. 用手机走一遍：注册 → 申请卖家 → 挂票 → 另一个账号买票 → 上传截图 → 后台确认收款。

Caddy 会自动申请和续期 HTTPS 证书。数据库每天备份到 `./backups`（保留 14 天），请定期复制到别处（例如 Cloudflare R2 免费额度）。更新代码：`git pull && docker compose --env-file .env.production up -d --build`。

### 每月成本估算

| 项目 | 费用 |
| --- | --- |
| VPS（2 vCPU / 4 GB） | 约 RM20–45 / 月 |
| 域名 `.com` | 约 RM50–70 / 年（`.my` 约 RM100+ / 年） |
| HTTPS 证书（Caddy / Let’s Encrypt） | 免费 |
| 邮件 Resend | 免费额度起步 |
| 付款 `manual` 模式 | 无手续费（只有银行本身的费用） |
| 付款 Stripe（卡 / FPX） | 约 3% + RM1 / 笔，以 [Stripe 官网](https://stripe.com/en-my/pricing) 为准 |

合计起步约 **RM25–50 / 月**。和团购站合用同一台 VPS 还能再省。

> 注意：如果用 Stripe，手续费约 3% + RM1 会吃掉一半佣金（买家 3% + 卖家 3% = 6%）。这就是建议先用 `manual` 上线的原因，等量起来再加 Stripe。

## 上线前清单

- [ ] **Stripe 审批**：门票转售属于需要审核的高风险类别，开 `stripe` 模式前先联系 Stripe 确认接受你的业务和卖家类型，并在沙盒测试 FPX 付款、退款、卖家开户和转账。
- [ ] **服务条款、隐私政策（PDPA）、退款规则**：写好后把链接填到 `TERMS_URL` / `PRIVACY_URL`。
- [ ] **只上架允许转让的活动**：很多主办方是实名制或禁止加价转售，发布活动时填写官方转让政策链接。马来西亚政府正在研拟反黄牛法，可以先在后台设置“最高加价”。
- [ ] **人工收款资金**：`manual` 模式下钱先进公司账户，再由你转给卖家；建议用独立公司户口并做好对账，规模大了请咨询会计 / 律师关于代收款的合规要求。
- [ ] 配置 Resend 发件域名（注册验证和找回密码需要）。
- [ ] 设置 `SUPPORT_WHATSAPP` 客服号码。

## Stripe 模式说明

1. 设置 `PAYMENT_MODE=stripe`、`STRIPE_SECRET_KEY`、`STRIPE_WEBHOOK_SECRET`。Stripe 开通 FPX 后设 `STRIPE_ENABLE_FPX=true`。
2. 平台 webhook `POST /api/stripe/webhook` 订阅：`payment_intent.succeeded`、`checkout.session.expired`、`checkout.session.async_payment_failed`、`refund.created`、`refund.updated`、`refund.failed`、`charge.dispute.created`、`charge.dispute.closed`。
3. Connect webhook `POST /api/stripe/connect` 订阅 `account.updated`，签名密钥填 `STRIPE_CONNECT_WEBHOOK_SECRET`。卖家完成 Stripe 开户后挂单才可购买。
4. 结算 = 从平台余额转账到卖家的 Connect 账户；结算后的退款、拒付请在 Stripe 后台处理。

本地签名 webhook 回归测试（不访问 Stripe 网络）：

```sh
PAYMENT_MODE=stripe APP_URL=http://localhost:3001 STRIPE_SECRET_KEY=sk_test_fixture STRIPE_WEBHOOK_SECRET=whsec_local_fixture npm run start -- --port 3001
STRIPE_SECRET_KEY=sk_test_fixture STRIPE_WEBHOOK_SECRET=whsec_local_fixture npm run test:webhook
```

## 技术栈

Next.js 16（App Router、Server Actions）· TypeScript · PostgreSQL（`pg`，SQL 迁移在 `db/`）· sharp（图片处理）· Stripe · Resend · Docker + Caddy。没有用 Prisma / Redis / 对象存储，以减少要维护和付费的服务。

示例图片来自 [Unsplash](https://unsplash.com/license)。Manrope 和 Oswald 字体使用 [SIL Open Font License](public/fonts/oswald-OFL.txt)。
