"use client";

import { useState } from "react";

import { clubInitials, clubLogoSrc } from "@/lib/clubLogos";

type Props = {
  club: string;
  size?: number;
  className?: string;
};

export function ClubLogo({ club, size = 18, className = "" }: Props) {
  const [failed, setFailed] = useState(false);
  const src = clubLogoSrc(club);

  return (
    <span
      className={`club-logo ${className}`.trim()}
      style={{ width: size, height: size, ["--club-logo-size" as string]: `${size}px` }}
      aria-hidden
    >
      {!failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <span className="club-logo-fallback">{clubInitials(club)}</span>
      )}
    </span>
  );
}
