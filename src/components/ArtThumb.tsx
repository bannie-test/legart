"use client";
import { useState } from "react";

/** Library thumbnail with a brick placeholder when the image hasn't been downloaded yet. */
export function ArtThumb({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className={`studs-bg flex items-center justify-center text-center text-xs font-semibold text-white ${className}`} role="img" aria-label={alt}>
        <span className="rounded bg-black/40 px-2 py-1">{alt}</span>
      </div>
    );
  }
  return <img src={src} alt={alt} loading="lazy" className={`object-cover ${className}`} onError={() => setFailed(true)} />;
}
