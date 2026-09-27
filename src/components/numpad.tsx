"use client";

export function Numpad({
  onDigit,
  onBackspace,
  onOk,
}: {
  onDigit: (d: string) => void;
  onBackspace: () => void;
  onOk?: () => void;
}) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", onOk ? "OK" : ""];
  return (
    <div className="grid grid-cols-3 gap-2">
      {keys.map((k) => {
        if (!k) return <div key="empty" />;
        const isBack = k === "⌫";
        const isOk = k === "OK";
        return (
          <button
            key={k}
            type="button"
            onClick={() => {
              if (isBack) onBackspace();
              else if (isOk) onOk?.();
              else onDigit(k);
            }}
            className={`flex h-16 items-center justify-center rounded-2xl text-3xl font-black shadow-sm active:scale-95 ${
              isOk
                ? "bg-green-600 text-white"
                : isBack
                ? "bg-red-100 text-red-700"
                : "bg-white text-slate-900"
            }`}
          >
            {k}
          </button>
        );
      })}
    </div>
  );
}
