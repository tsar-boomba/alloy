import { parse } from 'https://deno.land/std@0.155.0/flags/mod.ts';

const { ...rest } = parse(Deno.args, {
	'--': true,
});

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const listenProc = Deno.run({
	cmd: ['deno', 'run', '-A', '--unstable', Deno.args[0] ?? 'example.ts', 'release'],
	stdout: 'null',
});
await wait(5000);
const ohaListenProc = Deno.run({
	cmd: ['oha', '-z', '10s', '--no-tui', ...rest['--'], Deno.args[1] ?? 'http://127.0.0.1:3000/'],
	stdout: 'inherit',
});

ohaListenProc.status().then(() => {
	listenProc.kill('SIGTERM');
	listenProc.close();
});
