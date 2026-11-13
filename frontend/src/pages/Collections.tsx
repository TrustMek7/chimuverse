import { YouTubePlaylist } from "../components/YouTubePlaylist";
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
    title: "DevLog of Us",
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
    eyebrow: "MOOD TRACKER",
    text: "No todos los días son soleados. Aquí hay espacio para todos.",
    singular: "registro",
    icon: Smile,
  },
  "/experiencias/citas": {
    kind: "date",
    title: "Date Planner",
    eyebrow: "EXPERIENCIAS",
    text: "No hace falta ir lejos para vivir algo bonito.",
    singular: "idea",
    icon: Heart,
  },
  "/creciendo/metas": {
    kind: "goal",
    title: "Goals & Dreams",
    eyebrow: "CRECIENDO",
    text: "Soñarlo juntos es el primer paso.",
    singular: "meta",
    icon: Target,
  },
  "/creciendo/finanzas": {
    kind: "transaction",
    title: "Our Finances",
    eyebrow: "CRECIENDO",
    text: "Cuidar lo cotidiano también es una forma de cuidarnos.",
    singular: "movimiento",
    icon: Wallet,
  },
  "/ocio/watchlist": {
    kind: "watch",
    title: "Watchlist",
    eyebrow: "ENTRETENIMIENTO",
    text: "Un sofá. Algo rico. Y el siguiente «¿vemos uno más?».",
    singular: "título",
    icon: Clapperboard,
  },
  "/ocio/deseos": {
    kind: "wish",
    title: "Wishlist & Soundtrack",
    eyebrow: "ENTRETENIMIENTO",
    text: "Lo que nos hace ilusión. Lo que suena a nosotros.",
    singular: "deseo",
    icon: Gift,
  },
  "/ocio/soundtrack": {
    kind: "track",
    title: "Nuestro soundtrack",
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
};
function initial(kind: EntryKind, entry?: Entry, capsule = false): Draft {
  return {
    title: entry?.title ?? "",
    content: entry?.entry_bodies?.content ?? "",
    visibility: entry?.visibility ?? (capsule ? "capsule" : "private"),
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
  };
}
export default function Collections() {
  const { pathname } = useLocation();
  const cfg = config[pathname] ?? config["/recuerdos/devlog"];
  const [params, setParams] = useSearchParams();
  const { data, me } = useSpace();
  const [open, setOpen] = useState(params.has("crear"));
  const [editing, setEditing] = useState<Entry | undefined>();
  const [draft, setDraft] = useState<Draft>(() =>
    initial(cfg.kind, undefined, pathname.includes("capsulas")),
  );
  const [filter, setFilter] = useState("Todas");
  const [search, setSearch] = useState("");
  const [roulette, setRoulette] = useState<Entry | null>(null);
  const action = useAction();
  const [selectedKind, setSelectedKind] = useState<EntryKind>(cfg.kind);
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
        (filter !== "Solo yo" ||
          (e.owner_id === me.id && e.visibility === "private")) &&
        (filter !== "Compartidas" || e.visibility === "shared") &&
        (filter !== "Pendientes" || e.status !== "done") &&
        (filter !== "Historial" || e.status === "done") &&
        e.title.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
    )
    .sort((a, b) => b.occurred_on.localeCompare(a.occurred_on));
  const allTransactions = data!.entries.filter(
    (e) => !e.deleted_at && e.kind === "transaction",
  );
  const thisMonth = localDay().slice(0, 7);
  const monthTransactions = allTransactions.filter((e) =>
    e.occurred_on.startsWith(thisMonth),
  );
  const totals = (direction: string) =>
    monthTransactions
      .filter((e) => e.details.direction === direction)
      .reduce((s, e) => s + Number(e.amount ?? 0), 0);
  const budget = data!.entries
    .filter(
      (e) =>
        e.kind === "budget" &&
        !e.deleted_at &&
        e.owner_id === me.id &&
        e.occurred_on.startsWith(thisMonth),
    )
    .reduce((s, e) => s + Number(e.amount ?? 0), 0);
  function change<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }
  function openEditor(e?: Entry) {
    setEditing(e);
    setDraft(initial(kind, e, pathname.includes("capsulas")));
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
                category: draft.category,
                link: draft.link,
                artist: draft.artist,
                direction: draft.direction,
                mood: draft.mood,
                location: draft.location,
                subtype: draft.subtype,
                milestones: draft.milestones,
                photo_id: draft.photo_id,
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
            ["track", "Nuestro soundtrack"],
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
          <div className="metrics-grid">
            <div className="card metric">
              <small>Ingresos visibles · este mes</small>
              <strong>{money(totals("income"))}</strong>
            </div>
            <div className="card metric">
              <small>Gastos visibles · este mes</small>
              <strong>{money(totals("expense"))}</strong>
            </div>
            <div className="card metric">
              <small>Balance</small>
              <strong>{money(totals("income") - totals("expense"))}</strong>
            </div>
            <div className="card metric">
              <small>Mi presupuesto · este mes</small>
              <strong>{money(budget)}</strong>
            </div>
          </div>
          <p className="small muted">
            <Lock size={14} /> Solo se suman tus registros y los compartidos.
            Los movimientos privados de tu pareja no se incluyen.
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
        </>
      )}
      {kind === "mood" && (
        <section className="mood-summary card">
          <div>
            <p className="eyebrow">TU ÚLTIMA SEMANA</p>
            <h2>Cada día tiene su propio cielo</h2>
            <p className="muted">
              Compartir el estado es opcional. Tu nota permanece privada.
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
      <div className="toolbar">
        <div className="segments">
          {(kind === "watch" || kind === "date"
            ? ["Todas", "Pendientes", "Historial"]
            : ["Todas", "Solo yo", "Compartidas"]
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
        <input
          aria-label="Buscar"
          className="search-input"
          placeholder="Buscar en nuestros momentos…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
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
          {entries.map((e) => {
            const sealed =
              e.visibility === "capsule" && new Date(e.unlock_at!) > new Date();
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
                <h2>{e.title}</h2>
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
                      Un recuerdo para nuestro vision board
                      <select
                        value={draft.photo_id}
                        onChange={(e) => change("photo_id", e.target.value)}
                      >
                        <option value="">Sin imagen</option>
                        {data!.photos
                          .filter((p) => !p.deleted_at)
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.title} ·{" "}
                              {p.visibility === "private"
                                ? "Solo yo"
                                : "Compartido"}
                            </option>
                          ))}
                      </select>
                      <small className="muted">
                        La imagen conserva su privacidad original.
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
                    {formatDate(e.occurred_on)} ·{" "}
                    {e.owner_id === me.id
                      ? "Tú"
                      : data!.profiles
                          .find((p) => p.id === e.owner_id)
                          ?.display_name.split(" ")[0]}
                  </small>
                  {e.owner_id === me.id && !sealed && (
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
                {e.owner_id === me.id &&
                  ["watch", "date", "wish"].includes(kind) &&
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
                          : kind === "date"
                            ? "Ya la vivimos"
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
                  <Link
                    to={`/dia/calendario?crear=1&titulo=${encodeURIComponent(e.title)}`}
                    className="text-link"
                  >
                    Planear en el calendario <ArrowUpRight size={16} />
                  </Link>
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
          })}
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
              ? "Una nota solo para ti (nunca se comparte)"
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
              <Link
                to={`/dia/calendario?crear=1&titulo=${encodeURIComponent(roulette.title)}`}
                className="btn btn-primary"
              >
                Hagamos el plan
              </Link>
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
