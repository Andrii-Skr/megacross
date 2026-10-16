use crate::{geometry, model::*, topology};
use std::collections::HashSet;
fn add(mask: &Mask, fixed: &[bool], marked: &mut [bool], focus: &mut Vec<usize>, cell: usize) {
    for dr in -1..=1 {
        for dc in -1..=1 {
            if let Some(i) = mask.offset(cell, dr, dc) {
                if mask.cells[i] != CUTOUT && !fixed[i] && !marked[i] {
                    marked[i] = true;
                    focus.push(i);
                }
            }
        }
    }
}
fn inspect(mask: &Mask, fixed: &[bool], arrows: &[Arrow]) -> (f64, Vec<usize>) {
    let runs = topology::scan(mask, 3);
    let (h, v, cross) = topology::memberships(mask, &runs);
    let mut seen = vec![false; runs.len()];
    let mut components: usize = 0;
    for root in 0..runs.len() {
        if seen[root] {
            continue;
        }
        components += 1;
        let mut queue = vec![root];
        seen[root] = true;
        let mut at = 0;
        while at < queue.len() {
            let id = queue[at];
            at += 1;
            for &i in runs[id].cells.iter() {
                let other = if runs[id].down { h[i] } else { v[i] };
                if other != NONE && !seen[other] {
                    seen[other] = true;
                    queue.push(other);
                }
            }
        }
    }
    let mut focus = Vec::new();
    let mut marked = vec![false; mask.cells.len()];
    let mut uncovered = 0;
    for i in 0..mask.cells.len() {
        if mask.cells[i] == LETTER && h[i] == NONE && v[i] == NONE {
            uncovered += 1;
            add(mask, fixed, &mut marked, &mut focus, i);
            for (dr, dc) in [(1, 0), (0, 1)] {
                let mut root = i;
                while let Some(j) = mask.offset(root, -dr, -dc) {
                    if mask.cells[j] != LETTER {
                        break;
                    }
                    root = j;
                }
                let mut pos = Some(root);
                while let Some(j) = pos {
                    if mask.cells[j] != LETTER {
                        break;
                    }
                    add(mask, fixed, &mut marked, &mut focus, j);
                    pos = mask.offset(j, dr, dc);
                }
            }
        }
    }
    let mut weak = 0;
    for (id, r) in runs.iter().enumerate() {
        if cross[id] < 2 {
            weak += 1;
            for &i in r.cells.iter() {
                add(mask, fixed, &mut marked, &mut focus, i);
            }
        }
    }
    let mut dirs = vec![Vec::new(); mask.cells.len()];
    let mut ordered = Vec::new();
    for r in &runs {
        if dirs[r.start].is_empty() {
            ordered.push(r.start);
        }
        dirs[r.start].push(if r.down { 8 } else { 6 });
    }
    let mut missing = 0;
    for i in ordered {
        if topology::first_code(mask, i, &dirs[i], arrows).is_none() {
            missing += 1;
            add(mask, fixed, &mut marked, &mut focus, i);
        }
    }
    (
        (20 * uncovered + 4 * weak + 8 * missing + 6 * components.saturating_sub(1)) as f64,
        focus,
    )
}
pub fn repair(
    mask: &mut Mask,
    pictures: &[Picture],
    rng: &mut Rng,
    arrows: &[Arrow],
    control: &Control,
) -> bool {
    let fixed = geometry::photo_margin(mask, pictures);
    let mut state = inspect(mask, &fixed, arrows);
    let mut tabu = HashSet::new();
    for _ in 0..80 {
        if control.stopped() {
            return false;
        }
        if topology::assign(mask, 3, arrows).is_some() {
            return true;
        }
        if state.1.is_empty() {
            return false;
        }
        let mut choices: Vec<_> = state.1.iter().map(|&i| (i, rng.next())).collect();
        choices.sort_by(|a, b| a.1.total_cmp(&b.1));
        choices.truncate(40);
        let mut best: Option<(usize, f64)> = None;
        for (i, _) in choices {
            if control.stopped() {
                return false;
            }
            mask.flip(i);
            let score = if tabu.contains(&mask.cells) {
                f64::INFINITY
            } else {
                inspect(mask, &fixed, arrows).0
            };
            mask.flip(i);
            if best.is_none_or(|(_, s)| score < s) {
                best = Some((i, score));
            }
        }
        let Some((i, score)) = best else {
            return false;
        };
        if !score.is_finite() || score > state.0 + 12.0 {
            return false;
        }
        mask.flip(i);
        tabu.insert(mask.key());
        state = inspect(mask, &fixed, arrows);
    }
    topology::assign(mask, 3, arrows).is_some()
}
