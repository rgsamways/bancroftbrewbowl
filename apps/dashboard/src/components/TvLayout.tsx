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

export const STRIP_HEIGHT = 56;

/** The canvas for a TV screen: the same 1280 by 720 scaled stage, with the slide in the top 664
 * pixels and an optional thin strip along the bottom (the "Play on your phone" strip). */
export function TvStage({ children, strip }: { children: ReactNode; strip?: ReactNode }) {
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
        className="absolute left-1/2 top-1/2 overflow-hidden bg-brand-bg"
        style={{ width: WIDTH, height: HEIGHT, transform: `translate(-50%, -50%) scale(${scale})` }}
      >
        <div data-testid="tv-slide" className="overflow-hidden" style={{ height: HEIGHT - (strip ? STRIP_HEIGHT : 0) }}>
          {children}
        </div>
        {strip && (
          <div data-testid="tv-strip" className="flex items-center gap-4 border-t border-brand-border bg-brand-surface px-11" style={{ height: STRIP_HEIGHT }}>
            {strip}
          </div>
        )}
      </div>
    </div>
  );
}
