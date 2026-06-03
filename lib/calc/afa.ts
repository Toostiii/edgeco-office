/**
 * Lineare Abschreibung (AfA) für Anlagevermögen, §7 Abs. 1 EStG.
 *
 * Anschaffungen über 800 € (netto) werden nicht sofort als Ausgabe abgesetzt,
 * sondern linear über die Nutzungsdauer abgeschrieben — **monatsgenau**
 * (pro rata temporis) im Anschaffungs- und im letzten Jahr.
 *
 * Alle Beträge in **Cent (Integer)**.
 */

export interface Asset {
  /** Anschaffungsdatum yyyy-mm-dd */
  purchaseDate: string;
  /** Anschaffungskosten (netto) in Cent */
  cost: number;
  /** Nutzungsdauer in Jahren (lt. AfA-Tabelle) */
  usefulLifeYears: number;
}

export interface DepreciationEntry {
  year: number;
  /** AfA-Betrag dieses Jahres in Cent */
  amount: number;
  /** Restbuchwert am Jahresende in Cent */
  bookValueEnd: number;
}

/**
 * Erzeugt den vollständigen AfA-Plan. Die Summe aller `amount` entspricht
 * exakt den Anschaffungskosten (Rundungsdifferenzen landen im letzten Jahr).
 */
export function depreciationSchedule(asset: Asset): DepreciationEntry[] {
  const { cost, usefulLifeYears } = asset;
  if (cost <= 0 || usefulLifeYears <= 0) return [];

  const purchaseYear = Number(asset.purchaseDate.slice(0, 4));
  const purchaseMonth = Number(asset.purchaseDate.slice(5, 7)); // 1–12
  const totalMonths = usefulLifeYears * 12;
  const monthlyRate = cost / totalMonths;

  const entries: DepreciationEntry[] = [];
  let remainingMonths = totalMonths;
  let cumulative = 0;
  let year = purchaseYear;
  // Im Anschaffungsjahr nur die Monate ab Kaufmonat (inkl.).
  let monthsThisYear = 12 - purchaseMonth + 1;

  while (remainingMonths > 0) {
    const active = Math.min(monthsThisYear, remainingMonths);
    remainingMonths -= active;

    // Letztes aktives Jahr absorbiert Rundungsdifferenzen → Summe == cost.
    const amount =
      remainingMonths === 0
        ? cost - cumulative
        : Math.round(monthlyRate * active);

    cumulative += amount;
    entries.push({ year, amount, bookValueEnd: cost - cumulative });

    year += 1;
    monthsThisYear = 12; // alle Folgejahre voll
  }

  return entries;
}

/** AfA-Betrag für ein einzelnes Jahr (Cent); 0 außerhalb der Nutzungsdauer. */
export function depreciationForYear(asset: Asset, year: number): number {
  const entry = depreciationSchedule(asset).find((e) => e.year === year);
  return entry ? entry.amount : 0;
}

/** Voller Jahresbetrag bei ganzjähriger Abschreibung (cost / Jahre), Cent. */
export function annualFullDepreciation(asset: Asset): number {
  if (asset.usefulLifeYears <= 0) return 0;
  return Math.round(asset.cost / asset.usefulLifeYears);
}
