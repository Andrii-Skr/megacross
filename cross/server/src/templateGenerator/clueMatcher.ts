import { arrowCellForCode, CLUE_MAP, CLUE_POSITION_OFFSETS, DIRS, scanSlotsDetailed } from "@megacross/cross-format";
import type { Cell, Grid } from "../types";
import type { PictureBounds } from "./types";

type ClueOption = { code: number; resources: string[] };
type StartGroup = { row: number; col: number; directions: number[]; options: ClueOption[] };

function clueResources(grid: Grid, pictures: readonly PictureBounds[]): { resources: Set<string>; photoByCell: Map<string, string> } {
  const resources = new Set<string>();
  const photoByCell = new Map<string, string>();
  for (const [index, picture] of pictures.entries()) {
    const resource = `photo:${index}`;
    resources.add(resource);
    for (let row = picture.row; row < picture.row + picture.height; row += 1) {
      for (let col = picture.col; col < picture.col + picture.width; col += 1) photoByCell.set(`${row},${col}`, resource);
    }
  }
  for (let row = 0; row < grid.rows; row += 1) for (let col = 0; col < grid.cols; col += 1) {
    const key = `${row},${col}`;
    if (grid.data[row][col] === "#" && !photoByCell.has(key)) resources.add(`clue:${key}`);
  }
  return { resources, photoByCell };
}

function startGroups(grid: Grid, pictures: readonly PictureBounds[]): { groups: StartGroup[]; resources: Set<string> } {
  const { resources, photoByCell } = clueResources(grid, pictures);
  const slots = scanSlotsDetailed(grid, { mode: "arrow", minLen: 3 }).slots;
  const groupsByStart = new Map<string, StartGroup>();
  for (const slot of slots) {
    const key = `${slot.r},${slot.c}`;
    const group = groupsByStart.get(key) ?? { row: slot.r, col: slot.c, directions: [], options: [] };
    group.directions.push(slot.dir === DIRS.right ? 6 : 8);
    groupsByStart.set(key, group);
  }
  const groups = [...groupsByStart.values()];
  for (const group of groups) {
    const wanted = new Set(group.directions);
    for (const [codeText, entries] of Object.entries(CLUE_MAP)) {
      if (entries.length !== group.directions.length || !entries.every((entry) => wanted.has(entry.dirKey))) continue;
      const clues: string[] = [];
      let valid = true;
      for (const entry of entries) {
        const [dr, dc] = CLUE_POSITION_OFFSETS[entry.cluePos] ?? [0, 0];
        const row = group.row + dr;
        const col = group.col + dc;
        if (grid.data[row]?.[col] !== "#") { valid = false; break; }
        const key = `${row},${col}`;
        clues.push(photoByCell.get(key) ?? `clue:${key}`);
      }
      if (valid && new Set(clues).size === clues.length) group.options.push({ code: Number(codeText), resources: clues });
    }
  }
  return { groups, resources };
}

/** Every ordinary clue cell and every requested photo is used exactly once. */
export function assignUniqueClues(grid: Grid, pictures: readonly PictureBounds[], maxDoubleChoices = 100_000): Grid | null {
  const { groups, resources } = startGroups(grid, pictures);
  const answerCount = groups.reduce((sum, group) => sum + group.directions.length, 0);
  if (answerCount !== resources.size || groups.some((group) => !group.options.length)) return null;
  const singles = groups.filter((group) => group.directions.length === 1);
  const doubles = groups.filter((group) => group.directions.length === 2).sort((a, b) => a.options.length - b.options.length);
  const reserved = new Set<string>();
  const selected = new Map<StartGroup, ClueOption>();
  let choices = 0;

  const matchSingles = (): boolean => {
    const claimed = new Map<string, StartGroup>();
    const selectedSingle = new Map<StartGroup, ClueOption>();
    const ordered = [...singles].sort((a, b) => a.options.length - b.options.length);
    const augment = (group: StartGroup, seen: Set<string>): boolean => {
      for (const option of group.options) {
        const resource = option.resources[0];
        if (reserved.has(resource) || seen.has(resource)) continue;
        seen.add(resource);
        const previous = claimed.get(resource);
        if (!previous || augment(previous, seen)) {
          claimed.set(resource, group);
          selectedSingle.set(group, option);
          return true;
        }
      }
      return false;
    };
    for (const group of ordered) if (!augment(group, new Set())) return false;
    for (const [group, option] of selectedSingle) selected.set(group, option);
    return true;
  };

  const chooseDoubles = (index: number): boolean => {
    if (++choices > maxDoubleChoices) return false;
    if (index === doubles.length) return matchSingles();
    const group = doubles[index];
    for (const option of group.options) {
      if (option.resources.some((resource) => reserved.has(resource))) continue;
      for (const resource of option.resources) reserved.add(resource);
      selected.set(group, option);
      if (chooseDoubles(index + 1)) return true;
      selected.delete(group);
      for (const resource of option.resources) reserved.delete(resource);
    }
    return false;
  };
  if (!chooseDoubles(0)) return null;

  const codes = grid.codes.map((row) => [...row]);
  const data = grid.data.map((row) => [...row] as Cell[]);
  for (const [group, option] of selected) {
    codes[group.row][group.col] = option.code;
    data[group.row][group.col] = arrowCellForCode(option.code);
  }
  return { ...grid, data: data.map((row) => row.join("")), codes };
}

export function verifyClueOwnership(grid: Grid, pictures: readonly PictureBounds[]): string[] {
  const { groups, resources } = startGroups(grid, pictures);
  const counts = new Map<string, number>();
  const errors: string[] = [];
  for (const group of groups) {
    const option = group.options.find((item) => item.code === grid.codes[group.row]?.[group.col]);
    if (!option) { errors.push(`arrow at ${group.row},${group.col} has no valid clue`); continue; }
    for (const resource of option.resources) counts.set(resource, (counts.get(resource) ?? 0) + 1);
  }
  for (const resource of resources) {
    const count = counts.get(resource) ?? 0;
    if (count !== 1) errors.push(`${resource} is used ${count} times`);
  }
  return errors;
}

export function clueAssignmentDiagnostics(grid: Grid, pictures: readonly PictureBounds[]) {
  const { groups, resources } = startGroups(grid, pictures);
  const possible = new Set(groups.flatMap((group) => group.options.flatMap((option) => option.resources)));
  const reserved = new Set<string>();
  let matchedDoubles = 0;
  const doubles = groups.filter((group) => group.directions.length === 2).sort((a, b) => a.options.length - b.options.length);
  for (const group of doubles) {
    const option = group.options.find((item) => item.resources.every((resource) => !reserved.has(resource)));
    if (!option) continue;
    for (const resource of option.resources) reserved.add(resource);
    matchedDoubles += 1;
  }
  const claimed = new Map<string, StartGroup>();
  const augment = (group: StartGroup, seen: Set<string>): boolean => {
    for (const option of group.options) for (const resource of option.resources) {
      if (reserved.has(resource) || seen.has(resource)) continue;
      seen.add(resource);
      const previous = claimed.get(resource);
      if (!previous || augment(previous, seen)) { claimed.set(resource, group); return true; }
    }
    return false;
  };
  for (const group of groups.filter((item) => item.directions.length === 1)) augment(group, new Set());
  const singleStarts = groups.filter((item) => item.directions.length === 1).length;
  return {
    answerCount: groups.reduce((sum, group) => sum + group.directions.length, 0),
    resourceCount: resources.size,
    doubleStarts: groups.filter((group) => group.directions.length === 2).length,
    noOptionStarts: groups.filter((group) => !group.options.length).map((group) => `${group.row},${group.col}`),
    noOptionResources: [...resources].filter((resource) => !possible.has(resource)),
    unmatchedSingleStarts: singleStarts - claimed.size,
    unmatchedDoubleStarts: doubles.length - matchedDoubles,
  };
}
