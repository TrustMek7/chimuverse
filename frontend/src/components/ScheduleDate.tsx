import { useState } from "react";
import { Link } from "react-router-dom";
import { DateTime } from "luxon";
import { useQuery } from "@tanstack/react-query";
import type { Entry } from "../lib/types";
import { useSpace, useAction } from "../lib/store";
import { check, supabase } from "../lib/supabase";
import { Modal, Button, ErrorMessage } from "./ui";

export function ScheduleDate({
  entry,
  close,
}: {
  entry: Entry;
  close: () => void;
}) {
  const { data, me } = useSpace();
  const action = useAction();
  const existing = data!.calendar_events.find(
    (e) => e.id === entry.calendar_event_id && !e.deleted_at,
  );
  const initial = existing
    ? DateTime.fromISO(existing.start_at).setZone(me.timezone)
    : DateTime.now()
        .setZone(me.timezone)
        .plus({ days: 1 })
        .set({ hour: 18, minute: 0, second: 0, millisecond: 0 });
  const [start, setStart] = useState(initial.toFormat("yyyy-MM-dd'T'HH:mm"));
  const [end, setEnd] = useState(
    (existing
      ? DateTime.fromISO(existing.end_at).setZone(me.timezone)
      : initial.plus({ minutes: Number(entry.details.duration_minutes) || 120 })
    ).toFormat("yyyy-MM-dd'T'HH:mm"),
  );
  const [saved, setSaved] = useState("");
  const google = useQuery({
    queryKey: ["google-status"],
    queryFn: async () =>
      check(await supabase.rpc("google_status")) as { status: string },
  });
  async function save() {
    const from = DateTime.fromISO(start, { zone: me.timezone }),
      to = DateTime.fromISO(end, { zone: me.timezone });
    if (!from.isValid || !to.isValid || to.toMillis() <= from.toMillis()) {
      action.setError("El final debe ser posterior al inicio.");
      return;
    }
    const id = await action.run(async () =>
      check(
        await supabase.rpc("schedule_date", {
          p_entry_id: entry.id,
          p_start_at: from.toUTC().toISO(),
          p_end_at: to.toUTC().toISO(),
        }),
      ),
    );
    if (id) setSaved(String(id));
  }
  return (
    <Modal
      title={existing ? "Cambiar horario de la cita" : "Agendar nuestra cita"}
      open
      onOpenChange={(v) => {
        if (!v) close();
      }}
    >
      <h3>{entry.title}</h3>
      <ErrorMessage error={action.error} />
      {saved ? (
        <div className="form">
          <p role="status">La cita quedó guardada en nuestro calendario.</p>
          <Link
            className="btn btn-primary"
            to={`/dia/calendario?evento=${saved}`}
          >
            Ver en nuestro calendario
          </Link>
          <Button variant="secondary" onClick={close}>
            Listo
          </Button>
        </div>
      ) : (
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <p className="small muted">
            Horario en {me.timezone}. Pueden ajustar la duración sugerida.
          </p>
          <label className="field">
            Inicio de la cita
            <input
              required
              type="datetime-local"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label className="field">
            Fin de la cita
            <input
              required
              type="datetime-local"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
          {google.data?.status === "connected" ? (
            <p className="banner">
              Se exportará automáticamente a Google Calendar con ambos correos
              como invitados.
            </p>
          ) : (
            <p className="banner">
              Se guardará en la app. Para exportarla también a Google,{" "}
              <Link to="/ajustes/conexiones">
                conecta Google Calendar en Ajustes
              </Link>
              .
            </p>
          )}
          <Button type="submit" busy={action.busy}>
            {existing ? "Guardar nuevo horario" : "Agendar cita"}
          </Button>
        </form>
      )}
    </Modal>
  );
}
