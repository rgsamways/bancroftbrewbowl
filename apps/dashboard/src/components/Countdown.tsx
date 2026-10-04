import { useEffect, useRef } from "react";
import { formatCountdown } from "@bbb/shared";

/** "Locks in 2d 14h 37m", counted down against the server's clock. When it reaches zero,
 * `onLocked` is called once so the screen can switch to its locked state. */
export function Countdown({
  lockTime,
  nowMs,
  onLocked,
  className = "",
}: {
  lockTime: string;
  nowMs: number;
  onLocked?: () => void;
  className?: string;
}) {
  const msLeft = Date.parse(lockTime) - nowMs;
  const fired = useRef(false);

  useEffect(() => {
    fired.current = false;
  }, [lockTime]);

  useEffect(() => {
    if (msLeft <= 0 && !fired.current) {
      fired.current = true;
      onLocked?.();
    }
  }, [msLeft, onLocked]);

  if (msLeft <= 0) return <p className={className}>Picks are locked</p>;
  return <p className={className}>Locks in {formatCountdown(msLeft)}</p>;
}
