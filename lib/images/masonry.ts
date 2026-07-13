export type ImageSize = "xlarge" | "large" | "medium" | "small" | "xsmall";

export type MasonryItem = {
  id: string;
  width: number | null;
  height: number | null;
};

export type MasonryPlacement = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  columnSpan: number;
};

export type MasonryLayout = {
  height: number;
  placements: MasonryPlacement[];
};

const WIDE_IMAGE_RATIO = 1.5;
const FALLBACK_ASPECT_RATIO = 4 / 3;

const DESKTOP_COLUMNS: Record<ImageSize, number> = {
  xlarge: 3,
  large: 4,
  medium: 5,
  small: 6,
  xsmall: 8
};

const TABLET_COLUMNS: Record<ImageSize, number> = {
  xlarge: 2,
  large: 3,
  medium: 3,
  small: 4,
  xsmall: 4
};

const MOBILE_COLUMNS: Record<ImageSize, number> = {
  xlarge: 1,
  large: 1,
  medium: 2,
  small: 2,
  xsmall: 2
};

export function getResponsiveColumnCount(imageSize: ImageSize, viewportWidth: number): number {
  if (viewportWidth <= 760) {
    return MOBILE_COLUMNS[imageSize];
  }

  if (viewportWidth <= 1180) {
    return TABLET_COLUMNS[imageSize];
  }

  return DESKTOP_COLUMNS[imageSize];
}

export function getImageColumnSpan(item: MasonryItem, columnCount: number): number {
  if (columnCount < 2) {
    return 1;
  }

  return getAspectRatio(item) >= WIDE_IMAGE_RATIO ? 2 : 1;
}

export function calculateMasonryLayout(
  items: MasonryItem[],
  containerWidth: number,
  columnCount: number,
  gap: number
): MasonryLayout {
  if (items.length === 0 || containerWidth <= 0 || columnCount <= 0) {
    return { height: 0, placements: [] };
  }

  const safeGap = Math.max(0, gap);
  const columnWidth = Math.max(0, (containerWidth - safeGap * (columnCount - 1)) / columnCount);
  const columnHeights = Array.from({ length: columnCount }, () => 0);
  const placements: MasonryPlacement[] = [];

  for (const item of items) {
    const columnSpan = Math.min(getImageColumnSpan(item, columnCount), columnCount);
    let bestColumn = 0;
    let bestY = Number.POSITIVE_INFINITY;

    for (let startColumn = 0; startColumn <= columnCount - columnSpan; startColumn += 1) {
      let candidateY = 0;
      for (let column = startColumn; column < startColumn + columnSpan; column += 1) {
        candidateY = Math.max(candidateY, columnHeights[column]);
      }

      if (candidateY < bestY) {
        bestY = candidateY;
        bestColumn = startColumn;
      }
    }

    const itemWidth = columnWidth * columnSpan + safeGap * (columnSpan - 1);
    const itemHeight = itemWidth / getAspectRatio(item);
    const placement = {
      id: item.id,
      x: bestColumn * (columnWidth + safeGap),
      y: bestY,
      width: itemWidth,
      height: itemHeight,
      columnSpan
    };
    placements.push(placement);

    const nextHeight = bestY + itemHeight + safeGap;
    for (let column = bestColumn; column < bestColumn + columnSpan; column += 1) {
      columnHeights[column] = nextHeight;
    }
  }

  return {
    height: Math.max(...columnHeights) - safeGap,
    placements
  };
}

function getAspectRatio(item: MasonryItem): number {
  if (
    item.width !== null &&
    item.height !== null &&
    Number.isFinite(item.width) &&
    Number.isFinite(item.height) &&
    item.width > 0 &&
    item.height > 0
  ) {
    return item.width / item.height;
  }

  return FALLBACK_ASPECT_RATIO;
}
