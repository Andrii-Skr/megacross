import { Grid, Slot, DIRS } from "../types";

export type ClueEntry = {
  arrowR: number;
  arrowC: number;
  clueR: number;
  clueC: number;
  cluePos: number;
  dir: "down" | "right";
  word: string;
  text: string;
};

export type ClueLayout = {
  key: string;
  row: number;
  col: number;
  slotIds: number[];
  areaCells: Array<[number, number]>;
  clusterCells?: Array<[number, number]>;
  text: string;
};

export const CLUE_MAP: Record<number, Array<{ cluePos: number; dirKey: number }>> = {
  0x01: [{ cluePos: 2, dirKey: 8 }],
  0x02: [{ cluePos: 1, dirKey: 8 }],
  0x03: [{ cluePos: 4, dirKey: 8 }],
  0x04: [{ cluePos: 7, dirKey: 8 }],
  0x05: [{ cluePos: 9, dirKey: 8 }],
  0x06: [{ cluePos: 6, dirKey: 8 }],
  0x07: [{ cluePos: 3, dirKey: 8 }],
  0x08: [{ cluePos: 2, dirKey: 6 }],
  0x0a: [{ cluePos: 1, dirKey: 8 }, { cluePos: 2, dirKey: 6 }],
  0x0b: [{ cluePos: 2, dirKey: 6 }, { cluePos: 4, dirKey: 8 }],
  0x0d: [{ cluePos: 2, dirKey: 6 }, { cluePos: 9, dirKey: 8 }],
  0x10: [{ cluePos: 1, dirKey: 6 }],
  0x11: [{ cluePos: 2, dirKey: 8 }, { cluePos: 1, dirKey: 6 }],
  0x13: [{ cluePos: 1, dirKey: 6 }, { cluePos: 4, dirKey: 8 }],
  0x15: [{ cluePos: 1, dirKey: 6 }, { cluePos: 9, dirKey: 8 }],
  0x18: [{ cluePos: 4, dirKey: 6 }],
  0x19: [{ cluePos: 2, dirKey: 8 }, { cluePos: 4, dirKey: 6 }],
  0x1a: [{ cluePos: 1, dirKey: 8 }, { cluePos: 4, dirKey: 6 }],
  0x1c: [{ cluePos: 4, dirKey: 6 }, { cluePos: 7, dirKey: 8 }],
  0x1d: [{ cluePos: 4, dirKey: 6 }, { cluePos: 9, dirKey: 8 }],
  0x20: [{ cluePos: 7, dirKey: 6 }],
  0x28: [{ cluePos: 9, dirKey: 6 }],
  0x29: [{ cluePos: 2, dirKey: 8 }, { cluePos: 9, dirKey: 6 }],
  0x21: [{ cluePos: 2, dirKey: 8 }, { cluePos: 7, dirKey: 6 }],
  0x23: [{ cluePos: 4, dirKey: 8 }, { cluePos: 7, dirKey: 6 }],
  0x2a: [{ cluePos: 3, dirKey: 2 }, { cluePos: 7, dirKey: 6 }],
  0x2b: [{ cluePos: 4, dirKey: 8 }, { cluePos: 9, dirKey: 6 }],
  0x2c: [{ cluePos: 7, dirKey: 8 }, { cluePos: 9, dirKey: 6 }],
  0x30: [{ cluePos: 8, dirKey: 6 }],
  0x38: [{ cluePos: 3, dirKey: 6 }],
  0x39: [{ cluePos: 2, dirKey: 8 }, { cluePos: 3, dirKey: 6 }],
  0x3d: [{ cluePos: 3, dirKey: 6 }, { cluePos: 9, dirKey: 8 }],
};

const POS_OFFSETS: Record<number, [number, number]> = {
  1: [-1, -1],
  2: [-1, 0],
  3: [-1, 1],
  4: [0, -1],
  5: [0, 0],
  6: [0, 1],
  7: [1, -1],
  8: [1, 0],
  9: [1, 1],
};

function isTruthyEnv(value: string | undefined): boolean {
  if (value === undefined) return false;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  if (normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off") {
    return false;
  }
  return true;
}

function is02AreaExpansionEnabled(): boolean {
  return isTruthyEnv(process.env.CROSS_ENABLE_02_AREA_EXPANSION);
}

function dirKeyFromSlot(slot: Slot): number {
  return slot.dir === DIRS.right ? 6 : 8;
}

function hasArrowCells(grid: Grid): boolean {
  for (const row of grid.data) {
    for (const ch of row) {
      if (ch === "↓" || ch === "→" || ch === "↘") return true;
    }
  }
  return false;
}

function resolveClueCell(
  grid: Grid,
  slot: Slot,
  dirKey: number
): { clueR: number; clueC: number; cluePos: number } {
  const code = grid.codes[slot.r][slot.c];
  const mapping = CLUE_MAP[code] ?? [];
  const entry = mapping.find((item) => item.dirKey === dirKey);
  const cluePos = entry?.cluePos ?? 5;
  const [dr, dc] = POS_OFFSETS[cluePos] ?? [0, 0];

  let clueR = slot.r + dr;
  let clueC = slot.c + dc;
  if (
    clueR < 0 ||
    clueC < 0 ||
    clueR >= grid.rows ||
    clueC >= grid.cols
  ) {
    clueR = slot.r;
    clueC = slot.c;
    return { clueR, clueC, cluePos: 5 };
  }
  return { clueR, clueC, cluePos };
}

function slotDirName(slot: Slot): "down" | "right" {
  return slot.dir === DIRS.right ? "right" : "down";
}

function build02HashComponents(grid: Grid): {
  cellsByComponent: Array<Array<[number, number]>>;
  componentByCellKey: Map<string, number>;
} {
  const cellsByComponent: Array<Array<[number, number]>> = [];
  const componentByCellKey = new Map<string, number>();
  const seen = Array.from({ length: grid.rows }, () => Array(grid.cols).fill(false));
  const dirs: Array<[number, number]> = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  const is02Hash = (r: number, c: number): boolean =>
    grid.data[r]?.[c] === "#" && grid.codes[r]?.[c] === 0x02;

  for (let row = 0; row < grid.rows; row += 1) {
    for (let col = 0; col < grid.cols; col += 1) {
      if (seen[row]?.[col] || !is02Hash(row, col)) continue;
      const cells: Array<[number, number]> = [];
      const queue: Array<[number, number]> = [[row, col]];
      seen[row][col] = true;
      for (let idx = 0; idx < queue.length; idx += 1) {
        const [currentRow, currentCol] = queue[idx];
        cells.push([currentRow, currentCol]);
        for (const [dr, dc] of dirs) {
          const nextRow = currentRow + dr;
          const nextCol = currentCol + dc;
          if (nextRow < 0 || nextCol < 0 || nextRow >= grid.rows || nextCol >= grid.cols) continue;
          if (seen[nextRow]?.[nextCol] || !is02Hash(nextRow, nextCol)) continue;
          seen[nextRow][nextCol] = true;
          queue.push([nextRow, nextCol]);
        }
      }
      cells.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      const componentId = cellsByComponent.length;
      cellsByComponent.push(cells);
      for (const [componentRow, componentCol] of cells) {
        componentByCellKey.set(`${componentRow},${componentCol}`, componentId);
      }
    }
  }

  return {
    cellsByComponent,
    componentByCellKey,
  };
}

type ComponentRectContext = {
  minRow: number;
  minCol: number;
  maxRow: number;
  maxCol: number;
  prefix: number[][];
  cellCount: number;
};

function buildComponentRectContext(cells: Array<[number, number]>): ComponentRectContext | null {
  if (!cells.length) return null;
  let minRow = Number.POSITIVE_INFINITY;
  let minCol = Number.POSITIVE_INFINITY;
  let maxRow = Number.NEGATIVE_INFINITY;
  let maxCol = Number.NEGATIVE_INFINITY;
  for (const [row, col] of cells) {
    minRow = Math.min(minRow, row);
    minCol = Math.min(minCol, col);
    maxRow = Math.max(maxRow, row);
    maxCol = Math.max(maxCol, col);
  }
  const height = maxRow - minRow + 1;
  const width = maxCol - minCol + 1;
  const fill = Array.from({ length: height }, () => Array(width).fill(0));
  for (const [row, col] of cells) {
    fill[row - minRow][col - minCol] = 1;
  }

  const prefix = Array.from({ length: height + 1 }, () => Array(width + 1).fill(0));
  for (let row = 1; row <= height; row += 1) {
    for (let col = 1; col <= width; col += 1) {
      prefix[row][col] =
        fill[row - 1][col - 1] +
        prefix[row - 1][col] +
        prefix[row][col - 1] -
        prefix[row - 1][col - 1];
    }
  }

  return {
    minRow,
    minCol,
    maxRow,
    maxCol,
    prefix,
    cellCount: cells.length,
  };
}

function rectFillCount(prefix: number[][], top: number, left: number, bottom: number, right: number): number {
  return (
    prefix[bottom + 1][right + 1] -
    prefix[top][right + 1] -
    prefix[bottom + 1][left] +
    prefix[top][left]
  );
}

function resolveExpanded02RectangleForClue(
  anchorRow: number,
  anchorCol: number,
  anchorDefinitionSlotIds: Set<number>,
  component: ComponentRectContext,
  clueCells: Array<{ row: number; col: number; definitionSlotIds: Set<number> }>,
  slotById: Map<number, { r: number; c: number }>,
  mode: "anchor" | "cluster" = "anchor"
): Array<[number, number]> | null {
  const anchorSlotId = anchorDefinitionSlotIds.size === 1 ? [...anchorDefinitionSlotIds][0] : null;
  if (mode === "anchor" && anchorSlotId === null) return null;

  const localAnchorRow = anchorRow - component.minRow;
  const localAnchorCol = anchorCol - component.minCol;
  const localRows = component.maxRow - component.minRow + 1;
  const localCols = component.maxCol - component.minCol + 1;

  const componentDefinitionSlotIds = new Set<number>();
  for (const clueCell of clueCells) {
    for (const slotId of clueCell.definitionSlotIds) {
      componentDefinitionSlotIds.add(slotId);
    }
  }
  const isSingleDefinitionComponent =
    anchorSlotId !== null &&
    componentDefinitionSlotIds.size === 1 &&
    componentDefinitionSlotIds.has(anchorSlotId);

  type RectCandidate = {
    area: number;
    width: number;
    height: number;
    top: number;
    left: number;
    bottom: number;
    right: number;
  };

  const findBestRectangle = ({
    requireAnchorInside,
    enforceSlotConsistency,
    allowThinRectangles,
  }: {
    requireAnchorInside: boolean;
    enforceSlotConsistency: boolean;
    allowThinRectangles: boolean;
  }): RectCandidate | null => {
    let best: RectCandidate | null = null;

    const topEnd = requireAnchorInside ? localAnchorRow : localRows - 1;
    const leftEnd = requireAnchorInside ? localAnchorCol : localCols - 1;

    for (let top = 0; top <= topEnd; top += 1) {
      const bottomStart = requireAnchorInside ? localAnchorRow : top;
      for (let bottom = bottomStart; bottom < localRows; bottom += 1) {
        const height = bottom - top + 1;
        if (requireAnchorInside && (localAnchorRow < top || localAnchorRow > bottom)) continue;
        for (let left = 0; left <= leftEnd; left += 1) {
          const rightStart = requireAnchorInside ? localAnchorCol : left;
          for (let right = rightStart; right < localCols; right += 1) {
            if (requireAnchorInside && (localAnchorCol < left || localAnchorCol > right)) continue;
            const width = right - left + 1;
            const area = width * height;
            if (width < 2 || height < 2) continue;
            if (area < 4) continue;
            if (
              !allowThinRectangles &&
              (width < 3 || height < 3) &&
              area !== component.cellCount
            ) {
              continue;
            }
            const filled = rectFillCount(component.prefix, top, left, bottom, right);
            if (filled !== area) continue;

            if (enforceSlotConsistency) {
              const absTop = component.minRow + top;
              const absLeft = component.minCol + left;
              const absBottom = component.minRow + bottom;
              const absRight = component.minCol + right;
              const slotIdsInRect = new Set<number>();
              for (const clueCell of clueCells) {
                if (
                  clueCell.row < absTop ||
                  clueCell.row > absBottom ||
                  clueCell.col < absLeft ||
                  clueCell.col > absRight
                ) {
                  continue;
                }
                for (const slotId of clueCell.definitionSlotIds) {
                  if (slotId !== anchorSlotId) {
                    const slot = slotById.get(slotId);
                    if (slot) {
                      const arrowOutsideRect =
                        slot.r < absTop || slot.r > absBottom || slot.c < absLeft || slot.c > absRight;
                      const clueOnRectBoundary =
                        clueCell.row === absTop ||
                        clueCell.row === absBottom ||
                        clueCell.col === absLeft ||
                        clueCell.col === absRight;
                      if (arrowOutsideRect && clueOnRectBoundary) {
                        continue;
                      }
                    }
                  }
                  slotIdsInRect.add(slotId);
                }
                if (slotIdsInRect.size > 1) break;
              }
              const hasAnchorSlot =
                anchorSlotId !== null && slotIdsInRect.size === 1 && slotIdsInRect.has(anchorSlotId);
              if (!hasAnchorSlot) continue;
            }

            if (
              !best ||
              area > best.area ||
              (area === best.area && Math.min(width, height) > Math.min(best.width, best.height)) ||
              (area === best.area &&
                Math.min(width, height) === Math.min(best.width, best.height) &&
                (top < best.top || (top === best.top && left < best.left)))
            ) {
              best = {
                area,
                width,
                height,
                top,
                left,
                bottom,
                right,
              };
            }
          }
        }
      }
    }

    return best;
  };

  let best: RectCandidate | null = null;
  if (mode === "cluster") {
    best = findBestRectangle({
      requireAnchorInside: false,
      enforceSlotConsistency: false,
      allowThinRectangles: true,
    });
  } else {
    best = findBestRectangle({
      requireAnchorInside: true,
      enforceSlotConsistency: true,
      allowThinRectangles: isSingleDefinitionComponent,
    });
  }

  if (!best) return null;

  const areaCells: Array<[number, number]> = [];
  for (let row = best.top; row <= best.bottom; row += 1) {
    for (let col = best.left; col <= best.right; col += 1) {
      areaCells.push([component.minRow + row, component.minCol + col]);
    }
  }
  return areaCells;
}

function collectDefinitionSlotIdsInCellSet(
  cellSet: Set<string>,
  clueCells: Array<{ row: number; col: number; definitionSlotIds: Set<number> }>
): Set<number> {
  const definitionSlotIds = new Set<number>();
  for (const clueCell of clueCells) {
    if (!cellSet.has(`${clueCell.row},${clueCell.col}`)) continue;
    for (const slotId of clueCell.definitionSlotIds) {
      definitionSlotIds.add(slotId);
    }
  }
  return definitionSlotIds;
}

function setsIntersect(left: Set<string>, right: Set<string>): boolean {
  const [small, big] = left.size <= right.size ? [left, right] : [right, left];
  for (const value of small) {
    if (big.has(value)) return true;
  }
  return false;
}

export function buildClueEntries(
  grid: Grid,
  slots: Slot[],
  solved: string[],
  definitions: Map<string, string>
): { down: ClueEntry[]; right: ClueEntry[] } {
  if (!hasArrowCells(grid)) {
    return { down: [], right: [] };
  }

  const down: ClueEntry[] = [];
  const right: ClueEntry[] = [];

  for (const slot of slots) {
    const word = slot.cells.map(([r, c]) => solved[r][c]).join("");
    const text = definitions.get(word.toUpperCase()) ?? "";
    const dirKey = dirKeyFromSlot(slot);
    const { clueR, clueC, cluePos } = resolveClueCell(grid, slot, dirKey);
    if (grid.data[clueR][clueC] !== "#") {
      continue;
    }
    const entry: ClueEntry = {
      arrowR: slot.r,
      arrowC: slot.c,
      clueR,
      clueC,
      cluePos,
      dir: slot.dir === DIRS.right ? "right" : "down",
      word,
      text,
    };

    if (entry.dir === "right") right.push(entry);
    else down.push(entry);
  }

  return { down, right };
}

export function buildClueLayouts(
  grid: Grid,
  slots: Slot[],
  solved: string[],
  definitions: Map<string, string>,
  options: { expand02Area?: boolean } = {}
): ClueLayout[] {
  if (!hasArrowCells(grid)) return [];
  const expand02Area =
    typeof options.expand02Area === "boolean"
      ? options.expand02Area
      : is02AreaExpansionEnabled();

  const slotIdByArrow = new Map<string, number>();
  const slotById = new Map<number, { r: number; c: number }>();
  for (const slot of slots) {
    slotIdByArrow.set(`${slot.r},${slot.c}:${slotDirName(slot)}`, slot.id);
    slotById.set(slot.id, { r: slot.r, c: slot.c });
  }

  const clues = buildClueEntries(grid, slots, solved, definitions);
  const groupByKey = new Map<
    string,
    {
      row: number;
      col: number;
      slotIds: Set<number>;
      definitionSlotIds: Set<number>;
      entries: Array<{ dir: "down" | "right"; text: string }>;
    }
  >();

  for (const clue of [...clues.down, ...clues.right]) {
    const slotId = slotIdByArrow.get(`${clue.arrowR},${clue.arrowC}:${clue.dir}`);
    if (slotId === undefined) continue;
    const key = `${clue.clueR},${clue.clueC}`;
    const group = groupByKey.get(key) ?? {
      row: clue.clueR,
      col: clue.clueC,
      slotIds: new Set<number>(),
      definitionSlotIds: new Set<number>(),
      entries: [],
    };
    group.slotIds.add(slotId);
    const text = clue.text.trim();
    if (text) {
      group.definitionSlotIds.add(slotId);
    }
    group.entries.push({ dir: clue.dir, text });
    groupByKey.set(key, group);
  }

  const { cellsByComponent, componentByCellKey } = expand02Area
    ? build02HashComponents(grid)
    : { cellsByComponent: [], componentByCellKey: new Map<string, number>() };
  const clueCellsByComponent = new Map<
    number,
    Array<{ row: number; col: number; definitionSlotIds: Set<number> }>
  >();
  const componentContextById = new Map<number, ComponentRectContext>();
  const componentClusterCellsById = new Map<number, Array<[number, number]> | null>();
  const componentClusterCellSetById = new Map<number, Set<string>>();
  const componentClusterDefinitionSlotIdsById = new Map<number, Set<number>>();
  const componentExpandedCandidatesById = new Map<
    number,
    Map<string, { slotId: number; cellSet: Set<string> }>
  >();
  const componentExpandedOverlapConflictById = new Map<number, boolean>();
  for (const [key, group] of groupByKey) {
    const componentId = componentByCellKey.get(key);
    if (componentId === undefined) continue;
    const list = clueCellsByComponent.get(componentId) ?? [];
    list.push({
      row: group.row,
      col: group.col,
      definitionSlotIds: new Set<number>(group.definitionSlotIds),
    });
    clueCellsByComponent.set(componentId, list);
  }

  const layouts: ClueLayout[] = [];
  for (const [key, group] of groupByKey) {
    const sortedSlotIds = [...group.slotIds].sort((a, b) => a - b);
    const orderedEntries = [...group.entries].sort(
      (a, b) => (a.dir === "right" ? 0 : 1) - (b.dir === "right" ? 0 : 1)
    );
    const text = orderedEntries
      .map((entry) => entry.text)
      .filter(Boolean)
      .join(" / ");

    let areaCells: Array<[number, number]> = [[group.row, group.col]];
    let clusterCells: Array<[number, number]> | undefined;
    const componentId = componentByCellKey.get(key);
    if (expand02Area && componentId !== undefined) {
      let componentContext = componentContextById.get(componentId);
      if (!componentContext) {
        const built = buildComponentRectContext(cellsByComponent[componentId] ?? []);
        if (built) {
          componentContext = built;
          componentContextById.set(componentId, built);
        }
      }
      if (componentContext) {
        const clueCells = clueCellsByComponent.get(componentId) ?? [];
        const anchorDefinitionSlotId = group.definitionSlotIds.size === 1 ? [...group.definitionSlotIds][0] : null;
        let clusterArea: Array<[number, number]> | null = null;
        let clusterCellSet: Set<string> | null = null;
        let clusterDefinitionSlotIds: Set<number> = new Set<number>();

        let cachedClusterArea = componentClusterCellsById.get(componentId);
        let cachedClusterCellSet = componentClusterCellSetById.get(componentId);
        let cachedClusterDefinitionSlotIds = componentClusterDefinitionSlotIdsById.get(componentId);
        if (cachedClusterArea === undefined || !cachedClusterCellSet || !cachedClusterDefinitionSlotIds) {
          const resolvedCluster = resolveExpanded02RectangleForClue(
            group.row,
            group.col,
            group.definitionSlotIds,
            componentContext,
            clueCells,
            slotById,
            "cluster"
          );
          cachedClusterArea = resolvedCluster && resolvedCluster.length >= 4 ? resolvedCluster : null;
          cachedClusterCellSet = new Set<string>();
          if (cachedClusterArea) {
            for (const [row, col] of cachedClusterArea) {
              cachedClusterCellSet.add(`${row},${col}`);
            }
          }
          cachedClusterDefinitionSlotIds = collectDefinitionSlotIdsInCellSet(cachedClusterCellSet, clueCells);
          componentClusterCellsById.set(componentId, cachedClusterArea);
          componentClusterCellSetById.set(componentId, cachedClusterCellSet);
          componentClusterDefinitionSlotIdsById.set(componentId, cachedClusterDefinitionSlotIds);
        }
        clusterArea = cachedClusterArea ?? null;
        clusterCellSet = cachedClusterCellSet;
        clusterDefinitionSlotIds = cachedClusterDefinitionSlotIds ?? new Set<number>();

        let expandedCandidatesByAnchor = componentExpandedCandidatesById.get(componentId);
        if (!expandedCandidatesByAnchor) {
          expandedCandidatesByAnchor = new Map<string, { slotId: number; cellSet: Set<string> }>();
          for (const clueCell of clueCells) {
            if (clueCell.definitionSlotIds.size !== 1) continue;
            const slotId = [...clueCell.definitionSlotIds][0] as number;
            const candidateArea = resolveExpanded02RectangleForClue(
              clueCell.row,
              clueCell.col,
              clueCell.definitionSlotIds,
              componentContext,
              clueCells,
              slotById,
              "anchor"
            );
            if (!candidateArea || candidateArea.length < 4) continue;
            const candidateCellSet = new Set<string>();
            for (const [row, col] of candidateArea) {
              candidateCellSet.add(`${row},${col}`);
            }
            const definitionSlotIdsInCandidate = collectDefinitionSlotIdsInCellSet(
              candidateCellSet,
              clueCells
            );
            if (
              definitionSlotIdsInCandidate.size === 1 &&
              definitionSlotIdsInCandidate.has(slotId)
            ) {
              expandedCandidatesByAnchor.set(`${clueCell.row},${clueCell.col}`, {
                slotId,
                cellSet: candidateCellSet,
              });
            }
          }
          componentExpandedCandidatesById.set(componentId, expandedCandidatesByAnchor);
          let hasOverlapConflict = false;
          const candidates = [...expandedCandidatesByAnchor.values()];
          for (let index = 0; index < candidates.length; index += 1) {
            const current = candidates[index];
            if (!current) continue;
            for (let nextIndex = index + 1; nextIndex < candidates.length; nextIndex += 1) {
              const next = candidates[nextIndex];
              if (!next || current.slotId === next.slotId) continue;
              if (setsIntersect(current.cellSet, next.cellSet)) {
                hasOverlapConflict = true;
                break;
              }
            }
            if (hasOverlapConflict) break;
          }
          componentExpandedOverlapConflictById.set(componentId, hasOverlapConflict);
        }

        let didExpandArea = false;
        if (anchorDefinitionSlotId !== null) {
          const expandedArea = resolveExpanded02RectangleForClue(
            group.row,
            group.col,
            group.definitionSlotIds,
            componentContext,
            clueCells,
            slotById,
            "anchor"
          );
          if (expandedArea && expandedArea.length >= 4) {
            const expandedCellSet = new Set<string>();
            for (const [row, col] of expandedArea) {
              expandedCellSet.add(`${row},${col}`);
            }
            const definitionSlotIdsInExpandedArea = collectDefinitionSlotIdsInCellSet(
              expandedCellSet,
              clueCells
            );
            if (
              definitionSlotIdsInExpandedArea.size === 1 &&
              definitionSlotIdsInExpandedArea.has(anchorDefinitionSlotId)
            ) {
              const currentKey = `${group.row},${group.col}`;
              const currentCandidate = expandedCandidatesByAnchor.get(currentKey);
              let hasOverlapConflict = false;
              if (currentCandidate) {
                for (const [candidateKey, candidate] of expandedCandidatesByAnchor) {
                  if (candidateKey === currentKey) continue;
                  if (candidate.slotId === currentCandidate.slotId) continue;
                  if (setsIntersect(currentCandidate.cellSet, candidate.cellSet)) {
                    hasOverlapConflict = true;
                    break;
                  }
                }
              }
              if (!hasOverlapConflict) {
                didExpandArea = true;
              }
            }
          }
          if (didExpandArea && expandedArea) {
            areaCells = expandedArea;
          }
        }

        if (clusterArea && clusterArea.length >= 4 && clusterCellSet && !didExpandArea) {
          const hasOverlapConflict = componentExpandedOverlapConflictById.get(componentId) === true;
          if (clusterDefinitionSlotIds.size === 0) {
            const clueCellCount = clueCells.length;
            const clusterAnchorDensity = clueCellCount / Math.max(1, clusterArea.length);
            const allowEmptyCluster = clusterAnchorDensity <= 0.6;
            if (allowEmptyCluster) {
              clusterCells = clusterArea;
            }
          } else if (!hasOverlapConflict && clusterDefinitionSlotIds.size === 1) {
            const [clusterDefinitionSlotId] = [...clusterDefinitionSlotIds];
            if (group.definitionSlotIds.has(clusterDefinitionSlotId)) {
              clusterCells = clusterArea;
            }
          }
        }
      }
    }

    layouts.push({
      key,
      row: group.row,
      col: group.col,
      slotIds: sortedSlotIds,
      areaCells,
      clusterCells,
      text,
    });
  }

  layouts.sort((a, b) => a.row - b.row || a.col - b.col);
  return layouts;
}
