import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { download } from "../lib/utils";
import { Button, ErrorMessage } from "./ui";
type Item = { id: string; title: string; video_id: string; etag: string };
async function youtube(action: string, body: Record<string, unknown> = {}) {
  const result = await supabase.functions.invoke("youtube", {
    body: { action, ...body },
  });
  if (result.error) {
    const detail =
      result.error.context instanceof Response
        ? await result.error.context.json().catch(() => null)
        : null;
    throw new Error(
      detail?.error || "No se pudo completar la conexión de YouTube.",
    );
  }
  if (result.data?.error) throw new Error(result.data.error);
  return result.data;
}
export function YouTubePlaylist({
  manageConnection = false,
}: {
  manageConnection?: boolean;
}) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  const [title, setTitle] = useState("Nuestro soundtrack"),
    [video, setVideo] = useState(""),
    [confirm, setConfirm] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false),
    [notice, setNotice] = useState("");
  const status = useQuery({
    queryKey: ["youtube-status"],
    queryFn: () => youtube("status"),
    refetchInterval: 60000,
    retry: false,
  });
  const playlist = status.data?.playlist as
    | { id: string; title: string; owner: boolean; available: boolean }
    | null
    | undefined;
  const items = useQuery({
    queryKey: ["youtube-items", playlist?.id],
    queryFn: async () => (await youtube("list")).items as Item[],
    enabled: !!playlist?.available,
    refetchInterval: 60000,
    retry: false,
  });
  const mine = useQuery({
    queryKey: ["youtube-mine"],
    queryFn: async () =>
      (await youtube("mine")).playlists as { id: string; title: string }[],
    enabled: choosing && !!status.data?.connected,
    retry: false,
  });
  const expired =
    items.error instanceof Error &&
    /reconecta|renovar el permiso/i.test(items.error.message);
  const needsOwner = !!playlist && (!playlist.available || expired);
  const showConnection =
    manageConnection || !playlist || (needsOwner && playlist.owner);
  async function run(action: string, body: Record<string, unknown> = {}) {
    setBusy(true);
    setError(null);
    setNotice("");
    try {
      const result = await youtube(action, body);
      if (result.url) location.assign(result.url);
      if (action === "add") setVideo("");
      if (action === "export")
        setNotice(
          `${result.added} canciones añadidas. Las existentes se conservan.`,
        );
      setConfirm(null);
      await qc.invalidateQueries({ queryKey: ["youtube-status"] });
    } catch (e) {
      setError(e);
    } finally {
      await qc.invalidateQueries({ queryKey: ["youtube-items"] });
      setBusy(false);
    }
  }
  return (
    <section
      className="card settings-card youtube-playlist"
      aria-label="Playlist compartida de YouTube"
    >
      <h2>YouTube · Nuestro soundtrack</h2>
      <p>
        Una playlist para los dos. Las canciones que añadan aquí se guardan en
        YouTube.
      </p>
      <ErrorMessage
        error={error || status.error || items.error || mine.error}
      />
      {notice && <p role="status">{notice}</p>}
      {status.isPending ? (
        <p>Cargando conexión…</p>
      ) : (
        <>
          {showConnection && (
            <p>
              Mi cuenta:{" "}
              <strong>
                {needsOwner && playlist?.owner
                  ? "Requiere reconexión"
                  : status.data?.connected
                    ? "Conectada"
                    : "Sin conectar"}
              </strong>
            </p>
          )}
          <div className="row gap wrap">
            {showConnection &&
            (!playlist || playlist.owner || manageConnection) &&
            (!status.data?.connected || expired) ? (
              <Button disabled={busy} onClick={() => void run("connect")}>
                {needsOwner ? "Reconectar mi YouTube" : "Conectar mi YouTube"}
              </Button>
            ) : manageConnection && status.data?.connected ? (
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => void run("disconnect")}
              >
                Desconectar mi YouTube
              </Button>
            ) : null}
            {playlist?.available && !expired && (
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  void status.refetch();
                  if (playlist?.available) void items.refetch();
                }}
              >
                Traer cambios de YouTube
              </Button>
            )}
          </div>
          {!playlist && !status.data?.connected && !status.isError && (
            <p className="banner" role="status">
              Conecta tu cuenta de YouTube para crear nuestra playlist o
              importar una de tu canal.
            </p>
          )}
          {!playlist && status.data?.connected && (
            <>
              <label>
                Nombre de nuestra playlist
                <input
                  value={title}
                  maxLength={150}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <p className="small muted">
                La playlist será no listada: ambos podrán verla con el enlace.
                Cualquier otra persona que reciba el enlace también podrá verla.
                Para editar también desde YouTube, activen allí la colaboración.
              </p>
              <div className="row gap wrap">
                <Button
                  disabled={busy || !title.trim()}
                  onClick={() =>
                    void run("create", { title, privacy: "unlisted" })
                  }
                >
                  Crear nuestra playlist en YouTube
                </Button>
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => setChoosing(!choosing)}
                >
                  Importar una playlist de mi canal
                </Button>
              </div>
              {choosing && (
                <div>
                  {mine.isPending ? (
                    <p>Cargando playlists…</p>
                  ) : mine.data?.length ? (
                    mine.data.map((p) => (
                      <p key={p.id}>
                        <Button
                          variant="secondary"
                          disabled={busy}
                          onClick={() => void run("import", { id: p.id })}
                        >
                          {p.title}
                        </Button>
                      </p>
                    ))
                  ) : (
                    <p>No hay playlists en tu canal.</p>
                  )}
                </div>
              )}
            </>
          )}
          {playlist && (
            <>
              <h3>{playlist.title}</h3>
              <p>
                <a
                  href={`https://www.youtube.com/playlist?list=${encodeURIComponent(playlist.id)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir playlist en YouTube ↗
                </a>
              </p>
              <details className="small muted">
                <summary>Colaborar también desde YouTube</summary>
                <p>
                  Para editar directamente en YouTube: el propietario abre la
                  playlist → Compartir → Invitar colaboradores, y comparte ese
                  enlace con la otra cuenta. YouTube no permite enviar estas
                  invitaciones por correo desde su API.
                </p>
              </details>
              {needsOwner ? (
                <p className="banner" role="status">
                  {playlist.owner
                    ? "Reconecta tu cuenta para continuar editando nuestra playlist."
                    : "El propietario debe reconectar su cuenta para que ambos puedan editar. No necesitas conectar la tuya."}
                </p>
              ) : (
                <>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void run("add", { video });
                    }}
                  >
                    <label>
                      Enlace del video de YouTube
                      <input
                        type="url"
                        required
                        value={video}
                        placeholder="https://www.youtube.com/watch?v=…"
                        onChange={(e) => setVideo(e.target.value)}
                      />
                    </label>
                    <Button type="submit" disabled={busy || !video.trim()}>
                      Añadir a nuestra playlist
                    </Button>
                  </form>
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void run("export")}
                  >
                    Exportar canciones compartidas a YouTube
                  </Button>
                  <p className="small muted">
                    Se exportan solo canciones compartidas con enlace de
                    YouTube, sin duplicarlas. Quitar una canción aquí también la
                    quita de esta playlist en YouTube.
                  </p>
                  {items.isPending ? (
                    <p>Cargando canciones…</p>
                  ) : (
                    <ol>
                      {items.data?.map((item) => (
                        <li key={item.id}>
                          <div className="row gap wrap">
                            <a
                              href={`https://www.youtube.com/watch?v=${encodeURIComponent(item.video_id)}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {item.title}
                            </a>
                            <Button
                              variant="secondary"
                              disabled={busy}
                              onClick={() =>
                                confirm === item.id
                                  ? void run("remove", {
                                      item_id: item.id,
                                      etag: item.etag,
                                    })
                                  : setConfirm(item.id)
                              }
                            >
                              {confirm === item.id
                                ? "Confirmar quitar de YouTube"
                                : "Quitar"}
                            </Button>
                            {confirm === item.id && (
                              <Button
                                variant="secondary"
                                onClick={() => setConfirm(null)}
                              >
                                Cancelar
                              </Button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                  {items.data?.length === 0 && (
                    <p>La primera canción los espera.</p>
                  )}
                  <Button
                    variant="secondary"
                    disabled={!items.data}
                    onClick={() =>
                      download(
                        "nuestro-soundtrack.json",
                        JSON.stringify(items.data, null, 2),
                        "application/json",
                      )
                    }
                  >
                    Exportar lista a JSON
                  </Button>
                </>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
