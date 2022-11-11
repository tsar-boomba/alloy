import { dlopen, FetchOptions } from 'https://deno.land/x/plug@1.0.0-rc.3/mod.ts';
import { Server } from './Alloy.ts';

const preBuiltPlatforms = {
	['aarch64-apple-darwin']: {
		extension: 'dylib',
		prefix: 'lib',
	},
	['x86_64-apple-darwin']: {
		extension: 'dylib',
		prefix: 'lib',
	},
	['aarch64-unknown-linux-gnu']: {
		extension: 'so',
		prefix: 'lib',
	},
	['x86_64-unknown-linux-gnu']: {
		extension: 'so',
		prefix: 'lib',
	},
	['x86_64-pc-windows-msvc']: {
		extension: 'dll',
		prefix: '',
	},
} as const;

const version = 'v0.0.15';
const preBuiltUrl = `https://github.com/tsar-boomba/alloy/releases/download/${version}/`;

const getUrl = (platform: keyof typeof preBuiltPlatforms) =>
	`${preBuiltUrl}${preBuiltPlatforms[platform].prefix}alloy_runtime-${platform}-${version}.${preBuiltPlatforms[platform].extension}`;

let uri = '/Users/isaiahgamble/Documents/GitHub/alloy/target/debug';
if (!uri.endsWith('/')) uri += '/';

const opts: FetchOptions = {
	name: 'alloy_runtime',
	cache: 'reloadAll',
	url: {
		darwin: {
			aarch64: getUrl('aarch64-apple-darwin'),
			x86_64: getUrl('x86_64-apple-darwin'),
		},
		windows: getUrl('x86_64-pc-windows-msvc'),
		linux: {
			aarch64: getUrl('aarch64-unknown-linux-gnu'),
			x86_64: getUrl('x86_64-unknown-linux-gnu'),
		},
	},
};

const libDef = {
	start: { parameters: ['buffer', 'usize'], result: 'void', nonblocking: true },
} as const;

export const loadLibrary = async (uri?: string) => {
	const lib = uri ? Deno.dlopen(uri, libDef) : await dlopen(opts, libDef);

	return (server: Server) => {
		const serializedServer = JSON.stringify(server);
		return lib.symbols.start(
			new TextEncoder().encode(serializedServer),
			serializedServer.length
		);
	};
};
