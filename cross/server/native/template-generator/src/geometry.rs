use crate::model::*;
use std::collections::BTreeMap;

pub struct Built {
    pub mask: Mask,
    pub pictures: Vec<Picture>,
    pub orientation: String,
}
pub fn weighted_length(rng: &mut Rng, weights: Option<&BTreeMap<usize, f64>>) -> usize {
    if weights.is_none() {
        return 3 + rng.int(5);
    }
    let total: f64 = (3..=11).map(|n| weight(weights, n).max(0.0)).sum();
    if total <= 0.0 {
        return 3 + rng.int(5);
    }
    let mut cursor = rng.next() * total;
    for n in 3..=11 {
        cursor -= weight(weights, n).max(0.0);
        if cursor <= 0.0 {
            return n;
        }
    }
    7
}
pub fn cutout(req: &Request, rng: &mut Rng) -> (Vec<bool>, String) {
    let (rows, cols) = (req.rows, req.cols);
    let base = ((rows.min(cols) as f64 * 0.25).round() as usize).clamp(2, 6);
    let orient = rng.int(4);
    let preset = req.cutout_preset_id.as_str();
    let mut name = if preset == "center-window" {
        "center"
    } else {
        ["top-left", "top-right", "bottom-right", "bottom-left"][orient]
    };
    let mut raw = Vec::new();
    let mut rect = |r: usize, c: usize, h: usize, w: usize| {
        for rr in r..r + h {
            for cc in c..c + w {
                raw.push((rr, cc));
            }
        }
    };
    if preset == "corner" || preset == "opposite-corners" {
        rect(0, 0, base, base);
    }
    if preset == "opposite-corners" {
        rect(rows - base, cols - base, base, base);
    }
    if preset == "edge-bite" || preset == "opposite-edge-bites" {
        let v = rows.min(base + ((base as f64 / 2.0).round() as usize).max(1));
        let h = cols.min(base + ((base as f64 / 2.0).round() as usize).max(1));
        let (cr, cc) = ((rows - v) / 2, (cols - h) / 2);
        if preset == "edge-bite" {
            name = ["left", "right", "top", "bottom"][orient];
            match name {
                "left" => rect(cr, 0, v, base),
                "right" => rect(cr, cols - base, v, base),
                "top" => rect(0, cc, base, h),
                _ => rect(rows - base, cc, base, h),
            }
        } else if orient.is_multiple_of(2) {
            name = "left-right";
            rect(cr, 0, v, base);
            rect(cr, cols - base, v, base);
        } else {
            name = "top-bottom";
            rect(0, cc, base, h);
            rect(rows - base, cc, base, h);
        }
    }
    if preset == "center-window" {
        rect((rows - base) / 2, (cols - base) / 2, base, base);
    }
    if preset == "stepped-corner" {
        for r in 0..base * 2 {
            for c in 0..base * 2 - r {
                raw.push((r, c));
            }
        }
    }
    let mut cells = vec![false; rows * cols];
    for (r, c) in raw {
        let (rr, cc) =
            if ["center-window", "none", "edge-bite", "opposite-edge-bites"].contains(&preset) {
                (r, c)
            } else {
                match orient {
                    0 => (r, c),
                    1 => (r, cols - 1 - c),
                    2 => (rows - 1 - r, cols - 1 - c),
                    _ => (rows - 1 - r, c),
                }
            };
        if rr < rows && cc < cols {
            cells[rr * cols + cc] = true;
        }
    }
    (cells, if preset == "none" { "none" } else { name }.into())
}
struct Placement {
    gap: isize,
    inset: usize,
    corners: bool,
}

fn place(
    rows: usize,
    cols: usize,
    sizes: &[Size],
    forbidden: &[bool],
    rng: &mut Rng,
    placement: Placement,
    control: &Control,
) -> Option<Vec<Picture>> {
    let Placement {
        gap,
        inset,
        corners,
    } = placement;
    let mut order: Vec<_> = (0..sizes.len()).collect();
    order.sort_by_key(|&i| std::cmp::Reverse(sizes[i].width * sizes[i].height));
    if sizes.iter().any(|s| s.width > cols || s.height > rows) {
        return None;
    }
    for _ in 0..64 {
        if control.stopped() {
            return None;
        }
        let mut placed: Vec<(usize, Picture)> = Vec::new();
        let mut failed = false;
        for &i in &order {
            let s = &sizes[i];
            let mut options = Vec::new();
            if s.height + 2 * inset <= rows && s.width + 2 * inset <= cols {
                for row in inset..=rows - s.height - inset {
                    for col in inset..=cols - s.width - inset {
                        let forbidden_rect = (row..row + s.height)
                            .any(|r| (col..col + s.width).any(|c| forbidden[r * cols + c]));
                        if forbidden_rect {
                            continue;
                        }
                        let overlap = placed.iter().any(|(_, p)| {
                            row as isize - gap <= (p.row + p.height - 1) as isize
                                && (row + s.height) as isize + gap > p.row as isize
                                && col as isize - gap <= (p.col + p.width - 1) as isize
                                && (col + s.width) as isize + gap > p.col as isize
                        });
                        if !overlap {
                            options.push((row, col));
                        }
                    }
                }
            }
            if options.is_empty() {
                failed = true;
                break;
            }
            let preferred: Vec<_> = if corners {
                options
                    .iter()
                    .copied()
                    .filter(|&(r, c)| {
                        (r == 0 || r == rows - s.height) && (c == 0 || c == cols - s.width)
                    })
                    .collect()
            } else {
                Vec::new()
            };
            let pool = if preferred.is_empty() {
                &options
            } else {
                &preferred
            };
            let (row, col) = pool[rng.int(pool.len())];
            placed.push((
                i,
                Picture {
                    row,
                    col,
                    width: s.width,
                    height: s.height,
                },
            ));
        }
        if !failed {
            placed.sort_by_key(|(i, _)| *i);
            return Some(placed.into_iter().map(|(_, p)| p).collect());
        }
    }
    None
}
fn pictures(
    req: &Request,
    forbidden: &[bool],
    rng: &mut Rng,
    control: &Control,
) -> Option<Vec<Picture>> {
    let sizes = match &req.pictures {
        Pictures::Manual { items } => items.clone(),
        Pictures::Auto { count } => (0..*count)
            .map(|_| match rng.int(3) {
                0 => Size {
                    width: 4,
                    height: 4,
                },
                1 => Size {
                    width: 5,
                    height: 4,
                },
                _ => Size {
                    width: 4,
                    height: 5,
                },
            })
            .collect(),
    };
    if sizes.len() >= 3 && rng.next() < 0.5 {
        if let Some(p) = place(
            req.rows,
            req.cols,
            &sizes,
            forbidden,
            rng,
            Placement {
                gap: 3,
                inset: 0,
                corners: true,
            },
            control,
        ) {
            return Some(p);
        }
    }
    for (gap, inset) in [(3, 4), (3, 0), (1, 0)] {
        if let Some(p) = place(
            req.rows,
            req.cols,
            &sizes,
            forbidden,
            rng,
            Placement {
                gap,
                inset,
                corners: false,
            },
            control,
        ) {
            return Some(p);
        }
    }
    if matches!(req.pictures, Pictures::Manual { .. }) {
        return None;
    }
    let small: Vec<_> = sizes
        .iter()
        .map(|_| Size {
            width: 4,
            height: 4,
        })
        .collect();
    place(
        req.rows,
        req.cols,
        &small,
        forbidden,
        rng,
        Placement {
            gap: 1,
            inset: 0,
            corners: false,
        },
        control,
    )
}
pub fn photo_cells(mask: &Mask, pictures: &[Picture]) -> Vec<bool> {
    let mut result = vec![false; mask.cells.len()];
    for p in pictures {
        for r in p.row..p.row + p.height {
            for c in p.col..p.col + p.width {
                result[r * mask.cols + c] = true;
            }
        }
    }
    result
}
pub fn photo_margin(mask: &Mask, pictures: &[Picture]) -> Vec<bool> {
    let mut result = vec![false; mask.cells.len()];
    for p in pictures {
        for r in p.row as isize - 1..=(p.row + p.height) as isize {
            for c in p.col as isize - 1..=(p.col + p.width) as isize {
                if (r == p.row as isize - 1 || r == (p.row + p.height) as isize)
                    && (c == p.col as isize - 1 || c == (p.col + p.width) as isize)
                {
                    continue;
                }
                if let Some(cell) = mask.at(r, c) {
                    result[cell] = true;
                }
            }
        }
    }
    result
}
pub fn boundary(length: usize, rng: &mut Rng, w: Option<&BTreeMap<usize, f64>>) -> Vec<u8> {
    let mut cells = Vec::new();
    while cells.len() < length {
        let clues = 1 + usize::from(rng.next() < 0.25);
        for _ in 0..clues {
            if cells.len() < length {
                cells.push(CLUE);
            }
        }
        let letters = if rng.next() < 0.5 {
            1
        } else {
            weighted_length(rng, w).clamp(3, 7)
        };
        for _ in 0..letters {
            if cells.len() < length {
                cells.push(LETTER);
            }
        }
    }
    if length >= 8 && !cells.windows(3).any(|s| s == [LETTER, LETTER, LETTER]) {
        let start = 1 + rng.int(length - 5);
        cells[start - 1] = CLUE;
        cells[start..start + 3].fill(LETTER);
        cells[start + 3] = CLUE;
    }
    cells
}
pub fn build(
    req: &Request,
    rng: &mut Rng,
    w: Option<&BTreeMap<usize, f64>>,
    family: &str,
    control: &Control,
) -> Option<Built> {
    let (cut, orientation) = cutout(req, rng);
    let pictures = pictures(req, &cut, rng, control)?;
    let mut mask = Mask {
        rows: req.rows,
        cols: req.cols,
        cells: vec![LETTER; req.rows * req.cols],
    };
    let photos = photo_cells(&mask, &pictures);
    let collar = photo_margin(&mask, &pictures);
    let dense = pictures.len() >= 3;
    let length = weighted_length(rng, w);
    let back_period = if length <= 5 {
        5
    } else if length <= 6 {
        7
    } else {
        (length + 1).min(10)
    };
    let slopes: &[usize] = match back_period {
        5 => &[2, 3],
        7 => &[2, 3, 4, 5],
        8 => &[3, 5],
        9 => &[2, 4, 5, 7],
        _ => &[3, 7],
    };
    let back_slope = slopes[rng.int(slopes.len())];
    let period = if dense {
        (weighted_length(rng, w) + 2).clamp(7, 10)
    } else {
        back_period
    };
    let slope = if dense {
        let options = match period {
            7 => [2, 5],
            8 => [3, 5],
            9 => [2, 7],
            _ => [3, 7],
        };
        options[rng.int(2)]
    } else {
        back_slope
    };
    let phase = rng.int(period);
    let top = boundary(req.cols, rng, w);
    let left = boundary(req.rows, rng, w);
    let rb: Vec<isize> = (0..req.rows.div_ceil(5))
        .map(|_| {
            if family == "periodic" {
                0
            } else {
                rng.int(3) as isize - 1
            }
        })
        .collect();
    let cb: Vec<isize> = (0..req.cols.div_ceil(5))
        .map(|_| {
            if family == "woven" {
                rng.int(3) as isize - 1
            } else {
                0
            }
        })
        .collect();
    for r in 0..req.rows {
        for c in 0..req.cols {
            let i = r * req.cols + c;
            mask.cells[i] = if cut[i] {
                CUTOUT
            } else if photos[i] {
                CLUE
            } else if collar[i] {
                LETTER
            } else if r == 0 {
                top[c]
            } else if c == 0 {
                left[r]
            } else if ((r + slope * c + phase) as isize + rb[r / 5] + cb[c / 5])
                .rem_euclid(period as isize)
                == 0
            {
                CLUE
            } else {
                LETTER
            };
        }
    }
    let mut protected = vec![false; mask.cells.len()];
    if !["top", "bottom", "top-bottom"].contains(&orientation.as_str()) {
        for c in 0..req.cols {
            if mask.cells[c] == LETTER
                && ((c > 0 && mask.cells[c - 1] == CLUE)
                    || (c + 1 < req.cols && mask.cells[c + 1] == CLUE))
            {
                for r in 1..3.min(req.rows) {
                    let i = r * req.cols + c;
                    if !cut[i] && !photos[i] {
                        mask.cells[i] = LETTER;
                        protected[i] = true;
                    }
                }
            }
        }
    }
    if !["left", "right", "left-right"].contains(&orientation.as_str()) {
        for r in 0..req.rows {
            let i = r * req.cols;
            if mask.cells[i] == LETTER
                && ((r > 0 && mask.cells[i - req.cols] == CLUE)
                    || (r + 1 < req.rows && mask.cells[i + req.cols] == CLUE))
            {
                for c in 1..3.min(req.cols) {
                    let j = i + c;
                    if !cut[j] && !photos[j] {
                        mask.cells[j] = LETTER;
                        protected[j] = true;
                    }
                }
            }
        }
    }
    let mut seeds = Vec::new();
    for r in 1..req.rows - 1 {
        for c in 1..req.cols - 1 {
            let i = r * req.cols + c;
            if mask.cells[i] == CLUE && !photos[i] {
                seeds.push(i);
            }
        }
    }
    for i in seeds {
        if rng.next()
            >= if dense {
                0.65
            } else if !pictures.is_empty() {
                0.18
            } else {
                0.12
            }
        {
            continue;
        }
        let down = !dense && rng.int(2) == 1;
        let j = i + if down { req.cols } else { 1 };
        if mask.cells[j] == LETTER && !collar[j] && !protected[j] {
            mask.cells[j] = CLUE;
        }
    }
    let mut mutable = Vec::new();
    for r in 1..req.rows {
        for c in 1..req.cols {
            let i = r * req.cols + c;
            if !cut[i] && !photos[i] && !collar[i] && !protected[i] {
                mutable.push(i);
            }
        }
    }
    let limit = 2.max(req.rows * req.cols / 90);
    let count = rng.int(limit + 1);
    for _ in 0..count {
        if mutable.is_empty() {
            break;
        }
        let at = rng.int(mutable.len());
        let cell = mutable.swap_remove(at);
        mask.flip(cell);
    }
    let mut covered = vec![false; mask.cells.len()];
    for run in crate::topology::scan(&mask, 3) {
        for &i in run.cells.iter() {
            covered[i] = true;
        }
    }
    let repairs: Vec<_> = (0..mask.cells.len())
        .filter(|&i| mask.cells[i] == LETTER && !covered[i] && !collar[i])
        .collect();
    if !dense {
        if repairs.len() > 2.max(req.rows * req.cols * 2 / 100) {
            return None;
        }
        for i in repairs {
            mask.cells[i] = CLUE;
        }
    }
    Some(Built {
        mask,
        pictures,
        orientation,
    })
}
pub fn recognize(mask: &Mask) -> Vec<Picture> {
    let mut seen = vec![false; mask.cells.len()];
    let mut result = Vec::new();
    for root in 0..mask.cells.len() {
        if seen[root] || mask.cells[root] != CLUE {
            continue;
        }
        let mut cells = vec![root];
        seen[root] = true;
        let mut at = 0;
        while at < cells.len() {
            let i = cells[at];
            at += 1;
            for (dr, dc) in [(1, 0), (-1, 0), (0, 1), (0, -1)] {
                if let Some(j) = mask.offset(i, dr, dc) {
                    if !seen[j] && mask.cells[j] == CLUE {
                        seen[j] = true;
                        cells.push(j);
                    }
                }
            }
        }
        let minr = cells.iter().map(|i| i / mask.cols).min().unwrap();
        let maxr = cells.iter().map(|i| i / mask.cols).max().unwrap();
        let minc = cells.iter().map(|i| i % mask.cols).min().unwrap();
        let maxc = cells.iter().map(|i| i % mask.cols).max().unwrap();
        let (height, width) = (maxr - minr + 1, maxc - minc + 1);
        if height >= 4 && width >= 4 && cells.len() == height * width {
            result.push(Picture {
                row: minr,
                col: minc,
                width,
                height,
            });
        }
    }
    result.sort_by_key(|p| (p.row, p.col, p.width, p.height));
    result
}
pub fn same_pictures(mask: &Mask, pictures: &[Picture]) -> bool {
    let mut expected = pictures.to_vec();
    expected.sort_by_key(|p| (p.row, p.col, p.width, p.height));
    recognize(mask) == expected
}
