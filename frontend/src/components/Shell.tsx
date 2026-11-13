import { useEffect, useState } from "react";
import { NavLink, Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  House,
  ListChecks,
  CalendarDays,
  Orbit,
  Smile,
  Images,
  BookOpen,
  Sparkles,
  Heart,
  Clapperboard,
  Music,
  Target,
  Wallet,
  Settings,
  Bell,
  Moon,
  Sun,
  Plus,
  MoreHorizontal,
  LogOut,
  ArrowRight,
  CloudOff,
} from "lucide-react";
import { useSpace, useAction, useRealtime } from "../lib/store";
import { supabase, check } from "../lib/supabase";
import { signOut } from "../lib/push";
import { formatDate } from "../lib/utils";
import { Avatar, Modal, Button, ErrorMessage } from "./ui";
const nav = [
  { group: "", color: "gold", items: [["/", "Inicio", House]] },
  {
    group: "Nuestro día",
    color: "coral",
    items: [
      ["/dia/quests", "Tareas del día", ListChecks],
      ["/dia/calendario", "Nuestro calendario", CalendarDays],
    ],
  },
  {
    group: "Nosotros",
    color: "pink",
    items: [
      ["/nosotros/universo", "Nuestro Universo", Orbit],
      ["/nosotros/animo", "Nuestro ánimo", Smile],
    ],
  },
  {
    group: "Recuerdos",
    color: "purple",
    items: [
      ["/recuerdos/vault", "Álbum de recuerdos", Images],
      ["/recuerdos/devlog", "Nuestro diario", BookOpen],
      ["/recuerdos/wrapped", "Nuestro año", Sparkles],
    ],
  },
  {
    group: "Experiencias",
    color: "teal",
    items: [["/experiencias/citas", "Planes y citas", Heart]],
  },
  {
    group: "Entretenimiento",
    color: "sky",
    items: [
      ["/ocio/watchlist", "Películas y series", Clapperboard],
      ["/ocio/deseos", "Deseos y canciones", Music],
    ],
  },
  {
    group: "Creciendo",
    color: "lime",
    items: [
      ["/creciendo/metas", "Metas y sueños", Target],
      ["/creciendo/finanzas", "Nuestras finanzas", Wallet],
    ],
  },
] as const;
export function Logo() {
  return (
    <span className="brand">
      <img src="/favicon.svg" alt="" width="34" height="34" />
      <span>
        Chimuverse<span className="brand-star">✦</span>
      </span>
    </span>
  );
}
export default function Shell() {
  useRealtime();
  const { me, partner, data } = useSpace();
  const action = useAction();
  const location = useLocation();
  const [more, setMore] = useState(false),
    [create, setCreate] = useState(false),
    [notifications, setNotifications] = useState(false);
  const [dark, setDark] = useState(
    () => localStorage.getItem("chimu-theme") === "dark",
  );
  const [online, setOnline] = useState(navigator.onLine);
  const navigate = useNavigate();
  useEffect(() => {
    // A notification click on an already-open window asks the app to open its route.
    const sw = "serviceWorker" in navigator ? navigator.serviceWorker : null;
    const onMessage = (e: MessageEvent) => {
      const path = e.data?.type === "navigate" ? String(e.data.path ?? "") : "";
      if (path.startsWith("/") && !path.startsWith("//")) navigate(path);
    };
    sw?.addEventListener("message", onMessage);
    return () => sw?.removeEventListener("message", onMessage);
  }, [navigate]);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("chimu-theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => {
    const fn = () => setOnline(navigator.onLine);
    window.addEventListener("online", fn);
    window.addEventListener("offline", fn);
    return () => {
      window.removeEventListener("online", fn);
      window.removeEventListener("offline", fn);
    };
  }, []);
  useEffect(() => {
    setMore(false);
    setCreate(false);
    window.scrollTo(0, 0);
  }, [location.pathname, location.search]);
  const unread = data!.notifications.filter((n) => !n.read_at);
  const linkNav = () =>
    nav.map((g) => (
      <div className={`nav-group nav-${g.color}`} key={g.group}>
        {g.group && <p className="nav-label">{g.group}</p>}
        {g.items.map(([path, label, Icon]) => (
          <NavLink
            to={path}
            end={path === "/"}
            className="nav-link"
            key={path}
            title={label}
          >
            <Icon size={20} strokeWidth={1.8} />
            <span>{label}</span>
            {path === "/dia/quests" &&
              data!.task_progress.some(
                (p) => p.state === "pending" && p.reported_by !== me.id,
              ) && <span className="nav-count">✦</span>}
          </NavLink>
        ))}
      </div>
    ));
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Ir al contenido
      </a>
      <aside className="sidebar">
        <Link to="/" aria-label="Chimuverse, inicio">
          <Logo />
        </Link>
        <nav aria-label="Principal">{linkNav()}</nav>
        <NavLink to="/ajustes" className="sidebar-user">
          <Avatar name={me.display_name} />
          <span>
            <strong>{me.display_name}</strong>
            <small>Ajustes de nuestro espacio</small>
          </span>
          <Settings size={18} />
        </NavLink>
      </aside>
      <div className="app-main">
        <div className="topbar">
          <p className="muted date-top">
            {formatDate(
              new Date().toISOString(),
              { weekday: "long" },
              me.timezone,
            )}{" "}
            <span>· {me.timezone}</span>
          </p>
          <Link to="/" className="mobile-brand">
            <Logo />
          </Link>
          <div className="row gap-sm">
            <button
              className="icon-button"
              onClick={() => setDark(!dark)}
              aria-label={dark ? "Activar tema claro" : "Activar tema oscuro"}
            >
              {dark ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button
              className="icon-button notification-button"
              onClick={() => setNotifications(true)}
              aria-label={`Notificaciones, ${unread.length} sin leer`}
            >
              <Bell size={20} />
              {!!unread.length && <span className="notification-dot" />}
            </button>
            <div className="avatar-pair">
              <Avatar name={me.display_name} />
              {partner && <Avatar name={partner.display_name} partner />}
            </div>
          </div>
        </div>
        {!online && (
          <div className="banner" role="status">
            <CloudOff size={18} />
            Sin conexión. Puedes consultar lo cargado; los cambios requieren
            conexión.
          </div>
        )}
        <main className="content" id="main">
          <Outlet />
        </main>
        <footer className="app-footer">
          Un universo que construimos juntos <span>✦</span>
        </footer>
      </div>
      <nav className="bottom-nav" aria-label="Navegación móvil">
        <NavLink end to="/">
          <House />
          <span>Inicio</span>
        </NavLink>
        <NavLink
          to="/dia/quests"
          className={location.pathname.startsWith("/dia") ? "active" : ""}
        >
          <ListChecks />
          <span>Día</span>
        </NavLink>
        <button className="create-button" onClick={() => setCreate(true)}>
          <span>
            <Plus />
          </span>
          Crear
        </button>
        <NavLink to="/recuerdos/vault">
          <Images />
          <span>Recuerdos</span>
        </NavLink>
        <button onClick={() => setMore(true)} aria-expanded={more}>
          <MoreHorizontal />
          <span>Más</span>
        </button>
      </nav>
      <Modal title="Todo nuestro universo" open={more} onOpenChange={setMore}>
        <nav className="more-nav">
          {linkNav()}
          <Link to="/ajustes" className="nav-link">
            <Settings size={20} />
            Ajustes
          </Link>
        </nav>
        <Button
          variant="secondary"
          onClick={() => void signOut()}
        >
          <LogOut size={18} />
          Cerrar sesión
        </Button>
      </Modal>
      <Modal title="Un pequeño comienzo" open={create} onOpenChange={setCreate}>
        <p className="muted">¿Qué construimos hoy?</p>
        <div className="create-grid">
          {[
            ["/dia/quests?crear=1", "Una quest", ListChecks],
            ["/dia/calendario?crear=1", "Un evento", CalendarDays],
            ["/recuerdos/vault?crear=1", "Un recuerdo", Images],
            ["/recuerdos/devlog?crear=1", "Una nota", BookOpen],
            ["/experiencias/citas?crear=1", "Una cita", Heart],
            ["/creciendo/metas?crear=1", "Una meta", Target],
          ].map(([path, label, Icon]) => {
            const C = Icon as typeof Heart;
            return (
              <Link className="card" to={String(path)} key={String(path)}>
                <C />
                <strong>{String(label)}</strong>
                <ArrowRight size={18} />
              </Link>
            );
          })}
        </div>
      </Modal>
      <Modal
        title="Notificaciones"
        open={notifications}
        onOpenChange={setNotifications}
      >
        <ErrorMessage error={action.error} />
        {unread.length > 0 && (
          <Button
            variant="secondary"
            busy={action.busy}
            onClick={() =>
              action.run(async () =>
                check(
                  await supabase
                    .from("notifications")
                    .update({ read_at: new Date().toISOString() })
                    .is("read_at", null),
                ),
              )
            }
          >
            Marcar todo como leído
          </Button>
        )}
        <div className="notification-list">
          {data!.notifications.length ? (
            data!.notifications.map((n) => (
              <Link
                className={`notification ${n.read_at ? "" : "unread"}`}
                key={n.id}
                to={n.path}
                onClick={() => {
                  setNotifications(false);
                  void action.run(async () =>
                    check(
                      await supabase
                        .from("notifications")
                        .update({ read_at: new Date().toISOString() })
                        .eq("id", n.id),
                    ),
                  );
                }}
              >
                <Bell size={18} />
                <span>
                  {n.title}
                  <small>{formatDate(n.created_at)}</small>
                </span>
              </Link>
            ))
          ) : (
            <p className="muted">Todo en calma. Aquí llegarán las novedades.</p>
          )}
        </div>
      </Modal>
    </div>
  );
}
