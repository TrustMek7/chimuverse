import { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import FullCalendar from "@fullcalendar/react";
import dayGrid from "@fullcalendar/daygrid";
import list from "@fullcalendar/list";
import interaction from "@fullcalendar/interaction";

import luxon from "@fullcalendar/luxon3";
import es from "@fullcalendar/core/locales/es";
import { DateTime } from "luxon";
import { useQuery } from "@tanstack/react-query";
import { Plus, CloudOff, CalendarCheck, Pencil, Trash2 } from "lucide-react";
import { useSpace, useAction } from "../lib/store";
import { check, supabase } from "../lib/supabase";
import type { CalendarEvent } from "../lib/types";
import { localDay, formatDate } from "../lib/utils";
import {
  blankRepeat,
  parseRepeat,
  makeRecurrence,
  recurrenceString,
  recurrenceText,
  seriesOccurrences,
  weekDays,
  type RepeatDraft,
} from "../lib/recurrence";
import {
  Button,
  Modal,
  PageHeading,
  ErrorMessage,
  VisibilityPill,
} from "../components/ui";
type Draft = {
  title: string;
  description: string;
  start: string;
  end: string;
  kind: string;
  repeat: RepeatDraft;
  zone: string;
  all_day: boolean;
};
function localInput(value: string, zone: string, allDay = false) {
  return allDay
    ? value.slice(0, 10) + "T00:00"
    : DateTime.fromISO(value, { zone }).toFormat("yyyy-MM-dd'T'HH:mm");
}
export default function Calendar() {
  const { data, spaceId, me } = useSpace();
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(params.has("crear"));
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const [occurrence, setOccurrence] = useState<{
    start: string;
    end: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [view, setView] = useState("month");
  const [range, setRange] = useState({
    from: new Date(
      new Date().getFullYear(),
      new Date().getMonth() - 1,
      1,
    ).toISOString(),
    to: new Date(
      new Date().getFullYear(),
      new Date().getMonth() + 2,
      1,
    ).toISOString(),
  });
  const [visibleDate, setVisibleDate] = useState(new Date().toISOString());
  const action = useAction();
  const google = useQuery({
    queryKey: ["google-status"],
    refetchInterval: 10000,
    queryFn: async () =>
      check(await supabase.rpc("google_status")) as {
        status: string;
        auto_sync_pending?: boolean;
      },
  });
  const blank = (date = localDay(new Date(), me.timezone)): Draft => ({
    title: params.get("titulo") ?? "",
    description: "",
    start: date + "T18:00",
    end: date + "T19:00",
    kind: "event",
    repeat: {
      ...blankRepeat(),
      days: [weekDays[DateTime.fromISO(date).weekday - 1][0]],
    },
    zone: me.timezone,
    all_day: false,
  });
  const [draft, setDraft] = useState<Draft>(() => blank());
  const events = data!.calendar_events.filter((e) => !e.deleted_at);
  function field<K extends keyof Draft>(k: K, v: Draft[K]) {
    setDraft((d) => ({ ...d, [k]: v }));
  }
  function create(date?: string) {
    setEditing(null);
    setDraft(blank(date));
    action.setError("");
    setOpen(true);
  }
  function close(v: boolean) {
    setOpen(v);
    if (!v) {
      params.delete("crear");
      params.delete("titulo");
      setParams(params, { replace: true });
    }
  }
  async function save() {
    if (new Date(draft.end) <= new Date(draft.start)) {
      action.setError("El final debe ser posterior al inicio.");
      return;
    }
    const start = draft.all_day
      ? new Date(draft.start.slice(0, 10) + "T00:00:00Z")
      : DateTime.fromISO(draft.start, { zone: draft.zone }).toJSDate();
    let end = draft.all_day
      ? new Date(draft.end.slice(0, 10) + "T00:00:00Z")
      : DateTime.fromISO(draft.end, { zone: draft.zone }).toJSDate();
    if (draft.all_day && end <= start)
      end = new Date(start.getTime() + 86400000);
    let recurrence: string[];
    try {
      recurrence = makeRecurrence(
        draft.repeat,
        draft.start,
        draft.zone,
        draft.all_day,
        events.find((e) => e.id === editing)?.recurrence ?? [],
      );
    } catch (e) {
      action.setError(e instanceof Error ? e.message : "Revisa la repetición.");
      return;
    }
    const payload = {
      space_id: spaceId,
      title: draft.title.trim(),
      description: draft.description,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      visibility: "shared",
      kind: draft.kind,
      annual: false,
      recurrence,
      recurrence_timezone: draft.zone,
      all_day: draft.all_day,
    };
    await action.run(
      async () =>
        check(
          await (editing
            ? supabase.from("calendar_events").update(payload).eq("id", editing)
            : supabase.from("calendar_events").insert(payload)),
        ),
      () => close(false),
    );
  }
  return (
    <>
      <PageHeading
        eyebrow="NUESTRO DÍA"
        title="Our Calendar"
        text="Guardemos un ratito para nosotros."
        actions={
          <Button onClick={() => create()}>
            <Plus size={18} />
            Nuevo evento
          </Button>
        }
      />
      <div className="segments route-tabs">
        <Link to="/dia/quests">Daily Quests</Link>
        <Link to="/dia/calendario" aria-current="page">
          Calendario
        </Link>
      </div>
      {(google.data?.status === "disconnected" ||
        google.data?.status === "error") && (
        <div className="banner calendar-banner">
          <CloudOff size={20} />
          <span>
            {google.data.status === "error"
              ? "Google Calendar necesita atención. Tus eventos siguen guardados aquí."
              : "Conecta Google Calendar una vez y tus horarios se exportarán automáticamente."}
          </span>
          <Link to="/ajustes/conexiones" className="text-link">
            {google.data.status === "error"
              ? "Revisar conexión →"
              : "Conectar Google Calendar →"}
          </Link>
        </div>
      )}
      {google.data?.status === "connected" && (
        <p className="small muted row gap-sm" role="status">
          <CalendarCheck size={17} />
          {google.data.auto_sync_pending
            ? "Enviando cambios a Google Calendar…"
            : "Google Calendar conectado · exportación automática"}
        </p>
      )}
      <ErrorMessage error={action.error} />
      <div className="toolbar">
        <div className="segments">
          <button
            aria-pressed={view === "month"}
            onClick={() => setView("month")}
          >
            Mes
          </button>
          <button
            aria-pressed={view === "agenda"}
            onClick={() => setView("agenda")}
          >
            Agenda
          </button>
        </div>
        <span className="small muted">Zona horaria: {me.timezone}.</span>
      </div>
      <section
        className={`card calendar-card ${view === "month" ? "month-view" : ""}`}
      >
        <FullCalendar
          key={view}
          plugins={[dayGrid, list, interaction, luxon]}
          timeZone={me.timezone}
          initialView={view === "month" ? "dayGridMonth" : "listMonth"}
          noEventsContent="Todavía no hay planes en estas fechas."
          locale={es}
          firstDay={1}
          height="auto"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "",
          }}
          events={events.flatMap((e) => {
            const exceptions =
              data!.calendar_overrides?.filter((o) => o.event_id === e.id) ??
              [];
            const from = new Date(range.from),
              to = new Date(range.to);
            const occurrences = seriesOccurrences(
              e,
              from,
              to,
              exceptions.map((o) => o.original_start),
            );
            const changed = exceptions
              .filter(
                (o) =>
                  !o.cancelled &&
                  o.start_at &&
                  o.end_at &&
                  new Date(o.start_at) < to &&
                  new Date(o.end_at) > from,
              )
              .map((o) => ({
                start: new Date(o.start_at!),
                end: new Date(o.end_at!),
                title: o.title ?? e.title,
              }));
            return [
              ...occurrences.map((o) => ({ ...o, title: e.title })),
              ...changed,
            ].map((o) => ({
              id: e.id + ":" + o.start.toISOString(),
              extendedProps: { series_id: e.id },
              title: o.title,
              start: e.all_day
                ? o.start.toISOString().slice(0, 10)
                : o.start.toISOString(),
              end: e.all_day
                ? o.end.toISOString().slice(0, 10)
                : o.end.toISOString(),
              allDay: e.all_day,
              backgroundColor: e.kind === "special" ? "#B8255E" : "#137B6D",
            }));
          })}
          initialDate={visibleDate}
          datesSet={(info) => {
            setVisibleDate(info.view.currentStart.toISOString());
            setRange((old) =>
              old.from === info.start.toISOString() &&
              old.to === info.end.toISOString()
                ? old
                : {
                    from: info.start.toISOString(),
                    to: info.end.toISOString(),
                  },
            );
          }}
          dateClick={(info) => create(info.dateStr)}
          eventClick={(info) => {
            setSelected(
              events.find((e) => e.id === info.event.extendedProps.series_id) ??
                null,
            );
            setOccurrence({
              start: info.event.startStr,
              end: info.event.endStr,
            });
          }}
        />
      </section>
      <Modal
        title={selected?.title ?? "Evento"}
        open={!!selected}
        onOpenChange={() => setSelected(null)}
      >
        {selected && (
          <>
            <VisibilityPill value={selected.visibility} />
            <p>
              {formatDate(occurrence?.start || selected.start_at, {
                weekday: "long",
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              —{" "}
              {formatDate(occurrence?.end || selected.end_at, {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
            <p className="entry-content">{selected.description}</p>
            <p className="muted">{recurrenceText(selected)}</p>
            {selected.owner_id === me.id ? (
              <div className="row gap">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setEditing(selected.id);
                    setDraft({
                      title: selected.title,
                      description: selected.description,
                      start: localInput(
                        selected.start_at,
                        selected.recurrence_timezone ?? me.timezone,
                        selected.all_day,
                      ),
                      end: localInput(
                        selected.end_at,
                        selected.recurrence_timezone ?? me.timezone,
                        selected.all_day,
                      ),
                      kind: selected.kind,
                      repeat: parseRepeat(selected),
                      zone: selected.recurrence_timezone ?? me.timezone,
                      all_day: selected.all_day,
                    });
                    setSelected(null);
                    setOpen(true);
                  }}
                >
                  <Pencil size={16} />
                  {recurrenceString(selected) ? "Editar serie" : "Editar"}
                </Button>
                <Button
                  variant="danger"
                  busy={action.busy}
                  onClick={() => setDeleting(true)}
                >
                  <Trash2 size={16} />
                  {recurrenceString(selected)
                    ? "Eliminar serie"
                    : "Eliminar evento"}
                </Button>
              </div>
            ) : (
              <p className="muted">Solo quien creó el evento puede editarlo.</p>
            )}
          </>
        )}
      </Modal>
      <Modal
        open={deleting}
        onOpenChange={setDeleting}
        title={
          selected && recurrenceString(selected)
            ? "¿Eliminar toda la serie?"
            : "¿Eliminar este evento?"
        }
      >
        <p>
          {selected && recurrenceString(selected)
            ? "Se quitarán todas las fechas de esta serie, también en Google Calendar. Puedes recuperar el registro desde la papelera."
            : "El evento se quitará de Our Calendar y de Google Calendar."}
        </p>
        <ErrorMessage error={action.error} />
        <Button
          variant="danger"
          busy={action.busy}
          onClick={() =>
            action.run(
              async () =>
                check(
                  await supabase.rpc("trash_item", {
                    p_table: "calendar_events",
                    p_id: selected!.id,
                  }),
                ),
              () => {
                setDeleting(false);
                setSelected(null);
              },
            )
          }
        >
          Confirmar eliminación
        </Button>
      </Modal>
      <Modal
        title={editing ? "Editar nuestro plan" : "Un momento en el calendario"}
        open={open}
        onOpenChange={close}
      >
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <ErrorMessage error={action.error} />
          <label className="field">
            Título
            <input
              required
              autoFocus
              maxLength={160}
              value={draft.title}
              onChange={(e) => field("title", e.target.value)}
            />
          </label>
          <label className="field">
            Descripción o lugar
            <textarea
              value={draft.description}
              maxLength={2000}
              onChange={(e) => field("description", e.target.value)}
            />
          </label>
          <label className="field">
            Empieza
            <input
              required
              type="datetime-local"
              value={draft.start}
              onChange={(e) => field("start", e.target.value)}
            />
          </label>
          <label className="field">
            Termina
            <input
              required
              type="datetime-local"
              value={draft.end}
              onChange={(e) => field("end", e.target.value)}
            />
          </label>
          <label className="field">
            Tipo
            <select
              value={draft.kind}
              onChange={(e) => field("kind", e.target.value)}
            >
              <option value="event">Un plan</option>
              <option value="special">Fecha especial</option>
              <option value="reminder">Recordatorio</option>
            </select>
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={draft.all_day}
              onChange={(e) => field("all_day", e.target.checked)}
            />
            Todo el día
          </label>
          <label className="field">
            Repetición
            <select
              aria-label="Repetición"
              value={draft.repeat.frequency}
              onChange={(e) =>
                field("repeat", {
                  ...draft.repeat,
                  frequency: e.target.value as RepeatDraft["frequency"],
                })
              }
            >
              <option value="none">No se repite</option>
              <option value="DAILY">Cada día</option>
              <option value="WEEKLY">Cada semana · elegir días</option>
              <option value="MONTHLY">Cada mes</option>
              <option value="YEARLY">Cada año</option>
              {draft.repeat.frequency === "custom" && (
                <option value="custom">
                  Regla personalizada de Google (se conserva)
                </option>
              )}
            </select>
          </label>
          {draft.repeat.frequency !== "none" &&
            draft.repeat.frequency !== "custom" && (
              <fieldset className="repeat-options">
                <legend>Opciones de repetición</legend>
                <label className="field">
                  Repetir cada
                  <input
                    aria-label="Intervalo de repetición"
                    type="number"
                    min={1}
                    max={99}
                    value={draft.repeat.interval}
                    onChange={(e) =>
                      field("repeat", {
                        ...draft.repeat,
                        interval: Number(e.target.value),
                      })
                    }
                  />
                </label>
                {draft.repeat.frequency === "WEEKLY" && (
                  <div className="field">
                    <span>Días que se repite</span>
                    <div className="segments">
                      {weekDays.map(([code, name]) => (
                        <button
                          key={code}
                          type="button"
                          aria-label={name}
                          aria-pressed={draft.repeat.days.includes(code)}
                          onClick={() =>
                            field("repeat", {
                              ...draft.repeat,
                              days: draft.repeat.days.includes(code)
                                ? draft.repeat.days.filter((d) => d !== code)
                                : [...draft.repeat.days, code],
                            })
                          }
                        >
                          {name.slice(0, 2)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <label className="field">
                  Finaliza
                  <select
                    aria-label="Finaliza"
                    value={draft.repeat.end}
                    onChange={(e) =>
                      field("repeat", {
                        ...draft.repeat,
                        end: e.target.value as RepeatDraft["end"],
                      })
                    }
                  >
                    <option value="never">Nunca · sin fecha límite</option>
                    <option value="until">En una fecha</option>
                    <option value="count">Después de un número de veces</option>
                  </select>
                </label>
                {draft.repeat.end === "until" && (
                  <label className="field">
                    Repetir hasta (incluido)
                    <input
                      required
                      type="date"
                      min={draft.start.slice(0, 10)}
                      value={draft.repeat.until}
                      onChange={(e) =>
                        field("repeat", {
                          ...draft.repeat,
                          until: e.target.value,
                        })
                      }
                    />
                  </label>
                )}
                {draft.repeat.end === "count" && (
                  <label className="field">
                    Número de repeticiones
                    <input
                      required
                      type="number"
                      min={1}
                      max={10000}
                      value={draft.repeat.count}
                      onChange={(e) =>
                        field("repeat", {
                          ...draft.repeat,
                          count: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                )}
              </fieldset>
            )}
          <p className="small muted">
            Compartido entre los dos. Al exportarlo a Google se incluirán sus
            dos correos como invitados.
          </p>
          {google.data?.status === "connected" && (
            <small className="muted">
              Se enviará automáticamente a tu calendario Chimuverse de Google.
            </small>
          )}
          <Button type="submit" busy={action.busy}>
            Guardar el plan
          </Button>
        </form>
      </Modal>
    </>
  );
}
