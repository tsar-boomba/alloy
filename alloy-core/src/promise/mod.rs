pub mod executor;

use std::{
    future::Future,
    marker::PhantomData,
    sync::Arc,
    task::{Context, Poll, Waker},
};

use parking_lot::Mutex;
use serde::Deserialize;

use crate::{HandlerFn, HandlerReq};

#[derive(Debug, Deserialize)]
#[serde(tag = "t", content = "c")]
pub enum PromiseResult<T> {
    Fulfilled(T),
    Rejected(String),
}

pub struct Promise<'a, T> {
    poll_promise: extern "C" fn() -> *const u8,
    result: PhantomData<&'a T>,
    shared_state: Arc<Mutex<SharedState>>,
}

impl<'a, T: Deserialize<'a>> Promise<'a, T> {
    pub fn new(poll_promise: extern "C" fn() -> *const u8) -> Self {
        let shared_state = Arc::new(Mutex::new(SharedState {
            completed: false,
            waker: None,
        }));

        executor::add_from_shared_state(Arc::clone(&shared_state));

        Self {
            poll_promise,
            result: PhantomData,
            shared_state,
        }
    }

    /// Create a new promise, but don't add it to the executor, meaning you'll manually poll it
    pub fn no_execute(poll_promise: extern "C" fn() -> *const u8) -> Self {
        let shared_state = Arc::new(Mutex::new(SharedState {
            completed: false,
            waker: None,
        }));

        Self {
            poll_promise,
            result: PhantomData,
            shared_state,
        }
    }
}

#[derive(Debug)]
/// Shared state between the future and the promise queue
pub(crate) struct SharedState {
    completed: bool,
    waker: Option<Waker>,
}

impl<'de, T: Deserialize<'de>> Promise<'de, T> {
    pub fn poll_data(&mut self, cx: &mut Context) -> Poll<PromiseResult<T>> {
        // poll_result: pointer to Unit8Array where everything up to '{' char is the length of payload
        let poll_result = (self.poll_promise)();

        if poll_result.is_null() {
            println!("Poll returned Null Pointer");
            return Poll::Ready(PromiseResult::Rejected("Internal server error.".into()));
        }

        let (length, value_ptr) = unsafe { crate::json::read_json_buffer(poll_result) };
        if length <= 0 {
            let shared_state = self.shared_state.as_ref();
            let mut shared_state = shared_state.lock();
            shared_state.waker = Some(cx.waker().clone());
            Poll::Pending
        } else {
            let shared_state = self.shared_state.as_ref();
            let mut shared_state = shared_state.lock();
            shared_state.completed = true;
            let value_slice = unsafe { std::slice::from_raw_parts(value_ptr, length) };
            let value: PromiseResult<T> = serde_json::from_slice(value_slice).unwrap();
            Poll::Ready(value)
        }
    }
}

impl<'de, T: Deserialize<'de>> Future for Promise<'de, T> {
    type Output = PromiseResult<T>;
    fn poll(
        mut self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<Self::Output> {
        self.poll_data(cx)
    }
}

pub fn call_handler<'de, T: Deserialize<'de>>(
    handler: HandlerFn,
    req: HandlerReq,
) -> Promise<'de, T> {
    let mut bytes = serde_json::to_vec(&req).unwrap();
    bytes.shrink_to_fit();
    let ptr = bytes.as_ptr();
    let len = bytes.len();

    let handler = handler.unwrap();
    let poll_fn = handler(ptr, len).unwrap();
    Promise::<T>::new(poll_fn)
}
