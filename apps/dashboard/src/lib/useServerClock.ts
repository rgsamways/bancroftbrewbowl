import { useEffect, useMemo, useState } from "react";

/** The current time as the server sees it, ticking every second. The offset is measured
 * once each time the server sends its time, so a wrong phone clock does not matter. */
export function useServerNow(serverNow: string | undefined): number {
  const offset = useMemo(() => (serverNow ? Date.parse(serverNow) - Date.now() : 0), [serverNow]);
  const [now, setNow] = useState(() => Date.now() + offset);

  useEffect(() => {
    setNow(Date.now() + offset);
    const timer = window.setInterval(() => setNow(Date.now() + offset), 1000);
    return () => window.clearInterval(timer);
  }, [offset]);

  return now;
}
