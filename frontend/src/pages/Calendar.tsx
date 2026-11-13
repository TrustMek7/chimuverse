import { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import FullCalendar from "@fullcalendar/react";
import dayGrid from "@fullcalendar/daygrid";
import list from "@fullcalendar/list";
import interaction from "@fullcalendar/interaction";
import rrule from "@fullcalendar/rrule";
import luxon from "@fullcalendar/luxon3";
import es from "@fullcalendar/core/locales/es";
import { DateTime } from "luxon";
import { useQuery } from "@tanstack/react-query";
import {
  Plus,
  CalendarDays,
  CloudOff,
  CalendarCheck,
  Pencil,
  Trash2,
} from "lucide-react";
import { useSpace, useAction } from "../lib/store";
import { check, supabase } from "../lib/supabase";
import type { CalendarEvent, Visibility } from "../lib/types";
import { localDay, formatDate, nextOccurrence } from "../lib/utils";
import {
  Button,
  Modal,
  PageHeading,
  ErrorMessage,
  VisibilityPicker,
  VisibilityPill,
  Empty,
} from "../components/ui";
type Draft = {
  title: string;
  description: string;
  start: string;
  end: string;
  visibility: Visibility;
  kind: string;
  annual: boolean;
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
  const [editing, setEditing] = useState<string | null>(null);
  const [view, setView] = useState("month");
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
    visibility: "private",
    kind: "event",
    annual: false,
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
      : DateTime.fromISO(draft.start, { zone: me.timezone }).toJSDate();
    let end = draft.all_day
      ? new Date(draft.end.slice(0, 10) + "T00:00:00Z")
      : DateTime.fromISO(draft.end, { zone: me.timezone }).toJSDate();
    if (draft.all_day && end <= start)
      end = new Date(start.getTime() + 86400000);
    const payload = {
      space_id: spaceId,
      title: draft.title.trim(),
      description: draft.description,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      visibility: draft.visibility,
      kind: draft.kind,
      annual: draft.annual,
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
        {view === "month" ? (
          <FullCalendar
            plugins={[dayGrid, list, interaction, rrule, luxon]}
            timeZone={me.timezone}
            initialView="dayGridMonth"
            locale={es}
            firstDay={1}
            height="auto"
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "",
            }}
            events={events.map((e) => ({
              id: e.id,
              title: e.title,
              ...(e.annual
                ? {
                    rrule: {
                      freq: "yearly",
                      dtstart: e.all_day ? e.start_at.slice(0, 10) : e.start_at,
                    },
                    duration: {
                      milliseconds:
                        new Date(e.end_at).getTime() -
                        new Date(e.start_at).getTime(),
                    },
                  }
                : {
                    start: e.all_day ? e.start_at.slice(0, 10) : e.start_at,
                    end: e.all_day ? e.end_at.slice(0, 10) : e.end_at,
                  }),
              allDay: e.all_day,
              className: `event-${e.visibility} event-${e.kind}`,
              backgroundColor:
                e.visibility === "private"
                  ? "#6B45D8"
                  : e.kind === "special"
                    ? "#B8255E"
                    : "#137B6D",
            }))}
            dateClick={(info) => create(info.dateStr)}
            eventClick={(info) =>
              setSelected(events.find((e) => e.id === info.event.id) ?? null)
            }
          />
        ) : (
          <div className="agenda-list">
            {events.length ? (
              events
                .map((e) => nextOccurrence(e))
                .sort((a, b) => a.start_at.localeCompare(b.start_at))
                .map((e) => (
                  <button
                    key={e.id}
                    className="agenda-item"
                    onClick={() => setSelected(e)}
                  >
                    <CalendarDays size={23} />
                    <div>
                      <small>
                        {formatDate(e.start_at, { weekday: "long" })}
                      </small>
                      <h3>{e.title}</h3>
                      <p>
                        {formatDate(e.start_at, {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <VisibilityPill value={e.visibility} />
                  </button>
                ))
            ) : (
              <Empty
                title="Tiempo para algo bonito"
                text="Añade tu primer evento o fecha especial."
              />
            )}
          </div>
        )}
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
              {formatDate(selected.start_at, {
                weekday: "long",
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              —{" "}
              {formatDate(selected.end_at, {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
            <p className="entry-content">{selected.description}</p>
            {selected.annual && (
              <p className="muted">Fecha especial que se recuerda cada año.</p>
            )}
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
                        me.timezone,
                        selected.all_day,
                      ),
                      end: localInput(
                        selected.end_at,
                        me.timezone,
                        selected.all_day,
                      ),
                      visibility: selected.visibility,
                      kind: selected.kind,
                      annual: selected.annual,
                      all_day: selected.all_day,
                    });
                    setSelected(null);
                    setOpen(true);
                  }}
                >
                  <Pencil size={16} />
                  Editar
                </Button>
                <Button
                  variant="danger"
                  busy={action.busy}
                  onClick={() =>
                    action.run(
                      async () =>
                        check(
                          await supabase.rpc("trash_item", {
                            p_table: "calendar_events",
                            p_id: selected.id,
                          }),
                        ),
                      () => setSelected(null),
                    )
                  }
                >
                  <Trash2 size={16} />
                  Papelera
                </Button>
              </div>
            ) : (
              <p className="muted">Solo quien creó el evento puede editarlo.</p>
            )}
          </>
        )}
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
          {draft.kind === "special" && (
            <label className="checkbox">
              <input
                type="checkbox"
                checked={draft.annual}
                onChange={(e) => field("annual", e.target.checked)}
              />
              Recordar cada año
            </label>
          )}
          <VisibilityPicker
            value={draft.visibility}
            onChange={(v) => field("visibility", v)}
          />
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
