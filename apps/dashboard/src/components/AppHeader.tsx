import { Link } from "react-router";
import { initials } from "@bbb/shared";
import { useSession } from "../lib/auth-client";

// The slim top bar of the v2 frame: the logo and name lead home, the avatar opens
// the Me page. Sizes follow the mockups; the avatar is a 44 pixel tap target.
export function AppHeader() {
  const { data: session } = useSession();

  return (
    <header className="sticky top-0 z-30 border-b border-brand-border bg-brand-bg/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
        <Link to="/" aria-label="Brew Bowl home" className="flex min-h-11 items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-brand-accent text-[17px] font-bold text-brand-accent-ink">
            B
          </span>
          <span className="leading-tight">
            <span className="block text-base font-semibold text-brand-text">Brew Bowl</span>
            <span className="block text-xs text-brand-muted">Bancroft Brewing Co.</span>
          </span>
        </Link>
        <Link
          to="/account"
          aria-label="Me"
          className="grid h-11 w-11 place-items-center rounded-full border border-brand-border bg-brand-surface-raised text-xs font-semibold text-brand-text"
        >
          {initials(session?.user.name, session?.user.email)}
        </Link>
      </div>
    </header>
  );
}
