import { describe, it, expect } from "vitest";
import { localDay, csv, safeLink, formatDate, nextOccurrence } from "./utils";
describe("private data exports and calendar boundaries", () => {
  it("rolls special annual dates forward and retains event duration", () => {
    const event = {
      start_at: "2020-12-20T00:00:00Z",
      end_at: "2020-12-21T00:00:00Z",
      annual: true,
    };
    const next = nextOccurrence(event, new Date("2026-12-25T00:00:00Z"));
    expect(next.start_at).toBe("2027-12-20T00:00:00.000Z");
    expect(next.end_at).toBe("2027-12-21T00:00:00.000Z");
  });
  it("keeps the Lima day when UTC has already advanced", () => {
    expect(localDay(new Date("2026-11-14T02:00:00Z"), "America/Lima")).toBe(
      "2026-11-13",
    );
  });
  it("displays date-only memories without shifting to the previous day", () => {
    expect(formatDate("2026-11-13")).toContain("13");
  });
  it("escapes CSV quotes, newlines and spreadsheet formulas", () => {
    const text = csv([
      { title: "=SUM(A1:A2)", note: 'dijo "hola"\notra línea' },
    ]);
    expect(text).toContain('"\'=SUM(A1:A2)"');
    expect(text).toContain('dijo ""hola""\notra línea');
  });
  it("never allows script or insecure protocols in external links", () => {
    expect(safeLink("javascript:alert(1)")).toBeNull();
    expect(safeLink("http://example.com")).toBeNull();
    expect(safeLink("https://open.spotify.com/track/test")).toBe(
      "https://open.spotify.com/track/test",
    );
  });
});
