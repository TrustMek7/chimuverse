export function localDay(date = new Date(), zone = "America/Lima") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
export function formatDate(
  value: string,
  options: Intl.DateTimeFormatOptions = {},
  zone = "America/Lima",
) {
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: zone,
    day: "numeric",
    month: "long",
    ...options,
  }).format(new Date(value.length === 10 ? value + "T12:00:00-05:00" : value));
}
export const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
export const money = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(
    n,
  );
export function download(
  name: string,
  data: BlobPart,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function csv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]);
  const escape = (v: unknown) =>
    '"' +
    String(v ?? "")
      .replace(/^[=+@\-\t\r]/, "'$&")
      .replaceAll('"', '""') +
    '"';
  return [keys, ...rows.map((r) => keys.map((k) => r[k]))]
    .map((row) => row.map(escape).join(","))
    .join("\r\n");
}
export function safeLink(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}
export const statusNames: Record<string, string> = {
  pending: "Pendiente",
  progress: "En progreso",
  review: "Por verificar",
  done: "Completada",
  rejected: "Rechazada",
  in_talk: "Lo hablamos",
  archived: "Archivada",
  discarded: "Descartada",
};
export { nextSeriesOccurrence as nextOccurrence } from "./recurrence";
