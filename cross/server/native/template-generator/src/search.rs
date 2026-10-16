use crate::{geometry, matching, model::*, quality, repair, topology};
use std::collections::{HashMap, HashSet, VecDeque};
use std::sync::Arc;
use std::time::Instant;
fn record_elapsed(d: &mut Diagnostics, name: &str, started: Option<Instant>) {
    if let Some(started) = started {
        *d.entry(name.into()).or_default() += started.elapsed().as_secs_f64() * 1000.0;
    }
}
#[derive(Clone)]
struct State {
    gap: isize,
    bad: usize,
    target: usize,
    supply: usize,
    edge: usize,
    matching_possible: bool,
    score: f64,
}
#[derive(Clone)]
struct Trial {
    e: Evaluation,
    state: State,
    diagnostic: matching::Diagnostic,
}
#[derive(Clone)]
struct Move {
    changes: Vec<usize>,
    trial: Arc<Trial>,
}
struct Search<'a> {
    input: &'a Input,
    pictures: &'a [Picture],
    photos: Vec<bool>,
    control: &'a Control,
    d: &'a mut Diagnostics,
    visited: HashSet<Vec<u8>>,
    cache: HashMap<Vec<u8>, Option<Arc<Trial>>>,
    order: VecDeque<Vec<u8>>,
}
impl Search<'_> {
    fn weights(&self) -> Option<&std::collections::BTreeMap<usize, f64>> {
        if self.input.dictionary_counts.is_some() {
            self.input.weights.as_ref()
        } else {
            None
        }
    }
    fn inspect(&mut self, e: Evaluation) -> Option<Arc<Trial>> {
        if !e.valid || self.control.stopped() {
            return None;
        }
        let matching_started = self.input.profile.then(Instant::now);
        let own = matching::diagnose(&e, self.pictures, &self.input.arrows, self.control);
        record_elapsed(self.d, "matchingMs", matching_started);
        bump(self.d, "matchingSearchNodes", own.choices);
        if !own.exhaustive {
            bump(self.d, "matchingBudgetExhaustions", 1);
        }
        let gap = own.answers as isize - own.resources as isize;
        let supply = quality::supply(&e, self.input.dictionary_counts.as_ref(), self.weights());
        let quality_started = self.input.profile.then(Instant::now);
        let q = quality::with_photos(
            &e,
            self.pictures,
            self.weights(),
            &self.input.arrows,
            &self.photos,
        );
        record_elapsed(self.d, "qualityMs", quality_started);
        let feasibility = 4 * q.edge_direction_deficit
            + gap.unsigned_abs()
            + 5 * own.bad
            + 3 * own.unmatched
            + 5 * supply;
        let strength = if self.input.request.cutout_preset_id == "opposite-edge-bites" {
            1.0
        } else {
            3.0
        };
        let score = feasibility as f64
            + 8.0 * q.quality_score * (5.0 / (5.0 + feasibility as f64)) * strength / 3.0;
        Some(Arc::new(Trial {
            e,
            state: State {
                gap,
                bad: own.bad,
                target: double_target(own.answers),
                supply,
                edge: q.edge_direction_deficit,
                matching_possible: !own.exhaustive || own.unmatched == 0,
                score,
            },
            diagnostic: own,
        }))
    }
    fn evaluate(
        &mut self,
        m: &Mask,
        index: &topology::RunIndex,
        changed: &[usize],
    ) -> Option<Arc<Trial>> {
        if self.control.stopped() {
            return None;
        }
        let key = m.key();
        if self.visited.contains(&key) {
            return None;
        }
        if let Some(saved) = self.cache.get(&key) {
            bump(self.d, "cacheHits", 1);
            return saved.clone();
        }
        let topology_started = self.input.profile.then(Instant::now);
        let evaluation = topology::evaluate(m, index.runs(m, changed), &self.input.arrows);
        record_elapsed(self.d, "topologyMs", topology_started);
        let result = evaluation.and_then(|e| self.inspect(e));
        if self.cache.len() >= 512 {
            if let Some(old) = self.order.pop_front() {
                self.cache.remove(&old);
            }
        }
        self.order.push_back(key.clone());
        self.cache.insert(key, result.clone());
        bump(self.d, "evaluations", 1);
        result
    }
    fn singles(
        &mut self,
        m: &mut Mask,
        index: &topology::RunIndex,
        cells: &[usize],
        score: f64,
        uphill: bool,
    ) -> Option<Move> {
        let mut best: Option<Move> = None;
        for &i in cells {
            if self.control.stopped() {
                break;
            }
            m.flip(i);
            let trial = self.evaluate(m, index, &[i]);
            m.flip(i);
            if let Some(trial) = trial {
                if trial.state.score < score + if uphill { 8.0 } else { 0.0 }
                    && best
                        .as_ref()
                        .is_none_or(|b| trial.state.score < b.trial.state.score)
                {
                    best = Some(Move {
                        changes: vec![i],
                        trial,
                    });
                }
            }
        }
        best
    }
    fn regional(
        &mut self,
        m: &mut Mask,
        index: &topology::RunIndex,
        cells: &[usize],
        focus: &[usize],
        rng: &mut Rng,
        score: f64,
    ) -> Option<Move> {
        let mut allowed = vec![false; m.cells.len()];
        for &i in cells {
            allowed[i] = m.cells[i] != CUTOUT;
        }
        let anchors = if focus.is_empty() { cells } else { focus };
        if cells.is_empty() || anchors.is_empty() {
            return None;
        }
        let shapes = [(2, 3), (3, 2), (3, 3)];
        let offset = rng.int(3);
        let mut seen = HashSet::new();
        let mut trials = 0;
        let mut best: Option<Move> = None;
        for region in 0..6 {
            if trials >= 384 || self.control.stopped() {
                break;
            }
            let (height, width) = shapes[(region + offset) % 3];
            let anchor = anchors[rng.int(anchors.len())];
            let top = ((anchor / m.cols) as isize - rng.int(height) as isize)
                .clamp(0, m.rows.saturating_sub(height) as isize) as usize;
            let left = ((anchor % m.cols) as isize - rng.int(width) as isize)
                .clamp(0, m.cols.saturating_sub(width) as isize) as usize;
            let mut freed = Vec::new();
            for r in top..m.rows.min(top + height) {
                for c in left..m.cols.min(left + width) {
                    let i = r * m.cols + c;
                    if allowed[i] {
                        freed.push(i);
                    }
                }
            }
            if freed.len() < 3 || !seen.insert(freed.clone()) {
                continue;
            }
            let previous: Vec<_> = freed.iter().map(|&i| m.cells[i]).collect();
            for assignment in 1..(1usize << freed.len()) {
                if trials >= 384 || self.control.stopped() {
                    break;
                }
                let bits = assignment ^ (assignment >> 1);
                let mut changes = Vec::new();
                for (id, &i) in freed.iter().enumerate() {
                    m.cells[i] = previous[id];
                    if bits & (1 << id) != 0 {
                        m.flip(i);
                        changes.push(i);
                    }
                }
                if changes.len() < 3 {
                    continue;
                }
                trials += 1;
                if let Some(trial) = self.evaluate(m, index, &freed) {
                    if trial.state.score
                        < best.as_ref().map(|b| b.trial.state.score).unwrap_or(score)
                    {
                        best = Some(Move { changes, trial });
                    }
                }
            }
            for (id, &i) in freed.iter().enumerate() {
                m.cells[i] = previous[id];
            }
        }
        bump(self.d, "regionalRepairCalls", 1);
        bump(self.d, "regionalRepairTrials", trials);
        best
    }
}
fn balance(
    built: &geometry::Built,
    input: &Input,
    rng: &mut Rng,
    d: &mut Diagnostics,
    control: &Control,
) -> Option<(Evaluation, usize)> {
    let mut m = built.mask.clone();
    if topology::assign(&m, 3, &input.arrows).is_none()
        && !repair::repair(&mut m, &built.pictures, rng, &input.arrows, control)
    {
        bump(d, "repairRejected", 1);
        return None;
    }
    let weights = if input.dictionary_counts.is_some() {
        input.weights.as_ref()
    } else {
        None
    };
    let min = if weight(weights, 2) > 0.0
        && rng.next() < (weight(weights, 2) * m.cells.len() as f64).min(0.05)
    {
        2
    } else {
        3
    };
    let initial = topology::assign(&m, min, &input.arrows)?;
    let mut index = topology::RunIndex::new(&m, min);
    let area = m.cells.len();
    let iterations = area.div_ceil(12).clamp(24, 180);
    let limit = (area as f64 * 0.22).ceil().clamp(50.0, 200.0) as usize;
    let collar = geometry::photo_margin(&m, &built.pictures);
    let mut s = Search {
        input,
        pictures: &built.pictures,
        photos: geometry::photo_cells(&m, &built.pictures),
        control,
        d,
        visited: HashSet::new(),
        cache: HashMap::new(),
        order: VecDeque::new(),
    };
    let mut current = s.inspect(initial)?;
    s.visited.insert(m.key());
    let mut fallback = None;
    let mut fallback_score = f64::INFINITY;
    let mut best_seen = current.state.score;
    let mut stagnant = 0;
    let mut noise: f64 = 0.0;
    let mut regional_calls = 0;
    let mut regional_count = 0;
    for iteration in 0..=iterations {
        if control.stopped() {
            return None;
        }
        let state = &current.state;
        if state.gap == 0
            && state.bad == 0
            && state.supply == 0
            && state.edge == 0
            && state.matching_possible
        {
            if let Some(matched) =
                matching::assign_unique(&current.e, &built.pictures, &input.arrows, control)
            {
                if geometry::same_pictures(&matched.mask, &built.pictures) {
                    if let Some(verified) = topology::verify(&matched, &input.arrows) {
                        let doubles =
                            matching::diagnose(&matched, &built.pictures, &input.arrows, control)
                                .doubles;
                        let minimum = if state.target == 0 {
                            0
                        } else {
                            1.max(state.target - 1)
                        };
                        let short_limit = (verified.runs.len() as f64
                            * 0.06f64.max(weight(weights, 3) * 2.0 + 0.03))
                        .ceil() as usize
                            + 1;
                        if doubles >= minimum
                            && (weights.is_none() || verified.distribution[3] <= short_limit)
                        {
                            return Some((verified, regional_count));
                        }
                        if state.score < fallback_score {
                            fallback = Some((verified, regional_count));
                            fallback_score = state.score;
                        }
                    }
                }
            }
        }
        if iteration == iterations {
            break;
        }
        let mut cells: Vec<_> = (0..area)
            .filter(|&i| m.cells[i] != CUTOUT && !collar[i])
            .collect();
        let sampled = limit.min(cells.len());
        for i in 0..sampled {
            let j = i + rng.int(cells.len() - i);
            cells.swap(i, j);
        }
        let mut focus = current.diagnostic.focus.clone();
        if state.edge > 0 {
            let slots = current.e.slots(&input.arrows);
            let photos = geometry::photo_cells(&m, &built.pictures);
            let edge = quality::edges(&current.e, &photos, slots);
            if edge.top_eligible && edge.top_along == 0 {
                focus.extend(1..m.cols - 1);
            }
            if edge.left_eligible && edge.left_along == 0 {
                focus.extend((1..m.rows - 1).map(|r| r * m.cols));
            }
        }
        let mut near_focus = vec![false; area];
        for &f in &focus {
            for dr in -2..=2 {
                for dc in -2..=2 {
                    if let Some(i) = m.offset(f, dr, dc) {
                        near_focus[i] = true;
                    }
                }
            }
        }
        cells.sort_by_key(|&i| !near_focus[i]);
        let score = state.score;
        let mut best = s.singles(&mut m, &index, &cells[..sampled], score, false);
        if best.is_none() {
            best = s.singles(&mut m, &index, &cells[sampled..], score, false);
        }
        if best.is_none() {
            let mut mutable = vec![false; area];
            for &i in &cells {
                mutable[i] = true;
            }
            for &i in cells.iter().take(60) {
                for (dr, dc) in [(1, 0), (0, 1), (1, 1)] {
                    if control.stopped() {
                        return None;
                    }
                    let Some(j) = m.offset(i, dr, dc) else {
                        continue;
                    };
                    if !mutable[j] {
                        continue;
                    }
                    m.flip(i);
                    m.flip(j);
                    let trial = s.evaluate(&m, &index, &[i, j]);
                    m.flip(i);
                    m.flip(j);
                    if let Some(trial) = trial {
                        if trial.state.score < score
                            && best
                                .as_ref()
                                .is_none_or(|b| trial.state.score < b.trial.state.score)
                        {
                            best = Some(Move {
                                changes: vec![i, j],
                                trial,
                            });
                        }
                    }
                }
            }
        }
        if best.is_none() && input.regional_repair && regional_calls < 2 {
            regional_calls += 1;
            best = s.regional(&mut m, &index, &cells, &focus, rng, score);
            if best.is_some() {
                regional_count += 1;
                bump(s.d, "regionalRepairMoves", 1);
            }
        }
        if best.is_none() && input.adaptive_search && noise > 0.0 && rng.next() < noise {
            for &i in cells.iter().take(sampled) {
                m.flip(i);
                let trial = s.evaluate(&m, &index, &[i]);
                m.flip(i);
                if let Some(trial) = trial {
                    if trial.state.score < score + 8.0 {
                        best = Some(Move {
                            changes: vec![i],
                            trial,
                        });
                        break;
                    }
                }
            }
        }
        if best.is_none() {
            best = s.singles(&mut m, &index, &cells[..sampled], score, true);
        }
        let Some(best) = best else {
            break;
        };
        for &i in &best.changes {
            m.flip(i);
        }
        index.commit(&m, &best.changes);
        s.visited.insert(m.key());
        current = best.trial;
        if current.state.score < best_seen {
            best_seen = current.state.score;
            stagnant = 0;
            noise *= 0.9;
        } else {
            stagnant += 1;
        }
        if input.adaptive_search && stagnant >= 12 {
            noise = (noise + (1.0 - noise) * 0.2).min(0.5);
            stagnant = 0;
        }
    }
    if fallback.is_none() {
        bump(s.d, "balanceRejected", 1);
        s.d.insert("lastGap".into(), current.state.gap as f64);
        s.d.insert("lastBad".into(), current.state.bad as f64);
        s.d.insert("lastScore".into(), current.state.score);
        let own = matching::diagnose(&current.e, &built.pictures, &input.arrows, control);
        s.d.insert("lastUnmatched".into(), own.unmatched as f64);
    }
    fallback
}
pub fn variants(mask: &Mask) -> Vec<String> {
    let mut result = Vec::new();
    for transpose in [false, true] {
        if transpose && mask.rows != mask.cols {
            continue;
        }
        for fr in [false, true] {
            for fc in [false, true] {
                let mut data = String::new();
                for r in 0..mask.rows {
                    if r > 0 {
                        data.push('/');
                    }
                    for c in 0..mask.cols {
                        let rr = if fr { mask.rows - 1 - r } else { r };
                        let cc = if fc { mask.cols - 1 - c } else { c };
                        let i = if transpose {
                            cc * mask.cols + rr
                        } else {
                            rr * mask.cols + cc
                        };
                        data.push(mask.cells[i] as char);
                    }
                }
                result.push(data);
            }
        }
    }
    result
}
pub fn fingerprint(mask: &Mask) -> String {
    variants(mask).into_iter().min().unwrap_or_default()
}
pub fn distance(left: &str, right: &str) -> f64 {
    let rows: Vec<_> = right.split('/').collect();
    let cols = rows.first().map_or(0, |r| r.len());
    let l: Vec<_> = left.split('/').collect();
    if l.len() != rows.len() || l.iter().zip(&rows).any(|(a, b)| a.len() != b.len()) {
        return 1.0;
    }
    let mask = Mask {
        rows: rows.len(),
        cols,
        cells: rows.iter().flat_map(|s| s.bytes()).collect(),
    };
    variants(&mask)
        .iter()
        .map(|v| {
            let mut union = 0;
            let mut diff = 0;
            for (a, b) in left.bytes().zip(v.bytes()) {
                if a == b'/' {
                    continue;
                }
                if a == CLUE || b == CLUE || a != b {
                    union += 1;
                }
                if a != b {
                    diff += 1;
                }
            }
            diff as f64 / union.max(1) as f64
        })
        .fold(1.0, f64::min)
}
pub fn generate(input: &Input, control: &Control) -> Output {
    let mut rng = Rng(input.rng_position);
    let mut d = Diagnostics::new();
    let mut best: Option<Candidate> = None;
    let mut collected = 0;
    for attempt in 0..input.attempt_budget {
        if control.stopped() {
            break;
        }
        let family = input
            .mask_family
            .as_deref()
            .unwrap_or(["periodic", "banded", "woven"][attempt % 3]);
        bump(&mut d, &format!("familyAttempts_{family}"), 1);
        let Some(built) = geometry::build(
            &input.request,
            &mut rng,
            input.weights.as_ref(),
            family,
            control,
        ) else {
            bump(&mut d, "maskRejected", 1);
            continue;
        };
        let Some((e, regional)) = balance(&built, input, &mut rng, &mut d, control) else {
            continue;
        };
        if control.stopped() {
            break;
        }
        let fp = fingerprint(&e.mask);
        if input.fingerprints.contains(&fp) {
            continue;
        }
        if input
            .diversity_fingerprints
            .iter()
            .any(|old| distance(&fp, old) < 0.12)
        {
            bump(&mut d, "similarityRejected", 1);
            continue;
        }
        if quality::supply(&e, input.dictionary_counts.as_ref(), input.weights.as_ref()) > 0 {
            bump(&mut d, "supplyRejected", 1);
            continue;
        }
        let q = quality::quality(&e, &built.pictures, input.weights.as_ref(), &input.arrows);
        if q.edge_direction_deficit > 0 {
            continue;
        }
        let candidate = Candidate {
            slot_count: e.runs.len(),
            intersections: e.intersections,
            rows: e.mask.rows,
            cols: e.mask.cols,
            mask: e
                .mask
                .cells
                .chunks(e.mask.cols)
                .map(|r| String::from_utf8(r.to_vec()).unwrap())
                .collect(),
            codes: e.codes.chunks(e.mask.cols).map(|r| r.to_vec()).collect(),
            pictures: built.pictures,
            orientation: built.orientation,
            fingerprint: fp,
            quality: q,
            regional_repair_count: regional,
            mask_family: family.into(),
        };
        if best
            .as_ref()
            .is_none_or(|b| candidate.quality.quality_score < b.quality.quality_score)
        {
            best = Some(candidate);
        }
        collected += 1;
        if collected >= input.pool_size {
            break;
        }
    }
    Output {
        candidate: best,
        rng_position: rng.0,
        diagnostics: d,
        stopped: control.stopped(),
    }
}
