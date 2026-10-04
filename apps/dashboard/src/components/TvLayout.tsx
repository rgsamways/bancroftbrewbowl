import { useEffect, useState, type ReactNode } from "react";

const WIDTH = 1280;
const HEIGHT = 720;

function fitScale() {
  return Math.min(window.innerWidth / WIDTH, window.innerHeight / HEIGHT);
}

/** A fixed 16:9 canvas (1280 by 720) scaled to fill whatever screen it is on, with no header or
 * tabs. Everything inside is laid out once at TV size. */
export function TvLayout({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState(fitScale);
  useEffect(() => {
    const onResize = () => setScale(fitScale());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden bg-brand-bg">
      <div
        data-testid="tv-canvas"
        className="absolute left-1/2 top-1/2 grid overflow-hidden bg-brand-bg"
        style={{
          width: WIDTH,
          height: HEIGHT,
          gridTemplateColumns: "480px 1fr",
          transform: `translate(-50%, -50%) scale(${scale})`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
