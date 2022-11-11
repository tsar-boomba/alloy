#!/usr/bin/env bash
cargo release --allow-branch main -p alloy-core --all-features --tag-name 'v{{version}}' -v -x $1
