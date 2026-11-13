import { useEffect, useState } from "react";
import { Camera, ImageOff, RotateCcw, Trash2 } from "lucide-react";
import { useAction, useSpace } from "../lib/store";
import { check, supabase } from "../lib/supabase";
import { readCaptureDate, uploadPhoto } from "../lib/images";
import { formatDate, localDay } from "../lib/utils";
import type { Entry, Photo } from "../lib/types";
import { PhotoImage } from "../pages/Vault";
import { Button, ErrorMessage, Modal } from "./ui";

export const NOTE_LIMIT = 1000;

/** The vault photo attached to a lived date, unless it was sent to the trash. */
export function datePhoto(entry: Entry, photos: Photo[]) {
  const id = entry.details.photo_id;
  return id ? photos.find((p) => p.id === id && !p.deleted_at) : undefined;
}

/**
 * Records a date as lived (or edits that memory): the day it happened, which may be in
 * the past, an optional photo that also lands in the Memory Vault, and a note for the
 * back of the polaroid.
 */
export function DateMemoryModal({
  entry,
  onClose,
}: {
  entry: Entry | null;
  onClose: () => void;
}) {
  const { data, spaceId, me } = useSpace();
  const action = useAction();
  const today = localDay(new Date(), me?.timezone || undefined);
  const [lived, setLived] = useState(today);
  const [dateTouched, setDateTouched] = useState(false);
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [keep, setKeep] = useState(true);
  const editing = entry?.status === "done";
  const current = entry ? datePhoto(entry, data!.photos) : undefined;

  useEffect(() => {
    if (!entry) return;
    setLived(entry.status === "done" ? entry.occurred_on : today);
    setDateTouched(entry.status === "done");
    setNote(String(entry.details.memory_note ?? ""));
    setFile(null);
    setKeep(true);
    action.setError("");
    // Reset only when a different date is opened.
  }, [entry?.id]);
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function pick(f: File | undefined) {
    setFile(f ?? null);
    if (!f || dateTouched) return;
    // Old photos usually know when they were taken: suggest that day.
    const taken = await readCaptureDate(f);
    if (taken) {
      const day = localDay(taken, me?.timezone || undefined);
      if (day <= today) setLived(day);
    }
  }

  async function save() {
    if (!entry) return;
    if (!lived || lived > today) {
      action.setError("Elige la fecha en que la vivieron (hoy o antes).");
      return;
    }
    await action.run(async () => {
      let photoId = keep && current ? current.id : null;
      if (file)
        photoId = await uploadPhoto({
          file,
          spaceId,
          title: entry.title,
          preferDate: new Date(lived + "T12:00:00"),
        });
      check(
        await supabase.rpc("complete_date", {
          p_entry_id: entry.id,
          p_lived_on: lived,
          p_note: note,
          p_photo_id: photoId,
        }),
      );
      // A replaced or removed photo goes to the vault's trash (recoverable), if it is ours.
      if (current && current.id !== photoId && current.uploaded_by === me.id)
        check(
          await supabase.rpc("trash_item", {
            p_table: "photos",
            p_id: current.id,
          }),
        );
    }, onClose);
  }

  const shown = preview || (keep && current);
  return (
    <Modal
      title={editing ? "Editar el recuerdo de la cita" : "¡La vivimos!"}
      open={!!entry}
      onOpenChange={(open) => !open && !action.busy && onClose()}
    >
      {entry && (
        <div className="form date-memory">
          <p className="muted">
            <strong>{entry.title}</strong>. La foto y la descripción son
            opcionales; pueden añadirlas o cambiarlas cuando quieran.
          </p>
          <label className="field">
            ¿Cuándo la vivieron?
            <input
              type="date"
              required
              max={today}
              value={lived}
              onChange={(e) => {
                setLived(e.target.value);
                setDateTouched(true);
              }}
            />
            <small className="muted">
              Si fue antes de usar Chimuverse, elige ese día.
            </small>
          </label>
          <div className="field">
            <span>Foto de la cita (opcional)</span>
            <div className="date-memory-photo">
              {shown ? (
                preview ? (
                  <img src={preview} alt="Foto elegida para la cita" />
                ) : (
                  <PhotoImage photo={current!} />
                )
              ) : (
                <span className="date-polaroid-empty">
                  <ImageOff size={26} aria-hidden />
                  Sin foto
                </span>
              )}
            </div>
            <div className="row gap wrap">
              <label className="btn btn-secondary file-button">
                <Camera size={17} aria-hidden />
                {shown ? "Cambiar foto" : "Elegir foto"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic"
                  onChange={(e) => void pick(e.target.files?.[0])}
                />
              </label>
              {shown && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setFile(null);
                    setKeep(false);
                  }}
                >
                  <Trash2 size={17} aria-hidden />
                  Quitar foto
                </Button>
              )}
              {!keep && current && !file && (
                <Button variant="ghost" onClick={() => setKeep(true)}>
                  <RotateCcw size={17} aria-hidden />
                  Recuperar la foto anterior
                </Button>
              )}
            </div>
            <small className="muted">
              Se guarda también en Recuerdos, comprimida y sin ubicación.
              {current && current.uploaded_by === me.id
                ? " Si la cambias o la quitas, la anterior va a la papelera."
                : ""}
            </small>
          </div>
          <label className="field">
            Lo que queremos recordar (va detrás de la polaroid)
            <textarea
              rows={4}
              maxLength={NOTE_LIMIT}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ese detalle que no queremos olvidar…"
            />
            <small className="muted">
              {note.length}/{NOTE_LIMIT}
            </small>
          </label>
          <ErrorMessage error={action.error} />
          <Button busy={action.busy} onClick={() => void save()}>
            {editing ? "Guardar cambios" : "Guardar el recuerdo"}
          </Button>
        </div>
      )}
    </Modal>
  );
}

/** A polaroid of a lived date: the photo in front, the note written on the back. */
export function DatePolaroid({
  entry,
  photo,
}: {
  entry: Entry;
  photo?: Photo;
}) {
  const [flipped, setFlipped] = useState(false);
  const note = String(entry.details.memory_note ?? "");
  const day = formatDate(entry.occurred_on);
  return (
    <button
      type="button"
      className={`date-polaroid ${flipped ? "flipped" : ""}`}
      aria-pressed={flipped}
      onClick={() => setFlipped((f) => !f)}
    >
      <span className="sr-only">
        {flipped ? "Ver la foto" : "Darle la vuelta a la polaroid"}:{" "}
      </span>
      <span className="date-polaroid-inner">
        <span className="date-polaroid-face front" aria-hidden={flipped}>
          {photo ? (
            <PhotoImage photo={photo} />
          ) : (
            <span className="date-polaroid-empty">
              <ImageOff size={26} aria-hidden />
              Falta la foto de este día
            </span>
          )}
          <small>
            <span>{day}</span>
            <span aria-hidden>↻</span>
          </small>
        </span>
        <span className="date-polaroid-face back" aria-hidden={!flipped}>
          <span className="date-polaroid-note">
            {note || "Todavía no escribimos nada sobre este día."}
          </span>
          <small>
            <span>{day}</span>
            <span aria-hidden>↻</span>
          </small>
        </span>
      </span>
    </button>
  );
}
