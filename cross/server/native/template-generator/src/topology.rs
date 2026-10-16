use crate::model::*;

pub fn scan_line(mask: &Mask, line: usize, down: bool, min: usize) -> Vec<Run> {
    let size = if down { mask.rows } else { mask.cols };
    let mut runs = Vec::new();
    let mut offset = 0;
    while offset < size {
        let mut cells = Vec::new();
        while offset < size {
            let cell = if down {
                offset * mask.cols + line
            } else {
                line * mask.cols + offset
            };
            if mask.barrier(cell) {
                break;
            }
            cells.push(cell);
            offset += 1;
        }
        if cells.len() >= min && cells.len() <= 11 {
            runs.push(Run {
                start: cells[0],
                down,
                cells: cells.into(),
            });
        }
        offset += 1;
    }
    runs
}
pub fn scan(mask: &Mask, min: usize) -> Vec<Run> {
    let mut runs: Vec<_> = (0..mask.rows)
        .flat_map(|r| scan_line(mask, r, false, min))
        .collect();
    let mut v: Vec<_> = (0..mask.cols)
        .flat_map(|c| scan_line(mask, c, true, min))
        .collect();
    v.sort_by_key(|s| s.start);
    runs.extend(v);
    runs
}
pub struct RunIndex {
    horizontal: Vec<Vec<Run>>,
    vertical: Vec<Vec<Run>>,
    min: usize,
}
impl RunIndex {
    pub fn new(mask: &Mask, min: usize) -> Self {
        Self {
            horizontal: (0..mask.rows)
                .map(|r| scan_line(mask, r, false, min))
                .collect(),
            vertical: (0..mask.cols)
                .map(|c| scan_line(mask, c, true, min))
                .collect(),
            min,
        }
    }
    pub fn runs(&self, mask: &Mask, changed: &[usize]) -> Vec<Run> {
        let mut rows = vec![false; mask.rows];
        let mut cols = vec![false; mask.cols];
        for &i in changed {
            rows[i / mask.cols] = true;
            cols[i % mask.cols] = true;
        }
        let mut result = Vec::new();
        for (r, runs) in self.horizontal.iter().enumerate() {
            if rows[r] {
                result.extend(scan_line(mask, r, false, self.min));
            } else {
                result.extend(runs.iter().cloned());
            }
        }
        let mut vertical = Vec::new();
        for (c, runs) in self.vertical.iter().enumerate() {
            if cols[c] {
                vertical.extend(scan_line(mask, c, true, self.min));
            } else {
                vertical.extend(runs.iter().cloned());
            }
        }
        vertical.sort_by_key(|s| s.start);
        result.extend(vertical);
        result
    }
    pub fn commit(&mut self, mask: &Mask, changed: &[usize]) {
        let mut rows = vec![false; mask.rows];
        let mut cols = vec![false; mask.cols];
        for &i in changed {
            rows[i / mask.cols] = true;
            cols[i % mask.cols] = true;
        }
        for (r, changed) in rows.iter().enumerate() {
            if *changed {
                self.horizontal[r] = scan_line(mask, r, false, self.min);
            }
        }
        for (c, changed) in cols.iter().enumerate() {
            if *changed {
                self.vertical[c] = scan_line(mask, c, true, self.min);
            }
        }
    }
}
pub fn memberships(mask: &Mask, runs: &[Run]) -> (Vec<usize>, Vec<usize>, Vec<usize>) {
    let mut h = vec![NONE; mask.cells.len()];
    let mut v = h.clone();
    for (id, run) in runs.iter().enumerate() {
        for &i in run.cells.iter() {
            if run.down {
                v[i] = id;
            } else {
                h[i] = id;
            }
        }
    }
    let mut counts = vec![0; runs.len()];
    for i in 0..h.len() {
        if h[i] != NONE && v[i] != NONE {
            counts[h[i]] += 1;
            counts[v[i]] += 1;
        }
    }
    (h, v, counts)
}
pub fn matching_arrows<'a>(arrows: &'a [Arrow], dirs: &[u8]) -> impl Iterator<Item = &'a Arrow> {
    let wanted = dirs.iter().fold(0u16, |v, &d| v | (1u16 << d));
    arrows
        .iter()
        .filter(move |a| a.directions.iter().fold(0u16, |v, &d| v | (1u16 << d)) == wanted)
}
pub fn fits(mask: &Mask, start: usize, arrow: &Arrow) -> bool {
    arrow.offsets.iter().all(|p| {
        mask.offset(start, p[0], p[1])
            .is_some_and(|i| mask.cells[i] == CLUE)
    })
}
pub fn first_code(mask: &Mask, start: usize, dirs: &[u8], arrows: &[Arrow]) -> Option<u16> {
    matching_arrows(arrows, dirs)
        .find(|a| fits(mask, start, a))
        .map(|a| a.code)
}
pub fn evaluate(mask: &Mask, input: Vec<Run>, arrows: &[Arrow]) -> Option<Evaluation> {
    let mut short = 0;
    let runs: Vec<_> = input
        .into_iter()
        .filter(|r| {
            if r.cells.len() != 2 {
                true
            } else {
                short += 1;
                short == 1
            }
        })
        .collect();
    let (h, v, counts) = memberships(mask, &runs);
    let mut seen = vec![false; runs.len()];
    let mut largest = Vec::new();
    for root in 0..runs.len() {
        if counts[root] < 2 || seen[root] {
            continue;
        }
        let mut component = vec![root];
        seen[root] = true;
        let mut at = 0;
        while at < component.len() {
            let run = &runs[component[at]];
            at += 1;
            for &i in run.cells.iter() {
                let other = if run.down { h[i] } else { v[i] };
                if other != NONE && counts[other] >= 2 && !seen[other] {
                    seen[other] = true;
                    component.push(other);
                }
            }
        }
        if component.len() > largest.len() {
            largest = component;
        }
    }
    if largest.is_empty() {
        return None;
    }
    let mut selected = vec![false; runs.len()];
    for &i in &largest {
        selected[i] = true;
    }
    let mut intersections = 0;
    let mut actual = vec![0; runs.len()];
    for i in 0..mask.cells.len() {
        let ih = h[i] != NONE && selected[h[i]];
        let iv = v[i] != NONE && selected[v[i]];
        if mask.cells[i] == LETTER && !ih && !iv {
            return None;
        }
        if ih && iv {
            intersections += 1;
            actual[h[i]] += 1;
            actual[v[i]] += 1;
        }
    }
    let valid = largest.iter().all(|&id| actual[id] >= 2);
    let runs: Vec<_> = runs
        .into_iter()
        .enumerate()
        .filter_map(|(i, r)| if selected[i] { Some(r) } else { None })
        .collect();
    let mut starts = vec![Vec::new(); mask.cells.len()];
    for run in &runs {
        starts[run.start].push(if run.down { 8 } else { 6 });
    }
    let mut codes = vec![0; mask.cells.len()];
    for (i, dirs) in starts.iter().enumerate() {
        if !dirs.is_empty() {
            codes[i] = first_code(mask, i, dirs, arrows)?;
        }
    }
    let mut distribution = [0; 12];
    for run in &runs {
        distribution[run.cells.len()] += 1;
    }
    Some(Evaluation {
        mask: mask.clone(),
        runs,
        codes,
        intersections,
        distribution,
        valid,
        rendered_slots: Default::default(),
    })
}
pub fn assign(mask: &Mask, min: usize, arrows: &[Arrow]) -> Option<Evaluation> {
    evaluate(mask, scan(mask, min), arrows)
}

/** Independent final scan of the materialized arrow codes, including coverage. */
pub fn verify(e: &Evaluation, arrows: &[Arrow]) -> Option<Evaluation> {
    let slots = e.scan_slots(arrows);
    if slots.is_empty()
        || slots.iter().any(|s| s.cells.len() > 11)
        || slots.iter().filter(|s| s.cells.len() == 2).count() > 1
    {
        return None;
    }
    let (h, v, counts) = memberships(&e.mask, &slots);
    if counts.iter().any(|&n| n < 2) {
        return None;
    }
    let mut seen = vec![false; slots.len()];
    let mut queue = vec![0];
    seen[0] = true;
    let mut at = 0;
    while at < queue.len() {
        let id = queue[at];
        at += 1;
        for &cell in slots[id].cells.iter() {
            let other = if slots[id].down { h[cell] } else { v[cell] };
            if other != NONE && !seen[other] {
                seen[other] = true;
                queue.push(other);
            }
        }
    }
    if queue.len() != slots.len()
        || (0..e.mask.cells.len())
            .any(|i| e.mask.cells[i] == LETTER && h[i] == NONE && v[i] == NONE)
    {
        return None;
    }
    let intersections = (0..h.len())
        .filter(|&i| h[i] != NONE && v[i] != NONE)
        .count();
    let mut distribution = [0; 12];
    for s in &slots {
        distribution[s.cells.len()] += 1;
    }
    Some(Evaluation {
        mask: e.mask.clone(),
        runs: slots,
        codes: e.codes.clone(),
        intersections,
        distribution,
        valid: true,
        rendered_slots: Default::default(),
    })
}
