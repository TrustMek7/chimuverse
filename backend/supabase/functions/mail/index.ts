import { createClient } from "npm:@supabase/supabase-js@2.110.0";
import { crypt } from "../calendar/index.ts";
type Data = Record<string, any>;
const env = (k: string): string => {
  const v = Deno.env.get(k);
  if (!v) throw new Error(`Falta configurar ${k}.`);
  return v;
};
const clientId = () => env("GOOGLE_OAUTH_CLIENT_ID");
const clientSecret = () => env("GOOGLE_OAUTH_CLIENT_SECRET");
const admin = () =>
  createClient(
    env("SUPABASE_URL"),
    Deno.env.get("CHIMU_SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );
const callback = () => env("SUPABASE_URL") + "/functions/v1/mail";
const app = () => env("APP_URL").replace(/\/$/, "");
// Send-only permission: the app can never read, list or delete mail.
export const scope = "https://www.googleapis.com/auth/gmail.send";
const b64url = (b: Uint8Array) =>
  btoa(String.fromCharCode(...b)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
const utf8b64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
// Header values are encoded words: no raw line breaks can inject extra headers.
const header = (s: string) => `=?UTF-8?B?${utf8b64(s.replace(/[\r\n]+/g, " "))}?=`;
const address = (s: string) => {
  if (!/^[^\s<>"@,;]+@[^\s<>"@,;]+$/.test(s)) throw new Error("Correo no válido.");
  return s;
};

export type Plan = {
  notification_id: string;
  title: string;
  path: string;
  to: string;
  sender_id: string;
  sender_email: string;
  sender_name?: string;
  token: string;
  self: boolean;
};

/** Builds a raw RFC 2822 message (text and HTML) encoded for the Gmail API. */
export function message(plan: Plan, appUrl: string) {
  const path = plan.path?.startsWith("/") && !plan.path.startsWith("//") ? plan.path : "/";
  const link = appUrl + path;
  const name = (plan.sender_name || "").split(" ")[0];
  const from = plan.self || !name ? "Chimuverse" : `Chimuverse · ${name}`;
  const boundary = "chimu-" + crypto.randomUUID();
  const text = `${plan.title}\n\nÁbrelo en Chimuverse: ${link}\n\nTe llega por correo porque no tienes notificaciones activadas en ningún dispositivo. Actívalas en Chimuverse → Ajustes.`;
  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#FFF8F1;font-family:Arial,Helvetica,sans-serif;color:#241B35">
<div style="max-width:520px;margin:0 auto;padding:28px 20px">
<p style="margin:0 0 6px;font-size:12px;letter-spacing:.12em;color:#4A2BA8;font-weight:bold">CHIMUVERSE ✦</p>
<h1 style="margin:0 0 18px;font-size:22px;line-height:1.3">${escapeHtml(plan.title)}</h1>
<a href="${escapeHtml(link)}" style="display:inline-block;background:#6B45D8;color:#fff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:999px">Abrir en Chimuverse</a>
<p style="margin:26px 0 0;font-size:12px;color:#5E5270">Te llega por correo porque no tienes notificaciones activadas en ningún dispositivo. Puedes activarlas en Chimuverse → Ajustes.</p>
</div></body></html>`;
  const raw = [
    `From: ${header(from)} <${address(plan.sender_email)}>`,
    `To: <${address(plan.to)}>`,
    `Subject: ${header("Chimuverse: " + plan.title)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    utf8b64(text),
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    utf8b64(html),
    `--${boundary}--`,
    "",
  ].join("\r\n");
  return b64url(new TextEncoder().encode(raw));
}

async function accessToken(encrypted: string, fetcher: typeof fetch) {
  const res = await fetcher("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: clientId(),
      client_secret: clientSecret(),
      grant_type: "refresh_token",
      refresh_token: await crypt(encrypted, true),
    }),
    signal: AbortSignal.timeout(15000),
  });
  const t = await res.json().catch(() => ({}));
  if (!res.ok || !t.access_token) throw new Error("Reconecta Gmail para renovar el permiso.");
  return t.access_token as string;
}

type Rpc = (name: string, args: Data) => Promise<any>;
const rpcWith = (db: ReturnType<typeof admin>): Rpc => async (name, args) => {
  const { data, error } = await db.rpc(name, args);
  if (error) throw new Error("No se pudo completar la operación de Gmail.");
  return data;
};

/** Emails one notification when the database plan says so. */
export async function deliver(notificationId: string, rpc: Rpc, fetcher: typeof fetch = fetch) {
  const plan: Plan | null = await rpc("mail_plan", { p_notification: notificationId });
  if (!plan) return { sent: false, skipped: true };
  try {
    const token = await accessToken(plan.token, fetcher);
    const res = await fetcher("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw: message(plan, app()) }),
      signal: AbortSignal.timeout(20000),
    });
    await res.body?.cancel();
    if (!res.ok)
      throw new Error(
        res.status === 401 || res.status === 403
          ? "Reconecta Gmail y acepta el permiso de envío."
          : "Gmail no pudo enviar el aviso.",
      );
    await rpc("mail_delivered", { p_notification: plan.notification_id, p_sender: plan.sender_id, p_status: "sent" });
    await rpc("gmail_service", { p_op: "sent", p_uid: plan.sender_id, p_data: {} });
    return { sent: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gmail no pudo enviar el aviso.";
    await rpc("mail_delivered", { p_notification: plan.notification_id, p_sender: plan.sender_id, p_status: "failed" });
    await rpc("gmail_service", { p_op: "error", p_uid: plan.sender_id, p_data: { message: msg } });
    return { sent: false, error: msg };
  }
}

export async function handler(req: Request, deps?: { rpc?: Rpc; fetcher?: typeof fetch }): Promise<Response> {
  const headers = {
    "Access-Control-Allow-Origin": app(),
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
  const fetcher = deps?.fetcher ?? fetch;
  try {
    if (req.method === "OPTIONS") return new Response(null, { headers });
    const url = new URL(req.url);
    const rpc = deps?.rpc ?? rpcWith(admin());
    if (req.method === "GET") {
      // OAuth callback from Google.
      const state = url.searchParams.get("state");
      if (!state) throw new Error("Falta la autorización.");
      const pending = await rpc("consume_gmail_state", { p_state: state });
      if (!pending) throw new Error("La autorización caducó o ya fue utilizada.");
      if (url.searchParams.has("error"))
        return Response.redirect(app() + "/ajustes/conexiones?gmail=cancelled", 303);
      const code = url.searchParams.get("code");
      if (!code) throw new Error("Falta el código de autorización.");
      const res = await fetcher("https://oauth2.googleapis.com/token", {
        method: "POST",
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: callback(),
          code_verifier: pending.verifier,
          client_id: clientId(),
          client_secret: clientSecret(),
        }),
        signal: AbortSignal.timeout(15000),
      });
      const t = await res.json();
      if (!res.ok || !t.refresh_token || !String(t.scope).split(" ").includes(scope))
        return Response.redirect(app() + "/ajustes/conexiones?gmail=scope", 303);
      const identityRes = await fetcher("https://openidconnect.googleapis.com/v1/userinfo", {
        headers: { Authorization: `Bearer ${t.access_token}` },
        signal: AbortSignal.timeout(15000),
      });
      const identity = await identityRes.json();
      const expected = await admin().auth.admin.getUserById(pending.user_id);
      if (
        !identityRes.ok ||
        !identity.email_verified ||
        !expected.data.user?.email ||
        identity.email?.toLowerCase() !== expected.data.user.email.toLowerCase()
      )
        return Response.redirect(app() + "/ajustes/conexiones?gmail=account", 303);
      await rpc("gmail_service", {
        p_op: "connect",
        p_uid: pending.user_id,
        p_data: { email: identity.email.toLowerCase(), token: await crypt(t.refresh_token) },
      });
      return Response.redirect(app() + "/ajustes/conexiones?gmail=connected", 303);
    }
    if (req.method !== "POST") return new Response(null, { status: 405, headers });
    const body = await req.json();
    const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (body.action === "send") {
      const secret = Deno.env.get("CRON_SECRET");
      if (!secret || secret.length < 32 || bearer !== secret)
        return Response.json({ error: "Sin autorización" }, { status: 401, headers });
      if (typeof body.notification_id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.notification_id))
        return Response.json({ error: "Notificación no válida" }, { status: 400, headers });
      return Response.json(await deliver(body.notification_id, rpc, fetcher), { headers });
    }
    if (req.headers.get("origin") && req.headers.get("origin") !== app())
      return new Response("Origen no autorizado", { status: 403 });
    if (!bearer) return Response.json({ error: "Inicia sesión." }, { status: 401, headers });
    const { data: { user }, error } = await admin().auth.getUser(bearer);
    if (error || !user) return Response.json({ error: "Sesión no válida." }, { status: 401, headers });
    if (body.action === "connect") {
      clientSecret();
      env("GOOGLE_TOKEN_ENCRYPTION_KEY");
      const state = b64url(crypto.getRandomValues(new Uint8Array(48))),
        verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
      const challenge = b64url(
        new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))),
      );
      await rpc("gmail_service", { p_op: "state", p_uid: user.id, p_data: { state, verifier } });
      return Response.json(
        {
          url:
            "https://accounts.google.com/o/oauth2/v2/auth?" +
            new URLSearchParams({
              client_id: clientId(),
              redirect_uri: callback(),
              response_type: "code",
              scope: "openid email " + scope,
              access_type: "offline",
              prompt: "consent",
              login_hint: user.email ?? "",
              state,
              code_challenge: challenge,
              code_challenge_method: "S256",
            }),
        },
        { headers },
      );
    }
    if (body.action === "disconnect") {
      // Only this integration's credential is removed; other Google connections stay intact.
      await rpc("gmail_service", { p_op: "disconnect", p_uid: user.id, p_data: {} });
      return Response.json({ disconnected: true }, { headers });
    }
    return Response.json({ error: "Acción no válida" }, { status: 400, headers });
  } catch (e) {
    if (req.method === "GET")
      return Response.redirect(app() + "/ajustes/conexiones?gmail=error", 303);
    return Response.json(
      { error: e instanceof Error ? e.message : "No se pudo completar la operación de Gmail." },
      { status: 400, headers },
    );
  }
}
if (import.meta.main) Deno.serve((req) => handler(req));
