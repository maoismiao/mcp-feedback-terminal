import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const SCREENSHOT_PATH = '/tmp/mcp_feedback_enhanced_latest_screenshot.png';

export const CLIPBOARD_ERROR_MESSAGE =
	'No image data in clipboard. Please copy an image first (e.g., use Cmd+Shift+4 to screenshot to clipboard)';

export function getImageFromClipboard(): string | null {
	if (process.platform !== 'darwin') {
		console.log('Image paste feature currently only supports macOS');
		return null;
	}

	try {
		execSync(`osascript -e 'the clipboard as «class PNGf»'`, {
			stdio: 'ignore',
		});

		execSync(
			`osascript -e 'set png_data to (the clipboard as «class PNGf»)' -e 'set fp to open for access POSIX file "${SCREENSHOT_PATH}" with write permission' -e 'write png_data to fp' -e 'close access fp'`,
			{ stdio: 'ignore' }
		);

		const imageBuffer = readFileSync(SCREENSHOT_PATH);
		const base64Image = imageBuffer.toString('base64');

		execSync(`rm -f "${SCREENSHOT_PATH}"`, { stdio: 'ignore' });

		return base64Image;
	} catch {
		console.log('No image data in clipboard or read failed');
		return null;
	}
}

export function isImagePasteSupported(): boolean {
	return process.platform === 'darwin';
}
