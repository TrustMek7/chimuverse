import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, MailCheck, Lock } from "lucide-react";
import { check, supabase } from "../lib/supabase";
import { formatDate } from "../lib/utils";
import { Button, ErrorMessage } from "./ui";

export type GmailStatus = {
  connected: boolean;
  email?: string | null;
  last_error?: string | null;
  last_sent_at?: string | null;
  partner_connected: boolean;
} | null;

export function useGmailStatus() {
  return useQuery({
    queryKey: ["gmail-status"],
    queryFn: async () => check(await supabase.rpc("gmail_status")) as GmailStatus,
  });
}

const results: Record<string, [string, boolean]> = {
  connected: ["Gmail conectado. Desde ahora los avisos sin push también pueden ir por correo.", false],
  cancelled: ["Cancelaste la conexión con Gmail. No se cambió nada.", false],
  scope: ["Para conectar, marca el permiso «Enviar correo electrónico en tu nombre».", true],
  account: ["Conecta el mismo Gmail con el que entras a Chimuverse.", true],
  error: ["No se pudo conectar Gmail. Inténtalo otra vez.", true],
};

/** Settings → Conexiones: each member links their Gmail with send-only permission. */
export function GmailConnection() {
  const status = useGmailStatus();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const result = results[params.get("gmail") ?? ""];
  async function call(action: "connect" | "disconnect") {
    setBusy(true);
    setError(null);
    try {
      const { data, error: e } = await supabase.functions.invoke("mail", { body: { action } });
      if (e || data?.error) throw new Error(data?.error ?? "No se pudo completar la operación de Gmail.");
      if (action === "connect" && data?.url) {
        location.assign(data.url);
        return;
      }
      await qc.invalidateQueries({ queryKey: ["gmail-status"] });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  const s = status.data;
  return (
    <section className="card settings-card" aria-labelledby="gmail-title">
      <div className="row gap">
        {s?.connected ? <MailCheck size={30} aria-hidden /> : <Mail size={30} aria-hidden />}
        <div>
          <h2 id="gmail-title">Gmail para avisos por correo</h2>
          <p className="muted">
            Cuando tu pareja no tenga notificaciones activadas en ningún dispositivo, sus avisos le llegan
            por correo desde tu Gmail (y los tuyos, desde el suyo).
          </p>
        </div>
      </div>
      {result && (
        <div className={`banner ${result[1] ? "error" : ""}`} role="status">
          {result[0]}
        </div>
      )}
      <ErrorMessage error={error ?? status.error} />
      {s && (
        <p>
          Estado:{" "}
          <strong>{s.connected ? `Conectado como ${s.email}` : "Sin conectar"}</strong>
          {" · "}
          Tu pareja: <strong>{s.partner_connected ? "conectado" : "sin conectar"}</strong>
        </p>
      )}
      {s?.last_sent_at && <p className="small muted">Último correo enviado: {formatDate(s.last_sent_at, { hour: "2-digit", minute: "2-digit" })}</p>}
      {s?.last_error && <div className="banner error">{s.last_error}</div>}
      <div className="banner">
        <Lock size={20} aria-hidden />
        Solo se pide permiso para enviar. Chimuverse no puede leer, buscar ni borrar tu correo.
      </div>
      <div className="row gap wrap">
        {s?.connected ? (
          <>
            {s.last_error && (
              <Button busy={busy} onClick={() => void call("connect")}>
                Reconectar Gmail
              </Button>
            )}
            <Button variant="secondary" busy={busy} onClick={() => void call("disconnect")}>
              Desconectar Gmail
            </Button>
          </>
        ) : (
          <Button busy={busy} onClick={() => void call("connect")} disabled={!s && !status.error}>
            Conectar mi Gmail
          </Button>
        )}
      </div>
    </section>
  );
}

/** Settings → Perfil: what the email fallback means for this member. */
export function EmailSummary() {
  const status = useGmailStatus();
  const s = status.data;
  const ready = !!s && (s.connected || s.partner_connected);
  return (
    <div className="row between wrap">
      <div>
        <h3>Notificaciones por correo</h3>
        <p className="muted">
          {ready
            ? "Si no tienes notificaciones activadas en ningún dispositivo, cada aviso te llega por correo."
            : "Conecta Gmail en Conexiones (tú o tu pareja) para recibir por correo los avisos cuando no tengas notificaciones activadas."}
        </p>
      </div>
      {ready ? (
        <span className="pill status done push-pill">Activas como respaldo</span>
      ) : (
        <Link className="text-link" to="/ajustes/conexiones">
          Conectar Gmail
        </Link>
      )}
    </div>
  );
}
