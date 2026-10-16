use crate::model::*;
use crate::topology::{fits, matching_arrows};

#[derive(Clone)]
pub struct OptionClue {
    pub code: u16,
    pub resources: Vec<usize>,
}
#[derive(Clone)]
pub struct Group {
    pub start: usize,
    pub dirs: Vec<u8>,
    pub options: Vec<OptionClue>,
}
pub struct Problem {
    pub groups: Vec<Group>,
    pub resources: Vec<Option<usize>>,
}
pub fn problem(e: &Evaluation, pictures: &[Picture], arrows: &[Arrow]) -> Problem {
    let mask = &e.mask;
    let mut by_cell = vec![NONE; mask.cells.len()];
    let mut resources = vec![None; pictures.len()];
    for (id, p) in pictures.iter().enumerate() {
        for r in p.row..p.row + p.height {
            for c in p.col..p.col + p.width {
                by_cell[r * mask.cols + c] = id;
            }
        }
    }
    for (i, &cell) in mask.cells.iter().enumerate() {
        if cell == CLUE && by_cell[i] == NONE {
            by_cell[i] = resources.len();
            resources.push(Some(i));
        }
    }
    let mut starts = vec![NONE; mask.cells.len()];
    let mut groups: Vec<Group> = Vec::new();
    for slot in e.slots(arrows) {
        let i = slot.start;
        if starts[i] == NONE {
            starts[i] = groups.len();
            groups.push(Group {
                start: i,
                dirs: Vec::new(),
                options: Vec::new(),
            });
        }
        groups[starts[i]].dirs.push(if slot.down { 8 } else { 6 });
    }
    for group in &mut groups {
        for arrow in matching_arrows(arrows, &group.dirs) {
            if !fits(mask, group.start, arrow) {
                continue;
            }
            let ids: Vec<_> = arrow
                .offsets
                .iter()
                .map(|p| by_cell[mask.offset(group.start, p[0], p[1]).unwrap()])
                .collect();
            if ids.contains(&NONE) || (ids.len() == 2 && ids[0] == ids[1]) {
                continue;
            }
            group.options.push(OptionClue {
                code: arrow.code,
                resources: ids,
            });
        }
    }
    Problem { groups, resources }
}
pub struct Match {
    pub selected: Vec<Option<usize>>,
    pub exhaustive: bool,
    pub choices: usize,
}
fn augment(
    group: usize,
    groups: &[Group],
    reserved: &[bool],
    seen: &mut [usize],
    stamp: usize,
    claimed: &mut [usize],
    selected: &mut [Option<usize>],
) -> bool {
    for (option, choice) in groups[group].options.iter().enumerate() {
        let r = choice.resources[0];
        if reserved[r] || seen[r] == stamp {
            continue;
        }
        seen[r] = stamp;
        if claimed[r] == NONE
            || augment(claimed[r], groups, reserved, seen, stamp, claimed, selected)
        {
            claimed[r] = group;
            selected[group] = Some(option);
            return true;
        }
    }
    false
}
fn relaxed_augment(
    id: usize,
    answers: &[Vec<usize>],
    seen: &mut [usize],
    stamp: usize,
    claimed: &mut [usize],
) -> bool {
    for &r in &answers[id] {
        if seen[r] == stamp {
            continue;
        }
        seen[r] = stamp;
        if claimed[r] == NONE || relaxed_augment(claimed[r], answers, seen, stamp, claimed) {
            claimed[r] = id;
            return true;
        }
    }
    false
}
struct Component<'a> {
    groups: &'a [Group],
    singles: Vec<usize>,
    doubles: Vec<usize>,
    reserved: Vec<bool>,
    chosen: Vec<Option<usize>>,
    best: Vec<Option<usize>>,
    best_count: isize,
    upper: usize,
    require_all: bool,
    max_choices: usize,
    choices: &'a mut usize,
    truncated: bool,
    control: &'a Control,
}
impl Component<'_> {
    fn singles(&mut self) -> bool {
        let mut claimed = vec![NONE; self.reserved.len()];
        let mut selected = vec![None; self.groups.len()];
        let mut seen = vec![NONE; claimed.len()];
        for &g in &self.singles {
            if !augment(
                g,
                self.groups,
                &self.reserved,
                &mut seen,
                g,
                &mut claimed,
                &mut selected,
            ) && self.require_all
            {
                return false;
            }
        }
        let count = self.reserved.iter().filter(|&&v| v).count()
            + claimed.iter().filter(|&&v| v != NONE).count();
        if count as isize > self.best_count {
            self.best_count = count as isize;
            self.best.clone_from(&self.chosen);
            for &g in &self.singles {
                self.best[g] = selected[g];
            }
        }
        true
    }
    fn search(&mut self, index: usize) {
        let reserved = self.reserved.iter().filter(|&&v| v).count();
        if self.best_count == self.upper as isize
            || (reserved + 2 * (self.doubles.len() - index) + self.singles.len()) as isize
                <= self.best_count
        {
            return;
        }
        if self.control.stopped() {
            self.truncated = true;
            return;
        }
        if index == self.doubles.len() {
            self.singles();
            return;
        }
        if *self.choices >= self.max_choices {
            self.truncated = true;
            return;
        }
        *self.choices += 1;
        if self.require_all && reserved > 0 && !self.singles() {
            return;
        }
        let group = self.doubles[index];
        for option in 0..self.groups[group].options.len() {
            let ids = &self.groups[group].options[option].resources;
            if ids.iter().any(|&r| self.reserved[r]) {
                continue;
            }
            self.chosen[group] = Some(option);
            for &r in ids {
                self.reserved[r] = true;
            }
            self.search(index + 1);
            self.chosen[group] = None;
            for &r in &self.groups[group].options[option].resources {
                self.reserved[r] = false;
            }
            if self.best_count == self.upper as isize {
                return;
            }
        }
        if !self.require_all {
            self.search(index + 1);
        }
    }
}
pub fn match_groups(
    groups: &[Group],
    resource_count: usize,
    max_choices: usize,
    require_all: bool,
    control: &Control,
) -> Match {
    let mut owners = vec![Vec::new(); resource_count];
    let mut seen = vec![NONE; resource_count];
    for (g, group) in groups.iter().enumerate() {
        for option in &group.options {
            for &r in &option.resources {
                if seen[r] != g {
                    seen[r] = g;
                    owners[r].push(g);
                }
            }
        }
    }
    let mut selected = vec![None; groups.len()];
    let mut visited = vec![false; groups.len()];
    let mut choices = 0;
    let mut exhaustive = true;
    let mut resource_marks = vec![NONE; resource_count];
    let mut resource_local = vec![NONE; resource_count];
    for root in 0..groups.len() {
        if visited[root] {
            continue;
        }
        let mut component = vec![root];
        visited[root] = true;
        let mut resource_ids = Vec::new();
        let mut at = 0;
        while at < component.len() {
            let g = component[at];
            at += 1;
            for o in &groups[g].options {
                for &r in &o.resources {
                    if resource_marks[r] == root {
                        continue;
                    }
                    resource_marks[r] = root;
                    resource_ids.push(r);
                    for &id in &owners[r] {
                        if !visited[id] {
                            visited[id] = true;
                            component.push(id);
                        }
                    }
                }
            }
        }
        // Solve each conflict component in its own compact index space. Most components
        // contain one or two starts; global-sized work arrays made those quadratic.
        resource_ids.sort_unstable();
        for (local, &global) in resource_ids.iter().enumerate() {
            resource_local[global] = local;
        }
        let compact = component.len() * 2 < groups.len();
        let local_groups: Vec<_> = if compact {
            component
                .iter()
                .map(|&g| Group {
                    start: groups[g].start,
                    dirs: groups[g].dirs.clone(),
                    options: groups[g]
                        .options
                        .iter()
                        .map(|o| OptionClue {
                            code: o.code,
                            resources: o.resources.iter().map(|&r| resource_local[r]).collect(),
                        })
                        .collect(),
                })
                .collect()
        } else {
            Vec::new()
        };
        let local_ids: Vec<_> = if compact {
            (0..local_groups.len()).collect()
        } else {
            component.clone()
        };
        let groups = if compact { &local_groups } else { groups };
        let resource_count = if compact {
            resource_ids.len()
        } else {
            resource_count
        };
        let mut singles: Vec<_> = local_ids
            .iter()
            .copied()
            .filter(|&g| groups[g].dirs.len() == 1)
            .collect();
        singles.sort_by_key(|&g| groups[g].options.len());
        let mut doubles: Vec<_> = local_ids
            .iter()
            .copied()
            .filter(|&g| groups[g].dirs.len() == 2)
            .collect();
        doubles.sort_by_key(|&g| groups[g].options.len());
        let upper = resource_ids.len().min(singles.len() + 2 * doubles.len());
        let mut state = Component {
            groups,
            singles,
            doubles,
            reserved: vec![false; resource_count],
            chosen: vec![None; groups.len()],
            best: vec![None; groups.len()],
            best_count: -1,
            upper,
            require_all,
            max_choices,
            choices: &mut choices,
            truncated: false,
            control,
        };
        for &g in &state.doubles {
            if let Some((o, ids)) = groups[g]
                .options
                .iter()
                .enumerate()
                .find(|(_, o)| o.resources.iter().all(|&r| !state.reserved[r]))
            {
                state.chosen[g] = Some(o);
                for &r in &ids.resources {
                    state.reserved[r] = true;
                }
            }
        }
        state.singles();
        state.chosen.fill(None);
        state.reserved.fill(false);
        if state.best_count < state.upper as isize {
            let mut answers = Vec::new();
            for &g in &local_ids {
                for dir in 0..groups[g].dirs.len() {
                    let mut ids = Vec::new();
                    for o in &groups[g].options {
                        let r = o.resources[dir];
                        if !ids.contains(&r) {
                            ids.push(r);
                        }
                    }
                    answers.push(ids);
                }
            }
            let mut claimed = vec![NONE; resource_count];
            let mut seen = vec![NONE; resource_count];
            for id in 0..answers.len() {
                relaxed_augment(id, &answers, &mut seen, id, &mut claimed);
            }
            state.upper = claimed.iter().filter(|&&g| g != NONE).count();
        }
        if !require_all || state.upper == state.singles.len() + 2 * state.doubles.len() {
            state.search(0);
        }
        if state.truncated && state.best_count < state.upper as isize {
            exhaustive = false;
        }
        for (&local, &global) in local_ids.iter().zip(&component) {
            selected[global] = state.best[local];
        }
    }
    Match {
        selected,
        exhaustive,
        choices,
    }
}
#[derive(Clone)]
pub struct Diagnostic {
    pub answers: usize,
    pub resources: usize,
    pub doubles: usize,
    pub bad: usize,
    pub unmatched: usize,
    pub focus: Vec<usize>,
    pub exhaustive: bool,
    pub choices: usize,
}
pub fn diagnose(
    e: &Evaluation,
    pictures: &[Picture],
    arrows: &[Arrow],
    control: &Control,
) -> Diagnostic {
    let p = problem(e, pictures, arrows);
    let matched = match_groups(&p.groups, p.resources.len(), 16, false, control);
    let mut possible = vec![false; p.resources.len()];
    let mut used = possible.clone();
    for (g, group) in p.groups.iter().enumerate() {
        for o in &group.options {
            for &r in &o.resources {
                possible[r] = true;
            }
        }
        if let Some(o) = matched.selected[g] {
            for &r in &group.options[o].resources {
                used[r] = true;
            }
        }
    }
    let no_option: Vec<_> = p
        .groups
        .iter()
        .filter(|g| g.options.is_empty())
        .map(|g| g.start)
        .collect();
    let mut focus = no_option.clone();
    for (g, group) in p.groups.iter().enumerate() {
        if matched.selected[g].is_none() {
            focus.push(group.start);
        }
    }
    for (r, cell) in p.resources.iter().enumerate() {
        if !possible[r] {
            if let Some(i) = cell {
                focus.push(*i);
            }
        }
    }
    for (r, cell) in p.resources.iter().enumerate() {
        if !used[r] {
            if let Some(i) = cell {
                focus.push(*i);
            }
        }
    }
    Diagnostic {
        answers: p.groups.iter().map(|g| g.dirs.len()).sum(),
        resources: p.resources.len(),
        doubles: p.groups.iter().filter(|g| g.dirs.len() == 2).count(),
        bad: no_option.len() + possible.iter().filter(|&&v| !v).count(),
        unmatched: matched.selected.iter().filter(|o| o.is_none()).count(),
        focus,
        exhaustive: matched.exhaustive,
        choices: matched.choices,
    }
}
pub fn assign_unique(
    e: &Evaluation,
    pictures: &[Picture],
    arrows: &[Arrow],
    control: &Control,
) -> Option<Evaluation> {
    let p = problem(e, pictures, arrows);
    if p.groups.iter().map(|g| g.dirs.len()).sum::<usize>() != p.resources.len()
        || p.groups.iter().any(|g| g.options.is_empty())
    {
        return None;
    }
    let matched = match_groups(&p.groups, p.resources.len(), 2048, true, control);
    if matched.selected.iter().any(Option::is_none) {
        return None;
    }
    let mut result = e.clone();
    for (g, choice) in matched.selected.iter().enumerate() {
        result.codes[p.groups[g].start] = p.groups[g].options[choice.unwrap()].code;
    }
    result.rendered_slots.take();
    // Independently recount the resources selected by the materialized codes.
    let actual = problem(&result, pictures, arrows);
    let mut counts = vec![0; actual.resources.len()];
    for g in &actual.groups {
        let o = g.options.iter().find(|o| o.code == result.codes[g.start])?;
        for &r in &o.resources {
            counts[r] += 1;
        }
    }
    if counts.iter().any(|&n| n != 1) {
        return None;
    }
    Some(result)
}
