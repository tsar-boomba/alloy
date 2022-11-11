use std::task::Poll;

use axum::body::Bytes;
use futures_core::Stream;
use serde::Deserialize;

use crate::promise::{Promise, PromiseResult};

pub type ReadFn = extern "C" fn() -> extern "C" fn() -> *const u8;

#[derive(Debug, Deserialize)]
pub struct ReadResult {
    done: bool,
    #[serde(default)]
    value: Option<Vec<u8>>,
}

pub struct ReadableStream<'a> {
    /// analagous to `read` from stream reader
    ///
    /// Each time this is called it should return a new poll fn for a new promise
    read_fn: ReadFn,
    current_promise: Option<Promise<'a, ReadResult>>,
}

impl<'a> ReadableStream<'a> {
    pub fn new(read_fn: ReadFn) -> Self {
        Self {
            read_fn,
            current_promise: None,
        }
    }
}

impl<'a> Stream for ReadableStream<'a> {
    type Item = Result<Bytes, String>;
    fn poll_next(
        mut self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<Option<Self::Item>> {
        // get current promise or ask for new one
        let mut promise = match self.current_promise.take() {
            Some(current_promise) => current_promise,
            None => {
                let poll_fn = (self.read_fn)();
                Promise::no_execute(poll_fn)
            }
        };

        match promise.poll_data(cx) {
            Poll::Ready(result) => {
                // promise is either rejected or fulfilled at this point
                match result {
                    PromiseResult::Fulfilled(read_result) => {
                        if read_result.done {
                            Poll::Ready(None)
                        } else {
                            if let Some(value) = read_result.value {
                                Poll::Ready(Some(Ok(Bytes::from(value))))
                            } else {
                                // value may be null
                                Poll::Ready(Some(Err(
                                    "Read returned no chunk while not done.".into()
                                )))
                            }
                        }
                    }
                    PromiseResult::Rejected(err) => Poll::Ready(Some(Err(err))),
                }
            }
            Poll::Pending => {
                // save promise for next poll
                self.current_promise = Some(promise);
                Poll::Pending
            }
        }
    }
}
