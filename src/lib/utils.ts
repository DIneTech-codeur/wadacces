export function formatCurrency(amount: number | string | null | undefined, currency = "FCFA"): string {
  if (amount === null || amount === undefined || amount === "") return `0 ${currency}`;
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return `0 ${currency}`;
  const formatted = new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(num);
  return `${formatted} ${currency}`;
}

export function formatNumber(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === "") return "0";
  const num = typeof n === "string" ? parseFloat(n) : n;
  if (isNaN(num)) return "0";
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function generateNumber(prefix: string, id: number): string {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${prefix}-${y}${m}${d}-${String(id).padStart(6, "0")}`;
}

export function generateLocalId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `local_${crypto.randomUUID()}`;
  }
  return `local_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function getDeviceId(): string {
  if (typeof window === "undefined") return "server";
  let deviceId = localStorage.getItem("device_id");
  if (!deviceId) {
    deviceId = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem("device_id", deviceId);
  }
  return deviceId;
}

export function classNames(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

export { classNames as cn };

export function toNumber(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return isNaN(n) ? 0 : n;
}

export function round(n: number, decimals = 0): number {
  const factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
}

/**
 * Speak a message using SpeechSynthesis if available.
 */
export function speak(message: string, enabled: boolean): void {
  if (!enabled || typeof window === "undefined") return;
  if (!("speechSynthesis" in window)) return;
  try {
    const utter = new SpeechSynthesisUtterance(message);
    utter.lang = "fr-FR";
    utter.rate = 1;
    utter.volume = 1;
    window.speechSynthesis.speak(utter);
  } catch {
    // ignore
  }
}

export function playBeep(frequency = 800, duration = 120): void {
  if (typeof window === "undefined") return;
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = frequency;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration / 1000);
  } catch {
    // ignore
  }
}
