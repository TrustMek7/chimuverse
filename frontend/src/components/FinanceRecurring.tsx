import { useState } from "react";
import { Pause, Pencil, Play, Plus, Repeat, Trash2 } from "lucide-react";
import { useAction, useSpace } from "../lib/store";
import { check, supabase } from "../lib/supabase";
import { formatDate, localDay, money } from "../lib/utils";
import type { FinanceRecurring as Rule } from "../lib/types";
import { Button, ErrorMessage, Modal } from "./ui";

const FREQUENCIES: Record<Rule["frequency"], string> = {
  weekly: "Cada semana",
  biweekly: "Cada dos semanas",
  monthly: "Cada mes",
  yearly: "Cada año",
};
const DIRECTIONS: Record<Rule["direction"], string> = {
  income: "Ingreso",
  expense: "Gasto",
  saving: "Ahorro",
};
type Draft = {
  title: string;
  amount: string;
  direction: Rule["direction"];
  category: string;
  frequency: Rule["frequency"];
  start_on: string;
  end_on: string;
  person: string;
  goal_id: string;
};

/** Fixed income, expenses and savings: each one creates its movement on its own date. */
export function FinanceRecurring() {
  const { data, me, partner } = useSpace();
  const action = useAction();
  const today = localDay(new Date(), me.timezone);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [open, setOpen] = useState(false);
  const [applyPast, setApplyPast] = useState(false);
  const blank: Draft = {
    title: "",
    amount: "",
    direction: "expense",
    category: "",
    frequency: "monthly",
    start_on: today,
    end_on: "",
    person: me.id,
    goal_id: "",
  };
  const [draft, setDraft] = useState<Draft>(blank);
  const rules = data!.finance_recurring
    .filter((r) => !r.deleted_at)
    .sort(
      (a, b) =>
        Number(b.active) - Number(a.active) ||
        a.next_on.localeCompare(b.next_on),
    );
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));
  function openForm(rule?: Rule) {
    setEditing(rule ?? null);
    setDraft(
      rule
        ? {
            title: rule.title,
            amount: String(rule.amount),
            direction: rule.direction,
            category: rule.category,
            frequency: rule.frequency,
            start_on: rule.start_on,
            end_on: rule.end_on ?? "",
            person: rule.person ?? "",
            goal_id: rule.goal_id ?? "",
          }
        : blank,
    );
    setApplyPast(false);
    action.setError("");
    setOpen(true);
  }
  const registered = (r: Rule | null) =>
    r
      ? data!.entries.filter(
          (e) => !e.deleted_at && e.details.recurring_id === r.id,
        ).length
      : 0;
  const save = (
    rule: Rule | null,
    patch: Partial<Draft> & { active?: boolean; apply_past?: boolean },
  ) =>
    action.run(
      async () =>
        check(
          await supabase.rpc("save_recurring", {
            p_id: rule?.id ?? null,
            p_data: {
              ...draft,
              ...patch,
              amount: Number(patch.amount ?? draft.amount),
            },
          }),
        ),
      () => setOpen(false),
    );
  const whose = (p: string | null) =>
    p === null
      ? "de los dos"
      : p === me.id
        ? "tuyo"
        : `de ${data!.profiles.find((u) => u.id === p)?.display_name.split(" ")[0] ?? "?"}`;
  const goals = data!.savings_goals.filter((g) => !g.deleted_at);
  const ended = (r: Rule) => !!r.end_on && r.next_on > r.end_on;
  return (
    <section className="card finance-fixed" aria-labelledby="fixed-title">
      <div className="row between wrap">
        <div>
          <h2 id="fixed-title">Ingresos y gastos fijos</h2>
          <p className="muted small">
            Sueldo, alquiler, suscripciones… Cada uno se registra solo en su
            fecha.
          </p>
        </div>
        <Button variant="secondary" onClick={() => openForm()}>
          <Plus size={17} aria-hidden />
          Añadir fijo
        </Button>
      </div>
      <ErrorMessage error={!open && action.error} />
      {rules.length ? (
        <ul className="fixed-list">
          {rules.map((r) => (
            <li key={r.id} className={r.active && !ended(r) ? "" : "paused"}>
              <Repeat size={18} aria-hidden />
              <div>
                <strong>{r.title}</strong>
                <small className="muted">
                  {DIRECTIONS[r.direction]} · {whose(r.person ?? null)} ·{" "}
                  {FREQUENCIES[r.frequency].toLowerCase()}
                  {r.category ? ` · ${r.category}` : ""} ·{" "}
                  {ended(r)
                    ? "terminado"
                    : r.active
                      ? `próximo: ${formatDate(r.next_on)}`
                      : "en pausa"}
                </small>
              </div>
              <strong
                className={`amount ${r.direction === "income" ? "income" : ""}`}
              >
                {r.direction === "income" ? "+" : "−"}
                {money(Number(r.amount))}
              </strong>
              <div className="row gap-sm">
                <button
                  className="icon-button"
                  aria-label={`Editar el fijo ${r.title}`}
                  onClick={() => openForm(r)}
                >
                  <Pencil size={16} />
                </button>
                {!ended(r) && (
                  <button
                    className="icon-button"
                    aria-label={`${r.active ? "Pausar" : "Reanudar"} el fijo ${r.title}`}
                    disabled={action.busy}
                    onClick={() => {
                      void action.run(async () =>
                        check(
                          await supabase.rpc("save_recurring", {
                            p_id: r.id,
                            p_data: {
                              title: r.title,
                              amount: r.amount,
                              category: r.category,
                              end_on: r.end_on ?? "",
                              active: !r.active,
                            },
                          }),
                        ),
                      );
                    }}
                  >
                    {r.active ? <Pause size={16} /> : <Play size={16} />}
                  </button>
                )}
                <button
                  className="icon-button"
                  aria-label={`Quitar el fijo ${r.title}`}
                  disabled={action.busy}
                  onClick={() =>
                    void action.run(async () =>
                      check(
                        await supabase.rpc("delete_recurring", { p_id: r.id }),
                      ),
                    )
                  }
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">
          Todavía no hay movimientos fijos. Añade el sueldo o el alquiler y se
          registrarán solos cada vez que toque.
        </p>
      )}
      <Modal
        title={editing ? "Editar movimiento fijo" : "Un movimiento fijo"}
        open={open}
        onOpenChange={(v) => !action.busy && setOpen(v)}
      >
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            void save(
              editing,
              editing ? { active: editing.active, apply_past: applyPast } : {},
            );
          }}
        >
          <label className="field">
            Nombre
            <input
              required
              maxLength={160}
              value={draft.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Sueldo, alquiler, internet…"
            />
          </label>
          <label className="field">
            Importe (S/)
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              value={draft.amount}
              onChange={(e) => set("amount", e.target.value)}
            />
          </label>
          <label className="field">
            Tipo
            <select
              value={draft.direction}
              onChange={(e) =>
                set("direction", e.target.value as Rule["direction"])
              }
            >
              {Object.entries(DIRECTIONS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            {draft.direction === "income"
              ? "¿De quién es el ingreso?"
              : draft.direction === "saving"
                ? "¿Quién ahorra?"
                : "¿Quién lo paga?"}
            <select
              value={draft.person}
              onChange={(e) => set("person", e.target.value)}
            >
              <option value={me.id}>{me.display_name}</option>
              {partner && (
                <option value={partner.id}>{partner.display_name}</option>
              )}
              <option value="">De los dos (fondo común)</option>
            </select>
          </label>
          {draft.direction === "saving" && (
            <label className="field">
              ¿Para qué meta?
              <select
                value={draft.goal_id}
                onChange={(e) => set("goal_id", e.target.value)}
              >
                <option value="">Sin meta</option>
                {goals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="field">
            Categoría
            <input
              maxLength={60}
              value={draft.category}
              onChange={(e) => set("category", e.target.value)}
              placeholder="Hogar, servicios, trabajo…"
            />
          </label>
          <label className="field">
            Se repite
            <select
              value={draft.frequency}
              onChange={(e) =>
                set("frequency", e.target.value as Rule["frequency"])
              }
            >
              {Object.entries(FREQUENCIES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Primera fecha
            <input
              required
              type="date"
              value={draft.start_on}
              onChange={(e) => set("start_on", e.target.value)}
            />
          </label>
          <label className="field">
            Termina (opcional)
            <input
              type="date"
              min={draft.start_on}
              value={draft.end_on}
              onChange={(e) => set("end_on", e.target.value)}
            />
          </label>
          {editing && registered(editing) > 0 && (
            <label className="check-field">
              <input
                type="checkbox"
                checked={applyPast}
                onChange={(e) => setApplyPast(e.target.checked)}
              />
              Corregir también{" "}
              {registered(editing) === 1
                ? "el movimiento ya registrado"
                : `los ${registered(editing)} movimientos ya registrados`}{" "}
              (nombre, importe, tipo y categoría; sus fechas no cambian)
            </label>
          )}
          <p className="small muted">
            {editing
              ? "Sin marcar esa opción, los cambios valen desde el próximo movimiento. Si cambias la frecuencia o la primera fecha, sigue después del último registrado, sin repetirlo."
              : draft.start_on < today
                ? "Como la primera fecha ya pasó, se registrarán también los movimientos desde esa fecha hasta hoy."
                : "Se registrará solo en cada fecha."}
          </p>
          <ErrorMessage error={action.error} />
          <Button type="submit" busy={action.busy}>
            {editing ? "Guardar cambios" : "Guardar movimiento fijo"}
          </Button>
        </form>
      </Modal>
    </section>
  );
}
