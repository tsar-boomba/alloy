use serde::Deserialize;

/// Takes pointer to a json buffer, returns length chars from buffer as usize and pointer to where value starts
pub unsafe fn read_json_buffer(ptr: *const u8) -> (usize, *const u8) {
    let mut incr_ptr = ptr.clone();
    // 20 cause thats the minimum size of the value string
    let mut length_chars: Vec<u8> = Vec::with_capacity(20);

    if *incr_ptr == 0 {
        // if starts with 0, its not ready
        return (0, incr_ptr);
    }

    while *incr_ptr != b'{' {
        length_chars.push(*incr_ptr);
        // move over by 1 until we find the start of value
        incr_ptr = incr_ptr.offset(1);
    }

    let length_str = String::from_utf8(length_chars).unwrap();
    let length: usize = length_str.parse().unwrap();

    (length, incr_ptr)
}

pub unsafe fn deserialize_json_buffer<'de, T: Deserialize<'de>>(
    ptr: *const u8,
) -> Result<Option<T>, serde_json::Error> {
    let (length, value_ptr) = unsafe { crate::json::read_json_buffer(ptr) };
    if length <= 0 {
        Ok(None)
    } else {
        let value_slice = unsafe { std::slice::from_raw_parts(value_ptr, length) };
        let value: T = serde_json::from_slice(value_slice)?;
        Ok(Some(value))
    }
}

pub unsafe fn deserialize_buffer<'de, T: Deserialize<'de>>(
    ptr: *const u8,
    len: usize,
) -> Result<T, serde_json::Error> {
    let slice = std::slice::from_raw_parts(ptr, len);
    serde_json::from_slice(slice)
}
