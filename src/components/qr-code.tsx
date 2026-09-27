"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";

/**
 * Affiche un vrai QR code scannable (PNG data URL) généré côté navigateur.
 * La valeur encodée est le code-barres du produit, ce qui permet au scanner
 * caméra de retrouver le produit exactement comme avec un code-barres.
 */
export function QrCode({
  value,
  size = 128,
  className = "",
  alt = "QR code",
}: {
  value: string;
  size?: number;
  className?: string;
  alt?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!value) {
      setSrc(null);
      return;
    }
    QRCode.toDataURL(value, {
      width: size * 2,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#000000", light: "#FFFFFF" },
    })
      .then((url) => {
        if (!cancelled) setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setSrc(null);
      });
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (!src) {
    return (
      <div
        className={`flex items-center justify-center rounded bg-slate-100 text-[10px] text-slate-400 ${className}`}
        style={{ width: size, height: size }}
      >
        …
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} width={size} height={size} className={className} />
  );
}

/** Télécharge le QR code d'un produit en PNG haute résolution. */
export async function downloadQrPng(value: string, filename: string) {
  const url = await QRCode.toDataURL(value, {
    width: 1024,
    margin: 2,
    errorCorrectionLevel: "M",
  });
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
}
