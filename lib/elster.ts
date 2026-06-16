/**
 * Mapping von EÜR-Kategorien auf die offiziellen Kennzahlen/Zeilen der
 * "Anlage EÜR" (BMF-Vordruck 2025, amtlicher Datensatz nach § 60 Abs. 4
 * EStDV). Quelle: BMF-Schreiben vom 29.08.2025, Anlage EÜR 2025.
 *
 * Für Kleinunternehmer (§ 19 UStG) laufen praktisch alle Betriebs-
 * einnahmen über Zeile 12 / Kennzahl 111 — Ausnahmen sind Sonderfälle
 * wie Anlagenverkauf, private Kfz-Nutzung etc.
 */

export interface ElsterKennzahl {
  /** Amtliche Kennzahl (ELSTER-Feldcode). */
  code: string;
  /** Zeile im Formular "Anlage EÜR". */
  zeile: number;
  label: string;
  direction: "income" | "expense";
}

export const ELSTER_KENNZAHLEN: ElsterKennzahl[] = [
  // Betriebseinnahmen (Zeilen 12–22)
  {
    code: "111",
    zeile: 12,
    label: "Betriebseinnahmen als Kleinunternehmer (§ 19 UStG)",
    direction: "income",
  },
  {
    code: "102",
    zeile: 19,
    label: "Veräußerung/Entnahme von Anlagevermögen",
    direction: "income",
  },
  { code: "106", zeile: 20, label: "Private Kfz-Nutzung", direction: "income" },
  {
    code: "108",
    zeile: 21,
    label: "Sonstige Sach-, Nutzungs- und Leistungsentnahmen",
    direction: "income",
  },

  // Betriebsausgaben (Zeilen 27–71)
  {
    code: "100",
    zeile: 27,
    label: "Waren, Rohstoffe und Hilfsstoffe",
    direction: "expense",
  },
  { code: "110", zeile: 29, label: "Bezogene Fremdleistungen", direction: "expense" },
  {
    code: "120",
    zeile: 30,
    label: "Ausgaben für eigenes Personal",
    direction: "expense",
  },
  {
    code: "130",
    zeile: 33,
    label: "AfA auf bewegliche Wirtschaftsgüter",
    direction: "expense",
  },
  {
    code: "132",
    zeile: 36,
    label: "Geringwertige Wirtschaftsgüter (GWG, § 6 Abs. 2 EStG)",
    direction: "expense",
  },
  {
    code: "150",
    zeile: 39,
    label: "Miete/Pacht für Geschäftsräume",
    direction: "expense",
  },
  {
    code: "280",
    zeile: 43,
    label: "Telekommunikation (Telefon, Internet)",
    direction: "expense",
  },
  {
    code: "221",
    zeile: 44,
    label: "Übernachtungs-/Reisenebenkosten bei Geschäftsreisen",
    direction: "expense",
  },
  { code: "281", zeile: 45, label: "Fortbildungskosten", direction: "expense" },
  {
    code: "194",
    zeile: 46,
    label: "Rechts-/Steuerberatung, Buchführung",
    direction: "expense",
  },
  {
    code: "222",
    zeile: 47,
    label: "Miete/Leasing bewegliche Wirtschaftsgüter (ohne Kfz)",
    direction: "expense",
  },
  {
    code: "225",
    zeile: 48,
    label: "Erhaltungsaufwendungen (Instandhaltung, Reparatur)",
    direction: "expense",
  },
  {
    code: "223",
    zeile: 49,
    label: "Beiträge, Gebühren, Abgaben und Versicherungen",
    direction: "expense",
  },
  { code: "228", zeile: 50, label: "Laufende EDV-Kosten", direction: "expense" },
  {
    code: "229",
    zeile: 51,
    label: "Arbeitsmittel (Bürobedarf, Porto, Fachliteratur)",
    direction: "expense",
  },
  {
    code: "226",
    zeile: 52,
    label: "Abfallbeseitigung und Entsorgung",
    direction: "expense",
  },
  {
    code: "227",
    zeile: 53,
    label: "Verpackung und Transport",
    direction: "expense",
  },
  { code: "224", zeile: 54, label: "Werbekosten", direction: "expense" },
  {
    code: "232",
    zeile: 55,
    label: "Schuldzinsen (Finanzierung Anlagevermögen)",
    direction: "expense",
  },
  { code: "234", zeile: 56, label: "Übrige Schuldzinsen", direction: "expense" },
  {
    code: "183",
    zeile: 60,
    label: "Übrige unbeschränkt abziehbare Betriebsausgaben",
    direction: "expense",
  },
  { code: "144", zeile: 68, label: "Kfz-Leasingkosten", direction: "expense" },
  {
    code: "145",
    zeile: 69,
    label: "Kfz-Steuern, Versicherung, Maut",
    direction: "expense",
  },
  {
    code: "146",
    zeile: 70,
    label: "Sonstige Fahrtkosten (Reparatur, Treibstoff, ÖPNV)",
    direction: "expense",
  },
  {
    code: "147",
    zeile: 71,
    label: "Fahrtkosten privates Fahrzeug (Kilometerpauschale)",
    direction: "expense",
  },
];

const BY_CODE = new Map(ELSTER_KENNZAHLEN.map((k) => [k.code, k]));

export function findKennzahl(code: string | null | undefined): ElsterKennzahl | null {
  if (!code) return null;
  return BY_CODE.get(code) ?? null;
}

export function kennzahlOptions(direction: "income" | "expense"): ElsterKennzahl[] {
  return ELSTER_KENNZAHLEN.filter((k) => k.direction === direction).sort(
    (a, b) => a.zeile - b.zeile,
  );
}

/** Sinnvolle Standardzuordnung für die Seed-Kategorien (Name → Kennzahl-Code). */
export const DEFAULT_CATEGORY_KENNZAHL: Record<string, string> = {
  "Verkauf Teile (Shopify)": "111",
  "Verkauf Auftragsfertigung": "111",
  "Sonstige Einnahmen": "111",
  "Material / Wareneinkauf": "100",
  Verpackung: "227",
  Versand: "227",
  "Werkzeug / Kleingeräte (GWG)": "132",
  "Software / Lizenzen": "228",
  Marketing: "224",
  Bürokosten: "229",
  Reisekosten: "147",
  "Abschreibung (AfA)": "130",
};
