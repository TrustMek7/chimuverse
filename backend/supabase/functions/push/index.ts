import { createClient } from "npm:@supabase/supabase-js@2.110.0";
import webpush from "npm:web-push@3.6.7";
type Data = Record<string, any>;
const env = (key: string) => {
  const v = Deno.env.get(key);
  if (!v) throw new Error(`Falta configurar ${key} en el servidor.`);
  return v;
};
const admin = () =>
  createClient(
    env("SUPABASE_URL"),
    Deno.env.get("CHIMU_SUPABASE_SECRET_KEY") ??
      env("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
};
// Push services require an https: or mailto: contact. The project URL is always https.
const subject = () => {
  const app = Deno.env.get("APP_URL") ?? "";
  return app.startsWith("https://") ? app : env("SUPABASE_URL");
};
export type Subscription = { id: string; endpoint: string; p256dh: string; auth: string };
export type Message = { title: string; body: string; path: string; tag: string };

/** Encrypts and delivers one message; returns false when the device is gone for good. */
export async function deliver(sub: Subscription, message: Message, fetcher = fetch) {
  const request = webpush.generateRequestDetails(
    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
    JSON.stringify(message),
    {
      vapidDetails: {
        subject: subject(),
        publicKey: env("VAPID_PUBLIC_KEY"),
        privateKey: env("VAPID_PRIVATE_KEY"),
      },
      TTL: 60 * 60 * 24,
      urgency: "high",
    },
  );
  const res = await fetcher(request.endpoint, {
    method: "POST",
    headers: request.headers as Record<string, string>,
    body: request.body,
    signal: AbortSignal.timeout(10000),
  });
  await res.body?.cancel();
  if (res.status === 404 || res.status === 410) return false;
  if (!res.ok) throw new Error(`Servicio push respondió ${res.status}`);
  return true;
}

/** Sends to every device of a member, pruning expired subscriptions. */
export async function sendToUser(
  userId: string,
  message: Message,
  db = admin(),
  fetcher = fetch,
) {
  const { data: subs, error } = await db
    .from("push_subscriptions")
    .select("id,endpoint,p256dh,auth")
    .eq("user_id", userId);
  if (error) throw new Error("No se pudieron leer los dispositivos.");
  let sent = 0,
    removed = 0,
    failed = 0;
  for (const sub of (subs ?? []) as Subscription[]) {
    try {
      if (await deliver(sub, message, fetcher)) {
        sent++;
        await db
          .from("push_subscriptions")
          .update({ last_seen_at: new Date().toISOString() })
          .eq("id", sub.id);
      } else {
        removed++;
        await db.from("push_subscriptions").delete().eq("id", sub.id);
      }
    } catch {
      failed++;
    }
  }
  return { sent, removed, failed };
}

export async function handler(req: Request, db?: ReturnType<typeof admin>, fetcher = fetch) {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return new Response(null, { status: 405, headers });
  try {
    const body = await req.json();
    const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (body.action === "key")
      return Response.json({ publicKey: env("VAPID_PUBLIC_KEY") }, { headers });
    if (body.action === "send") {
      const secret = Deno.env.get("CRON_SECRET");
      if (!secret || secret.length < 32 || bearer !== secret)
        return Response.json({ error: "Sin autorización" }, { status: 401, headers });
      if (typeof body.notification_id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.notification_id))
        return Response.json({ error: "Notificación no válida" }, { status: 400, headers });
      db ??= admin();
      const { data: n } = await db
        .from("notifications")
        .select("id,recipient_id,kind,title,path,read_at")
        .eq("id", body.notification_id)
        .maybeSingle();
      if (!n || n.read_at) return Response.json({ sent: 0 }, { headers });
      return Response.json(
        await sendToUser(
          n.recipient_id,
          { title: "Chimuverse", body: n.title, path: n.path || "/", tag: n.kind + ":" + n.id },
          db,
          fetcher,
        ),
        { headers },
      );
    }
    if (body.action === "test") {
      if (!bearer) return Response.json({ error: "Inicia sesión" }, { status: 401, headers });
      db ??= admin();
      const { data: { user }, error } = await db.auth.getUser(bearer);
      if (error || !user) return Response.json({ error: "Sesión no válida" }, { status: 401, headers });
      return Response.json(
        await sendToUser(
          user.id,
          { title: "Chimuverse", body: "Así te llegarán nuestros avisos ✦", path: "/", tag: "test" },
          db,
          fetcher,
        ),
        { headers },
      );
    }
    return Response.json({ error: "Acción no válida" }, { status: 400, headers });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "No se pudo enviar el aviso." },
      { status: 500, headers },
    );
  }
}
if (import.meta.main) Deno.serve((req) => handler(req));
