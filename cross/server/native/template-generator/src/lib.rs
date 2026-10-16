mod geometry;
mod matching;
mod model;
mod quality;
mod repair;
mod search;
mod topology;

#[cfg(not(test))]
mod bindings {
    use super::*;
    use napi_derive::napi;
    use std::collections::HashMap;
    use std::sync::{
        atomic::{AtomicBool, AtomicU32, Ordering},
        Arc, Mutex, OnceLock,
    };
    static CONTROLS: OnceLock<Mutex<HashMap<u32, Arc<AtomicBool>>>> = OnceLock::new();
    static NEXT: AtomicU32 = AtomicU32::new(1);
    fn controls() -> &'static Mutex<HashMap<u32, Arc<AtomicBool>>> {
        CONTROLS.get_or_init(|| Mutex::new(HashMap::new()))
    }
    #[napi]
    pub fn create_generation_control() -> napi::Result<u32> {
        let mut map = controls()
            .lock()
            .map_err(|_| napi::Error::from_reason("generation control lock poisoned"))?;
        loop {
            let id = NEXT.fetch_add(1, Ordering::Relaxed);
            if id != 0 && !map.contains_key(&id) {
                map.insert(id, Arc::new(AtomicBool::new(false)));
                return Ok(id);
            }
        }
    }
    #[napi]
    pub fn cancel_generation(id: u32) {
        if let Ok(map) = controls().lock() {
            if let Some(flag) = map.get(&id) {
                flag.store(true, Ordering::Relaxed);
            }
        }
    }
    #[napi]
    pub fn release_generation_control(id: u32) {
        if let Ok(mut map) = controls().lock() {
            if let Some(flag) = map.remove(&id) {
                flag.store(true, Ordering::Relaxed);
            }
        }
    }
    #[napi]
    pub fn generate_template(input_json: String, control_id: u32) -> napi::Result<String> {
        let input: model::Input = serde_json::from_str(&input_json)
            .map_err(|e| napi::Error::from_reason(format!("invalid template input: {e}")))?;
        input.validate().map_err(napi::Error::from_reason)?;
        let flag = controls()
            .lock()
            .map_err(|_| napi::Error::from_reason("generation control lock poisoned"))?
            .get(&control_id)
            .cloned()
            .ok_or_else(|| napi::Error::from_reason("generation cancelled"))?;
        let control = model::Control::new(flag, input.max_ms);
        let output = search::generate(&input, &control);
        serde_json::to_string(&output).map_err(|e| napi::Error::from_reason(e.to_string()))
    }
}

#[cfg(test)]
mod tests;
