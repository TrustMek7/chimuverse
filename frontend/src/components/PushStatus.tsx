import { useState } from "react";
import { Link } from "react-router-dom";
import { Bell, BellOff, BellRing, Share, SquarePlus, X } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { check, supabase } from "../lib/supabase";
import { usePush, dismissed, setDismissed, currentEndpoint } from "../lib/push";
import { formatDate } from "../lib/utils";
import { Button, ErrorMessage } from "./ui";

/** Dashboard status: a quiet pill when everything is fine, a one-tap card when it is not. */
export function PushStatus() {
  const push = usePush();
  const [hidden, setHidden] = useState(dismissed);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  async function enable() {
    setBusy(true);
    setError(null);
    try {
      await push.enable();
      setDismissed(false);
      setHidden(false);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  if (!push.state) return null;
  if (push.state === "active")
    return (
      <Link to="/ajustes" className="pill status done push-pill" aria-label="Notificaciones activadas en este dispositivo. Ver dispositivos en Ajustes">
        <BellRing size={13} aria-hidden /> Notificaciones activadas
      </Link>
    );
  if (push.state === "unsupported")
    return (
      <span className="pill push-pill muted-pill">
        <BellOff size={13} aria-hidden /> Este navegador no admite notificaciones
      </span>
    );
  if (hidden)
    return (
      <span className="push-compact">
        <span className="pill status push-pill">
          <BellOff size={13} aria-hidden /> Notificaciones desactivadas
        </span>
        {push.state === "off" ? (
          <button className="text-link" onClick={() => void enable()} disabled={busy}>
            Activar
          </button>
        ) : (
          <button className="text-link" onClick={() => { setDismissed(false); setHidden(false); }}>
            Ver cómo activarlas
          </button>
        )}
      </span>
    );
  return (
    <section className="card push-card" aria-labelledby="push-title">
      <button
        className="push-close"
        aria-label="Ahora no"
        onClick={() => {
          setDismissed(true);
          setHidden(true);
        }}
      >
        <X size={18} />
      </button>
      <Bell size={26} className="push-icon" aria-hidden />
      {push.state === "install" ? (
        <div>
          <h2 id="push-title">Agrega Chimuverse a tu inicio</h2>
          <p className="muted">
            En iPhone los avisos solo llegan a la app instalada. Es un momento:
          </p>
          <ol className="push-steps">
            <li>
              En Safari, toca <Share size={15} aria-label="Compartir" /> <strong>Compartir</strong>.
            </li>
            <li>
              Elige <SquarePlus size={15} aria-hidden /> <strong>Agregar a inicio</strong>.
            </li>
            <li>Abre Chimuverse desde el nuevo ícono y activa los avisos aquí mismo.</li>
          </ol>
        </div>
      ) : push.state === "denied" ? (
        <div>
          <h2 id="push-title">Las notificaciones están bloqueadas</h2>
          <p className="muted">
            Este dispositivo no permite avisos de Chimuverse. En la computadora, toca el candado junto a la
            dirección y permite las notificaciones. En el celular, búscalo en los ajustes del navegador o de
            la app. Luego vuelve aquí.
          </p>
        </div>
      ) : (
        <div>
          <h2 id="push-title">¿Te avisamos cuando te toque?</h2>
          <p className="muted">
            Un aviso en este dispositivo cuando haya algo por verificar, un plan nuevo o un recuerdo compartido.
          </p>
          <div className="row gap wrap">
            <Button onClick={() => void enable()} busy={busy}>
              <Bell size={17} /> Activar notificaciones
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setDismissed(true);
                setHidden(true);
              }}
            >
              Ahora no
            </Button>
          </div>
        </div>
      )}
      <ErrorMessage error={error} />
    </section>
  );
}

type Device = { id: string; label: string; created_at: string; last_seen_at: string; endpoint: string };

/** Settings: this device's switch and the list of the member's devices. */
export function PushSettings() {
  const push = usePush();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const devices = useQuery({
    queryKey: ["push-devices"],
    queryFn: async () => {
      const [rows, mine] = await Promise.all([
        supabase.from("push_subscriptions").select("id,label,created_at,last_seen_at,endpoint").order("created_at"),
        currentEndpoint(),
      ]);
      return { list: check(rows) as Device[], mine };
    },
  });
  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  const text = {
    active: "Activadas en este dispositivo.",
    off: "Desactivadas en este dispositivo.",
    denied: "Bloqueadas por el navegador. Permítelas en sus ajustes y vuelve aquí.",
    install: "En iPhone, agrega Chimuverse a tu inicio desde Safari y ábrela desde el ícono.",
    unsupported: "Este navegador no admite notificaciones.",
  }[push.state ?? "off"];
  return (
    <div className="push-settings">
      <div className="row between wrap">
        <div>
          <h3>Notificaciones en tus dispositivos</h3>
          <p className="muted">{push.state ? text : "Comprobando…"}</p>
        </div>
        {push.state === "active" ? (
          <Button variant="secondary" busy={busy} onClick={() => run(push.disable)}>
            Desactivar aquí
          </Button>
        ) : push.state === "off" ? (
          <Button busy={busy} onClick={() => run(push.enable)}>
            <Bell size={17} /> Activar en este dispositivo
          </Button>
        ) : null}
      </div>
      <ErrorMessage error={error ?? devices.error} />
      {devices.data && devices.data.list.length > 0 && (
        <ul className="device-list">
          {devices.data.list.map((d) => (
            <li key={d.id}>
              <span>
                <strong>{d.label}</strong>
                {d.endpoint === devices.data.mine && <span className="pill status done">Este dispositivo</span>}
                <small className="muted">Activado el {formatDate(d.created_at)}</small>
              </span>
              <button
                className="text-link"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    if (d.endpoint === devices.data.mine) await push.disable();
                    else check(await supabase.from("push_subscriptions").delete().eq("id", d.id));
                    await qc.invalidateQueries({ queryKey: ["push-devices"] });
                  })
                }
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
