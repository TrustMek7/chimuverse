import { DateTime } from "luxon";
import { rrulestr, type RRuleSet } from "rrule";
import type { CalendarEvent } from "./types";
export const weekDays = [
  ["MO", "Lunes"],
  ["TU", "Martes"],
  ["WE", "Miércoles"],
  ["TH", "Jueves"],
  ["FR", "Viernes"],
  ["SA", "Sábado"],
  ["SU", "Domingo"],
] as const;
export type RepeatDraft = {
  frequency: "none" | "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY" | "custom";
  interval: number;
  days: string[];
  end: "never" | "until" | "count";
  until: string;
  count: number;
};
export const blankRepeat = (): RepeatDraft => ({
  frequency: "none",
  interval: 1,
  days: [],
  end: "never",
  until: "",
  count: 10,
});
export function parseRepeat(
  event: Pick<CalendarEvent, "recurrence" | "annual" | "recurrence_timezone">,
): RepeatDraft {
  const result = blankRepeat();
  const lines = event.recurrence ?? (event.annual ? ["RRULE:FREQ=YEARLY"] : []);
  if (!lines.length) return result;
  if (lines.length !== 1 || !lines[0].startsWith("RRULE:"))
    return { ...result, frequency: "custom" };
  const props = Object.fromEntries(
    lines[0]
      .slice(6)
      .split(";")
      .map((p) => p.split("=")),
  ) as Record<string, string>;
  if (
    !["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(props.FREQ) ||
    Object.keys(props).some(
      (k) =>
        !["FREQ", "INTERVAL", "BYDAY", "UNTIL", "COUNT", "WKST"].includes(k),
    ) ||
    props.BYDAY?.split(",").some((d) => !weekDays.some(([code]) => code === d))
  )
    return { ...result, frequency: "custom" };
  result.frequency = props.FREQ as RepeatDraft["frequency"];
  result.interval = Number(props.INTERVAL ?? 1);
  result.days = props.BYDAY?.split(",") ?? [];
  if (props.UNTIL) {
    result.end = "until";
    result.until = props.UNTIL.endsWith("Z")
      ? (DateTime.fromFormat(props.UNTIL, "yyyyMMdd'T'HHmmss'Z'", {
          zone: "utc",
        })
          .setZone(event.recurrence_timezone ?? "America/Lima")
          .toISODate() ?? "")
      : props.UNTIL.slice(0, 4) +
        "-" +
        props.UNTIL.slice(4, 6) +
        "-" +
        props.UNTIL.slice(6, 8);
  }
  if (props.COUNT) {
    result.end = "count";
    result.count = Number(props.COUNT);
  }
  return result;
}
export function makeRecurrence(
  draft: RepeatDraft,
  start: string,
  zone: string,
  allDay = false,
  preserve: string[] = [],
): string[] {
  if (draft.frequency === "none") return [];
  if (draft.frequency === "custom") return preserve;
  if (
    !Number.isInteger(draft.interval) ||
    draft.interval < 1 ||
    draft.interval > 99
  )
    throw new Error("El intervalo debe estar entre 1 y 99.");
  const rule = ["FREQ=" + draft.frequency, "INTERVAL=" + draft.interval];
  if (draft.frequency === "WEEKLY") {
    const days = weekDays
      .filter(([code]) => draft.days.includes(code))
      .map(([code]) => code);
    if (!days.length) throw new Error("Elige al menos un día de la semana.");
    rule.push("BYDAY=" + days.join(","));
  }
  if (draft.end === "until") {
    const date = DateTime.fromISO(draft.until, { zone });
    if (!date.isValid || draft.until < start.slice(0, 10))
      throw new Error("La fecha final debe ser igual o posterior al comienzo.");
    rule.push(
      "UNTIL=" +
        (allDay
          ? date.toFormat("yyyyMMdd")
          : date.endOf("day").toUTC().toFormat("yyyyMMdd'T'HHmmss'Z'")),
    );
  }
  if (draft.end === "count") {
    if (
      !Number.isInteger(draft.count) ||
      draft.count < 1 ||
      draft.count > 10000
    )
      throw new Error("El número de repeticiones debe estar entre 1 y 10000.");
    rule.push("COUNT=" + draft.count);
  }
  return ["RRULE:" + rule.join(";")];
}
export function recurrenceText(
  event: Pick<CalendarEvent, "recurrence" | "annual">,
) {
  const r = parseRepeat(event);
  if (r.frequency === "none") return "No se repite";
  if (r.frequency === "custom")
    return "Serie con repetición personalizada de Google";
  const unit = {
    DAILY: "día",
    WEEKLY: "semana",
    MONTHLY: "mes",
    YEARLY: "año",
  }[r.frequency];
  let text = `Cada ${r.interval === 1 ? "" : r.interval + " "}${unit}${r.interval === 1 ? "" : r.frequency === "MONTHLY" ? "es" : "s"}`;
  if (r.frequency === "WEEKLY" && r.days.length)
    text +=
      " · " +
      weekDays
        .filter(([c]) => r.days.includes(c))
        .map(([, name]) => name)
        .join(", ");
  return (
    text +
    (r.end === "never"
      ? " · sin fecha límite"
      : r.end === "count"
        ? ` · ${r.count} repeticiones`
        : " · hasta " + r.until)
  );
}
export function recurrenceString(
  event: Pick<
    CalendarEvent,
    "start_at" | "recurrence" | "recurrence_timezone" | "annual" | "all_day"
  >,
) {
  const lines = event.recurrence ?? (event.annual ? ["RRULE:FREQ=YEARLY"] : []);
  if (!lines.length) return "";
  const date = DateTime.fromISO(event.start_at, {
    zone: event.recurrence_timezone ?? "America/Lima",
  });
  const start = event.all_day
    ? "DTSTART:" + date.toUTC().toFormat("yyyyMMdd'T'000000")
    : `DTSTART;TZID=${date.zoneName}:` + date.toFormat("yyyyMMdd'T'HHmmss");
  return [start, ...lines].join("\n");
}
export function nextSeriesOccurrence<
  T extends {
    start_at: string;
    end_at: string;
    annual: boolean;
    recurrence?: string[];
    recurrence_timezone?: string;
    all_day?: boolean;
  },
>(event: T, now = new Date()): T {
  if (!recurrenceString({ ...event, all_day: event.all_day ?? false }))
    return event;
  try {
    const zone = event.all_day
      ? "UTC"
      : (event.recurrence_timezone ?? "America/Lima");
    const duration =
      new Date(event.end_at).getTime() - new Date(event.start_at).getTime();
    const date = floatingSet(event).after(
      toFloating(new Date(now.getTime() - duration), zone),
      true,
    );
    if (!date) return event;
    const start = fromFloating(date, zone);
    return {
      ...event,
      start_at: start.toISOString(),
      end_at: new Date(start.getTime() + duration).toISOString(),
    };
  } catch {
    return event;
  }
}
type Series = Pick<
  CalendarEvent,
  "start_at" | "end_at" | "annual" | "recurrence" | "recurrence_timezone"
> & { all_day?: boolean };
const toFloating = (date: Date, zone: string) =>
  DateTime.fromJSDate(date, { zone })
    .setZone("UTC", { keepLocalTime: true })
    .toJSDate();
const fromFloating = (date: Date, zone: string) =>
  DateTime.fromJSDate(date, { zone: "UTC" })
    .setZone(zone, { keepLocalTime: true })
    .toJSDate();
function floatingSet(event: Series): RRuleSet {
  const zone = event.all_day
    ? "UTC"
    : (event.recurrence_timezone ?? "America/Lima");
  const start = DateTime.fromJSDate(new Date(event.start_at), {
    zone,
  }).toFormat("yyyyMMdd'T'HHmmss");
  const lines = (
    event.recurrence ?? (event.annual ? ["RRULE:FREQ=YEARLY"] : [])
  ).map((line) => {
    if (line.startsWith("RRULE:") || line.startsWith("EXRULE:")) {
      if (!/FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)(;|$)/.test(line))
        throw new Error("Frecuencia no compatible");
      return line.replace(
        /UNTIL=(\d{8}T\d{6}Z)/,
        (_, value) =>
          "UNTIL=" +
          DateTime.fromFormat(value, "yyyyMMdd'T'HHmmss'Z'", { zone: "UTC" })
            .setZone(zone)
            .toFormat("yyyyMMdd'T'HHmmss"),
      );
    }
    const [prefix, values] = line.split(":");
    const inputZone = prefix.match(/TZID=([^;]+)/)?.[1] ?? zone;
    return (
      prefix.split(";")[0] +
      ":" +
      values
        .split(",")
        .map((v) =>
          DateTime.fromFormat(
            v,
            v.length === 8
              ? "yyyyMMdd"
              : v.endsWith("Z")
                ? "yyyyMMdd'T'HHmmss'Z'"
                : "yyyyMMdd'T'HHmmss",
            { zone: v.endsWith("Z") ? "UTC" : inputZone },
          )
            .setZone(zone)
            .toFormat("yyyyMMdd'T'HHmmss"),
        )
        .join(",")
    );
  });
  return rrulestr(["DTSTART:" + start, ...lines].join("\n"), {
    forceset: true,
  }) as RRuleSet;
}
export function seriesOccurrences(
  event: Series,
  from: Date,
  to: Date,
  excluded: string[] = [],
) {
  const duration =
    new Date(event.end_at).getTime() - new Date(event.start_at).getTime();
  if (!recurrenceString({ ...event, all_day: event.all_day ?? false }))
    return [
      { start: new Date(event.start_at), end: new Date(event.end_at) },
    ].filter((o) => o.start < to && o.end > from);
  try {
    const zone = event.all_day
      ? "UTC"
      : (event.recurrence_timezone ?? "America/Lima");
    const rule = floatingSet(event);
    excluded.forEach((value) => rule.exdate(toFloating(new Date(value), zone)));
    return rule
      .between(
        toFloating(new Date(from.getTime() - duration), zone),
        toFloating(to, zone),
        true,
        (_date, i) => i < 2000,
      )
      .map((date) => {
        const start = fromFloating(date, zone);
        return { start, end: new Date(start.getTime() + duration) };
      })
      .filter((o) => o.start < to && o.end > from);
  } catch {
    return [];
  }
}
