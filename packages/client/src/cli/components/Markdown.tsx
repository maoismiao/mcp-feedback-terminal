import { Text } from 'ink';
import { marked } from 'marked';
import chalk from 'chalk';
import { highlight, supportsLanguage } from 'cli-highlight';
import { oneDarkProTheme } from '../utils/theme.js';

export type Props = {
	children: string;
	width?: number;
};

const oneDarkHighlightTheme = {
	keyword: chalk.hex('#c678dd'),
	built_in: chalk.hex('#e5c07b'),
	string: chalk.hex('#98c379'),
	comment: chalk.hex('#5c6370'),
	number: chalk.hex('#d19a66'),
	class: chalk.hex('#e5c07b'),
	function: chalk.hex('#61afef'),
	title: chalk.hex('#61afef'),
	params: chalk.hex('#abb2bf'),
	variable: chalk.hex('#e06c75'),
	literal: chalk.hex('#56b6c2'),
	doctag: chalk.hex('#c678dd'),
	default: chalk.hex(oneDarkProTheme.text),
};

const EOL = '\n';

function format(
	token: any,
	currentTheme: typeof oneDarkProTheme,
	listDepth = 0,
	orderedListNumber: number | null = null
): string {
	const recurse = (tokens: any[]) =>
		(tokens ?? []).map((t: any) => format(t, currentTheme)).join('');

	switch (token.type) {
		case 'code':
			if (token.lang && supportsLanguage(token.lang)) {
				try {
					return (
						highlight(token.text, {
							language: token.lang,
							theme: oneDarkHighlightTheme,
						}) + EOL
					);
				} catch (e) {
					return chalk.hex(currentTheme.codeFallback)(token.text) + EOL;
				}
			}
			return chalk.hex(currentTheme.codeFallback)(token.text) + EOL;

		case 'codespan':
			return chalk.hex(currentTheme.codespan)(` ${token.text} `);

		case 'em':
			return chalk.hex(currentTheme.em).italic(recurse(token.tokens));

		case 'strong':
			return chalk.hex(currentTheme.strong).bold(recurse(token.tokens));

		case 'heading':
			const text = recurse(token.tokens);
			const headingColor = chalk.hex(currentTheme.heading);
			switch (token.depth) {
				case 1:
					return headingColor.bold.underline(`${text}`) + EOL + EOL;
				case 2:
					return headingColor.bold(` ${text}`) + EOL + EOL;
				default:
					return headingColor(` ${text}`) + EOL;
			}

		case 'blockquote':
			const quoteText = recurse(token.tokens);
			return (
				quoteText
					.split(EOL)
					.map((line: string) => chalk.hex(currentTheme.blockquote)('  ┃ ') + chalk.italic(line))
					.join(EOL) + EOL
			);

		case 'list':
			return (
				token.items
					.map((item: any, index: number) =>
						format(item, currentTheme, listDepth, token.ordered ? (token.start || 1) + index : null)
					)
					.join('') + (listDepth === 0 ? EOL : '')
			);

		case 'list_item':
			const indent = '  '.repeat(listDepth);
			const bullet = orderedListNumber
				? chalk.hex(currentTheme.listBullet)(`${orderedListNumber}. `)
				: chalk.hex(currentTheme.listBullet)('• ');

			const content = token.tokens
				.map((t: any) => {
					if (t.type === 'text') {
						return t.tokens ? recurse(t.tokens) : t.text;
					}
					return format(t, currentTheme, listDepth + 1, null);
				})
				.join('');

			return `${indent}${bullet}${content}${EOL}`;

		case 'paragraph':
			return recurse(token.tokens) + EOL;

		case 'space':
			return '';

		case 'text':
			return recurse(token.tokens) || chalk.hex(currentTheme.text)(token.text);

		case 'link':
			const linkText = recurse(token.tokens);
			return chalk.hex(currentTheme.link).underline(linkText);

		case 'image':
			return chalk.hex(currentTheme.image)(`[Image: ${token.title || token.text}]`);

		case 'hr':
			return chalk.hex(currentTheme.hr)('─'.repeat(50)) + EOL;

		case 'table':
			const tableColor = chalk.hex(currentTheme.table);
			const header =
				tableColor('| ' + token.header.map((cell: any) => cell.text).join(' | ') + ' |') + EOL;
			const aligner =
				tableColor(
					'|' +
						token.align
							.map((align: string) => {
								switch (align) {
									case 'center':
										return ':---:';
									case 'right':
										return '---:';
									default:
										return '---';
								}
							})
							.join('|') +
						'|'
				) + EOL;
			const body =
				token.rows
					.map((row: any) =>
						tableColor('| ' + row.map((cell: any) => cell.text).join(' | ') + ' |')
					)
					.join(EOL) + EOL;

			return header + aligner + body;

		case 'br':
			return EOL;

		default:
			return '';
	}
}

function applyMarkdown(content: string, customTheme: Partial<typeof oneDarkProTheme> = {}): string {
	try {
		const finalTheme = { ...oneDarkProTheme, ...customTheme };
		const tokens = marked.lexer(content);

		return tokens
			.map(token => format(token, finalTheme))
			.join('')
			.trim();
	} catch (error) {
		return chalk.red(`Error parsing Markdown: ${(error as Error).message}`);
	}
}

export default function Markdown({ children }: Props) {
	try {
		const rendered = applyMarkdown(children);
		return <Text>{rendered}</Text>;
	} catch (error) {
		return <Text color="red">Error rendering Markdown: {(error as Error).message}</Text>;
	}
}

export const MarkdownVariants = {
	success: {
		heading: '#98c379',
		link: '#98c379',
		strong: '#98c379',
	},
	warning: {
		heading: '#d19a66',
		link: '#d19a66',
		strong: '#d19a66',
	},
	error: {
		heading: '#e06c75',
		link: '#e06c75',
		strong: '#e06c75',
	},
	info: {},
};

export function StyledMarkdown({
	variant = 'info',
	children,
}: Props & { variant?: keyof typeof MarkdownVariants }) {
	try {
		const rendered = applyMarkdown(children, MarkdownVariants[variant]);
		return <Text>{rendered}</Text>;
	} catch (error) {
		return <Text color="red">Error rendering Markdown: {(error as Error).message}</Text>;
	}
}
