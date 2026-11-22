import { createHash, randomBytes } from "node:crypto";
import { appUrl } from "./config";
import { query, tx } from "./db";
import { ActionError } from "./orders";
import { passwordHash } from "./auth";

type Purpose = "verify" | "reset";
const digest = (token: string) => createHash("sha256").update(token).digest("hex");
const format = /^[a-f0-9]{64}$/;
export const mailConfigured = () => Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);

export async function sendAccountLink(user: { id: string; email: string }, purpose: Purpose) {
  if (!mailConfigured()) throw new ActionError("err.emailUnavailable");
  const token = randomBytes(32).toString("hex");
  const hashed = digest(token);
  await query(`INSERT INTO email_tokens (token_hash,user_id,purpose,expires_at)
    VALUES ($1,$2,$3,now()+interval '30 minutes')`, [hashed, user.id, purpose]);
  const reset = purpose === "reset";
  const link = `${appUrl()}/account/${purpose}?token=${token}`;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        from: process.env.MAIL_FROM, to: [user.email],
        subject: reset ? "Crazy Monkey 票务 · 重设密码 / Reset your password" : "Crazy Monkey 票务 · 验证邮箱 / Verify your email",
        text: reset
          ? `请用以下链接重设密码（30 分钟内有效）：\nReset your password using this link (expires in 30 minutes):\n\n${link}`
          : `请用以下链接验证邮箱（30 分钟内有效）：\nVerify your email address using this link (expires in 30 minutes):\n\n${link}`,
      }),
    });
    if (!response.ok) throw new Error(`Account email provider response ${response.status}`);
  } catch (error) {
    await query("DELETE FROM email_tokens WHERE token_hash=$1", [hashed]);
    throw error;
  }
}

export async function consumeAccountLink(token: string, purpose: Purpose, password?: string) {
  if (!format.test(token)) throw new ActionError("err.linkExpired");
  const hash = password ? passwordHash(password) : null;
  await tx(async (client) => {
    const { rows: [hit] } = await client.query<{ user_id: string }>(
      "SELECT user_id FROM email_tokens WHERE token_hash=$1 AND purpose=$2 AND expires_at>now()", [digest(token), purpose]);
    if (!hit) throw new ActionError("err.linkExpired");
    await client.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [hit.user_id]);
    const { rowCount } = await client.query("DELETE FROM email_tokens WHERE token_hash=$1 AND user_id=$2 AND expires_at>now()", [digest(token), hit.user_id]);
    if (!rowCount) throw new ActionError("err.linkExpired");
    if (purpose === "verify") {
      await client.query("UPDATE users SET email_verified=true WHERE id=$1", [hit.user_id]);
    } else {
      await client.query("UPDATE users SET password_hash=$2 WHERE id=$1", [hit.user_id, hash]);
      await client.query("DELETE FROM sessions WHERE user_id=$1", [hit.user_id]);
    }
    await client.query("DELETE FROM email_tokens WHERE user_id=$1 AND purpose=$2", [hit.user_id, purpose]);
  });
}
