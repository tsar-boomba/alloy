use std::sync::{Arc, Mutex};

use once_cell::sync::OnceCell;

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

    pub(crate) fn add_from_shared_state(shared_state: Arc<Mutex<SharedState>>) {
        let executor: &'static PromiseExecutor = EXECUTOR.get().unwrap();
        executor.queue.lock().unwrap().push(shared_state);
    }

    pub fn add_promise<T>(promise: &Promise<'_, T>) {
        let executor: &'static PromiseExecutor = EXECUTOR.get().unwrap();
        executor
            .queue
            .lock()
            .unwrap()
            .push(Arc::clone(&promise.shared_state));
    }
}

/// Initialize global promise executor, do not use if using provided `run` function
pub fn initialize() {
    EXECUTOR.set(PromiseExecutor::new()).unwrap();
}

pub async fn run() {
    let executor: &'static PromiseExecutor = EXECUTOR.get().unwrap();
    let mut queue = executor.queue.lock().unwrap();
    let mut completed = Vec::<usize>::with_capacity(queue.len());
    for (i, promise) in queue.iter_mut().enumerate() {
        let mut promise = promise.lock().unwrap();

        if !promise.completed {
            if let Some(waker) = promise.waker.take() {
                waker.wake();
            }
        } else {
            // track completed promises
            completed.push(i);
        }
    }

    // remove completed promises
    for completed_index in completed {
        queue.swap_remove(completed_index);
    }
}
