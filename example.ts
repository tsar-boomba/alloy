import { Alloy } from './deno/src/Alloy.ts';

const alloy = new Alloy({ libraryUri: 'target/debug/liballoy_runtime.dylib' });

alloy.get('/', (req) => {
	console.log(req);
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
