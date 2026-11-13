import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  ArrowRight,
  CalendarDays,
  Heart,
  BookOpen,
  Orbit,
  Sparkles,
  Check,
} from "lucide-react";
import { useSpace } from "../lib/store";
import { localDay, formatDate, nextOccurrence } from "../lib/utils";
import { DualProgress, Avatar, Empty } from "../components/ui";
import { PhotoImage } from "./Vault";
import { PushStatus } from "../components/PushStatus";
export function Constellation({
  tasks,
}: {
  tasks: { id: string; title: string; status: string }[];
}) {
  const points = tasks.slice(0, 7).map((t, i) => ({
    ...t,
    x: 35 + i * 62,
    y: [140, 70, 115, 40, 90, 28, 125][i],
  }));
  return (
    <svg
      className="constellation"
      viewBox="0 0 450 200"
      role="img"
      aria-label={`${tasks.length} quests, ${tasks.filter((t) => t.status === "done").length} completadas`}
    >
      <path
        d={(points.length
          ? points
          : [
              { x: 40, y: 140 },
              { x: 160, y: 70 },
              { x: 280, y: 110 },
              { x: 400, y: 40 },
            ]
        )
          .map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`)
          .join(" ")}
        fill="none"
        stroke="#bca9df"
        strokeDasharray="3 6"
      />
      {points.length
        ? points.map((p) => (
            <g key={p.id} transform={`translate(${p.x} ${p.y})`}>
              <path
                d="M0-12 4-4 12-3 6 3 8 12 0 7-8 12-6 3-12-3-4-4Z"
                fill={p.status === "done" ? "#F5B83D" : "none"}
                stroke={p.status === "done" ? "#F5B83D" : "#E7CDF9"}
                strokeWidth="1.5"
              />
              {p.status === "review" && (
                <circle
                  r="20"
                  fill="none"
                  stroke="#f5b83d"
                  strokeDasharray="2 3"
                />
              )}
              <text y="37" textAnchor="middle" fill="#d4c8e9" fontSize="11">
                {p.title.slice(0, 12)}
              </text>
            </g>
          ))
        : [40, 160, 280, 400].map((x, i) => (
            <circle
              key={x}
              cx={x}
              cy={[140, 70, 110, 40][i]}
              r="7"
              fill="none"
              stroke="#d4c8e9"
              strokeDasharray="2 3"
            />
          ))}
    </svg>
  );
}
export default function Home() {
  const { data, me, partner } = useSpace();
  const today = localDay(new Date(), me.timezone);
  const tasks = data!.tasks.filter(
    (t) => t.due_on === today && t.status !== "discarded",
  );
  const pending = data!.task_progress.filter(
    (p) => p.state === "pending" && p.reported_by !== me.id,
  );
  const average = (key: "reported_percent" | "verified_percent") =>
    tasks.length
      ? Math.round(tasks.reduce((s, t) => s + t[key], 0) / tasks.length)
      : 0;
  const events = data!.calendar_events
    .map((e) => nextOccurrence(e))
    .filter((e) => !e.deleted_at && new Date(e.end_at) > new Date())
    .sort((a, b) => a.start_at.localeCompare(b.start_at));
  const photo = data!.photos
    .filter((p) => p.visibility === "shared" && !p.deleted_at)
    .sort((a, b) => b.captured_at.localeCompare(a.captured_at))[0];
  const question =
    data!.questions[new Date().getDate() % Math.max(1, data!.questions.length)];
  const hour = Number(
    new Intl.DateTimeFormat("en", {
      hour: "numeric",
      hour12: false,
      timeZone: me.timezone,
    }).format(new Date()),
  );
  return (
    <>
      <header className="home-heading">
        <p className="eyebrow">NUESTRO DÍA, A NUESTRA MANERA</p>
        <h1>
          {hour < 12
            ? "Buenos días"
            : hour < 19
              ? "Buenas tardes"
              : "Buenas noches"}
          ,{" "}
          <span className="gradient-text">
            {me.display_name.split(" ").slice(0, 2).join(" ")}
          </span>
          .
        </h1>
        <p className="muted">
          {pending.length
            ? `${partner?.display_name.split(" ")[0] ?? "Tu pareja"} tiene un avance que espera tu visto bueno.`
            : "Un nuevo día para seguir construyendo nuestro pequeño universo."}
        </p>
        <PushStatus />
      </header>
      <div className="dashboard-top">
        <section className="sky-panel">
          <div className="row between wrap">
            <div>
              <p className="eyebrow">TAREAS DEL DÍA · HOY</p>
              <h2>La constelación de hoy</h2>
            </div>
            <Link className="btn btn-night" to="/dia/quests">
              Ver tareas <ArrowRight size={15} />
            </Link>
          </div>
          <div className="sky-body">
            <Constellation tasks={tasks} />
            <div>
              <DualProgress
                reported={average("reported_percent")}
                verified={average("verified_percent")}
              />
              <p className="small">
                {tasks.filter((t) => t.status === "done").length} de{" "}
                {tasks.length} completadas. Cada pequeño paso cuenta, cuando el
                otro lo confirma.
              </p>
            </div>
          </div>
          <div className="sky-legend">
            <span>
              <span className="gold">✦</span> Completada
            </span>
            <span>◐ En progreso</span>
            <span>◌ Por verificar</span>
            <span>○ Pendiente</span>
          </div>
        </section>
        <section className="your-turn">
          <div className="row between">
            <h2>Te toca</h2>
            <small className="muted">{pending.length} pendientes</small>
          </div>
          {pending.length ? (
            pending.slice(0, 2).map((p) => {
              const task = data!.tasks.find((t) => t.id === p.task_id)!;
              return (
                <div className="card review-card" key={p.id}>
                  <div className="row gap">
                    <Avatar
                      name={partner?.display_name ?? "Tu pareja"}
                      partner
                    />
                    <p>
                      <strong>{partner?.display_name.split(" ")[0]}</strong>{" "}
                      reportó <strong>{p.reported_percent} %</strong> en «
                      {task.title}».
                    </p>
                  </div>
                  <span className="pill status review">
                    ✦ Te toca verificar
                  </span>
                  <Link
                    className="btn btn-primary"
                    to={`/dia/quests/${task.id}`}
                  >
                    Revisar y verificar <ArrowUpRight size={17} />
                  </Link>
                </div>
              );
            })
          ) : (
            <div className="card quiet-card">
              <Check size={24} />
              <h3>Todo al día por aquí</h3>
              <p className="muted">
                Cuando haya un avance para ti, aparecerá en este rincón.
              </p>
              <Link to="/dia/quests" className="text-link">
                Ir a nuestras tareas <ArrowRight size={16} />
              </Link>
            </div>
          )}
        </section>
      </div>
      <div className="dashboard-bottom">
        <section className="ticket">
          <p className="eyebrow">LO QUE VIENE</p>
          {events[0] ? (
            <Link to="/dia/calendario">
              <div className="row gap">
                <span className="date-tile">
                  <small>
                    {formatDate(events[0].start_at, { month: "short" })}
                  </small>
                  <strong>{new Date(events[0].start_at).getDate()}</strong>
                </span>
                <div>
                  <h3>{events[0].title}</h3>
                  <p>
                    {formatDate(events[0].start_at, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            </Link>
          ) : (
            <>
              <CalendarDays size={26} />
              <h3>Hagamos un plan</h3>
              <p>Un café, una llamada, un ratito para los dos.</p>
            </>
          )}
          <div className="ticket-divider" />
          <Link className="row between" to="/dia/calendario?crear=1">
            <Heart size={22} />
            <span>Guardar una fecha especial</span>
            <ArrowUpRight size={18} />
          </Link>
        </section>
        <section className="memory-feature">
          {photo ? (
            <Link to="/recuerdos/vault" className="polaroid">
              <PhotoImage photo={photo} />
              <p>{photo.title}</p>
              <small>{formatDate(photo.captured_at)}</small>
            </Link>
          ) : (
            <div className="polaroid memory-empty">
              <div>
                <Sparkles size={32} />
                <span>
                  Nos quedan tantos
                  <br />
                  recuerdos por guardar.
                </span>
              </div>
              <p>Un instante, para siempre.</p>
              <Link className="text-link" to="/recuerdos/vault?crear=1">
                Subir nuestro primer recuerdo <ArrowUpRight size={15} />
              </Link>
            </div>
          )}
        </section>
        <section className="home-prompts">
          <Link to="/nosotros/universo" className="question-card">
            <div className="row between">
              <span className="eyebrow">PREGUNTA DEL DÍA</span>
              <Orbit size={22} />
            </div>
            <h3>
              {question?.title ?? "¿Qué te gustaría construir conmigo hoy?"}
            </h3>
            <span className="text-link">
              Conocernos un poquito más <ArrowRight size={16} />
            </span>
          </Link>
          <Link to="/recuerdos/devlog?crear=1" className="note-link">
            <BookOpen size={22} />
            <span>
              Algo que quiero decirte
              <small>Deja una nota en nuestro diario</small>
            </span>
            <ArrowUpRight size={18} />
          </Link>
        </section>
      </div>
      <div className="home-footnote">
        ✧ Pequeñas cosas que, juntas, se vuelven nuestro universo.
      </div>
    </>
  );
}
