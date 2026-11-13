import {
  crypt,
  normalize,
  toRemote,
  sync,
  handler,
  synchronizeAutomatically,
} from "./index.ts";
const uid = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const assert = (value: unknown, message = "Assertion failed") => {
  if (!value) throw new Error(message);
};
Deno.env.set("SUPABASE_URL", "https://database.example.test");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role");
Deno.env.set("APP_URL", "https://app.example.test");
Deno.env.set("GOOGLE_OAUTH_CLIENT_ID", "test-client");
Deno.env.set("GOOGLE_OAUTH_CLIENT_SECRET", "test-secret");
Deno.env.set(
  "GOOGLE_TOKEN_ENCRYPTION_KEY",
  btoa(String.fromCharCode(...new Uint8Array(32).fill(17))),
);
Deno.test("tokens use random-IV authenticated encryption", async () => {
  const one = await crypt("refresh-token-test");
  const two = await crypt("refresh-token-test");
  assert(one !== two);
  assert(!one.includes("refresh-token-test"));
  assert((await crypt(one, true)) === "refresh-token-test");
  let rejected = false;
  try {
    await crypt(one.slice(0, -5) + "AAAAA", true);
  } catch {
    rejected = true;
  }
  assert(rejected, "tampering must be rejected");
});
Deno.test(
  "automatic export drains edits queued during an earlier synchronization",
  async () => {
    const encrypted = await crypt("refresh-test");
    let completed = 0;
    const acknowledgements: number[] = [];
    const original = fetch;
    globalThis.fetch = (async (input, options) => {
      const url = String(input);
      if (url.endsWith("/token"))
        return Response.json({ access_token: "test" });
      if (url.includes("/events?"))
        return Response.json({ items: [], nextSyncToken: "cursor" });
      if (url.endsWith("/rpc/pending_calendar_sync"))
        return Response.json(
          completed < 2 ? { generation: completed + 1 } : null,
        );
      if (url.endsWith("/rpc/complete_calendar_sync")) {
        completed = JSON.parse(String(options?.body)).p_generation;
        acknowledgements.push(completed);
        return Response.json(null);
      }
      if (url.endsWith("/rpc/calendar_service")) {
        const op = JSON.parse(String(options?.body)).p_op;
        return Response.json(
          op === "lock"
            ? { acquired: true }
            : op === "connection"
              ? { encrypted_refresh_token: encrypted, calendar_id: "test" }
              : op === "finish"
                ? null
                : [],
        );
      }
      throw new Error("Unexpected request");
    }) as typeof fetch;
    try {
      const result = await synchronizeAutomatically(uid);
      assert("synced" in result);
      assert(JSON.stringify(acknowledgements) === "[1,2]");
    } finally {
      globalThis.fetch = original;
    }
  },
);
Deno.test(
  "all-day and annual Google contracts round-trip; unsupported recurrence is explicit",
  () => {
    const e = {
      id: uid,
      title: "Aniversario",
      description: "Un día nuestro",
      all_day: true,
      start_at: "2026-12-20T00:00:00Z",
      end_at: "2026-12-21T00:00:00Z",
      annual: true,
    };
    const remote = toRemote(e);
    assert(remote.start.date === "2026-12-20");
    assert(remote.end.date === "2026-12-21");
    assert(normalize(remote, uid).annual);
    assert(normalize({ status: "cancelled" }, uid).deleted);
    let rejected = false;
    try {
      normalize({ recurrence: ["RRULE:FREQ=WEEKLY"] });
    } catch {
      rejected = true;
    }
    assert(rejected);
  },
);
async function scenario(mode: "expired" | "conflict" | "outgoing") {
  const encrypted = await crypt("test-refresh");
  const calls: { op: string; data: Record<string, unknown> }[] = [];
  let attempts = 0;
  const local = {
    id: uid,
    title: "Plan local",
    description: "",
    start_at: "2026-12-20T18:00:00Z",
    end_at: "2026-12-20T19:00:00Z",
    annual: false,
    all_day: false,
    sync_google: true,
    version: 2,
    deleted_at: null,
  };
  const remote = {
    id: "google-event",
    summary: "Plan en Google",
    etag: "remote-new",
    updated: "2026-11-13T00:00:00Z",
    start: { dateTime: local.start_at },
    end: { dateTime: local.end_at },
  };
  const conflicts: unknown[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input, options) => {
    const url = String(input);
    if (url.endsWith("/token"))
      return Response.json({ access_token: "access-test" });
    if (url.includes("/rpc/calendar_service")) {
      const args = JSON.parse(String(options?.body));
      const op = args.p_op;
      calls.push({ op, data: args.p_data });
      const response: Record<string, unknown> = {
        lock: { acquired: true },
        connection: {
          encrypted_refresh_token: encrypted,
          calendar_id: "created-calendar",
          sync_token: "old-cursor",
        },
        links: [
          {
            event_id: uid,
            google_event_id: "google-event",
            etag: mode === "outgoing" ? "remote-new" : "remote-old",
            local_version: mode === "expired" ? 2 : 1,
          },
        ],
        events: [local],
        conflicts,
      };
      if (op === "conflict") conflicts.push(args.p_data);
      if (op === "import")
        return Response.json({ ...local, ...args.p_data, version: 3 });
      return Response.json(response[op] ?? null);
    }
    if (url.includes("/events?")) {
      attempts++;
      if (mode === "expired" && attempts === 1)
        return Response.json({}, { status: 410 });
      return Response.json({
        items: mode === "outgoing" ? [] : [remote],
        nextSyncToken: "new-cursor",
      });
    }
    if (url.endsWith("/events/google-event") && options?.method === "PUT") {
      assert(new Headers(options.headers).get("If-Match") === "remote-new");
      return Response.json({ ...remote, summary: local.title });
    }
    throw new Error("Unexpected external call: " + url);
  }) as typeof fetch;
  try {
    await sync(uid);
    if (mode === "expired") {
      assert(attempts === 2, "expired cursor must trigger a full retry");
      assert(calls.some((c) => c.op === "reset_cursor"));
      assert(calls.some((c) => c.op === "import"));
    }
    if (mode === "conflict") {
      assert(conflicts.length === 1, "concurrent edits need a conflict");
      assert(!calls.some((c) => c.op === "import"));
    }
    if (mode === "outgoing")
      assert(calls.some((c) => c.op === "link" && c.data.local_version === 2));
    assert(
      calls.some(
        (c) => c.op === "finish" && c.data.sync_token === "new-cursor",
      ),
    );
  } finally {
    globalThis.fetch = original;
  }
}
Deno.test("expired Google sync cursor performs a complete retry", () =>
  scenario("expired"),
);
Deno.test("simultaneous edits create a conflict without overwriting", () =>
  scenario("conflict"),
);
Deno.test(
  "local edits push with an ETag precondition and advance the link",
  () => scenario("outgoing"),
);
Deno.test(
  "calendar denies foreign origins and unauthenticated scheduled jobs",
  async () => {
    const foreign = await handler(
      new Request("https://database.example.test/functions/v1/calendar", {
        method: "POST",
        headers: {
          Origin: "https://evil.example.test",
          "Content-Type": "application/json",
        },
        body: '{"action":"connect"}',
      }),
    );
    assert(foreign.status === 403);
    const cron = await handler(
      new Request("https://database.example.test/functions/v1/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: '{"action":"scheduled"}',
      }),
    );
    assert(cron.status === 401);
  },
);
