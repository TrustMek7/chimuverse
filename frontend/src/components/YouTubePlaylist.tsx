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
export function YouTubePlaylist() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  const [title, setTitle] = useState("Nuestro soundtrack"),
    [privacy, setPrivacy] = useState("unlisted"),
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
      className="card settings-card"
      aria-label="Playlist compartida de YouTube"
    >
      <h2>YouTube · Nuestro soundtrack</h2>
      <p>
        Una playlist para los dos. Los cambios que hagan aquí se guardan
        directamente en YouTube; los de YouTube aparecen al actualizar o en un
        minuto.
      </p>
      <ErrorMessage
        error={error || status.error || items.error || mine.error}
      />
      {notice && <p role="status">{notice}</p>}
      {status.isPending ? (
        <p>Cargando conexión…</p>
      ) : (
        <>
          <p>
            Mi cuenta:{" "}
            <strong>
              {status.data?.connected ? "Conectada" : "Sin conectar"}
            </strong>
          </p>
          <div className="row gap wrap">
            {!status.data?.connected ? (
              <Button disabled={busy} onClick={() => void run("connect")}>
                Conectar mi YouTube
              </Button>
            ) : (
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => void run("disconnect")}
              >
                Desconectar mi YouTube
              </Button>
            )}
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => {
                void status.refetch();
                void items.refetch();
              }}
            >
              Traer cambios de YouTube
            </Button>
          </div>
          {!status.data?.connected && (
            <p className="small muted">
              Solicitaremos permiso para administrar playlists, independiente
              del acceso a Calendar. Google puede mostrar permisos más amplios;
              la app solo opera sobre la playlist que elijan.
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
              <label>
                Visibilidad en YouTube
                <select
                  value={privacy}
                  onChange={(e) => setPrivacy(e.target.value)}
                >
                  <option value="unlisted">
                    No listada · cualquiera con el enlace puede verla
                  </option>
                  <option value="private">
                    Privada · visible en YouTube solo para el propietario
                  </option>
                </select>
              </label>
              <p className="small muted">
                En Chimuverse ambos pueden editarla. Para colaborar también
                desde YouTube, elijan «No listada» y activen la colaboración
                allí.
              </p>
              <div className="row gap wrap">
                <Button
                  disabled={busy || !title.trim()}
                  onClick={() => void run("create", { title, privacy })}
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
              <p className="small muted">
                Para editar directamente en YouTube: el propietario abre la
                playlist → Compartir → Invitar colaboradores, y comparte ese
                enlace con la otra cuenta. YouTube no permite enviar estas
                invitaciones por correo desde su API.
              </p>
              {!playlist.available ? (
                <p>
                  El propietario debe reconectar su cuenta para que ambos puedan
                  editar.
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
