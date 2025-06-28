import chalk from 'chalk';

export class Cursor {
	constructor(
		public readonly text: string,
		public readonly columns: number,
		public readonly offset: number
	) {}

	static fromText(text: string, columns: number, offset = 0): Cursor {
		return new Cursor(text, columns, Math.max(0, Math.min(offset, text.length)));
	}

	equals(other: Cursor): boolean {
		return (
			this.text === other.text && this.columns === other.columns && this.offset === other.offset
		);
	}

	left(): Cursor {
		return new Cursor(this.text, this.columns, Math.max(0, this.offset - 1));
	}

	right(): Cursor {
		return new Cursor(this.text, this.columns, Math.min(this.text.length, this.offset + 1));
	}

	up(): Cursor {
		const lines = this.text.split('\n');
		const { lineIndex, columnIndex } = this.getLineColumn();

		if (lineIndex === 0) {
			return this;
		}

		const prevLine = lines[lineIndex - 1] ?? '';
		const newColumnIndex = Math.min(columnIndex, prevLine.length);
		const newOffset = this.getOffsetFromLineColumn(lineIndex - 1, newColumnIndex);

		return new Cursor(this.text, this.columns, newOffset);
	}

	down(): Cursor {
		const lines = this.text.split('\n');
		const { lineIndex, columnIndex } = this.getLineColumn();

		if (lineIndex >= lines.length - 1) {
			return this;
		}

		const nextLine = lines[lineIndex + 1] ?? '';
		const newColumnIndex = Math.min(columnIndex, nextLine.length);
		const newOffset = this.getOffsetFromLineColumn(lineIndex + 1, newColumnIndex);

		return new Cursor(this.text, this.columns, newOffset);
	}

	startOfLine(): Cursor {
		const { lineIndex } = this.getLineColumn();
		const newOffset = this.getOffsetFromLineColumn(lineIndex, 0);
		return new Cursor(this.text, this.columns, newOffset);
	}

	endOfLine(): Cursor {
		const lines = this.text.split('\n');
		const { lineIndex } = this.getLineColumn();
		const currentLine = lines[lineIndex] ?? '';
		const newOffset = this.getOffsetFromLineColumn(lineIndex, currentLine.length);
		return new Cursor(this.text, this.columns, newOffset);
	}

	prevWord(): Cursor {
		let newOffset = this.offset;

		while (newOffset > 0 && /\s/.test(this.text[newOffset - 1] ?? '')) {
			newOffset--;
		}

		while (newOffset > 0 && !/\s/.test(this.text[newOffset - 1] ?? '')) {
			newOffset--;
		}

		return new Cursor(this.text, this.columns, newOffset);
	}

	nextWord(): Cursor {
		let newOffset = this.offset;

		while (newOffset < this.text.length && !/\s/.test(this.text[newOffset] ?? '')) {
			newOffset++;
		}

		while (newOffset < this.text.length && /\s/.test(this.text[newOffset] ?? '')) {
			newOffset++;
		}

		return new Cursor(this.text, this.columns, newOffset);
	}

	insert(str: string): Cursor {
		const newText = this.text.slice(0, this.offset) + str + this.text.slice(this.offset);
		const newOffset = this.offset + str.length;
		return new Cursor(newText, this.columns, newOffset);
	}

	backspace(): Cursor {
		if (this.offset === 0) {
			return this;
		}
		const newText = this.text.slice(0, this.offset - 1) + this.text.slice(this.offset);
		const newOffset = this.offset - 1;
		return new Cursor(newText, this.columns, newOffset);
	}

	del(): Cursor {
		if (this.offset >= this.text.length) {
			return this;
		}
		const newText = this.text.slice(0, this.offset) + this.text.slice(this.offset + 1);
		return new Cursor(newText, this.columns, this.offset);
	}

	deleteToLineStart(): Cursor {
		const { lineIndex } = this.getLineColumn();
		const lineStartOffset = this.getOffsetFromLineColumn(lineIndex, 0);
		const newText = this.text.slice(0, lineStartOffset) + this.text.slice(this.offset);
		return new Cursor(newText, this.columns, lineStartOffset);
	}

	deleteToLineEnd(): Cursor {
		const lines = this.text.split('\n');
		const { lineIndex } = this.getLineColumn();
		const currentLine = lines[lineIndex] ?? '';
		const lineEndOffset = this.getOffsetFromLineColumn(lineIndex, currentLine.length);
		const newText = this.text.slice(0, this.offset) + this.text.slice(lineEndOffset);
		return new Cursor(newText, this.columns, this.offset);
	}

	deleteWordBefore(): Cursor {
		const prevWordCursor = this.prevWord();
		const newText = this.text.slice(0, prevWordCursor.offset) + this.text.slice(this.offset);
		return new Cursor(newText, this.columns, prevWordCursor.offset);
	}

	deleteWordAfter(): Cursor {
		const nextWordCursor = this.nextWord();
		const newText = this.text.slice(0, this.offset) + this.text.slice(nextWordCursor.offset);
		return new Cursor(newText, this.columns, this.offset);
	}

	render(cursorChar: string, mask?: string, invert?: (text: string) => string): string {
		let displayText = this.text;

		if (mask) {
			displayText = mask.repeat(this.text.length);
		}

		if (cursorChar && this.offset <= displayText.length) {
			const before = displayText.slice(0, this.offset);
			const after = displayText.slice(this.offset);

			// Use the custom cursor character instead of inverting current character
			const cursor = invert ? invert(cursorChar) : chalk.inverse(cursorChar);
			displayText = before + cursor + after;
		}

		return displayText;
	}

	private getLineColumn(): { lineIndex: number; columnIndex: number } {
		const lines = this.text.slice(0, this.offset).split('\n');
		const lineIndex = lines.length - 1;
		const lastLine = lines[lineIndex] ?? '';
		const columnIndex = lastLine.length;
		return { lineIndex, columnIndex };
	}

	private getOffsetFromLineColumn(lineIndex: number, columnIndex: number): number {
		const lines = this.text.split('\n');
		let offset = 0;

		for (let i = 0; i < lineIndex && i < lines.length; i++) {
			const line = lines[i] ?? '';
			offset += line.length + 1;
		}

		const targetLine = lines[lineIndex] ?? '';
		offset += Math.min(columnIndex, targetLine.length);
		return Math.min(offset, this.text.length);
	}
}
