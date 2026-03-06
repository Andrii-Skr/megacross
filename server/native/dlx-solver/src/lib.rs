use napi::bindgen_prelude::*;
use napi::Status;
use napi::threadsafe_function::{ThreadSafeCallContext, ThreadsafeFunction, ThreadsafeFunctionCallMode};
use napi_derive::napi;
use rayon::{ThreadPool, prelude::*};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex, OnceLock};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Instant, SystemTime, UNIX_EPOCH};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SlotInput {
  len: usize,
  cells: Vec<[usize; 2]>,
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct SolveOptionsInput {
  shuffle: Option<bool>,
  lcv: Option<bool>,
  lcv_priority_slack: Option<i32>,
  restarts: Option<usize>,
  unique_words: Option<bool>,
  split_components: Option<bool>,
  max_ms: Option<u64>,
  max_nodes: Option<u64>,
  parallel_restarts: Option<usize>,
  log_every_ms: Option<u64>,
  log_every_nodes: Option<u64>,
  label: Option<String>,
  debug_dlx: Option<bool>,
  progress_stdout: Option<bool>,
  fail_stdout: Option<bool>,
  word_priority: Option<HashMap<String, i64>>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SolveInput {
  rows: Vec<String>,
  slots: Vec<SlotInput>,
  dict: HashMap<String, Vec<String>>,
  options: Option<SolveOptionsInput>,
}

#[derive(Clone)]
struct Slot {
  id: usize,
  len: usize,
  cells: Vec<(usize, usize)>,
}

#[derive(Clone)]
struct ResolveOptions {
  shuffle: bool,
  lcv: bool,
  lcv_priority_slack: i32,
  restarts: usize,
  unique_words: bool,
  split_components: bool,
  max_ms: Option<u64>,
  max_nodes: Option<u64>,
  parallel_restarts: usize,
  log_every_ms: u64,
  log_every_nodes: u64,
  label: Option<String>,
  debug_dlx: bool,
  progress_stdout: bool,
  fail_stdout: bool,
  word_priority: Option<HashMap<String, i64>>,
}

#[derive(Clone)]
struct Dict {
  words: Vec<Vec<String>>,
  chars: Vec<Vec<Vec<char>>>,
  max_len: usize,
}

struct IndexCell {
  bits: Vec<u64>,
  count: usize,
}

struct WordIndex {
  pos_index: Vec<Vec<HashMap<char, IndexCell>>>,
}

#[derive(Clone, Copy)]
struct Cross {
  other: usize,
  i_self: usize,
  i_other: usize,
}

static RAYON_POOL_CACHE: OnceLock<Mutex<HashMap<usize, Arc<ThreadPool>>>> = OnceLock::new();

fn get_or_create_thread_pool(num_threads: usize) -> Option<Arc<ThreadPool>> {
  let cache = RAYON_POOL_CACHE.get_or_init(|| Mutex::new(HashMap::new()));
  if let Ok(mut pools) = cache.lock() {
    if let Some(pool) = pools.get(&num_threads) {
      return Some(Arc::clone(pool));
    }
    let built = rayon::ThreadPoolBuilder::new()
      .num_threads(num_threads)
      .build()
      .ok()?;
    let pool = Arc::new(built);
    pools.insert(num_threads, Arc::clone(&pool));
    return Some(pool);
  }
  rayon::ThreadPoolBuilder::new()
    .num_threads(num_threads)
    .build()
    .ok()
    .map(Arc::new)
}

struct DlxColumn {
  size: i32,
  left: usize,
  right: usize,
  primary: bool,
  color: Option<char>,
  weight: i32,
  head: usize,
}

struct DlxNode {
  column: usize,
  left: usize,
  right: usize,
  up: usize,
  down: usize,
  row_id: usize,
  color: Option<char>,
}

struct DlxRow {
  slot_id: usize,
  len: usize,
  word_idx: usize,
}

struct DlxMatrix {
  columns: Vec<DlxColumn>,
  nodes: Vec<DlxNode>,
  rows: Vec<DlxRow>,
  header: usize,
}

struct SearchState {
  nodes: u64,
  backtracks: u64,
  zero_pick: u64,
  reject_intersect: u64,
  reject_forward: u64,
  start: Instant,
  aborted: bool,
  abort_reason: Option<&'static str>,
  last_fail: Option<FailInfo>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProgressLastPick {
  id: usize,
  len: usize,
  degree: usize,
  candidates: i32,
  pattern: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProgressStats {
  reject_intersect: u64,
  reject_forward: u64,
  zero_pick: u64,
  backtracks: u64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProgressPayload {
  label: Option<String>,
  attempt: usize,
  restarts: usize,
  engine: String,
  nodes: u64,
  elapsed_ms: u64,
  nodes_per_sec: u64,
  unfilled: usize,
  depth: usize,
  last_pick: Option<ProgressLastPick>,
  stats: ProgressStats,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct FailSlot {
  id: usize,
  r: usize,
  c: usize,
  len: usize,
  dir: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct FailDetail {
  slot: Option<FailSlot>,
  limit: Option<String>,
  column: Option<FailColumn>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct FailPayload {
  #[serde(rename = "type")]
  kind: String,
  label: Option<String>,
  attempt: usize,
  engine: String,
  reason: String,
  detail: Option<FailDetail>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct FailCell {
  r: usize,
  c: usize,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct FailColumn {
  name: String,
  #[serde(rename = "type")]
  kind: String,
  slot: Option<FailSlot>,
  cell: Option<FailCell>,
  word: Option<String>,
}

#[derive(Clone)]
struct FailInfo {
  reason: &'static str,
  slot: Option<FailSlot>,
  column: Option<FailColumn>,
  limit: Option<&'static str>,
}

#[derive(Clone)]
enum ColumnMeta {
  Other(String),
  Slot(FailSlot),
  Cell(usize, usize),
  Word(String),
}

fn slot_to_fail(slot: &Slot) -> FailSlot {
  let (r0, c0) = slot.cells.get(0).copied().unwrap_or((0, 0));
  let dir = if slot.cells.len() > 1 {
    let (r1, c1) = slot.cells[1];
    if r1 == r0 && c1 != c0 { "right" } else { "down" }
  } else {
    "right"
  };
  FailSlot {
    id: slot.id,
    r: r0,
    c: c0,
    len: slot.len,
    dir: dir.to_string(),
  }
}

fn meta_to_fail_column(meta: &ColumnMeta) -> FailColumn {
  match meta {
    ColumnMeta::Slot(slot) => FailColumn {
      name: format!("slot:{}", slot.id),
      kind: "slot".to_string(),
      slot: Some(slot.clone()),
      cell: None,
      word: None,
    },
    ColumnMeta::Cell(r, c) => FailColumn {
      name: format!("cell:{},{}", r, c),
      kind: "cell".to_string(),
      slot: None,
      cell: Some(FailCell { r: *r, c: *c }),
      word: None,
    },
    ColumnMeta::Word(word) => FailColumn {
      name: format!("word:{}", word),
      kind: "word".to_string(),
      slot: None,
      cell: None,
      word: Some(word.clone()),
    },
    ColumnMeta::Other(name) => FailColumn {
      name: name.clone(),
      kind: "other".to_string(),
      slot: None,
      cell: None,
      word: None,
    },
  }
}

trait ProgressEmitter {
  fn emit(&mut self, json: String);
}

struct DirectEmitter<'a> {
  env: &'a Env,
  callback: &'a JsFunction,
}

impl<'a> ProgressEmitter for DirectEmitter<'a> {
  fn emit(&mut self, json: String) {
    if let Ok(js_str) = self.env.create_string(&json) {
      let args = [js_str];
      let _ = self.callback.call(None, &args);
    }
  }
}

struct TsfnEmitter {
  callback: Arc<ThreadsafeFunction<String>>,
  call_mode: ThreadsafeFunctionCallMode,
  debug: bool,
  logged: bool,
}

impl ProgressEmitter for TsfnEmitter {
  fn emit(&mut self, json: String) {
    let status = self.callback.call(Ok(json), self.call_mode);
    if self.debug && !self.logged {
      eprintln!("[native-dlx] tsfn call status: {:?}", status);
      self.logged = true;
    }
    if self.debug && status != Status::Ok {
      eprintln!("[native-dlx] tsfn call error: {:?}", status);
    }
  }
}

struct ProgressCtx<'a> {
  emitter: Option<Box<dyn ProgressEmitter + 'a>>,
  label: Option<String>,
  attempt: usize,
  restarts: usize,
  engine: &'static str,
  total_slots: usize,
  next_log_at: u64,
  next_log_node: u64,
  log_every_ms: u64,
  log_every_nodes: u64,
  stdout: bool,
  fail_stdout: bool,
}

#[derive(Clone, Copy)]
struct ProgressLastPickRef<'a> {
  id: usize,
  len: usize,
  degree: usize,
  candidates: i32,
  pattern: &'a str,
}

struct Rng {
  state: u64,
}

impl Rng {
  fn new(seed: u64) -> Self {
    Self { state: seed }
  }

  fn next_u32(&mut self) -> u32 {
    // xorshift64
    let mut x = self.state;
    x ^= x << 13;
    x ^= x >> 7;
    x ^= x << 17;
    self.state = x;
    (x & 0xffff_ffff) as u32
  }

  fn gen_range(&mut self, max: usize) -> usize {
    if max <= 1 {
      return 0;
    }
    (self.next_u32() as usize) % max
  }

  fn shuffle<T>(&mut self, arr: &mut [T]) {
    if arr.len() < 2 {
      return;
    }
    for i in (1..arr.len()).rev() {
      let j = self.gen_range(i + 1);
      arr.swap(i, j);
    }
  }
}

#[napi]
pub fn solve_dlx(env: Env, input_json: String, progress: Option<JsFunction>) -> Result<Option<Vec<String>>> {
  let mut input: SolveInput = serde_json::from_str(&input_json)
    .map_err(|e| Error::from_reason(format!("invalid input: {e}")))?;
  let options = resolve_options(input.options.take().unwrap_or_default());
  let _parallel_restarts = options.parallel_restarts.min(options.restarts).max(1);
  let use_tsfn = progress.is_some() && options.parallel_restarts > 1;
  let progress_tsfn = if use_tsfn {
    let cb = progress.as_ref().expect("progress callback missing");
    let tsfn: ThreadsafeFunction<String> = cb.create_threadsafe_function(1024, |ctx: ThreadSafeCallContext<String>| {
      let value = ctx.value;
      Ok(vec![ctx.env.create_string(&value)?.into_unknown()])
    })?;
    Some(Arc::new(tsfn))
  } else {
    None
  };
  Ok(solve_dlx_internal(Some(env), input, options, progress.as_ref(), progress_tsfn))
}

#[napi]
pub fn solve_dlx_async(
  _env: Env,
  input_json: String,
  progress: Option<JsFunction>,
) -> Result<AsyncTask<SolveDlxTask>> {
  let mut input: SolveInput = serde_json::from_str(&input_json)
    .map_err(|e| Error::from_reason(format!("invalid input: {e}")))?;
  let options = resolve_options(input.options.take().unwrap_or_default());
  let progress_tsfn = if let Some(cb) = progress {
    let tsfn: ThreadsafeFunction<String> = cb.create_threadsafe_function(1024, |ctx: ThreadSafeCallContext<String>| {
      let value = ctx.value;
      Ok(vec![ctx.env.create_string(&value)?.into_unknown()])
    })?;
    Some(Arc::new(tsfn))
  } else {
    None
  };
  Ok(AsyncTask::new(SolveDlxTask {
    input: Some(input),
    options,
    progress: progress_tsfn,
  }))
}

pub struct SolveDlxTask {
  input: Option<SolveInput>,
  options: ResolveOptions,
  progress: Option<Arc<ThreadsafeFunction<String>>>,
}

impl Task for SolveDlxTask {
  type Output = Option<Vec<String>>;
  type JsValue = Option<Vec<String>>;

  fn compute(&mut self) -> Result<Self::Output> {
    let input = self
      .input
      .take()
      .ok_or_else(|| Error::from_reason("missing input"))?;
    Ok(solve_dlx_internal(
      None,
      input,
      self.options.clone(),
      None,
      self.progress.clone(),
    ))
  }

  fn resolve(&mut self, _env: Env, output: Self::Output) -> Result<Self::JsValue> {
    Ok(output)
  }
}

fn normalize_csp_options(mut options: ResolveOptions) -> ResolveOptions {
  if options.max_ms.is_none() && options.max_nodes.is_none() {
    options.restarts = 1;
    options.parallel_restarts = 1;
  }
  options
}

#[napi]
pub fn solve_csp(env: Env, input_json: String, progress: Option<JsFunction>) -> Result<Option<Vec<String>>> {
  let mut input: SolveInput = serde_json::from_str(&input_json)
    .map_err(|e| Error::from_reason(format!("invalid input: {e}")))?;
  let options = normalize_csp_options(resolve_options(input.options.take().unwrap_or_default()));
  let use_tsfn = progress.is_some() && options.parallel_restarts > 1;
  let progress_tsfn = if use_tsfn {
    let cb = progress.as_ref().expect("progress callback missing");
    let tsfn: ThreadsafeFunction<String> = cb.create_threadsafe_function(1024, |ctx: ThreadSafeCallContext<String>| {
      let value = ctx.value;
      Ok(vec![ctx.env.create_string(&value)?.into_unknown()])
    })?;
    Some(Arc::new(tsfn))
  } else {
    None
  };
  Ok(solve_csp_internal(Some(env), input, options, progress.as_ref(), progress_tsfn))
}

#[napi]
pub fn solve_csp_async(
  _env: Env,
  input_json: String,
  progress: Option<JsFunction>,
) -> Result<AsyncTask<SolveCspTask>> {
  let mut input: SolveInput = serde_json::from_str(&input_json)
    .map_err(|e| Error::from_reason(format!("invalid input: {e}")))?;
  let options = normalize_csp_options(resolve_options(input.options.take().unwrap_or_default()));
  let progress_tsfn = if let Some(cb) = progress {
    let tsfn: ThreadsafeFunction<String> = cb.create_threadsafe_function(1024, |ctx: ThreadSafeCallContext<String>| {
      let value = ctx.value;
      Ok(vec![ctx.env.create_string(&value)?.into_unknown()])
    })?;
    Some(Arc::new(tsfn))
  } else {
    None
  };
  Ok(AsyncTask::new(SolveCspTask {
    input: Some(input),
    options,
    progress: progress_tsfn,
  }))
}

pub struct SolveCspTask {
  input: Option<SolveInput>,
  options: ResolveOptions,
  progress: Option<Arc<ThreadsafeFunction<String>>>,
}

impl Task for SolveCspTask {
  type Output = Option<Vec<String>>;
  type JsValue = Option<Vec<String>>;

  fn compute(&mut self) -> Result<Self::Output> {
    let input = self
      .input
      .take()
      .ok_or_else(|| Error::from_reason("missing input"))?;
    Ok(solve_csp_internal(
      None,
      input,
      self.options.clone(),
      None,
      self.progress.clone(),
    ))
  }

  fn resolve(&mut self, _env: Env, output: Self::Output) -> Result<Self::JsValue> {
    Ok(output)
  }
}

fn solve_csp_internal(
  env: Option<Env>,
  input: SolveInput,
  options: ResolveOptions,
  progress_js: Option<&JsFunction>,
  progress_tsfn: Option<Arc<ThreadsafeFunction<String>>>,
) -> Option<Vec<String>> {
  let slots: Vec<Slot> = input
    .slots
    .into_iter()
    .enumerate()
    .map(|(i, s)| Slot {
      id: i,
      len: s.len,
      cells: s.cells.into_iter().map(|c| (c[0], c[1])).collect(),
    })
    .collect();

  let dict = Arc::new(Dict::from_map(input.dict));
  if dict.max_len == 0 || slots.is_empty() {
    return None;
  }

  let components = if options.split_components {
    let (_, adjacency, _) = build_cross_data(&slots);
    build_components(&slots, &adjacency)
  } else {
    vec![slots.iter().map(|s| s.id).collect()]
  };

  let parallel_restarts = options.parallel_restarts.min(options.restarts).max(1);
  let use_tsfn = progress_tsfn.is_some();

  if parallel_restarts > 1 {
    let rows = Arc::new(input.rows);
    let slots = Arc::new(slots);
    let components = Arc::new(components);
    let options = Arc::new(options);
    let progress = progress_tsfn.clone();
    let best = Mutex::new(None::<(i64, Vec<String>)>);

    let run = || {
      (1..=options.restarts).into_par_iter().for_each(|attempt| {
        let solved = match progress.as_ref() {
          Some(tsfn) => solve_attempt_with_progress_tsfn_csp(
            tsfn,
            rows.as_ref(),
            slots.as_ref(),
            dict.as_ref(),
            components.as_ref(),
            options.as_ref(),
            attempt,
          ),
          None => solve_attempt_no_progress_csp(
            rows.as_ref(),
            slots.as_ref(),
            dict.as_ref(),
            components.as_ref(),
            options.as_ref(),
            attempt,
          ),
        };
        let (grid, score) = match solved {
          Some(ok) => ok,
          None => return,
        };
        let as_strings = grid_to_strings(&grid);
        if let Ok(mut guard) = best.lock() {
          let replace = match guard.as_ref() {
            Some((best_score, _)) => score < *best_score,
            None => true,
          };
          if replace {
            *guard = Some((score, as_strings));
          }
        }
      });
    };

    if let Some(pool) = get_or_create_thread_pool(parallel_restarts) {
      pool.install(run);
    } else {
      run();
    }

    return best
      .lock()
      .ok()
      .and_then(|item| item.as_ref().map(|(_, rows)| rows.clone()));
  }

  let mut best: Option<(i64, Vec<String>)> = None;

  for attempt in 1..=options.restarts {
    let solved = match (use_tsfn, progress_js, progress_tsfn.as_ref(), env.as_ref()) {
      (true, _, Some(tsfn), _) => solve_attempt_with_progress_tsfn_csp(
        tsfn,
        &input.rows,
        &slots,
        dict.as_ref(),
        &components,
        &options,
        attempt,
      ),
      (false, Some(cb), _, Some(env_ref)) => solve_attempt_with_progress_direct_csp(
        env_ref,
        cb,
        &input.rows,
        &slots,
        dict.as_ref(),
        &components,
        &options,
        attempt,
      ),
      _ => solve_attempt_no_progress_csp(
        &input.rows,
        &slots,
        dict.as_ref(),
        &components,
        &options,
        attempt,
      ),
    };
    let (grid, score) = match solved {
      Some(ok) => ok,
      None => continue,
    };
    let rows = grid_to_strings(&grid);
    let replace = match best.as_ref() {
      Some((best_score, _)) => score < *best_score,
      None => true,
    };
    if replace {
      best = Some((score, rows));
    }
  }

  best.map(|(_, rows)| rows)
}

fn solve_dlx_internal(
  env: Option<Env>,
  input: SolveInput,
  options: ResolveOptions,
  progress_js: Option<&JsFunction>,
  progress_tsfn: Option<Arc<ThreadsafeFunction<String>>>,
) -> Option<Vec<String>> {
  if options.debug_dlx {
    eprintln!(
      "[native-dlx] opts: restarts={} parallel={} logEveryMs={} logEveryNodes={} progress_js={} progress_tsfn={} progress_stdout={}",
      options.restarts,
      options.parallel_restarts,
      options.log_every_ms,
      options.log_every_nodes,
      progress_js.is_some(),
      progress_tsfn.is_some(),
      options.progress_stdout
    );
  }
  let slots: Vec<Slot> = input
    .slots
    .into_iter()
    .enumerate()
    .map(|(i, s)| Slot {
      id: i,
      len: s.len,
      cells: s.cells.into_iter().map(|c| (c[0], c[1])).collect(),
    })
    .collect();

  let dict = Arc::new(Dict::from_map(input.dict));
  if dict.max_len == 0 || slots.is_empty() {
    return None;
  }

  let components = if options.split_components {
    let (_, adjacency, _) = build_cross_data(&slots);
    build_components(&slots, &adjacency)
  } else {
    vec![slots.iter().map(|s| s.id).collect()]
  };

  let parallel_restarts = options.parallel_restarts.min(options.restarts).max(1);
  let use_tsfn = progress_tsfn.is_some();

  if parallel_restarts > 1 {
    let rows = Arc::new(input.rows);
    let slots = Arc::new(slots);
    let components = Arc::new(components);
    let options = Arc::new(options);
    let progress = progress_tsfn.clone();
    let found = Arc::new(AtomicBool::new(false));
    let result = Mutex::new(None);

    let run = || {
      (1..=options.restarts).into_par_iter().for_each(|attempt| {
        if found.load(Ordering::Acquire) {
          return;
        }
        let grid = match progress.as_ref() {
          Some(tsfn) => solve_attempt_with_progress_tsfn(
            tsfn,
            rows.as_ref(),
            slots.as_ref(),
            dict.as_ref(),
            components.as_ref(),
            options.as_ref(),
            attempt,
            Some(found.as_ref()),
          ),
          None => solve_attempt_no_progress(
            rows.as_ref(),
            slots.as_ref(),
            dict.as_ref(),
            components.as_ref(),
            options.as_ref(),
            attempt,
            Some(found.as_ref()),
          ),
        };
        if let Some(grid) = grid {
          if !found.swap(true, Ordering::AcqRel) {
            if let Ok(mut guard) = result.lock() {
              *guard = Some(grid_to_strings(&grid));
            }
          }
        }
      });
    };

    if let Some(pool) = get_or_create_thread_pool(parallel_restarts) {
      pool.install(run);
    } else {
      run();
    }

    return result.lock().ok().and_then(|r| r.clone());
  }

  for attempt in 1..=options.restarts {
    let grid = match (use_tsfn, progress_js, progress_tsfn.as_ref(), env.as_ref()) {
      (true, _, Some(tsfn), _) => solve_attempt_with_progress_tsfn(
        tsfn,
        &input.rows,
        &slots,
        dict.as_ref(),
        &components,
        &options,
        attempt,
        None,
      ),
      (false, Some(cb), _, Some(env_ref)) => solve_attempt_with_progress_direct(
        env_ref,
        cb,
        &input.rows,
        &slots,
        dict.as_ref(),
        &components,
        &options,
        attempt,
        None,
      ),
      _ => solve_attempt_no_progress(
        &input.rows,
        &slots,
        dict.as_ref(),
        &components,
        &options,
        attempt,
        None,
      ),
    };
    if let Some(grid) = grid {
      return Some(grid_to_strings(&grid));
    }
  }

  None
}

fn solve_attempt_with_progress_direct(
  env: &Env,
  progress: &JsFunction,
  rows: &[String],
  slots: &[Slot],
  dict: &Dict,
  components: &[Vec<usize>],
  options: &ResolveOptions,
  attempt: usize,
  abort_flag: Option<&AtomicBool>,
) -> Option<Vec<Vec<char>>> {
  let mut grid = init_grid(rows);
  let mut used_global: HashSet<String> = HashSet::new();
  let attempt_start = Instant::now();
  let mut next_log_at = if options.log_every_ms > 0 { options.log_every_ms } else { u64::MAX };

  for comp in components {
    let sub_slots = remap_slots(slots, comp);
    let dict_for_comp = if options.unique_words && !used_global.is_empty() {
      DictRef::Owned(dict.filter(&used_global))
    } else {
      DictRef::Borrowed(dict)
    };

    let emitter: Box<dyn ProgressEmitter> = Box::new(DirectEmitter {
      env,
      callback: progress,
    });
    let solved = run_attempt_dlx(
      Some(emitter),
      rows,
      &sub_slots,
      dict_for_comp.as_ref(),
      options,
      attempt,
      attempt_start,
      &mut next_log_at,
      abort_flag,
    )?;

    if options.unique_words {
      for slot in &sub_slots {
        let word: String = slot
          .cells
          .iter()
          .map(|(r, c)| solved[*r][*c])
          .collect();
        used_global.insert(word);
      }
    }

    merge_grid(&mut grid, &solved);
  }

  Some(grid)
}

fn solve_attempt_with_progress_tsfn(
  progress: &Arc<ThreadsafeFunction<String>>,
  rows: &[String],
  slots: &[Slot],
  dict: &Dict,
  components: &[Vec<usize>],
  options: &ResolveOptions,
  attempt: usize,
  abort_flag: Option<&AtomicBool>,
) -> Option<Vec<Vec<char>>> {
  let mut grid = init_grid(rows);
  let mut used_global: HashSet<String> = HashSet::new();
  let attempt_start = Instant::now();
  let mut next_log_at = if options.log_every_ms > 0 { options.log_every_ms } else { u64::MAX };

  for comp in components {
    let sub_slots = remap_slots(slots, comp);
    let dict_for_comp = if options.unique_words && !used_global.is_empty() {
      DictRef::Owned(dict.filter(&used_global))
    } else {
      DictRef::Borrowed(dict)
    };

    let emitter: Box<dyn ProgressEmitter> = Box::new(TsfnEmitter {
      callback: Arc::clone(progress),
      call_mode: ThreadsafeFunctionCallMode::NonBlocking,
      debug: options.debug_dlx,
      logged: false,
    });
    let solved = run_attempt_dlx(
      Some(emitter),
      rows,
      &sub_slots,
      dict_for_comp.as_ref(),
      options,
      attempt,
      attempt_start,
      &mut next_log_at,
      abort_flag,
    )?;

    if options.unique_words {
      for slot in &sub_slots {
        let word: String = slot
          .cells
          .iter()
          .map(|(r, c)| solved[*r][*c])
          .collect();
        used_global.insert(word);
      }
    }

    merge_grid(&mut grid, &solved);
  }

  Some(grid)
}

fn solve_attempt_no_progress(
  rows: &[String],
  slots: &[Slot],
  dict: &Dict,
  components: &[Vec<usize>],
  options: &ResolveOptions,
  attempt: usize,
  abort_flag: Option<&AtomicBool>,
) -> Option<Vec<Vec<char>>> {
  let mut grid = init_grid(rows);
  let mut used_global: HashSet<String> = HashSet::new();
  let attempt_start = Instant::now();
  let mut next_log_at = if options.log_every_ms > 0 { options.log_every_ms } else { u64::MAX };

  for comp in components {
    let sub_slots = remap_slots(slots, comp);
    let dict_for_comp = if options.unique_words && !used_global.is_empty() {
      DictRef::Owned(dict.filter(&used_global))
    } else {
      DictRef::Borrowed(dict)
    };

    let solved = if options.progress_stdout || options.fail_stdout {
      run_attempt_dlx(
        None,
        rows,
        &sub_slots,
        dict_for_comp.as_ref(),
        options,
        attempt,
        attempt_start,
        &mut next_log_at,
        abort_flag,
      )?
    } else {
      run_attempt_dlx_no_progress(
        rows,
        &sub_slots,
        dict_for_comp.as_ref(),
        options,
        attempt,
        attempt_start,
        abort_flag,
      )?
    };

    if options.unique_words {
      for slot in &sub_slots {
        let word: String = slot
          .cells
          .iter()
          .map(|(r, c)| solved[*r][*c])
          .collect();
        used_global.insert(word);
      }
    }

    merge_grid(&mut grid, &solved);
  }

  Some(grid)
}

fn resolve_options(raw: SolveOptionsInput) -> ResolveOptions {
  let restarts = raw.restarts.unwrap_or(1).max(1);
  let shuffle = raw.shuffle.unwrap_or(restarts > 1);
  let progress_stdout = raw.progress_stdout.unwrap_or(false);
  let fail_stdout = raw.fail_stdout.unwrap_or(progress_stdout);
  ResolveOptions {
    shuffle,
    lcv: raw.lcv.unwrap_or(false),
    lcv_priority_slack: raw.lcv_priority_slack.unwrap_or(0).max(0),
    restarts,
    unique_words: raw.unique_words.unwrap_or(true),
    split_components: raw.split_components.unwrap_or(true),
    max_ms: raw.max_ms,
    max_nodes: raw.max_nodes,
    parallel_restarts: raw.parallel_restarts.unwrap_or(1).max(1),
    log_every_ms: raw.log_every_ms.unwrap_or(0),
    log_every_nodes: raw.log_every_nodes.unwrap_or(0),
    label: raw.label,
    debug_dlx: raw.debug_dlx.unwrap_or(false),
    progress_stdout,
    fail_stdout,
    word_priority: raw.word_priority,
  }
}

enum DictRef<'a> {
  Borrowed(&'a Dict),
  Owned(Dict),
}

impl<'a> DictRef<'a> {
  fn as_ref(&self) -> &Dict {
    match self {
      DictRef::Borrowed(dict) => dict,
      DictRef::Owned(dict) => dict,
    }
  }
}

impl Dict {
  fn from_map(map: HashMap<String, Vec<String>>) -> Self {
    let mut max_len = 0usize;
    let mut parsed: Vec<(usize, Vec<String>)> = Vec::new();
    for (k, mut v) in map {
      if let Ok(len) = k.parse::<usize>() {
        if len > max_len {
          max_len = len;
        }
        v.retain(|w| !w.is_empty());
        parsed.push((len, v));
      }
    }
    let mut words: Vec<Vec<String>> = vec![Vec::new(); max_len + 1];
    let mut chars: Vec<Vec<Vec<char>>> = vec![Vec::new(); max_len + 1];
    for (len, list) in parsed {
      let mut out_words = Vec::with_capacity(list.len());
      let mut out_chars = Vec::with_capacity(list.len());
      for w in list {
        let chars_vec: Vec<char> = w.chars().collect();
        if chars_vec.len() != len {
          continue;
        }
        out_words.push(w);
        out_chars.push(chars_vec);
      }
      words[len] = out_words;
      chars[len] = out_chars;
    }
    Self {
      words,
      chars,
      max_len,
    }
  }

  fn filter(&self, used: &HashSet<String>) -> Self {
    let mut words: Vec<Vec<String>> = vec![Vec::new(); self.max_len + 1];
    let mut chars: Vec<Vec<Vec<char>>> = vec![Vec::new(); self.max_len + 1];
    for len in 0..=self.max_len {
      let list = &self.words[len];
      if list.is_empty() {
        continue;
      }
      let mut out_words = Vec::new();
      let mut out_chars = Vec::new();
      for (i, w) in list.iter().enumerate() {
        if used.contains(w) {
          continue;
        }
        out_words.push(w.clone());
        out_chars.push(self.chars[len][i].clone());
      }
      words[len] = out_words;
      chars[len] = out_chars;
    }
    Self {
      words,
      chars,
      max_len: self.max_len,
    }
  }
}

fn build_word_index(dict: &Dict) -> WordIndex {
  let mut pos_index: Vec<Vec<HashMap<char, IndexCell>>> =
    (0..=dict.max_len).map(|_| Vec::new()).collect();

  for len in 0..=dict.max_len {
    let words = &dict.chars[len];
    if words.is_empty() {
      continue;
    }
    let bit_words = (words.len() + 63) / 64;
    let mut pos_maps: Vec<HashMap<char, IndexCell>> = Vec::with_capacity(len);
    for _ in 0..len {
      pos_maps.push(HashMap::new());
    }
    for (idx, word) in words.iter().enumerate() {
      for (i, ch) in word.iter().enumerate() {
        let cell = pos_maps[i]
          .entry(*ch)
          .or_insert_with(|| IndexCell {
            bits: vec![0; bit_words],
            count: 0,
          });
        let word_idx = idx / 64;
        let bit = 1u64 << (idx % 64);
        if cell.bits[word_idx] & bit == 0 {
          cell.bits[word_idx] |= bit;
          cell.count += 1;
        }
      }
    }
    pos_index[len] = pos_maps;
  }

  WordIndex { pos_index }
}

fn count_candidates_at(len: usize, pos: usize, ch: char, index: &WordIndex) -> usize {
  if len >= index.pos_index.len() {
    return 0;
  }
  if pos >= index.pos_index[len].len() {
    return 0;
  }
  index.pos_index[len][pos]
    .get(&ch)
    .map(|cell| cell.count)
    .unwrap_or(0)
}

fn build_cross_data(
  slots: &[Slot],
) -> (
  Vec<Vec<Cross>>,
  Vec<HashSet<usize>>,
  HashSet<(usize, usize)>,
) {
  let mut crosses: Vec<Vec<Cross>> = (0..slots.len()).map(|_| Vec::new()).collect();
  let mut adjacency: Vec<HashSet<usize>> = vec![HashSet::new(); slots.len()];
  let mut cell_map: HashMap<(usize, usize), Vec<(usize, usize)>> = HashMap::new();

  for slot in slots {
    for (index, (r, c)) in slot.cells.iter().enumerate() {
      cell_map.entry((*r, *c)).or_default().push((slot.id, index));
    }
  }

  let mut intersection_cells = HashSet::new();
  for (key, list) in cell_map.into_iter() {
    if list.len() < 2 {
      continue;
    }
    intersection_cells.insert(key);
    for i in 0..list.len() {
      for j in (i + 1)..list.len() {
        let (a_id, a_idx) = list[i];
        let (b_id, b_idx) = list[j];
        crosses[a_id].push(Cross { other: b_id, i_self: a_idx, i_other: b_idx });
        crosses[b_id].push(Cross { other: a_id, i_self: b_idx, i_other: a_idx });
        adjacency[a_id].insert(b_id);
        adjacency[b_id].insert(a_id);
      }
    }
  }

  (crosses, adjacency, intersection_cells)
}

fn build_components(slots: &[Slot], adjacency: &[HashSet<usize>]) -> Vec<Vec<usize>> {
  let mut seen = vec![false; slots.len()];
  let mut components: Vec<Vec<usize>> = Vec::new();
  for slot in slots {
    if seen[slot.id] {
      continue;
    }
    let mut stack = vec![slot.id];
    seen[slot.id] = true;
    let mut comp: Vec<usize> = Vec::new();
    while let Some(id) = stack.pop() {
      comp.push(id);
      for n in adjacency[id].iter() {
        if !seen[*n] {
          seen[*n] = true;
          stack.push(*n);
        }
      }
    }
    components.push(comp);
  }
  components
}

fn remap_slots(slots: &[Slot], ids: &[usize]) -> Vec<Slot> {
  let mut map: HashMap<usize, usize> = HashMap::new();
  for (idx, id) in ids.iter().enumerate() {
    map.insert(*id, idx);
  }
  let mut out: Vec<Slot> = Vec::new();
  for id in ids {
    let slot = &slots[*id];
    out.push(Slot {
      id: *map.get(&slot.id).unwrap_or(&slot.id),
      len: slot.len,
      cells: slot.cells.clone(),
    });
  }
  out
}

fn init_grid(rows: &[String]) -> Vec<Vec<char>> {
  rows
    .iter()
    .map(|r| r.chars().map(|ch| if ch == '#' { '#' } else { '.' }).collect())
    .collect()
}

fn merge_grid(base: &mut Vec<Vec<char>>, solved: &[Vec<char>]) {
  for r in 0..solved.len() {
    for c in 0..solved[r].len() {
      let ch = solved[r][c];
      if ch != '.' && ch != '#' {
        base[r][c] = ch;
      }
    }
  }
}

fn grid_to_strings(grid: &[Vec<char>]) -> Vec<String> {
  grid.iter().map(|r| r.iter().collect()).collect()
}

const DEFAULT_REPEAT_PENALTY: i64 = 1_000_000_000;

#[derive(Clone, Copy)]
struct CspTrailEntry {
  slot: usize,
  block: usize,
  removed: u64,
}

struct CspSearch<'a> {
  slots: &'a [Slot],
  dict: &'a Dict,
  options: &'a ResolveOptions,
  crosses: Vec<Vec<Cross>>,
  adjacency: Vec<HashSet<usize>>,
  index: WordIndex,
  domains: Vec<Vec<u64>>,
  domain_counts: Vec<usize>,
  assigned: Vec<Option<usize>>,
  assigned_count: usize,
  trail: Vec<CspTrailEntry>,
  weighted_degree: Vec<u32>,
  slot_ids_by_len: HashMap<usize, Vec<usize>>,
  word_gid_by_len: Vec<Vec<usize>>,
  gid_indices_by_len: Vec<HashMap<usize, Vec<usize>>>,
  priority_by_len: Vec<Vec<i64>>,
  used_gid_count: HashMap<usize, u32>,
  current_score: i64,
  best_score: i64,
  best_assignment: Option<Vec<usize>>,
  repeat_penalty: i64,
  rng: Rng,
}

impl<'a> CspSearch<'a> {
  fn new(
    slots: &'a [Slot],
    dict: &'a Dict,
    options: &'a ResolveOptions,
    crosses: Vec<Vec<Cross>>,
    adjacency: Vec<HashSet<usize>>,
    index: WordIndex,
    seed: u64,
  ) -> Self {
    let mut slot_ids_by_len: HashMap<usize, Vec<usize>> = HashMap::new();
    let mut domains: Vec<Vec<u64>> = Vec::with_capacity(slots.len());
    let mut domain_counts: Vec<usize> = Vec::with_capacity(slots.len());

    for slot in slots {
      slot_ids_by_len.entry(slot.len).or_default().push(slot.id);
      let words_len = if slot.len <= dict.max_len {
        dict.words[slot.len].len()
      } else {
        0
      };
      let blocks = (words_len + 63) / 64;
      let mut bits = vec![u64::MAX; blocks];
      if blocks > 0 && words_len % 64 != 0 {
        bits[blocks - 1] = (1u64 << (words_len % 64)) - 1;
      }
      domains.push(bits);
      domain_counts.push(words_len);
    }

    let mut word_gid_by_len: Vec<Vec<usize>> = vec![Vec::new(); dict.max_len + 1];
    let mut gid_indices_by_len: Vec<HashMap<usize, Vec<usize>>> =
      (0..=dict.max_len).map(|_| HashMap::new()).collect();
    let mut gid_by_word: HashMap<String, usize> = HashMap::new();
    let mut next_gid: usize = 0;

    for len in 0..=dict.max_len {
      let words = &dict.words[len];
      if words.is_empty() {
        continue;
      }
      let mut gids: Vec<usize> = Vec::with_capacity(words.len());
      for (idx, word) in words.iter().enumerate() {
        let gid = if let Some(existing) = gid_by_word.get(word) {
          *existing
        } else {
          let created = next_gid;
          next_gid += 1;
          gid_by_word.insert(word.clone(), created);
          created
        };
        gids.push(gid);
        gid_indices_by_len[len].entry(gid).or_default().push(idx);
      }
      word_gid_by_len[len] = gids;
    }

    let mut priority_by_len: Vec<Vec<i64>> = vec![Vec::new(); dict.max_len + 1];
    for len in 0..=dict.max_len {
      if dict.words[len].is_empty() {
        continue;
      }
      let mut priorities = Vec::with_capacity(dict.words[len].len());
      for word in &dict.words[len] {
        priorities.push(word_priority(options, word));
      }
      priority_by_len[len] = priorities;
    }

    Self {
      slots,
      dict,
      options,
      crosses,
      adjacency,
      index,
      domains,
      domain_counts,
      assigned: vec![None; slots.len()],
      assigned_count: 0,
      trail: Vec::new(),
      weighted_degree: vec![1; slots.len()],
      slot_ids_by_len,
      word_gid_by_len,
      gid_indices_by_len,
      priority_by_len,
      used_gid_count: HashMap::new(),
      current_score: 0,
      best_score: i64::MAX,
      best_assignment: None,
      repeat_penalty: DEFAULT_REPEAT_PENALTY,
      rng: Rng::new(seed),
    }
  }

  fn domain_has_word(&self, slot: usize, word_idx: usize) -> bool {
    bit_is_set(self.domains.get(slot).map(|d| d.as_slice()).unwrap_or(&[]), word_idx)
  }

  fn remove_word_from_domain(&mut self, slot: usize, word_idx: usize) -> bool {
    if self.assigned.get(slot).and_then(|v| *v).is_some() {
      return false;
    }
    let block = word_idx / 64;
    if block >= self.domains[slot].len() {
      return false;
    }
    let bit = 1u64 << (word_idx % 64);
    if self.domains[slot][block] & bit == 0 {
      return false;
    }
    self.domains[slot][block] &= !bit;
    self.domain_counts[slot] = self.domain_counts[slot].saturating_sub(1);
    self.trail.push(CspTrailEntry {
      slot,
      block,
      removed: bit,
    });
    true
  }

  fn apply_allowed_mask(&mut self, slot: usize, allowed: Option<&[u64]>) {
    if self.assigned.get(slot).and_then(|v| *v).is_some() {
      return;
    }
    match allowed {
      Some(mask) => {
        for block in 0..self.domains[slot].len() {
          let allow = mask.get(block).copied().unwrap_or(0);
          let current = self.domains[slot][block];
          let removed = current & !allow;
          if removed == 0 {
            continue;
          }
          self.domains[slot][block] = current & allow;
          self.domain_counts[slot] =
            self.domain_counts[slot].saturating_sub(removed.count_ones() as usize);
          self.trail.push(CspTrailEntry { slot, block, removed });
        }
      }
      None => {
        for block in 0..self.domains[slot].len() {
          let removed = self.domains[slot][block];
          if removed == 0 {
            continue;
          }
          self.domains[slot][block] = 0;
          self.domain_counts[slot] =
            self.domain_counts[slot].saturating_sub(removed.count_ones() as usize);
          self.trail.push(CspTrailEntry { slot, block, removed });
        }
      }
    }
  }

  fn undo_to(&mut self, mark: usize) {
    while self.trail.len() > mark {
      if let Some(change) = self.trail.pop() {
        self.domains[change.slot][change.block] |= change.removed;
        self.domain_counts[change.slot] =
          self.domain_counts[change.slot].saturating_add(change.removed.count_ones() as usize);
      }
    }
  }

  fn count_group_in_domain(&self, slot: usize, len: usize, gid: usize) -> usize {
    let indices = match self
      .gid_indices_by_len
      .get(len)
      .and_then(|by_gid| by_gid.get(&gid))
    {
      Some(items) => items,
      None => return 0,
    };
    indices
      .iter()
      .filter(|&&idx| self.domain_has_word(slot, idx))
      .count()
  }

  fn count_group_with_char_in_domain(
    &self,
    slot: usize,
    len: usize,
    gid: usize,
    pos: usize,
    ch: char,
  ) -> usize {
    let indices = match self
      .gid_indices_by_len
      .get(len)
      .and_then(|by_gid| by_gid.get(&gid))
    {
      Some(items) => items,
      None => return 0,
    };
    indices
      .iter()
      .filter(|&&idx| {
        self.domain_has_word(slot, idx)
          && self
            .dict
            .chars
            .get(len)
            .and_then(|words| words.get(idx))
            .and_then(|letters| letters.get(pos))
            .copied()
            == Some(ch)
      })
      .count()
  }

  fn count_domain_after_cross(
    &self,
    slot: usize,
    pos: usize,
    ch: char,
    unique_gid: Option<usize>,
  ) -> usize {
    let len = self.slots[slot].len;
    let allowed = self
      .index
      .pos_index
      .get(len)
      .and_then(|positions| positions.get(pos))
      .and_then(|by_char| by_char.get(&ch));
    let mut count = match allowed {
      Some(index_cell) => bitset_intersection_count(&self.domains[slot], &index_cell.bits),
      None => 0,
    };
    if count == 0 {
      return 0;
    }
    if self.options.unique_words {
      if let Some(gid) = unique_gid {
        let remove = self.count_group_with_char_in_domain(slot, len, gid, pos, ch);
        count = count.saturating_sub(remove);
      }
    }
    count
  }

  fn set_forward_fail(&mut self, state: &mut SearchState, slot_id: usize) {
    state.reject_forward += 1;
    let slot = self
      .slots
      .get(slot_id)
      .cloned()
      .map(|s| slot_to_fail(&s))
      .unwrap_or(FailSlot {
        id: slot_id,
        r: 0,
        c: 0,
        len: 0,
        dir: "right".to_string(),
      });
    state.last_fail = Some(FailInfo {
      reason: "forward-check",
      slot: Some(slot),
      column: None,
      limit: None,
    });
  }

  fn apply_forward(&mut self, picked_slot: usize, word_idx: usize, state: &mut SearchState) -> bool {
    let slot_len = self.slots[picked_slot].len;
    let word_chars = match self
      .dict
      .chars
      .get(slot_len)
      .and_then(|words| words.get(word_idx))
    {
      Some(chars) => chars,
      None => {
        self.set_forward_fail(state, picked_slot);
        return false;
      }
    };

    let crosses = self.crosses[picked_slot].clone();
    for cross in crosses {
      let other = cross.other;
      if self.assigned[other].is_some() {
        continue;
      }
      let needed = word_chars[cross.i_self];
      let allowed_bits = self
        .index
        .pos_index
        .get(self.slots[other].len)
        .and_then(|positions| positions.get(cross.i_other))
        .and_then(|by_char| by_char.get(&needed))
        .map(|cell| cell.bits.clone());
      self.apply_allowed_mask(other, allowed_bits.as_deref());
      if self.domain_counts[other] == 0 {
        self.weighted_degree[picked_slot] = self.weighted_degree[picked_slot].saturating_add(1);
        self.weighted_degree[other] = self.weighted_degree[other].saturating_add(1);
        self.set_forward_fail(state, other);
        return false;
      }
    }

    if self.options.unique_words {
      let gid = self.word_gid_by_len[slot_len][word_idx];
      let slots_same_len = self
        .slot_ids_by_len
        .get(&slot_len)
        .cloned()
        .unwrap_or_default();
      let gid_indices = self
        .gid_indices_by_len
        .get(slot_len)
        .and_then(|by_gid| by_gid.get(&gid))
        .cloned()
        .unwrap_or_default();
      for slot_id in slots_same_len {
        if slot_id == picked_slot || self.assigned[slot_id].is_some() {
          continue;
        }
        for idx in &gid_indices {
          self.remove_word_from_domain(slot_id, *idx);
        }
        if self.domain_counts[slot_id] == 0 {
          self.weighted_degree[picked_slot] = self.weighted_degree[picked_slot].saturating_add(1);
          self.weighted_degree[slot_id] = self.weighted_degree[slot_id].saturating_add(1);
          self.set_forward_fail(state, slot_id);
          return false;
        }
      }
    }

    true
  }

  fn choose_variable(&self) -> Option<usize> {
    let mut best_slot: Option<usize> = None;
    let mut best_count: usize = usize::MAX;
    let mut best_degree: usize = 0;
    let mut best_weight: u32 = 0;

    for slot in self.slots {
      let slot_id = slot.id;
      if self.assigned[slot_id].is_some() {
        continue;
      }
      let count = self.domain_counts[slot_id];
      let degree = self
        .adjacency
        .get(slot_id)
        .map(|neighbors| {
          neighbors
            .iter()
            .filter(|&&n| self.assigned.get(n).and_then(|v| *v).is_none())
            .count()
        })
        .unwrap_or(0);
      let weight = *self.weighted_degree.get(slot_id).unwrap_or(&0);
      let replace = best_slot.is_none()
        || count < best_count
        || (count == best_count
          && (degree > best_degree
            || (degree == best_degree
              && (weight > best_weight
                || (weight == best_weight && slot_id < best_slot.unwrap_or(slot_id))))));
      if replace {
        best_slot = Some(slot_id);
        best_count = count;
        best_degree = degree;
        best_weight = weight;
      }
    }

    best_slot
  }

  fn lcv_support(&self, slot_id: usize, word_idx: usize) -> Option<i32> {
    let slot_len = self.slots[slot_id].len;
    let gid = self.word_gid_by_len[slot_len][word_idx];
    let word_chars = self.dict.chars.get(slot_len)?.get(word_idx)?;
    let mut support: i32 = 0;

    for cross in &self.crosses[slot_id] {
      let other = cross.other;
      if self.assigned[other].is_some() {
        continue;
      }
      let needed = word_chars[cross.i_self];
      let after = self.count_domain_after_cross(
        other,
        cross.i_other,
        needed,
        if self.options.unique_words { Some(gid) } else { None },
      );
      if after == 0 {
        return None;
      }
      support = support.saturating_add(after as i32);
    }

    if self.options.unique_words {
      if let Some(slots_same_len) = self.slot_ids_by_len.get(&slot_len) {
        for &other in slots_same_len {
          if other == slot_id || self.assigned[other].is_some() {
            continue;
          }
          let after = self.domain_counts[other].saturating_sub(self.count_group_in_domain(other, slot_len, gid));
          if after == 0 {
            return None;
          }
        }
      }
    }

    Some(support)
  }

  fn order_candidates(&mut self, slot_id: usize) -> Vec<usize> {
    let len = self.slots[slot_id].len;
    let mut candidates: Vec<usize> = Vec::with_capacity(self.domain_counts[slot_id]);
    collect_set_bits(&self.domains[slot_id], &mut candidates);

    if self.options.unique_words {
      candidates.retain(|idx| {
        let gid = self.word_gid_by_len[len][*idx];
        self.used_gid_count.get(&gid).copied().unwrap_or(0) == 0
      });
    }

    if candidates.len() < 2 {
      return candidates;
    }

    if self.options.lcv {
      let mut scored: Vec<(i32, i64, u32, usize)> = Vec::with_capacity(candidates.len());
      for (i, idx) in candidates.iter().copied().enumerate() {
        let support = self.lcv_support(slot_id, idx).unwrap_or(-1);
        let priority = self.priority_by_len[len][idx];
        let tie = if self.options.shuffle {
          self.rng.next_u32()
        } else {
          i as u32
        };
        scored.push((support, priority, tie, idx));
      }
      scored.sort_by(|a, b| {
        compare_scored_candidates(a.0, a.1, a.2, b.0, b.1, b.2, self.options.lcv_priority_slack)
      });
      return scored.into_iter().map(|s| s.3).collect();
    }

    if self.options.word_priority.is_some() {
      let mut scored: Vec<(i64, u32, usize)> = Vec::with_capacity(candidates.len());
      for (i, idx) in candidates.iter().copied().enumerate() {
        let priority = self.priority_by_len[len][idx];
        let tie = if self.options.shuffle {
          self.rng.next_u32()
        } else {
          i as u32
        };
        scored.push((priority, tie, idx));
      }
      scored.sort_by(|a, b| a.0.cmp(&b.0).then_with(|| a.1.cmp(&b.1)));
      return scored.into_iter().map(|s| s.2).collect();
    }

    if self.options.shuffle {
      self.rng.shuffle(&mut candidates);
    }
    candidates
  }

  fn optimistic_lower_bound(&self) -> Option<i64> {
    let mut bound: i64 = 0;
    for slot in self.slots {
      let slot_id = slot.id;
      if self.assigned[slot_id].is_some() {
        continue;
      }
      let len = slot.len;
      let mut min_priority = i64::MAX;
      let mut words: Vec<usize> = Vec::with_capacity(self.domain_counts[slot_id]);
      collect_set_bits(&self.domains[slot_id], &mut words);
      for word_idx in words {
        let gid = self.word_gid_by_len[len][word_idx];
        if self.options.unique_words && self.used_gid_count.get(&gid).copied().unwrap_or(0) > 0 {
          continue;
        }
        let priority = self.priority_by_len[len][word_idx];
        if priority < min_priority {
          min_priority = priority;
        }
      }
      if min_priority == i64::MAX {
        return None;
      }
      bound = bound.saturating_add(min_priority);
    }
    Some(bound)
  }

  fn score_delta(&self, len: usize, word_idx: usize) -> i64 {
    let gid = self.word_gid_by_len[len][word_idx];
    let used = self.used_gid_count.get(&gid).copied().unwrap_or(0) as i64;
    self.priority_by_len[len][word_idx].saturating_add(used.saturating_mul(self.repeat_penalty))
  }

  fn current_assignment(&self) -> Option<Vec<usize>> {
    self.assigned.iter().copied().collect()
  }

  fn update_best_if_complete(&mut self) {
    if self.assigned_count != self.slots.len() {
      return;
    }
    if self.current_score >= self.best_score {
      return;
    }
    if let Some(assign) = self.current_assignment() {
      self.best_score = self.current_score;
      self.best_assignment = Some(assign);
    }
  }

  fn search(
    &mut self,
    state: &mut SearchState,
    progress_ctx: &mut ProgressCtx<'_>,
    abort_flag: Option<&AtomicBool>,
  ) -> bool {
    if should_abort(state, self.options, abort_flag) {
      return true;
    }

    if self.assigned_count == self.slots.len() {
      self.update_best_if_complete();
      return false;
    }

    if self.best_assignment.is_some() {
      match self.optimistic_lower_bound() {
        Some(lower_bound) => {
          if self.current_score.saturating_add(lower_bound) >= self.best_score {
            return false;
          }
        }
        None => {
          return false;
        }
      }
    }

    let slot_id = match self.choose_variable() {
      Some(slot) => slot,
      None => return false,
    };
    if self.domain_counts[slot_id] == 0 {
      state.zero_pick += 1;
      self.weighted_degree[slot_id] = self.weighted_degree[slot_id].saturating_add(1);
      state.last_fail = Some(FailInfo {
        reason: "zero-pick",
        slot: self.slots.get(slot_id).map(slot_to_fail),
        column: None,
        limit: None,
      });
      return false;
    }

    let candidates = self.order_candidates(slot_id);
    if candidates.is_empty() {
      state.zero_pick += 1;
      self.weighted_degree[slot_id] = self.weighted_degree[slot_id].saturating_add(1);
      state.last_fail = Some(FailInfo {
        reason: "zero-pick",
        slot: self.slots.get(slot_id).map(slot_to_fail),
        column: None,
        limit: None,
      });
      return false;
    }

    for word_idx in candidates {
      if should_abort(state, self.options, abort_flag) {
        return true;
      }
      state.nodes += 1;
      let len = self.slots[slot_id].len;
      let word = &self.dict.words[len][word_idx];
      let degree = self
        .adjacency
        .get(slot_id)
        .map(|neighbors| neighbors.len())
        .unwrap_or(0);
      let pick = ProgressLastPickRef {
        id: slot_id,
        len,
        degree,
        candidates: self.domain_counts[slot_id] as i32,
        pattern: word,
      };
      maybe_report(
        state,
        progress_ctx,
        self.assigned_count + 1,
        self.slots.len(),
        false,
        Some(pick),
      );

      let gid = self.word_gid_by_len[len][word_idx];
      let prev_used = self.used_gid_count.get(&gid).copied().unwrap_or(0);
      self.assigned[slot_id] = Some(word_idx);
      self.assigned_count += 1;
      self.used_gid_count.insert(gid, prev_used + 1);
      let prev_score = self.current_score;
      self.current_score = self.current_score.saturating_add(self.score_delta(len, word_idx));

      let mark = self.trail.len();
      let ok = self.apply_forward(slot_id, word_idx, state);
      let aborted = if ok {
        self.search(state, progress_ctx, abort_flag)
      } else {
        false
      };

      self.undo_to(mark);
      self.current_score = prev_score;
      if prev_used == 0 {
        self.used_gid_count.remove(&gid);
      } else {
        self.used_gid_count.insert(gid, prev_used);
      }
      self.assigned[slot_id] = None;
      self.assigned_count = self.assigned_count.saturating_sub(1);

      if aborted {
        return true;
      }
    }

    state.backtracks += 1;
    self.weighted_degree[slot_id] = self.weighted_degree[slot_id].saturating_add(1);
    false
  }
}

fn bit_is_set(bits: &[u64], idx: usize) -> bool {
  let block = idx / 64;
  if block >= bits.len() {
    return false;
  }
  let bit = 1u64 << (idx % 64);
  bits[block] & bit != 0
}

fn collect_set_bits(bits: &[u64], out: &mut Vec<usize>) {
  for (block_idx, block) in bits.iter().copied().enumerate() {
    let mut value = block;
    while value != 0 {
      let bit = value.trailing_zeros() as usize;
      out.push(block_idx * 64 + bit);
      value &= value - 1;
    }
  }
}

fn bitset_intersection_count(a: &[u64], b: &[u64]) -> usize {
  let mut total = 0usize;
  let blocks = a.len().min(b.len());
  for i in 0..blocks {
    total += (a[i] & b[i]).count_ones() as usize;
  }
  total
}

fn run_attempt_csp<'a>(
  emitter: Option<Box<dyn ProgressEmitter + 'a>>,
  raw_rows: &[String],
  slots: &[Slot],
  dict: &Dict,
  options: &ResolveOptions,
  attempt: usize,
  attempt_start: Instant,
  next_log_at: &mut u64,
  abort_flag: Option<&AtomicBool>,
) -> Option<(Vec<Vec<char>>, i64)> {
  let index = build_word_index(dict);
  let (crosses, adjacency, _) = build_cross_data(slots);
  let total_slots = slots.len();
  let seed = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .unwrap_or_default()
    .as_nanos() as u64
    ^ ((attempt as u64) << 1);

  let mut state = SearchState {
    nodes: 0,
    backtracks: 0,
    zero_pick: 0,
    reject_intersect: 0,
    reject_forward: 0,
    start: attempt_start,
    aborted: false,
    abort_reason: None,
    last_fail: None,
  };

  let mut progress_ctx = ProgressCtx {
    emitter,
    label: options.label.clone(),
    attempt,
    restarts: options.restarts,
    engine: "csp",
    total_slots,
    next_log_at: if options.log_every_ms > 0 {
      *next_log_at
    } else {
      u64::MAX
    },
    next_log_node: if options.log_every_nodes > 0 {
      options.log_every_nodes
    } else {
      u64::MAX
    },
    log_every_ms: options.log_every_ms,
    log_every_nodes: options.log_every_nodes,
    stdout: options.progress_stdout,
    fail_stdout: options.fail_stdout,
  };
  maybe_report(&state, &mut progress_ctx, 0, total_slots, true, None);

  let mut search = CspSearch::new(slots, dict, options, crosses, adjacency, index, seed);
  let _ = search.search(&mut state, &mut progress_ctx, abort_flag);
  if options.log_every_ms > 0 {
    *next_log_at = progress_ctx.next_log_at;
  }

  let assignment = match search.best_assignment.clone() {
    Some(assign) => assign,
    None => {
      emit_fail(&state, &mut progress_ctx);
      return None;
    }
  };

  let mut grid = init_grid(raw_rows);
  for slot in slots {
    let word_idx = assignment[slot.id];
    let chars = &dict.chars[slot.len][word_idx];
    for (i, (r, c)) in slot.cells.iter().enumerate() {
      grid[*r][*c] = chars[i];
    }
  }

  Some((grid, search.best_score))
}

fn solve_attempt_with_progress_direct_csp(
  env: &Env,
  progress: &JsFunction,
  rows: &[String],
  slots: &[Slot],
  dict: &Dict,
  components: &[Vec<usize>],
  options: &ResolveOptions,
  attempt: usize,
) -> Option<(Vec<Vec<char>>, i64)> {
  let mut grid = init_grid(rows);
  let mut used_global: HashSet<String> = HashSet::new();
  let mut total_score: i64 = 0;
  let attempt_start = Instant::now();
  let mut next_log_at = if options.log_every_ms > 0 {
    options.log_every_ms
  } else {
    u64::MAX
  };

  for comp in components {
    let sub_slots = remap_slots(slots, comp);
    let dict_for_comp = if options.unique_words && !used_global.is_empty() {
      DictRef::Owned(dict.filter(&used_global))
    } else {
      DictRef::Borrowed(dict)
    };

    let emitter: Box<dyn ProgressEmitter> = Box::new(DirectEmitter {
      env,
      callback: progress,
    });
    let (solved, score) = run_attempt_csp(
      Some(emitter),
      rows,
      &sub_slots,
      dict_for_comp.as_ref(),
      options,
      attempt,
      attempt_start,
      &mut next_log_at,
      None,
    )?;

    if options.unique_words {
      for slot in &sub_slots {
        let word: String = slot.cells.iter().map(|(r, c)| solved[*r][*c]).collect();
        used_global.insert(word);
      }
    }

    total_score = total_score.saturating_add(score);
    merge_grid(&mut grid, &solved);
  }

  Some((grid, total_score))
}

fn solve_attempt_with_progress_tsfn_csp(
  progress: &Arc<ThreadsafeFunction<String>>,
  rows: &[String],
  slots: &[Slot],
  dict: &Dict,
  components: &[Vec<usize>],
  options: &ResolveOptions,
  attempt: usize,
) -> Option<(Vec<Vec<char>>, i64)> {
  let mut grid = init_grid(rows);
  let mut used_global: HashSet<String> = HashSet::new();
  let mut total_score: i64 = 0;
  let attempt_start = Instant::now();
  let mut next_log_at = if options.log_every_ms > 0 {
    options.log_every_ms
  } else {
    u64::MAX
  };

  for comp in components {
    let sub_slots = remap_slots(slots, comp);
    let dict_for_comp = if options.unique_words && !used_global.is_empty() {
      DictRef::Owned(dict.filter(&used_global))
    } else {
      DictRef::Borrowed(dict)
    };

    let emitter: Box<dyn ProgressEmitter> = Box::new(TsfnEmitter {
      callback: Arc::clone(progress),
      call_mode: ThreadsafeFunctionCallMode::NonBlocking,
      debug: options.debug_dlx,
      logged: false,
    });
    let (solved, score) = run_attempt_csp(
      Some(emitter),
      rows,
      &sub_slots,
      dict_for_comp.as_ref(),
      options,
      attempt,
      attempt_start,
      &mut next_log_at,
      None,
    )?;

    if options.unique_words {
      for slot in &sub_slots {
        let word: String = slot.cells.iter().map(|(r, c)| solved[*r][*c]).collect();
        used_global.insert(word);
      }
    }

    total_score = total_score.saturating_add(score);
    merge_grid(&mut grid, &solved);
  }

  Some((grid, total_score))
}

fn solve_attempt_no_progress_csp(
  rows: &[String],
  slots: &[Slot],
  dict: &Dict,
  components: &[Vec<usize>],
  options: &ResolveOptions,
  attempt: usize,
) -> Option<(Vec<Vec<char>>, i64)> {
  let mut grid = init_grid(rows);
  let mut used_global: HashSet<String> = HashSet::new();
  let mut total_score: i64 = 0;
  let attempt_start = Instant::now();
  let mut next_log_at = if options.log_every_ms > 0 {
    options.log_every_ms
  } else {
    u64::MAX
  };

  for comp in components {
    let sub_slots = remap_slots(slots, comp);
    let dict_for_comp = if options.unique_words && !used_global.is_empty() {
      DictRef::Owned(dict.filter(&used_global))
    } else {
      DictRef::Borrowed(dict)
    };
    let (solved, score) = run_attempt_csp(
      None,
      rows,
      &sub_slots,
      dict_for_comp.as_ref(),
      options,
      attempt,
      attempt_start,
      &mut next_log_at,
      None,
    )?;
    if options.unique_words {
      for slot in &sub_slots {
        let word: String = slot.cells.iter().map(|(r, c)| solved[*r][*c]).collect();
        used_global.insert(word);
      }
    }
    total_score = total_score.saturating_add(score);
    merge_grid(&mut grid, &solved);
  }

  Some((grid, total_score))
}

fn run_attempt_dlx<'a>(
  emitter: Option<Box<dyn ProgressEmitter + 'a>>,
  raw_rows: &[String],
  slots: &[Slot],
  dict: &Dict,
  options: &ResolveOptions,
  attempt: usize,
  attempt_start: Instant,
  next_log_at: &mut u64,
  abort_flag: Option<&AtomicBool>,
) -> Option<Vec<Vec<char>>> {
  let index = build_word_index(dict);
  let (crosses, adjacency, intersection_cells) = build_cross_data(slots);
  let total_slots = slots.len();

  let mut columns: Vec<DlxColumn> = Vec::new();
  let mut nodes: Vec<DlxNode> = Vec::new();
  let mut col_meta: Vec<ColumnMeta> = Vec::new();

  let header = create_column(&mut columns, &mut nodes, true);
  col_meta.push(ColumnMeta::Other("root".to_string()));

  let mut slot_cols: Vec<usize> = vec![0; slots.len()];
  let mut slot_fail: Vec<Option<FailSlot>> = vec![None; slots.len()];
  for slot in slots {
    if slot.id < slot_fail.len() {
      slot_fail[slot.id] = Some(slot_to_fail(slot));
    }
  }
  for slot in slots {
    let col = create_column(&mut columns, &mut nodes, true);
    link_column(&mut columns, header, col);
    slot_cols[slot.id] = col;
    let meta = slot_fail
      .get(slot.id)
      .and_then(|s| s.clone())
      .unwrap_or_else(|| slot_to_fail(slot));
    col_meta.push(ColumnMeta::Slot(meta));
  }

  let mut cell_cols: HashMap<(usize, usize), usize> = HashMap::new();
  for key in intersection_cells.iter() {
    let col = create_column(&mut columns, &mut nodes, false);
    cell_cols.insert(*key, col);
    col_meta.push(ColumnMeta::Cell(key.0, key.1));
  }

  let mut word_cols: HashMap<String, usize> = HashMap::new();
  let mut rows: Vec<DlxRow> = Vec::new();

  let seed = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .unwrap_or_default()
    .as_nanos() as u64
    ^ (attempt as u64);
  let mut rng = Rng::new(seed);

  for slot in slots {
    let len = slot.len;
    if len > dict.max_len {
      continue;
    }
    let word_list = &dict.words[len];
    if word_list.is_empty() {
      continue;
    }

    let mut candidates: Vec<usize> = (0..word_list.len()).collect();

    if options.lcv && candidates.len() > 1 {
      let mut scored: Vec<(i32, i64, u32, usize)> = Vec::with_capacity(candidates.len());
      for (i, &idx) in candidates.iter().enumerate() {
        let score = score_word(
          slot.id,
          idx,
          &crosses,
          slots,
          &index,
          dict,
        );
        let priority = word_priority(options, &word_list[idx]);
        let tie = if options.shuffle { rng.next_u32() } else { i as u32 };
        scored.push((score, priority, tie, idx));
      }
      scored.sort_by(|a, b| {
        compare_scored_candidates(a.0, a.1, a.2, b.0, b.1, b.2, options.lcv_priority_slack)
      });
      candidates = scored.into_iter().map(|s| s.3).collect();
    } else if options.word_priority.is_some() && candidates.len() > 1 {
      let mut scored: Vec<(i64, u32, usize)> = Vec::with_capacity(candidates.len());
      for (i, &idx) in candidates.iter().enumerate() {
        let priority = word_priority(options, &word_list[idx]);
        let tie = if options.shuffle { rng.next_u32() } else { i as u32 };
        scored.push((priority, tie, idx));
      }
      scored.sort_by(|a, b| a.0.cmp(&b.0).then_with(|| a.1.cmp(&b.1)));
      candidates = scored.into_iter().map(|s| s.2).collect();
    } else if options.shuffle && candidates.len() > 1 {
      rng.shuffle(&mut candidates);
    }

    for &word_idx in &candidates {
      let row_id = rows.len();
      rows.push(DlxRow {
        slot_id: slot.id,
        len,
        word_idx,
      });
      let mut items: Vec<(usize, Option<char>)> = Vec::new();
      let slot_col = slot_cols[slot.id];
      items.push((slot_col, None));

      if options.unique_words {
        let word = &word_list[word_idx];
        let wcol = *word_cols.entry(word.clone()).or_insert_with(|| {
          let col = create_column(&mut columns, &mut nodes, false);
          col_meta.push(ColumnMeta::Word(word.clone()));
          col
        });
        items.push((wcol, None));
      }

      let word_chars = &dict.chars[len][word_idx];
      for (i, (r, c)) in slot.cells.iter().enumerate() {
        if let Some(col) = cell_cols.get(&(*r, *c)) {
          items.push((*col, Some(word_chars[i])));
        }
      }

      add_row(&mut columns, &mut nodes, row_id, items);
    }
  }

  let mut matrix = DlxMatrix {
    columns,
    nodes,
    rows,
    header,
  };

  let mut state = SearchState {
    nodes: 0,
    backtracks: 0,
    zero_pick: 0,
    reject_intersect: 0,
    reject_forward: 0,
    start: attempt_start,
    aborted: false,
    abort_reason: None,
    last_fail: None,
  };

  let mut progress_ctx = ProgressCtx {
    emitter,
    label: options.label.clone(),
    attempt,
    restarts: options.restarts,
    engine: "dlx",
    total_slots,
    next_log_at: if options.log_every_ms > 0 { *next_log_at } else { u64::MAX },
    next_log_node: if options.log_every_nodes > 0 { options.log_every_nodes } else { u64::MAX },
    log_every_ms: options.log_every_ms,
    log_every_nodes: options.log_every_nodes,
    stdout: options.progress_stdout,
    fail_stdout: options.fail_stdout,
  };
  if options.debug_dlx {
    eprintln!(
      "[native-dlx] attempt {} emitter={} logEveryMs={} logEveryNodes={}",
      attempt,
      progress_ctx.emitter.is_some(),
      progress_ctx.log_every_ms,
      progress_ctx.log_every_nodes
    );
  }
  maybe_report(&state, &mut progress_ctx, 0, total_slots, true, None);

  let mut solution: Vec<usize> = Vec::new();
  let solved = search(
    &mut matrix,
    &mut state,
    &mut solution,
    options,
    &adjacency,
    dict,
    &mut progress_ctx,
    &col_meta,
    abort_flag,
  );
  if options.log_every_ms > 0 {
    *next_log_at = progress_ctx.next_log_at;
  }

  if !solved || state.aborted {
    emit_fail(&state, &mut progress_ctx);
    return None;
  }

  let mut grid = init_grid(raw_rows);
  for &node_idx in &solution {
    let row_id = matrix.nodes[node_idx].row_id;
    let row = &matrix.rows[row_id];
    let word_chars = &dict.chars[row.len][row.word_idx];
    let slot = &slots[row.slot_id];
    for (i, (r, c)) in slot.cells.iter().enumerate() {
      grid[*r][*c] = word_chars[i];
    }
  }

  Some(grid)
}

fn run_attempt_dlx_no_progress(
  raw_rows: &[String],
  slots: &[Slot],
  dict: &Dict,
  options: &ResolveOptions,
  attempt: usize,
  attempt_start: Instant,
  abort_flag: Option<&AtomicBool>,
) -> Option<Vec<Vec<char>>> {
  let index = build_word_index(dict);
  let (crosses, _adjacency, intersection_cells) = build_cross_data(slots);

  let mut columns: Vec<DlxColumn> = Vec::new();
  let mut nodes: Vec<DlxNode> = Vec::new();

  let header = create_column(&mut columns, &mut nodes, true);

  let mut slot_cols: Vec<usize> = vec![0; slots.len()];
  for slot in slots {
    let col = create_column(&mut columns, &mut nodes, true);
    link_column(&mut columns, header, col);
    slot_cols[slot.id] = col;
  }

  let mut cell_cols: HashMap<(usize, usize), usize> = HashMap::new();
  for key in intersection_cells.iter() {
    let col = create_column(&mut columns, &mut nodes, false);
    cell_cols.insert(*key, col);
  }

  let mut word_cols: HashMap<String, usize> = HashMap::new();
  let mut rows: Vec<DlxRow> = Vec::new();

  let seed = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .unwrap_or_default()
    .as_nanos() as u64
    ^ (attempt as u64);
  let mut rng = Rng::new(seed);

  for slot in slots {
    let len = slot.len;
    if len > dict.max_len {
      continue;
    }
    let word_list = &dict.words[len];
    if word_list.is_empty() {
      continue;
    }

    let mut candidates: Vec<usize> = (0..word_list.len()).collect();

    if options.lcv && candidates.len() > 1 {
      let mut scored: Vec<(i32, i64, u32, usize)> = Vec::with_capacity(candidates.len());
      for (i, &idx) in candidates.iter().enumerate() {
        let score = score_word(
          slot.id,
          idx,
          &crosses,
          slots,
          &index,
          dict,
        );
        let priority = word_priority(options, &word_list[idx]);
        let tie = if options.shuffle { rng.next_u32() } else { i as u32 };
        scored.push((score, priority, tie, idx));
      }
      scored.sort_by(|a, b| {
        compare_scored_candidates(a.0, a.1, a.2, b.0, b.1, b.2, options.lcv_priority_slack)
      });
      candidates = scored.into_iter().map(|s| s.3).collect();
    } else if options.word_priority.is_some() && candidates.len() > 1 {
      let mut scored: Vec<(i64, u32, usize)> = Vec::with_capacity(candidates.len());
      for (i, &idx) in candidates.iter().enumerate() {
        let priority = word_priority(options, &word_list[idx]);
        let tie = if options.shuffle { rng.next_u32() } else { i as u32 };
        scored.push((priority, tie, idx));
      }
      scored.sort_by(|a, b| a.0.cmp(&b.0).then_with(|| a.1.cmp(&b.1)));
      candidates = scored.into_iter().map(|s| s.2).collect();
    } else if options.shuffle && candidates.len() > 1 {
      rng.shuffle(&mut candidates);
    }

    for &word_idx in &candidates {
      let row_id = rows.len();
      rows.push(DlxRow {
        slot_id: slot.id,
        len,
        word_idx,
      });
      let mut items: Vec<(usize, Option<char>)> = Vec::new();
      let slot_col = slot_cols[slot.id];
      items.push((slot_col, None));

      if options.unique_words {
        let word = &word_list[word_idx];
        let wcol = *word_cols.entry(word.clone()).or_insert_with(|| {
          create_column(&mut columns, &mut nodes, false)
        });
        items.push((wcol, None));
      }

      let word_chars = &dict.chars[len][word_idx];
      for (i, (r, c)) in slot.cells.iter().enumerate() {
        if let Some(col) = cell_cols.get(&(*r, *c)) {
          items.push((*col, Some(word_chars[i])));
        }
      }

      add_row(&mut columns, &mut nodes, row_id, items);
    }
  }

  let mut matrix = DlxMatrix {
    columns,
    nodes,
    rows,
    header,
  };

  let mut state = SearchState {
    nodes: 0,
    backtracks: 0,
    zero_pick: 0,
    reject_intersect: 0,
    reject_forward: 0,
    start: attempt_start,
    aborted: false,
    abort_reason: None,
    last_fail: None,
  };

  let mut solution: Vec<usize> = Vec::new();
  let solved = search_no_progress(
    &mut matrix,
    &mut state,
    &mut solution,
    options,
    abort_flag,
  );

  if !solved || state.aborted {
    return None;
  }

  let mut grid = init_grid(raw_rows);
  for &node_idx in &solution {
    let row_id = matrix.nodes[node_idx].row_id;
    let row = &matrix.rows[row_id];
    let word_chars = &dict.chars[row.len][row.word_idx];
    let slot = &slots[row.slot_id];
    for (i, (r, c)) in slot.cells.iter().enumerate() {
      grid[*r][*c] = word_chars[i];
    }
  }

  Some(grid)
}

fn score_word(
  slot_id: usize,
  word_idx: usize,
  crosses: &[Vec<Cross>],
  slots: &[Slot],
  index: &WordIndex,
  dict: &Dict,
) -> i32 {
  let word_chars = &dict.chars[slots[slot_id].len][word_idx];
  let mut score: i32 = 0;
  for cross in &crosses[slot_id] {
    let other_slot = &slots[cross.other];
    let count = count_candidates_at(other_slot.len, cross.i_other, word_chars[cross.i_self], index);
    if count == 0 {
      return -1;
    }
    score += count as i32;
  }
  score
}

fn compare_scored_candidates(
  a_score: i32,
  a_priority: i64,
  a_tie: u32,
  b_score: i32,
  b_priority: i64,
  b_tie: u32,
  lcv_priority_slack: i32,
) -> std::cmp::Ordering {
  let safe_slack = if lcv_priority_slack > 0 { lcv_priority_slack } else { 0 };
  let score_gap = a_score.saturating_sub(b_score).abs();
  if safe_slack > 0 && score_gap <= safe_slack {
    a_priority
      .cmp(&b_priority)
      .then_with(|| b_score.cmp(&a_score))
      .then_with(|| a_tie.cmp(&b_tie))
  } else {
    b_score
      .cmp(&a_score)
      .then_with(|| a_priority.cmp(&b_priority))
      .then_with(|| a_tie.cmp(&b_tie))
  }
}

fn word_priority(options: &ResolveOptions, word: &str) -> i64 {
  options
    .word_priority
    .as_ref()
    .and_then(|map| map.get(word).copied())
    .unwrap_or(0)
}

fn should_abort(
  state: &mut SearchState,
  options: &ResolveOptions,
  abort_flag: Option<&AtomicBool>,
) -> bool {
  if state.aborted {
    return true;
  }
  if let Some(flag) = abort_flag {
    if flag.load(Ordering::Acquire) {
      state.aborted = true;
      state.abort_reason = Some("found");
      return true;
    }
  }
  if let Some(max_ms) = options.max_ms {
    let elapsed = state.start.elapsed().as_millis() as u64;
    if elapsed >= max_ms {
      state.aborted = true;
      state.abort_reason = Some("maxMs");
      return true;
    }
  }
  if let Some(max_nodes) = options.max_nodes {
    if state.nodes >= max_nodes {
      state.aborted = true;
      state.abort_reason = Some("maxNodes");
      return true;
    }
  }
  false
}

fn choose_column(columns: &[DlxColumn], header: usize) -> Option<usize> {
  let mut best: Option<usize> = None;
  let mut best_score = f64::INFINITY;
  let mut c = columns[header].right;
  while c != header {
    let denom = if columns[c].weight <= 0 { 1.0 } else { columns[c].weight as f64 };
    let score = columns[c].size as f64 / denom;
    if score < best_score {
      best_score = score;
      best = Some(c);
    }
    c = columns[c].right;
  }
  best
}

fn search(
  matrix: &mut DlxMatrix,
  state: &mut SearchState,
  solution: &mut Vec<usize>,
  options: &ResolveOptions,
  adjacency: &[HashSet<usize>],
  dict: &Dict,
  progress_ctx: &mut ProgressCtx<'_>,
  col_meta: &[ColumnMeta],
  abort_flag: Option<&AtomicBool>,
) -> bool {
  if matrix.columns[matrix.header].right == matrix.header {
    return true;
  }
  if should_abort(state, options, abort_flag) {
    return false;
  }

  let col = match choose_column(&matrix.columns, matrix.header) {
    Some(c) => c,
    None => return false,
  };
  if matrix.columns[col].size == 0 {
    state.zero_pick += 1;
    let (slot, column) = match col_meta.get(col) {
      Some(meta) => {
        let slot = match meta {
          ColumnMeta::Slot(s) => Some(s.clone()),
          _ => None,
        };
        (slot, Some(meta_to_fail_column(meta)))
      }
      None => (
        None,
        Some(FailColumn {
          name: format!("col:{}", col),
          kind: "other".to_string(),
          slot: None,
          cell: None,
          word: None,
        }),
      ),
    };
    state.last_fail = Some(FailInfo {
      reason: "zero-pick",
      slot,
      column,
      limit: None,
    });
    return false;
  }

  cover(&mut matrix.columns, &mut matrix.nodes, col);
  let head = matrix.columns[col].head;
  let mut r = matrix.nodes[head].down;
  while r != head {
    solution.push(r);
    state.nodes += 1;
    let row_id = matrix.nodes[r].row_id;
    let row = &matrix.rows[row_id];
    let word = &dict.words[row.len][row.word_idx];
    let pick = ProgressLastPickRef {
      id: row.slot_id,
      len: row.len,
      degree: adjacency.get(row.slot_id).map(|s| s.len()).unwrap_or(0),
      candidates: matrix.columns[col].size,
      pattern: word,
    };
    maybe_report(
      state,
      progress_ctx,
      solution.len(),
      progress_ctx.total_slots,
      false,
      Some(pick),
    );
    if should_abort(state, options, abort_flag) {
      solution.pop();
      break;
    }

    let mut purified: Vec<(usize, Vec<usize>)> = Vec::new();
    let mut conflict = false;
    let mut j = matrix.nodes[r].right;
    while j != r {
      if let Some(color) = matrix.nodes[j].color {
        let c = matrix.nodes[j].column;
        if let Some(existing) = matrix.columns[c].color {
          if existing != color {
            state.reject_intersect += 1;
            conflict = true;
            break;
          }
        }
        let mut removed: Vec<usize> = Vec::new();
        if purify(&mut matrix.columns, &mut matrix.nodes, j, &mut removed) {
          purified.push((c, removed));
        }
      }
      j = matrix.nodes[j].right;
    }

    if conflict {
      while let Some((col_idx, mut removed)) = purified.pop() {
        unpurify(&mut matrix.columns, &mut matrix.nodes, col_idx, &mut removed);
      }
      solution.pop();
      r = matrix.nodes[r].down;
      continue;
    }

    let mut covered: Vec<usize> = Vec::new();
    j = matrix.nodes[r].right;
    while j != r {
      if matrix.nodes[j].color.is_none() {
        let c = matrix.nodes[j].column;
        cover(&mut matrix.columns, &mut matrix.nodes, c);
        covered.push(c);
      }
      j = matrix.nodes[j].right;
    }

    if !should_abort(state, options, abort_flag)
      && search(matrix, state, solution, options, adjacency, dict, progress_ctx, col_meta, abort_flag)
    {
      return true;
    }

    while let Some(c) = covered.pop() {
      uncover(&mut matrix.columns, &mut matrix.nodes, c);
    }
    while let Some((col_idx, mut removed)) = purified.pop() {
      unpurify(&mut matrix.columns, &mut matrix.nodes, col_idx, &mut removed);
    }

    solution.pop();
    r = matrix.nodes[r].down;
  }

  state.backtracks += 1;
  matrix.columns[col].weight += 1;
  uncover(&mut matrix.columns, &mut matrix.nodes, col);
  false
}

fn search_no_progress(
  matrix: &mut DlxMatrix,
  state: &mut SearchState,
  solution: &mut Vec<usize>,
  options: &ResolveOptions,
  abort_flag: Option<&AtomicBool>,
) -> bool {
  if matrix.columns[matrix.header].right == matrix.header {
    return true;
  }
  if should_abort(state, options, abort_flag) {
    return false;
  }

  let col = match choose_column(&matrix.columns, matrix.header) {
    Some(c) => c,
    None => return false,
  };
  if matrix.columns[col].size == 0 {
    state.zero_pick += 1;
    return false;
  }

  cover(&mut matrix.columns, &mut matrix.nodes, col);
  let head = matrix.columns[col].head;
  let mut r = matrix.nodes[head].down;
  while r != head {
    solution.push(r);
    state.nodes += 1;
    if should_abort(state, options, abort_flag) {
      solution.pop();
      break;
    }

    let mut purified: Vec<(usize, Vec<usize>)> = Vec::new();
    let mut conflict = false;
    let mut j = matrix.nodes[r].right;
    while j != r {
      if let Some(color) = matrix.nodes[j].color {
        let c = matrix.nodes[j].column;
        if let Some(existing) = matrix.columns[c].color {
          if existing != color {
            state.reject_intersect += 1;
            conflict = true;
            break;
          }
        }
        let mut removed: Vec<usize> = Vec::new();
        if purify(&mut matrix.columns, &mut matrix.nodes, j, &mut removed) {
          purified.push((c, removed));
        }
      }
      j = matrix.nodes[j].right;
    }

    if conflict {
      while let Some((col_idx, mut removed)) = purified.pop() {
        unpurify(&mut matrix.columns, &mut matrix.nodes, col_idx, &mut removed);
      }
      solution.pop();
      r = matrix.nodes[r].down;
      continue;
    }

    let mut covered: Vec<usize> = Vec::new();
    j = matrix.nodes[r].right;
    while j != r {
      if matrix.nodes[j].color.is_none() {
        let c = matrix.nodes[j].column;
        cover(&mut matrix.columns, &mut matrix.nodes, c);
        covered.push(c);
      }
      j = matrix.nodes[j].right;
    }

    if !should_abort(state, options, abort_flag)
      && search_no_progress(matrix, state, solution, options, abort_flag)
    {
      return true;
    }

    while let Some(c) = covered.pop() {
      uncover(&mut matrix.columns, &mut matrix.nodes, c);
    }
    while let Some((col_idx, mut removed)) = purified.pop() {
      unpurify(&mut matrix.columns, &mut matrix.nodes, col_idx, &mut removed);
    }

    solution.pop();
    r = matrix.nodes[r].down;
  }

  state.backtracks += 1;
  matrix.columns[col].weight += 1;
  uncover(&mut matrix.columns, &mut matrix.nodes, col);
  false
}

fn maybe_report(
  state: &SearchState,
  ctx: &mut ProgressCtx<'_>,
  depth: usize,
  total_slots: usize,
  force: bool,
  last_pick: Option<ProgressLastPickRef<'_>>,
) {
  const STDOUT_MIN_MS: u64 = 5_000;
  if ctx.emitter.is_none() && !ctx.stdout {
    return;
  }
  if ctx.log_every_ms == 0 && ctx.log_every_nodes == 0 {
    return;
  }
  let elapsed_ms = state.start.elapsed().as_millis() as u64;
  if ctx.stdout && elapsed_ms < STDOUT_MIN_MS {
    return;
  }
  if !force && elapsed_ms < ctx.next_log_at && state.nodes < ctx.next_log_node {
    return;
  }
  let nodes_per_sec = if elapsed_ms > 0 {
    ((state.nodes as f64) / (elapsed_ms as f64 / 1000.0)).round() as u64
  } else {
    state.nodes
  };
  let unfilled = total_slots.saturating_sub(depth);
  let payload_last_pick = last_pick.map(|p| ProgressLastPick {
    id: p.id,
    len: p.len,
    degree: p.degree,
    candidates: p.candidates,
    pattern: p.pattern.to_string(),
  });
  let payload = ProgressPayload {
    label: ctx.label.clone(),
    attempt: ctx.attempt,
    restarts: ctx.restarts,
    engine: ctx.engine.to_string(),
    nodes: state.nodes,
    elapsed_ms,
    nodes_per_sec,
    unfilled,
    depth,
    last_pick: payload_last_pick,
    stats: ProgressStats {
      reject_intersect: state.reject_intersect,
      reject_forward: state.reject_forward,
      zero_pick: state.zero_pick,
      backtracks: state.backtracks,
    },
  };

  if ctx.stdout {
    let label = payload.label.clone().unwrap_or_else(|| "solve".to_string());
    let sec = (payload.elapsed_ms as f64) / 1000.0;
    let pick = if let Some(p) = &payload.last_pick {
      format!(
        "slot={} len={} cand={} deg={} patt={}",
        p.id, p.len, p.candidates, p.degree, p.pattern
      )
    } else {
      "slot=-".to_string()
    };
    let stats = format!(
      "rej=I:{} F:{} Z:{} bt={}",
      payload.stats.reject_intersect,
      payload.stats.reject_forward,
      payload.stats.zero_pick,
      payload.stats.backtracks
    );
    println!(
      "[progress][{}#{}/{}] {:.1}s nps={} nodes={} unfilled={} depth={} {} {}",
      label,
      payload.attempt,
      payload.restarts,
      sec,
      payload.nodes_per_sec,
      payload.nodes,
      payload.unfilled,
      payload.depth,
      pick,
      stats
    );
  }

  if let Ok(json) = serde_json::to_string(&payload) {
    if let Some(emitter) = ctx.emitter.as_mut() {
      emitter.emit(json);
    }
  }
  if ctx.log_every_ms > 0 {
    ctx.next_log_at = elapsed_ms + ctx.log_every_ms;
  }
  if ctx.log_every_nodes > 0 {
    ctx.next_log_node = state.nodes + ctx.log_every_nodes;
  }
}

fn emit_fail(state: &SearchState, ctx: &mut ProgressCtx<'_>) {
  if ctx.emitter.is_none() && !ctx.fail_stdout {
    return;
  }
  if state.aborted && matches!(state.abort_reason, Some("found")) {
    return;
  }
  let (reason, detail) = if state.aborted {
    let limit = state.abort_reason.map(|s| s.to_string());
    (
      "aborted",
      limit.map(|l| FailDetail {
        slot: None,
        limit: Some(l),
        column: None,
      }),
    )
  } else if let Some(info) = &state.last_fail {
    (
      info.reason,
      Some(FailDetail {
        slot: info.slot.clone(),
        limit: info.limit.map(|s| s.to_string()),
        column: info.column.clone(),
      }),
    )
  } else {
    ("no-solution", None)
  };

  let payload = FailPayload {
    kind: "fail".to_string(),
    label: ctx.label.clone(),
    attempt: ctx.attempt,
    engine: ctx.engine.to_string(),
    reason: reason.to_string(),
    detail,
  };

  if ctx.fail_stdout {
    let label = payload.label.clone().unwrap_or_else(|| "solve".to_string());
    let detail_str = payload
      .detail
      .as_ref()
      .and_then(|d| {
        if let Some(col) = &d.column {
          match col.kind.as_str() {
            "slot" => col.slot.as_ref().map(|s| {
              format!("slot#{} r={} c={} dir={} len={}", s.id, s.r, s.c, s.dir, s.len)
            }),
            "cell" => col.cell.as_ref().map(|c| format!("cell r={} c={}", c.r, c.c)),
            "word" => col.word.as_ref().map(|w| format!("word {}", w)),
            _ => Some(format!("column {}", col.name)),
          }
        } else if let Some(slot) = &d.slot {
          Some(format!("slot#{} r={} c={} dir={} len={}", slot.id, slot.r, slot.c, slot.dir, slot.len))
        } else if let Some(limit) = &d.limit {
          Some(format!("limit {}", limit))
        } else {
          None
        }
      })
      .unwrap_or_default();
    if detail_str.is_empty() {
      println!("[fail][{}#{}] {}", label, payload.attempt, payload.reason);
    } else {
      println!(
        "[fail][{}#{}] {} ({})",
        label, payload.attempt, payload.reason, detail_str
      );
    }
  }

  if let Ok(json) = serde_json::to_string(&payload) {
    if let Some(emitter) = ctx.emitter.as_mut() {
      emitter.emit(json);
    }
  }
}

fn create_column(
  columns: &mut Vec<DlxColumn>,
  nodes: &mut Vec<DlxNode>,
  primary: bool,
) -> usize {
  let col_idx = columns.len();
  let head_idx = nodes.len();
  nodes.push(DlxNode {
    column: col_idx,
    left: head_idx,
    right: head_idx,
    up: head_idx,
    down: head_idx,
    row_id: usize::MAX,
    color: None,
  });
  columns.push(DlxColumn {
    size: 0,
    left: col_idx,
    right: col_idx,
    primary,
    color: None,
    weight: 1,
    head: head_idx,
  });
  col_idx
}

fn link_column(columns: &mut Vec<DlxColumn>, header: usize, col: usize) {
  let left = columns[header].left;
  columns[col].right = header;
  columns[col].left = left;
  columns[left].right = col;
  columns[header].left = col;
}

fn add_row(
  columns: &mut Vec<DlxColumn>,
  nodes: &mut Vec<DlxNode>,
  row_id: usize,
  items: Vec<(usize, Option<char>)>,
) {
  if items.is_empty() {
    return;
  }
  let mut idxs: Vec<usize> = Vec::with_capacity(items.len());
  for (col_idx, color) in items {
    let node_idx = nodes.len();
    nodes.push(DlxNode {
      column: col_idx,
      left: node_idx,
      right: node_idx,
      up: node_idx,
      down: node_idx,
      row_id,
      color,
    });
    idxs.push(node_idx);

    let head = columns[col_idx].head;
    let up = nodes[head].up;
    nodes[node_idx].down = head;
    nodes[node_idx].up = up;
    nodes[up].down = node_idx;
    nodes[head].up = node_idx;
    columns[col_idx].size += 1;
  }

  let len = idxs.len();
  for i in 0..len {
    nodes[idxs[i]].left = idxs[(i + len - 1) % len];
    nodes[idxs[i]].right = idxs[(i + 1) % len];
  }
}

fn cover(columns: &mut Vec<DlxColumn>, nodes: &mut Vec<DlxNode>, col: usize) {
  if columns[col].primary {
    let left = columns[col].left;
    let right = columns[col].right;
    columns[left].right = right;
    columns[right].left = left;
  }
  let head = columns[col].head;
  let mut r = nodes[head].down;
  while r != head {
    let mut j = nodes[r].right;
    while j != r {
      let down = nodes[j].down;
      let up = nodes[j].up;
      nodes[down].up = up;
      nodes[up].down = down;
      columns[nodes[j].column].size -= 1;
      j = nodes[j].right;
    }
    r = nodes[r].down;
  }
}

fn uncover(columns: &mut Vec<DlxColumn>, nodes: &mut Vec<DlxNode>, col: usize) {
  let head = columns[col].head;
  let mut r = nodes[head].up;
  while r != head {
    let mut j = nodes[r].left;
    while j != r {
      columns[nodes[j].column].size += 1;
      let down = nodes[j].down;
      let up = nodes[j].up;
      nodes[down].up = j;
      nodes[up].down = j;
      j = nodes[j].left;
    }
    r = nodes[r].up;
  }
  if columns[col].primary {
    let left = columns[col].left;
    let right = columns[col].right;
    columns[left].right = col;
    columns[right].left = col;
  }
}

fn purify(
  columns: &mut Vec<DlxColumn>,
  nodes: &mut Vec<DlxNode>,
  node_idx: usize,
  removed: &mut Vec<usize>,
) -> bool {
  let color = match nodes[node_idx].color {
    Some(c) => c,
    None => return false,
  };
  let col = nodes[node_idx].column;
  if columns[col].color.is_some() {
    return false;
  }
  columns[col].color = Some(color);
  let head = columns[col].head;
  let mut r = nodes[head].down;
  while r != head {
    if nodes[r].color != Some(color) {
      let mut j = nodes[r].right;
      while j != r {
        let down = nodes[j].down;
        let up = nodes[j].up;
        if nodes[down].up != j || nodes[up].down != j {
          j = nodes[j].right;
          continue;
        }
        nodes[down].up = up;
        nodes[up].down = down;
        columns[nodes[j].column].size -= 1;
        removed.push(j);
        j = nodes[j].right;
      }
    }
    r = nodes[r].down;
  }
  true
}

fn unpurify(
  columns: &mut Vec<DlxColumn>,
  nodes: &mut Vec<DlxNode>,
  col: usize,
  removed: &mut Vec<usize>,
) {
  for &j in removed.iter().rev() {
    columns[nodes[j].column].size += 1;
    let down = nodes[j].down;
    let up = nodes[j].up;
    nodes[down].up = j;
    nodes[up].down = j;
  }
  columns[col].color = None;
}

#[cfg(test)]
mod tests {
  use super::*;

  fn csp_options() -> ResolveOptions {
    normalize_csp_options(resolve_options(SolveOptionsInput {
      shuffle: Some(false),
      lcv: Some(true),
      lcv_priority_slack: Some(0),
      restarts: Some(1),
      unique_words: Some(true),
      split_components: Some(false),
      max_ms: None,
      max_nodes: None,
      parallel_restarts: Some(1),
      log_every_ms: Some(0),
      log_every_nodes: Some(0),
      label: None,
      debug_dlx: Some(false),
      progress_stdout: Some(false),
      fail_stdout: Some(false),
      word_priority: None,
    }))
  }

  #[test]
  fn csp_sat_small_grid() {
    let input = SolveInput {
      rows: vec!["..".to_string(), "..".to_string()],
      slots: vec![
        SlotInput {
          len: 2,
          cells: vec![[0, 0], [0, 1]],
        },
        SlotInput {
          len: 2,
          cells: vec![[1, 0], [1, 1]],
        },
        SlotInput {
          len: 2,
          cells: vec![[0, 0], [1, 0]],
        },
        SlotInput {
          len: 2,
          cells: vec![[0, 1], [1, 1]],
        },
      ],
      dict: HashMap::from([(
        "2".to_string(),
        vec![
          "AB".to_string(),
          "CD".to_string(),
          "AC".to_string(),
          "BD".to_string(),
          "AD".to_string(),
          "CB".to_string(),
        ],
      )]),
      options: None,
    };

    let solved = solve_csp_internal(None, input, csp_options(), None, None);
    assert!(solved.is_some(), "expected SAT instance to be solved");
  }

  #[test]
  fn csp_unsat_returns_none() {
    let input = SolveInput {
      rows: vec!["..".to_string(), "..".to_string()],
      slots: vec![
        SlotInput {
          len: 2,
          cells: vec![[0, 0], [0, 1]],
        },
        SlotInput {
          len: 2,
          cells: vec![[0, 1], [1, 1]],
        },
      ],
      dict: HashMap::from([("2".to_string(), vec!["AA".to_string(), "CC".to_string()])]),
      options: None,
    };

    let solved = solve_csp_internal(None, input, csp_options(), None, None);
    assert!(solved.is_none(), "expected UNSAT instance to return None");
  }

  #[test]
  fn csp_unbounded_forces_single_restart() {
    let raw = resolve_options(SolveOptionsInput {
      restarts: Some(4),
      parallel_restarts: Some(4),
      ..Default::default()
    });
    let normalized = normalize_csp_options(raw);
    assert_eq!(normalized.restarts, 1);
    assert_eq!(normalized.parallel_restarts, 1);
  }
}
