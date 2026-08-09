import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import { X } from "lucide-react";
import { useRightPanel } from "./RightPanelContext";
import { getPageHelp } from "../lib/nav";

const MIN_WIDTH = 280;
const MAX_WIDTH = 640;
const DEFAULT_WIDTH = 384;
const STORAGE_KEY = "bbb-right-panel-width";

function getStoredWidth() {
  const stored = Number(localStorage.getItem(STORAGE_KEY));
  return stored >= MIN_WIDTH && stored <= MAX_WIDTH ? stored : DEFAULT_WIDTH;
}

// Shows contextual help for whichever page is currently open, via the "?"
// button in the mobile top bar. On laptop the left edge is a drag handle
// that resizes the column (width is remembered in localStorage); on mobile
// it's a full-screen drawer.
export function RightPanel() {
  const { open, setOpen } = useRightPanel();
  const { pathname } = useLocation();
  const help = getPageHelp(pathname);
  const [width, setWidth] = useState(getStoredWidth);
  const widthRef = useRef(width);
  const draggingRef = useRef(false);

  useEffect(() => {
    widthRef.current = width;
  }, [width]);

  const handlePointerMove = useCallback((event: PointerEvent) => {
    if (!draggingRef.current) return;
    const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, window.innerWidth - event.clientX));
    setWidth(next);
  }, []);

  const stopDragging = useCallback(() => {
    draggingRef.current = false;
    document.body.style.removeProperty("cursor");
    document.body.style.removeProperty("user-select");
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", stopDragging);
    localStorage.setItem(STORAGE_KEY, String(widthRef.current));
  }, [handlePointerMove]);

  function startDragging(event: React.PointerEvent) {
    event.preventDefault();
    draggingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopDragging);
  }

  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopDragging);
    };
  }, [handlePointerMove, stopDragging]);

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setOpen(false)} />}

      <aside
        style={{ "--right-panel-width": `${width}px` } as React.CSSProperties}
        className={`fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-brand-border bg-brand-surface transition-transform duration-200 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        } lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:w-[var(--right-panel-width)] lg:translate-x-0`}
      >
        <div
          onPointerDown={startDragging}
          className="absolute inset-y-0 left-0 z-10 hidden w-1.5 -translate-x-1/2 cursor-col-resize touch-none items-center justify-center lg:flex hover:bg-brand-accent/30 active:bg-brand-accent/50"
        >
          <div className="h-10 w-1 rounded-full bg-brand-border" />
        </div>

        <div className="flex h-16 shrink-0 items-center justify-end border-b border-brand-border px-4">
          <button
            onClick={() => setOpen(false)}
            aria-label="Close panel"
            className="text-brand-muted hover:text-brand-text lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {help && (
            <>
              <h2 className="mb-2 font-display text-sm font-semibold uppercase tracking-wide text-brand-muted">
                {help.title}
              </h2>
              <p className="text-sm text-brand-text">{help.body}</p>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
