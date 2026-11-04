export type ClueOption = { code: number; resources: string[] };
export type ClueGroup = { directions: number[]; options: ClueOption[] };
type CachedComponent = { selected: number[]; choices: number; exhaustive: boolean };

/** Per-search bounded cache. Entries contain option indices, never grid objects. */
export class ClueMatchingCache {
  private entries = new Map<string, CachedComponent>();
  private keyCharacters = 0;
  hits = 0;

  get(key: string): CachedComponent | undefined {
    const value = this.entries.get(key);
    if (value) this.hits += 1;
    return value;
  }

  set(key: string, value: CachedComponent): void {
    if (key.length > 2_000_000) return;
    while (this.entries.size >= 2048 || this.keyCharacters + key.length > 2_000_000) {
      const first = this.entries.keys().next().value;
      if (first === undefined) break;
      this.keyCharacters -= first.length;
      this.entries.delete(first);
    }
    this.keyCharacters += key.length;
    this.entries.set(key, value);
  }
}

/** Maximum covered answers with indivisible double-arrow choices. A bounded
 * search returns a feasible lower bound, explicitly marked inexact. Resource
 * ranks preserve option order while reusable arrays replace recursive Maps/Sets.
 */
export function matchClueGroups<T extends ClueGroup>(groups: readonly T[], maxChoices = 100_000, requireAll = false, cache?: ClueMatchingCache) {
  const owners = new Map<string, number[]>();
  groups.forEach((group, id) => { for (const resource of new Set(group.options.flatMap((o) => o.resources))) owners.set(resource, [...(owners.get(resource) ?? []), id]); });
  const selected = new Map<T, ClueOption>();
  const visited = new Uint8Array(groups.length);
  let choices = 0; let exhaustive = true;
  for (let root = 0; root < groups.length; root += 1) {
    if (visited[root]) continue;
    const component = [root]; visited[root] = 1;
    const resources = new Set<string>();
    for (let i = 0; i < component.length; i += 1) for (const option of groups[component[i]].options) for (const resource of option.resources) {
      resources.add(resource);
      for (const id of owners.get(resource) ?? []) if (!visited[id]) { visited[id] = 1; component.push(id); }
    }
    const local = component.map((id) => groups[id]);
    const ranks = new Map([...resources].sort().map((resource, id) => [resource, id]));
    const options = local.map((group) => group.options.map((option) => option.resources.map((resource) => ranks.get(resource)!)));
    const key = cache && local.length <= 8 ? JSON.stringify([Math.max(0, maxChoices - choices), requireAll, resources.size, local.map((group, id) => [group.directions.length, options[id]])]) : undefined;
    const saved = key === undefined ? undefined : cache?.get(key);
    if (saved) {
      saved.selected.forEach((option, id) => { if (option >= 0) selected.set(local[id], local[id].options[option]); });
      choices += saved.choices; exhaustive &&= saved.exhaustive;
      continue;
    }
    const choicesBefore = choices;
    const singles = local.map((_, id) => id).filter((id) => local[id].directions.length === 1).sort((a, b) => options[a].length - options[b].length);
    const doubles = local.map((_, id) => id).filter((id) => local[id].directions.length === 2).sort((a, b) => options[a].length - options[b].length);
    let upperBound = Math.min(resources.size, singles.length + 2 * doubles.length);
    const reserved = new Uint8Array(resources.size);
    let reservedCount = 0;
    const chosen = new Int32Array(local.length).fill(-1);
    const best = chosen.slice();
    let bestCount = -1; let truncated = false;
    const claimed = new Int32Array(resources.size);
    const singleOptions = new Int32Array(local.length);
    const seen = new Int32Array(resources.size);
    const augment = (group: number, stamp: number): boolean => {
      for (let option = 0; option < options[group].length; option += 1) {
        const resource = options[group][option][0];
        if (reserved[resource] || seen[resource] === stamp) continue;
        seen[resource] = stamp;
        if (claimed[resource] < 0 || augment(claimed[resource], stamp)) {
          claimed[resource] = group; singleOptions[group] = option; return true;
        }
      }
      return false;
    };
    const completeSingles = () => {
      claimed.fill(-1); singleOptions.fill(-1); seen.fill(-1);
      let count = reservedCount;
      for (const group of singles) {
        if (augment(group, group)) count += 1;
        else if (requireAll) return false;
      }
      if (count > bestCount) {
        bestCount = count; best.set(chosen);
        for (const group of singles) best[group] = singleOptions[group];
      }
      return true;
    };
    for (const group of doubles) {
      const option = options[group].findIndex((ids) => ids.every((r) => !reserved[r]));
      if (option >= 0) {
        chosen[group] = option;
        for (const resource of options[group][option]) { reserved[resource] = 1; reservedCount += 1; }
      }
    }
    completeSingles(); chosen.fill(-1); reserved.fill(0); reservedCount = 0;
    if (bestCount < upperBound) {
      const answers = local.flatMap((group, id) => group.directions.map((_, direction) => [...new Set(options[id].map((option) => option[direction]))]));
      const relaxedClaimed = new Int32Array(resources.size).fill(-1);
      const relaxedSeen = new Int32Array(resources.size).fill(-1);
      const relaxedAugment = (answer: number, stamp: number): boolean => {
        for (const resource of answers[answer]) {
          if (relaxedSeen[resource] === stamp) continue;
          relaxedSeen[resource] = stamp;
          if (relaxedClaimed[resource] < 0 || relaxedAugment(relaxedClaimed[resource], stamp)) { relaxedClaimed[resource] = answer; return true; }
        }
        return false;
      };
      upperBound = 0;
      answers.forEach((_, id) => { if (relaxedAugment(id, id)) upperBound += 1; });
    }
    const search = (index: number) => {
      if (bestCount === upperBound || reservedCount + 2 * (doubles.length - index) + singles.length <= bestCount) return;
      if (index === doubles.length) { completeSingles(); return; }
      if (choices >= maxChoices) { truncated = true; return; }
      choices += 1;
      if (requireAll && reservedCount && !completeSingles()) return;
      const group = doubles[index];
      for (let option = 0; option < options[group].length; option += 1) {
        const ids = options[group][option];
        if (ids.some((r) => reserved[r])) continue;
        chosen[group] = option;
        for (const resource of ids) { reserved[resource] = 1; reservedCount += 1; }
        search(index + 1);
        chosen[group] = -1;
        for (const resource of ids) { reserved[resource] = 0; reservedCount -= 1; }
        if (bestCount === upperBound) return;
      }
      if (!requireAll) search(index + 1);
    };
    if (!requireAll || upperBound === singles.length + 2 * doubles.length) search(0);
    const componentExhaustive = !truncated || bestCount === upperBound;
    exhaustive &&= componentExhaustive;
    if (key !== undefined) cache?.set(key, { selected: [...best], choices: choices - choicesBefore, exhaustive: componentExhaustive });
    best.forEach((option, id) => { if (option >= 0) selected.set(local[id], local[id].options[option]); });
  }
  return { selected, exhaustive, choices };
}
