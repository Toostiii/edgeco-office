import { describe, it, expect } from "vitest";
import { parseDurationToMinutes } from "./time";

describe("parseDurationToMinutes", () => {
  it("parst Stunden:Minuten-Format", () => {
    expect(parseDurationToMinutes("1:30")).toBe(90);
    expect(parseDurationToMinutes("0:45")).toBe(45);
    expect(parseDurationToMinutes("2:00")).toBe(120);
  });

  it("parst Dezimalstunden mit Komma oder Punkt", () => {
    expect(parseDurationToMinutes("1,5")).toBe(90);
    expect(parseDurationToMinutes("1.5")).toBe(90);
    expect(parseDurationToMinutes("0.25")).toBe(15);
  });

  it("gibt null für ungültige Eingaben zurück", () => {
    expect(parseDurationToMinutes("")).toBeNull();
    expect(parseDurationToMinutes("abc")).toBeNull();
    expect(parseDurationToMinutes("-1")).toBeNull();
  });
});
