export const basePath = process.env.DOCUMENTS_PATH;

export const characters = 'abcdefghijklmnopqrstuvwxyz1234567890'.split('');

export async function makeId(
	length: number,
	charsArray = characters,
): Promise<string> {
	let result = randomChars(length);

	const fileExists = await Bun.file(basePath + result).exists();

	return fileExists ? makeId(length + 1, charsArray) : result;
}

export async function createKey(length = 0) {
	return await makeId(length <= 0 ? 4 : length);
}

export function createSecret(chunkLength = 5) {
	return (
		randomChars(chunkLength) +
		'-' +
		randomChars(chunkLength) +
		'-' +
		randomChars(chunkLength) +
		'-' +
		randomChars(chunkLength)
	);
}

function randomChars(length: number, chars = characters) {
	let result = '';
	while (length--) result += chars[Math.floor(Math.random() * chars.length)];
	return result;
}
