import { readFileSync } from "node:fs";
const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);
for (const [name, path] of [
  ["auth", "/auth/v1/settings"],
  ["users", "/auth/v1/admin/users?page=1&per_page=10"],
  ["schema", "/rest/v1/"],
]) {
  try {
    const res = await fetch(env.SUPABASE_URL + path, {
      headers: {
        apikey: env.SUPABASE_SECRET_KEY,
        Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
      },
    });
    const d = await res.json();
    console.log(
      name,
      JSON.stringify({
        status: res.status,
        googleEnabled: d.external?.google,
        users: d.users?.map((u) => ({
          id: u.id,
          display_name: u.user_metadata?.full_name,
        })),
        tables: d.definitions ? Object.keys(d.definitions) : undefined,
        message: d.msg ?? d.message,
      }),
    );
  } catch {
    console.log(name, "unreachable");
  }
}
