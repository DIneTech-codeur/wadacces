export const CATEGORY_ICONS: Record<string, string> = {
  "Écrans": "📱",
  Ecrans: "📱",
  Chargeurs: "🔌",
  "Câbles": "🔗",
  Cables: "🔗",
  "Écouteurs": "🎧",
  Ecouteurs: "🎧",
  Powerbanks: "🔋",
  Batteries: "⚡",
  Coques: "🛡️",
  Pochettes: "👝",
  "Vitres / incassables": "🪟",
  Vitres: "🪟",
  Adaptateurs: "🔌",
  Supports: "📲",
  Bluetooth: "📡",
  "Autres accessoires": "📦",
};

export function categoryIcon(name?: string | null): string {
  if (!name) return "📦";
  if (CATEGORY_ICONS[name]) return CATEGORY_ICONS[name];
  const found = Object.entries(CATEGORY_ICONS).find(([k]) =>
    name.toLowerCase().includes(k.toLowerCase())
  );
  return found ? found[1] : "📦";
}
