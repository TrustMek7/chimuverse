import { describe, it, expect } from "vitest";
import {
  blankRepeat,
  makeRecurrence,
  parseRepeat,
  seriesOccurrences,
} from "./recurrence";
const event = {
  start_at: "2026-11-16T14:00:00Z",
  end_at: "2026-11-16T15:00:00Z",
  annual: false,
  all_day: false,
  recurrence_timezone: "America/Lima",
  recurrence: [] as string[],
};
describe("calendar series", () => {
  it("keeps selected weekdays and includes the final local day", () => {
    const recurrence = makeRecurrence(
      {
        ...blankRepeat(),
        frequency: "WEEKLY",
        days: ["MO", "WE"],
        end: "until",
        until: "2026-11-25",
      },
      "2026-11-16T09:00",
      "America/Lima",
    );
    expect(recurrence[0]).toContain("BYDAY=MO,WE");
    expect(parseRepeat({ ...event, recurrence }).until).toBe("2026-11-25");
    const occurrences = seriesOccurrences(
      { ...event, recurrence },
      new Date("2026-11-01"),
      new Date("2026-12-01"),
    );
    expect(occurrences.map((o) => o.start.toISOString().slice(0, 10))).toEqual([
      "2026-11-16",
      "2026-11-18",
      "2026-11-23",
      "2026-11-25",
    ]);
  });
  it("stores an unlimited series as one rule and expands only the visible range", () => {
    const recurrence = makeRecurrence(
      { ...blankRepeat(), frequency: "WEEKLY", days: ["MO"] },
      "2026-11-16T09:00",
      "America/Lima",
    );
    expect(recurrence[0]).not.toMatch(/UNTIL|COUNT/);
    const occurrences = seriesOccurrences(
      { ...event, recurrence },
      new Date("2030-01-01"),
      new Date("2030-02-01"),
    );
    expect(occurrences).toHaveLength(4);
    expect(occurrences.every((o) => o.start.getUTCHours() === 14)).toBe(true);
  });
  it("retains local time across daylight saving changes", () => {
    const e = {
      ...event,
      start_at: "2026-03-02T14:00:00Z",
      end_at: "2026-03-02T15:00:00Z",
      recurrence_timezone: "America/New_York",
      recurrence: ["RRULE:FREQ=WEEKLY;BYDAY=MO"],
    };
    const dates = seriesOccurrences(
      e,
      new Date("2026-03-01"),
      new Date("2026-03-17"),
    ).map((o) => o.start.toISOString());
    expect(dates).toEqual([
      "2026-03-02T14:00:00.000Z",
      "2026-03-09T13:00:00.000Z",
      "2026-03-16T13:00:00.000Z",
    ]);
  });
  it("excludes cancelled or moved Google occurrences without duplicating them", () => {
    const e = { ...event, recurrence: ["RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=3"] };
    const dates = seriesOccurrences(
      e,
      new Date("2026-11-01"),
      new Date("2026-12-01"),
      ["2026-11-23T14:00:00Z"],
    ).map((o) => o.start.toISOString().slice(0, 10));
    expect(dates).toEqual(["2026-11-16", "2026-11-30"]);
  });
  it("validates missing weekdays and invalid end dates", () => {
    expect(() =>
      makeRecurrence(
        { ...blankRepeat(), frequency: "WEEKLY" },
        "2026-11-16T09:00",
        "America/Lima",
      ),
    ).toThrow("al menos");
    expect(() =>
      makeRecurrence(
        {
          ...blankRepeat(),
          frequency: "DAILY",
          end: "until",
          until: "2026-11-01",
        },
        "2026-11-16T09:00",
        "America/Lima",
      ),
    ).toThrow("posterior");
  });
});
