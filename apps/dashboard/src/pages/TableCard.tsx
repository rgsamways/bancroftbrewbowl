import { useEffect, useState } from "react";
import { FocusBar } from "../components/AdminLayout";
import { buttonClass } from "./admin-pool/shared";

// The printable table card. The QR code opens the public menu page, which also invites people to
// play, so one code serves visitors and players. Drawn here in the browser as SVG (the package is
// loaded only on this page); nothing is sent to anyone.

export function TableCard() {
  const url = `${window.location.origin}/menu`;
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void import("qrcode").then(async (QR) => {
      const drawn = await QR.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
      if (!cancelled) setSvg(drawn);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <>
      <div className="print:hidden">
        <FocusBar leaveTo="/admin/more" />
        <h1 className="mt-2 text-3xl font-semibold leading-tight text-brand-text">Table card</h1>
        <p className="mt-2 text-sm text-brand-muted">
          Print this and stand it on the tables. The code opens the menu, and invites people to play Brew Bowl.
        </p>
      </div>

      <div
        data-testid="table-card"
        className="mt-6 flex flex-col items-center rounded-[20px] bg-white px-8 py-10 text-center text-neutral-900 print:mt-0 print:rounded-none"
      >
        <div aria-hidden="true" className="grid h-12 w-12 place-items-center rounded-[12px] bg-brand-accent text-2xl font-bold text-brand-accent-ink">
          B
        </div>
        <p className="mt-3 text-sm font-semibold uppercase tracking-wide text-neutral-600">Bancroft Brewing Co.</p>
        <h2 className="mt-4 text-3xl font-bold leading-tight">Play Brew Bowl on your phone</h2>
        <p className="mt-2 max-w-xs text-base text-neutral-700">Scan to sign in, make your picks, and follow the standings from your seat.</p>
        <div
          role="img"
          aria-label="QR code for the Brew Bowl menu page"
          data-url={url}
          className="mt-6 h-56 w-56 [&>svg]:h-full [&>svg]:w-full"
          dangerouslySetInnerHTML={{ __html: svg ?? "" }}
        />
        <p className="mt-4 text-lg font-semibold">{window.location.host}</p>
        <p className="mt-6 text-xs text-neutral-600">Please drink responsibly.</p>
      </div>

      <div className="mt-6 print:hidden">
        <button type="button" onClick={() => window.print()} className={buttonClass}>
          Print
        </button>
      </div>
    </>
  );
}
