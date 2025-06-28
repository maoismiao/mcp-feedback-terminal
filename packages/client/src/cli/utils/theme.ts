// One Dark Pro theme colors for terminal UI
export const oneDarkProTheme = {
	text: '#abb2bf',
	secondaryText: '#5c6370',
	heading: '#61afef',
	link: '#61afef',
	strong: '#e5c07b',
	em: '#c678dd',
	codespan: '#98c379',
	listBullet: '#61afef',
	hr: '#5c6370',
	blockquote: '#5c6370',
	image: '#c678dd',
	table: '#abb2bf',
	codeFallback: '#abb2bf',
	success: '#98c379',
	warning: '#d19a66',
	error: '#e06c75',
	info: '#61afef',
};

export type Theme = typeof oneDarkProTheme;

let currentTheme: Theme = oneDarkProTheme;

export function getTheme(): Theme {
	return currentTheme;
}

export function setTheme(theme: Partial<Theme>): void {
	currentTheme = { ...currentTheme, ...theme };
}

export function resetTheme(): void {
	currentTheme = oneDarkProTheme;
}
