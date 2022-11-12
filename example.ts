import { Alloy } from './src/Alloy.ts';

const alloy = new Alloy({
	libraryUri: `target/${
		Deno.args[0] ? 'release' : 'debug'
	}/liballoy_runtime.dylib`,
});

alloy.get('/', (req) => {
	return {
		body: 'thuthy baka',
		headers: {
			sus: 'true',
		},
	};
});

alloy.get('/:id', (req) => {
	console.log(req);
	return {
		body: `impostor # ${req.params.id}`,
	};
});

alloy.post('/', { body: true }, (req) => {
	console.log(req.body?.json());
});

alloy.startServer();
