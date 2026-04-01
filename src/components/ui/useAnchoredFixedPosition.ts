"use client";

import { useEffect, useState } from "react";
import type { RefObject } from "react";

type AnchorRectLike = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type AnchoredPositionOptions = {
  anchorRect: AnchorRectLike;
  elementRef: RefObject<HTMLElement | null>;
  offset?: number;
  viewportPadding?: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function computeAnchoredPosition({
  anchorRect,
  element,
  offset = 4,
  viewportPadding = 8,
}: Omit<AnchoredPositionOptions, "elementRef"> & { element: HTMLElement | null }) {
  const fallbackTop = anchorRect.top + anchorRect.height + offset;
  const fallbackLeft = anchorRect.left;

  if (!element || typeof window === "undefined") {
    return { top: fallbackTop, left: fallbackLeft };
  }

  const popupWidth = element.offsetWidth;
  const popupHeight = element.offsetHeight;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const anchorTop = anchorRect.top;
  const anchorBottom = anchorRect.top + anchorRect.height;
  const preferredBelowTop = anchorBottom + offset;
  const preferredAboveTop = anchorTop - popupHeight - offset;

  const canFitBelow = preferredBelowTop + popupHeight <= viewportHeight - viewportPadding;
  const canFitAbove = preferredAboveTop >= viewportPadding;

  const unclampedTop = canFitBelow || !canFitAbove ? preferredBelowTop : preferredAboveTop;
  const maxTop = Math.max(viewportPadding, viewportHeight - popupHeight - viewportPadding);
  const top = clamp(unclampedTop, viewportPadding, maxTop);

  const maxLeft = Math.max(viewportPadding, viewportWidth - popupWidth - viewportPadding);
  const left = clamp(anchorRect.left, viewportPadding, maxLeft);

  return { top, left };
}

export function useAnchoredFixedPosition({
  anchorRect,
  elementRef,
  offset = 4,
  viewportPadding = 8,
}: AnchoredPositionOptions) {
  const [position, setPosition] = useState(() =>
    computeAnchoredPosition({ anchorRect, element: null, offset, viewportPadding })
  );

  useEffect(() => {
    const update = () => {
      setPosition(
        computeAnchoredPosition({
          anchorRect,
          element: elementRef.current,
          offset,
          viewportPadding,
        })
      );
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [anchorRect, elementRef, offset, viewportPadding]);

  return position;
}
