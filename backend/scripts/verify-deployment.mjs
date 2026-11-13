import { readFileSync } from "node:fs";
const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);
const ref = new URL(env.SUPABASE_URL).hostname.split(".")[0];
const mgmt = await fetch(
  `https://api.supabase.com/v1/projects/${ref}/database/query`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query:
        "select (select count(*) from supabase_migrations.schema_migrations)::int as migrations,(select count(*) from cron.job where jobname='chimuverse-calendar' and active)::int as scheduled_jobs,(select count(*) from private.allowed_emails)::int as allowed_accounts,(select count(*) from pg_tables where schemaname='public' and rowsecurity)::int as rls_tables,(select count(*) from public.entries where visibility='private')::int as personal_entries,(select count(*) from public.photos where visibility<>'shared')::int as personal_photos,(select count(*) from public.questions where bank_key like 'universe-v1-%')::int as seeded_questions,(select count(*) from public.entries where kind='date' and details->>'seed_key' like 'dates-v1-%')::int as seeded_dates",
      read_only: true,
    }),
  },
);
if (!mgmt.ok) throw new Error(`Verification failed: ${mgmt.status}`);
const database = await mgmt.json();
if (database.some((row) => row.personal_entries || row.personal_photos))
  throw new Error("Shared-space backfill incomplete");
console.log("Database:", JSON.stringify(database));
const res = await fetch(env.SUPABASE_URL + "/functions/v1/calendar", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${env.CRON_SECRET}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ action: "scheduled" }),
});
const result = await res.json();
if (!res.ok || result.failed)
  throw new Error(`Scheduled function failed: ${res.status}`);
console.log("Scheduled function:", JSON.stringify(result));
const auth = await fetch(env.SUPABASE_URL + "/auth/v1/settings", {
  headers: { apikey: env.SUPABASE_SECRET_KEY },
});
const config = await auth.json();
console.log("Google Auth enabled:", config.external?.google === true);
const youtube = await fetch(env.SUPABASE_URL + "/functions/v1/youtube", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ action: "status" }),
});
if (youtube.status !== 401)
  throw new Error(`YouTube authentication guard failed: ${youtube.status}`);
console.log(
  "YouTube function deployed; anonymous access denied:",
  youtube.status,
);
for (const name of ["push", "mail"]) {
  const res = await fetch(env.SUPABASE_URL + "/functions/v1/" + name, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "send",
      notification_id: "00000000-0000-4000-8000-000000000000",
    }),
  });
  if (res.status !== 401)
    throw new Error(`${name} function must reject unsigned sends: ${res.status}`);
  console.log(`${name} function deployed; unsigned sends denied:`, res.status);
}
