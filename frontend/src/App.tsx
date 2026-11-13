import { lazy, Suspense, type ReactNode } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  Link,
} from "react-router-dom";
import { useAuth, useMembership, useSnapshot } from "./lib/store";
import Shell from "./components/Shell";
import Auth from "./pages/Auth";
import { ErrorMessage, Loading, Button } from "./components/ui";
import { signOut } from "./lib/push";
const Home = lazy(() => import("./pages/Home"));
const Quests = lazy(() => import("./pages/Quests"));
const Calendar = lazy(() => import("./pages/Calendar"));
const Universe = lazy(() => import("./pages/Universe"));
const Collections = lazy(() => import("./pages/Collections"));
const Vault = lazy(() => import("./pages/Vault"));
const Settings = lazy(() => import("./pages/Settings"));
const Wrapped = lazy(() => import("./pages/Wrapped"));
function Gate() {
  const { session, loading, error } = useAuth();
  const membership = useMembership();
  const snapshot = useSnapshot();
  if (loading) return <Loading />;
  if (error) return <ErrorMessage error={error} />;
  if (!session) return <Navigate to="/entrar" replace />;
  if (membership.isPending) return <Loading />;
  if (membership.error)
    return (
      <div className="setup-error">
        <h1>No pudimos abrir nuestro espacio</h1>
        <ErrorMessage error={membership.error} />
        <p>Comprueba tu conexión o vuelve a intentarlo en unos minutos.</p>
        <Button onClick={() => void membership.refetch()}>Reintentar</Button>
        <Button
          variant="secondary"
          onClick={() => void signOut()}
        >
          Cerrar sesión
        </Button>
      </div>
    );
  if (!membership.data) return <Auth denied />;
  if (snapshot.isPending) return <Loading />;
  if (snapshot.error)
    return (
      <div className="setup-error">
        <h1>Un momento, nuestro universo está cargando</h1>
        <ErrorMessage error={snapshot.error} />
        <Button onClick={() => void snapshot.refetch()}>Reintentar</Button>
      </div>
    );
  return <Outlet />;
}
function Lazy({ children }: { children: ReactNode }) {
  return <Suspense fallback={<Loading />}>{children}</Suspense>;
}
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/entrar" element={<Auth />} />
        <Route path="/sin-acceso" element={<Auth denied />} />
        <Route path="/auth/callback" element={<Navigate to="/" replace />} />
        <Route element={<Gate />}>
          <Route element={<Shell />}>
            <Route
              index
              element={
                <Lazy>
                  <Home />
                </Lazy>
              }
            />
            <Route
              path="/dia/quests/:id?"
              element={
                <Lazy>
                  <Quests />
                </Lazy>
              }
            />
            <Route
              path="/dia/calendario"
              element={
                <Lazy>
                  <Calendar />
                </Lazy>
              }
            />
            <Route
              path="/nosotros/universo"
              element={
                <Lazy>
                  <Universe />
                </Lazy>
              }
            />
            {[
              "/recuerdos/devlog",
              "/recuerdos/capsulas",
              "/nosotros/animo",
              "/experiencias/citas",
              "/creciendo/metas",
              "/creciendo/finanzas",
              "/ocio/watchlist",
              "/ocio/deseos",
              "/ocio/soundtrack",
              "/recuerdos/viajes",
            ].map((path) => (
              <Route
                key={path}
                path={path}
                element={
                  <Lazy>
                    <Collections key={path} />
                  </Lazy>
                }
              />
            ))}
            <Route
              path="/recuerdos/vault"
              element={
                <Lazy>
                  <Vault />
                </Lazy>
              }
            />
            <Route
              path="/recuerdos/linea-de-tiempo"
              element={
                <Lazy>
                  <Vault />
                </Lazy>
              }
            />
            <Route
              path="/recuerdos/wrapped/:year?"
              element={
                <Lazy>
                  <Wrapped />
                </Lazy>
              }
            />
            <Route
              path="/ajustes/*"
              element={
                <Lazy>
                  <Settings />
                </Lazy>
              }
            />
            <Route
              path="/bienvenida"
              element={<Navigate to="/ajustes" replace />}
            />
            <Route
              path="*"
              element={
                <section className="empty">
                  <h1>Esta estrella todavía no tiene nombre</h1>
                  <p>No encontramos la página que buscas.</p>
                  <Link to="/" className="btn btn-primary">
                    Volver a nuestro día
                  </Link>
                </section>
              }
            />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
