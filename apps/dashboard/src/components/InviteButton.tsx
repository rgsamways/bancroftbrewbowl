import { useState } from "react";
import { Share2 } from "lucide-react";
import { inviteMessage } from "@bbb/shared";

/** "Invite a friend": shares a link to the pool's join page. It uses the phone's share sheet when
 * there is one, otherwise copies the link ("Link copied"), and as a last resort shows the link to
 * copy by hand. The link is the same for everyone and carries nothing private; nothing is sent to
 * the server and no invite is recorded. */
export function InviteButton({ poolId, poolName }: { poolId: string; poolName: string }) {
  const [state, setState] = useState<"idle" | "copied" | "manual">("idle");
  const link = `${window.location.origin}/join/${poolId}`;

  async function invite() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: poolName, text: inviteMessage(poolName), url: link });
        return;
      } catch (e) {
        // Closing the share sheet is not a failure.
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(link);
      setState("copied");
    } catch {
      setState("manual");
    }
  }

  return (
    <div data-testid="invite">
      <button
        type="button"
        onClick={() => void invite()}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[12px] border border-brand-border px-4 font-semibold text-brand-text hover:border-brand-accent"
      >
        <Share2 className="h-4 w-4" aria-hidden="true" />
        {state === "copied" ? "Link copied" : "Invite a friend"}
      </button>
      {state === "copied" && (
        <p role="status" className="mt-1 text-sm text-brand-muted">
          Send it to a friend. It opens {poolName}&apos;s join page.
        </p>
      )}
      {state === "manual" && (
        <label className="mt-2 block text-sm text-brand-muted">
          Copy this link and send it to a friend
          <input
            readOnly
            value={link}
            onFocus={(e) => e.currentTarget.select()}
            className="mt-1 min-h-11 w-full rounded-[12px] border border-brand-border bg-brand-surface px-3 text-brand-text"
          />
        </label>
      )}
    </div>
  );
}
