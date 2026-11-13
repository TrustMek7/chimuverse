import { readFileSync, writeFileSync } from "node:fs";
const envPath = new URL("../.env", import.meta.url);
const web = JSON.parse(
  readFileSync(
    new URL("../.env.youtube-oauth.json", import.meta.url),
    "utf8",
  ).replace(/^\uFEFF/, ""),
).web;
if (
  !web?.client_id?.endsWith(".apps.googleusercontent.com") ||
  typeof web.client_secret !== "string" ||
  web.client_secret.length < 10
)
  throw new Error("Se necesita un cliente OAuth de aplicación web.");
let content = readFileSync(envPath, "utf8");
const url = content.match(/^SUPABASE_URL=(.+)$/m)?.[1].trim();
if (!url || !web.redirect_uris?.includes(url + "/functions/v1/youtube"))
  throw new Error(
    "Añade la URI SUPABASE_URL/functions/v1/youtube en el cliente OAuth y vuelve a descargar el JSON.",
  );
for (const [key, value] of Object.entries({
  YOUTUBE_OAUTH_CLIENT_ID: web.client_id,
  YOUTUBE_OAUTH_CLIENT_SECRET: web.client_secret,
})) {
  if (/[\r\n]/.test(value)) throw new Error("Credencial no válida.");
  const pattern = new RegExp("^" + key + "=.*$", "m");
  content = pattern.test(content)
    ? content.replace(pattern, () => key + "=" + value)
    : content.trimEnd() + "\n" + key + "=" + value + "\n";
}
writeFileSync(envPath, content, { encoding: "utf8" });
console.log(
  "Credenciales de YouTube importadas sin mostrar valores. Ejecuta deploy:all para configurar el servidor.",
);
