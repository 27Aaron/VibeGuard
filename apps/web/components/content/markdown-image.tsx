"use client";

import { useEffect, useRef, useState } from "react";

import { Expand } from "lucide-react";

import { resolveMarkdownImageProxyUrl } from "@/lib/markdown-url";
import { cn } from "@/lib/utils";

import type { VariantPalette } from "./markdown-shared";

type LightboxImage = {
  src: string;
  alt: string;
};

export type ImageRendererProps = {
  src?: string | Blob;
  alt?: string;
  sourceUrl?: string;
  lang: "zh" | "en";
  palette: VariantPalette;
  onLightboxOpen: (image: LightboxImage) => void;
};

export function ImageRenderer({
  src,
  alt,
  sourceUrl,
  lang,
  palette,
  onLightboxOpen,
}: ImageRendererProps) {
  const resolvedSrc = resolveMarkdownImageProxyUrl(
    typeof src === "string" ? src : "",
    sourceUrl,
  );

  if (!resolvedSrc) {
    return null;
  }

  return (
    <figure className="group my-8">
      <button
        type="button"
        onClick={() => onLightboxOpen({ src: resolvedSrc, alt: alt ?? "" })}
        className="relative block w-full overflow-hidden rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/60"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resolvedSrc}
          alt={alt ?? ""}
          loading="lazy"
          className={cn(
            "w-full rounded-2xl object-contain shadow-sm transition duration-300 group-hover:scale-[1.01]",
            palette.image,
          )}
        />
        <span
          className={cn(
            "pointer-events-none absolute right-3 bottom-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium opacity-0 transition group-hover:opacity-100",
            palette.imageHint,
          )}
        >
          <Expand className="size-3.5" />
          {lang === "zh" ? "点击放大" : "Click to zoom"}
        </span>
      </button>
      {renderImageCaption(alt, palette)}
    </figure>
  );
}

function renderImageCaption(
  alt: string | undefined,
  palette: VariantPalette,
) {
  if (!alt?.trim()) {
    return null;
  }

  return (
    <figcaption className={cn("mt-2 text-xs leading-6", palette.caption)}>
      {alt}
    </figcaption>
  );
}

export type LightboxOverlayProps = {
  lightboxImage: LightboxImage;
  lightboxVisible: boolean;
  palette: VariantPalette;
  onClose: () => void;
};

export function LightboxOverlay({
  lightboxImage,
  lightboxVisible,
  palette,
  onClose,
}: LightboxOverlayProps) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-220 md:p-8",
        palette.lightboxBackdrop,
        lightboxVisible ? "opacity-100" : "opacity-0",
      )}
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className={cn(
          "inline-flex max-h-[94vh] max-w-[96vw] items-center justify-center transition-[opacity,transform] duration-220 ease-[cubic-bezier(0.22,1,0.36,1)]",
          lightboxVisible
            ? "scale-100 opacity-100"
            : "scale-[0.994] opacity-0",
        )}
        onClick={(event) => event.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={lightboxImage.src}
          alt={lightboxImage.alt}
          onClick={onClose}
          className="max-h-[94vh] w-[min(96vw,1600px)] max-w-[96vw] cursor-zoom-out rounded-2xl object-contain shadow-2xl"
        />
      </div>
    </div>
  );
}

export type LightboxImageType = LightboxImage;

export function useLightbox() {
  const [lightboxImage, setLightboxImage] = useState<LightboxImage | null>(
    null,
  );
  const [lightboxVisible, setLightboxVisible] = useState(false);
  const lightboxTimerRef = useRef<number | null>(null);
  const lightboxFrameRef = useRef<number | null>(null);

  const closeLightbox = () => {
    setLightboxVisible(false);

    if (lightboxTimerRef.current) {
      window.clearTimeout(lightboxTimerRef.current);
    }

    lightboxTimerRef.current = window.setTimeout(() => {
      setLightboxImage(null);
      lightboxTimerRef.current = null;
    }, 280);
  };

  useEffect(() => {
    if (!lightboxImage) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeLightbox();
      }
    };

    document.body.style.overflow = "hidden";
    lightboxFrameRef.current = window.requestAnimationFrame(() => {
      setLightboxVisible(true);
      lightboxFrameRef.current = null;
    });
    window.addEventListener("keydown", handleEscape);

    return () => {
      if (lightboxFrameRef.current) {
        window.cancelAnimationFrame(lightboxFrameRef.current);
        lightboxFrameRef.current = null;
      }
      if (lightboxTimerRef.current) {
        window.clearTimeout(lightboxTimerRef.current);
        lightboxTimerRef.current = null;
      }
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [lightboxImage]);

  return {
    lightboxImage,
    lightboxVisible,
    closeLightbox,
    openLightbox: setLightboxImage,
  };
}
