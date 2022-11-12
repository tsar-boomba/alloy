use std::sync::Arc;

use once_cell::sync::OnceCell;
use parking_lot::Mutex;

use super::{Promise, SharedState};

#[derive(Debug)]
#[non_exhaustive]
pub struct PromiseExecutor {
    queue: Mutex<Vec<Arc<Mutex<SharedState>>>>,
}

pub(crate) static EXECUTOR: OnceCell<PromiseExecutor> = OnceCell::new();

impl PromiseExecutor {
    pub(crate) fn new() -> Self {
        Self {
            queue: Mutex::new(vec![]),
        }
    }
}

/// Initialize global promise executor, only call once in your program
pub fn initialize() {
    EXECUTOR.set(PromiseExecutor::new()).unwrap();
}

pub(crate) fn add_from_shared_state(shared_state: Arc<Mutex<SharedState>>) {
    let executor: &'static PromiseExecutor = EXECUTOR.get().unwrap();
    executor.queue.lock().push(shared_state);
}

pub fn add_promise<T>(promise: &Promise<'_, T>) {
    let executor: &'static PromiseExecutor = EXECUTOR.get().unwrap();
    executor
        .queue
        .lock()
        .push(Arc::clone(&promise.shared_state));
}


pub async fn run() {
    let executor: &'static PromiseExecutor = EXECUTOR.get().unwrap();
    let mut queue = executor.queue.lock();

    // wake incomplete promises & filter out completed promises
    queue.iter_mut().for_each(|promise| {
        let mut promise = promise.lock();

        if !promise.completed {
            if let Some(waker) = promise.waker.take() {
                waker.wake();
            }
        };
    });
    queue.retain(|promise| !promise.lock().completed);
}
