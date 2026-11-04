use crate::model::*;

pub fn scan_line(mask: &Mask, line: usize, down: bool) -> Vec<Run> {
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
        if cells.len() >= 2 {
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
pub fn scan(mask: &Mask) -> Vec<Run> {
    let mut runs: Vec<_> = (0..mask.rows)
        .flat_map(|r| scan_line(mask, r, false))
        .collect();
    let mut v: Vec<_> = (0..mask.cols)
        .flat_map(|c| scan_line(mask, c, true))
        .collect();
    v.sort_by_key(|s| s.start);
    runs.extend(v);
    runs
}
pub struct RunIndex {
    horizontal: Vec<Vec<Run>>,
    vertical: Vec<Vec<Run>>,
}
impl RunIndex {
    pub fn new(mask: &Mask) -> Self {
        Self {
            horizontal: (0..mask.rows).map(|r| scan_line(mask, r, false)).collect(),
            vertical: (0..mask.cols).map(|c| scan_line(mask, c, true)).collect(),
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
                result.extend(scan_line(mask, r, false));
            } else {
                result.extend(runs.iter().cloned());
            }
        }
        let mut vertical = Vec::new();
        for (c, runs) in self.vertical.iter().enumerate() {
            if cols[c] {
                vertical.extend(scan_line(mask, c, true));
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
                self.horizontal[r] = scan_line(mask, r, false);
            }
        }
        for (c, changed) in cols.iter().enumerate() {
            if *changed {
                self.vertical[c] = scan_line(mask, c, true);
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
pub fn matching_arrows<'a>(arrows: &'a ArrowTable, dirs: &[u8]) -> impl Iterator<Item = &'a Arrow> {
    arrows.matching(dirs)
}
pub fn fits(mask: &Mask, start: usize, arrow: &Arrow) -> bool {
    arrow.offsets.iter().all(|p| {
        mask.offset(start, p[0], p[1])
            .is_some_and(|i| mask.cells[i] == CLUE)
    })
}
pub fn first_code(mask: &Mask, start: usize, dirs: &[u8], arrows: &ArrowTable) -> Option<u16> {
    matching_arrows(arrows, dirs)
        .find(|a| fits(mask, start, a))
        .map(|a| a.code)
}
pub fn evaluate(mask: &Mask, input: Vec<Run>, arrows: &ArrowTable) -> Option<Evaluation> {
    let runs = input;
    if runs.iter().any(|r| r.cells.len() > 11)
        || runs.iter().filter(|r| r.cells.len() == 2).count() > 1
    {
        return None;
    }
    let (h, v, counts) = memberships(mask, &runs);
    if runs.is_empty() || counts.iter().any(|&count| count < 2) {
        return None;
    }
    let mut seen = vec![false; runs.len()];
    let mut queue = vec![0];
    seen[0] = true;
    let mut at = 0;
    while at < queue.len() {
        let run = &runs[queue[at]];
        at += 1;
        for &i in run.cells.iter() {
            let other = if run.down { h[i] } else { v[i] };
            if other != NONE && !seen[other] {
                seen[other] = true;
                queue.push(other);
            }
        }
    }
    if queue.len() != runs.len() {
        return None;
    }
    let mut intersections = 0;
    for i in 0..mask.cells.len() {
        if mask.cells[i] == LETTER && h[i] == NONE && v[i] == NONE {
            return None;
        }
        if h[i] != NONE && v[i] != NONE {
            intersections += 1;
        }
    }
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
        valid: true,
        rendered_slots: Default::default(),
    })
}
pub fn assign(mask: &Mask, arrows: &ArrowTable) -> Option<Evaluation> {
    evaluate(mask, scan(mask), arrows)
}

/** Independent final scan of the materialized arrow codes, including coverage. */
pub fn verify(e: &Evaluation, arrows: &ArrowTable) -> Option<Evaluation> {
    let slots = e.scan_slots(arrows);
    if slots.is_empty()
        || slots.iter().any(|s| s.cells.len() > 11)
        || slots.iter().filter(|s| s.cells.len() == 2).count() > 1
    {
        return None;
    }
    let expected = scan(&e.mask);
    if expected.len() != slots.len() || expected.iter().any(|run| !slots.contains(run)) {
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
