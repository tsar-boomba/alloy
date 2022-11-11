use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(tag = "t", content = "c")]
pub enum StreamOrBytes {
    Bytes(Vec<u8>),
    // NOTE: Might need to receive ptr as string if bigint
    Stream(usize),
}

#[derive(Debug, Deserialize)]
#[serde(default)]
pub struct HandlerRes<'a> {
    pub status: Option<u16>,
    pub body: Option<StreamOrBytes>,
    #[serde(borrow = "'a")]
    pub headers: Option<Vec<(&'a str, &'a str)>>,
}

impl<'a> Default for HandlerRes<'a> {
    fn default() -> Self {
        Self {
            status: Some(200),
            body: None,
            headers: None,
        }
    }
}
