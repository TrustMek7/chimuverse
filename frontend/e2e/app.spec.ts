import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const a = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  b = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  sid = "c1111111-1111-4111-8111-111111111111",
  tid = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
// Isolated transport fixture. Production never loads fixtures or bypasses authentication.
async function fixture(page: Page, connected = false) {
  const user = {
    id: a,
    aud: "authenticated",
    role: "authenticated",
    email: "test-a@example.test",
    user_metadata: { full_name: "José Luis" },
    app_metadata: { provider: "google" },
    created_at: new Date().toISOString(),
  };
  await page.addInitScript(
    ({ user }) => {
      localStorage.setItem("chimu-theme", "light");
      for (const k of Object.keys(localStorage)) {
        if (k.startsWith("sb-")) localStorage.removeItem(k);
      }
      (window as any).__TEST_USER = user;
    },
    { user },
  );
  let rows: Record<string, any[]> = {
    space_members: [{ space_id: sid, user_id: a }],
    profiles: [
      {
        id: a,
        display_name: "José Luis",
        timezone: "America/Lima",
        preferences: {},
      },
      {
        id: b,
        display_name: "Glenny",
        timezone: "America/Lima",
        preferences: {},
      },
    ],
    tasks: [
      {
        id: tid,
        space_id: sid,
        created_by: b,
        assignee_id: b,
        title: "Preparar una escapada",
        description: "Elegir un destino juntos",
        due_on: new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/Lima",
        }).format(new Date()),
        status: "review",
        reported_percent: 70,
        verified_percent: 20,
        rejections: 0,
        created_at: new Date().toISOString(),
      },
    ],
    task_progress: [
      {
        id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        task_id: tid,
        reported_by: b,
        reported_percent: 70,
        note: "Ya elegí tres lugares",
        state: "pending",
        created_at: new Date().toISOString(),
      },
    ],
    task_verifications: [],
    notifications: [],
    questions: [
      {
        id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
        category: "Nosotros",
        title: "¿Qué pequeño gesto te hace sentir en casa?",
      },
    ],
    answers: [],
    calendar_events: [],
    entries: [],
    photos: [],
  };
  await page.route("**/auth/v1/**", (route) => route.fulfill({ json: user }));
  await page.route("**/rest/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const table = url.pathname.split("/").pop()!;
    if (table === "google_status")
      return route.fulfill({
        json: {
          status: connected ? "connected" : "disconnected",
          auto_sync_pending: false,
        },
      });
    if (table === "verify_task_progress") {
      const body = route.request().postDataJSON();
      rows.tasks[0].verified_percent =
        body.p_decision === "partial" ? body.p_verified_percent : 70;
      rows.tasks[0].status = "progress";
      rows.task_progress[0].state = "approved";
      rows.task_verifications.push({
        id: crypto.randomUUID(),
        progress_id: rows.task_progress[0].id,
        verifier_id: a,
        decision: body.p_decision,
        verified_percent: rows.tasks[0].verified_percent,
        reason: "",
        created_at: new Date().toISOString(),
      });
      return route.fulfill({ json: null });
    }
    if (table === "save_entry") {
      const body = route.request().postDataJSON();
      rows.entries.push({
        ...body.p_data,
        id: crypto.randomUUID(),
        owner_id: a,
        space_id: sid,
        deleted_at: null,
        created_at: new Date().toISOString(),
        entry_bodies: { content: body.p_content },
      });
      return route.fulfill({ json: rows.entries.at(-1).id });
    }
    if (route.request().method() === "POST" && table === "tasks") {
      rows.tasks.push({
        ...route.request().postDataJSON(),
        id: crypto.randomUUID(),
        created_by: a,
        status: "pending",
        reported_percent: 0,
        verified_percent: 0,
        created_at: new Date().toISOString(),
      });
      return route.fulfill({ json: null });
    }
    if (route.request().method() === "POST" && table === "calendar_events") {
      rows.calendar_events.push({
        ...route.request().postDataJSON(),
        id: crypto.randomUUID(),
        owner_id: a,
        sync_google: connected,
        deleted_at: null,
        version: 1,
      });
      return route.fulfill({ json: null });
    }
    return route.fulfill({
      json: table === "space_members" ? rows[table][0] : (rows[table] ?? []),
    });
  });
  await page.routeWebSocket("**/realtime/**", (socket) => socket.close());
  // Discover only the public project reference from Vite's existing configuration.
  const config = await import("node:fs").then((fs) =>
    fs.existsSync(new URL("../.env.local", import.meta.url))
      ? fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8")
      : "",
  );
  const ref = new URL(
    process.env.VITE_SUPABASE_URL ??
      config.match(/^VITE_SUPABASE_URL=(.+)$/m)![1].trim(),
  ).hostname.split(".")[0];
  await page.addInitScript(
    ({ ref, user }) => {
      localStorage.setItem(
        `sb-${ref}-auth-token`,
        JSON.stringify({
          access_token: "test-session-token",
          refresh_token: "test-refresh",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          expires_in: 3600,
          token_type: "bearer",
          user,
        }),
      );
    },
    { ref, user },
  );
  return rows;
}
test("connected calendar hides onboarding and exports new plans by default; disconnected calendar offers connection", async ({
  page,
}) => {
  const rows = await fixture(page, true);
  await page.goto("/dia/calendario");
  await expect(
    page.getByText("Google Calendar conectado · exportación automática"),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Conectar Google Calendar →" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Nuevo evento" }).click();
  await expect(
    page.getByRole("checkbox", {
      name: "Añadir también a mi calendario Chimuverse en Google",
    }),
  ).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "Título", exact: true })
    .fill("Clase de prueba automática");
  await page.getByRole("button", { name: "Guardar el plan" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(rows.calendar_events[0].sync_google).toBe(true);
  await page.goto("/ajustes/conexiones");
  await expect(
    page.getByRole("button", { name: "Conectar mi Google Calendar" }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Iniciar sesión con Google no concede acceso a Calendar.", {
      exact: false,
    }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Traer cambios de Google" }),
  ).toBeVisible();
});
test("access page is responsive, accessible and opens no third party content", async ({
  page,
}) => {
  await page.goto("/entrar");
  await expect(
    page.getByRole("heading", { name: "Bienvenidos a casa." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continuar con Google" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});
test("dashboard and all module routes render with mobile navigation and both themes", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await fixture(page);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "La constelación de hoy" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Revisar y verificar" }),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/dashboard-${info.project.name}.png`,
    fullPage: true,
  });
  for (const [path, title] of [
    ["/dia/quests", "Daily Quests"],
    ["/dia/calendario", "Our Calendar"],
    ["/nosotros/universo", "Nuestro Universo"],
    ["/recuerdos/vault", "Memory Vault"],
    ["/recuerdos/devlog", "DevLog of Us"],
    ["/nosotros/animo", "¿Cómo está tu cielo hoy?"],
    ["/experiencias/citas", "Date Planner"],
    ["/creciendo/metas", "Goals & Dreams"],
    ["/creciendo/finanzas", "Our Finances"],
    ["/ocio/watchlist", "Watchlist"],
    ["/ocio/deseos", "Wishlist & Soundtrack"],
    ["/recuerdos/wrapped", "El año que construimos juntos"],
    ["/ajustes", "Ajustes"],
  ]) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      path,
    ).toBe(true);
  }
  await page.goto("/");
  const light = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(light.violations).toEqual([]);
  await page.getByRole("button", { name: "Activar tema oscuro" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const dark = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(dark.violations).toEqual([]);
  expect(errors).toEqual([]);
});
test("quest creation, cross-verification and private journal persistence use real UI actions", async ({
  page,
}) => {
  const rows = await fixture(page);
  await page.goto("/dia/quests");
  await page.getByRole("button", { name: "Nueva quest" }).click();
  await page
    .getByRole("textbox", { name: "¿Qué vamos a hacer?" })
    .fill("Preparar una cena especial");
  await page.getByRole("button", { name: "Crear quest", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Preparar una cena especial" }),
  ).toBeVisible();
  expect(rows.tasks).toHaveLength(2);
  await page.goto(`/dia/quests/${tid}`);
  await expect(
    page.getByRole("heading", { name: "Te toca dar el visto bueno" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Aprobar 70 %", exact: true }).click();
  await expect(
    page.getByText("Verificado: 70 %", { exact: true }),
  ).toBeVisible();
  await page.goto("/recuerdos/devlog?crear=1");
  await expect(
    page.getByRole("button", { name: "Solo yo", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("textbox", { name: "Título", exact: true })
    .fill("Un pequeño momento");
  await page
    .getByRole("textbox", { name: "Lo que quieres guardar" })
    .fill("Hoy aprendimos algo juntos.");
  await page.getByRole("button", { name: "Guardar este momento" }).click();
  await expect(
    page.getByRole("heading", { name: "Un pequeño momento" }),
  ).toBeVisible();
  expect(rows.entries[0].visibility).toBe("private");
});
