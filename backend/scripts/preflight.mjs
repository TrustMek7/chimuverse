import {
  readFileSync,
  appendFileSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { randomBytes, createCipheriv } from "node:crypto";
import { gzipSync } from "node:zlib";
const envPath = new URL("../.env", import.meta.url);
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [
        l.slice(0, i).trim(),
        l
          .slice(i + 1)
          .trim()
          .replace(/^['"]|['"]$/g, ""),
      ];
    }),
);
const ref = new URL(env.SUPABASE_URL).hostname.split(".")[0];
async function api(path, body) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${ref}${path}`,
    {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(60000),
    },
  );
  if (!res.ok)
    throw new Error(`Administración devolvió ${res.status} en ${path}`);
  return res.json();
}
const sql = (query) => api("/database/query", { query, read_only: true });
try {
  const tables = await sql(
    "select tablename from pg_tables where schemaname='public' order by tablename",
  );
  const policies = await sql(
    "select * from pg_policies where schemaname='public'",
  );
  const columns = await sql(
    "select * from information_schema.columns where table_schema='public'",
  );
  const constraints = await sql(
    "select c.relname as table_name,pg_get_constraintdef(x.oid) as definition from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'",
  );
  const functions = await sql(
    "select p.proname,pg_get_functiondef(p.oid) as definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f'",
  );
  const data = {};
  for (const { tablename } of tables) {
    const name = '"' + tablename.replaceAll('"', '""') + '"';
    data[tablename] = await sql(`select * from public.${name}`);
  }
  const counts = await sql("select count(*)::int as users from auth.users");
  let managed = "unavailable";
  try {
    const b = await api("/database/backups");
    managed = Array.isArray(b.backups) ? b.backups.length : "available";
  } catch {}
  const snapshot = {
    created_at: new Date().toISOString(),
    project_ref: ref,
    scope:
      "public schema catalog and public table data; excludes auth/storage objects",
    tables,
    columns,
    constraints,
    policies,
    functions,
    data,
  };
  if (!env.BACKUP_ENCRYPTION_KEY) {
    env.BACKUP_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    appendFileSync(
      envPath,
      `\nBACKUP_ENCRYPTION_KEY=${env.BACKUP_ENCRYPTION_KEY}\n`,
    );
  }
  const iv = randomBytes(12),
    cipher = createCipheriv(
      "aes-256-gcm",
      Buffer.from(env.BACKUP_ENCRYPTION_KEY, "base64"),
      iv,
    );
  const encrypted = Buffer.concat([
    cipher.update(gzipSync(JSON.stringify(snapshot))),
    cipher.final(),
  ]);
  const dir = new URL("../backups/", import.meta.url);
  mkdirSync(dir, { recursive: true });
  const name = "pre-deploy-" + Date.now() + ".json.aes";
  writeFileSync(
    new URL(name, dir),
    JSON.stringify({
      version: 1,
      algorithm: "aes-256-gcm",
      iv: iv.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"),
      data: encrypted.toString("base64"),
    }),
  );
  console.log(
    JSON.stringify({
      publicTables: tables.length,
      authUsers: counts[0].users,
      managedBackups: managed,
      encryptedSnapshot: "backend/backups/" + name,
    }),
  );
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
