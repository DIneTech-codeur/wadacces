/**
 * Outils communs aux statistiques de performance des utilisateurs.
 */

/** Nombre de jours demandé (0 = depuis toujours). */
export function parseDays(value: string | null): number {
  const n = parseInt(value ?? "30", 10);
  if (Number.isNaN(n) || n < 0) return 30;
  return Math.min(n, 3650);
}

/** Début de la période : minuit il y a (days - 1) jours. null = sans limite. */
export function periodStart(days: number): Date | null {
  if (!days || days <= 0) return null;
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() - (days - 1));
  return start;
}

/** Les longues périodes sont regroupées par mois, les courtes par jour. */
export function isMonthlyPeriod(days: number): boolean {
  return days === 0 || days > 90;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Complète une série journalière : chaque jour de la période apparaît,
 * même sans vente (valeur 0), pour un graphique lisible.
 */
export function fillDailySeries(
  rows: Array<{ bucket: string; revenue: number; profit: number; count: number }>,
  since: Date
): Array<{ bucket: string; revenue: number; profit: number; count: number }> {
  const byKey = new Map(rows.map((r) => [r.bucket, r]));
  const out: Array<{ bucket: string; revenue: number; profit: number; count: number }> = [];
  const cursor = new Date(since);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  while (cursor <= today) {
    const key = `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}-${pad(cursor.getDate())}`;
    out.push(byKey.get(key) ?? { bucket: key, revenue: 0, profit: 0, count: 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}
