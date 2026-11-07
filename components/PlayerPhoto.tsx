"use client";

import { useState } from "react";

type Props = Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src?: string | null;
  /** Shown when src is missing or the image fails to load (e.g. SofaScore hotlink block). */
  fallback?: React.ReactNode;
};

/**
 * Player headshots. SofaScore CDN (img.sofascore.com) returns 403 when Referer is our site;
 * no-referrer avoids sending Referer so the browser can load the image.
 */
export function PlayerPhoto({ src, alt, className, fallback, loading, ...rest }: Props) {
  const [broken, setBroken] = useState(false);

  if (!src || broken) {
    return fallback ? <>{fallback}</> : null;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...rest}
      src={src}
      alt={alt ?? ""}
      className={className}
      loading={loading}
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
    />
  );
}
