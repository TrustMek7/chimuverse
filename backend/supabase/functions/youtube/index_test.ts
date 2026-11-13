import { videoId, google, handler } from "./index.ts";
import { crypt } from "../calendar/index.ts";
function equal(a: unknown, b: unknown) {
  if (JSON.stringify(a) !== JSON.stringify(b))
    throw new Error(`Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
Deno.test("video URLs accept YouTube only and reject foreign hosts", () => {
  equal(videoId("https://youtu.be/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  equal(
    videoId("https://music.youtube.com/watch?v=dQw4w9WgXcQ"),
    "dQw4w9WgXcQ",
  );
  equal(videoId("https://www.youtube.com/shorts/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  for (const url of [
    "https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ",
    "http://youtu.be/dQw4w9WgXcQ",
    "javascript:alert(1)",
    "invalid",
  ]) {
    let failed = false;
    try {
      videoId(url);
    } catch {
      failed = true;
    }
    equal(failed, true);
  }
});
Deno.test(
  "Google mutations retain optimistic concurrency and never blindly retry",
  async () => {
    const original = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async (input, init) => {
      calls++;
      equal(
        String(input),
        "https://www.googleapis.com/youtube/v3/playlistItems?id=item",
      );
      equal(init?.method, "DELETE");
      equal((init?.headers as Record<string, string>)["If-Match"], "etag1");
      return new Response("{}", { status: 412 });
    };
    try {
      let message = "";
      try {
        await google(
          "playlistItems?id=item",
          "access",
          "DELETE",
          undefined,
          "etag1",
        );
      } catch (e) {
        message = (e as Error).message;
      }
      equal(message.includes("cambió"), true);
      equal(calls, 1);
    } finally {
      globalThis.fetch = original;
    }
  },
);
Deno.test(
  "YouTube endpoint rejects untrusted origins and missing authentication",
  async () => {
    Deno.env.set("APP_URL", "http://localhost:5173");
    const foreign = await handler(
      new Request("https://example.test/youtube", {
        method: "POST",
        headers: { origin: "https://evil.test" },
        body: '{"action":"create"}',
      }),
    );
    equal(foreign.status, 403);
    const noAuth = await handler(
      new Request("https://example.test/youtube", {
        method: "POST",
        body: '{"action":"create"}',
      }),
    );
    equal(noAuth.status, 401);
  },
);

Deno.test(
  "partner edits use the owner's encrypted credential without exposing it; OAuth requests isolated YouTube scope with PKCE",
  async () => {
    Deno.env.set("SUPABASE_URL", "https://database.example.test");
    Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service");
    Deno.env.set("GOOGLE_OAUTH_CLIENT_ID", "test-client");
    Deno.env.set("GOOGLE_OAUTH_CLIENT_SECRET", "test-secret");
    Deno.env.set(
      "GOOGLE_TOKEN_ENCRYPTION_KEY",
      btoa(String.fromCharCode(...new Uint8Array(32).fill(8))),
    );
    const encrypted = await crypt("owner-refresh");
    const original = globalThis.fetch;
    let writes = 0,
      unlocked = 0;
    const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      partner = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      if (url.endsWith("/auth/v1/user"))
        return Response.json({ id: partner, email: "partner@example.test" });
      if (url.includes("/rest/v1/space_members"))
        return Response.json({ space_id: "space" });
      if (url.endsWith("/rpc/youtube_service")) {
        const body = JSON.parse(String(init?.body));
        equal(body.p_uid, partner);
        if (body.p_op === "connection") return Response.json(null);
        if (body.p_op === "playlist")
          return Response.json({
            playlist_id: "PLshared",
            owner_id: owner,
            title: "Shared",
            token: encrypted,
          });
        if (body.p_op === "lock") return Response.json({ acquired: true });
        if (body.p_op === "unlock") {
          unlocked++;
          return Response.json(null);
        }
        if (body.p_op === "state") {
          equal(body.p_data.verifier.length >= 43, true);
          return Response.json(null);
        }
      }
      if (url.endsWith("/token")) {
        equal(
          new URLSearchParams(String(init?.body)).get("refresh_token"),
          "owner-refresh",
        );
        return Response.json({ access_token: "owner-access" });
      }
      if (url.includes("/youtube/v3/playlistItems")) {
        equal(
          (init?.headers as Record<string, string>).Authorization,
          "Bearer owner-access",
        );
        if (init?.method === "POST") {
          writes++;
          const body = JSON.parse(String(init.body));
          equal(body.snippet.playlistId, "PLshared");
          return Response.json({ id: "new-item" });
        }
        return Response.json({ items: [] });
      }
      throw new Error("Unexpected test request " + url);
    };
    const request = (action: string, extra: Record<string, string> = {}) =>
      handler(
        new Request("https://database.example.test/functions/v1/youtube", {
          method: "POST",
          headers: { Authorization: "Bearer partner-session" },
          body: JSON.stringify({ action, ...extra }),
        }),
      );
    try {
      const status = await (await request("status")).json();
      equal(status.connected, false);
      equal(status.playlist.available, true);
      equal(JSON.stringify(status).includes("token"), false);
      const add = await request("add", {
        video: "https://youtu.be/dQw4w9WgXcQ",
      });
      equal(add.status, 200);
      equal(writes, 1);
      equal(unlocked, 1);
      const connect = await (await request("connect")).json();
      const params = new URL(connect.url).searchParams;
      equal(
        params.get("scope"),
        "openid email https://www.googleapis.com/auth/youtube.force-ssl",
      );
      equal(params.get("code_challenge_method"), "S256");
      equal(
        params.get("redirect_uri"),
        "https://database.example.test/functions/v1/youtube",
      );
    } finally {
      globalThis.fetch = original;
    }
  },
);
