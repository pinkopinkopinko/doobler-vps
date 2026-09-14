import type { ReactNode } from "react";

const GRADIENT_BG =
  "linear-gradient(155deg,rgba(232,124,189,0.7) 0%,rgba(186,135,224,0.7) 30%,rgba(135,148,232,0.7) 65%,rgba(118,148,238,0.7) 100%),#fff";

const SPIN_KEYFRAMES = "@keyframes dubler-splash-spin{to{transform:rotate(360deg)}}";

export function SplashGradient({ children }: { children: ReactNode }) {
  return (
    <div
      className="mx-auto relative flex min-h-screen w-full max-w-[430px] flex-col"
      // Splash намеренно одно-темный: брендовый светлый градиент с тёмным
      // текстом, тема Telegram сюда не доезжает (это loading-экран до
      // bootstrap'а). theme-color-disable-line
      style={{ background: GRADIENT_BG, color: "#15131c" }}
    >
      <style>{SPIN_KEYFRAMES}</style>
      {children}
    </div>
  );
}

export function BrandMark({ size = 112, opacity = 0.65 }: { size?: number; opacity?: number }) {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.286),
        opacity,
        backgroundImage: "url('/logo.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        boxShadow:
          "0 0 0 1px rgba(255,255,255,0.6) inset, 0 4px 12px rgba(20, 27, 33, 0.12)",
      }}
    />
  );
}

export function SplashSpinner() {
  return (
    <div
      style={{
        width: 24,
        height: 24,
        border: "3px solid rgba(21,19,28,0.18)",
        borderTopColor: "#15131c",
        borderRadius: "50%",
        animation: "dubler-splash-spin 0.8s linear infinite",
      }}
    />
  );
}

export function SplashFrame({ bottomSlot }: { bottomSlot?: ReactNode }) {
  return (
    <SplashGradient>
      <div className="flex flex-1 items-center justify-center">
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 18,
          }}
        >
          <BrandMark />
          <div
            style={{
              fontSize: 46,
              fontWeight: 600,
              letterSpacing: "-0.05em",
              lineHeight: 1,
            }}
          >
            Дублер
          </div>
          <div
            style={{
              fontSize: 14,
              opacity: 0.85,
              textAlign: "center",
              maxWidth: 260,
              padding: "0 16px",
            }}
          >
            Сервис подмен и смен для ПВЗ Ozon, WB и Яндекс Маркета
          </div>
        </div>
      </div>

      {bottomSlot ? (
        <div
          style={{
            position: "absolute",
            bottom: "calc(60px + env(safe-area-inset-bottom, 0px))",
            left: 0,
            right: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
          }}
        >
          {bottomSlot}
        </div>
      ) : null}
    </SplashGradient>
  );
}
