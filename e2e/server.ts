import { Alloy } from '../mod.ts';
import { preBuiltPlatforms } from '../src/bindings.ts';

const runnerTarget = Deno.build.target as keyof typeof preBuiltPlatforms;

const alloy = new Alloy({
	libraryUri: `target/debug/${preBuiltPlatforms[runnerTarget].prefix}alloy_runtime.${preBuiltPlatforms[runnerTarget].extension}`,
});

// test all methods basic functionality
alloy.get('/', () => {});
alloy.post('/', () => {});
alloy.delete('/', () => {});
alloy.patch('/', () => {});
alloy.put('/', () => {});
alloy.options('/', () => {});
alloy.trace('/', () => {});
alloy.head('/', () => {});


alloy.startServer();
