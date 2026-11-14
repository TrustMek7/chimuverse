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
    // Like PostgREST: ordering by a column the table lacks is an error (question_hidden has no id).
    if (table === "question_hidden" && url.searchParams.get("order")?.startsWith("id"))
      return route.fulfill({ status: 400, json: { code: "42703", message: "column question_hidden.id does not exist" } });
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
    if (table === "schedule_date") {
      const body = route.request().postDataJSON();
      const entry = rows.entries.find((e) => e.id === body.p_entry_id);
      let event = rows.calendar_events.find(
        (e) => e.id === entry.calendar_event_id,
      );
      if (!event) {
        event = {
          id: crypto.randomUUID(),
          owner_id: a,
          space_id: sid,
          title: entry.title,
          description: entry.title,
          visibility: "shared",
          kind: "event",
          all_day: false,
          recurrence: [],
          recurrence_timezone: "America/Lima",
          deleted_at: null,
        };
        rows.calendar_events.push(event);
        entry.calendar_event_id = event.id;
      }
      event.start_at = body.p_start_at;
      event.end_at = body.p_end_at;
      return route.fulfill({ json: event.id });
    }
    if (table === "answers" && route.request().method() === "POST") {
      rows.answers.push({
        ...route.request().postDataJSON(),
        id: crypto.randomUUID(),
      });
      return route.fulfill({ json: null });
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
    if (route.request().method() === "PATCH" && table === "calendar_events") {
      const id = url.searchParams.get("id")?.replace("eq.", "");
      const e = rows.calendar_events.find((e) => e.id === id);
      Object.assign(e, route.request().postDataJSON());
      return route.fulfill({ json: null });
    }
    if (table === "trash_item") {
      const body = route.request().postDataJSON();
      const e = rows[body.p_table]?.find((e) => e.id === body.p_id);
      if (e) e.deleted_at = body.p_restore ? null : new Date().toISOString();
      return route.fulfill({ json: null });
    }
    return route.fulfill({
      json: table === "space_members" ? rows[table][0] : (rows[table] ?? []),
    });
  });
  await page.routeWebSocket("**/realtime/**", (socket) => socket.close());
  await page.route("**/functions/v1/youtube", (route) =>
    route.fulfill({ json: { connected: false, playlist: null } }),
  );
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
test("universe bank supports bounded rendering, topic and depth filters and saving answers", async ({
  page,
}) => {
  const rows = await fixture(page);
  const bank = JSON.parse(
    (await import("node:fs")).readFileSync(
      new URL("../../backend/content/universe-questions.json", import.meta.url),
      "utf8",
    ),
  );
  rows.questions = bank.flatMap((g: any) =>
    g.questions.map((title: string, i: number) => ({
      id: crypto.randomUUID(),
      category: g.category,
      title,
      depth: Math.floor(i / 5) + 1,
      source_id: g.source,
    })),
  );
  await page.goto("/nosotros/universo");
  await expect(page.getByRole("status")).toContainText(
    "300 preguntas encontradas",
  );
  await expect(page.locator(".universe-question")).toHaveCount(24);
  await page.getByRole("button", { name: "Ver más preguntas (276)" }).click();
  await expect(page.locator(".universe-question")).toHaveCount(48);
  await page
    .getByLabel("Tema", { exact: true })
    .selectOption("Autonomía y límites");
  await page.getByLabel("Profundidad", { exact: true }).selectOption("3");
  await expect(page.locator(".universe-question")).toHaveCount(5);
  await page.getByLabel("Buscar preguntas").fill("limita");
  await expect(page.locator(".universe-question")).toHaveCount(1);
  await page.getByRole("button", { name: "Compartir mi respuesta" }).click();
  await page
    .getByRole("textbox", { name: "Tu respuesta", exact: true })
    .fill("Podemos revisar nuestros acuerdos con calma.");
  await page.getByRole("button", { name: "Guardar respuesta" }).click();
  await expect(
    page.getByText("Podemos revisar nuestros acuerdos con calma.", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByLabel("Respuestas", { exact: true })
    .selectOption("Pendientes");
  await expect(page.locator(".universe-question")).toHaveCount(0);
});

test("a date can be scheduled in the app calendar and rescheduled without duplication", async ({
  page,
}) => {
  const rows = await fixture(page, true);
  rows.entries.push({
    id: "d1111111-1111-4111-8111-111111111111",
    owner_id: b,
    space_id: sid,
    kind: "date",
    title: "Nuestro picnic",
    details: {
      category: "Naturaleza",
      duration_minutes: 120,
      budget: "Bajo",
      setting: "Aire libre",
    },
    visibility: "shared",
    status: "pending",
    occurred_on: "2026-11-13",
    created_at: new Date().toISOString(),
    deleted_at: null,
    entry_bodies: null,
  });
  await page.goto("/experiencias/citas");
  await page.getByRole("button", { name: "Agendar cita", exact: true }).click();
  await page.getByLabel("Inicio de la cita").fill("2027-04-15T18:00");
  await page.getByLabel("Fin de la cita").fill("2027-04-15T20:00");
  await expect(
    page.getByText(
      "Se exportará automáticamente a Google Calendar con ambos correos como invitados.",
    ),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Agendar cita", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "La cita quedó guardada",
  );
  await page
    .getByRole("link", { name: "Ver en nuestro calendario", exact: true })
    .click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("heading", { name: "Nuestro picnic", exact: true }),
  ).toBeVisible();
  await page.goto("/experiencias/citas");
  await page
    .getByRole("button", { name: "Cambiar horario de la cita" })
    .click();
  await page.getByLabel("Inicio de la cita").fill("2027-04-16T18:00");
  await page.getByLabel("Fin de la cita").fill("2027-04-16T20:00");
  await page.getByRole("button", { name: "Guardar nuevo horario" }).click();
  await expect(page.getByRole("status")).toContainText(
    "La cita quedó guardada",
  );
  expect(rows.calendar_events).toHaveLength(1);
  expect(rows.entries[0].calendar_event_id).toBe(rows.calendar_events[0].id);
});

test("both partners can use a shared YouTube playlist, create unlisted and confirm removals", async ({
  page,
}) => {
  await fixture(page);
  let playlist: any = null;
  let items: any[] = [];
  const actions: string[] = [];
  await page.route("**/functions/v1/youtube", async (route) => {
    const body = route.request().postDataJSON();
    actions.push(body.action);
    if (body.action === "status")
      return route.fulfill({ json: { connected: true, playlist } });
    if (body.action === "create") {
      expect(body.privacy).toBe("unlisted");
      playlist = {
        id: "PLshared123456",
        title: body.title,
        owner: true,
        available: true,
      };
      return route.fulfill({ json: { id: playlist.id } });
    }
    if (body.action === "list") return route.fulfill({ json: { items } });
    if (body.action === "add") {
      items = [
        {
          id: "item1",
          title: "Nuestra canción",
          video_id: "dQw4w9WgXcQ",
          etag: "etag1",
        },
      ];
      return route.fulfill({ json: { saved: true } });
    }
    if (body.action === "remove") {
      expect(body.etag).toBe("etag1");
      items = [];
      return route.fulfill({ json: { removed: true } });
    }
    return route.fulfill({ json: {} });
  });
  await page.goto("/ocio/soundtrack");
  const panel = page.getByRole("region", {
    name: "Lista compartida de YouTube",
  });
  await panel
    .getByRole("button", { name: "Crear nuestra playlist en YouTube" })
    .click();
  await expect(
    panel.getByRole("link", { name: "Abrir playlist en YouTube" }),
  ).toBeVisible();
  await panel
    .getByLabel("Enlace del video de YouTube")
    .fill("https://youtu.be/dQw4w9WgXcQ");
  await panel
    .getByRole("button", { name: "Añadir a nuestra playlist" })
    .click();
  await expect(
    panel.getByRole("link", { name: "Nuestra canción", exact: true }),
  ).toBeVisible();
  await panel.getByRole("button", { name: "Quitar", exact: true }).click();
  expect(actions.filter((a) => a === "remove")).toHaveLength(0);
  await panel
    .getByRole("button", { name: "Confirmar quitar de YouTube" })
    .click();
  await expect(panel.getByText("La primera canción los espera.")).toBeVisible();
  expect(actions.filter((a) => a === "create")).toHaveLength(1);
});

test("YouTube onboarding follows connection and shared-owner state", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await fixture(page);
  let connected = false;
  let playlist: any = null;
  let expired = false;
  await page.route("**/functions/v1/youtube", (route) => {
    const action = route.request().postDataJSON().action;
    return route.fulfill(
      action === "status"
        ? { json: { connected, playlist } }
        : expired
          ? {
              status: 400,
              json: { error: "Reconecta YouTube para renovar el permiso." },
            }
          : { json: { items: [] } },
    );
  });
  const panel = page.getByRole("region", {
    name: "Lista compartida de YouTube",
  });
  await page.goto("/ocio/soundtrack");
  await expect(panel.getByRole("status")).toContainText("Conecta tu cuenta");
  await expect(
    panel.getByRole("button", { name: "Conectar mi YouTube", exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "Crear nuestra playlist en YouTube" }),
  ).toHaveCount(0);
  connected = true;
  await page.reload();
  await expect(
    panel.getByRole("button", { name: "Crear nuestra playlist en YouTube" }),
  ).toBeVisible();
  await expect(panel.getByRole("status")).toHaveCount(0);
  await expect(
    panel.getByRole("button", { name: "Conectar mi YouTube", exact: true }),
  ).toHaveCount(0);
  connected = false;
  playlist = {
    id: "PLshared123",
    title: "Nuestra música",
    owner: false,
    available: true,
  };
  await page.reload();
  await expect(
    panel.getByRole("button", { name: "Añadir a nuestra playlist" }),
  ).toBeVisible();
  await expect(
    panel.getByRole("button", {
      name: /Conectar|Reconectar|Crear nuestra|Importar una/,
    }),
  ).toHaveCount(0);
  await expect(panel.getByText("Sin conectar", { exact: true })).toHaveCount(0);
  playlist.available = false;
  await page.reload();
  await expect(panel.getByRole("status")).toContainText(
    "El propietario debe reconectar",
  );
  await expect(
    panel.getByRole("button", { name: "Conectar mi YouTube", exact: true }),
  ).toHaveCount(0);
  connected = true;
  playlist = { ...playlist, owner: true, available: true };
  expired = true;
  await page.reload();
  await expect(
    panel.getByRole("button", { name: "Reconectar mi YouTube" }),
  ).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "Añadir a nuestra playlist" }),
  ).toHaveCount(0);
  await page.goto("/ocio/deseos");
  await expect(
    page.getByRole("heading", { name: "Deseos y canciones" }),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/containers-light-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Activar tema oscuro" }).click();
  await page.screenshot({
    path: `test-results/containers-dark-${info.project.name}.png`,
    fullPage: true,
  });
  const contrast = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(contrast.violations).toEqual([]);
});

test("weekly series supports selected days, inclusive end date, no end and deleting the whole series", async ({
  page,
}) => {
  const rows = await fixture(page, true);
  await page.goto("/dia/calendario");
  await page.getByRole("button", { name: "Nuevo evento" }).click();
  const monday = new Date();
  monday.setDate(1);
  while (monday.getDay() !== 1) monday.setDate(monday.getDate() + 1);
  const day = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const until = new Date(monday);
  until.setDate(until.getDate() + 9);
  await page
    .getByRole("textbox", { name: "Título", exact: true })
    .fill("Nuestro horario semanal");
  await page.getByLabel("Empieza").fill(day(monday) + "T09:00");
  await page.getByLabel("Termina").fill(day(monday) + "T10:00");
  await expect(
    page.getByRole("button", { name: "Solo yo", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Repetición", { exact: true }).selectOption("WEEKLY");
  for (const name of [
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado",
    "Domingo",
  ]) {
    const button = page.getByRole("button", { name, exact: true });
    const desired = ["Lunes", "Miércoles"].includes(name);
    if (((await button.getAttribute("aria-pressed")) === "true") !== desired)
      await button.click();
  }
  await page.getByLabel("Finaliza", { exact: true }).selectOption("until");
  await page.getByLabel("Repetir hasta (incluido)").fill(day(until));
  await page.getByRole("button", { name: "Guardar el plan" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const events = page
    .locator(".fc-daygrid-event")
    .filter({ hasText: "Nuestro horario semanal" });
  await expect(events).toHaveCount(4);
  expect(rows.calendar_events[0].visibility).toBe("shared");
  expect(rows.calendar_events[0].recurrence[0]).toContain("BYDAY=MO,WE");
  await events.first().click();
  await page.getByRole("button", { name: "Editar serie", exact: true }).click();
  await page.getByLabel("Finaliza", { exact: true }).selectOption("never");
  await page.getByRole("button", { name: "Guardar el plan" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(rows.calendar_events[0].recurrence[0]).not.toMatch(/UNTIL|COUNT/);
  await page
    .locator(".fc-daygrid-event")
    .filter({ hasText: "Nuestro horario semanal" })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Eliminar serie", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirmar eliminación" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page
      .locator(".fc-daygrid-event")
      .filter({ hasText: "Nuestro horario semanal" }),
  ).toHaveCount(0);
  expect(rows.calendar_events[0].deleted_at).toBeTruthy();
});
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
    ["/dia/quests", "Tareas del día"],
    ["/dia/calendario", "Nuestro calendario"],
    ["/nosotros/universo", "Nuestro Universo"],
    ["/recuerdos/vault", "Álbum de recuerdos"],
    ["/recuerdos/devlog", "Nuestro diario"],
    ["/nosotros/animo", "¿Cómo está tu cielo hoy?"],
    ["/experiencias/citas", "Planes y citas"],
    ["/creciendo/metas", "Metas y sueños"],
    ["/creciendo/finanzas", "Nuestras finanzas"],
    ["/ocio/watchlist", "Películas y series"],
    ["/ocio/deseos", "Deseos y canciones"],
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
test("returning to the tab preserves unsaved forms while signing out removes the space", async ({
  page,
}) => {
  await fixture(page);
  await page.goto("/recuerdos/devlog?crear=1");
  const title = page.getByRole("textbox", { name: "Título", exact: true });
  await title.fill("Borrador sin guardar");
  await page
    .getByRole("textbox", { name: "Lo que quieres guardar" })
    .fill("Un avance que no debe desaparecer.");
  await page.evaluate(async () => {
    const path = "/src/lib/supabase.ts";
    const { supabase } = await import(path);
    await new Promise<void>((resolve) => {
      const { data } = supabase.auth.onAuthStateChange((event: string) => {
        if (event === "SIGNED_IN") {
          data.subscription.unsubscribe();
          resolve();
        }
      });
      window.dispatchEvent(new Event("visibilitychange"));
    });
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
  await expect(title).toHaveValue("Borrador sin guardar");
  await expect(
    page.getByRole("textbox", { name: "Lo que quieres guardar" }),
  ).toHaveValue("Un avance que no debe desaparecer.");
  await page.evaluate(async () => {
    const path = "/src/lib/supabase.ts";
    const { supabase } = await import(path);
    await supabase.auth.signOut();
  });
  await expect(page).toHaveURL(/\/entrar$/);
  await expect(title).toHaveCount(0);
});

test("quest creation, cross-verification and shared journal persistence use real UI actions", async ({
  page,
}) => {
  const rows = await fixture(page);
  await page.goto("/dia/quests");
  await page.getByRole("button", { name: "Nueva tarea" }).click();
  await page
    .getByRole("textbox", { name: "¿Qué vamos a hacer?" })
    .fill("Preparar una cena especial");
  await page.getByRole("button", { name: "Crear tarea", exact: true }).click();
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
  ).toHaveCount(0);
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
  expect(rows.entries[0].visibility).toBe("shared");
});
test("dashboard offers one-tap notifications, shows their status and lists devices in settings", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await fixture(page);
  if (info.project.name === "mobile") {
    // iPhone in a Safari tab: push only works from the home-screen app, so guide the install.
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Agrega Chimuverse a tu inicio" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Activar notificaciones" })).toHaveCount(0);
    return;
  }
  // Stand-in for the browser push service: permission prompt and subscription.
  await page.addInitScript(() => {
    // Browser permission and subscription survive reloads, as in a real browser.
    const make = () => ({
      endpoint: "https://push.example.test/device-1",
      getKey: (name: string) => new Uint8Array(name === "auth" ? 16 : 65).fill(7).buffer,
      unsubscribe: async () => (sessionStorage.removeItem("push-sub"), (sub = null), true),
    });
    let sub: any = sessionStorage.getItem("push-sub") ? make() : null;
    Object.defineProperty(Notification, "permission", {
      get: () => sessionStorage.getItem("push-permission") ?? "default",
    });
    Notification.requestPermission = async () => (sessionStorage.setItem("push-permission", "granted"), "granted");
    const pushManager = {
      getSubscription: async () => sub,
      subscribe: async () => (sessionStorage.setItem("push-sub", "1"), (sub = make())),
    };
    const reg = { pushManager } as any;
    navigator.serviceWorker.register = async () => reg;
    navigator.serviceWorker.getRegistration = async () => reg;
  });
  const saved: any[] = [];
  await page.route("**/rest/v1/rpc/save_push_subscription", async (route) => {
    saved.push(route.request().postDataJSON());
    await route.fulfill({ json: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" });
  });
  await page.route("**/rest/v1/push_subscriptions*", (route) =>
    route.fulfill({
      json: saved.length
        ? [{ id: "e1", label: saved.at(-1).p_label, created_at: new Date().toISOString(), last_seen_at: new Date().toISOString(), endpoint: saved.at(-1).p_endpoint }]
        : [],
    }),
  );
  await page.route("**/functions/v1/push", async (route) => {
    const body = route.request().postDataJSON();
    await route.fulfill(
      body.action === "key" ? { json: { publicKey: "B" + "A".repeat(86) } } : { status: 400, json: { error: "Acción no válida" } },
    );
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "¿Te avisamos cuando te toque?" })).toBeVisible();
  // "Ahora no" keeps a visible status with a way back.
  await page.getByRole("button", { name: "Ahora no" }).first().click();
  await expect(page.getByText("Notificaciones desactivadas")).toBeVisible();
  await page.getByRole("button", { name: "Activar", exact: true }).click();
  await expect(page.getByRole("link", { name: /Notificaciones activadas/ })).toBeVisible();
  expect(saved[0].p_endpoint).toBe("https://push.example.test/device-1");
  expect(saved[0].p_p256dh.length).toBeGreaterThan(80);
  const a11y = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(a11y.violations).toEqual([]);
  // A later visit re-links the device silently, without asking again.
  await page.reload();
  await expect(page.getByRole("link", { name: /Notificaciones activadas/ })).toBeVisible();
  await page.getByRole("link", { name: /Notificaciones activadas/ }).click();
  await expect(page.getByRole("heading", { name: "Notificaciones en tus dispositivos" })).toBeVisible();
  await expect(page.getByText("Este dispositivo", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Desactivar aquí" })).toBeVisible();
  // Blocking the permission later removes the dead subscription from the server.
  const removed: string[] = [];
  await page.route("**/rest/v1/rpc/remove_push_subscription", async (route) => {
    removed.push(route.request().postDataJSON().p_endpoint);
    await route.fulfill({ json: null });
  });
  await page.evaluate(() => {
    sessionStorage.setItem("push-permission", "denied");
    sessionStorage.removeItem("push-sub");
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Las notificaciones están bloqueadas" })).toBeVisible();
  await expect.poll(() => removed).toEqual(["https://push.example.test/device-1"]);
});
test("Gmail connection is send-only, explains the email fallback and reports the OAuth result", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await fixture(page);
  let connected = false;
  const actions: string[] = [];
  await page.route("**/rest/v1/rpc/gmail_status", (route) =>
    route.fulfill({
      json: { connected, email: connected ? "test-a@example.test" : null, partner_connected: false, last_error: null },
    }),
  );
  await page.route("**/functions/v1/mail", async (route) => {
    const body = route.request().postDataJSON();
    actions.push(body.action);
    if (body.action === "connect") {
      connected = true;
      // Stand-in for Google's consent screen redirecting back to the app.
      return route.fulfill({ json: { url: "/ajustes/conexiones?gmail=connected" } });
    }
    connected = false;
    return route.fulfill({ json: { disconnected: true } });
  });
  await page.goto("/ajustes");
  await expect(page.getByRole("heading", { name: "Notificaciones por correo" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Conectar Gmail" })).toBeVisible();
  await page.goto("/ajustes/conexiones");
  await expect(page.getByRole("heading", { name: "Gmail para avisos por correo" })).toBeVisible();
  await expect(page.getByText("Chimuverse no puede leer, buscar ni borrar tu correo.")).toBeVisible();
  await page.getByRole("button", { name: "Conectar mi Gmail" }).click();
  await expect(page.getByText("Gmail conectado.")).toBeVisible();
  await expect(page.getByText("Conectado como test-a@example.test")).toBeVisible();
  const a11y = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(a11y.violations).toEqual([]);
  await page.getByRole("button", { name: "Desconectar Gmail" }).click();
  await expect(page.getByRole("button", { name: "Conectar mi Gmail" })).toBeVisible();
  expect(actions).toEqual(["connect", "disconnect"]);
  await page.goto("/ajustes");
  await expect(page.getByText("Conecta Gmail en Conexiones")).toBeVisible();
});

test("either partner marks a date as lived with a past day, an optional polaroid photo and a note on its back", async ({
  page,
}) => {
  const rows = await fixture(page);
  const date = (id: string, title: string, status = "pending") => ({
    id,
    owner_id: b,
    space_id: sid,
    kind: "date",
    title,
    details: { category: "Naturaleza" },
    visibility: "shared",
    status,
    occurred_on: "2026-11-13",
    created_at: new Date().toISOString(),
    deleted_at: null,
    entry_bodies: null,
  });
  rows.entries.push(
    date("d2222222-2222-4222-8222-222222222222", "Nuestro picnic"),
    date("d3333333-3333-4333-8333-333333333333", "Cine en casa", "done"),
  );
  const calls: any[] = [];
  await page.route("**/rest/v1/rpc/complete_date", async (route) => {
    const body = route.request().postDataJSON();
    calls.push(body);
    const e = rows.entries.find((e) => e.id === body.p_entry_id);
    Object.assign(e, {
      status: "done",
      occurred_on: body.p_lived_on,
      details: { ...e.details, memory_note: body.p_note || undefined, photo_id: body.p_photo_id ?? undefined },
    });
    await route.fulfill({ json: null });
  });
  await page.route("**/rest/v1/photos*", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    rows.photos.push({ ...route.request().postDataJSON(), uploaded_by: a, deleted_at: null, uploaded_at: new Date().toISOString() });
    await route.fulfill({ status: 201, json: null });
  });
  await page.route("**/storage/v1/object/**", (route) =>
    route.fulfill({ json: { Key: "ok", signedURL: "/storage/v1/object/sign/photos/x" } }),
  );
  await page.goto("/experiencias/citas");
  // A lived date without photo is flagged so it can be completed later.
  await expect(page.getByRole("status").filter({ hasText: "Una cita que ya vivieron todavía no tiene foto." })).toBeVisible();
  await page.getByRole("button", { name: "Ver citas sin foto" }).click();
  await expect(page.getByRole("heading", { name: "Cine en casa" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Nuestro picnic" })).toHaveCount(0);
  await page.getByRole("button", { name: "Todas", exact: true }).click();
  // The partner's ideas (like the seeded ones) can be edited and trashed by either of us.
  await expect(page.getByRole("button", { name: "Editar Nuestro picnic" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Enviar Nuestro picnic a la papelera" })).toBeVisible();
  // The partner's idea can be marked as lived by either of us, on a past day.
  await page.getByRole("button", { name: "Ya la vivimos" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "¡La vivimos!" })).toBeVisible();
  await dialog.getByLabel("¿Cuándo la vivieron?").fill("2026-02-14");
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64",
  );
  await dialog.locator('input[type="file"]').setInputFiles({ name: "picnic.png", mimeType: "image/png", buffer: png });
  await expect(dialog.getByRole("img", { name: "Foto elegida para la cita" })).toBeVisible();
  await dialog.getByLabel("Lo que queremos recordar (va detrás de la polaroid)").fill("Nos llovió y fue perfecto");
  const axe = await new AxeBuilder({ page }).include(".dialog").analyze();
  expect(axe.violations).toEqual([]);
  await dialog.getByRole("button", { name: "Guardar el recuerdo" }).click();
  await expect(dialog).toHaveCount(0);
  expect(calls[0]).toMatchObject({ p_lived_on: "2026-02-14", p_note: "Nos llovió y fue perfecto" });
  expect(calls[0].p_photo_id).toBe(rows.photos[0].id);
  expect(rows.photos[0]).toMatchObject({ title: "Nuestro picnic", captured_at_source: "manual", visibility: "shared" });
  // The polaroid flips to show the note written on its back.
  const card = page.locator("article").filter({ hasText: "Nuestro picnic" });
  const polaroid = card.getByRole("button", { name: /Darle la vuelta/ });
  await polaroid.click();
  await expect(card.getByRole("button", { name: /Ver la foto/ })).toHaveAttribute("aria-pressed", "true");
  await expect(card.getByText("Nos llovió y fue perfecto")).toBeVisible();
  // The memory stays editable, starting from what was saved.
  await card.getByRole("button", { name: "Editar recuerdo" }).click();
  await expect(dialog.getByLabel("¿Cuándo la vivieron?")).toHaveValue("2026-02-14");
  await expect(dialog.getByLabel("Lo que queremos recordar (va detrás de la polaroid)")).toHaveValue("Nos llovió y fue perfecto");
  await expect(dialog.getByText("Cambiar foto")).toBeVisible();
  await dialog.getByRole("button", { name: "Quitar foto" }).click();
  await dialog.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(dialog).toHaveCount(0);
  expect(calls[1].p_photo_id).toBeNull();
  expect(rows.photos[0].deleted_at).toBeTruthy();
});

test("a lived date's photo also appears in the memory album with its note", async ({ page }) => {
  const rows = await fixture(page);
  const pid = "a4444444-4444-4444-8444-444444444444";
  rows.photos.push({
    id: pid, space_id: sid, uploaded_by: a, title: "Nuestro picnic",
    storage_path: `${sid}/${pid}/full.webp`, thumb_path: `${sid}/${pid}/thumb.webp`,
    captured_at: "2026-02-14T17:00:00Z", uploaded_at: new Date().toISOString(),
    visibility: "shared", trip_id: null, size_bytes: 100, deleted_at: null,
  });
  rows.entries.push({
    id: "d5555555-5555-4555-8555-555555555555", owner_id: b, space_id: sid, kind: "date",
    title: "Nuestro picnic", details: { photo_id: pid, memory_note: "Nos llovió y fue perfecto" },
    visibility: "shared", status: "done", occurred_on: "2026-02-14",
    created_at: new Date().toISOString(), deleted_at: null, entry_bodies: null,
  });
  await page.route("**/storage/v1/object/**", (route) =>
    route.fulfill({ json: { signedURL: "/storage/v1/object/sign/photos/x" } }),
  );
  await page.goto("/recuerdos/vault");
  await page.getByRole("button", { name: /Nuestro picnic/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("De nuestra cita")).toBeVisible();
  await expect(dialog.getByText("Nos llovió y fue perfecto")).toBeVisible();
});

test("unfinished tasks move to another day with a reason, can be edited, and finished ones live in the history", async ({
  page,
}) => {
  const rows = await fixture(page);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
  rows.tasks.push({
    id: "dddddddd-0000-4ddd-8ddd-000000000001",
    space_id: sid,
    created_by: a,
    assignee_id: a,
    title: "Regar las plantas",
    description: "",
    due_on: today,
    status: "done",
    reported_percent: 100,
    verified_percent: 100,
    rejections: 0,
    created_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
  });
  // Nobody reviewed it yesterday: the scheduler carried it to today by itself.
  rows.task_events = [
    { id: crypto.randomUUID(), task_id: tid, actor_id: null, kind: "carry", from_date: "2026-11-12", to_date: today, reason: "No se completó ni se movió ese día; pasó sola al siguiente.", changes: {}, created_at: new Date(Date.now() - 3600e3).toISOString() },
  ];
  const calls: Record<string, any[]> = { postpone_task: [], edit_task: [] };
  await page.route(/rest\/v1\/rpc\/(postpone_task|edit_task)/, async (route) => {
    const fn = new URL(route.request().url()).pathname.split("/").pop()!;
    const body = route.request().postDataJSON();
    calls[fn].push(body);
    const t = rows.tasks.find((t) => t.id === body.p_task_id);
    if (fn === "postpone_task") {
      rows.task_events.push({ id: crypto.randomUUID(), task_id: t.id, actor_id: a, kind: "postpone", from_date: t.due_on, to_date: body.p_to, reason: body.p_reason, changes: {}, created_at: new Date().toISOString() });
      t.due_on = body.p_to;
    } else {
      rows.task_events.push({ id: crypto.randomUUID(), task_id: t.id, actor_id: a, kind: "edit", from_date: t.due_on, to_date: null, reason: "", changes: { title: [t.title, body.p_title] }, created_at: new Date().toISOString() });
      Object.assign(t, { title: body.p_title, description: body.p_description, assignee_id: body.p_assignee_id, due_on: body.p_due_on });
    }
    await route.fulfill({ json: null });
  });
  // Finished tasks leave the active list and appear in the history.
  await page.goto("/dia/quests");
  await expect(page.getByRole("heading", { name: "Preparar una escapada" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Regar las plantas" })).toHaveCount(0);
  await page.getByRole("button", { name: "Historial", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Regar las plantas" })).toBeVisible();
  await expect(page.getByText(/Completada el/)).toBeVisible();
  // An unfinished task moves to another day, with its reason on record.
  await page.goto(`/dia/quests/${tid}`);
  await expect(page.getByText(/^Pasó sola del 12 de noviembre/)).toBeVisible();
  await expect(page.getByText("Automático", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Pasar a otro día" }).click();
  const dialog = page.getByRole("dialog");
  const save = dialog.getByRole("button", { name: /^Pasar al/ });
  await expect(save).toBeDisabled();
  await dialog.getByLabel("¿Por qué no se completó?").fill("Faltó tiempo para comparar precios");
  const axe = await new AxeBuilder({ page }).include(".dialog").analyze();
  expect(axe.violations).toEqual([]);
  await save.click();
  await expect(dialog).toHaveCount(0);
  expect(calls.postpone_task[0]).toMatchObject({ p_task_id: tid, p_reason: "Faltó tiempo para comparar precios" });
  expect(calls.postpone_task[0].p_to > today).toBe(true);
  await expect(page.getByText("Motivo: Faltó tiempo para comparar precios")).toBeVisible();
  // Editing works from the task itself, keeping the change in its history.
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await dialog.getByLabel("Título").fill("Preparar la escapada a Paracas");
  await dialog.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(dialog).toHaveCount(0);
  expect(calls.edit_task[0]).toMatchObject({ p_title: "Preparar la escapada a Paracas", p_assignee_id: b });
  await expect(page.getByRole("heading", { name: "Preparar la escapada a Paracas" })).toBeVisible();
  await expect(page.getByText("Título: «Preparar una escapada» → «Preparar la escapada a Paracas»")).toBeVisible();
  await page.goto("/dia/quests");
  await expect(page.getByText(/Movida 2 veces/)).toBeVisible();
});

test("tasks are discarded with a reason and recovered, the reviewer adjusts progress, and 100 % needs confirmation", async ({
  page,
}) => {
  const rows = await fixture(page);
  rows.task_events = [];
  const full = "dddddddd-0000-4ddd-8ddd-000000000002";
  rows.tasks.push({
    id: full, space_id: sid, created_by: b, assignee_id: b, title: "Imprimir las fotos",
    description: "", due_on: rows.tasks[0].due_on, status: "review", reported_percent: 100,
    verified_percent: 40, rejections: 0, created_at: new Date().toISOString(),
  });
  rows.task_progress.push({
    id: "eeeeeeee-0000-4eee-8eee-000000000002", task_id: full, reported_by: b,
    reported_percent: 100, note: "Listas", state: "pending", created_at: new Date().toISOString(),
  });
  const calls: Record<string, any[]> = {};
  await page.route(/rest\/v1\/rpc\/(discard_task|restore_task|adjust_task_progress)/, async (route) => {
    const fn = new URL(route.request().url()).pathname.split("/").pop()!;
    const body = route.request().postDataJSON();
    (calls[fn] ??= []).push(body);
    const t = rows.tasks.find((t) => t.id === body.p_task_id);
    const event = (kind: string, extra = {}) =>
      rows.task_events.push({ id: crypto.randomUUID(), task_id: t.id, actor_id: a, kind, from_date: null, to_date: null, reason: body.p_reason ?? "", changes: {}, created_at: new Date().toISOString(), ...extra });
    if (fn === "discard_task") { t.status = "discarded"; event("discard"); }
    if (fn === "restore_task") { t.status = "progress"; event("restore"); }
    if (fn === "adjust_task_progress") {
      event("progress", { changes: { verified_percent: [t.verified_percent, body.p_percent] } });
      t.verified_percent = body.p_percent;
    }
    await route.fulfill({ json: null });
  });
  // The reviewer (not the assignee) adjusts the verified progress, or restarts it, with a reason.
  await page.goto(`/dia/quests/${tid}`);
  await page.getByRole("button", { name: "Ajustar avance" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Empezar de cero" }).click();
  await dialog.getByLabel("Motivo").fill("Cambiamos el destino del viaje");
  await dialog.getByRole("button", { name: "Guardar 0 %" }).click();
  await expect(dialog).toHaveCount(0);
  expect(calls.adjust_task_progress[0]).toMatchObject({ p_percent: 0, p_reason: "Cambiamos el destino del viaje" });
  await expect(page.getByText("Reinició el avance (tenía 20 %)")).toBeVisible();
  // The day can no longer be changed from "Editar" once a task has progress.
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await expect(dialog.getByText("Para cambiar el día, usa «Pasar a otro día» y cuenta el motivo.")).toBeVisible();
  await expect(dialog.getByLabel("Fecha")).toHaveCount(0);
  await page.keyboard.press("Escape");
  // Discarding asks why, leaves the active list, and can be undone.
  await page.getByRole("button", { name: "Descartar", exact: true }).click();
  const discard = dialog.getByRole("button", { name: "Descartar", exact: true });
  await expect(discard).toBeDisabled();
  await dialog.getByLabel("¿Por qué la descartan?").fill("Ya no viajamos este mes");
  const axe = await new AxeBuilder({ page }).include(".dialog").analyze();
  expect(axe.violations).toEqual([]);
  await discard.click();
  await expect(page.getByText(/Descartada: Ya no viajamos este mes/)).toBeVisible();
  await page.goto("/dia/quests");
  await expect(page.getByRole("heading", { name: "Preparar una escapada" })).toHaveCount(0);
  await page.getByRole("button", { name: "Descartadas", exact: true }).click();
  await page.getByRole("heading", { name: "Preparar una escapada" }).click();
  await page.getByRole("button", { name: "Recuperar" }).click();
  await expect(page.getByRole("button", { name: "Pasar a otro día" })).toBeVisible();
  expect(calls.restore_task).toHaveLength(1);
  // Approving 100 % asks for confirmation before it becomes history.
  await page.goto(`/dia/quests/${full}`);
  await page.getByRole("button", { name: "Aprobar 100 %" }).click();
  await expect(dialog.getByRole("heading", { name: "¿La damos por completada?" })).toBeVisible();
  await dialog.getByRole("button", { name: "Todavía no" }).click();
  await expect(dialog).toHaveCount(0);
  expect(rows.tasks.find((t) => t.id === full).status).toBe("review");
  await page.getByRole("button", { name: "Aprobar 100 %" }).click();
  await dialog.getByRole("button", { name: "Sí, está completada" }).click();
  await expect(dialog).toHaveCount(0);
  expect(rows.task_verifications.at(-1)).toMatchObject({ decision: "approve" });
});

test("finances are shared, filtered by month, measured against the budget, and fixed movements register themselves", async ({
  page,
}) => {
  const rows = await fixture(page);
  const month = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date()).slice(0, 7);
  const entry = (id: string, kind: string, title: string, amount: number, day: string, details: any) => ({
    id, owner_id: b, space_id: sid, kind, title, amount, details, visibility: "shared", status: "pending",
    occurred_on: day, created_at: new Date().toISOString(), deleted_at: null, entry_bodies: null,
  });
  rows.entries.push(
    entry("f1111111-1111-4111-8111-111111111111", "transaction", "Sueldo", 3000, `${month}-01`, { direction: "income", category: "Trabajo" }),
    entry("f2222222-2222-4222-8222-222222222222", "transaction", "Mercado", 400, `${month}-05`, { direction: "expense", category: "Comida" }),
    entry("f3333333-3333-4333-8333-333333333333", "transaction", "Fondo de viaje", 500, `${month}-06`, { direction: "saving" }),
    entry("f4444444-4444-4444-8444-444444444444", "transaction", "Cena del mes pasado", 99, "2020-01-10", { direction: "expense" }),
    entry("f5555555-5555-4555-8555-555555555555", "budget", "Presupuesto del mes", 1000, `${month}-01`, {}),
  );
  rows.finance_recurring = [];
  rows.savings_goals = [];
  await page.route("**/rest/v1/rpc/save_savings_goal", async (route) => {
    const d = route.request().postDataJSON().p_data;
    rows.savings_goals.push({ id: "a7777777-7777-4777-8777-777777777777", space_id: sid, created_by: a, title: d.title, target: d.target, target_on: d.target_on || null, person: d.person || null, deleted_at: null, created_at: new Date().toISOString() });
    await route.fulfill({ json: null });
  });
  const saved: any[] = [];
  await page.route("**/rest/v1/rpc/save_recurring", async (route) => {
    const body = route.request().postDataJSON();
    saved.push(body);
    const d = body.p_data;
    if (!body.p_id) {
      const id = crypto.randomUUID();
      rows.finance_recurring.push({ id, space_id: sid, created_by: a, title: d.title, amount: d.amount, direction: d.direction, category: d.category, frequency: d.frequency, start_on: d.start_on, end_on: null, next_on: "2999-01-01", active: true, deleted_at: null });
      rows.entries.push(entry(crypto.randomUUID(), "transaction", d.title, d.amount, d.start_on, { direction: d.direction, recurring_id: id }));
    } else {
      const r = rows.finance_recurring.find((r) => r.id === body.p_id);
      Object.assign(r, { active: d.active, title: d.title, amount: d.amount, frequency: d.frequency ?? r.frequency });
      if (d.apply_past)
        rows.entries.filter((e) => e.details.recurring_id === r.id).forEach((e) => Object.assign(e, { title: d.title, amount: d.amount }));
    }
    await route.fulfill({ json: null });
  });
  await page.goto("/creciendo/finanzas");
  // The chosen month's totals count savings, and the budget shows what is left.
  await expect(page.getByText("Disponible", { exact: true }).first()).toBeVisible();
  await expect(page.locator(".metric").filter({ hasText: "Disponible" })).toContainText("2,100");
  await expect(page.getByText(/Quedan S\/\s?600/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Cena del mes pasado" })).toHaveCount(0);
  // The partner's movements can be corrected and trashed by either of us.
  await expect(page.getByRole("button", { name: "Editar Mercado" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Enviar Mercado a la papelera" })).toBeVisible();
  // A fixed expense registers itself on its date and can be paused.
  await page.getByRole("button", { name: "Añadir fijo" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nombre").fill("Internet");
  await dialog.getByLabel("Importe (S/)").fill("120");
  await dialog.getByLabel("Primera fecha").fill(`${month}-02`);
  const axe = await new AxeBuilder({ page }).include(".dialog").analyze();
  expect(axe.violations).toEqual([]);
  await dialog.getByRole("button", { name: "Guardar movimiento fijo" }).click();
  await expect(dialog).toHaveCount(0);
  expect(saved[0].p_data).toMatchObject({ title: "Internet", amount: 120, direction: "expense", frequency: "monthly", start_on: `${month}-02` });
  await expect(page.getByRole("heading", { name: "Internet" })).toBeVisible();
  await expect(page.getByText("Fijo · se registró solo")).toBeVisible();
  await page.getByRole("button", { name: "Pausar el fijo Internet" }).click();
  await expect(page.getByText(/en pausa/)).toBeVisible();
  expect(saved[1]).toMatchObject({ p_data: { active: false } });
  // Every field of a fixed movement is editable, optionally fixing the ones already registered.
  await page.getByRole("button", { name: "Editar el fijo Internet" }).click();
  await dialog.getByLabel("Importe (S/)").fill("135");
  await dialog.getByLabel("Se repite").selectOption("biweekly");
  await dialog.getByLabel(/Corregir también el movimiento ya registrado/).check();
  await dialog.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(dialog).toHaveCount(0);
  expect(saved[2]).toMatchObject({ p_data: { amount: 135, frequency: "biweekly", apply_past: true, active: false } });
  await expect(page.getByText(/cada dos semanas/)).toBeVisible();
  // Whose money: older movements count as their author's (Glenny), shown per person.
  const split = page.locator(".split-table");
  await expect(split.getByRole("row").filter({ hasText: "Glenny" })).toContainText("3,000");
  await expect(page.getByText("Ingreso de Glenny")).toBeVisible();
  // A shared savings goal fills with the savings assigned to it.
  await page.getByRole("button", { name: "Nueva meta" }).click();
  await dialog.getByLabel("Nombre").fill("Viaje a Cusco");
  await dialog.getByLabel("Meta (S/)").fill("2000");
  await dialog.getByRole("button", { name: "Crear meta" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText("Viaje a Cusco")).toBeVisible();
  await page.getByRole("button", { name: "Añadir movimiento" }).click();
  await dialog.getByLabel("Título").fill("Para Cusco");
  await dialog.getByLabel("Importe (S/)").fill("500");
  await dialog.getByLabel("Tipo").selectOption("saving");
  await expect(dialog.getByLabel("¿Quién ahorra?")).toHaveValue(a);
  await dialog.getByLabel("¿Quién ahorra?").selectOption("");
  await dialog.getByLabel("¿Para qué meta?").selectOption({ label: "Viaje a Cusco" });
  await dialog.getByRole("button", { name: /Guardar/ }).click();
  await expect(dialog).toHaveCount(0);
  expect(rows.entries.at(-1).details).toMatchObject({ direction: "saving", person: "", goal_id: "a7777777-7777-4777-8777-777777777777" });
  await expect(page.locator(".goal-list")).toContainText("25 %");
  await expect(page.getByText("Ahorro de los dos · para «Viaje a Cusco»")).toBeVisible();
  const goalsAxe = await new AxeBuilder({ page }).include(".savings-goals").include(".person-split").analyze();
  expect(goalsAxe.violations).toEqual([]);
  const page2 = await new AxeBuilder({ page }).include(".finance-fixed").analyze();
  expect(page2.violations).toEqual([]);
});

test("questions are added, edited, trashed or hidden from Nuestro Universo, and come back from the trash", async ({
  page,
}) => {
  const rows = await fixture(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  rows.question_hidden = [];
  rows.questions.push({ id: "f9999999-9999-4999-8999-999999999999", space_id: sid, category: "Nosotros", title: "¿Qué canción nos define?", depth: 1, deleted_at: null });
  const edits: any[] = [];
  await page.route("**/rest/v1/rpc/edit_question", async (route) => {
    const b = route.request().postDataJSON();
    edits.push(b);
    Object.assign(rows.questions.find((q) => q.id === b.p_id), { title: b.p_title, category: b.p_category, depth: b.p_depth });
    await route.fulfill({ json: null });
  });
  await page.goto("/nosotros/universo");
  // Only our own questions can be edited; bank questions can only be hidden.
  await expect(page.getByRole("button", { name: /^Editar la pregunta ¿Qué pequeño gesto/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Editar la pregunta ¿Qué canción nos define?" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("¿Qué te gustaría preguntar?").fill("¿Qué canción nos define hoy?");
  await dialog.getByLabel("Profundidad").selectOption("2");
  await dialog.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(dialog).toHaveCount(0);
  expect(edits[0]).toMatchObject({ p_title: "¿Qué canción nos define hoy?", p_depth: 2 });
  await expect(page.getByRole("heading", { name: "¿Qué canción nos define hoy?" })).toBeVisible();
  await page.getByRole("button", { name: /^Ocultar la pregunta ¿Qué pequeño gesto/ }).click();
  await expect(page.getByRole("heading", { name: /¿Qué pequeño gesto/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Enviar a la papelera la pregunta ¿Qué canción nos define hoy?" }).click();
  await expect(page.getByRole("heading", { name: "¿Qué canción nos define hoy?" })).toHaveCount(0);
  // Both come back from the trash.
  await page.goto("/ajustes/papelera");
  await expect(page.getByRole("heading", { name: "¿Qué canción nos define hoy?" })).toBeVisible();
  const axe = await new AxeBuilder({ page }).include(".settings-card").analyze();
  expect(axe.violations).toEqual([]);
  await page.getByRole("button", { name: "Restaurar" }).first().click();
  await expect(page.getByRole("button", { name: "Restaurar" })).toHaveCount(1);
});
