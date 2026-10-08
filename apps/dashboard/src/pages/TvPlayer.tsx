import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { X } from "lucide-react";
import { menuPageAt, menuPagesOf, nextSlideIndex, slideDurationMs, slideHasContent, type TvFeed, type TvFeedSlide } from "@bbb/shared";
import { api, ApiError } from "../lib/api";
import { Qr } from "../components/Qr";
import { TvStage } from "../components/TvLayout";
import { MenuSlide } from "../components/tv/MenuSlide";
import { MusicSlide } from "../components/tv/MusicSlide";
import { CalendarSlide } from "../components/tv/CalendarSlide";
import { PoolTvSections } from "./PoolTv";

const REFRESH_MS = 30_000;
const TICK_MS = 250;

type Current = { id: string | null; startedAt: number };

/** Which slide is on screen. The feed can change under it (a refresh): the slide that is showing keeps
 * its place and its clock, and only moves on when its time is up, it has gone, or it has run dry. */
function useRotation(slides: TvFeedSlide[]) {
  const [now, setNow] = useState(() => Date.now());
  const [current, setCurrent] = useState<Current>(() => ({ id: null, startedAt: Date.now() }));

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const showing = current.id ? slides.find((s) => s.id === current.id) : undefined;
    if (showing && slideHasContent(showing) && now - current.startedAt < slideDurationMs(showing)) return;
    const next = nextSlideIndex(slides, showing ? current.id : null);
    const nextId = next === null ? null : slides[next]!.id;
    if (nextId !== current.id || showing) setCurrent({ id: nextId, startedAt: now });
  }, [now, slides, current]);

  const slide = current.id ? (slides.find((s) => s.id === current.id) ?? null) : null;
  return { slide, elapsedMs: Math.max(0, now - current.startedAt) };
}

function Message({ children }: { children: React.ReactNode }) {
  return <div className="grid h-full place-items-center px-16 text-center text-[34px] text-brand-muted">{children}</div>;
}

function SlideView({ slide, elapsedMs }: { slide: TvFeedSlide; elapsedMs: number }) {
  if (slide.kind === "standings") {
    return (
      <div className="grid h-full" style={{ gridTemplateColumns: "480px 1fr" }}>
        <PoolTvSections data={slide.content} showQrBlock={false} />
      </div>
    );
  }
  if (slide.kind === "music") return <MusicSlide music={slide.content} />;
  if (slide.kind === "calendar") return <CalendarSlide days={slide.content} />;
  const pages = menuPagesOf(slide);
  const index = menuPageAt(slide, elapsedMs);
  return <MenuSlide title={slide.kind === "drinks" ? "Drinks" : "Kitchen"} page={pages[index]!} pageIndex={index} pageCount={pages.length} />;
}

/** A TV: opened by its private link with no sign-in, it plays its playlist's slides in turn and
 * refreshes its content every 30 seconds. A thin strip at the bottom invites people to play. */
function Player({ feedPath }: { feedPath?: string }) {
  const { code } = useParams();
  const path = feedPath ?? `/public/tv/${encodeURIComponent(code ?? "")}`;
  const [feed, setFeed] = useState<TvFeed | null>(null);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    let live = true;
    async function load() {
      try {
        const next = await api<TvFeed>(path);
        if (live) {
          setFeed(next);
          setGone(false);
        }
      } catch (e) {
        // A reset or unknown link is final; anything else keeps the last good content and tries again.
        if (live && e instanceof ApiError && e.status === 404) setGone(true);
      }
    }
    void load();
    const timer = window.setInterval(() => void load(), REFRESH_MS);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, [path]);

  const { slide, elapsedMs } = useRotation(gone || !feed ? [] : feed.slides);

  if (gone) {
    return (
      <TvStage>
        <Message>
          <span data-testid="tv-gone">This TV link is no longer active</span>
        </Message>
      </TvStage>
    );
  }
  if (!feed) return <TvStage>{null}</TvStage>;

  const menu = slide?.kind === "drinks" || slide?.kind === "kitchen";
  const origin = window.location.origin;
  // The strip's QR code goes where the slide sends people: a pool's standings to that pool's join page
  // (while it takes new players), a menu to the menu, anything else to the home address.
  const joinPool = slide?.kind === "standings" && slide.joinPath ? { path: slide.joinPath, name: slide.content.pool.name } : null;
  const qrUrl = joinPool ? `${origin}${joinPool.path}` : menu ? `${origin}/menu` : origin;
  const stripText = joinPool ? `Scan to join ${joinPool.name}` : menu ? `Scan for the full menu at ${window.location.host}/menu` : `Scan to sign in at ${window.location.host}`;
  const strip = feed.screen.showQr ? (
    <>
      <Qr url={qrUrl} label="QR code to play on your phone" className="h-[44px] w-[44px]" />
      <b className="text-xl font-semibold text-brand-text">Play on your phone</b>
      <span className="text-lg text-brand-muted">{stripText}</span>
    </>
  ) : undefined;

  return (
    <TvStage strip={strip}>
      {slide ? (
        <SlideView key={slide.id} slide={slide} elapsedMs={elapsedMs} />
      ) : (
        <Message>
          <span data-testid="tv-empty">
            Nothing to show yet
            <small className="mt-2 block text-xl text-brand-faint">{feed.screen.name}</small>
          </span>
        </Message>
      )}
    </TvStage>
  );
}

/** A TV page. With `onClose` (admin previews only) a Close button floats in the corner, outside the
 * TV picture, so it never covers a slide and a real TV never shows it. */
export function TvPlayer({ feedPath, onClose }: { feedPath?: string; onClose?: () => void } = {}) {
  return (
    <>
      <Player feedPath={feedPath} />
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close preview"
          data-testid="tv-preview-close"
          className="fixed right-3 top-3 z-50 flex min-h-11 items-center gap-1.5 rounded-full bg-black/70 px-4 text-sm font-semibold text-white backdrop-blur"
        >
          <X className="h-4 w-4" aria-hidden="true" />
          Close
        </button>
      )}
    </>
  );
}
