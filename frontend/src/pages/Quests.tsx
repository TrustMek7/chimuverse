import { useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { Plus, ArrowLeft, Lock, Users, CalendarDays } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSpace, useAction } from "../lib/store";
import { supabase, check } from "../lib/supabase";
import { formatDate, localDay } from "../lib/utils";
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
  const [filter, setFilter] = useState("Todas");
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
  const tasks = data!.tasks.filter(
    (t) =>
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
  );
  const current = data!.tasks.find((t) => t.id === id);
  const reports = data!.task_progress.filter((p) => p.task_id === id);
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
        title="Daily Quests"
        text="Pequeños pasos. Dos miradas. Un mismo equipo."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus size={18} />
            Nueva quest
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
                Todas las quests
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
                {current.status === "in_talk" && (
                  <div className="banner">
                    Lo hablamos: ha habido varios desacuerdos. Pueden dejar un
                    acuerdo en el DevLog y seguir reportando.
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
                <h2>La historia de esta quest</h2>
                <ol className="timeline">
                  {reports.map((p) => {
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
                      Quest creada
                      <small>{formatDate(current.created_at)}</small>
                    </div>
                  </li>
                </ol>
              </section>
            </>
          ) : (
            <Empty
              title="No encontramos esta quest"
              text="Puede que no exista o no tengas acceso."
            />
          )}
        </>
      ) : (
        <>
          <div className="toolbar">
            <div className="segments">
              {["Todas", "Mías", "Compartidas", "Por verificar"].map((v) => (
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
                      {t.assignee_id
                        ? data!.profiles.find((p) => p.id === t.assignee_id)
                            ?.display_name
                        : "Compartida"}{" "}
                      · {formatDate(t.due_on)}
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
                title="Un día lleno de posibilidades"
                text="Todavía no hay quests con estos filtros. ¿Creamos un pequeño primer paso?"
              />
            )}
          </div>
        </>
      )}
      <Modal title="Una nueva quest" open={open} onOpenChange={close}>
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
            Crear quest
          </Button>
        </form>
      </Modal>
    </>
  );
}
