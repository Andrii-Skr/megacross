use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, OnceLock,
};
use std::time::{Duration, Instant};

pub const LETTER: u8 = b'*';
pub const CLUE: u8 = b'#';
pub const CUTOUT: u8 = b'%';
pub const NONE: usize = usize::MAX;
pub type Diagnostics = BTreeMap<String, f64>;
pub fn bump(d: &mut Diagnostics, key: &str, count: usize) {
    *d.entry(key.into()).or_default() += count as f64;
}

#[derive(Clone, Deserialize, Serialize, Debug, PartialEq, Eq)]
pub struct Picture {
    pub row: usize,
    pub col: usize,
    pub width: usize,
    pub height: usize,
}
#[derive(Clone, Deserialize)]
pub struct Size {
    pub width: usize,
    pub height: usize,
}
#[derive(Deserialize)]
#[serde(tag = "mode", rename_all = "lowercase")]
pub enum Pictures {
    Auto { count: usize },
    Manual { items: Vec<Size> },
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Request {
    pub rows: usize,
    pub cols: usize,
    pub pictures: Pictures,
    pub cutout_preset_id: String,
}
#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Arrow {
    pub code: u16,
    pub directions: Vec<u8>,
    pub offsets: Vec<[isize; 2]>,
    pub render_directions: Vec<u8>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Input {
    pub request: Request,
    pub rng_position: u32,
    pub weights: Option<BTreeMap<usize, f64>>,
    pub dictionary_counts: Option<BTreeMap<usize, usize>>,
    #[serde(default)]
    pub fingerprints: Vec<String>,
    #[serde(default)]
    pub diversity_fingerprints: Vec<String>,
    #[serde(default = "default_attempts")]
    pub attempt_budget: usize,
    #[serde(default = "default_pool")]
    pub pool_size: usize,
    #[serde(default)]
    pub adaptive_search: bool,
    #[serde(default)]
    pub profile: bool,
    #[serde(default = "default_true")]
    pub regional_repair: bool,
    pub mask_family: Option<String>,
    pub arrows: Vec<Arrow>,
    pub max_ms: Option<f64>,
}
fn default_attempts() -> usize {
    6
}
fn default_pool() -> usize {
    1
}
fn default_true() -> bool {
    true
}
impl Input {
    pub fn validate(&self) -> Result<(), String> {
        let r = &self.request;
        if !(5..=40).contains(&r.rows) || !(5..=40).contains(&r.cols) {
            return Err("grid dimensions must be from 5 to 40".into());
        }
        if ![
            "none",
            "corner",
            "opposite-corners",
            "edge-bite",
            "opposite-edge-bites",
            "stepped-corner",
            "center-window",
        ]
        .contains(&r.cutout_preset_id.as_str())
        {
            return Err("unknown cutout preset".into());
        }
        let sizes = match &r.pictures {
            Pictures::Auto { count } => {
                if *count > 20 {
                    return Err("too many pictures".into());
                }
                None
            }
            Pictures::Manual { items } => Some(items),
        };
        if let Some(items) = sizes {
            if items.len() > 20
                || items
                    .iter()
                    .any(|s| s.width < 4 || s.height < 4 || s.width > 40 || s.height > 40)
            {
                return Err("invalid picture dimensions".into());
            }
        }
        if self.attempt_budget > 5000 || self.pool_size == 0 || self.pool_size > 150 {
            return Err("invalid search budget".into());
        }
        if self.rng_position == 0 {
            return Err("random state must be nonzero".into());
        }
        if let Some(family) = &self.mask_family {
            if !["periodic", "banded", "woven"].contains(&family.as_str()) {
                return Err("unknown mask family".into());
            }
        }
        if self
            .weights
            .as_ref()
            .is_some_and(|w| w.values().any(|v| !v.is_finite() || *v < 0.0))
        {
            return Err("invalid length weights".into());
        }
        if self.max_ms.is_some_and(|ms| !ms.is_finite() || ms < 0.0) {
            return Err("invalid deadline".into());
        }
        if self.arrows.is_empty()
            || self.arrows.len() > 256
            || self.arrows.iter().any(|a| {
                a.code == 0
                    || a.code > 255
                    || a.directions.is_empty()
                    || a.directions.iter().any(|d| ![2, 6, 8].contains(d))
                    || a.render_directions.iter().any(|d| ![6, 8].contains(d))
                    || a.directions.len() != a.offsets.len()
                    || a.directions.len() > 2
                    || a.offsets
                        .iter()
                        .any(|p| !(-1..=1).contains(&p[0]) || !(-1..=1).contains(&p[1]))
            })
        {
            return Err("invalid arrow table".into());
        }
        Ok(())
    }
}
#[derive(Clone)]
pub struct Mask {
    pub rows: usize,
    pub cols: usize,
    pub cells: Vec<u8>,
}
impl Mask {
    pub fn at(&self, r: isize, c: isize) -> Option<usize> {
        if r >= 0 && c >= 0 && r < (self.rows as isize) && c < (self.cols as isize) {
            Some(r as usize * self.cols + c as usize)
        } else {
            None
        }
    }
    pub fn offset(&self, cell: usize, dr: isize, dc: isize) -> Option<usize> {
        self.at(
            (cell / self.cols) as isize + dr,
            (cell % self.cols) as isize + dc,
        )
    }
    pub fn barrier(&self, cell: usize) -> bool {
        self.cells[cell] != LETTER
    }
    pub fn flip(&mut self, cell: usize) {
        self.cells[cell] = if self.cells[cell] == CLUE {
            LETTER
        } else {
            CLUE
        };
    }
    pub fn key(&self) -> Vec<u8> {
        self.cells.clone()
    }
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Run {
    pub start: usize,
    pub down: bool,
    pub cells: Arc<[usize]>,
}
#[derive(Clone)]
pub struct Evaluation {
    pub mask: Mask,
    pub runs: Vec<Run>,
    pub codes: Vec<u16>,
    pub intersections: usize,
    pub distribution: [usize; 12],
    pub valid: bool,
    pub rendered_slots: OnceLock<Vec<Run>>,
}
impl Evaluation {
    pub fn slots(&self, arrows: &[Arrow]) -> &[Run] {
        self.rendered_slots.get_or_init(|| self.scan_slots(arrows))
    }
    pub fn scan_slots(&self, arrows: &[Arrow]) -> Vec<Run> {
        let mut slots = Vec::new();
        for start in 0..self.codes.len() {
            if self.codes[start] == 0 {
                continue;
            }
            let Some(arrow) = arrows.iter().find(|a| a.code == self.codes[start]) else {
                continue;
            };
            for &dir in &arrow.render_directions {
                let down = dir == 8;
                let (dr, dc) = if down { (1, 0) } else { (0, 1) };
                if self
                    .mask
                    .offset(start, -dr, -dc)
                    .is_some_and(|p| !self.mask.barrier(p))
                {
                    continue;
                }
                let mut cells = Vec::new();
                let mut pos = Some(start);
                while let Some(p) = pos {
                    if self.mask.barrier(p) {
                        break;
                    }
                    cells.push(p);
                    pos = self.mask.offset(p, dr, dc);
                }
                if cells.len() >= 2 {
                    slots.push(Run {
                        start,
                        down,
                        cells: cells.into(),
                    });
                }
            }
        }
        slots
    }
}
#[derive(Clone, Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Quality {
    pub quality_version: u8,
    pub length_deviation: f64,
    pub isolated_clue_share: f64,
    pub double_arrow_count: usize,
    pub spatial_imbalance: f64,
    pub picture_imbalance: f64,
    pub repetition: f64,
    pub bottleneck_share: f64,
    pub edge_direction_penalty: f64,
    pub edge_direction_deficit: usize,
    pub top_edge_along_words: usize,
    pub left_edge_along_words: usize,
    pub quality_score: f64,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Candidate {
    pub slot_count: usize,
    pub intersections: usize,
    pub rows: usize,
    pub cols: usize,
    pub mask: Vec<String>,
    pub codes: Vec<Vec<u16>>,
    pub pictures: Vec<Picture>,
    pub orientation: String,
    pub fingerprint: String,
    pub quality: Quality,
    pub regional_repair_count: usize,
    pub mask_family: String,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Output {
    pub candidate: Option<Candidate>,
    pub rng_position: u32,
    pub diagnostics: Diagnostics,
    pub stopped: bool,
}

pub struct Rng(pub u32);
impl Rng {
    pub fn next(&mut self) -> f64 {
        let mut x = self.0;
        x ^= x << 13;
        x ^= x >> 17;
        x ^= x << 5;
        self.0 = x;
        x as f64 / 4294967296.0
    }
    pub fn int(&mut self, n: usize) -> usize {
        (self.next() * n.max(1) as f64).floor() as usize
    }
}
pub struct Control {
    pub flag: Arc<AtomicBool>,
    pub deadline: Option<Instant>,
}
impl Control {
    pub fn new(flag: Arc<AtomicBool>, ms: Option<f64>) -> Self {
        Self {
            flag,
            deadline: ms
                .map(|v| Instant::now() + Duration::from_secs_f64(v.min(86_400_000.0) / 1000.0)),
        }
    }
    pub fn stopped(&self) -> bool {
        self.flag.load(Ordering::Relaxed) || self.deadline.is_some_and(|d| Instant::now() >= d)
    }
}
pub fn weight(w: Option<&BTreeMap<usize, f64>>, len: usize) -> f64 {
    w.and_then(|m| m.get(&len)).copied().unwrap_or(0.0)
}
pub fn double_target(n: usize) -> usize {
    ((n as f64 * 0.035).round() as usize).min(20)
}
