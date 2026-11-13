import { useState } from "react";
import { Pencil, PiggyBank, Plus, Trash2 } from "lucide-react";
import { useAction, useSpace } from "../lib/store";
import { check, supabase } from "../lib/supabase";
import { formatDate, localDay, money } from "../lib/utils";
import type { SavingsGoal } from "../lib/types";
import { Button, ErrorMessage, Modal } from "./ui";

type Draft = {
  title: string;
  target: string;
  target_on: string;
  person: string;
};

/** What we are saving for: progress from every saving assigned to each goal. */
export function SavingsGoals() {
  const { data, me, partner } = useSpace();
  const action = useAction();
  const today = localDay(new Date(), me.timezone);
  const [editing, setEditing] = useState<SavingsGoal | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>({
    title: "",
    target: "",
    target_on: "",
    person: "",
  });
  const goals = data!.savings_goals.filter((g) => !g.deleted_at);
  const saved = (id: string) =>
    data!.entries
      .filter(
        (e) =>
          !e.deleted_at &&
          e.kind === "transaction" &&
          e.details.direction === "saving" &&
          e.details.goal_id === id,
      )
      .reduce((s, e) => s + Number(e.amount ?? 0), 0);
  const owner = (g: SavingsGoal) =>
    g.person === null
      ? "De los dos"
      : g.person === me.id
        ? "Tuya"
        : `De ${data!.profiles.find((p) => p.id === g.person)?.display_name.split(" ")[0] ?? "?"}`;
  // Months left until the target date (at least one), to suggest a monthly amount.
  const monthsLeft = (on: string) => {
    const [y1, m1] = today.split("-").map(Number);
    const [y2, m2] = on.split("-").map(Number);
    return Math.max(1, (y2 - y1) * 12 + (m2 - m1));
  };
  function openForm(g?: SavingsGoal) {
    setEditing(g ?? null);
    setDraft(
      g
        ? {
            title: g.title,
            target: String(g.target),
            target_on: g.target_on ?? "",
            person: g.person ?? "",
          }
        : { title: "", target: "", target_on: "", person: "" },
    );
    action.setError("");
    setOpen(true);
  }
  return (
    <section className="card savings-goals" aria-labelledby="goals-title">
      <div className="row between wrap">
        <div>
          <h2 id="goals-title">Metas de ahorro</h2>
          <p className="muted small">
            Al registrar un ahorro (suelto o fijo), elige a qué meta va.
          </p>
        </div>
        <Button variant="secondary" onClick={() => openForm()}>
          <Plus size={17} aria-hidden />
          Nueva meta
        </Button>
      </div>
      <ErrorMessage error={!open && action.error} />
      {goals.length ? (
        <ul className="goal-list">
          {goals.map((g) => {
            const have = saved(g.id);
            const pct = Math.min(
              100,
              Math.round((have / Number(g.target)) * 100),
            );
            const missing = Math.max(0, Number(g.target) - have);
            return (
              <li key={g.id}>
                <div className="row between wrap">
                  <div className="goal-name">
                    <PiggyBank size={20} aria-hidden />
                    <div>
                      <strong>{g.title}</strong>
                      <small className="muted">
                        {owner(g)}
                        {g.target_on
                          ? ` · para el ${formatDate(g.target_on)}`
                          : ""}
                      </small>
                    </div>
                  </div>
                  <div className="row gap-sm">
                    <button
                      className="icon-button"
                      aria-label={`Editar la meta ${g.title}`}
                      onClick={() => openForm(g)}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`Quitar la meta ${g.title}`}
                      disabled={action.busy}
                      onClick={() =>
                        void action.run(async () =>
                          check(
                            await supabase.rpc("delete_savings_goal", {
                              p_id: g.id,
                            }),
                          ),
                        )
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div
                  className="track"
                  role="meter"
                  aria-label={`Avance de ${g.title}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={pct}
                >
                  <span
                    className="fill verified"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="small">
                  <strong>{money(have)}</strong> de {money(Number(g.target))} ·{" "}
                  {pct} %
                  {missing === 0
                    ? " · ¡Meta cumplida!"
                    : g.target_on && g.target_on >= today
                      ? ` · faltan ${money(missing)}: unos ${money(Math.ceil(missing / monthsLeft(g.target_on)))} al mes`
                      : ` · faltan ${money(missing)}`}
                </p>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="muted">
          Aún no hay metas. Crea una (un viaje, un fondo de emergencia…) y los
          ahorros que le asignen irán llenando su barra.
        </p>
      )}
      <Modal
        title={editing ? "Editar meta de ahorro" : "Una meta de ahorro"}
        open={open}
        onOpenChange={(v) => !action.busy && setOpen(v)}
      >
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            void action.run(
              async () =>
                check(
                  await supabase.rpc("save_savings_goal", {
                    p_id: editing?.id ?? null,
                    p_data: { ...draft, target: Number(draft.target) },
                  }),
                ),
              () => setOpen(false),
            );
          }}
        >
          <label className="field">
            Nombre
            <input
              required
              maxLength={120}
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="Viaje a Cusco, fondo de emergencia…"
            />
          </label>
          <label className="field">
            Meta (S/)
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              value={draft.target}
              onChange={(e) => setDraft({ ...draft, target: e.target.value })}
            />
          </label>
          <label className="field">
            Para cuándo (opcional)
            <input
              type="date"
              value={draft.target_on}
              onChange={(e) =>
                setDraft({ ...draft, target_on: e.target.value })
              }
            />
          </label>
          <label className="field">
            ¿De quién es la meta?
            <select
              value={draft.person}
              onChange={(e) => setDraft({ ...draft, person: e.target.value })}
            >
              <option value="">De los dos</option>
              <option value={me.id}>{me.display_name}</option>
              {partner && (
                <option value={partner.id}>{partner.display_name}</option>
              )}
            </select>
          </label>
          <ErrorMessage error={action.error} />
          <Button type="submit" busy={action.busy}>
            {editing ? "Guardar cambios" : "Crear meta"}
          </Button>
        </form>
      </Modal>
    </section>
  );
}
