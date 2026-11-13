import { YouTubePlaylist } from "../components/YouTubePlaylist";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, Link } from "react-router-dom";
import {
  Download,
  LogOut,
  CloudOff,
  CalendarCheck,
  RefreshCw,
  Lock,
  RotateCcw,
  Check,
} from "lucide-react";
import { zipSync } from "fflate";
import { useSpace, useAction } from "../lib/store";
import { check, supabase } from "../lib/supabase";
import { download, localDay, formatDate } from "../lib/utils";
import {
  Button,
  ErrorMessage,
  PageHeading,
  VisibilityPill,
  Empty,
} from "../components/ui";
export default function Settings() {
  const { data, me } = useSpace();
  const action = useAction();
  const qc = useQueryClient();
  const { pathname } = useLocation();
  const tab = pathname.endsWith("conexiones")
    ? "Conexiones"
    : pathname.endsWith("datos")
      ? "Datos"
      : pathname.endsWith("papelera")
        ? "Papelera"
        : "Perfil";
  const [name, setName] = useState(me.display_name),
    [timezone, setTimezone] = useState(me.timezone),
    [bio, setBio] = useState(String(me.preferences.bio ?? "")),
    [favorites, setFavorites] = useState(
      String(me.preferences.favorites ?? ""),
    );
  const [saved, setSaved] = useState(false);
  const connection = useQuery({
    queryKey: ["google-status"],
    refetchInterval: 10000,
    queryFn: async () =>
      check(await supabase.rpc("google_status")) as {
        status: string;
        last_sync_at?: string;
        last_error?: string;
      },
  });
  async function calendar(
    actionName: string,
    body: Record<string, unknown> = {},
  ) {
    await action.run(async () => {
      const result = await supabase.functions.invoke("calendar", {
        body: { action: actionName, ...body },
      });
      if (result.error) {
        if (result.error.context instanceof Response) {
          const body = await result.error.context.json().catch(() => null);
          throw new Error(body?.error ?? "No se pudo conectar Calendar.");
        }
        throw result.error;
      }
      const d = result.data;
      if (d?.url) location.assign(d.url);
      if (d?.error) throw new Error(d.error);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["google-status"] }),
        qc.invalidateQueries({ queryKey: ["conflicts"] }),
      ]);
    });
  }
  const conflicts = useQuery({
    queryKey: ["conflicts"],
    enabled: tab === "Conexiones",
    queryFn: async () =>
      check(
        await supabase
          .from("calendar_conflicts")
          .select("*")
          .is("resolved_at", null),
      ),
  });
  const trash = [
    ...data!.entries
      .filter((e) => e.deleted_at && e.owner_id === me.id)
      .map((e) => ({ ...e, table: "entries" })),
    ...data!.photos
      .filter((e) => e.deleted_at && e.uploaded_by === me.id)
      .map((e) => ({ ...e, table: "photos" })),
    ...data!.calendar_events
      .filter((e) => e.deleted_at && e.owner_id === me.id)
      .map((e) => ({ ...e, table: "calendar_events" })),
  ];
  async function exportPhotos() {
    await action.run(async () => {
      const files: Record<string, Uint8Array> = {};
      for (const p of data!.photos.filter((p) => !p.deleted_at)) {
        const blob = check(
          await supabase.storage.from("photos").download(p.storage_path),
        )!;
        files[`${p.captured_at.slice(0, 10)}-${p.id}.webp`] = new Uint8Array(
          await blob.arrayBuffer(),
        );
      }
      if (!Object.keys(files).length)
        throw new Error("Todavía no hay fotos para descargar.");
      download(
        `chimuverse-fotos-${localDay()}.zip`,
        zipSync(files, { level: 0 }) as BlobPart,
        "application/zip",
      );
    });
  }
  return (
    <>
      <PageHeading
        eyebrow="NUESTRO ESPACIO"
        title="Ajustes"
        text="Un lugar que se siente un poquito más nuestro."
      />
      <nav className="segments route-tabs">
        {[
          ["/ajustes", "Perfil"],
          ["/ajustes/conexiones", "Conexiones"],
          ["/ajustes/datos", "Datos"],
          ["/ajustes/papelera", "Papelera"],
        ].map(([p, l]) => (
          <Link key={p} to={p} aria-current={l === tab ? "page" : undefined}>
            {l}
          </Link>
        ))}
      </nav>
      <ErrorMessage error={action.error} />
      {tab === "Perfil" ? (
        <section className="card settings-card">
          <h2>Tu pequeño universo</h2>
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              void action.run(
                async () =>
                  check(
                    await supabase
                      .from("profiles")
                      .update({
                        display_name: name.trim(),
                        timezone,
                        preferences: { ...me.preferences, bio, favorites },
                      })
                      .eq("id", me.id),
                  ),
                () => {
                  setSaved(true);
                  setTimeout(() => setSaved(false), 3000);
                },
              );
            }}
          >
            <label className="field">
              Cómo te llamamos
              <input
                required
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="field">
              Algo sobre ti
              <textarea
                value={bio}
                maxLength={1000}
                onChange={(e) => setBio(e.target.value)}
              />
            </label>
            <label className="field">
              Tus cosas favoritas
              <textarea
                value={favorites}
                maxLength={2000}
                onChange={(e) => setFavorites(e.target.value)}
                placeholder="Una comida, una canción, tu lugar feliz…"
              />
            </label>
            <p className="small muted">
              Tu perfil y tus gustos son visibles para tu pareja.
            </p>
            <label className="field">
              Tu zona horaria
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              >
                {[
                  "America/Lima",
                  "America/New_York",
                  "America/Bogota",
                  "America/Mexico_City",
                  "America/Argentina/Buenos_Aires",
                  "Europe/Madrid",
                  "UTC",
                ].map((z) => (
                  <option key={z}>{z}</option>
                ))}
              </select>
            </label>
            <Button type="submit" busy={action.busy}>
              {saved ? (
                <>
                  <Check size={18} />
                  Guardado
                </>
              ) : (
                "Guardar mi perfil"
              )}
            </Button>
          </form>
          <hr />
          <div className="row between wrap">
            <div>
              <h3>Notificaciones por correo</h3>
              <p className="muted">
                Próximamente. Las notificaciones internas ya tienen su espacio.
              </p>
            </div>
            <span className="pill">No disponible</span>
          </div>
          <hr />
          <Button
            variant="secondary"
            onClick={() => void supabase.auth.signOut()}
          >
            <LogOut size={18} />
            Cerrar sesión
          </Button>
        </section>
      ) : tab === "Conexiones" ? (
        <>
          <YouTubePlaylist manageConnection />
          <section className="card settings-card">
            <div className="row gap">
              {connection.data?.status === "connected" ? (
                <CalendarCheck size={30} />
              ) : (
                <CloudOff size={30} />
              )}
              <div>
                <h2>Google Calendar</h2>
                <p className="muted">
                  Una conexión individual, solo para tu calendario «Chimuverse».
                </p>
              </div>
            </div>
            <ErrorMessage error={connection.error} />
            <p>
              Estado:{" "}
              <strong>
                {{
                  connected: "Conectado",
                  disconnected: "Sin conectar",
                  error: "Requiere atención",
                }[connection.data?.status ?? "disconnected"] ??
                  connection.data?.status}
              </strong>
            </p>
            {connection.data?.last_sync_at && (
              <p>
                Última sincronización:{" "}
                {formatDate(connection.data.last_sync_at, {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            )}
            {connection.data?.last_error && (
              <div className="banner error">{connection.data.last_error}</div>
            )}
            {connection.data?.status === "disconnected" && (
              <div className="banner">
                <Lock size={20} />
                Iniciar sesión con Google no concede acceso a Calendar. La
                conexión no lee tus otros calendarios ni comparte reuniones
                personales.
              </div>
            )}
            <div className="row gap wrap">
              {(connection.data?.status === "disconnected" ||
                connection.data?.status === "error") && (
                <Button busy={action.busy} onClick={() => calendar("connect")}>
                  {connection.data.status === "error"
                    ? "Reconectar Google Calendar"
                    : "Conectar mi Google Calendar"}
                </Button>
              )}
              {connection.data && connection.data.status !== "disconnected" && (
                <>
                  <Button
                    variant="secondary"
                    busy={action.busy}
                    onClick={() => calendar("sync")}
                  >
                    <RefreshCw size={17} />
                    Traer cambios de Google
                  </Button>
                  <Button
                    variant="danger"
                    busy={action.busy}
                    onClick={() => calendar("disconnect")}
                  >
                    Desconectar
                  </Button>
                </>
              )}
            </div>
            {connection.data?.status === "connected" && (
              <p className="small muted">
                Los cambios de Our Calendar se envían automáticamente. Usa
                «Traer cambios de Google» si modificaste tu horario desde
                Google.
              </p>
            )}
            <h3>Conflictos por revisar</h3>
            {conflicts.data?.length ? (
              conflicts.data.map((c) => {
                const event = data!.calendar_events.find(
                  (e) => e.id === c.event_id,
                );
                return (
                  <div className="card" key={c.id}>
                    <div className="compare-grid">
                      <div>
                        <small>Chimuverse</small>
                        <h3>{event?.title}</h3>
                        <p>
                          {event?.start_at &&
                            formatDate(event.start_at, {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                        </p>
                        <p>{event?.description}</p>
                      </div>
                      <div>
                        <small>Google</small>
                        <h3>{c.remote_event.summary}</h3>
                        <p>
                          {c.remote_event.start?.dateTime ??
                            c.remote_event.start?.date}
                        </p>
                        <p>{c.remote_event.description}</p>
                        {c.remote_event.status === "cancelled" && (
                          <strong>Eliminado en Google</strong>
                        )}
                      </div>
                    </div>
                    <div className="row gap wrap">
                      <Button
                        busy={action.busy}
                        onClick={() =>
                          calendar("resolve", {
                            conflict_id: c.id,
                            choice: "local",
                          })
                        }
                      >
                        Mantener Chimuverse
                      </Button>
                      <Button
                        variant="secondary"
                        busy={action.busy}
                        onClick={() =>
                          calendar("resolve", {
                            conflict_id: c.id,
                            choice: "remote",
                          })
                        }
                      >
                        Usar la de Google
                      </Button>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="muted">No hay conflictos pendientes.</p>
            )}
            <ErrorMessage error={conflicts.error} />
          </section>
        </>
      ) : tab === "Datos" ? (
        <section className="card settings-card">
          <h2>Lo nuestro, también en tus manos</h2>
          <p className="muted">
            La exportación incluye los registros compartidos entre los dos. El
            contenido de las cápsulas selladas estará disponible en su fecha de
            apertura.
          </p>
          <div className="row gap wrap">
            <Button
              variant="secondary"
              onClick={() =>
                download(
                  `chimuverse-${localDay()}.json`,
                  JSON.stringify(
                    { exported_at: new Date().toISOString(), ...data },
                    null,
                    2,
                  ),
                )
              }
            >
              <Download size={18} />
              Exportar mis datos (JSON)
            </Button>
            <Button
              variant="secondary"
              busy={action.busy}
              onClick={exportPhotos}
            >
              <Download size={18} />
              Descargar fotos (ZIP)
            </Button>
          </div>
          <p className="small muted">
            Los archivos ZIP se preparan en tu navegador. Descarga por álbum si
            tu biblioteca es muy grande.
          </p>
          <hr />
          <h3>Almacenamiento visible</h3>
          <p>
            {(
              data!.photos
                .filter((p) => !p.deleted_at)
                .reduce((s, p) => s + p.size_bytes, 0) /
              1024 /
              1024
            ).toFixed(1)}{" "}
            MB en fotos que puedes consultar.
          </p>
          <h3>Copias de seguridad</h3>
          <p className="muted">
            Conserva tus exportaciones en un lugar privado y cifrado. No se
            suben automáticamente a ningún otro servicio.
          </p>
        </section>
      ) : (
        <section className="card settings-card">
          <h2>Un momento para pensarlo</h2>
          <p className="muted">
            Los elementos enviados a la papelera pueden restaurarse. La purga
            automática no está activada.
          </p>
          {trash.length ? (
            trash.map((e) => (
              <div className="trash-row row between" key={e.id}>
                <div>
                  <h3>{e.title}</h3>
                  <VisibilityPill value={e.visibility} />
                </div>
                <Button
                  variant="secondary"
                  busy={action.busy}
                  onClick={() =>
                    action.run(async () =>
                      check(
                        await supabase.rpc("trash_item", {
                          p_table: e.table,
                          p_id: e.id,
                          p_restore: true,
                        }),
                      ),
                    )
                  }
                >
                  <RotateCcw size={17} />
                  Restaurar
                </Button>
              </div>
            ))
          ) : (
            <Empty
              title="La papelera está vacía"
              text="Los recuerdos que decidas quitar tendrán aquí una segunda oportunidad."
            />
          )}
        </section>
      )}
    </>
  );
}
