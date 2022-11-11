import { Server } from './src/Alloy.ts';

const libName = 'alloy_runtime';

let uri = '/Users/isaiahgamble/Documents/GitHub/alloy/target/debug';
if (!uri.endsWith('/')) uri += '/';

let darwin: string | { aarch64: string; x86_64: string } =
	`lib${libName}.dylib`;

// if (url.protocol !== 'file:') {
// 	// Assume that remote assets follow naming scheme
// 	// for each macOS artifact.
// 	darwin = {
// 		aarch64: uri + `lib${libName}_arm64.dylib`,
// 		x86_64: uri + `lib${libName}.dylib`,
// 	};
// }
const opts = {
	name: 'alloy_runtime',
	urls: {
		darwin,
		windows: uri + `${libName}.dll`,
		linux: uri + `lib${libName}.so`,
	},
};
const lib = Deno.dlopen(uri + darwin, {
	start: { parameters: ['buffer', 'usize'], result: 'void', nonblocking: true },
});

export function start(server: Server) {
	const serializedServer = JSON.stringify(server);
	return lib.symbols.start(
		new TextEncoder().encode(serializedServer),
		serializedServer.length,
	);
}
