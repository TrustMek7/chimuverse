import webpush from "npm:web-push@3.6.7";
import { handler, sendToUser } from "./index.ts";
const assert = (value: unknown, message = "Assertion failed") => {
  if (!value) throw new Error(message);
};
const keys = webpush.generateVAPIDKeys();
Deno.env.set("SUPABASE_URL", "https://database.example.test");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role");
Deno.env.set("VAPID_PUBLIC_KEY", keys.publicKey);
Deno.env.set("VAPID_PRIVATE_KEY", keys.privateKey);
Deno.env.set("CRON_SECRET", "s".repeat(48));
const b64u = (b: Uint8Array) =>
  btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
async function browserKeys() {
  const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  return {
    p256dh: b64u(new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey))),
    auth: b64u(crypto.getRandomValues(new Uint8Array(16))),
  };
}
// Minimal stand-in for the supabase-js query builder used by the function.
function fakeDb(subs: any[], notification?: any) {
  const deleted: string[] = [];
  const touched: string[] = [];
  const db: any = {
    deleted,
    touched,
    auth: { getUser: (t: string) => Promise.resolve(t === "user-token" ? { data: { user: { id: "u1" } }, error: null } : { data: { user: null }, error: new Error("x") }) },
    from(table: string) {
      const q: any = {
        op: "select",
        select() { return q; },
        update() { q.op = "update"; return q; },
        delete() { q.op = "delete"; return q; },
        eq(_c: string, v: string) {
          if (table === "push_subscriptions" && q.op === "delete") deleted.push(v);
          if (table === "push_subscriptions" && q.op === "update") touched.push(v);
          q.value = v;
          return q;
        },
        maybeSingle: () => Promise.resolve({ data: notification ?? null }),
        then(resolve: any) {
          resolve(table === "push_subscriptions" && q.op === "select" ? { data: subs.filter((s) => s.user_id === q.value), error: null } : { error: null });
        },
      };
      return q;
    },
  };
  return db;
}
Deno.test("delivers encrypted VAPID-signed pushes and prunes gone devices", async () => {
  const subs = [
    { id: "s1", user_id: "u1", endpoint: "https://push.example.test/alive", ...(await browserKeys()) },
    { id: "s2", user_id: "u1", endpoint: "https://push.example.test/gone", ...(await browserKeys()) },
    { id: "s3", user_id: "u2", endpoint: "https://push.example.test/other", ...(await browserKeys()) },
  ];
  const calls: { url: string; init: RequestInit }[] = [];
  const fetcher = (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init! });
    return Promise.resolve(new Response(null, { status: String(url).endsWith("gone") ? 410 : 201 }));
  };
  const db = fakeDb(subs);
  const result = await sendToUser("u1", { title: "Chimuverse", body: "Hola", path: "/", tag: "t" }, db, fetcher as typeof fetch);
  assert(result.sent === 1 && result.removed === 1 && result.failed === 0, JSON.stringify(result));
  assert(calls.length === 2, "only the recipient's devices are contacted");
  const h = calls[0].init.headers as Record<string, string>;
  assert(h["Content-Encoding"] === "aes128gcm");
  assert(h.Authorization.startsWith("vapid t=") && h.Authorization.includes("k=" + keys.publicKey));
  assert(!new TextDecoder().decode(calls[0].init.body as Uint8Array).includes("Hola"), "payload must be encrypted");
  assert(db.deleted.includes("s2") && !db.deleted.includes("s1"));
  assert(db.touched.includes("s1"));
});
Deno.test("send requires the server secret and skips read notifications", async () => {
  const req = (auth: string, id = "dddddddd-dddd-4ddd-8ddd-dddddddddddd") =>
    new Request("https://x/push", {
      method: "POST",
      headers: { authorization: "Bearer " + auth },
      body: JSON.stringify({ action: "send", notification_id: id }),
    });
  assert((await handler(req("wrong"), fakeDb([]))).status === 401);
  assert((await handler(req("s".repeat(48), "nope"), fakeDb([]))).status === 400);
  const read = fakeDb([], { id: "n", recipient_id: "u1", kind: "k", title: "t", path: "/", read_at: new Date().toISOString() });
  assert((await (await handler(req("s".repeat(48)), read)).json()).sent === 0);
});
Deno.test("public key is available and the test push needs a valid session", async () => {
  const key = await handler(new Request("https://x/push", { method: "POST", body: '{"action":"key"}' }));
  assert((await key.json()).publicKey === keys.publicKey);
  const anon = await handler(
    new Request("https://x/push", { method: "POST", headers: { authorization: "Bearer bad" }, body: '{"action":"test"}' }),
    fakeDb([]),
  );
  assert(anon.status === 401);
});
