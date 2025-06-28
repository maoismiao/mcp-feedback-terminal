import chalk from 'chalk';
import { Text, useInput } from 'ink';
import type { Key } from 'ink';
import React from 'react';
import { useTextInput } from '../hooks/useTextInput.js';
import { getTheme } from '../utils/theme.js';

export type Props = {
	/**
	 * Optional callback for handling history navigation on up arrow at start of input
	 */
	readonly onHistoryUp?: () => void;

	/**
	 * Optional callback for handling history navigation on down arrow at end of input
	 */
	readonly onHistoryDown?: () => void;

	/**
	 * Text to display when `value` is empty.
	 */
	readonly placeholder?: string;

	/**
	 * Allow multi-line input via line ending with backslash (default: `true`)
	 */
	readonly multiline?: boolean;

	/**
	 * Listen to user's input. Useful in case there are multiple input components
	 * at the same time and input must be "routed" to a specific component.
	 */
	readonly focus?: boolean;

	/**
	 * Replace all chars and mask the value. Useful for password inputs.
	 */
	readonly mask?: string;

	/**
	 * Whether to show cursor and allow navigation inside text input with arrow keys.
	 */
	readonly showCursor?: boolean;

	/**
	 * Highlight pasted text
	 */
	readonly highlightPastedText?: boolean;

	/**
	 * Value to display in a text input.
	 */
	readonly value: string;

	/**
	 * Function to call when value updates.
	 */
	readonly onChange: (value: string) => void;

	/**
	 * Function to call when `Enter` is pressed, where first argument is a value of the input.
	 */
	readonly onSubmit?: (value: string) => void;

	/**
	 * Function to call when Ctrl+C is pressed to exit.
	 */
	readonly onExit?: () => void;

	/**
	 * Optional callback to show exit message
	 */
	readonly onExitMessage?: (show: boolean, key?: string) => void;

	/**
	 * Optional callback to show custom message
	 */
	readonly onMessage?: (show: boolean, message?: string) => void;

	/**
	 * Optional callback to reset history position
	 */
	readonly onHistoryReset?: () => void;

	/**
	 * Number of columns to wrap text at
	 */
	readonly columns: number;

	/**
	 * Optional callback when an image is pasted
	 */
	readonly onImagePaste?: (base64Image: string) => void;

	/**
	 * Optional callback when a large text (over 800 chars) is pasted
	 */
	readonly onPaste?: (text: string) => void;

	/**
	 * Whether the input is dimmed and non-interactive
	 */
	readonly isDimmed?: boolean;

	/**
	 * Whether to disable cursor movement for up/down arrow keys
	 */
	readonly disableCursorMovementForUpDownKeys?: boolean;

	readonly cursorOffset: number;

	/**
	 * Callback to set the offset of the cursor
	 */
	onChangeCursorOffset: (offset: number) => void;
};

export default function TextInput({
	value: originalValue,
	placeholder = '',
	focus = true,
	mask,
	multiline = false,
	highlightPastedText = false,
	showCursor = true,
	onChange,
	onSubmit,
	onExit,
	onHistoryUp,
	onHistoryDown,
	onExitMessage,
	onMessage,
	onHistoryReset,
	columns,
	onImagePaste,
	onPaste,
	isDimmed = false,
	disableCursorMovementForUpDownKeys = false,
	cursorOffset,
	onChangeCursorOffset,
}: Props) {
	// Paste detection state
	const [pasteState, setPasteState] = React.useState<{
		chunks: string[];
		timeoutId: ReturnType<typeof setTimeout> | null;
		totalLength: number;
	}>({ chunks: [], timeoutId: null, totalLength: 0 });

	const resetPasteTimeout = (currentTimeoutId: ReturnType<typeof setTimeout> | null) => {
		if (currentTimeoutId) {
			clearTimeout(currentTimeoutId);
		}
		return setTimeout(() => {
			setPasteState(({ chunks }) => {
				const pastedText = chunks.join('');

				// Simply call the onPaste callback, don't modify input
				if (onPaste) {
					Promise.resolve().then(() => onPaste(pastedText));
				}

				return { chunks: [], timeoutId: null, totalLength: 0 };
			});
		}, 50); // Reduced timeout for better responsiveness
	};

	const wrappedOnSubmit = (value: string) => {
		// Simple direct submission
		onSubmit?.(value);
	};

	const wrappedOnChange = (value: string) => {
		// Simple direct change
		onChange(value);
	};

	const { onInput, renderedValue } = useTextInput({
		value: originalValue,
		onChange: wrappedOnChange,
		onSubmit: wrappedOnSubmit,
		onExit,
		onExitMessage,
		onMessage,
		onHistoryReset,
		onHistoryUp,
		onHistoryDown,
		focus,
		mask,
		multiline,
		cursorChar: showCursor ? ' ' : '',
		highlightPastedText,
		invert: showCursor && focus ? chalk.inverse : (text: string) => text,
		themeText: (text: string) => chalk.hex(getTheme().text)(text),
		columns,
		onImagePaste,
		disableCursorMovementForUpDownKeys,
		externalOffset: cursorOffset,
		onOffsetChange: onChangeCursorOffset,
	});

	const wrappedOnInput = (input: string, key: Key): void => {
		if (key.backspace || key.delete || input === '\b' || input === '\x7f' || input === '\x08') {
			onInput(input, {
				...key,
				backspace: true,
			});
			return;
		}

		if (input.length > 20 || pasteState.timeoutId || input.startsWith("'/")) {
			setPasteState(({ chunks, timeoutId }) => {
				return {
					chunks: [...chunks, input],
					timeoutId: resetPasteTimeout(timeoutId),
					totalLength: chunks.reduce((sum, chunk) => sum + chunk.length, 0) + input.length,
				};
			});
			return;
		}

		onInput(input, key);
	};

	useInput(wrappedOnInput, { isActive: focus });

	let renderedPlaceholder = placeholder
		? chalk.hex(getTheme().secondaryText)(placeholder)
		: undefined;

	// Static cursor display
	if (showCursor && focus) {
		renderedPlaceholder =
			placeholder.length > 0
				? chalk.inverse(placeholder[0] ?? '') +
					chalk.hex(getTheme().secondaryText)(placeholder.slice(1))
				: chalk.inverse(' ');
	}

	const showPlaceholder = originalValue.length === 0 && placeholder;

	// For multiline input, we should not truncate to allow full text editing
	const wrapMode = multiline || originalValue.includes('\n') ? undefined : 'truncate-end';

	// Simple display of rendered value
	const displayValue = renderedValue;

	return (
		<Text wrap={wrapMode} dimColor={isDimmed}>
			{showPlaceholder ? renderedPlaceholder : displayValue}
		</Text>
	);
}
