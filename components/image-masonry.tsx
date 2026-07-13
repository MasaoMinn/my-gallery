"use client";

import type { GalleryImage } from "@/lib/db/gallery";
import {
  calculateMasonryLayout,
  getResponsiveColumnCount,
  type ImageSize
} from "@/lib/images/masonry";
import { useLayoutEffect, useMemo, useRef, useState } from "react";

type ImageMasonryProps = {
  formatSize: (bytes: number) => string;
  imageSize: ImageSize;
  images: GalleryImage[];
  onOpenImage: (image: GalleryImage) => void;
};

const DESKTOP_GAP = 14;
const MOBILE_GAP = 12;

export function ImageMasonry({ formatSize, imageSize, images, onOpenImage }: ImageMasonryProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const [metrics, setMetrics] = useState({ containerWidth: 0, viewportWidth: 0 });

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const measure = () => {
      const nextMetrics = {
        containerWidth: container.getBoundingClientRect().width,
        viewportWidth: window.innerWidth
      };
      setMetrics((current) =>
        current.containerWidth === nextMetrics.containerWidth &&
        current.viewportWidth === nextMetrics.viewportWidth
          ? current
          : nextMetrics
      );
    };
    const scheduleMeasure = () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
      frameRef.current = requestAnimationFrame(measure);
    };

    measure();
    const observer = new ResizeObserver(scheduleMeasure);
    observer.observe(container);
    window.addEventListener("resize", scheduleMeasure);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  const columnCount = getResponsiveColumnCount(imageSize, metrics.viewportWidth);
  const gap = metrics.viewportWidth <= 760 ? MOBILE_GAP : DESKTOP_GAP;
  const layout = useMemo(
    () => calculateMasonryLayout(images, metrics.containerWidth, columnCount, gap),
    [columnCount, gap, images, metrics.containerWidth]
  );
  const placementById = useMemo(
    () => new Map(layout.placements.map((placement) => [placement.id, placement])),
    [layout.placements]
  );
  const layoutReady = metrics.containerWidth > 0;

  return (
    <div
      aria-busy="false"
      className={`image-grid image-size-${imageSize}${layoutReady ? " masonry-ready" : ""}`}
      ref={containerRef}
      style={layoutReady ? { height: layout.height } : undefined}
    >
      {images.map((image) => {
        const placement = placementById.get(image.id);
        const aspectRatio = image.width && image.height ? `${image.width} / ${image.height}` : "4 / 3";
        const style = placement
          ? {
              height: placement.height,
              transform: `translate3d(${placement.x}px, ${placement.y}px, 0)`,
              width: placement.width
            }
          : { aspectRatio };

        return (
          <button
            className="image-card"
            data-column-span={placement?.columnSpan ?? 1}
            key={image.id}
            onClick={() => onOpenImage(image)}
            style={style}
            type="button"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt={image.description || "相册图片"}
              height={image.height ?? undefined}
              loading="lazy"
              src={`/api/images/${image.id}/asset`}
              width={image.width ?? undefined}
            />
            <span className="image-overlay">
              <strong>{image.description || "暂无图片描述"}</strong>
              <small>{formatSize(image.size_bytes)}</small>
            </span>
          </button>
        );
      })}
    </div>
  );
}
