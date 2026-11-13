import { useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  Plus,
  ArrowLeft,
  Lock,
  Users,
  CalendarDays,
  Pencil,
  CalendarClock,
  Check,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSpace, useAction } from "../lib/store";
import { supabase, check } from "../lib/supabase";
import { formatDate, localDay } from "../lib/utils";
import type { Progress, TaskEvent } from "../lib/types";
import {
  Button,
  Modal,
  PageHeading,
  ErrorMessage,
  Empty,
  Status,
  DualProgress,
  Avatar,
} from "../components/ui";
const taskSchema = z.object({
  title: z.string().trim().min(3, "Escribe al menos 3 caracteres").max(80),
  description: z.string().max(2000),
  assignee_id: z.string(),
  due_on: z.string().min(1, "Elige una fecha"),
});
type TaskForm = z.infer<typeof taskSchema>;
export default function Quests() {
  const { data, me, partner, spaceId } = useSpace();
  const { id } = useParams();
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const [open, setOpen] = useState(search.has("crear"));
  const [filter, setFilter] = useState("Activas");
  const [editing, setEditing] = useState(false);
  const [moving, setMoving] = useState(false);
  const [edit, setEdit] = useState({
    title: "",
    description: "",
    assignee_id: "",
    due_on: "",
  });
  const [moveTo, setMoveTo] = useState("");
  const [moveReason, setMoveReason] = useState("");
  const [day, setDay] = useState("");
  const [percent, setPercent] = useState(100),
    [note, setNote] = useState(""),
    [reason, setReason] = useState(""),
    [partial, setPartial] = useState(0);
  const action = useAction();
  const form = useForm<TaskForm>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: "",
      description: "",
      assignee_id: me.id,
      due_on: localDay(new Date(), me.timezone),
    },
  });
  const today = localDay(new Date(), me.timezone);
  const history = filter === "Historial";
  const name = (uid: string | null) =>
    uid
      ? (data!.profiles.find((p) => p.id === uid)?.display_name ?? "?")
      : "Los dos";
  const moves = (taskId: string) =>
    data!.task_events.filter(
      (e) => e.task_id === taskId && e.kind === "postpone",
    ).length;
  // Finished tasks leave the daily list and live in the history.
  const tasks = data!.tasks
    .filter(
      (t) =>
        (history ? t.status === "done" : t.status !== "done") &&
        (!day || t.due_on === day) &&
        (filter !== "Mías" || t.assignee_id === me.id) &&
        (filter !== "Compartidas" || !t.assignee_id) &&
        (filter !== "Por verificar" ||
          data!.task_progress.some(
            (p) =>
              p.task_id === t.id &&
              p.state === "pending" &&
              p.reported_by !== me.id,
          )),
    )
    .sort((a, b) =>
      history
        ? String(b.completed_at ?? b.due_on).localeCompare(
            String(a.completed_at ?? a.due_on),
          )
        : a.due_on.localeCompare(b.due_on),
    );
  const current = data!.tasks.find((t) => t.id === id);
  const reports = data!.task_progress.filter((p) => p.task_id === id);
  const events = data!.task_events.filter((e) => e.task_id === id);
  const timeline: ({ at: string } & (
    | { report: Progress; event?: undefined }
    | { event: TaskEvent; report?: undefined }
  ))[] = [
    ...reports.map((report) => ({ at: report.created_at, report })),
    ...events.map((event) => ({ at: event.created_at, event })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  const nextDay = (d: string) => {
    const base = new Date((d > today ? d : today) + "T12:00:00");
    base.setDate(base.getDate() + 1);
    return localDay(base, me.timezone);
  };
  function openEdit() {
    if (!current) return;
    setEdit({
      title: current.title,
      description: current.description,
      assignee_id: current.assignee_id ?? "",
      due_on: current.due_on,
    });
    action.setError("");
    setEditing(true);
  }
  function openMove() {
    if (!current) return;
    setMoveTo(nextDay(current.due_on));
    setMoveReason("");
    action.setError("");
    setMoving(true);
  }
  const latest = reports.find((p) => p.state === "pending");
  const canReport =
    current &&
    (!current.assignee_id || current.assignee_id === me.id) &&
    current.status !== "done";
  function close(v: boolean) {
    setOpen(v);
    if (!v) {
      search.delete("crear");
      setSearch(search, { replace: true });
    }
  }
  async function create(values: TaskForm) {
    await action.run(
      async () =>
        check(
          await supabase.from("tasks").insert({
            ...values,
            space_id: spaceId,
            assignee_id: values.assignee_id || null,
          }),
        ),
      () => {
        close(false);
        form.reset();
      },
    );
  }
  return (
    <>
      <PageHeading
        eyebrow="NUESTRO DÍA"
        title="Tareas del día"
        text="Pequeños pasos. Dos miradas. Un mismo equipo."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus size={18} />
            Nueva tarea
          </Button>
        }
      />
      <ErrorMessage error={action.error} />
      {id ? (
        <>
          {current ? (
            <>
              <Link to="/dia/quests" className="text-link">
                <ArrowLeft size={17} />
                Todas las tareas
              </Link>
              <section className="card quest-detail">
                <div className="row between wrap">
                  <Status value={current.status} />
                  <span className="muted row gap-sm">
                    <CalendarDays size={16} />
                    {formatDate(current.due_on)}
                  </span>
                </div>
                <h2>{current.title}</h2>
                <p className="muted">
                  {current.description || "Cada pequeño paso suma."}
                </p>
                <p className="row gap-sm">
                  <Users size={17} />
                  {current.assignee_id
                    ? data!.profiles.find((p) => p.id === current.assignee_id)
                        ?.display_name
                    : "Compartida entre los dos"}
                </p>
                <DualProgress
                  reported={current.reported_percent}
                  verified={current.verified_percent}
                />
                {current.status === "done" ? (
                  <div className="banner" role="status">
                    <Check size={18} aria-hidden />
                    Completada
                    {current.completed_at
                      ? ` el ${formatDate(current.completed_at)}`
                      : ""}
                    . Ya es parte de nuestro historial.
                  </div>
                ) : (
                  <div className="row gap-sm wrap">
                    <Button variant="secondary" onClick={openEdit}>
                      <Pencil size={16} aria-hidden />
                      Editar
                    </Button>
                    <Button variant="secondary" onClick={openMove}>
                      <CalendarClock size={16} aria-hidden />
                      Pasar a otro día
                    </Button>
                  </div>
                )}
                {current.status === "in_talk" && (
                  <div className="banner">
                    Lo hablamos: ha habido varios desacuerdos. Pueden dejar un
                    acuerdo en Nuestro diario y seguir reportando.
                  </div>
                )}
                {latest && latest.reported_by === me.id && (
                  <div className="banner">
                    <Lock size={18} />
                    Esperando a {partner?.display_name ?? "tu pareja"}. Tu
                    reporte necesita su verificación.
                  </div>
                )}
                {latest && latest.reported_by !== me.id && (
                  <div className="verification-panel">
                    <h3>Te toca dar el visto bueno</h3>
                    <p>
                      Avance reportado:{" "}
                      <strong>{latest.reported_percent} %</strong>
                    </p>
                    {latest.note && <blockquote>{latest.note}</blockquote>}
                    <div className="row gap wrap">
                      <Button
                        busy={action.busy}
                        onClick={() =>
                          action.run(async () =>
                            check(
                              await supabase.rpc("verify_task_progress", {
                                p_progress_id: latest.id,
                                p_decision: "approve",
                              }),
                            ),
                          )
                        }
                      >
                        Aprobar {latest.reported_percent} %
                      </Button>
                    </div>
                    <label className="field">
                      Avance que puedes verificar (%)
                      <input
                        type="number"
                        min={current.verified_percent}
                        max={latest.reported_percent - 1}
                        value={partial}
                        onChange={(e) => setPartial(Number(e.target.value))}
                      />
                    </label>
                    <Button
                      variant="secondary"
                      busy={action.busy}
                      onClick={() =>
                        action.run(async () =>
                          check(
                            await supabase.rpc("verify_task_progress", {
                              p_progress_id: latest.id,
                              p_decision: "partial",
                              p_verified_percent: partial,
                            }),
                          ),
                        )
                      }
                    >
                      Aprobar parcialmente
                    </Button>
                    <label className="field">
                      Si no estás de acuerdo, explica por qué
                      <textarea
                        minLength={10}
                        maxLength={1000}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Al menos 10 caracteres; conversemos con cariño."
                      />
                    </label>
                    <Button
                      variant="danger"
                      busy={action.busy}
                      disabled={reason.trim().length < 10}
                      onClick={() =>
                        action.run(
                          async () =>
                            check(
                              await supabase.rpc("verify_task_progress", {
                                p_progress_id: latest.id,
                                p_decision: "reject",
                                p_reason: reason,
                              }),
                            ),
                          () => setReason(""),
                        )
                      }
                    >
                      Rechazar con motivo
                    </Button>
                  </div>
                )}
                {canReport && (
                  <form
                    className="report-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void action.run(
                        async () =>
                          check(
                            await supabase.rpc("report_task_progress", {
                              p_task_id: current.id,
                              p_percent: percent,
                              p_note: note,
                            }),
                          ),
                        () => setNote(""),
                      );
                    }}
                  >
                    <h3>
                      {latest ? "Actualizar mi reporte" : "Reportar un avance"}
                    </h3>
                    <label className="field">
                      Avance reportado: {percent} %
                      <input
                        aria-label="Avance reportado"
                        type="range"
                        min={current.verified_percent + 1}
                        max={100}
                        value={percent}
                        onChange={(e) => setPercent(Number(e.target.value))}
                      />
                    </label>
                    <label className="field">
                      Una nota (opcional)
                      <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        maxLength={280}
                      />
                    </label>
                    <Button type="submit" busy={action.busy}>
                      Enviar a verificar
                    </Button>
                    {latest && (
                      <small className="muted">
                        El nuevo reporte reemplaza al pendiente y conserva el
                        historial.
                      </small>
                    )}
                  </form>
                )}
              </section>
              <section className="card">
                <h2>La historia de esta tarea</h2>
                <ol className="timeline">
                  {timeline.map(({ report: p, event: ev }) => {
                    if (ev)
                      return (
                        <li key={ev.id}>
                          <Avatar
                            name={name(ev.actor_id)}
                            partner={ev.actor_id !== me.id}
                          />
                          <div>
                            <strong>
                              {ev.kind === "postpone"
                                ? `Pasó del ${formatDate(ev.from_date!)} al ${formatDate(ev.to_date!)}`
                                : "Editó la tarea"}
                            </strong>
                            <small>
                              {name(ev.actor_id)} ·{" "}
                              {formatDate(ev.created_at, {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </small>
                            {ev.kind === "postpone" ? (
                              <p>Motivo: {ev.reason}</p>
                            ) : (
                              <ul className="task-changes">
                                {describeChanges(ev, name).map((c) => (
                                  <li key={c}>{c}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </li>
                      );
                    if (!p) return null;
                    const v = data!.task_verifications.find(
                      (v) => v.progress_id === p.id,
                    );
                    return (
                      <li key={p.id}>
                        <Avatar
                          name={
                            data!.profiles.find((u) => u.id === p.reported_by)
                              ?.display_name ?? "?"
                          }
                          partner={p.reported_by !== me.id}
                        />
                        <div>
                          <strong>Reportó {p.reported_percent} %</strong>
                          <small>
                            {formatDate(p.created_at, {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}{" "}
                            ·{" "}
                            {p.state === "superseded"
                              ? "Reemplazado por un nuevo reporte"
                              : p.state === "pending"
                                ? "Pendiente de verificación"
                                : ""}
                          </small>
                          {p.note && <p>{p.note}</p>}
                          {v && (
                            <div className="history-verification">
                              <strong>
                                {v.decision === "reject"
                                  ? "Rechazado"
                                  : `Verificado: ${v.verified_percent} %`}
                              </strong>
                              {v.reason && <p>{v.reason}</p>}
                              <small>
                                Por{" "}
                                {
                                  data!.profiles.find(
                                    (u) => u.id === v.verifier_id,
                                  )?.display_name
                                }
                              </small>
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                  <li>
                    <span>✦</span>
                    <div>
                      Tarea creada
                      <small>{formatDate(current.created_at)}</small>
                    </div>
                  </li>
                </ol>
              </section>
            </>
          ) : (
            <Empty
              title="No encontramos esta tarea"
              text="Puede que no exista o no tengas acceso."
            />
          )}
        </>
      ) : (
        <>
          <div className="toolbar">
            <div className="segments">
              {[
                "Activas",
                "Mías",
                "Compartidas",
                "Por verificar",
                "Historial",
              ].map((v) => (
                <button
                  key={v}
                  onClick={() => setFilter(v)}
                  aria-pressed={filter === v}
                >
                  {v}
                </button>
              ))}
            </div>
            <label className="field inline-field">
              Fecha
              <input
                type="date"
                value={day}
                onChange={(e) => setDay(e.target.value)}
              />
            </label>
            {day && (
              <Button variant="ghost" onClick={() => setDay("")}>
                Ver todas
              </Button>
            )}
          </div>
          <div className="quest-list">
            {tasks.length ? (
              tasks.map((t) => (
                <Link
                  key={t.id}
                  to={`/dia/quests/${t.id}`}
                  className="quest-row card"
                >
                  <div className={`quest-glyph ${t.status}`}>✦</div>
                  <div className="quest-summary">
                    <div className="row gap wrap">
                      <h3>{t.title}</h3>
                      <Status value={t.status} />
                    </div>
                    <p className="muted">
                      {t.assignee_id ? name(t.assignee_id) : "Compartida"} ·{" "}
                      {t.status === "done" ? (
                        `Completada el ${formatDate(t.completed_at ?? t.due_on)}`
                      ) : t.due_on < today ? (
                        <span className="overdue">
                          {formatDate(t.due_on)} · vencida
                        </span>
                      ) : (
                        formatDate(t.due_on)
                      )}
                      {moves(t.id) > 0 &&
                        ` · Movida ${moves(t.id)} ${moves(t.id) === 1 ? "vez" : "veces"}`}
                    </p>
                  </div>
                  <DualProgress
                    reported={t.reported_percent}
                    verified={t.verified_percent}
                  />
                  <span className="quest-arrow">↗</span>
                </Link>
              ))
            ) : (
              <Empty
                title={
                  history
                    ? "Aún no hay tareas completadas"
                    : "Un día lleno de posibilidades"
                }
                text={
                  history
                    ? "Cuando una tarea llegue al 100 % verificado, quedará guardada aquí."
                    : "Todavía no hay tareas con estos filtros. ¿Creamos un pequeño primer paso?"
                }
              />
            )}
          </div>
        </>
      )}
      <Modal
        title="Editar la tarea"
        open={editing}
        onOpenChange={(v) => !action.busy && setEditing(v)}
      >
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!current) return;
            void action.run(
              async () =>
                check(
                  await supabase.rpc("edit_task", {
                    p_task_id: current.id,
                    p_title: edit.title,
                    p_description: edit.description,
                    p_assignee_id: edit.assignee_id || null,
                    p_due_on: edit.due_on,
                  }),
                ),
              () => setEditing(false),
            );
          }}
        >
          <label className="field">
            Título
            <input
              required
              minLength={3}
              maxLength={80}
              value={edit.title}
              onChange={(e) => setEdit({ ...edit, title: e.target.value })}
            />
          </label>
          <label className="field">
            Descripción
            <textarea
              maxLength={2000}
              value={edit.description}
              onChange={(e) =>
                setEdit({ ...edit, description: e.target.value })
              }
            />
          </label>
          <label className="field">
            Para quién
            <select
              value={edit.assignee_id}
              onChange={(e) =>
                setEdit({ ...edit, assignee_id: e.target.value })
              }
            >
              <option value={me.id}>{me.display_name}</option>
              {partner && (
                <option value={partner.id}>{partner.display_name}</option>
              )}
              <option value="">Los dos</option>
            </select>
          </label>
          <label className="field">
            Fecha
            <input
              type="date"
              required
              value={edit.due_on}
              onChange={(e) => setEdit({ ...edit, due_on: e.target.value })}
            />
          </label>
          <p className="small muted">
            El avance se conserva. {partner?.display_name ?? "Tu pareja"}{" "}
            recibirá un aviso y el cambio queda en la historia de la tarea.
          </p>
          <ErrorMessage error={action.error} />
          <Button type="submit" busy={action.busy}>
            Guardar cambios
          </Button>
        </form>
      </Modal>
      <Modal
        title="Pasar a otro día"
        open={moving}
        onOpenChange={(v) => !action.busy && setMoving(v)}
      >
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!current) return;
            void action.run(
              async () =>
                check(
                  await supabase.rpc("postpone_task", {
                    p_task_id: current.id,
                    p_to: moveTo,
                    p_reason: moveReason,
                  }),
                ),
              () => setMoving(false),
            );
          }}
        >
          {current && (
            <p className="muted">
              <strong>{current.title}</strong> · {current.verified_percent} %
              verificado. Sigue con su avance en el nuevo día.
            </p>
          )}
          <label className="field">
            Nuevo día
            <input
              type="date"
              required
              min={current ? nextAfter(current.due_on) : undefined}
              value={moveTo}
              onChange={(e) => setMoveTo(e.target.value)}
            />
          </label>
          <label className="field">
            ¿Por qué no se completó?
            <textarea
              required
              minLength={5}
              maxLength={500}
              value={moveReason}
              onChange={(e) => setMoveReason(e.target.value)}
              placeholder="Queda en el registro de la tarea."
            />
          </label>
          <ErrorMessage error={action.error} />
          <Button
            type="submit"
            busy={action.busy}
            disabled={moveReason.trim().length < 5 || !moveTo}
          >
            {moveTo ? `Pasar al ${formatDate(moveTo)}` : "Pasar al nuevo día"}
          </Button>
        </form>
      </Modal>
      <Modal title="Una nueva tarea" open={open} onOpenChange={close}>
        <form onSubmit={form.handleSubmit(create)} className="form">
          <ErrorMessage error={action.error} />
          <label className="field">
            ¿Qué vamos a hacer?
            <input
              autoFocus
              maxLength={80}
              {...form.register("title")}
              aria-invalid={!!form.formState.errors.title}
            />
            {form.formState.errors.title && (
              <small role="alert">{form.formState.errors.title.message}</small>
            )}
          </label>
          <label className="field">
            Un poco de contexto
            <textarea {...form.register("description")} />
          </label>
          <label className="field">
            Responsable
            <select {...form.register("assignee_id")}>
              <option value={me.id}>{me.display_name}</option>
              {partner && (
                <option value={partner.id}>{partner.display_name}</option>
              )}
              <option value="">Los dos · compartida</option>
            </select>
          </label>
          <label className="field">
            Para cuándo
            <input type="date" {...form.register("due_on")} />
          </label>
          <p className="small muted">
            Quien haga el reporte necesita que la otra persona lo verifique.
          </p>
          <Button type="submit" busy={action.busy}>
            Crear tarea
          </Button>
        </form>
      </Modal>
    </>
  );
}

const FIELD_NAMES: Record<string, string> = {
  title: "Título",
  description: "Descripción",
  assignee_id: "Para quién",
  due_on: "Fecha",
};
/** The day after `d` (YYYY-MM-DD), for the "move to another day" minimum. */
function nextAfter(d: string) {
  const day = new Date(d + "T12:00:00Z");
  day.setUTCDate(day.getUTCDate() + 1);
  return day.toISOString().slice(0, 10);
}
/** Human-readable lines for an "edit" event's recorded changes. */
function describeChanges(
  e: TaskEvent,
  name: (uid: string | null) => string,
): string[] {
  return Object.entries(e.changes).map(([key, value]) => {
    const [from, to] = Array.isArray(value) ? value : [];
    if (key === "title") return `Título: «${from}» → «${to}»`;
    if (key === "assignee_id")
      return `Ahora es para ${name((to as string | null) ?? null)}`;
    if (key === "due_on")
      return `Fecha: ${formatDate(String(from))} → ${formatDate(String(to))}`;
    return `${FIELD_NAMES[key] ?? key} actualizada`;
  });
}
