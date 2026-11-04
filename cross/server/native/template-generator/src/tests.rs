use super::*;
use model::*;
use std::sync::{atomic::AtomicBool, Arc};
fn control() -> Control {
    Control::new(Arc::new(AtomicBool::new(false)), None)
}
fn covered(groups: &[matching::Group], m: &matching::Match) -> usize {
    let mut used = std::collections::HashSet::new();
    for (g, o) in m.selected.iter().enumerate() {
        if let Some(o) = o {
            for &r in &groups[g].options[*o].resources {
                assert!(used.insert(r), "resource claimed twice");
            }
        }
    }
    used.len()
}
fn exhaustive(groups: &[matching::Group], at: usize, used: u64) -> usize {
    if at == groups.len() {
        return used.count_ones() as usize;
    }
    let mut best = exhaustive(groups, at + 1, used);
    for o in &groups[at].options {
        let bits = o.resources.iter().fold(0u64, |b, &r| b | (1 << r));
        if bits & used == 0 {
            best = best.max(exhaustive(groups, at + 1, bits | used));
        }
    }
    best
}
#[test]
fn matching_agrees_with_exhaustive_small_graphs() {
    let mut rng = Rng(123456789);
    let ctl = control();
    for _ in 0..400 {
        let groups: Vec<_> = (0..1 + rng.int(6))
            .map(|start| {
                let double = rng.next() < 0.5;
                let options = (0..rng.int(4))
                    .map(|_| {
                        let a = rng.int(6);
                        let b = (a + 1 + rng.int(5)) % 6;
                        matching::OptionClue {
                            code: 1,
                            resources: if double { vec![a, b] } else { vec![a] },
                        }
                    })
                    .collect();
                matching::Group {
                    start,
                    dirs: if double { vec![6, 8] } else { vec![6] },
                    options,
                }
            })
            .collect();
        let expected = exhaustive(&groups, 0, 0);
        let actual = matching::match_groups(&groups, 6, 100_000, false, &ctl);
        assert!(actual.exhaustive);
        assert_eq!(covered(&groups, &actual), expected);
        let full = matching::match_groups(&groups, 6, 100_000, true, &ctl);
        assert_eq!(
            full.selected.iter().all(Option::is_some),
            expected == groups.iter().map(|g| g.dirs.len()).sum::<usize>()
        );
    }
}
#[test]
fn matching_budget_never_certifies_a_greedy_deficit() {
    let groups = vec![
        matching::Group {
            start: 0,
            dirs: vec![6, 8],
            options: vec![
                matching::OptionClue {
                    code: 1,
                    resources: vec![0, 1],
                },
                matching::OptionClue {
                    code: 2,
                    resources: vec![2, 3],
                },
            ],
        },
        matching::Group {
            start: 1,
            dirs: vec![6],
            options: vec![matching::OptionClue {
                code: 1,
                resources: vec![0],
            }],
        },
        matching::Group {
            start: 2,
            dirs: vec![8],
            options: vec![matching::OptionClue {
                code: 1,
                resources: vec![1],
            }],
        },
    ];
    let bounded = matching::match_groups(&groups, 4, 0, false, &control());
    assert!(!bounded.exhaustive);
    assert_eq!(bounded.choices, 0);
    assert_eq!(covered(&groups, &bounded), 2);
    let full = matching::match_groups(&groups, 4, 16, false, &control());
    assert!(full.exhaustive);
    assert_eq!(covered(&groups, &full), 4);
}
#[test]
fn incremental_runs_survive_trials_rollbacks_and_paired_commits() {
    let mut rng = Rng(1456789);
    for (rows, cols) in [(5, 7), (23, 31), (40, 40)] {
        for _ in 0..2 {
            let mut mask = Mask {
                rows,
                cols,
                cells: (0..rows * cols)
                    .map(|_| match rng.int(5) {
                        0 => CLUE,
                        4 => CUTOUT,
                        _ => LETTER,
                    })
                    .collect(),
            };
            let mut index = topology::RunIndex::new(&mask);
            for step in 0..80 {
                assert_eq!(index.runs(&mask, &[]), topology::scan(&mask));
                let changes = [rng.int(mask.cells.len()), rng.int(mask.cells.len())];
                let previous = [mask.cells[changes[0]], mask.cells[changes[1]]];
                for &i in &changes {
                    mask.flip(i);
                }
                assert_eq!(index.runs(&mask, &changes), topology::scan(&mask));
                if step % 2 == 1 {
                    index.commit(&mask, &changes);
                } else {
                    for (id, &i) in changes.iter().enumerate() {
                        mask.cells[i] = previous[id];
                    }
                }
            }
        }
    }
}
#[test]
fn canonical_geometry_and_distance_ignore_reflections() {
    let m = Mask {
        rows: 3,
        cols: 4,
        cells: b"#***%*#***#*".to_vec(),
    };
    let variants = search::variants(&m);
    let fp = search::fingerprint(&m);
    for v in variants {
        assert_eq!(search::distance(&fp, &v), 0.0);
    }
    assert_eq!(search::distance(&fp, "#*/**"), 1.0);
}
#[test]
fn cancellation_prevents_any_search_or_random_consumption() {
    let json = r#"{"request":{"rows":40,"cols":40,"pictures":{"mode":"auto","count":0},"cutoutPresetId":"none"},"rngPosition":123,"arrows":[{"code":24,"directions":[6],"offsets":[[0,-1]],"renderDirections":[6]}]}"#;
    let input: Input = serde_json::from_str(json).unwrap();
    input.validate().unwrap();
    let ctl = Control::new(Arc::new(AtomicBool::new(true)), None);
    let out = search::generate(&input, &ctl);
    assert!(out.stopped);
    assert!(out.candidate.is_none());
    assert_eq!(out.rng_position, 123);
    assert!(out.diagnostics.is_empty());
}
#[test]
fn input_validation_rejects_unsafe_dimensions_and_arrow_tables() {
    let json = r#"{"request":{"rows":41,"cols":40,"pictures":{"mode":"auto","count":0},"cutoutPresetId":"none"},"rngPosition":123,"arrows":[{"code":24,"directions":[6],"offsets":[[0,-1]],"renderDirections":[6]}]}"#;
    let mut input: Input = serde_json::from_str(json).unwrap();
    assert!(input.validate().is_err());
    input.request.rows = 40;
    let mut invalid_arrows = input.arrows.to_vec();
    invalid_arrows[0].directions = vec![255];
    input.arrows = invalid_arrows.into();
    assert!(input.validate().is_err());
}

#[test]
fn disjoint_components_preserve_choices_with_interleaved_resources() {
    let copies = 20;
    let mut groups = Vec::new();
    for copy in 0..copies {
        let option = |code, a, b| matching::OptionClue {
            code,
            resources: vec![copy + a * copies, copy + b * copies],
        };
        groups.push(matching::Group {
            start: copy * 3,
            dirs: vec![6, 8],
            options: vec![option(1, 0, 1), option(2, 2, 3)],
        });
        for r in 0..2 {
            groups.push(matching::Group {
                start: copy * 3 + 1 + r,
                dirs: vec![6],
                options: vec![matching::OptionClue {
                    code: 3,
                    resources: vec![copy + r * copies],
                }],
            });
        }
    }
    let full = matching::match_groups(&groups, copies * 4, 100_000, false, &control());
    assert!(full.exhaustive);
    assert_eq!(covered(&groups, &full), copies * 4);
    for copy in 0..copies {
        assert_eq!(full.selected[copy * 3], Some(1));
    }
    let limited = matching::match_groups(&groups, copies * 4, 0, false, &control());
    assert!(!limited.exhaustive);
    assert_eq!(limited.choices, 0);
    assert_eq!(covered(&groups, &limited), copies * 2);
}

#[test]
fn mandatory_runs_match_shared_typescript_fixtures() {
    let fixtures: serde_json::Value =
        serde_json::from_str(include_str!("../../../scripts/fixtures/template-runs.json")).unwrap();
    let arrows: ArrowTable = serde_json::from_value(fixtures["arrows"].clone()).unwrap();
    for case in fixtures["cases"].as_array().unwrap() {
        let rows: Vec<String> = serde_json::from_value(case["mask"].clone()).unwrap();
        let codes: Vec<Vec<u16>> = serde_json::from_value(case["codes"].clone()).unwrap();
        let mask = Mask {
            rows: rows.len(),
            cols: rows[0].chars().count(),
            cells: rows
                .iter()
                .flat_map(|row| {
                    row.chars().map(|c| match c {
                        '#' => CLUE,
                        '%' => CUTOUT,
                        _ => LETTER,
                    })
                })
                .collect(),
        };
        let e = Evaluation {
            mask: mask.clone(),
            runs: Vec::new(),
            codes: codes.into_iter().flatten().collect(),
            intersections: 0,
            distribution: [0; 12],
            valid: false,
            rendered_slots: Default::default(),
        };
        assert_eq!(
            topology::verify(&e, &arrows).is_some(),
            case["valid"].as_bool().unwrap(),
            "{}",
            case["name"]
        );
        if case["valid"] == true {
            let assigned = topology::assign(&mask, &arrows).expect("all runs must be retained");
            assert_eq!(assigned.runs.len(), topology::scan(&mask).len());
            assert!(topology::verify(&assigned, &arrows).is_some());
        }
        if case["name"] == "multiple-two-letter-runs" || case["name"] == "overlong-run" {
            assert!(topology::assign(&mask, &arrows).is_none());
            let mut repaired = mask.clone();
            assert!(repair::repair(
                &mut repaired,
                &[],
                &mut Rng(589081236),
                &arrows,
                &control()
            ));
            let assigned = topology::assign(&repaired, &arrows).unwrap();
            assert!(topology::verify(&assigned, &arrows).is_some());
        }
    }
}

#[test]
fn matching_cache_preserves_choices_budgets_and_resource_relabeling() {
    let mut rng = Rng(918273645);
    let ctl = control();
    let mut cache = matching::MatchingCache::default();
    for _ in 0..600 {
        let groups: Vec<_> = (0..1 + rng.int(8))
            .map(|start| {
                let double = rng.next() < 0.5;
                let options = (0..rng.int(5))
                    .map(|code| {
                        let a = rng.int(10);
                        let b = (a + 1 + rng.int(9)) % 10;
                        matching::OptionClue {
                            code: code as u16,
                            resources: if double { vec![a, b] } else { vec![a] },
                        }
                    })
                    .collect();
                matching::Group {
                    start,
                    dirs: if double { vec![6, 8] } else { vec![6] },
                    options,
                }
            })
            .collect();
        // Monotone relabeling changes global IDs and workspace dimensions but
        // preserves each component's ranked resource graph and option order.
        let shifted: Vec<_> = groups
            .iter()
            .map(|g| matching::Group {
                start: g.start + 100,
                dirs: g.dirs.clone(),
                options: g
                    .options
                    .iter()
                    .map(|o| matching::OptionClue {
                        code: o.code + 20,
                        resources: o.resources.iter().map(|r| r * 2 + 1).collect(),
                    })
                    .collect(),
            })
            .collect();
        for require_all in [false, true] {
            for budget in [0, 1, 16, 2048] {
                for (problem, resources) in [(&groups, 10), (&shifted, 21), (&groups, 10)] {
                    let expected =
                        matching::match_groups(problem, resources, budget, require_all, &ctl);
                    let actual = matching::match_groups_cached(
                        problem,
                        resources,
                        budget,
                        require_all,
                        &ctl,
                        Some(&mut cache),
                    );
                    assert_eq!(actual.selected, expected.selected);
                    assert_eq!(actual.choices, expected.choices);
                    assert_eq!(actual.exhaustive, expected.exhaustive);
                }
            }
        }
    }
    assert!(
        cache.hits > 1000,
        "test must exercise reusable conflict components"
    );
}

#[test]
fn compiled_arrow_table_preserves_order_and_first_code_lookup() {
    let fixtures: serde_json::Value =
        serde_json::from_str(include_str!("../../../scripts/fixtures/template-runs.json")).unwrap();
    let source: Vec<Arrow> = serde_json::from_value(fixtures["arrows"].clone()).unwrap();
    let mut with_duplicate = source.clone();
    with_duplicate.push(source[0].clone());
    let table = ArrowTable::from(with_duplicate.clone());
    for code in 0..=256 {
        assert_eq!(
            table
                .get_code(code)
                .map(|a| (a.code, &a.directions, &a.offsets)),
            with_duplicate.iter().find(|a| a.code == code).map(|a| (
                a.code,
                &a.directions,
                &a.offsets
            ))
        );
    }
    for dirs in [
        vec![6],
        vec![8],
        vec![6, 8],
        vec![8, 6],
        vec![2, 6],
        vec![8, 8],
    ] {
        let mask = dirs.iter().fold(0u16, |mask, &d| mask | (1 << d));
        let expected: Vec<_> = with_duplicate
            .iter()
            .filter(|a| a.directions.iter().fold(0u16, |m, &d| m | (1 << d)) == mask)
            .map(|a| a.code)
            .collect();
        assert_eq!(
            table.matching(&dirs).map(|a| a.code).collect::<Vec<_>>(),
            expected
        );
    }
}
