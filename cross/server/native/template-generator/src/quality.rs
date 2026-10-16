use crate::geometry::photo_cells;
use crate::model::*;
use crate::topology::memberships;
use std::collections::BTreeMap;

#[derive(Clone)]
pub struct Edges {
    pub top_along: usize,
    pub top_inward: usize,
    pub left_along: usize,
    pub left_inward: usize,
    pub top_eligible: bool,
    pub left_eligible: bool,
    pub penalty: f64,
    pub deficit: usize,
}
pub fn edges(e: &Evaluation, photos: &[bool], slots: &[Run]) -> Edges {
    let m = &e.mask;
    let eligible = |horizontal: bool| {
        let size = if horizontal { m.cols } else { m.rows };
        let depth = 3.min(if horizontal { m.rows } else { m.cols });
        let mut best = 0;
        let mut run = 0;
        for i in 0..size {
            let available = (0..depth).all(|d| {
                let cell = if horizontal {
                    d * m.cols + i
                } else {
                    i * m.cols + d
                };
                m.cells[cell] != CUTOUT && !photos[cell]
            });
            run = if available { run + 1 } else { 0 };
            best = best.max(run);
        }
        best >= 8
    };
    let mut result = Edges {
        top_along: 0,
        top_inward: 0,
        left_along: 0,
        left_inward: 0,
        top_eligible: eligible(true),
        left_eligible: eligible(false),
        penalty: 0.0,
        deficit: 0,
    };
    for s in slots {
        if s.start / m.cols == 0 {
            if s.down {
                result.top_inward += 1;
            } else {
                result.top_along += 1;
            }
        }
        if s.start % m.cols == 0 {
            if s.down {
                result.left_along += 1;
            } else {
                result.left_inward += 1;
            }
        }
    }
    let mut count = 0;
    for (active, along, inward) in [
        (result.top_eligible, result.top_along, result.top_inward),
        (result.left_eligible, result.left_along, result.left_inward),
    ] {
        if !active {
            continue;
        }
        count += 1;
        if along == 0 {
            result.deficit += 1;
        }
        let share = along as f64 / (along + inward).max(1) as f64;
        result.penalty += if inward == 0 {
            1.0
        } else {
            (0.15 - share).max(0.0) / 0.15 + (share - 0.6).max(0.0) / 0.4
        };
    }
    result.penalty /= count.max(1) as f64;
    result
}
fn bridge_visit(
    node: usize,
    parent: usize,
    graph: &[Vec<usize>],
    entered: &mut [usize],
    low: &mut [usize],
    time: &mut usize,
    bridges: &mut usize,
) {
    entered[node] = *time;
    low[node] = *time;
    *time += 1;
    for &next in &graph[node] {
        if next == parent {
            continue;
        }
        if entered[next] == NONE {
            bridge_visit(next, node, graph, entered, low, time, bridges);
            low[node] = low[node].min(low[next]);
            if low[next] > entered[node] {
                *bridges += 1;
            }
        } else {
            low[node] = low[node].min(entered[next]);
        }
    }
}
pub fn quality(
    e: &Evaluation,
    pictures: &[Picture],
    weights: Option<&BTreeMap<usize, f64>>,
    arrows: &[Arrow],
) -> Quality {
    let photos = photo_cells(&e.mask, pictures);
    with_photos(e, pictures, weights, arrows, &photos)
}
pub fn with_photos(
    e: &Evaluation,
    pictures: &[Picture],
    weights: Option<&BTreeMap<usize, f64>>,
    arrows: &[Arrow],
    photos: &[bool],
) -> Quality {
    let m = &e.mask;
    let total = e.runs.len().max(1) as f64;
    let deviation = if weights.is_some() {
        (2..=11)
            .map(|n| (e.distribution[n] as f64 / total - weight(weights, n)).abs())
            .sum::<f64>()
            / 2.0
    } else {
        0.0
    };
    let is_clue = |i: usize| m.cells[i] == CLUE && !photos[i];
    let mut counts = [0usize; 4];
    let mut areas = [0usize; 4];
    let mut clues = 0;
    let mut isolated = 0;
    for (i, &photo) in photos.iter().enumerate() {
        if photo || m.cells[i] == CUTOUT {
            continue;
        }
        let (r, c) = (i / m.cols, i % m.cols);
        let quadrant = usize::from(r as f64 >= m.rows as f64 / 2.0) * 2
            + usize::from(c as f64 >= m.cols as f64 / 2.0);
        areas[quadrant] += 1;
        if !is_clue(i) {
            continue;
        }
        counts[quadrant] += 1;
        clues += 1;
        if ![(-1, 0), (1, 0), (0, -1), (0, 1)]
            .iter()
            .any(|&(dr, dc)| m.offset(i, dr, dc).is_some_and(is_clue))
        {
            isolated += 1;
        }
    }
    let isolated_share = isolated as f64 / clues.max(1) as f64;
    let density = clues as f64 / areas.iter().sum::<usize>().max(1) as f64;
    let imbalance = (0..4)
        .map(|i| (counts[i] as f64 - areas[i] as f64 * density).abs())
        .sum::<f64>()
        / (2 * clues).max(1) as f64;
    let picture_imbalance = if pictures.is_empty() {
        0.0
    } else {
        let x = pictures
            .iter()
            .map(|p| (p.col as f64 + p.width as f64 / 2.0) / m.cols as f64 - 0.5)
            .sum::<f64>()
            / pictures.len() as f64;
        let y = pictures
            .iter()
            .map(|p| (p.row as f64 + p.height as f64 / 2.0) / m.rows as f64 - 0.5)
            .sum::<f64>()
            / pictures.len() as f64;
        x.hypot(y) / std::f64::consts::FRAC_1_SQRT_2
    };
    let mut repetition: f64 = 0.0;
    for (dr, dc) in [
        (1, 1),
        (1, -1),
        (1, 2),
        (2, 1),
        (1, -2),
        (2, -1),
        (1, 3),
        (3, 1),
    ] {
        let mut pairs = 0;
        let mut matches = 0;
        for i in 0..m.cells.len() {
            if let Some(j) = m.offset(i, dr, dc) {
                if photos[i] || photos[j] || m.cells[i] == CUTOUT || m.cells[j] == CUTOUT {
                    continue;
                }
                if is_clue(i) {
                    pairs += 1;
                    if is_clue(j) {
                        matches += 1;
                    }
                }
            }
        }
        if pairs >= 4 {
            repetition = repetition.max(
                (matches as f64 / pairs as f64 - density).max(0.0) / (1.0 - density).max(0.01),
            );
        }
    }
    let slots = e.slots(arrows);
    let boundary = edges(e, photos, slots);
    let (h, v, _) = memberships(m, slots);
    let mut graph = vec![Vec::new(); slots.len()];
    for i in 0..m.cells.len() {
        if h[i] != NONE && v[i] != NONE {
            let (a, b) = (h[i], v[i]);
            if !graph[a].contains(&b) {
                graph[a].push(b);
                graph[b].push(a);
            }
        }
    }
    let mut entered = vec![NONE; slots.len()];
    let mut low = vec![0; slots.len()];
    let mut time = 0;
    let mut bridges = 0;
    for id in 0..slots.len() {
        if entered[id] == NONE {
            bridge_visit(
                id,
                NONE,
                &graph,
                &mut entered,
                &mut low,
                &mut time,
                &mut bridges,
            );
        }
    }
    let bottleneck = bridges as f64 / slots.len().saturating_sub(1).max(1) as f64;
    let doubles = e
        .codes
        .iter()
        .filter(|&&code| {
            code != 0
                && arrows
                    .iter()
                    .any(|a| a.code == code && a.directions.len() == 2)
        })
        .count();
    let double_dev =
        (doubles as isize - double_target(e.runs.len()) as isize).unsigned_abs() as f64;
    let short = if weights.is_some() {
        (e.distribution[3] as f64 / total - weight(weights, 3)).max(0.0)
    } else {
        0.0
    };
    let score = deviation
        + 3.0 * short
        + 0.15 * isolated_share
        + 0.375 * double_dev
        + 0.2 * imbalance
        + 0.1 * picture_imbalance
        + 0.15 * repetition
        + 0.25 * bottleneck
        + 0.35 * boundary.penalty;
    Quality {
        quality_version: 3,
        length_deviation: deviation,
        isolated_clue_share: isolated_share,
        double_arrow_count: doubles,
        spatial_imbalance: imbalance,
        picture_imbalance,
        repetition,
        bottleneck_share: bottleneck,
        edge_direction_penalty: boundary.penalty,
        edge_direction_deficit: boundary.deficit,
        top_edge_along_words: boundary.top_along,
        left_edge_along_words: boundary.left_along,
        quality_score: score,
    }
}
pub fn supply(
    e: &Evaluation,
    counts: Option<&BTreeMap<usize, usize>>,
    weights: Option<&BTreeMap<usize, f64>>,
) -> usize {
    let Some(counts) = counts else {
        return 0;
    };
    let max = counts.values().copied().max().unwrap_or(0);
    let scarce = weights.is_some() && (*counts.get(&3).unwrap_or(&0) as f64) < max as f64 / 2.0;
    let limit = if scarce {
        (e.runs.len() as f64 * 0.06f64.max(weight(weights, 3) * 2.0 + 0.03)).ceil() as usize + 1
    } else {
        usize::MAX
    };
    (2..=11)
        .map(|n| {
            e.distribution[n].saturating_sub((*counts.get(&n).unwrap_or(&0)).min(if n == 3 {
                limit
            } else {
                usize::MAX
            }))
        })
        .sum()
}
