use std::{
    sync::{Arc, Mutex},
    time::Duration,
};

use super::SharedState;

#[non_exhaustive]
pub struct PromiseExecutor {
    queue: Mutex<Vec<Arc<Mutex<SharedState>>>>,
}

impl PromiseExecutor {
    pub(crate) fn new() -> Self {
        Self {
            queue: Mutex::new(vec![]),
        }
    }

    pub(crate) fn add_promise(&self, promise: Arc<Mutex<SharedState>>) {
        self.queue.lock().unwrap().push(promise);
    }

    pub fn start(&'static self) {
        tokio::task::spawn((|| async {
            loop {
                {
                    let mut queue = self.queue.lock().unwrap();
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
                tokio::time::sleep(Duration::from_micros(500)).await;
            }
        })());
    }
}
