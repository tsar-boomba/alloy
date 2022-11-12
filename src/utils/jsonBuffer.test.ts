import { assertEquals } from 'https://deno.land/std@0.163.0/testing/asserts.ts';
import { jsonBuffer } from './jsonBuffer.ts';

Deno.test('Correctly Encodes JSON', () => {
	const test = {
		sus: true,
		impostor: true,
		// make sure looooong json works
		arr: Array(1000000).fill(100000000),
	};

	const result = jsonBuffer(JSON.stringify(test));
	const resultString = new TextDecoder().decode(result);
	let length = '';
	let json = '';

	for (const char of resultString) {
		if (json.length <= 0) {
			if (char !== '{') length = length.concat(char);
			else json = json.concat(char);
		} else {
			json = json.concat(char);
		}
	}

	assertEquals(json, JSON.stringify(test));
	assertEquals(parseInt(length), JSON.stringify(test).length);
	assertEquals(JSON.parse(json), test);
});

Deno.test('Empty String -> One Byte -> Is 0', () => {
	const result = jsonBuffer('');

	assertEquals(result[0], 0);
});
