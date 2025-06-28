import { useCallback, useRef } from 'react';

type DoublePressFn = () => void;
type ShowMessageFn = (show: boolean) => void;
type SinglePressFn = () => void;

export function useDoublePress(
	onShowMessage: ShowMessageFn,
	onDoublePress?: DoublePressFn,
	onSinglePress?: SinglePressFn,
	timeout = 800 // ms
) {
	const lastPressTime = useRef<number>(0);
	const timeoutRef = useRef<NodeJS.Timeout | null>(null);

	return useCallback(() => {
		const now = Date.now();
		const timeBetweenPresses = now - lastPressTime.current;

		// Clear any existing timeout
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
			timeoutRef.current = null;
		}

		if (timeBetweenPresses < timeout) {
			// Double press detected
			lastPressTime.current = 0; // Reset to prevent triple press
			onShowMessage(false); // Hide message
			onDoublePress?.();
		} else {
			// First press or too much time has passed
			lastPressTime.current = now;
			onShowMessage(true); // Show message

			// Set timeout for single press action
			timeoutRef.current = setTimeout(() => {
				onShowMessage(false); // Hide message after timeout
				onSinglePress?.();
				timeoutRef.current = null;
			}, timeout);
		}
	}, [onShowMessage, onDoublePress, onSinglePress, timeout]);
}
