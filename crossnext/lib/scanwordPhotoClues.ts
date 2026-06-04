import {
  buildPhotoAreaBoundsBySlotId as buildSharedPhotoAreaBoundsBySlotId,
  type PhotoAreaBounds as ScanwordPhotoAreaBounds,
} from "@megacross/cross-clues";
import type { Grid, Slot } from "@/utils/cross/types";

export type { ScanwordPhotoAreaBounds };

export function buildPhotoAreaBoundsBySlotId(
  grid: Grid,
  slots: Slot[],
  solved: string[],
  definitions: Map<string, string>,
): Map<number, ScanwordPhotoAreaBounds> {
  return buildSharedPhotoAreaBoundsBySlotId(grid, slots, solved, definitions, {
    anchorFromSlotIdsWhenNoDefinitions: true,
  });
}
