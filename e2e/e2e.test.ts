const proc = Deno.run({
	cmd: ['deno', 'run', '-A', '--unstable', 'e2e/server.ts'],
	stdout: 'inherit',
	stderr: 'inherit',
});
await new Promise((resolve) => setTimeout(resolve, 500));
const uri = 'http://127.0.0.1:3000';

const req = (path: string, init?: RequestInit) =>
	fetch(uri + path, { ...init, headers: { connection: 'close', ...init?.headers } });

/**
 * Kill server process if error happens
 * @param test
 */
const withServer = (test: () => Promise<void> | void) => {
	return async () => {
		try {
			await test();
		} catch (e) {
			proc.close();
			throw e;
		}
	};
};

const methods = [
	'GET',
	'POST',
	'PATCH',
	'PUT',
	'DELETE',
	'OPTIONS',
	'HEAD' /* 'TRACE' is forbidden by fetch specification */,
];
Deno.test(
	'All Methods',
	withServer(async () => {
		for (const method of methods) {
			await (await req('/', { method })).text();
		}
	})
);
