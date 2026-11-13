import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Lock, ArrowRight, Sparkles } from "lucide-react";
import { supabase, configured } from "../lib/supabase";
import { useAuth } from "../lib/store";
import { Logo } from "../components/Shell";
import { Button, ErrorMessage } from "../components/ui";
export default function Auth({ denied = false }: { denied?: boolean }) {
  const { session } = useAuth();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  if (session && !denied && location.pathname !== "/auth/callback")
    return <Navigate to="/" replace />;
  async function login() {
    setBusy(true);
    setError("");
    try {
      if (!configured)
        throw new Error("Falta configurar la conexión de Supabase.");
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: new URL("/auth/callback", location.origin).href,
          queryParams: { prompt: "select_account" },
        },
      });
      if (error) throw error;
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo iniciar sesión.");
      setBusy(false);
    }
  }
  return (
    <main className="access-page">
      <div className="access-top">
        <Logo />
        <span className="pill">
          <Lock size={14} />
          Solo nosotros dos
        </span>
      </div>
      <div className="access-content">
        <div className="access-story">
          <span className="eyebrow">NUESTRO PEQUEÑO LUGAR EN EL UNIVERSO</span>
          <h1>
            Las cosas bonitas
            <br />
            se construyen
            <br />
            <em>de a dos.</em>
          </h1>
          <p>
            El día a día, los sueños grandes y esos momentos pequeños que no
            queremos olvidar.
          </p>
          <div className="access-orbit" aria-hidden="true">
            <div className="orbit-line" />
            <span className="orbit-dot one">JL</span>
            <span className="orbit-dot two">G</span>
            <Sparkles className="orbit-star" size={42} />
            <p>Un universo que construimos juntos.</p>
          </div>
        </div>
        <section className="access-card">
          <span className="mini-stars">✦ · ✧</span>
          <h2>{denied ? "Este espacio es privado" : "Bienvenidos a casa."}</h2>
          <p>
            {denied
              ? "Esta cuenta no tiene acceso al universo de José Luis y Glenny. Prueba con una de las dos cuentas autorizadas."
              : "Chimuverse es nuestro espacio para organizar el día, conocernos un poquito más y guardar lo que importa."}
          </p>
          <ErrorMessage error={error} />
          {denied ? (
            <Button
              onClick={() =>
                void supabase.auth
                  .signOut()
                  .then(() => location.assign("/entrar"))
              }
            >
              Usar otra cuenta <ArrowRight size={18} />
            </Button>
          ) : (
            <Button onClick={login} busy={busy}>
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  fill="currentColor"
                  d="M21.8 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.5a4.7 4.7 0 0 1-2 3v2.6h3.3c2-1.8 3-4.4 3-7.5ZM12 22c2.8 0 5.1-.9 6.8-2.3l-3.3-2.6c-.9.6-2.1.9-3.5.9-2.7 0-5-1.8-5.8-4.2H2.8v2.7A10 10 0 0 0 12 22ZM6.2 13.8a6 6 0 0 1 0-3.6V7.5H2.8a10 10 0 0 0 0 9l3.4-2.7ZM12 6c1.5 0 2.8.5 3.9 1.5l2.9-2.9A9.8 9.8 0 0 0 12 2a10 10 0 0 0-9.2 5.5l3.4 2.7A6.1 6.1 0 0 1 12 6Z"
                />
              </svg>
              Continuar con Google <ArrowRight size={18} />
            </Button>
          )}
          <div className="access-divider" />
          <p className="access-private">
            <Lock size={16} />
            Un rincón privado. Solo para nosotros.
          </p>
          <small>
            Al entrar, tus recuerdos y datos se guardan de forma privada. Google
            Calendar se conecta por separado.
          </small>
        </section>
      </div>
      <footer>
        Hecho de pequeñas cosas, y de nosotros. <span>♡</span>
        <Link to="/entrar">Chimuverse</Link>
      </footer>
    </main>
  );
}
