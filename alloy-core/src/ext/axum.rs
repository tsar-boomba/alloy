#![cfg(feature = "axum")]

use std::{collections::HashMap, str::FromStr};

use axum::{
    body::StreamBody,
    extract::{OriginalUri, Path, Query, RawBody},
    http::HeaderValue,
    response::{IntoResponse, Response},
    routing::MethodRouter,
    Router,
};
use hyper::{header::HeaderName, HeaderMap};

use crate::{
    promise::{call_handler, PromiseResult},
    readable_stream::{ReadFn, ReadableStream},
    response::{HandlerRes, StreamOrBytes},
    Handler, HandlerFn, HandlerReq, Server,
};

#[inline(always)]
unsafe fn transmute_handler_ptr(ptr: usize) -> HandlerFn {
    let handler_ptr = ptr as *const u8;
    std::mem::transmute::<_, HandlerFn>(handler_ptr)
}

#[inline(always)]
async fn handle_body(req: &mut HandlerReq, raw_body: hyper::Body) {
    let full_body = hyper::body::to_bytes(raw_body).await.unwrap();
    req.body = Some(full_body.to_vec());
}

#[inline(always)]
fn handle_params(req: &mut HandlerReq, params: HashMap<String, String>) {
    req.params = params;
}

#[inline(always)]
fn handle_query(req: &mut HandlerReq, query: HashMap<String, String>) {
    req.query = query;
}

#[inline(always)]
fn handle_headers(req: &mut HandlerReq, headers: HeaderMap) {
    req.headers = headers
        .keys()
        .map(|k| {
            headers
                .get_all(k)
                .into_iter()
                .map(|v| (k.to_string(), v.to_str().unwrap().into()))
        })
        .flatten()
        .collect();
}

fn handle_req(
    handler: HandlerFn,
    handler_opts: Handler,
) -> impl axum::handler::Handler<
    (
        RawBody<hyper::Body>,
        Path<HashMap<String, String>>,
        Query<HashMap<String, String>>,
        HeaderMap,
        OriginalUri,
    ),
    hyper::Body,
> {
    move |RawBody(raw_body): RawBody,
          Path(params): Path<HashMap<String, String>>,
          Query(query): Query<HashMap<String, String>>,
          headers: HeaderMap,
          OriginalUri(pathname): OriginalUri| async move {
        let mut req = HandlerReq::default();

        if handler_opts.body {
            handle_body(&mut req, raw_body).await;
        };
        handle_params(&mut req, params);
        handle_query(&mut req, query);
        handle_headers(&mut req, headers);
        req.pathname = pathname.path().to_string();

        let result = call_handler::<HandlerRes>(handler, req).await;
        match result {
            PromiseResult::Fulfilled(res) => res.into_response(),
            PromiseResult::Rejected(err) => {
                println!("{}", err);
                (
                    axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                    "An internal server error ocurred.",
                )
                    .into_response()
            }
        }
    }
}

impl Into<Router> for Server {
    fn into(self) -> Router {
        let mut router = Router::new();

        for (path, mut handlers) in self.routes {
            let mut methods: MethodRouter = MethodRouter::new();

            if let Some(handler_opts) = handlers.get.take() {
                let handler = unsafe { transmute_handler_ptr(handler_opts.pointer) };
                methods = methods.get(
                    move |Path(params): Path<HashMap<String, String>>,
                          Query(query): Query<HashMap<String, String>>,
                          headers: HeaderMap,
                          OriginalUri(pathname): OriginalUri| async move {
                        let mut req = HandlerReq::default();

                        handle_params(&mut req, params);
                        handle_query(&mut req, query);
                        handle_headers(&mut req, headers);
                        req.pathname = pathname.path().to_string();

                        let result = call_handler::<HandlerRes>(handler, req).await;
                        match result {
                            PromiseResult::Fulfilled(res) => res.into_response(),
                            PromiseResult::Rejected(err) => {
                                println!("{}", err);
                                (
                                    axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                                    "An internal server error ocurred.",
                                )
                                    .into_response()
                            }
                        }
                    },
                );
            }

            if let Some(handler_opts) = handlers.post.take() {
                let handler = unsafe { transmute_handler_ptr(handler_opts.pointer) };
                methods = methods.post(handle_req(handler, handler_opts));
            }

            if let Some(handler_opts) = handlers.put.take() {
                let handler = unsafe { transmute_handler_ptr(handler_opts.pointer) };
                methods = methods.put(handle_req(handler, handler_opts));
            }

            if let Some(handler_opts) = handlers.delete.take() {
                let handler = unsafe { transmute_handler_ptr(handler_opts.pointer) };
                methods = methods.delete(handle_req(handler, handler_opts));
            }

            if let Some(handler_opts) = handlers.patch.take() {
                let handler = unsafe { transmute_handler_ptr(handler_opts.pointer) };
                methods = methods.patch(handle_req(handler, handler_opts));
            }

            if let Some(handler_opts) = handlers.options.take() {
                let handler = unsafe { transmute_handler_ptr(handler_opts.pointer) };
                methods = methods.options(handle_req(handler, handler_opts));
            }

            if let Some(handler_opts) = handlers.trace.take() {
                let handler = unsafe { transmute_handler_ptr(handler_opts.pointer) };
                methods = methods.trace(handle_req(handler, handler_opts));
            }

            if let Some(handler_opts) = handlers.head.take() {
                let handler = unsafe { transmute_handler_ptr(handler_opts.pointer) };
                methods = methods.head(handle_req(handler, handler_opts));
            }

            router = router.route(&path, methods);
        }

        router
    }
}

impl<'a> IntoResponse for HandlerRes<'a> {
    fn into_response(self) -> axum::response::Response {
        let headers = self.headers.unwrap_or_default();
        // validate headers and filter out invalid names / values
        let headers: HeaderMap = headers
            .into_iter()
            .map(|(k, v)| (HeaderName::from_str(k), HeaderValue::from_str(v)))
            .filter(|(k, v)| k.is_ok() && v.is_ok())
            .map(|(k, v)| (k.unwrap(), v.unwrap()))
            .collect();

        let mut res: Response = match self.body {
            Some(body) => match body {
                StreamOrBytes::Bytes(body) => (
                    axum::http::StatusCode::from_u16(self.status.unwrap_or(200)).unwrap(),
                    body,
                )
                    .into_response(),
                StreamOrBytes::Stream(read_fn_ptr) => {
                    let read_fn_ptr =
                        unsafe { core::mem::transmute::<_, ReadFn>(read_fn_ptr as *const u8) };
                    let stream = ReadableStream::new(read_fn_ptr);

                    (
                        axum::http::StatusCode::from_u16(self.status.unwrap_or(200)).unwrap(),
                        StreamBody::from(stream),
                    )
                        .into_response()
                }
            },
            None => (
                axum::http::StatusCode::from_u16(self.status.unwrap_or(200)).unwrap(),
                Vec::with_capacity(0),
            )
                .into_response(),
        };

        *res.headers_mut() = headers;
        res
    }
}
