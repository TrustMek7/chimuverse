import { createClient } from "npm:@supabase/supabase-js@2.110.0";
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
const appUrl = () => env("APP_URL").replace(/\/$/, "");
const callbackUrl = () => env("SUPABASE_URL") + "/functions/v1/calendar";
const encode = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const decode = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export async function crypt(value: string, decrypt = false) {
  const key = await crypto.subtle.importKey(
    "raw",
    decode(env("GOOGLE_TOKEN_ENCRYPTION_KEY")),
    "AES-GCM",
    false,
    ["encrypt", "decrypt"],
  );
  if (decrypt) {
    const [iv, data] = value.split(".");
    return new TextDecoder().decode(
      await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: decode(iv) },
        key,
        decode(data),
      ),
    );
  }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  return (
    encode(iv) +
    "." +
    encode(
      new Uint8Array(
        await crypto.subtle.encrypt(
          { name: "AES-GCM", iv },
          key,
          new TextEncoder().encode(value),
        ),
      ),
    )
  );
}
async function rpc(name: string, args: Data = {}) {
  const { data, error } = await admin().rpc(name, args);
  if (error) throw new Error("No se pudo completar la operación de Calendar.");
  return data;
}
async function service(op: string, uid: string, data: Data = {}) {
  return rpc("calendar_service", { p_op: op, p_uid: uid, p_data: data });
}
class GoogleError extends Error {
  constructor(public status: number) {
    super(
      status === 401 || status === 403
        ? "Reconecta Google Calendar para renovar el permiso."
        : status === 412
          ? "El evento cambió en Google. Sincroniza y revisa el conflicto."
          : "Google Calendar no respondió. Puedes volver a intentar.",
    );
  }
}
async function google(
  path: string,
  token: string,
  method = "GET",
  body?: Data,
  etag?: string,
): Promise<Data> {
  for (let i = 0; i < 3; i++) {
    const res = await fetch("https://www.googleapis.com/calendar/v3/" + path, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(etag ? { "If-Match": etag } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) return res.status === 204 ? {} : await res.json();
    if ((res.status === 429 || res.status >= 500) && i < 2) {
      await new Promise((r) => setTimeout(r, 300 * 2 ** i));
      continue;
    }
    throw new GoogleError(res.status);
  }
  throw new Error("No se pudo sincronizar.");
}
async function refresh(encrypted: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: env("GOOGLE_OAUTH_CLIENT_ID"),
      client_secret: env("GOOGLE_OAUTH_CLIENT_SECRET"),
      grant_type: "refresh_token",
      refresh_token: await crypt(encrypted, true),
    }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json();
  if (!response.ok || !data.access_token)
    throw new Error("El permiso de Google caducó. Reconecta tu cuenta.");
  return String(data.access_token);
}
export function normalize(remote: Data, eventId?: string) {
  if (remote.status === "cancelled")
    return { event_id: eventId ?? null, deleted: true };
  return {
    event_id: eventId ?? null,
    title: remote.summary ?? "Sin título",
    description: remote.description ?? "",
    start_at:
      remote.start?.dateTime ??
      (remote.start?.date ? remote.start.date + "T00:00:00Z" : undefined),
    end_at:
      remote.end?.dateTime ??
      (remote.end?.date ? remote.end.date + "T00:00:00Z" : undefined),
    all_day: !!remote.start?.date,
    recurrence: remote.recurrence ?? [],
    recurrence_timezone: remote.start?.timeZone ?? "America/Lima",
    annual:
      remote.recurrence?.length === 1 &&
      remote.recurrence[0] === "RRULE:FREQ=YEARLY",
    deleted: remote.status === "cancelled",
  };
}
export function toRemote(e: Data, invitees: string[] = []) {
  return {
    summary: e.title,
    description: e.description,
    visibility: "private",
    start: e.all_day
      ? { date: e.start_at.slice(0, 10) }
      : {
          dateTime: e.start_at,
          timeZone: e.recurrence_timezone ?? "America/Lima",
        },
    end: e.all_day
      ? { date: e.end_at.slice(0, 10) }
      : {
          dateTime: e.end_at,
          timeZone: e.recurrence_timezone ?? "America/Lima",
        },
    recurrence: e.recurrence ?? (e.annual ? ["RRULE:FREQ=YEARLY"] : []),
    ...(invitees.length
      ? {
          attendees: invitees.map((email) => ({ email })),
          guestsCanInviteOthers: false,
          guestsCanModify: false,
        }
      : {}),
    extendedProperties: { private: { chimuverse_id: e.id } },
  };
}
async function link(uid: string, e: Data, r: Data) {
  await service("link", uid, {
    event_id: e.id,
    google_event_id: r.id,
    etag: r.etag ?? null,
    local_version: e.version,
    remote_updated: r.updated ?? null,
  });
}
export async function sync(uid: string) {
  const lock = await service("lock", uid);
  if (!lock.acquired)
    throw new Error(
      "Ya hay una sincronización en curso. Intenta en un momento.",
    );
  let cursor: string | undefined;
  try {
    const conn = await service("connection", uid);
    if (!conn) throw new Error("Conecta primero tu Google Calendar.");
    const token = await refresh(conn.encrypted_refresh_token);
    const invitees: string[] = await rpc("calendar_invitees", { p_uid: uid });
    const base =
      "calendars/" + encodeURIComponent(conn.calendar_id) + "/events";
    let links: Data[] = await service("links", uid);
    let events: Data[] = await service("events", uid);
    let page: string | undefined;
    let reset = false;
    const seen = new Set<string>();
    const overrides: Data[] = [];
    for (;;) {
      const params = new URLSearchParams({
        maxResults: "250",
        showDeleted: "true",
        singleEvents: "false",
      });
      if (page) params.set("pageToken", page);
      if (conn.sync_token && !reset) params.set("syncToken", conn.sync_token);
      let batch: Data;
      try {
        batch = await google(base + "?" + params, token);
      } catch (e) {
        if (e instanceof GoogleError && e.status === 410 && !reset) {
          reset = true;
          page = undefined;
          await service("reset_cursor", uid);
          continue;
        }
        throw e;
      }
      for (const remote of batch.items ?? []) {
        if (remote.recurringEventId) {
          overrides.push(remote);
          continue;
        }
        seen.add(remote.id);
        const l = links.find((l) => l.google_event_id === remote.id);
        let local = l ? events.find((e) => e.id === l.event_id) : undefined;
        // Recover a deterministic event created before a failed link write.
        if (!local && remote.extendedProperties?.private?.chimuverse_id) {
          const candidate = events.find(
            (e) => e.id === remote.extendedProperties.private.chimuverse_id,
          );
          const existing = candidate
            ? links.find((l) => l.event_id === candidate.id)
            : undefined;
          if (
            !existing ||
            (existing.etag === null && remote.status !== "cancelled")
          )
            local = candidate;
        }
        if (!local) {
          if (remote.status === "cancelled") continue;
          const imported = await service("import", uid, normalize(remote));
          await link(uid, imported, remote);
          continue;
        }
        // Removing the opt-in must not delete the event in Chimuverse on the next pull.
        if (!local.sync_google && !local.deleted_at) continue;
        if (l?.etag === null && remote.status === "cancelled") continue;
        if (l?.etag === remote.etag) continue;
        if (l && local.version !== l.local_version) {
          await service("conflict", uid, { event_id: local.id, remote });
          continue;
        }
        const imported = await service(
          "import",
          uid,
          normalize(remote, local.id),
        );
        await link(uid, imported, remote);
      }
      page = batch.nextPageToken;
      cursor = batch.nextSyncToken ?? cursor;
      if (!page) break;
    }
    links = await service("links", uid);
    for (const remote of overrides) {
      const parent = links.find(
        (l) => l.google_event_id === remote.recurringEventId,
      );
      if (!parent) continue;
      const start = (value: Data | undefined) =>
        value?.dateTime ?? (value?.date ? value.date + "T00:00:00Z" : null);
      await rpc("import_calendar_override", {
        p_uid: uid,
        p_data: {
          event_id: parent.event_id,
          google_event_id: remote.id,
          original_start: start(remote.originalStartTime),
          start_at: start(remote.start),
          end_at: start(remote.end),
          title: remote.summary ?? null,
          cancelled: remote.status === "cancelled",
        },
      });
    }
    events = await service("events", uid);
    const conflicts: Data[] = await service("conflicts", uid);
    for (const event of events) {
      if (conflicts.some((c) => c.event_id === event.id)) continue;
      const l = links.find((l) => l.event_id === event.id);
      const remoteId = l?.google_event_id ?? event.id.replaceAll("-", "");
      if (l && (event.deleted_at || !event.sync_google)) {
        if (l.etag === null) continue;
        try {
          await google(
            base + "/" + encodeURIComponent(remoteId) + "?sendUpdates=all",
            token,
            "DELETE",
            undefined,
            l.etag,
          );
        } catch (e) {
          if (!(e instanceof GoogleError && [404, 410].includes(e.status)))
            throw e;
        }
        await service("link", uid, {
          event_id: event.id,
          google_event_id: remoteId,
          etag: null,
          local_version: event.version,
        });
        continue;
      }
      if (
        !event.sync_google ||
        event.deleted_at ||
        (l && l.local_version === event.version)
      )
        continue;
      try {
        let remote: Data;
        if (l && l.etag !== null) {
          remote = await google(
            base + "/" + encodeURIComponent(remoteId) + "?sendUpdates=all",
            token,
            "PUT",
            toRemote(event, invitees),
            l.etag,
          );
        } else {
          try {
            remote = await google(base + "?sendUpdates=all", token, "POST", {
              ...(l ? {} : { id: remoteId }),
              ...toRemote(event, invitees),
            });
          } catch (e) {
            if (!(e instanceof GoogleError && e.status === 409)) throw e;
            remote = await google(base + "/" + remoteId, token);
            if (remote.extendedProperties?.private?.chimuverse_id !== event.id)
              throw new Error("No se pudo reconciliar el evento.");
          }
        }
        await link(uid, event, remote);
      } catch (e) {
        if (e instanceof GoogleError && e.status === 412) {
          const remote = await google(base + "/" + remoteId, token);
          await service("conflict", uid, { event_id: event.id, remote });
        } else throw e;
      }
    }
    await service("finish", uid, { sync_token: cursor ?? conn.sync_token });
    return { synced: true };
  } catch (e) {
    await service("finish", uid, {
      error: e instanceof Error ? e.message : "Sincronización interrumpida",
    });
    throw e;
  }
}
export async function synchronizeAutomatically(uid: string, force = false) {
  for (let pass = 0; pass < 3; pass++) {
    const pending = await rpc("pending_calendar_sync", { p_uid: uid });
    if (!pending && !force) return { synced: true };
    try {
      await sync(uid);
    } catch (e) {
      if (e instanceof Error && e.message.includes("sincronización en curso"))
        return { queued: true };
      throw e;
    }
    if (pending)
      await rpc("complete_calendar_sync", {
        p_uid: uid,
        p_generation: pending.generation,
      });
    force = false;
  }
  return { queued: true };
}
async function resolve(uid: string, id: string, choice: string) {
  const conflicts: Data[] = await service("conflicts", uid);
  const c = conflicts.find((c) => c.id === id);
  if (!c) throw new Error("El conflicto ya fue resuelto.");
  const events: Data[] = await service("events", uid);
  const local = events.find((e) => e.id === c.event_id);
  if (!local) throw new Error("Evento no encontrado.");
  if (choice === "remote") {
    const e = await service("import", uid, normalize(c.remote_event, local.id));
    await link(uid, e, c.remote_event);
  } else if (choice === "local") {
    const conn = await service("connection", uid);
    const token = await refresh(conn.encrypted_refresh_token);
    const invitees: string[] = await rpc("calendar_invitees", { p_uid: uid });
    const path =
      "calendars/" +
      encodeURIComponent(conn.calendar_id) +
      "/events/" +
      encodeURIComponent(c.remote_event.id);
    let r: Data;
    if (local.deleted_at) {
      await google(
        path + "?sendUpdates=all",
        token,
        "DELETE",
        undefined,
        c.remote_event.etag,
      );
      r = { ...c.remote_event, etag: null };
    } else if (c.remote_event.status === "cancelled") {
      r = await google(
        "calendars/" +
          encodeURIComponent(conn.calendar_id) +
          "/events?sendUpdates=all",
        token,
        "POST",
        { ...toRemote(local, invitees) },
      );
    } else
      r = await google(
        path + "?sendUpdates=all",
        token,
        "PUT",
        toRemote(local, invitees),
        c.remote_event.etag,
      );
    await link(uid, local, r);
  } else throw new Error("Elige qué versión conservar.");
  await service("resolve", uid, { conflict_id: id });
  return { resolved: true };
}
export async function handler(req: Request) {
  let headers: Record<string, string> = {};
  try {
    const origin = req.headers.get("origin");
    if (origin && origin !== appUrl())
      return new Response("Origen no autorizado", { status: 403 });
    headers = {
      "Access-Control-Allow-Origin": appUrl(),
      "Access-Control-Allow-Headers":
        "authorization, apikey, content-type, x-client-info",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      Vary: "Origin",
    };
    if (req.method === "OPTIONS") return new Response(null, { headers });
    const url = new URL(req.url);
    if (req.method === "GET") {
      const state = url.searchParams.get("state");
      if (!state) throw new Error("Falta la autorización OAuth.");
      const pending = await rpc("consume_calendar_state", { p_state: state });
      if (!pending) throw new Error("La autorización caducó o ya fue usada.");
      if (url.searchParams.has("error"))
        return Response.redirect(
          appUrl() + "/ajustes/conexiones?calendar=cancelled",
          303,
        );
      const code = url.searchParams.get("code");
      if (!code) throw new Error("Falta el código OAuth.");
      const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: pending.redirect_uri,
          code_verifier: pending.code_verifier,
          client_id: env("GOOGLE_OAUTH_CLIENT_ID"),
          client_secret: env("GOOGLE_OAUTH_CLIENT_SECRET"),
        }),
        signal: AbortSignal.timeout(15000),
      });
      const tokens = await response.json();
      if (!response.ok || !tokens.refresh_token)
        throw new Error("No se obtuvo permiso offline. Vuelve a conectar.");
      const identityResponse = await fetch(
        "https://openidconnect.googleapis.com/v1/userinfo",
        {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
          signal: AbortSignal.timeout(15000),
        },
      );
      const identity = await identityResponse.json();
      const expected = await admin().auth.admin.getUserById(pending.user_id);
      if (
        !identityResponse.ok ||
        !identity.email_verified ||
        !expected.data.user?.email ||
        identity.email.toLowerCase() !== expected.data.user.email.toLowerCase()
      )
        throw new Error(
          "Conecta la misma cuenta de Google con la que entraste a Chimuverse.",
        );
      let conn = await service("connection", pending.user_id);
      if (!conn) {
        const cal = await google("calendars", tokens.access_token, "POST", {
          summary: "Chimuverse",
          timeZone: "America/Lima",
          description:
            "Nuestro espacio privado. Solo eventos elegidos en Chimuverse.",
        });
        conn = { calendar_id: cal.id };
      }
      await service("connect", pending.user_id, {
        token: await crypt(tokens.refresh_token),
        calendar_id: conn.calendar_id,
      });
      return Response.redirect(
        appUrl() + "/ajustes/conexiones?calendar=connected",
        303,
      );
    }
    if (req.method !== "POST")
      return new Response(null, { status: 405, headers });
    const body = await req.json();
    if (body.action === "scheduled" || body.action === "event") {
      const secret = Deno.env.get("CRON_SECRET");
      const supplied = req.headers
        .get("authorization")
        ?.replace(/^Bearer\s+/i, "");
      if (!secret || secret.length < 32 || supplied !== secret)
        return Response.json(
          { error: "Sin autorización" },
          { status: 401, headers },
        );
      if (body.action === "event") {
        if (
          typeof body.user_id !== "string" ||
          !/^[0-9a-f-]{36}$/i.test(body.user_id)
        )
          throw new Error("Cuenta no válida.");
        return Response.json(await synchronizeAutomatically(body.user_id), {
          headers,
        });
      }
      const accounts: string[] = await rpc("calendar_accounts");
      const results = [];
      for (const uid of accounts) {
        try {
          await synchronizeAutomatically(uid, true);
          results.push({ ok: true });
        } catch {
          results.push({ ok: false });
        }
      }
      // Unfinished tasks whose day ended move to today by themselves (recorded as "carry").
      const carried = await rpc("carry_over_tasks").catch(() => null);
      // Fixed income, expenses and savings create the movements that are due today.
      const recurring = await rpc("generate_recurring").catch(() => null);
      await rpc("enqueue_reminders");
      return Response.json(
        {
          processed: results.length,
          failed: results.filter((r) => !r.ok).length,
          carried,
          recurring,
        },
        { headers },
      );
    }
    const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!bearer) throw new Error("Inicia sesión para conectar Calendar.");
    const {
      data: { user },
      error,
    } = await admin().auth.getUser(bearer);
    if (error || !user)
      return Response.json(
        { error: "Sesión no válida" },
        { status: 401, headers },
      );
    const { data: member } = await admin()
      .from("space_members")
      .select("space_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!member)
      return Response.json({ error: "Sin acceso" }, { status: 403, headers });
    let result: Data = {};
    if (body.action === "connect") {
      env("GOOGLE_OAUTH_CLIENT_SECRET");
      env("GOOGLE_TOKEN_ENCRYPTION_KEY");
      const state = crypto.randomUUID() + crypto.randomUUID();
      const verifier = encode(crypto.getRandomValues(new Uint8Array(48)))
        .replaceAll("+", "-")
        .replaceAll("/", "_")
        .replaceAll("=", "");
      const challenge = encode(
        new Uint8Array(
          await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(verifier),
          ),
        ),
      )
        .replaceAll("+", "-")
        .replaceAll("/", "_")
        .replaceAll("=", "");
      await service("state", user.id, {
        state,
        verifier,
        redirect_uri: callbackUrl(),
      });
      const params = new URLSearchParams({
        client_id: env("GOOGLE_OAUTH_CLIENT_ID"),
        redirect_uri: callbackUrl(),
        response_type: "code",
        scope:
          "openid email https://www.googleapis.com/auth/calendar.app.created",
        access_type: "offline",
        prompt: "consent",
        state,
        code_challenge: challenge,
        code_challenge_method: "S256",
      });
      result = {
        url: "https://accounts.google.com/o/oauth2/v2/auth?" + params,
      };
    } else if (body.action === "sync")
      result = await synchronizeAutomatically(user.id, true);
    else if (body.action === "disconnect") {
      const conn = await service("connection", user.id);
      if (conn) {
        const token = await crypt(conn.encrypted_refresh_token, true);
        await fetch("https://oauth2.googleapis.com/revoke", {
          method: "POST",
          body: new URLSearchParams({ token }),
          signal: AbortSignal.timeout(15000),
        });
      }
      await service("disconnect", user.id);
      result = { disconnected: true };
    } else if (body.action === "resolve")
      result = await resolve(
        user.id,
        String(body.conflict_id),
        String(body.choice),
      );
    else throw new Error("Acción no disponible.");
    return Response.json(result, { headers });
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof Error ? e.message : "No se pudo completar la conexión.",
      },
      { status: 400, headers },
    );
  }
}
if (import.meta.main) Deno.serve(handler);
