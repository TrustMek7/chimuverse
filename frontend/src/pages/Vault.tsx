import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams, useLocation } from "react-router-dom";
import { Plus, Images, Upload, Trash2, Download, Lock } from "lucide-react";
import { useSpace, useAction } from "../lib/store";
import { supabase, check } from "../lib/supabase";
import { preparePhoto } from "../lib/images";
import { formatDate, download } from "../lib/utils";
import type { Photo, Visibility } from "../lib/types";
import {
  Button,
  PageHeading,
  Modal,
  ErrorMessage,
  Empty,
  VisibilityPicker,
  VisibilityPill,
} from "../components/ui";
export function PhotoImage({
  photo,
  full = false,
}: {
  photo: Photo;
  full?: boolean;
}) {
  const query = useQuery({
    queryKey: ["photo-url", photo.id, full],
    queryFn: async () =>
      check(
        await supabase.storage
          .from("photos")
          .createSignedUrl(full ? photo.storage_path : photo.thumb_path, 600),
      )!.signedUrl,
    staleTime: 480000,
    refetchInterval: 480000,
  });
  return query.isError ? (
    <span className="image-error">No se pudo cargar la foto.</span>
  ) : query.data ? (
    <img src={query.data} alt={photo.title} loading="lazy" />
  ) : (
    <div className="photo-skeleton" aria-label="Cargando foto" />
  );
}
type UploadItem = {
  file: File;
  state: "pending" | "uploading" | "done" | "error";
  error?: string;
};
export default function Vault() {
  const { data, spaceId, me } = useSpace();
  const [params, setParams] = useSearchParams();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(params.has("crear"));
  const [title, setTitle] = useState("");
  const [captured, setCaptured] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("private");
  const [trip, setTrip] = useState(params.get("viaje") ?? "");
  const [items, setItems] = useState<UploadItem[]>([]);
  const [selected, setSelected] = useState<Photo | null>(null);
  const [filter, setFilter] = useState("Todas");
  const action = useAction();
  const photos = data!.photos
    .filter(
      (p) =>
        !p.deleted_at &&
        (!trip || p.trip_id === trip) &&
        (filter !== "Solo yo" ||
          (p.uploaded_by === me.id && p.visibility === "private")) &&
        (filter !== "Compartidas" || p.visibility === "shared"),
    )
    .sort((a, b) => b.captured_at.localeCompare(a.captured_at));
  const trips = data!.entries.filter((e) => e.kind === "trip" && !e.deleted_at);
  function update(index: number, patch: Partial<UploadItem>) {
    setItems((old) =>
      old.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }
  async function upload(index: number) {
    const item = items[index];
    if (item.state === "done") return;
    update(index, { state: "uploading", error: undefined });
    const id = crypto.randomUUID();
    const base = `${spaceId}/${id}`;
    let created = false;
    try {
      const image = await preparePhoto(item.file);
      const date =
        image.captured ??
        (captured ? new Date(captured + "T12:00:00") : undefined);
      if (!date || !Number.isFinite(date.getTime()))
        throw new Error(
          "Esta foto no tiene fecha EXIF. Indica la fecha del recuerdo.",
        );
      check(
        await supabase.storage
          .from("photos")
          .upload(`${base}/full.webp`, image.full.blob, {
            contentType: "image/webp",
            upsert: false,
          }),
      );
      created = true;
      check(
        await supabase.storage
          .from("photos")
          .upload(`${base}/thumb.webp`, image.thumb.blob, {
            contentType: "image/webp",
            upsert: false,
          }),
      );
      check(
        await supabase.from("photos").insert({
          id,
          space_id: spaceId,
          title: title.trim() || item.file.name.replace(/\.[^.]+$/, ""),
          storage_path: `${base}/full.webp`,
          thumb_path: `${base}/thumb.webp`,
          captured_at: date.toISOString(),
          captured_at_source: image.captured ? "exif" : "manual",
          visibility,
          trip_id: trip || null,
          size_bytes: image.full.blob.size + image.thumb.blob.size,
          width: image.full.width,
          height: image.full.height,
        }),
      );
      update(index, { state: "done" });
    } catch (e) {
      if (created)
        await supabase.storage
          .from("photos")
          .remove([`${base}/full.webp`, `${base}/thumb.webp`]);
      update(index, {
        state: "error",
        error: e instanceof Error ? e.message : "No se pudo subir.",
      });
    }
  }
  async function uploadAll() {
    await action.run(async () => {
      for (let i = 0; i < items.length; i++)
        if (items[i].state !== "done") await upload(i);
    });
  }
  function close(v: boolean) {
    if (action.busy) return;
    setOpen(v);
    if (!v) {
      params.delete("crear");
      setParams(params, { replace: true });
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="RECUERDOS"
        title={
          pathname.includes("linea-de-tiempo")
            ? "Nuestra línea del tiempo"
            : "Memory Vault"
        }
        text="Algunos instantes merecen quedarse para siempre."
        actions={
          <Button
            onClick={() => {
              setItems([]);
              setOpen(true);
            }}
          >
            <Plus size={18} />
            Guardar un recuerdo
          </Button>
        }
      />
      <div className="toolbar">
        <div className="segments route-tabs">
          <Link
            to="/recuerdos/vault"
            aria-current={pathname === "/recuerdos/vault" ? "page" : undefined}
          >
            Todos los recuerdos
          </Link>
          <Link to="/recuerdos/viajes">Viajes</Link>
          <Link
            to="/recuerdos/linea-de-tiempo"
            aria-current={
              pathname.includes("linea-de-tiempo") ? "page" : undefined
            }
          >
            Línea del tiempo
          </Link>
        </div>
        <select
          aria-label="Filtrar por viaje"
          value={trip}
          onChange={(e) => setTrip(e.target.value)}
        >
          <option value="">Todos los viajes</option>
          {trips.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      </div>
      <div className="segments">
        {["Todas", "Solo yo", "Compartidas"].map((f) => (
          <button
            key={f}
            aria-pressed={f === filter}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>
      <ErrorMessage error={action.error} />
      {photos.length ? (
        <div
          className={`photo-grid ${pathname.includes("linea-de-tiempo") ? "photo-timeline" : ""}`}
        >
          {photos.map((p, i) => (
            <button
              className="polaroid"
              style={{ rotate: `${[-2, 1.5, -1, 2][i % 4]}deg` }}
              key={p.id}
              onClick={() => setSelected(p)}
            >
              <PhotoImage photo={p} />
              <p>{p.title}</p>
              <div className="row between">
                <small>{formatDate(p.captured_at)}</small>
                <VisibilityPill value={p.visibility} />
              </div>
            </button>
          ))}
        </div>
      ) : (
        <Empty
          title="Aquí vivirán nuestros recuerdos"
          text="Guarda una foto, su fecha y ese detalle que la hace especial. Las fotos nuevas empiezan como Solo yo."
        >
          <Button variant="secondary" onClick={() => setOpen(true)}>
            <Images size={18} />
            Nuestro primer recuerdo
          </Button>
        </Empty>
      )}
      <Modal title="Guardar un instante" open={open} onOpenChange={close}>
        <div className="form">
          <div className="banner">
            <Lock size={18} />
            Las fotos se comprimen y se eliminan los metadatos de ubicación
            antes de subirlas.
          </div>
          <label className="upload-zone">
            <Upload size={32} />
            <strong>Elige hasta 50 fotos</strong>
            <span>JPEG, PNG o WebP · máximo 25 MB por foto</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              multiple
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                if (files.length > 50) {
                  action.setError(
                    "Puedes subir como máximo 50 fotos por lote.",
                  );
                  return;
                }
                setItems(files.map((file) => ({ file, state: "pending" })));
              }}
            />
          </label>
          <label className="field">
            Título (opcional; si está vacío se usa el nombre del archivo)
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={160}
            />
          </label>
          <label className="field">
            Fecha del recuerdo (obligatoria si no viene en la foto)
            <input
              type="date"
              value={captured}
              onChange={(e) => setCaptured(e.target.value)}
            />
          </label>
          <label className="field">
            Álbum de viaje
            <select value={trip} onChange={(e) => setTrip(e.target.value)}>
              <option value="">Sin viaje</option>
              {trips.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </label>
          <VisibilityPicker value={visibility} onChange={setVisibility} />
          <ErrorMessage error={action.error} />
          <ul className="upload-list">
            {items.map((item, i) => (
              <li key={i}>
                <span>
                  {item.file.name}
                  <small role={item.state === "error" ? "alert" : undefined}>
                    {item.error ??
                      {
                        pending: "Lista para subir",
                        uploading: "Comprimiendo y subiendo…",
                        done: "Guardada",
                        error: "Error",
                      }[item.state]}
                  </small>
                </span>
                {item.state === "error" && (
                  <Button
                    variant="secondary"
                    disabled={action.busy}
                    onClick={() => action.run(() => upload(i))}
                  >
                    Reintentar
                  </Button>
                )}
                {item.state === "done" && <span>✓</span>}
              </li>
            ))}
          </ul>
          <Button
            busy={action.busy}
            disabled={!items.length || items.every((i) => i.state === "done")}
            onClick={uploadAll}
          >
            Guardar {items.filter((i) => i.state !== "done").length} recuerdos
          </Button>
          {items.length > 0 && items.every((i) => i.state === "done") && (
            <p role="status">Todos los recuerdos están guardados.</p>
          )}
        </div>
      </Modal>
      <Modal
        title={selected?.title ?? "Recuerdo"}
        open={!!selected}
        onOpenChange={() => setSelected(null)}
      >
        {selected && (
          <>
            <div className="photo-detail">
              <PhotoImage photo={selected} full />
            </div>
            <VisibilityPill value={selected.visibility} />
            <p>Fecha del recuerdo: {formatDate(selected.captured_at)}</p>
            <small className="muted">
              Guardado el {formatDate(selected.uploaded_at)}
            </small>
            <div className="row gap wrap">
              <Button
                variant="secondary"
                busy={action.busy}
                onClick={() =>
                  action.run(async () => {
                    const blob = check(
                      await supabase.storage
                        .from("photos")
                        .download(selected.storage_path),
                    )!;
                    download(`${selected.title}.webp`, blob, "image/webp");
                  })
                }
              >
                <Download size={17} />
                Descargar
              </Button>
              {selected.uploaded_by === me.id && (
                <Button
                  variant="danger"
                  busy={action.busy}
                  onClick={() =>
                    action.run(
                      async () =>
                        check(
                          await supabase.rpc("trash_item", {
                            p_table: "photos",
                            p_id: selected.id,
                          }),
                        ),
                      () => setSelected(null),
                    )
                  }
                >
                  <Trash2 size={17} />
                  Papelera
                </Button>
              )}
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
