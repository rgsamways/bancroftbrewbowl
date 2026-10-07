import { useEffect, useState } from "react";

/** A QR code for `url`, drawn as an SVG on a white tile so phones can scan it from a TV. */
export function Qr({ url, label = "QR code to play on your phone", className = "h-[84px] w-[84px]" }: { url: string; label?: string; className?: string }) {
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
    <div
      role="img"
      aria-label={label}
      data-url={url}
      className={`${className} flex-none overflow-hidden rounded-[10px] bg-white [&>svg]:h-full [&>svg]:w-full`}
      dangerouslySetInnerHTML={{ __html: svg ?? "" }}
    />
  );
}
