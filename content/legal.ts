// Draft legal documents for review by the company's lawyer before launch.
// English is the governing version; the Chinese text is a translation.
// Placeholders: {company} {regNo} {address} {email} {site} {buyerFee} {sellerFee}
// Body lines starting with "- " render as bullet points.

export type LegalSection = { id: string; heading: string; body: string[] };
export type LegalDoc = { title: string; summary: string; sections: LegalSection[] };
export const legalSlugs = ["terms", "privacy", "refunds"] as const;
export type LegalSlug = (typeof legalSlugs)[number];
export const legalUpdated = "2026-11-22";

const en: Record<LegalSlug, LegalDoc> = {
  terms: {
    title: "Terms of Service",
    summary: "These terms govern your use of Crazy Monkey Tickets, a marketplace where fans buy and resell live event tickets with payment protection.",
    sections: [
      { id: "about", heading: "1. About us and these terms", body: [
        "Crazy Monkey Tickets (the \"Platform\") is operated by {company} (Company No. {regNo}), {address} (\"we\", \"us\", \"our\"). The Platform is available at {site}.",
        "By creating an account, listing, buying or otherwise using the Platform, you agree to these Terms of Service, our Privacy Policy and our Refund & Buyer Guarantee Policy (together, the \"Terms\"). If you do not agree, do not use the Platform.",
        "You must be at least 18 years old, or use the Platform with the consent and supervision of a parent or legal guardian.",
      ] },
      { id: "role", heading: "2. Our role", body: [
        "The Platform is a marketplace. Tickets are listed and sold by independent sellers (\"Sellers\") to buyers (\"Buyers\"). We are not the event organiser, promoter, venue or original ticket issuer, and we do not own the tickets listed.",
        "Sellers set their own prices. We do not buy tickets to resell them and we do not profit from the difference between face value and resale price. We earn only the service fees described in section 4.",
        "We review sellers and listings, hold Buyers' payments and release them to Sellers only when the conditions in these Terms are met (\"Payment Protection\"). Reviewing a listing does not mean we guarantee that an organiser will honour a ticket; entry to an event is subject to the organiser's and venue's own terms.",
      ] },
      { id: "accounts", heading: "3. Your account", body: [
        "You must give accurate information, keep it up to date and keep your password secure. You are responsible for activity on your account. Tell us immediately if you suspect unauthorised use.",
        "Each person may hold one account. We may suspend or close accounts that breach these Terms, provide false information, are involved in fraud or chargebacks, or put other users at risk.",
      ] },
      { id: "fees", heading: "4. Prices and service fees", body: [
        "The price shown on a listing includes the buyer service fee. Before you pay, the order page shows the ticket subtotal, the buyer service fee and the total.",
        "- Buyer service fee: currently {buyerFee} of the ticket price.",
        "- Seller service fee: currently {sellerFee} of the ticket price, deducted from the Seller's proceeds.",
        "We may change our fees for future orders. The rates applied to each order are fixed when the order is created. Fees include any applicable taxes unless stated otherwise.",
      ] },
      { id: "buying", heading: "5. Buying tickets", body: [
        "When you select tickets, they are reserved for you for a limited time (currently 45 minutes). If payment is not completed or the receipt is not uploaded in time, the reservation ends and the tickets return to sale.",
        "For bank transfer or DuitNow payments, you must transfer the exact total to the account shown on your order page and upload a clear receipt. Your order is confirmed only after we verify that the funds were received. We may reject a payment we cannot verify; if funds were received, they will be returned to you.",
        "Your payment is held by us under Payment Protection. It is not released to the Seller until (a) you confirm that you received the tickets, or our support team verifies the transfer, and (b) 24 hours have passed after the event's start time.",
        "You must give a correct email address for ticket transfers, accept the official transfer promptly and check the tickets with the original provider. Report any problem through your order page before the event starts or within 24 hours after it starts. If you do not report a problem within that time, the transfer is treated as accepted.",
        "You must not ask a Seller to complete a sale outside the Platform. Off-platform payments are not covered by Payment Protection.",
      ] },
      { id: "selling", heading: "6. Selling tickets", body: [
        "To sell, you must apply for a seller account, verify your email, provide a WhatsApp number and a payout account in your own name or your business's name, and be approved by us.",
        "When you list tickets you confirm that:",
        "- you own the tickets or are authorised to sell and transfer them;",
        "- the event's official terms allow the tickets to be resold and transferred in the way you describe;",
        "- the section, quantity, face value and other details are accurate, and you can provide proof of purchase on request;",
        "- the same tickets are not sold elsewhere while listed on the Platform; if they are, you will remove the listing immediately.",
        "Your resale price must not exceed any price limit set by us, the organiser or applicable law. We may require the face value to be shown to Buyers.",
        "After a Buyer's payment is verified, you must transfer the tickets through the official channel as soon as possible and no later than 48 hours after payment or before the event starts, whichever is earlier, and record the transfer reference on the order page.",
        "We pay your proceeds (ticket price minus the seller service fee) to your payout account after the conditions in section 5 are met. Bank processing times may apply. We may withhold payouts while a dispute, refund request or investigation is open.",
        "If you fail to deliver, deliver invalid or misdescribed tickets, or the Buyer is refused entry because of the tickets you supplied, we may refund the Buyer, cancel your proceeds, recover any amount already paid to you, and suspend your account. You are responsible for your own taxes on sales.",
      ] },
      { id: "prohibited", heading: "7. Prohibited conduct", body: [
        "You must not:",
        "- list counterfeit, stolen, duplicated, speculative or otherwise invalid tickets;",
        "- list tickets for events whose terms prohibit resale or transfer, or in breach of any law;",
        "- use bots, scripts or automated tools to access, scrape or purchase on the Platform;",
        "- harass other users, misuse their personal data or contact them for purposes other than completing an order;",
        "- interfere with the Platform's security or operation, or attempt to avoid our fees.",
      ] },
      { id: "cancellations", heading: "8. Event cancellation and changes", body: [
        "If an event is cancelled and not rescheduled, Buyers are entitled to a refund under our Refund & Buyer Guarantee Policy. If proceeds were already released, the Seller must return them to us.",
        "If an event is postponed, rescheduled or relocated and the tickets remain valid, the order stands. Any refund offered by the organiser for such changes is handled according to the organiser's terms and our Refund Policy.",
      ] },
      { id: "disputes", heading: "9. Disputes between users", body: [
        "If something goes wrong with an order, contact us through the order page, WhatsApp or email. We may ask both parties for evidence such as screenshots, transfer confirmations or correspondence with the organiser, and we will decide how held funds are applied based on the evidence available.",
        "Our decision about held funds does not limit any rights you have under law.",
      ] },
      { id: "liability", heading: "10. Liability", body: [
        "Nothing in these Terms excludes or limits any right you have under the Consumer Protection Act 1999 or other law that cannot be excluded or limited.",
        "Subject to that, we are not liable for the acts or omissions of event organisers, venues or original ticket providers, or for indirect or consequential loss. To the extent permitted by law, our total liability for any order is limited to the total amount you paid for that order.",
        "You agree to compensate us for losses caused by your breach of these Terms or by your misuse of the Platform.",
      ] },
      { id: "general", heading: "11. General", body: [
        "We may update these Terms. We will give notice of material changes on the Platform or by email. Changes apply to orders placed after they take effect.",
        "These Terms are governed by the laws of Malaysia, and the courts of Malaysia have jurisdiction. Consumers may also bring claims before the Tribunal for Consumer Claims Malaysia.",
        "These Terms are provided in English and Chinese. If there is any inconsistency, the English version prevails.",
        "Contact: {email}.",
      ] },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    summary: "How we collect, use, disclose and protect your personal data in accordance with the Personal Data Protection Act 2010 (PDPA) of Malaysia.",
    sections: [
      { id: "who", heading: "1. Who we are", body: [
        "{company} (Company No. {regNo}), {address}, operates Crazy Monkey Tickets and is the data user responsible for your personal data. Our Data Protection Officer can be reached at {email}.",
      ] },
      { id: "collect", heading: "2. Personal data we collect", body: [
        "- Account details: name, email address and an encrypted (hashed) password.",
        "- Seller details: WhatsApp number and payout account details (bank or e-wallet, account holder name and account number or DuitNow ID).",
        "- Order details: tickets bought or sold, prices, transfer emails and references, refund account details and order history.",
        "- Payment evidence: transfer receipts you upload, which may show your name, bank and partial account details, and payment references from processors.",
        "- Ticket documents: proof of purchase uploaded by Sellers (we ask Sellers to remove barcodes and personal details first).",
        "- Communications with us and between users that are connected to an order.",
        "- Technical data: IP address (used for security and rate limiting) and essential cookies for signing in and remembering your language. We do not use advertising cookies.",
      ] },
      { id: "use", heading: "3. Why we use your data", body: [
        "- To create and manage your account and to provide the marketplace.",
        "- To process orders, verify payments, hold funds, pay Sellers and handle refunds.",
        "- To let Sellers transfer tickets to Buyers and to show Sellers' public profiles and reviews.",
        "- To send service messages about your orders, account and security.",
        "- To prevent and investigate fraud, misuse and breaches of our Terms.",
        "- To comply with legal, tax and accounting obligations and requests from authorities.",
        "- To improve the Platform. We will only send marketing messages with your consent, and you can withdraw consent at any time.",
      ] },
      { id: "share", heading: "4. Who we share it with", body: [
        "- The other party to your order: we share the Buyer's name and transfer email with the Seller so the tickets can be transferred, and show the Seller's display name and reviews to Buyers.",
        "- Service providers acting for us, such as hosting and database providers (for example Supabase and Netlify), email delivery (Resend) and, where enabled, payment processors (Stripe).",
        "- Banks and payment providers to process payments, payouts and refunds.",
        "- Professional advisers, auditors, and law enforcement, regulators or courts where required or permitted by law.",
        "- A buyer or successor if our business is reorganised or sold, subject to this policy.",
        "We do not sell your personal data.",
      ] },
      { id: "transfer", heading: "5. Transfers outside Malaysia", body: [
        "Our service providers may store or process data outside Malaysia, for example in Singapore or the United States. Where we transfer data abroad we take the steps required by the PDPA to ensure it is protected to a comparable standard.",
      ] },
      { id: "retention", heading: "6. How long we keep it", body: [
        "We keep personal data only as long as needed for the purposes above. Transaction and accounting records are generally kept for 7 years to meet tax and legal requirements. Payment receipts and proof documents may be kept for the same period for audit and dispute purposes, and deleted when no longer needed.",
      ] },
      { id: "security", heading: "7. Security", body: [
        "We use encryption in transit, hashed passwords, access controls and private storage for receipts and documents. No system is completely secure. If a personal data breach occurs, we will notify the Personal Data Protection Commissioner and affected individuals as required by law.",
      ] },
      { id: "rights", heading: "8. Your rights", body: [
        "Subject to the PDPA, you may request access to and correction of your personal data, withdraw consent, ask us to limit processing, request data portability where applicable, and ask us to stop direct marketing. Contact {email}. We will respond within the time required by law and may need to verify your identity.",
        "If you do not provide certain data (for example a transfer email or payout account) we may not be able to complete orders or pay you.",
      ] },
      { id: "children", heading: "9. Minors", body: [
        "The Platform is intended for users aged 18 and above. Minors may use it only with the consent of a parent or guardian, who is responsible for the minor's use.",
      ] },
      { id: "changes", heading: "10. Changes and language", body: [
        "We may update this policy and will post the updated version on the Platform with a new date.",
        "This policy is provided in English and Chinese. If there is any inconsistency, the English version prevails.",
      ] },
    ],
  },
  refunds: {
    title: "Refund & Buyer Guarantee Policy",
    summary: "Your payment is held by Crazy Monkey until you receive your tickets. This policy explains when you get your money back and how to ask for it.",
    sections: [
      { id: "guarantee", heading: "1. Payment Protection", body: [
        "Every order on the Platform is covered by Payment Protection. We hold your payment and only release it to the Seller after you confirm receipt (or our support verifies the transfer) and 24 hours have passed since the event started.",
      ] },
      { id: "eligible", heading: "2. When you get a full refund", body: [
        "You receive a full refund of the ticket price and the buyer service fee if:",
        "- the Seller does not transfer the tickets within 48 hours of payment verification or before the event starts, whichever is earlier;",
        "- the tickets you receive are invalid, duplicated or materially different from the listing (for example a different section or quantity), and you report it with evidence before the event starts or within 24 hours after it starts;",
        "- you are refused entry because the tickets supplied by the Seller were invalid, and you provide reasonable evidence;",
        "- the event is cancelled and not rescheduled.",
      ] },
      { id: "not-eligible", heading: "3. When refunds are not available", body: [
        "- You change your mind or can no longer attend after your payment has been verified (you may ask the Seller to agree to a cancellation through us).",
        "- The event is postponed, rescheduled or moved and the tickets remain valid, unless the organiser offers a refund that can be passed on to you.",
        "- You are refused entry for reasons unrelated to the tickets, such as age limits, conduct, late arrival, or identity requirements that were stated on the listing or the event's transfer policy.",
        "- You report a problem after the deadlines in section 2, or you have already confirmed receipt and the event has passed.",
      ] },
      { id: "how", heading: "4. How to ask for a refund", body: [
        "Open your order and choose \"Request a refund\". Tell us what happened and, for bank transfer payments, the bank account or DuitNow ID where the refund should be sent. You can also contact us on WhatsApp or by email.",
        "We aim to review requests within 3 business days and may ask for evidence. Approved refunds for bank transfer payments are sent within 7 business days to the account you provide; card payments are refunded to the original card, and your bank's processing time applies.",
      ] },
      { id: "payments", heading: "5. Payments not verified and expired reservations", body: [
        "If we cannot verify a bank transfer, we will reject the payment and release the tickets. If your money did reach our account, contact us and we will return it in full.",
        "If your reservation expires before payment, no charge is made. If you paid after the reservation expired, contact us for a full return of the amount received.",
      ] },
      { id: "sellers", heading: "6. Seller cancellations", body: [
        "If a Seller cannot deliver, the Buyer is refunded in full. We may recover amounts from the Seller and restrict the Seller's account under our Terms of Service.",
      ] },
      { id: "contact", heading: "7. Contact", body: [
        "Questions about a refund: {email}. This policy does not affect your statutory rights under Malaysian law. If there is any inconsistency between language versions, the English version prevails.",
      ] },
    ],
  },
};

const zh: Record<LegalSlug, LegalDoc> = {
  terms: {
    title: "服务条款",
    summary: "本条款适用于你使用 Crazy Monkey 票务——一个提供付款保障、让粉丝买卖和转让现场活动门票的平台。",
    sections: [
      { id: "about", heading: "1. 关于我们与本条款", body: [
        "Crazy Monkey 票务（“平台”）由 {company}（公司注册号 {regNo}，地址：{address}）经营（“我们”）。平台网址为 {site}。",
        "注册账户、挂单、购票或以其他方式使用平台，即表示你同意本服务条款、《隐私政策》及《退款与买家保障政策》（合称“条款”）。如不同意，请勿使用平台。",
        "你必须年满 18 岁，或在父母/法定监护人同意和监督下使用平台。",
      ] },
      { id: "role", heading: "2. 我们的角色", body: [
        "平台是一个交易市场。门票由独立卖家（“卖家”）挂出并出售给买家（“买家”）。我们不是活动主办方、推广商、场馆或原始票务发行方，也不拥有平台上挂出的门票。",
        "售价由卖家自行决定。我们不会买票再转卖，也不从票面价与转售价之间的差价获利。我们只收取第 4 条所述的服务费。",
        "我们会审核卖家和挂单，代为保管买家付款，并只在符合本条款的条件时才放款给卖家（“付款保障”）。挂单经审核不代表我们保证主办方一定承认该门票；入场须遵守主办方和场馆的规定。",
      ] },
      { id: "accounts", heading: "3. 你的账户", body: [
        "你必须提供准确资料并及时更新，并妥善保管密码。你须为账户内的所有活动负责。如怀疑账户被盗用，请立即通知我们。",
        "每人只可持有一个账户。对于违反本条款、提供虚假资料、涉及欺诈或拒付、或危害其他用户的账户，我们可暂停或关闭。",
      ] },
      { id: "fees", heading: "4. 价格与服务费", body: [
        "挂单显示的价格已包含买家服务费。付款前，订单页会列出票价小计、买家服务费和总额。",
        "- 买家服务费：目前为票价的 {buyerFee}。",
        "- 卖家服务费：目前为票价的 {sellerFee}，从卖家收入中扣除。",
        "我们可调整未来订单的费率。每张订单适用的费率在下单时即固定。除非另有说明，服务费已包含适用税项。",
      ] },
      { id: "buying", heading: "5. 购票", body: [
        "选择门票后，门票会为你保留一段时间（目前为 45 分钟）。如未在时限内完成付款或上传付款截图，保留将结束，门票重新上架。",
        "使用银行转账或 DuitNow 付款时，你必须把准确总额转入订单页显示的账户，并上传清晰的付款截图。我们核实款项到账后订单才算确认。无法核实的付款我们可拒绝；如款项已到账，将退还给你。",
        "你的付款由我们在付款保障下代为保管，须同时满足以下条件才会放款给卖家：(a) 你确认已收到门票，或客服核实已完成转票；以及 (b) 活动开始时间已过 24 小时。",
        "你必须提供正确的转票邮箱，及时接收官方转票，并在原票务平台核对门票。如有问题，须在活动开始前或活动开始后 24 小时内通过订单页报告。逾期未报告，视为已接受转票。",
        "你不得要求卖家在平台以外完成交易。平台以外的付款不受付款保障。",
      ] },
      { id: "selling", heading: "6. 卖票", body: [
        "如要卖票，你必须申请卖家账户、验证邮箱、提供 WhatsApp 号码和以本人或本人公司名义开立的收款账户，并经我们批准。",
        "挂单即表示你确认：",
        "- 你拥有该门票，或已获授权出售和转让；",
        "- 活动的官方条款允许按你所述方式转售和转让该门票；",
        "- 票区、数量、票面价及其他资料准确无误，并可应要求提供购票证明；",
        "- 挂单期间不会在其他地方出售同一批门票；如已售出，须立即下架。",
        "转售价不得超过我们、主办方或适用法律设定的价格上限。我们可要求向买家显示票面价。",
        "买家付款经核实后，你必须尽快通过官方渠道转票，最迟在付款后 48 小时内或活动开始前（以较早者为准）完成，并在订单页登记转票编号。",
        "满足第 5 条的条件后，我们会把你的收入（票价减去卖家服务费）转入你的收款账户，银行处理时间另计。如有争议、退款申请或调查尚未结束，我们可暂缓放款。",
        "如你未能转票、转出的门票无效或与描述不符，或买家因你提供的门票被拒入场，我们可向买家退款、取消你的收入、追回已付给你的款项，并暂停你的账户。销售所得的税务由你自行负责。",
      ] },
      { id: "prohibited", heading: "7. 禁止行为", body: [
        "你不得：",
        "- 挂出伪造、盗窃、重复、尚未到手或其他无效的门票；",
        "- 挂出主办方条款禁止转售或转让的门票，或违反任何法律；",
        "- 使用机器人、脚本或自动化工具访问、抓取平台或在平台购票；",
        "- 骚扰其他用户、滥用他人个人资料，或为完成订单以外的目的联系他人；",
        "- 干扰平台的安全或运作，或试图规避我们的服务费。",
      ] },
      { id: "cancellations", heading: "8. 活动取消与变更", body: [
        "如活动取消且不再改期，买家可按《退款与买家保障政策》获得退款。如款项已放给卖家，卖家须退还给我们。",
        "如活动延期、改期或更换场地而门票仍然有效，订单继续有效。主办方就该等变更提供的退款，按主办方规定和我们的退款政策处理。",
      ] },
      { id: "disputes", heading: "9. 用户之间的争议", body: [
        "订单出现问题时，请通过订单页、WhatsApp 或邮件联系我们。我们可要求双方提供截图、转票确认或与主办方的往来记录等证据，并根据现有证据决定代管款项的处理方式。",
        "我们对代管款项的决定不影响你依法享有的任何权利。",
      ] },
      { id: "liability", heading: "10. 责任", body: [
        "本条款不排除或限制你根据《1999 年消费者保护法》或其他法律享有且不可排除或限制的任何权利。",
        "在此前提下，我们不对活动主办方、场馆或原票务平台的作为或不作为负责，也不对间接或后果性损失负责。在法律允许的范围内，我们就任何订单的总责任以你为该订单支付的总额为上限。",
        "如因你违反本条款或滥用平台而使我们蒙受损失，你同意作出赔偿。",
      ] },
      { id: "general", heading: "11. 一般条款", body: [
        "我们可更新本条款，重大变更会在平台或通过邮件通知。变更适用于生效后下的订单。",
        "本条款受马来西亚法律管辖，马来西亚法院具有管辖权。消费者亦可向马来西亚消费者索偿审裁庭提出索偿。",
        "本条款提供英文和中文版本，如有任何不一致，以英文版本为准。",
        "联系方式：{email}。",
      ] },
    ],
  },
  privacy: {
    title: "隐私政策",
    summary: "我们如何依照马来西亚《2010 年个人资料保护法》（PDPA）收集、使用、披露和保护你的个人资料。",
    sections: [
      { id: "who", heading: "1. 我们是谁", body: [
        "{company}（公司注册号 {regNo}，地址：{address}）经营 Crazy Monkey 票务，是负责处理你个人资料的资料使用者。我们的资料保护官联系方式：{email}。",
      ] },
      { id: "collect", heading: "2. 我们收集的个人资料", body: [
        "- 账户资料：姓名、邮箱及加密（哈希）后的密码。",
        "- 卖家资料：WhatsApp 号码及收款账户资料（银行或电子钱包、户名、账号或 DuitNow ID）。",
        "- 订单资料：买卖的门票、价格、转票邮箱和编号、退款账户及订单记录。",
        "- 付款凭证：你上传的转账截图（可能显示你的姓名、银行和部分账号），以及支付机构提供的付款编号。",
        "- 门票文件：卖家上传的购票证明（我们要求卖家先遮住条码和个人资料）。",
        "- 你与我们之间、以及用户之间与订单相关的通讯。",
        "- 技术资料：IP 地址（用于安全和防止滥用）以及登录和记住语言所需的必要 Cookie。我们不使用广告 Cookie。",
      ] },
      { id: "use", heading: "3. 我们使用资料的目的", body: [
        "- 建立和管理你的账户，提供交易平台服务。",
        "- 处理订单、核实付款、代管款项、向卖家付款及处理退款。",
        "- 让卖家把门票转给买家，并展示卖家的公开资料和评价。",
        "- 发送与订单、账户和安全相关的服务通知。",
        "- 预防和调查欺诈、滥用及违反条款的行为。",
        "- 遵守法律、税务和会计义务以及有关当局的要求。",
        "- 改善平台。只有在你同意的情况下我们才会发送营销信息，你可随时撤回同意。",
      ] },
      { id: "share", heading: "4. 我们与谁分享资料", body: [
        "- 订单的另一方：为了转票，我们会把买家的姓名和转票邮箱提供给卖家，并向买家展示卖家的显示名称和评价。",
        "- 代表我们提供服务的服务商，例如主机和数据库服务商（如 Supabase、Netlify）、邮件发送服务（Resend），以及启用时的支付机构（Stripe）。",
        "- 处理付款、打款和退款的银行和支付服务商。",
        "- 专业顾问、审计师，以及法律要求或允许时的执法机构、监管机构或法院。",
        "- 如业务重组或出售，在本政策约束下的买方或继承方。",
        "我们不会出售你的个人资料。",
      ] },
      { id: "transfer", heading: "5. 资料转移至马来西亚境外", body: [
        "我们的服务商可能在马来西亚境外（例如新加坡或美国）储存或处理资料。将资料转移至境外时，我们会按 PDPA 的要求采取措施，确保资料获得相当程度的保护。",
      ] },
      { id: "retention", heading: "6. 资料保存期限", body: [
        "我们只在实现上述目的所需的期间内保存个人资料。交易和会计记录一般保存 7 年，以符合税务和法律要求。付款截图和证明文件可为审计和处理争议保存相同期间，不再需要时即删除。",
      ] },
      { id: "security", heading: "7. 安全", body: [
        "我们采用传输加密、密码哈希、访问控制，并以私有存储保管付款截图和文件。任何系统都无法做到绝对安全。如发生个人资料泄露，我们会依法通知个人资料保护专员和受影响人士。",
      ] },
      { id: "rights", heading: "8. 你的权利", body: [
        "在 PDPA 规定下，你可要求查阅和更正你的个人资料、撤回同意、要求限制处理、在适用情况下要求资料可携，以及要求停止直销。请联系 {email}。我们会在法律规定的时限内回复，并可能需要核实你的身份。",
        "如你不提供某些资料（例如转票邮箱或收款账户），我们可能无法完成订单或向你付款。",
      ] },
      { id: "children", heading: "9. 未成年人", body: [
        "平台面向 18 岁及以上用户。未成年人须经父母或监护人同意方可使用，并由其对未成年人的使用负责。",
      ] },
      { id: "changes", heading: "10. 变更与语言", body: [
        "我们可更新本政策，并会在平台上发布注明新日期的更新版本。",
        "本政策提供英文和中文版本，如有任何不一致，以英文版本为准。",
      ] },
    ],
  },
  refunds: {
    title: "退款与买家保障政策",
    summary: "你收到门票之前，付款由 Crazy Monkey 代为保管。本政策说明什么情况下可以退款，以及如何申请。",
    sections: [
      { id: "guarantee", heading: "1. 付款保障", body: [
        "平台上的每张订单都受付款保障。我们代为保管你的付款，只有在你确认收到门票（或客服核实已转票）且活动开始满 24 小时后，才会放款给卖家。",
      ] },
      { id: "eligible", heading: "2. 可获全额退款的情况", body: [
        "符合以下任一情况，你可获退还票价及买家服务费：",
        "- 卖家未在付款核实后 48 小时内或活动开始前（以较早者为准）转票；",
        "- 你收到的门票无效、重复，或与挂单描述有重大不符（例如票区或数量不同），并在活动开始前或开始后 24 小时内附证据报告；",
        "- 你因卖家提供的门票无效而被拒入场，并提供合理证据；",
        "- 活动取消且不再改期。",
      ] },
      { id: "not-eligible", heading: "3. 不可退款的情况", body: [
        "- 付款经核实后，你改变主意或无法出席（你可以通过我们询问卖家是否同意取消）。",
        "- 活动延期、改期或更换场地而门票仍然有效，除非主办方提供可转交给你的退款。",
        "- 你因与门票无关的原因被拒入场，例如年龄限制、个人行为、迟到，或挂单及活动转让政策中已说明的身份要求。",
        "- 你在第 2 条的期限之后才报告问题，或已确认收到门票且活动已结束。",
      ] },
      { id: "how", heading: "4. 如何申请退款", body: [
        "打开订单并点选“申请退款”，说明情况；如使用银行转账付款，请填写接收退款的银行账户或 DuitNow ID。你也可以通过 WhatsApp 或邮件联系我们。",
        "我们力求在 3 个工作日内审核申请，并可能要求提供证据。银行转账付款经批准后，退款会在 7 个工作日内转入你提供的账户；信用卡付款会退回原卡，银行处理时间另计。",
      ] },
      { id: "payments", heading: "5. 付款未通过核对及保留过期", body: [
        "如我们无法核实你的银行转账，会拒绝该付款并释放门票。如款项确实已转入我们的账户，请联系我们，我们会全额退还。",
        "如保留在付款前过期，不会收取任何费用。如你在保留过期后才付款，请联系我们全额退还所收款项。",
      ] },
      { id: "sellers", heading: "6. 卖家取消", body: [
        "如卖家无法转票，买家可获全额退款。我们可依据服务条款向卖家追讨款项并限制其账户。",
      ] },
      { id: "contact", heading: "7. 联系我们", body: [
        "退款相关问题请联系：{email}。本政策不影响你根据马来西亚法律享有的法定权利。各语言版本如有任何不一致，以英文版本为准。",
      ] },
    ],
  },
};

export const legalDocs = { en, zh };
