#!/bin/sh
cargo release --allow-branch main -p alloy-core --all-features --tag-name 'v{{version}}' --no-publish -v -x $1
