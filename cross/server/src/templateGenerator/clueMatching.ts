export type ClueOption = { code: number; resources: string[] };
export type ClueGroup = { directions: number[]; options: ClueOption[] };

/** Maximum covered answers with indivisible double-arrow choices. Independent
 * conflict components are searched separately; singles use augmenting paths.
 * An exhausted budget returns a valid lower bound, explicitly marked inexact.
 */
export function matchClueGroups<T extends ClueGroup>(groups: readonly T[], maxChoices = 100_000, requireAll = false) {
  const owners = new Map<string, number[]>();
  groups.forEach((group, id) => { for (const resource of new Set(group.options.flatMap((o) => o.resources))) owners.set(resource, [...(owners.get(resource) ?? []), id]); });
  const selected = new Map<T, ClueOption>();
  const seen = new Set<number>();
  let choices = 0; let exhaustive = true;
  for (let root = 0; root < groups.length; root += 1) {
    if (seen.has(root)) continue;
    const component = [root]; seen.add(root);
    const resources = new Set<string>();
    for (let i = 0; i < component.length; i += 1) for (const option of groups[component[i]].options) for (const resource of option.resources) {
      resources.add(resource);
      for (const id of owners.get(resource) ?? []) if (!seen.has(id)) { seen.add(id); component.push(id); }
    }
    const singles = component.map((id) => groups[id]).filter((g) => g.directions.length === 1).sort((a, b) => a.options.length - b.options.length);
    const doubles = component.map((id) => groups[id]).filter((g) => g.directions.length === 2).sort((a, b) => a.options.length - b.options.length);
    let upperBound = Math.min(resources.size, singles.length + 2 * doubles.length);
    const reserved = new Set<string>();
    const chosen = new Map<T, ClueOption>();
    let best = new Map<T, ClueOption>(); let bestCount = -1; let truncated = false;
    const completeSingles = () => {
      const claimed = new Map<string, T>();
      const options = new Map<T, ClueOption>();
      const augment = (group: T, visited: Set<string>): boolean => {
        for (const option of group.options) {
          const resource = option.resources[0];
          if (reserved.has(resource) || visited.has(resource)) continue;
          visited.add(resource);
          const previous = claimed.get(resource);
          if (!previous || augment(previous, visited)) { claimed.set(resource, group); options.set(group, option); return true; }
        }
        return false;
      };
      for (const group of singles) if (!augment(group, new Set()) && requireAll) return false;
      const count = reserved.size + claimed.size;
      if (count > bestCount) { bestCount = count; best = new Map([...chosen, ...options]); }
      return true;
    };
    // A cheap incumbent is available even when the branching budget is zero.
    for (const group of doubles) {
      const option = group.options.find((o) => o.resources.every((r) => !reserved.has(r)));
      if (option) { chosen.set(group, option); for (const r of option.resources) reserved.add(r); }
    }
    completeSingles(); chosen.clear(); reserved.clear();
    if (bestCount < upperBound) {
      // Relax only the coupling between a double's two clue positions. This
      // bipartite maximum is an admissible upper bound, often proving the
      // incumbent optimal even when unrelated Hall deficits prevent a full fit.
      const answers = component.flatMap((id) => groups[id].directions.map((_, direction) =>
        [...new Set(groups[id].options.map((o) => o.resources[direction]))],
      ));
      const claimed = new Map<string, number>();
      const augment = (answer: number, visited: Set<string>): boolean => {
        for (const resource of answers[answer]) {
          if (visited.has(resource)) continue;
          visited.add(resource);
          const previous = claimed.get(resource);
          if (previous === undefined || augment(previous, visited)) { claimed.set(resource, answer); return true; }
        }
        return false;
      };
      answers.forEach((_, id) => augment(id, new Set()));
      upperBound = claimed.size;
    }
    const search = (index: number) => {
      if (bestCount === upperBound || reserved.size + 2 * (doubles.length - index) + singles.length <= bestCount) return;
      if (index === doubles.length) { completeSingles(); return; }
      if (choices >= maxChoices) { truncated = true; return; }
      choices += 1;
      // A reserved double can already make singles impossible. Detect that
      // Hall deficit before enumerating the remaining double combinations.
      if (requireAll && reserved.size && !completeSingles()) return;
      const group = doubles[index];
      for (const option of group.options) {
        if (option.resources.some((r) => reserved.has(r))) continue;
        chosen.set(group, option); for (const r of option.resources) reserved.add(r);
        search(index + 1);
        chosen.delete(group); for (const r of option.resources) reserved.delete(r);
        if (bestCount === upperBound) return;
      }
      // Partial diagnostics may leave a double unmatched to cover other answers.
      if (!requireAll) search(index + 1);
    };
    if (!requireAll || upperBound === singles.length + 2 * doubles.length) search(0);
    if (truncated && bestCount < upperBound) exhaustive = false;
    for (const [group, option] of best) selected.set(group, option);
  }
  return { selected, exhaustive, choices };
}
