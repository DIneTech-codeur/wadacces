"use client";
import { useEffect, useRef } from "react";

export function BarcodeScanner({ onDetected }: { onDetected: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        const w = window as unknown as { BarcodeDetector?: new (opts: unknown) => { detect: (el: HTMLVideoElement) => Promise<Array<{ rawValue?: string; raw?: string }>> } };
        const detector = w.BarcodeDetector
          ? new w.BarcodeDetector({
              formats: ["ean_13", "ean_8", "code_128", "code_39", "upc_a", "upc_e", "qr_code"],
            })
          : null;

        const loop = async () => {
          if (cancelled || !videoRef.current) return;
          if (detector) {
            try {
              const codes = await detector.detect(videoRef.current);
              if (codes && codes.length > 0) {
                const code = codes[0].rawValue || codes[0].raw || "";
                if (code) {
                  cleanup();
                  onDetected(String(code));
                  return;
                }
              }
            } catch {
              // keep looping
            }
          }
          rafRef.current = requestAnimationFrame(loop);
        };
        loop();
      } catch (e) {
        console.error("Camera error", e);
      }
    }

    function cleanup() {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    }

    start();
    return cleanup;
  }, [onDetected]);

  return (
    <div>
      <video ref={videoRef} className="w-full rounded-2xl bg-black" playsInline muted />
      {typeof window !== "undefined" && !("BarcodeDetector" in window) && (
        <p className="mt-2 text-center text-base font-semibold text-yellow-300">
          Utilisez le scanner USB ou tapez le code
        </p>
      )}
    </div>
  );
}
