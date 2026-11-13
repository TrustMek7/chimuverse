import { crypt } from "../calendar/index.ts";
import { deliver, handler, message, type Plan } from "./index.ts";
const assert = (value: unknown, msg = "Assertion failed") => {
  if (!value) throw new Error(msg);
};
Deno.env.set("SUPABASE_URL", "https://database.example.test");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role");
Deno.env.set("APP_URL", "https://app.example.test");
Deno.env.set("GOOGLE_OAUTH_CLIENT_ID", "client");
Deno.env.set("GOOGLE_OAUTH_CLIENT_SECRET", "secret");
Deno.env.set("CRON_SECRET", "s".repeat(48));
Deno.env.set("GOOGLE_TOKEN_ENCRYPTION_KEY", btoa(String.fromCharCode(...new Uint8Array(32).fill(9))));
const decode = (raw: string) => {
  const bin = atob(raw.replaceAll("-", "+").replaceAll("_", "/"));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
};
const part = (mime: string, type: string) => {
  const block = mime.split(`Content-Type: ${type}; charset=UTF-8`)[1];
  const body = block.split("\r\n\r\n")[1].split("\r\n")[0];
  return new TextDecoder().decode(Uint8Array.from(atob(body), (c) => c.charCodeAt(0)));
};
const basePlan = async (): Promise<Plan> => ({
  notification_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  title: "Te toca verificar «Cena <especial>»",
  path: "/dia/quests",
  to: "a@example.test",
  sender_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  sender_email: "b@example.test",
  sender_name: "Glenny Shinderly",
  token: await crypt("refresh-b"),
  self: false,
});
Deno.test("builds a UTF-8 message from the partner with escaped HTML and an app link", async () => {
  const mime = decode(message(await basePlan(), "https://app.example.test"));
  assert(mime.includes("<b@example.test>") && mime.includes("To: <a@example.test>"));
  assert(mime.includes("From: =?UTF-8?B?"), "display name is an encoded word");
  const html = part(mime, "text/html");
  assert(html.includes("Cena &lt;especial&gt;") && !html.includes("<especial>"), "title is escaped");
  assert(html.includes('href="https://app.example.test/dia/quests"'));
  assert(part(mime, "text/plain").includes("https://app.example.test/dia/quests"));
  const evil = { ...(await basePlan()), title: "Hola\r\nBcc: x@evil.test", path: "//evil.test" };
  const raw = decode(message(evil, "https://app.example.test"));
  assert(!/^Bcc:/m.test(raw), "line breaks cannot inject headers");
  assert(!raw.includes("evil.test/") && part(raw, "text/html").includes("https://app.example.test/\""), "external paths fall back to /");
});
Deno.test("delivers through Gmail, records success and skips when the plan is empty", async () => {
  const calls: string[] = [];
  const rpcLog: [string, any][] = [];
  const plan = await basePlan();
  const rpc = async (name: string, args: any) => {
    rpcLog.push([name, args]);
    return name === "mail_plan" ? plan : null;
  };
  const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push(String(url));
    if (String(url).includes("oauth2")) {
      assert(String(init?.body).includes("refresh_token=refresh-b"), "uses the sender's decrypted token");
      return Response.json({ access_token: "access-b" });
    }
    assert((init?.headers as any).Authorization === "Bearer access-b");
    assert(JSON.parse(String(init?.body)).raw.length > 100);
    return Response.json({ id: "m1" });
  }) as typeof fetch;
  assert((await deliver(plan.notification_id, rpc, fetcher)).sent === true);
  assert(calls.some((u) => u.endsWith("/gmail/v1/users/me/messages/send")));
  assert(rpcLog.some(([n, a]) => n === "mail_delivered" && a.p_status === "sent"));
  const none = await deliver(plan.notification_id, async () => null, fetcher);
  assert(none.skipped === true);
});
Deno.test("a revoked Gmail grant is recorded once, without retry loops", async () => {
  const rpcLog: [string, any][] = [];
  const plan = await basePlan();
  const rpc = async (name: string, args: any) => (rpcLog.push([name, args]), name === "mail_plan" ? plan : null);
  const fetcher = (async () => Response.json({ error: "invalid_grant" }, { status: 400 })) as unknown as typeof fetch;
  const r = await deliver(plan.notification_id, rpc, fetcher);
  assert(r.sent === false && /Reconecta Gmail/.test(r.error!));
  assert(rpcLog.some(([n, a]) => n === "mail_delivered" && a.p_status === "failed"));
  assert(rpcLog.some(([n, a]) => n === "gmail_service" && a.p_op === "error"));
});
Deno.test("sending requires the server secret", async () => {
  const req = (auth: string) =>
    new Request("https://x/mail", {
      method: "POST",
      headers: { authorization: "Bearer " + auth },
      body: JSON.stringify({ action: "send", notification_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" }),
    });
  assert((await handler(req("wrong"), { rpc: async () => null })).status === 401);
  const ok = await handler(req("s".repeat(48)), { rpc: async () => null });
  assert((await ok.json()).skipped === true);
});
