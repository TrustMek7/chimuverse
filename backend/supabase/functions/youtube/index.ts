import { createClient } from "npm:@supabase/supabase-js@2.110.0";
import { crypt } from "../calendar/index.ts";
type Data = Record<string, any>;
const env = (k: string): string => {
  const v = Deno.env.get(k);
  if (!v) throw new Error(`Falta configurar ${k}.`);
  return v;
};
const clientId = () =>
  Deno.env.get("YOUTUBE_OAUTH_CLIENT_ID") || env("GOOGLE_OAUTH_CLIENT_ID");
const clientSecret = () =>
  Deno.env.get("YOUTUBE_OAUTH_CLIENT_SECRET") ||
  env("GOOGLE_OAUTH_CLIENT_SECRET");
const admin = () =>
  createClient(
    env("SUPABASE_URL"),
    Deno.env.get("CHIMU_SUPABASE_SECRET_KEY") ||
      env("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );
const callback = () => env("SUPABASE_URL") + "/functions/v1/youtube";
const app = () => env("APP_URL").replace(/\/$/, "");
const scope = "https://www.googleapis.com/auth/youtube.force-ssl";
async function rpc(name: string, args: Data) {
  const { data, error } = await admin().rpc(name, args);
  if (error) throw new Error("No se pudo guardar la conexión de YouTube.");
  return data;
}
const service = (op: string, uid: string, data: Data = {}) =>
  rpc("youtube_service", { p_op: op, p_uid: uid, p_data: data });
const b64 = (b: Uint8Array) =>
  btoa(String.fromCharCode(...b))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
export function videoId(value: string) {
  if (/^[\w-]{11}$/.test(value)) return value;
  try {
    const u = new URL(value);
    if (u.protocol !== "https:") throw 0;
    const id =
      u.hostname === "youtu.be"
        ? u.pathname.slice(1)
        : ["www.youtube.com", "youtube.com", "music.youtube.com"].includes(
              u.hostname,
            )
          ? u.searchParams.get("v") ||
            u.pathname.match(/^\/(?:shorts|embed)\/([\w-]{11})$/)?.[1]
          : null;
    if (id && /^[\w-]{11}$/.test(id)) return id;
  } catch {
    /* invalid input */
  }
  throw new Error("Pega un enlace de video de YouTube válido.");
}
export async function google(
  path: string,
  token: string,
  method = "GET",
  body?: Data,
  etag?: string,
): Promise<Data> {
  const res = await fetch("https://www.googleapis.com/youtube/v3/" + path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(etag ? { "If-Match": etag } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const reason = data.error?.errors?.[0]?.reason;
    throw new Error(
      res.status === 412
        ? "La playlist cambió. Actualiza antes de volver a editar."
        : reason === "quotaExceeded"
          ? "Se alcanzó la cuota de YouTube. Intenta más tarde."
          : reason === "youtubeSignupRequired"
            ? "Crea tu canal de YouTube antes de conectar."
            : res.status === 401 || res.status === 403
              ? "Reconecta YouTube y comprueba los permisos del canal."
              : "YouTube no pudo completar la operación. Actualiza la lista antes de reintentar.",
    );
  }
  return res.status === 204 ? {} : res.json();
}
async function access(encrypted: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: clientId(),
      client_secret: clientSecret(),
      grant_type: "refresh_token",
      refresh_token: await crypt(encrypted, true),
    }),
    signal: AbortSignal.timeout(15000),
  });
  const t = await res.json();
  if (!res.ok || !t.access_token)
    throw new Error("Reconecta YouTube para renovar el permiso.");
  return t.access_token as string;
}
async function pages(path: string, token: string) {
  const items: Data[] = [];
  let next = "";
  do {
    const page = await google(
      path +
        "&maxResults=50" +
        (next ? "&pageToken=" + encodeURIComponent(next) : ""),
      token,
    );
    items.push(...(page.items || []));
    next = page.nextPageToken || "";
    if (items.length >= 5000 && next)
      throw new Error("La playlist supera el límite de 5000 videos.");
  } while (next);
  return items;
}
export async function handler(req: Request): Promise<Response> {
  const headers = {
    "Access-Control-Allow-Origin": app(),
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
  try {
    if (req.headers.get("origin") && req.headers.get("origin") !== app())
      return new Response("Origen no autorizado", { status: 403 });
    if (req.method === "OPTIONS") return new Response(null, { headers });
    const url = new URL(req.url);
    if (req.method === "GET") {
      const state = url.searchParams.get("state");
      if (!state) throw new Error("Falta la autorización.");
      const pending = await rpc("consume_youtube_state", { p_state: state });
      if (!pending)
        throw new Error("La autorización caducó o ya fue utilizada.");
      if (url.searchParams.has("error"))
        return Response.redirect(
          app() + "/ajustes/conexiones?youtube=cancelled",
          303,
        );
      const code = url.searchParams.get("code");
      if (!code) throw new Error("Falta el código de autorización.");
      const res = await fetch("https://oauth2.googleapis.com/token", {
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
      if (
        !res.ok ||
        !t.refresh_token ||
        !String(t.scope).split(" ").includes(scope)
      )
        throw new Error(
          "Acepta el permiso para administrar playlists y vuelve a conectar.",
        );
      const identityRes = await fetch(
        "https://openidconnect.googleapis.com/v1/userinfo",
        {
          headers: { Authorization: `Bearer ${t.access_token}` },
          signal: AbortSignal.timeout(15000),
        },
      );
      const identity = await identityRes.json();
      const expected = await admin().auth.admin.getUserById(pending.user_id);
      if (
        !identityRes.ok ||
        !identity.email_verified ||
        !expected.data.user?.email ||
        identity.email?.toLowerCase() !== expected.data.user.email.toLowerCase()
      )
        throw new Error(
          "Conecta el mismo correo con el que entraste a Chimuverse.",
        );
      await service("connect", pending.user_id, {
        token: await crypt(t.refresh_token),
      });
      return Response.redirect(
        app() + "/ajustes/conexiones?youtube=connected",
        303,
      );
    }
    if (req.method !== "POST")
      return new Response(null, { status: 405, headers });
    const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!bearer)
      return Response.json(
        { error: "Inicia sesión." },
        { status: 401, headers },
      );
    const {
      data: { user },
      error,
    } = await admin().auth.getUser(bearer);
    if (error || !user)
      return Response.json(
        { error: "Sesión no válida." },
        { status: 401, headers },
      );
    const { data: member } = await admin()
      .from("space_members")
      .select("space_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!member)
      return Response.json({ error: "Sin acceso." }, { status: 403, headers });
    const body = await req.json();
    const uid = user.id;
    let result: Data = {};
    if (body.action === "connect") {
      clientSecret();
      env("GOOGLE_TOKEN_ENCRYPTION_KEY");
      const state = b64(crypto.getRandomValues(new Uint8Array(48))),
        verifier = b64(crypto.getRandomValues(new Uint8Array(48)));
      const challenge = b64(
        new Uint8Array(
          await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(verifier),
          ),
        ),
      );
      await service("state", uid, { state, verifier });
      result = {
        url:
          "https://accounts.google.com/o/oauth2/v2/auth?" +
          new URLSearchParams({
            client_id: clientId(),
            redirect_uri: callback(),
            response_type: "code",
            scope: "openid email " + scope,
            access_type: "offline",
            prompt: "consent",
            state,
            code_challenge: challenge,
            code_challenge_method: "S256",
          }),
      };
    } else if (body.action === "disconnect") {
      // Google revocation can revoke Calendar grants for the same OAuth client.
      // Remove only this integration's encrypted credential, leaving Google data intact.
      await service("disconnect", uid);
      result = { disconnected: true };
    } else {
      const own = await service("connection", uid);
      let playlist = await service("playlist", uid);
      if (body.action === "status")
        result = {
          connected: !!own,
          playlist: playlist?.playlist_id
            ? {
                id: playlist.playlist_id,
                title: playlist.title,
                owner: playlist.owner_id === uid,
                available: !!playlist.token,
              }
            : null,
        };
      else if (body.action === "mine") {
        if (!own) throw new Error("Conecta tu cuenta de YouTube.");
        result = {
          playlists: (
            await pages(
              "playlists?part=snippet,status&mine=true",
              await access(own.encrypted_refresh_token),
            )
          ).map((p) => ({ id: p.id, title: p.snippet.title })),
        };
      } else {
        const mutate = body.action !== "list";
        if (mutate) {
          const lock = await service("lock", uid);
          if (!lock.acquired)
            throw new Error(
              "La playlist se está actualizando. Intenta en un momento.",
            );
        }
        try {
          playlist = await service("playlist", uid);
          if (body.action === "create" || body.action === "import") {
            if (playlist?.playlist_id)
              throw new Error("Ya tienen una playlist compartida.");
            if (!own) throw new Error("Conecta tu cuenta de YouTube primero.");
            const token = await access(own.encrypted_refresh_token);
            let remote: Data;
            if (body.action === "create") {
              const title = String(body.title || "Nuestro soundtrack").trim();
              if (!title || title.length > 150)
                throw new Error(
                  "El título debe tener entre 1 y 150 caracteres.",
                );
              remote = await google(
                "playlists?part=snippet,status",
                token,
                "POST",
                {
                  snippet: {
                    title,
                    description:
                      "Nuestra playlist compartida desde Chimuverse.",
                  },
                  status: {
                    privacyStatus: "unlisted",
                  },
                },
              );
            } else {
              if (!/^[\w-]{10,100}$/.test(body.id || ""))
                throw new Error("Playlist no válida.");
              const channels = await google(
                "channels?part=id&mine=true",
                token,
              );
              const found = await google(
                "playlists?part=snippet&id=" + encodeURIComponent(body.id),
                token,
              );
              remote = found.items?.[0];
              if (
                !remote ||
                !channels.items?.some(
                  (c: Data) => c.id === remote.snippet.channelId,
                )
              )
                throw new Error("Importa una playlist de tu propio canal.");
            }
            await service("save", uid, {
              id: remote.id,
              title: remote.snippet.title,
            });
            result = { id: remote.id };
          } else {
            if (!playlist?.playlist_id || !playlist.token)
              throw new Error(
                "El propietario debe conectar YouTube para editar la playlist compartida.",
              );
            const token = await access(playlist.token),
              id = encodeURIComponent(playlist.playlist_id);
            const items = await pages(
              "playlistItems?part=snippet,contentDetails&playlistId=" + id,
              token,
            );
            if (body.action === "list")
              result = {
                items: items.map((i) => ({
                  id: i.id,
                  title: i.snippet.title,
                  video_id: i.contentDetails.videoId,
                  position: i.snippet.position,
                  etag: i.etag,
                })),
                id: playlist.playlist_id,
              };
            else if (body.action === "add") {
              const video = videoId(String(body.video || ""));
              if (!items.some((i) => i.contentDetails.videoId === video))
                await google("playlistItems?part=snippet", token, "POST", {
                  snippet: {
                    playlistId: playlist.playlist_id,
                    resourceId: { kind: "youtube#video", videoId: video },
                  },
                });
              result = { saved: true };
            } else if (body.action === "export") {
              const { data: tracks, error } = await admin()
                .from("entries")
                .select("details")
                .eq("space_id", member.space_id)
                .eq("kind", "track")
                .eq("visibility", "shared")
                .is("deleted_at", null);
              if (error)
                throw new Error(
                  "No se pudieron leer las canciones compartidas.",
                );
              const seen = new Set(items.map((i) => i.contentDetails.videoId));
              let added = 0;
              const videos: string[] = [];
              for (const track of tracks || []) {
                try {
                  const id = videoId(String(track.details?.link || ""));
                  if (!seen.has(id)) {
                    videos.push(id);
                    seen.add(id);
                  }
                } catch {
                  /* Spotify and empty links are not exported. */
                }
              }
              if (videos.length > 50)
                throw new Error(
                  "Exporta hasta 50 canciones nuevas por operación.",
                );
              for (const id of videos) {
                await google("playlistItems?part=snippet", token, "POST", {
                  snippet: {
                    playlistId: playlist.playlist_id,
                    resourceId: { kind: "youtube#video", videoId: id },
                  },
                });
                added++;
              }
              result = { added };
            } else if (body.action === "remove") {
              const item = items.find((i) => i.id === body.item_id);
              if (!item)
                throw new Error("El video ya no está en esta playlist.");
              if (body.etag !== item.etag)
                throw new Error(
                  "La playlist cambió. Actualiza antes de eliminar.",
                );
              await google(
                "playlistItems?id=" + encodeURIComponent(item.id),
                token,
                "DELETE",
                undefined,
                item.etag,
              );
              result = { removed: true };
            } else throw new Error("Acción no disponible.");
          }
        } finally {
          if (mutate) await service("unlock", uid);
        }
      }
    }
    return Response.json(result, { headers });
  } catch (e) {
    return Response.json(
      {
        error: e instanceof Error ? e.message : "No se pudo conectar YouTube.",
      },
      { status: 400, headers },
    );
  }
}
if (import.meta.main) Deno.serve(handler);
