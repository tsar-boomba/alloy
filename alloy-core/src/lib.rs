//! Stores most of the rust code behind alloy
//!
//! Meant to be able to be brought into any bin so you can make your own custom runtime

use std::collections::HashMap;

use serde::{Deserialize, Serialize};

mod ext;
pub mod json;
pub mod promise;
pub mod readable_stream;
pub mod response;

type HandlerFn = Option<extern "C" fn(*const u8, usize) -> Option<extern "C" fn() -> *const u8>>;

#[derive(Debug, Serialize, Default)]
pub struct HandlerReq {
    query: HashMap<String, String>,
    headers: Vec<(String, String)>,
    body: Option<Vec<u8>>,
    params: HashMap<String, String>,
    pathname: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Handler {
    pointer: usize,
    #[serde(default)]
    body: bool,
}

/// each method holds a pointer its handler fn
#[derive(Debug, Deserialize)]
pub struct Handlers {
    get: Option<Handler>,
    post: Option<Handler>,
    delete: Option<Handler>,
    put: Option<Handler>,
    options: Option<Handler>,
    trace: Option<Handler>,
    patch: Option<Handler>,
    head: Option<Handler>,
}

#[derive(Debug, Deserialize)]
pub struct Server {
    routes: HashMap<String, Handlers>,
}
