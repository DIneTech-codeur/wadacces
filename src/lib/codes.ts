/**
 * Génération de codes produits.
 *
 * - Code-barres : EAN-13 valide, préfixe 200 (plage réservée à l'usage interne),
 *   avec chiffre de contrôle calculé. Scannable par douchette et par caméra.
 * - QR code : encode ce même code-barres, afin qu'un scan QR retrouve le produit
 *   exactement comme un scan de code-barres.
 */

/** Calcule la clé de contrôle EAN-13 à partir des 12 premiers chiffres. */
export function ean13CheckDigit(twelveDigits: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = Number(twelveDigits[i]);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  return (10 - (sum % 10)) % 10;
}

/** Construit un EAN-13 complet (13 chiffres) à partir d'une base numérique. */
export function buildEan13(base12: string): string {
  const padded = base12.replace(/\D/g, "").padStart(12, "0").slice(0, 12);
  return `${padded}${ean13CheckDigit(padded)}`;
}

/** Vérifie qu'une chaîne est un EAN-13 valide. */
export function isValidEan13(code: string): boolean {
  if (!/^\d{13}$/.test(code)) return false;
  return Number(code[12]) === ean13CheckDigit(code.slice(0, 12));
}

/**
 * Génère un code-barres interne unique.
 * Format : 200 + 9 chiffres (horodatage + aléa) + clé de contrôle.
 */
export function generateBarcode(): string {
  const time = Date.now().toString().slice(-7);
  const random = Math.floor(Math.random() * 100)
    .toString()
    .padStart(2, "0");
  return buildEan13(`200${time}${random}`);
}

/** Génère un SKU lisible à partir du nom du produit. */
export function generateSku(name: string, id?: number): string {
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 6)
    .padEnd(3, "X");
  const suffix = id ? String(id).padStart(4, "0") : Math.floor(1000 + Math.random() * 9000).toString();
  return `WAD-${slug}-${suffix}`;
}
