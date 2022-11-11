use alloy_core::Server;
use axum::Router;

async fn server(server_config: Server) {
    alloy_core::promise::PROMISE_EXECUTOR.start();
    println!("Executor started");

    let app: Router = server_config.into();
    axum::Server::bind(&"127.0.0.1:3000".parse().unwrap())
        .serve(app.into_make_service())
        .await
        .unwrap()
}

#[no_mangle]
pub extern "C" fn start(server_ptr: *const u8, server_len: usize) {
    let server_config =
        unsafe { alloy_core::json::deserialize_buffer::<Server>(server_ptr, server_len).unwrap() };
    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .unwrap();
    let _guard = rt.enter();
    rt.block_on(server(server_config));
}
