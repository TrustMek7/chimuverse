import { ScheduleDate } from "../components/ScheduleDate";
import {
  DateMemoryModal,
  DatePolaroid,
  datePhoto,
} from "../components/DateMemory";
import { YouTubePlaylist } from "../components/YouTubePlaylist";
import { FinanceRecurring } from "../components/FinanceRecurring";
import { SavingsGoals } from "../components/SavingsGoals";
import { BOTH, personLabel, personLine, personOf } from "../lib/finance";
import { useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import {
  Plus,
  Shuffle,
  ArrowUpRight,
  Check,
  Lock,
  Trash2,
  Pencil,
  Music,
  Heart,
  Target,
  BookOpen,
  Clapperboard,
  Gift,
  Camera,
  Smile,
  Wallet,
  Download,
  Hourglass,
} from "lucide-react";
import { useSpace, useAction } from "../lib/store";
import { supabase, check } from "../lib/supabase";
import {
  localDay,
  formatDate,
  money,
  csv,
  download,
  safeLink,
} from "../lib/utils";
import type { Entry, EntryKind, Visibility } from "../lib/types";
import { PhotoImage } from "./Vault";
import {
  Button,
  Modal,
  PageHeading,
  ErrorMessage,
  Empty,
  VisibilityPill,
  VisibilityPicker,
  Status,
} from "../components/ui";
const config: Record<
  string,
  {
    kind: EntryKind;
    title: string;
    eyebrow: string;
    text: string;
    singular: string;
    icon: typeof Heart;
  }
> = {
  "/recuerdos/devlog": {
    kind: "journal",
    title: "Nuestro diario",
    eyebrow: "RECUERDOS",
    text: "Lo que vivimos. Lo que aprendemos. Lo que somos.",
    singular: "entrada",
    icon: BookOpen,
  },
  "/recuerdos/capsulas": {
    kind: "journal",
    title: "Cartas al futuro",
    eyebrow: "CÁPSULAS DEL TIEMPO",
    text: "Un pedacito de hoy, guardado para después.",
    singular: "cápsula",
    icon: Hourglass,
  },
  "/nosotros/animo": {
    kind: "mood",
    title: "¿Cómo está tu cielo hoy?",
    eyebrow: "NUESTRO ÁNIMO",
    text: "No todos los días son soleados. Aquí hay espacio para todos.",
    singular: "registro",
    icon: Smile,
  },
  "/experiencias/citas": {
    kind: "date",
    title: "Planes y citas",
    eyebrow: "EXPERIENCIAS",
    text: "No hace falta ir lejos para vivir algo bonito.",
    singular: "idea",
    icon: Heart,
  },
  "/creciendo/metas": {
    kind: "goal",
    title: "Metas y sueños",
    eyebrow: "CRECIENDO",
    text: "Soñarlo juntos es el primer paso.",
    singular: "meta",
    icon: Target,
  },
  "/creciendo/finanzas": {
    kind: "transaction",
    title: "Nuestras finanzas",
    eyebrow: "CRECIENDO",
    text: "Cuidar lo cotidiano también es una forma de cuidarnos.",
    singular: "movimiento",
    icon: Wallet,
  },
  "/ocio/watchlist": {
    kind: "watch",
    title: "Películas y series",
    eyebrow: "ENTRETENIMIENTO",
    text: "Un sofá. Algo rico. Y el siguiente «¿vemos uno más?».",
    singular: "título",
    icon: Clapperboard,
  },
  "/ocio/deseos": {
    kind: "wish",
    title: "Deseos y canciones",
    eyebrow: "ENTRETENIMIENTO",
    text: "Lo que nos hace ilusión. Lo que suena a nosotros.",
    singular: "deseo",
    icon: Gift,
  },
  "/ocio/soundtrack": {
    kind: "track",
    title: "Nuestras canciones",
    eyebrow: "ENTRETENIMIENTO",
    text: "Hay canciones que siempre serán nuestras.",
    singular: "canción",
    icon: Music,
  },
  "/recuerdos/viajes": {
    kind: "trip",
    title: "Nuestros viajes",
    eyebrow: "MEMORY VAULT",
    text: "Lugares que ya forman parte de nosotros.",
    singular: "viaje",
    icon: Heart,
  },
};
type Draft = {
  title: string;
  content: string;
  visibility: Visibility;
  status: string;
  occurred_on: string;
  unlock_at: string;
  amount: string;
  progress: number;
  category: string;
  link: string;
  artist: string;
  direction: string;
  mood: string;
  location: string;
  subtype: string;
  milestones: string;
  photo_id: string;
  person: string;
  goal_id: string;
};
function initial(kind: EntryKind, entry?: Entry, capsule = false): Draft {
  return {
    title: entry?.title ?? "",
    content: entry?.entry_bodies?.content ?? "",
    visibility: entry?.visibility ?? (capsule ? "capsule" : "shared"),
    status: entry?.status ?? "pending",
    occurred_on: entry?.occurred_on ?? localDay(),
    unlock_at: entry?.unlock_at?.slice(0, 16) ?? "",
    amount: entry?.amount?.toString() ?? "",
    progress: entry?.progress ?? 0,
    category: String(
      entry?.details.category ??
        (kind === "watch" ? "Película" : kind === "transaction" ? "Otros" : ""),
    ),
    link: String(entry?.details.link ?? ""),
    artist: String(entry?.details.artist ?? ""),
    direction: String(entry?.details.direction ?? "expense"),
    mood: String(entry?.details.mood ?? "bien"),
    location: String(entry?.details.location ?? ""),
    subtype: String(entry?.details.subtype ?? "hicimos"),
    milestones: String(entry?.details.milestones ?? ""),
    photo_id: String(entry?.details.photo_id ?? ""),
    person: entry
      ? String(
          "person" in entry.details
            ? (entry.details.person ?? "")
            : entry.owner_id,
        )
      : "",
    goal_id: String(entry?.details.goal_id ?? ""),
  };
}
export default function Collections() {
  const { pathname } = useLocation();
  const cfg = config[pathname] ?? config["/recuerdos/devlog"];
  const [params, setParams] = useSearchParams();
  const { data, me, partner } = useSpace();
  const [open, setOpen] = useState(params.has("crear"));
  const [editing, setEditing] = useState<Entry | undefined>();
  const [draft, setDraft] = useState<Draft>(() =>
    initial(cfg.kind, undefined, pathname.includes("capsulas")),
  );
  const [filter, setFilter] = useState("Todas");
  const [search, setSearch] = useState("");
  const [dateCategory, setDateCategory] = useState("Todas");
  const [dateLimit, setDateLimit] = useState(24);
  const [roulette, setRoulette] = useState<Entry | null>(null);
  const [scheduled, setScheduled] = useState<Entry | null>(null);
  const [living, setLiving] = useState<Entry | null>(null);
  const action = useAction();
  const [selectedKind, setSelectedKind] = useState<EntryKind>(cfg.kind);
  const [month, setMonth] = useState(localDay().slice(0, 7));
  const financeKind = (k: string) => k === "transaction" || k === "budget";
  const kind =
    pathname === "/ocio/deseos"
      ? selectedKind
      : pathname === "/creciendo/finanzas"
        ? selectedKind
        : cfg.kind;
  const entries = data!.entries
    .filter(
      (e) =>
        !e.deleted_at &&
        e.kind === kind &&
        (!pathname.includes("capsulas") || e.visibility === "capsule") &&
        (filter !== "Pendientes" || e.status !== "done") &&
        (filter !== "Historial" || e.status === "done") &&
        (filter !== "Sin foto" ||
          (e.status === "done" && !datePhoto(e, data!.photos))) &&
        (!financeKind(kind) || e.occurred_on.startsWith(month)) &&
        (kind !== "date" ||
          dateCategory === "Todas" ||
          String(e.details.category || "Sin categoría") === dateCategory) &&
        e.title.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
    )
    .sort((a, b) => b.occurred_on.localeCompare(a.occurred_on));
  const livedWithoutPhoto =
    kind === "date"
      ? data!.entries.filter(
          (e) =>
            e.kind === "date" &&
            !e.deleted_at &&
            e.status === "done" &&
            !datePhoto(e, data!.photos),
        ).length
      : 0;
  const allTransactions = data!.entries.filter(
    (e) => !e.deleted_at && e.kind === "transaction",
  );
  const monthTransactions = allTransactions.filter((e) =>
    e.occurred_on.startsWith(month),
  );
  const totals = (direction: string) =>
    monthTransactions
      .filter((e) => e.details.direction === direction)
      .reduce((s, e) => s + Number(e.amount ?? 0), 0);
  const budget = data!.entries
    .filter(
      (e) =>
        e.kind === "budget" && !e.deleted_at && e.occurred_on.startsWith(month),
    )
    .reduce((s, e) => s + Number(e.amount ?? 0), 0);
  function change<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }
  function openEditor(e?: Entry) {
    setEditing(e);
    const fresh = initial(kind, e, pathname.includes("capsulas"));
    setDraft(e ? fresh : { ...fresh, person: me.id });
    action.setError("");
    setOpen(true);
  }
  function close(v: boolean) {
    setOpen(v);
    if (!v && params.has("crear")) {
      params.delete("crear");
      setParams(params, { replace: true });
    }
  }
  async function save() {
    if (draft.link && !safeLink(draft.link)) {
      action.setError("Usa un enlace HTTPS válido.");
      return;
    }
    const isMood = kind === "mood";
    const title = isMood
      ? ({
          radiante: "Un día radiante",
          bien: "Me siento bien",
          tranquilo: "Un día tranquilo",
          bajo: "Un poco de lluvia",
          dificil: "Un día difícil",
        }[draft.mood] ?? draft.title)
      : draft.title;
    await action.run(
      async () =>
        check(
          await supabase.rpc("save_entry", {
            p_id: editing?.id ?? null,
            p_data: {
              kind,
              title,
              visibility:
                kind === "journal" && draft.subtype === "note_for_partner"
                  ? "shared"
                  : draft.visibility,
              status:
                kind === "goal"
                  ? draft.progress === 100
                    ? "done"
                    : draft.progress > 0
                      ? "progress"
                      : "pending"
                  : draft.status,
              occurred_on: draft.occurred_on,
              unlock_at:
                draft.visibility === "capsule"
                  ? new Date(draft.unlock_at).toISOString()
                  : null,
              amount: ["transaction", "budget"].includes(kind)
                ? Number(draft.amount)
                : null,
              progress: kind === "goal" ? draft.progress : 0,
              details: {
                ...(editing?.details ?? {}),
                category: draft.category,
                link: draft.link,
                artist: draft.artist,
                direction: draft.direction,
                mood: draft.mood,
                location: draft.location,
                subtype: draft.subtype,
                milestones: draft.milestones,
                photo_id: draft.photo_id,
                ...(kind === "transaction"
                  ? {
                      person: draft.person,
                      goal_id:
                        draft.direction === "saving" ? draft.goal_id : "",
                    }
                  : {}),
              },
            },
            p_content: draft.content,
          }),
        ),
      () => close(false),
    );
  }
  function setStatus(e: Entry, status: string) {
    void action.run(async () =>
      check(
        await supabase.rpc("save_entry", {
          p_id: e.id,
          p_data: { ...e, status },
          p_content: e.entry_bodies?.content ?? "",
        }),
      ),
    );
  }
  const isFinance = pathname === "/creciendo/finanzas";
  const Icon = cfg.icon;
  return (
    <>
      <PageHeading
        eyebrow={cfg.eyebrow}
        title={cfg.title}
        text={cfg.text}
        actions={
          <Button onClick={() => openEditor()}>
            <Plus size={18} />
            {kind === "mood"
              ? "Registrar mi ánimo"
              : `Añadir ${kind === "track" ? "canción" : kind === "budget" ? "presupuesto" : cfg.singular}`}
          </Button>
        }
      />
      <ErrorMessage error={action.error} />
      {kind === "track" && <YouTubePlaylist />}
      {kind === "journal" && (
        <div className="segments route-tabs">
          <Link
            aria-current={!pathname.includes("capsulas") ? "page" : undefined}
            to="/recuerdos/devlog"
          >
            Nuestro diario
          </Link>
          <Link
            aria-current={pathname.includes("capsulas") ? "page" : undefined}
            to="/recuerdos/capsulas"
          >
            Cápsulas del tiempo
          </Link>
        </div>
      )}
      {pathname === "/ocio/deseos" && (
        <div className="segments">
          {[
            ["wish", "Deseos y regalos"],
            ["track", "Nuestras canciones"],
          ].map(([k, label]) => (
            <button
              key={k}
              onClick={() => {
                setSelectedKind(k as EntryKind);
                setDraft(initial(k as EntryKind));
              }}
              aria-pressed={kind === k}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {isFinance && (
        <>
          <label className="field inline-field finance-month">
            Mes
            <input
              type="month"
              value={month}
              onChange={(e) => e.target.value && setMonth(e.target.value)}
            />
          </label>
          <div className="metrics-grid">
            <div className="card metric">
              <small>Ingresos del mes</small>
              <strong>{money(totals("income"))}</strong>
            </div>
            <div className="card metric">
              <small>Gastos del mes</small>
              <strong>{money(totals("expense"))}</strong>
            </div>
            <div className="card metric">
              <small>Ahorro del mes</small>
              <strong>{money(totals("saving"))}</strong>
            </div>
            <div className="card metric">
              <small>Disponible</small>
              <strong>
                {money(totals("income") - totals("expense") - totals("saving"))}
              </strong>
              <small className="muted">Ingresos − gastos − ahorro</small>
            </div>
          </div>
          {budget > 0 && (
            <div className="card budget-meter">
              <div className="row between wrap">
                <span>
                  Presupuesto: gastado{" "}
                  <strong>{money(totals("expense"))}</strong> de {money(budget)}
                </span>
                <strong
                  className={totals("expense") > budget ? "over-budget" : ""}
                >
                  {totals("expense") > budget
                    ? `Te pasaste ${money(totals("expense") - budget)}`
                    : `Quedan ${money(budget - totals("expense"))}`}
                </strong>
              </div>
              <div
                className="track"
                role="meter"
                aria-label="Presupuesto gastado"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.min(
                  100,
                  Math.round((totals("expense") / budget) * 100),
                )}
              >
                <span
                  className={`fill ${totals("expense") > budget ? "over" : "verified"}`}
                  style={{
                    width: `${Math.min(100, (totals("expense") / budget) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}
          <div className="card person-split">
            <h2>Por persona</h2>
            <div
              className="split-table"
              role="table"
              aria-label="Finanzas por persona"
            >
              <div role="row" className="split-head">
                <span role="columnheader">Quién</span>
                <span role="columnheader">Ingresos</span>
                <span role="columnheader">Gastos</span>
                <span role="columnheader">Ahorro</span>
                <span role="columnheader">Disponible</span>
              </div>
              {[
                [me.id, me.display_name.split(" ")[0]],
                ...(partner
                  ? [[partner.id, partner.display_name.split(" ")[0]]]
                  : []),
                [BOTH, "De los dos"],
              ].map(([who, label]) => {
                const sum = (direction: string) =>
                  monthTransactions
                    .filter(
                      (e) =>
                        personOf(e) === who &&
                        e.details.direction === direction,
                    )
                    .reduce((s, e) => s + Number(e.amount ?? 0), 0);
                return (
                  <div role="row" key={who || "both"}>
                    <span role="rowheader">{label}</span>
                    <span role="cell" data-label="Ingresos">
                      {money(sum("income"))}
                    </span>
                    <span role="cell" data-label="Gastos">
                      {money(sum("expense"))}
                    </span>
                    <span role="cell" data-label="Ahorro">
                      {money(sum("saving"))}
                    </span>
                    <strong role="cell" data-label="Disponible">
                      {money(sum("income") - sum("expense") - sum("saving"))}
                    </strong>
                  </div>
                );
              })}
            </div>
          </div>
          <p className="small muted inline-note">
            <Lock size={14} aria-hidden /> Las finanzas son de los dos:
            cualquiera puede añadir, corregir o quitar un movimiento.
          </p>
          <div className="segments">
            {[
              ["transaction", "Movimientos"],
              ["budget", "Presupuestos"],
            ].map(([k, label]) => (
              <button
                key={k}
                onClick={() => {
                  setSelectedKind(k as EntryKind);
                  setDraft(initial(k as EntryKind));
                }}
                aria-pressed={kind === k}
              >
                {label}
              </button>
            ))}
          </div>
          {kind === "transaction" && (
            <>
              <SavingsGoals />
              <FinanceRecurring />
            </>
          )}
        </>
      )}
      {kind === "mood" && (
        <section className="mood-summary card">
          <div>
            <p className="eyebrow">TU ÚLTIMA SEMANA</p>
            <h2>Cada día tiene su propio cielo</h2>
            <p className="muted">
              El estado y la nota se comparten entre los dos.
            </p>
          </div>
          <div className="mood-week">
            {Array.from({ length: 7 }, (_, i) => {
              const date = new Date();
              date.setDate(date.getDate() - 6 + i);
              const d = localDay(date);
              const mood = entries.find(
                (e) => e.owner_id === me.id && e.occurred_on === d,
              );
              return (
                <div key={d}>
                  <span>
                    {mood ? moodEmoji(String(mood.details.mood)) : "·"}
                  </span>
                  <small>
                    {formatDate(d, {
                      weekday: "short",
                      day: undefined,
                      month: undefined,
                    })}
                  </small>
                </div>
              );
            })}
          </div>
        </section>
      )}
      {livedWithoutPhoto > 0 && filter !== "Sin foto" && (
        <div className="banner date-photo-reminder" role="status">
          <Camera size={20} aria-hidden />
          <span>
            {livedWithoutPhoto === 1
              ? "Una cita que ya vivieron todavía no tiene foto."
              : `${livedWithoutPhoto} citas que ya vivieron todavía no tienen foto.`}{" "}
            Cuando la encuentren, súbanla para completar su polaroid.
          </span>
          <Button variant="secondary" onClick={() => setFilter("Sin foto")}>
            Ver citas sin foto
          </Button>
        </div>
      )}
      <div className="toolbar">
        {(kind === "date" || kind === "watch") && (
          <div className="segments">
            {(kind === "date"
              ? ["Todas", "Pendientes", "Historial", "Sin foto"]
              : ["Todas", "Pendientes", "Historial"]
            ).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
              >
                {f}
              </button>
            ))}
          </div>
        )}
        <input
          aria-label="Buscar"
          className="search-input"
          placeholder={kind === "date" ? "Buscar citas…" : "Buscar…"}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setDateLimit(24);
          }}
        />
        {kind === "date" && (
          <select
            aria-label="Categoría de cita"
            className="toolbar-select"
            value={dateCategory}
            onChange={(e) => {
              setDateCategory(e.target.value);
              setDateLimit(24);
            }}
          >
            <option value="Todas">Todas las categorías</option>
            {[
              ...new Set(
                data!.entries
                  .filter((e) => e.kind === "date" && !e.deleted_at)
                  .map((e) => String(e.details.category || "Sin categoría")),
              ),
            ]
              .sort()
              .map((c) => (
                <option key={c}>{c}</option>
              ))}
          </select>
        )}
        {["date", "watch"].includes(kind) && (
          <Button
            variant="secondary"
            onClick={() => {
              const available = entries.filter((e) => e.status !== "done");
              setRoulette(
                available.length
                  ? available[
                      crypto.getRandomValues(new Uint32Array(1))[0] %
                        available.length
                    ]
                  : null,
              );
              if (!available.length)
                action.setError("Añade primero alguna idea pendiente.");
            }}
          >
            <Shuffle size={17} />
            Que el universo elija
          </Button>
        )}
        {["wish", "track", "transaction"].includes(kind) && (
          <Button
            variant="ghost"
            onClick={() =>
              download(
                `${kind}.csv`,
                csv(
                  entries.map((e) => ({
                    titulo: e.title,
                    fecha: e.occurred_on,
                    estado: e.status,
                    enlace: e.details.link ?? "",
                    importe: e.amount ?? "",
                    visibilidad: e.visibility,
                  })),
                ),
                "text/csv;charset=utf-8",
              )
            }
          >
            <Download size={17} />
            CSV
          </Button>
        )}
      </div>
      {entries.length ? (
        <div
          className={`collection-grid ${kind === "journal" ? "journal-grid" : ""}`}
        >
          {(kind === "date" ? entries.slice(0, dateLimit) : entries).map(
            (e) => {
              const sealed =
                e.visibility === "capsule" &&
                new Date(e.unlock_at!) > new Date();
              return (
                <article
                  className={`card collection-card kind-${kind}`}
                  key={e.id}
                >
                  <div className="row between">
                    <span className="collection-icon">
                      {kind === "mood" ? (
                        <span className="mood-emoji">
                          {moodEmoji(String(e.details.mood))}
                        </span>
                      ) : (
                        <Icon size={23} />
                      )}
                    </span>
                    <VisibilityPill value={e.visibility} />
                  </div>
                  <div className="row gap wrap">
                    <small className="eyebrow">
                      {e.details.category ||
                        e.details.subtype ||
                        formatDate(e.occurred_on)}
                    </small>
                    {["watch", "date", "goal", "wish"].includes(kind) && (
                      <Status value={e.status} />
                    )}
                  </div>
                  {kind === "goal" &&
                    e.details.photo_id &&
                    data!.photos.some(
                      (p) => p.id === e.details.photo_id && !p.deleted_at,
                    ) && (
                      <div className="goal-photo">
                        <PhotoImage
                          photo={data!.photos.find(
                            (p) => p.id === e.details.photo_id,
                          )!}
                        />
                      </div>
                    )}
                  {kind === "date" && e.status === "done" && (
                    <DatePolaroid
                      entry={e}
                      photo={datePhoto(e, data!.photos)}
                    />
                  )}
                  <h2>{e.title}</h2>
                  {kind === "date" && e.details.duration_minutes && (
                    <p className="small muted">
                      {e.details.setting} · Duración sugerida:{" "}
                      {Number(e.details.duration_minutes) / 60} h · Presupuesto
                      orientativo: {e.details.budget}
                    </p>
                  )}
                  {e.details.artist && (
                    <p className="muted">{e.details.artist}</p>
                  )}
                  {sealed ? (
                    <div className="sealed">
                      <Lock size={22} />
                      <p>Un mensaje esperando su momento.</p>
                      <strong>Se abre el {formatDate(e.unlock_at!)}</strong>
                    </div>
                  ) : (
                    e.entry_bodies?.content && (
                      <p
                        className={`entry-content ${kind === "journal" ? "hand-note" : ""}`}
                      >
                        {e.entry_bodies.content}
                      </p>
                    )
                  )}
                  {kind === "goal" && (
                    <>
                      <label className="field">
                        Un recuerdo para nuestro tablero de sueños
                        <select
                          value={draft.photo_id}
                          onChange={(e) => change("photo_id", e.target.value)}
                        >
                          <option value="">Sin imagen</option>
                          {data!.photos
                            .filter((p) => !p.deleted_at)
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.title} · {"Compartido"}
                              </option>
                            ))}
                        </select>
                        <small className="muted">
                          La imagen también se comparte entre los dos.
                        </small>
                      </label>
                      <div className="row between">
                        <small>Progreso de la meta</small>
                        <strong>{e.progress} %</strong>
                      </div>
                      <div
                        className="track"
                        role="meter"
                        aria-label="Progreso de la meta"
                        aria-valuenow={e.progress}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <span
                          className="fill verified"
                          style={{ width: `${e.progress}%` }}
                        />
                      </div>
                      {e.details.milestones && (
                        <ul className="milestones">
                          {String(e.details.milestones)
                            .split("\n")
                            .filter(Boolean)
                            .map((m, i) => (
                              <li key={i}>
                                {m.startsWith("[x]") ? "✓" : "○"}{" "}
                                {m.replace(/^\[[x ]\]\s*/, "")}
                              </li>
                            ))}
                        </ul>
                      )}
                    </>
                  )}
                  {["transaction", "budget"].includes(kind) && (
                    <strong
                      className={`amount ${e.details.direction === "income" ? "income" : ""}`}
                    >
                      {e.details.direction === "income"
                        ? "+"
                        : kind === "budget"
                          ? ""
                          : "−"}
                      {money(Number(e.amount))}
                    </strong>
                  )}
                  {kind === "transaction" && (
                    <p className="small">
                      {personLine(e, data!.profiles, me.id)}
                      {e.details.goal_id &&
                      data!.savings_goals.some(
                        (g) => g.id === e.details.goal_id && !g.deleted_at,
                      )
                        ? ` · para «${data!.savings_goals.find((g) => g.id === e.details.goal_id)!.title}»`
                        : ""}
                    </p>
                  )}
                  {financeKind(kind) &&
                    (e.details.recurring_id || e.details.edited_by) && (
                      <p className="small muted">
                        {e.details.recurring_id
                          ? "Fijo · se registró solo"
                          : ""}
                        {e.details.recurring_id && e.details.edited_by
                          ? " · "
                          : ""}
                        {e.details.edited_by
                          ? `Corregido por ${
                              e.details.edited_by === me.id
                                ? "ti"
                                : data!.profiles
                                    .find((p) => p.id === e.details.edited_by)
                                    ?.display_name.split(" ")[0]
                            }`
                          : ""}
                      </p>
                    )}
                  {e.details.location && (
                    <p className="muted">⌖ {e.details.location}</p>
                  )}
                  {e.details.link && safeLink(String(e.details.link)) && (
                    <a
                      className="text-link"
                      href={safeLink(String(e.details.link))!}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {kind === "track" ? "Escuchar" : "Abrir enlace"}{" "}
                      <ArrowUpRight size={16} />
                    </a>
                  )}
                  <div className="row between card-meta">
                    <small>
                      {kind === "date"
                        ? e.status === "done"
                          ? `Vivida el ${formatDate(e.occurred_on)}`
                          : ""
                        : `${formatDate(e.occurred_on)} · `}
                      {kind !== "date" &&
                        (e.owner_id === me.id
                          ? "Tú"
                          : data!.profiles
                              .find((p) => p.id === e.owner_id)
                              ?.display_name.split(" ")[0])}
                    </small>
                    {(e.owner_id === me.id || financeKind(kind) || kind === "date" || kind === "wish") && !sealed && (
                      <div className="row gap-sm">
                        <button
                          className="icon-button"
                          aria-label={`Editar ${e.title}`}
                          onClick={() => openEditor(e)}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label={`Enviar ${e.title} a la papelera`}
                          onClick={() =>
                            action.run(async () =>
                              check(
                                await supabase.rpc("trash_item", {
                                  p_table: "entries",
                                  p_id: e.id,
                                }),
                              ),
                            )
                          }
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                  {(kind === "watch" || kind === "wish" || e.owner_id === me.id) &&
                    ["watch", "wish"].includes(kind) &&
                    e.status !== "done" && (
                      <div className="row gap-sm">
                        <Button
                          variant="secondary"
                          busy={action.busy}
                          onClick={() => setStatus(e, "done")}
                        >
                          <Check size={16} />
                          {kind === "wish"
                            ? "¡Deseo cumplido!"
                            : "Marcar como completado"}
                        </Button>
                        {kind === "watch" && e.status === "pending" && (
                          <Button
                            variant="ghost"
                            busy={action.busy}
                            onClick={() => setStatus(e, "progress")}
                          >
                            Empezar
                          </Button>
                        )}
                      </div>
                    )}
                  {kind === "date" && (
                    <div className="row gap-sm wrap card-actions">
                      {e.status !== "done" && (
                        <Button
                          variant="secondary"
                          onClick={() => setLiving(e)}
                        >
                          <Check size={16} />
                          Ya la vivimos
                        </Button>
                      )}
                      {e.status === "done" ? (
                        <Button
                          variant="secondary"
                          onClick={() => setLiving(e)}
                        >
                          {datePhoto(e, data!.photos) ? (
                            <Pencil size={16} aria-hidden />
                          ) : (
                            <Camera size={16} aria-hidden />
                          )}
                          {datePhoto(e, data!.photos)
                            ? "Editar recuerdo"
                            : "Añadir foto"}
                        </Button>
                      ) : (
                        <Button
                          variant="secondary"
                          onClick={() => setScheduled(e)}
                        >
                          {e.calendar_event_id
                            ? "Cambiar horario de la cita"
                            : "Agendar cita"}
                        </Button>
                      )}
                      {e.calendar_event_id && (
                        <Link
                          className="text-link"
                          to={`/dia/calendario?evento=${e.calendar_event_id}`}
                        >
                          Ver en el calendario <ArrowUpRight size={16} />
                        </Link>
                      )}
                    </div>
                  )}
                  {kind === "trip" && (
                    <Link
                      to={`/recuerdos/vault?viaje=${e.id}`}
                      className="text-link"
                    >
                      Ver el álbum <ArrowUpRight size={16} />
                    </Link>
                  )}
                </article>
              );
            },
          )}
        </div>
      ) : (
        <Empty
          title={
            kind === "mood"
              ? "Aquí puedes sentirte como estés"
              : "Todavía nos queda por escribir"
          }
          text="No hay registros con estos filtros. Lo que añadas aquí se guardará en nuestro espacio."
        />
      )}
      {kind === "date" && entries.length > dateLimit && (
        <Button variant="secondary" onClick={() => setDateLimit((n) => n + 24)}>
          Ver más citas ({entries.length - dateLimit})
        </Button>
      )}
      <Modal
        title={
          editing
            ? "Editar este momento"
            : {
                journal: "Una nueva entrada",
                mood: "Registrar cómo me siento",
                date: "Una nueva idea",
                goal: "Una meta por construir",
                watch: "Algo que queremos ver",
                wish: "Un nuevo deseo",
                track: "Una canción nuestra",
                transaction: "Un nuevo movimiento",
                budget: "Un nuevo presupuesto",
                trip: "Un nuevo viaje",
              }[kind]
        }
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
          {kind === "mood" ? (
            <fieldset className="mood-picker">
              <legend>¿Cómo te sientes?</legend>
              {[
                ["radiante", "Radiante"],
                ["bien", "Bien"],
                ["tranquilo", "En calma"],
                ["bajo", "Bajito"],
                ["dificil", "Día difícil"],
              ].map(([m, label]) => (
                <button
                  type="button"
                  key={m}
                  aria-pressed={draft.mood === m}
                  onClick={() => change("mood", m)}
                >
                  <span>{moodEmoji(m)}</span>
                  {label}
                </button>
              ))}
            </fieldset>
          ) : (
            <label className="field">
              {kind === "track" ? "Canción" : "Título"}
              <input
                autoFocus
                required
                maxLength={160}
                value={draft.title}
                onChange={(e) => change("title", e.target.value)}
              />
            </label>
          )}
          {kind === "journal" && (
            <label className="field">
              Tipo de entrada
              <select
                value={draft.subtype}
                onChange={(e) => {
                  change("subtype", e.target.value);
                  if (e.target.value === "note_for_partner")
                    change("visibility", "shared");
                }}
              >
                {[
                  ["hicimos", "Lo que hicimos"],
                  ["nos_paso", "Lo que nos pasó"],
                  ["aprendimos", "Lo que aprendimos"],
                  ["acordamos", "Un acuerdo"],
                  ["note_for_partner", "Una nota para ti"],
                ].map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="field">
            {kind === "mood"
              ? "Una nota para compartir cómo te sientes"
              : "Lo que quieres guardar"}
            <textarea
              maxLength={30000}
              rows={kind === "journal" ? 6 : 3}
              value={draft.content}
              onChange={(e) => change("content", e.target.value)}
            />
          </label>
          {["watch", "transaction", "budget", "date", "wish"].includes(
            kind,
          ) && (
            <label className="field">
              Categoría
              {kind === "watch" ? (
                <select
                  value={draft.category}
                  onChange={(e) => change("category", e.target.value)}
                >
                  {["Película", "Serie", "Videojuego"].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              ) : (
                <input
                  maxLength={60}
                  value={draft.category}
                  onChange={(e) => change("category", e.target.value)}
                  placeholder={
                    kind === "date"
                      ? "En casa, una escapada…"
                      : "Hogar, comida, un regalo…"
                  }
                />
              )}
            </label>
          )}
          {kind === "track" && (
            <label className="field">
              Artista
              <input
                value={draft.artist}
                onChange={(e) => change("artist", e.target.value)}
              />
            </label>
          )}
          {["date", "trip"].includes(kind) && (
            <label className="field">
              Lugar (opcional)
              <input
                value={draft.location}
                onChange={(e) => change("location", e.target.value)}
              />
            </label>
          )}
          {["watch", "wish", "track", "goal"].includes(kind) && (
            <label className="field">
              Enlace HTTPS (opcional)
              <input
                type="url"
                value={draft.link}
                onChange={(e) => change("link", e.target.value)}
              />
            </label>
          )}
          {kind === "goal" && (
            <>
              <label className="field">
                Progreso: {draft.progress} %
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={draft.progress}
                  onChange={(e) => change("progress", Number(e.target.value))}
                />
              </label>
              <label className="field">
                Hitos, uno por línea (marca [x] los completados)
                <textarea
                  value={draft.milestones}
                  onChange={(e) => change("milestones", e.target.value)}
                  placeholder={
                    "[x] Dar el primer paso\n[ ] Seguir construyendo"
                  }
                />
              </label>
            </>
          )}
          {["transaction", "budget"].includes(kind) && (
            <>
              <label className="field">
                Importe (S/)
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  max="99999999999"
                  value={draft.amount}
                  onChange={(e) => change("amount", e.target.value)}
                />
              </label>
              {kind === "transaction" && (
                <label className="field">
                  Tipo
                  <select
                    value={draft.direction}
                    onChange={(e) => change("direction", e.target.value)}
                  >
                    <option value="expense">Gasto</option>
                    <option value="income">Ingreso</option>
                    <option value="saving">Ahorro</option>
                  </select>
                </label>
              )}
              {kind === "transaction" && (
                <label className="field">
                  {personLabel(draft.direction)}
                  <select
                    value={draft.person}
                    onChange={(e) => change("person", e.target.value)}
                  >
                    <option value={me.id}>{me.display_name}</option>
                    {partner && (
                      <option value={partner.id}>{partner.display_name}</option>
                    )}
                    <option value={BOTH}>De los dos (fondo común)</option>
                  </select>
                </label>
              )}
              {kind === "transaction" && draft.direction === "saving" && (
                <label className="field">
                  ¿Para qué meta?
                  <select
                    value={draft.goal_id}
                    onChange={(e) => change("goal_id", e.target.value)}
                  >
                    <option value="">Sin meta</option>
                    {data!.savings_goals
                      .filter((g) => !g.deleted_at)
                      .map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.title}
                        </option>
                      ))}
                  </select>
                </label>
              )}
            </>
          )}
          <label className="field">
            Fecha
            <input
              required
              type="date"
              value={draft.occurred_on}
              onChange={(e) => change("occurred_on", e.target.value)}
            />
          </label>
          {draft.subtype === "note_for_partner" && kind === "journal" ? (
            <p className="banner">
              Esta nota es para tu pareja y se guardará compartida.
            </p>
          ) : (
            <VisibilityPicker
              value={draft.visibility}
              onChange={(v) => change("visibility", v)}
              capsule={kind === "journal"}
            />
          )}{" "}
          {draft.visibility === "capsule" && (
            <>
              <label className="field">
                Momento de apertura
                <input
                  required
                  type="datetime-local"
                  min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                  value={draft.unlock_at}
                  onChange={(e) => change("unlock_at", e.target.value)}
                />
              </label>
              <p className="banner">
                <Lock size={18} />
                El texto quedará sellado para los dos, incluso para ti, hasta la
                apertura. El título será visible. No podrás editarla mientras
                esté sellada.
              </p>
            </>
          )}
          <Button type="submit" busy={action.busy}>
            {draft.visibility === "capsule"
              ? "Sellar para el futuro"
              : "Guardar este momento"}
          </Button>
        </form>
      </Modal>
      <DateMemoryModal entry={living} onClose={() => setLiving(null)} />
      {scheduled && (
        <ScheduleDate
          key={scheduled.id}
          entry={scheduled}
          close={() => setScheduled(null)}
        />
      )}
      <Modal
        title="El universo eligió…"
        open={!!roulette}
        onOpenChange={() => setRoulette(null)}
      >
        {roulette && (
          <div className="roulette-result">
            <Shuffle size={38} />
            <h2>{roulette.title}</h2>
            <p>{roulette.entry_bodies?.content}</p>
            {roulette.kind === "date" && (
              <Button
                onClick={() => {
                  setScheduled(roulette);
                  setRoulette(null);
                }}
              >
                Agendar esta cita
              </Button>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
function moodEmoji(m: string) {
  return (
    (
      {
        radiante: "☀️",
        bien: "🌤️",
        tranquilo: "🌿",
        bajo: "🌧️",
        dificil: "⛈️",
      } as Record<string, string>
    )[m] ?? "☁️"
  );
}
