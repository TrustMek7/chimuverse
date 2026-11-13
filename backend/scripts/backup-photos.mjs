// Encrypted, incremental copy of the photo album (Storage), which `npm run backup` does not include.
//   npm run backup:photos            → downloads new photos into backend/backups/photos/
//   npm run backup:photos -- --restore <folder>   → decrypts every copy into <folder> as .webp
// Each photo is encrypted with BACKUP_ENCRYPTION_KEY (AES-256-GCM); backups/ is ignored by Git.
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  appendFileSync,
} from "node:fs";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const envPath = new URL("../.env", import.meta.url);
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, "")];
    }),
);
if (!env.BACKUP_ENCRYPTION_KEY) {
  env.BACKUP_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  appendFileSync(envPath, `\nBACKUP_ENCRYPTION_KEY=${env.BACKUP_ENCRYPTION_KEY}\n`);
}
const key = Buffer.from(env.BACKUP_ENCRYPTION_KEY, "base64");
const dir = new URL("../backups/photos/", import.meta.url);
mkdirSync(dir, { recursive: true });

function seal(buf) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([c.update(buf), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), data]);
}
function open(buf) {
  const d = createDecipheriv("aes-256-gcm", key, buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([d.update(buf.subarray(28)), d.final()]);
}

const restore = process.argv.indexOf("--restore");
if (restore !== -1) {
  const out = process.argv[restore + 1];
  if (!out) throw new Error("Indica la carpeta: --restore <carpeta>");
  mkdirSync(out, { recursive: true });
  const files = readdirSync(dir).filter((f) => f.endsWith(".webp.aes"));
  for (const f of files)
    writeFileSync(`${out}/${f.replace(/\.aes$/, "")}`, open(readFileSync(new URL(f, dir))));
  console.log(JSON.stringify({ restored: files.length, folder: out }));
  process.exit(0);
}

const ref = new URL(env.SUPABASE_URL).hostname.split(".")[0];
async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, read_only: true }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`Administración devolvió ${res.status}`);
  return res.json();
}
try {
  // Trashed photos are copied too: they can still be restored from the trash.
  const photos = await sql("select id,storage_path from public.photos order by uploaded_at");
  let copied = 0, kept = 0;
  const failed = [];
  for (const p of photos) {
    if (!/^[0-9a-f-]{36}$/.test(p.id)) continue;
    const target = new URL(`${p.id}.webp.aes`, dir);
    if (existsSync(target)) {
      kept++;
      continue;
    }
    const res = await fetch(
      `${env.SUPABASE_URL}/storage/v1/object/photos/${p.storage_path.split("/").map(encodeURIComponent).join("/")}`,
      { headers: { Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`, apikey: env.SUPABASE_SECRET_KEY }, signal: AbortSignal.timeout(60000) },
    );
    if (!res.ok) {
      failed.push(p.id);
      continue;
    }
    writeFileSync(target, seal(Buffer.from(await res.arrayBuffer())));
    copied++;
  }
  console.log(JSON.stringify({ photos: photos.length, copied, alreadyBackedUp: kept, failed: failed.length, folder: "backend/backups/photos/" }));
  if (failed.length) process.exit(1);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
