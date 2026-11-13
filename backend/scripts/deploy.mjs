import { readFileSync, readdirSync, existsSync, appendFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const env = { ...process.env };
if (existsSync(root + ".env"))
  for (const line of readFileSync(root + ".env", "utf8").split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i > 0)
      env[line.slice(0, i).trim()] = line
        .slice(i + 1)
        .trim()
        .replace(/^['"]|['"]$/g, "");
  }
if (!env.SUPABASE_ACCESS_TOKEN) {
  console.error(
    "Falta SUPABASE_ACCESS_TOKEN en backend/.env. No se hicieron cambios remotos.",
  );
  process.exit(1);
}
const ref = new URL(env.SUPABASE_URL).hostname.split(".")[0];
async function api(path, body, method = "POST") {
  const response = await fetch(
    "https://api.supabase.com/v1/projects/" + ref + path,
    {
      method,
      headers: {
        Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(60000),
    },
  );
  if (!response.ok) {
    console.error(
      "Falló la operación de administración:",
      response.status,
      path,
    );
    process.exit(1);
  }
  const text = await response.text();
  return text.trim() ? JSON.parse(text) : null;
}
const sql = (query) => api("/database/query", { query });
await sql(
  "create schema if not exists supabase_migrations;create table if not exists supabase_migrations.schema_migrations(version text primary key,statements text[],name text)",
);
const applied = await sql(
  "select version from supabase_migrations.schema_migrations",
);
const migrations = new URL("../supabase/migrations/", import.meta.url);
for (const name of readdirSync(migrations)
  .filter((n) => n.endsWith(".sql"))
  .sort()) {
  const [version, ...rest] = name.replace(/\.sql$/, "").split("_");
  if (applied.some((row) => row.version === version)) {
    console.log("Ya aplicada:", name);
    continue;
  }
  const migration = readFileSync(new URL(name, migrations), "utf8");
  const escaped = migration.replaceAll("'", "''");
  await sql(
    `begin;${migration}\ninsert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','${rest.join("_")}',array['${escaped}']);commit;`,
  );
  console.log("Migración aplicada:", name);
}
const app = env.APP_URL ?? "http://localhost:5173";
const authConfig = {
  site_url: app,
  uri_allow_list: [
    app + "/auth/callback",
    "http://localhost:5173/auth/callback",
    "http://127.0.0.1:5173/auth/callback",
  ].join(","),
};
if (env.GOOGLE_OAUTH_CLIENT_ID && env.GOOGLE_OAUTH_CLIENT_SECRET) {
  Object.assign(authConfig, {
    external_google_enabled: true,
    external_google_client_id: env.GOOGLE_OAUTH_CLIENT_ID,
    external_google_secret: env.GOOGLE_OAUTH_CLIENT_SECRET,
  });
}
await api("/config/auth", authConfig, "PATCH");
const cli = root + "node_modules/supabase/bin/supabase.exe";
const cliCommand = existsSync(cli)
  ? cli
  : root + "node_modules/@supabase/cli-windows-x64/bin/supabase.exe";
if (process.argv.includes("--functions")) {
  for (const [key, value] of [
    ["GOOGLE_TOKEN_ENCRYPTION_KEY", randomBytes(32).toString("base64")],
    ["CRON_SECRET", randomBytes(48).toString("base64url")],
  ]) {
    if (!env[key]) {
      env[key] = value;
      appendFileSync(root + ".env", `\n${key}=${value}\n`);
    }
  }
  const secrets = [
    { name: "APP_URL", value: app },
    ...[
      "GOOGLE_OAUTH_CLIENT_ID",
      "GOOGLE_OAUTH_CLIENT_SECRET",
      "GOOGLE_TOKEN_ENCRYPTION_KEY",
      "CRON_SECRET",
    ]
      .filter((k) => env[k])
      .map((k) => ({ name: k, value: env[k] })),
  ];
  if (env.SUPABASE_SECRET_KEY)
    secrets.push({
      name: "CHIMU_SUPABASE_SECRET_KEY",
      value: env.SUPABASE_SECRET_KEY,
    });
  await api("/secrets", secrets);
  const cmd =
    process.platform === "win32"
      ? cliCommand
      : root + "node_modules/.bin/supabase";
  const result = spawnSync(
    cmd,
    [
      "functions",
      "deploy",
      "calendar",
      "--project-ref",
      ref,
      "--no-verify-jwt",
      "--use-api",
    ],
    { cwd: root, env, stdio: "inherit" },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
  if (process.argv.includes("--schedule")) {
    const secret = env.CRON_SECRET.replaceAll("'", "''");
    const functionUrl = (
      env.SUPABASE_URL + "/functions/v1/calendar"
    ).replaceAll("'", "''");
    await sql(`create extension if not exists pg_cron;create extension if not exists pg_net with schema extensions;
  do $setup$ declare secret_id uuid;begin select id into secret_id from vault.secrets where name='chimuverse_cron';if secret_id is null then perform vault.create_secret('${secret}','chimuverse_cron');else perform vault.update_secret(secret_id,'${secret}');end if;end $setup$;
  select cron.schedule('chimuverse-calendar','*/15 * * * *',$job$select net.http_post(url:='${functionUrl}',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='chimuverse_cron')),body:='{"action":"scheduled"}'::jsonb);$job$);`);
    console.log("Sincronización y recordatorios programados cada 15 minutos.");
  }
}
console.log(
  "Base de datos y redirecciones configuradas. Google Auth:",
  authConfig.external_google_enabled
    ? "habilitado"
    : "pendiente de credenciales OAuth",
);
