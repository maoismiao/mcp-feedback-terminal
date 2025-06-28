import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Box, Text, useInput } from 'ink';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import WebSocket from 'ws';

import Markdown from './components/Markdown.js';
import TextInput from './components/TextInput.js';
import { getImageFromClipboard, isImagePasteSupported } from './utils/imagePaste.js';

const summary = 'No summary available';

// 获取端口文件路径
function getPortFilePath(): string {
	return join(process.cwd(), '.mcp-feedback-port');
}

function discoverPort(): number {
	// 1. 优先检查环境变量中的 WebSocket URL
	if (process.env.MCP_WS_URL) {
		const match = process.env.MCP_WS_URL.match(/:(\d+)$/);
		if (match) {
			return Number.parseInt(match[1], 10);
		}
	}

	// 2. 检查项目目录下的端口文件
	const portFile = getPortFilePath();
	try {
		if (existsSync(portFile)) {
			const portStr = readFileSync(portFile, 'utf8').trim();
			const port = Number.parseInt(portStr, 10);
			if (!Number.isNaN(port)) {
				console.error(`[Client] Found port ${port} from ${portFile}`);
				return port;
			}
		}
	} catch (error) {
		console.error('[Client] Failed to read port file:', error);
	}

	// 3. 检查环境变量作为备选
	if (process.env.MCP_FEEDBACK_PORT) {
		const port = Number.parseInt(process.env.MCP_FEEDBACK_PORT, 10);
		if (!Number.isNaN(port)) {
			console.error(`[Client] Found port ${port} from environment variable`);
			return port;
		}
	}

	// 4. 默认端口
	return 9543;
}

function getPort(providedPort?: number): number {
	if (providedPort) {
		return providedPort;
	}
	return discoverPort();
}

interface PastedContent {
	id: string;
	content: string;
	timestamp: number;
	type: 'text';
}

interface PastedImage {
	id: string;
	data: string;
	timestamp: number;
	name: string;
}

interface AppState {
	feedback: string;
	status: string;
	isSubmitted: boolean;
	connectionError: boolean;
	currentSummary: string;
	renderedSummary: string;
	pastedImages: PastedImage[];
	hasImagePasted: boolean;
	justPastedImage: boolean;
	helpContent: string | null;
	cursorOffset: number;
	showExitMessage: boolean;
	exitKey: string;
	showMessage: boolean;
	message: string;
	pastedContents: PastedContent[];
	isWaitingForNewPrompt: boolean;
	isReconnecting: boolean;
	reconnectAttempts: number;
}

interface AppProps {
	port?: number;
}

export default function App({ port }: AppProps = {}): React.JSX.Element {
	const actualPort = getPort(port);
	const wsUrl = `ws://localhost:${actualPort}`;

	const [state, setState] = useState<AppState>({
		feedback: '',
		status: `Connecting to ${wsUrl}...`,
		isSubmitted: false,
		connectionError: false,
		currentSummary: summary,
		renderedSummary: summary,
		pastedImages: [],
		hasImagePasted: false,
		justPastedImage: false,
		helpContent: null,
		cursorOffset: 0,
		showExitMessage: false,
		exitKey: '',
		showMessage: false,
		message: '',
		pastedContents: [],
		isWaitingForNewPrompt: false,
		isReconnecting: false,
		reconnectAttempts: 0,
	});

	const [ws, setWs] = useState<WebSocket | null>(null);
	const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const isConnectingRef = useRef<boolean>(false);

	useInput((input: string, key: any) => {
		if (key.ctrl && input.toLowerCase() === 'v') {
			if (!state.isSubmitted) {
				handleImagePaste();
				return;
			}
		}

		if (key.ctrl && input === 'c') {
			process.exit(0);
		}
	});

	const handleImagePaste = () => {
		if (!isImagePasteSupported()) {
			setState(prev => ({
				...prev,
				status: 'Image paste feature currently only supports macOS',
			}));
			return;
		}

		const base64Image = getImageFromClipboard();

		if (base64Image) {
			setState(prev => {
				const cleanedFeedback = prev.feedback.replace(/v$/, '');
				const newImage: PastedImage = {
					id: Date.now().toString(),
					data: base64Image,
					timestamp: Date.now(),
					name: `image_${prev.pastedImages.length + 1}.png`,
				};

				return {
					...prev,
					pastedImages: [...prev.pastedImages, newImage],
					hasImagePasted: true,
					justPastedImage: true,
					feedback: cleanedFeedback + (cleanedFeedback ? ' ' : ''),
					status: `Image pasted successfully! (${prev.pastedImages.length + 1} images total)`,
				};
			});

			setTimeout(() => {
				setState(prev => ({ ...prev, justPastedImage: false }));
			}, 100);
		} else {
			setState(prev => ({
				...prev,
				status:
					'No image data in clipboard. Please copy an image first (e.g., use Cmd+Shift+4 to screenshot to clipboard)',
			}));
		}
	};

	const handleSubmit = (value: string) => {
		if (state.isSubmitted || !ws || ws.readyState !== WebSocket.OPEN) return;

		if (value === '/help') {
			const helpText = `=== 🤖 MCP Feedback Enhanced - Terminal UI Help ===

📋 BASIC USAGE:
  • Type your feedback message (supports multiple lines)
  • Press Opt+Enter (⌥+Enter) for new line
  • Press Enter to submit feedback
  • Submission includes timestamp for tracking

⌨️  KEYBOARD SHORTCUTS:
  Ctrl+C     Exit application
  Opt+Enter  Insert new line (multiline input)
  Enter      Submit feedback
${
	isImagePasteSupported()
		? '  Ctrl+V     Paste from clipboard (text or images)'
		: '  Ctrl+V     Paste text (image paste only on macOS)'
}

🗂️  COMMANDS:
  /help      Show this help message
  /paste     Paste image from clipboard
  /img       Alias for /paste command
  /d1, /d2   Delete text content #1, #2, etc.
  /i1, /i2   Delete image #1, #2, etc.

📷 IMAGE FEATURES:
${
	isImagePasteSupported()
		? `  • Multiple image upload supported
  • Paste images with Ctrl+V repeatedly
  • View image list with deletion commands
  • All images submitted together with feedback`
		: `  • Image paste currently only supports macOS
  • Use Cmd+Shift+4 to screenshot to clipboard`
}

📝 TEXT FEATURES:
  • Paste text with Ctrl+V (appears in separate box)
  • Multiple text pastes supported
  • Auto-cleanup of file paths and formatting
  • All pasted content included in submission

🎯 TIPS:
  • All pasted content (text + images) is included when submitting
  • Use numbered commands (/d1, /i1) to remove specific items
  • Recent submission time is shown for tracking
  • Type feedback naturally - multiline is fully supported

📁 Working Directory: ${process.cwd()}`;
			setState(prev => ({
				...prev,
				helpContent: helpText,
				feedback: '',
			}));
			return;
		}

		if (value === '/paste' || value === '/img' || value === '/image') {
			handleImagePaste();
			setState(prev => ({ ...prev, feedback: '', helpContent: null }));
			return;
		}

		// Handle delete pasted content commands like /d1, /d2, etc.
		const deleteMatch = value.match(/^\/d(\d+)$/);
		if (deleteMatch?.[1]) {
			const index = Number.parseInt(deleteMatch[1]) - 1; // Convert to 0-based index
			if (index >= 0 && index < state.pastedContents.length) {
				const pasteToDelete = state.pastedContents[index];
				if (pasteToDelete) {
					removePastedContent(pasteToDelete.id);
					setState(prev => ({
						...prev,
						feedback: '',
						status: `Deleted pasted content #${index + 1}`,
					}));
				}
			} else {
				setState(prev => ({
					...prev,
					feedback: '',
					status: `Invalid paste number. Available: 1-${state.pastedContents.length}`,
				}));
			}
			return;
		}

		// Handle delete image commands like /i1, /i2, etc.
		const deleteImageMatch = value.match(/^\/i(\d+)$/);
		if (deleteImageMatch?.[1]) {
			const index = Number.parseInt(deleteImageMatch[1]) - 1; // Convert to 0-based index
			if (index >= 0 && index < state.pastedImages.length) {
				const imageToDelete = state.pastedImages[index];
				if (imageToDelete) {
					removeImage(imageToDelete.id);
					setState(prev => ({
						...prev,
						feedback: '',
						status: `Deleted image #${index + 1}`,
						hasImagePasted: prev.pastedImages.length > 1,
					}));
				}
			} else {
				setState(prev => ({
					...prev,
					feedback: '',
					status: `Invalid image number. Available: 1-${state.pastedImages.length}`,
				}));
			}
			return;
		}

		setState(prev => ({
			...prev,
			isSubmitted: true,
			status: 'Submitting your feedback...',
			helpContent: null,
		}));

		// Combine input feedback with pasted contents
		let combinedFeedback = value;
		if (state.pastedContents.length > 0) {
			const pastedTexts = state.pastedContents.map(p => p.content);
			combinedFeedback = `${value}\n\n${pastedTexts.join('\n\n')}`;
		}

		const submission = {
			interactive_feedback: combinedFeedback || '用户提交了反馈',
			images: state.pastedImages.map(img => ({
				name: img.name || `image_${Date.now()}.png`,
				data: img.data,
			})),
		};

		ws.send(JSON.stringify(submission));

		// 立即显示提交成功状态
		const now = new Date();
		const timeStr = now.toLocaleTimeString('zh-CN', {
			hour12: false,
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
		});

		setState(prev => ({
			...prev,
			status: `✅ Feedback submitted successfully at ${timeStr}! Waiting for next call...`,
			isSubmitted: false,
			isWaitingForNewPrompt: true,
			feedback: '',
			pastedImages: [],
			hasImagePasted: false,
			justPastedImage: false,
			helpContent: null,
			cursorOffset: 0,
			pastedContents: [],
		}));
	};

	const handleInputChange = (value: string) => {
		setState(prev => ({ ...prev, feedback: value }));
	};

	const handleExit = () => {
		process.exit(0);
	};

	const handleExitMessage = (show: boolean, key?: string) => {
		setState(prev => ({
			...prev,
			showExitMessage: show,
			exitKey: key || '',
		}));
	};

	const handleMessage = (show: boolean, message?: string) => {
		setState(prev => ({
			...prev,
			showMessage: show,
			message: message || '',
		}));
	};

	const handlePaste = (text: string) => {
		// Process pasted text: trim whitespace, normalize spaces
		const processedText = text
			.trim() // Remove leading/trailing whitespace
			.split(/\r?\n/) // Split into lines
			.map(line => line.trim()) // Trim each line
			.filter(line => line.length > 0) // Remove empty lines
			.map(line => line.replace(/\s+/g, ' ')) // Replace multiple spaces with single space
			.join('\\n'); // Join with literal \n

		// Add pasted content to the array
		const newPastedContent: PastedContent = {
			id: Date.now().toString(),
			content: processedText,
			timestamp: Date.now(),
			type: 'text',
		};

		setState(prev => ({
			...prev,
			pastedContents: [...prev.pastedContents, newPastedContent],
			status: `Text pasted (${processedText.length} characters). Content will be included when you submit.`,
		}));

		// Clear status after a short delay
		setTimeout(() => {
			setState(prev => ({
				...prev,
				status: 'Connected! Please input your feedback...',
			}));
		}, 3000);
	};

	const handleImagePasteFromTextInput = (base64Image: string) => {
		setState(prev => ({
			...prev,
			pastedImage: base64Image,
			hasImagePasted: true,
			status: 'Image pasted successfully from TextInput!',
		}));
	};

	const removePastedContent = (id: string) => {
		setState(prev => ({
			...prev,
			pastedContents: prev.pastedContents.filter(p => p.id !== id),
		}));
	};

	const removeImage = (id: string) => {
		setState(prev => ({
			...prev,
			pastedImages: prev.pastedImages.filter(img => img.id !== id),
			hasImagePasted: prev.pastedImages.filter(img => img.id !== id).length > 0,
		}));
	};

	useEffect(() => {
		setState(prev => ({ ...prev, renderedSummary: state.currentSummary }));
	}, [state.currentSummary]);

	const createConnection = () => {
		// 防止重复连接
		if (isConnectingRef.current) {
			return;
		}

		isConnectingRef.current = true;

		// 清理旧连接
		if (ws) {
			ws.removeAllListeners();
			if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
				ws.close();
			}
		}

		setState(prev => ({
			...prev,
			status: `Connecting to ${wsUrl}...`,
			isReconnecting: false,
		}));

		try {
			const websocket = new WebSocket(wsUrl);
			setWs(websocket);

			websocket.on('open', () => {
				isConnectingRef.current = false;
				setState(prev => ({
					...prev,
					status: 'Connected! Please input your feedback...',
					connectionError: false,
					isReconnecting: false,
					reconnectAttempts: 0,
				}));
			});

			websocket.on('message', (data: Buffer) => {
				try {
					const message = JSON.parse(data.toString()) as {
						type: string;
						data?: string;
						message?: string;
					};

					if (message.type === 'summary') {
						setState(prev => ({
							...prev,
							currentSummary: message.data || 'No summary available',
							status: '📋 New AI call received, please provide feedback',
							isSubmitted: false,
							isWaitingForNewPrompt: false,
							feedback: '',
							pastedImages: [],
							hasImagePasted: false,
							justPastedImage: false,
							helpContent: null,
							cursorOffset: 0,
							pastedContents: [],
						}));
					} else if (message.type === 'error') {
						setState(prev => ({
							...prev,
							status: `❌ Server error: ${message.message || 'Unknown error'}`,
						}));
					}
				} catch (error) {
					setState(prev => ({
						...prev,
						status: `⚠️ Message parsing error: ${
							error instanceof Error ? error.message : String(error)
						}`,
					}));
				}
			});

			websocket.on('close', (code: number, reason: Buffer) => {
				isConnectingRef.current = false;
				const reasonStr = reason.toString();

				setState(prev => {
					const newAttempts = prev.reconnectAttempts + 1;
					const shouldReconnect = newAttempts <= 100; // 最多重连100次

					return {
						...prev,
						status: shouldReconnect
							? `Connection closed (${code}${reasonStr ? `: ${reasonStr}` : ''}). Reconnecting in 5 seconds...`
							: 'Connection failed after 10 attempts. Please check your connection.',
						connectionError: true,
						isReconnecting: shouldReconnect,
						reconnectAttempts: newAttempts,
					};
				});
			});

			websocket.on('error', (error: Error) => {
				isConnectingRef.current = false;

				setState(prev => {
					const newAttempts = prev.reconnectAttempts + 1;
					const shouldReconnect = newAttempts <= 10;

					return {
						...prev,
						status: shouldReconnect
							? `WebSocket error: ${error.message}. Reconnecting in 5 seconds...`
							: `Connection failed after 10 attempts: ${error.message}`,
						connectionError: true,
						isReconnecting: shouldReconnect,
						reconnectAttempts: newAttempts,
					};
				});
			});
		} catch (error) {
			isConnectingRef.current = false;
			setState(prev => ({
				...prev,
				status: `Failed to create WebSocket: ${error instanceof Error ? error.message : String(error)}`,
				connectionError: true,
				isReconnecting: false,
			}));
		}
	};

	useEffect(() => {
		if (!wsUrl) {
			setState(prev => ({
				...prev,
				status: 'Error: WebSocket URL not provided.',
				connectionError: true,
			}));
			return;
		}

		createConnection();

		return () => {
			isConnectingRef.current = false;
			if (reconnectTimeoutRef.current) {
				clearTimeout(reconnectTimeoutRef.current);
			}
			if (ws) {
				ws.removeAllListeners();
				if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
					ws.close();
				}
			}
		};
	}, [wsUrl]);

	// 自动重连逻辑
	useEffect(() => {
		if (state.isReconnecting && state.reconnectAttempts <= 10) {
			// 清除之前的重连定时器
			if (reconnectTimeoutRef.current) {
				clearTimeout(reconnectTimeoutRef.current);
			}

			reconnectTimeoutRef.current = setTimeout(() => {
				createConnection();
			}, 5000); // 5秒重连间隔
		}

		return () => {
			if (reconnectTimeoutRef.current) {
				clearTimeout(reconnectTimeoutRef.current);
			}
		};
	}, [state.isReconnecting, state.reconnectAttempts]);

	return (
		<Box flexDirection="column">
			<Box marginBottom={1}>
				<Text bold color="cyan">
					MCP Feedback Terminal
				</Text>
				<Box marginLeft={1}>
					<Text color="gray" dimColor>
						Server listening on port {actualPort}
					</Text>
				</Box>
			</Box>

			<Box marginBottom={1}>
				<Text bold color="yellow">
					AI Work Summary:
				</Text>
			</Box>
			<Box marginBottom={1} padding={1} borderStyle="round" borderColor="gray">
				<Markdown>{state.currentSummary}</Markdown>
			</Box>

			{state.helpContent && (
				<Box borderStyle="round" borderColor="yellow" padding={1} marginBottom={1}>
					<Text color="yellow" bold>
						📚 Help
					</Text>
					<Text>{state.helpContent}</Text>
				</Box>
			)}

			{state.showExitMessage && (
				<Box borderStyle="round" borderColor="red" padding={1} marginBottom={1}>
					<Text color="red" bold>
						⚠️ Exit Confirmation
					</Text>
					<Text>Press {state.exitKey} again to exit, or continue typing to cancel</Text>
				</Box>
			)}

			{state.showMessage && (
				<Box borderStyle="round" borderColor="cyan" padding={1} marginBottom={1}>
					<Text color="cyan" bold>
						💬 Message
					</Text>
					<Text>{state.message}</Text>
				</Box>
			)}

			{state.pastedImages.length > 0 && (
				<Box flexDirection="column">
					<Box>
						<Text color="blue" bold>
							📷 Images Pasted ({state.pastedImages.length})
						</Text>
					</Box>
					<Box borderStyle="round" borderColor="blue" marginBottom={1} flexDirection="column">
						{state.pastedImages.map((img, index) => (
							<Box key={img.id} marginLeft={1}>
								<Text color="gray">
									#{index + 1}: {img.name} (use /i{index + 1} to delete)
								</Text>
							</Box>
						))}
					</Box>
				</Box>
			)}

			{state.pastedContents.length > 0 && (
				<Box flexDirection="column">
					<Box>
						<Text bold color="magenta">
							📋 Pasted Contents ({state.pastedContents.length}):
						</Text>
					</Box>
					<Box flexDirection="column" marginBottom={1} borderStyle="round" borderColor="gray">
						<Box flexDirection="column">
							{state.pastedContents.map((paste, index) => (
								<Box key={paste.id}>
									<Text wrap="truncate-end">
										{index + 1}. {paste.content}
									</Text>
								</Box>
							))}
						</Box>
					</Box>
				</Box>
			)}

			<Box marginBottom={1}>
				<Text bold color="green">
					Your Feedback:
				</Text>
			</Box>
			<Box marginBottom={1} borderStyle="round" borderColor="gray" padding={1}>
				{!state.isSubmitted ? (
					<TextInput
						value={state.feedback}
						onChange={handleInputChange}
						onSubmit={handleSubmit}
						onExit={handleExit}
						onExitMessage={handleExitMessage}
						onMessage={handleMessage}
						cursorOffset={state.cursorOffset}
						onChangeCursorOffset={offset => setState(prev => ({ ...prev, cursorOffset: offset }))}
						columns={process.stdout.columns || 80}
						placeholder={
							state.isWaitingForNewPrompt
								? 'Waiting for next AI call...'
								: 'Enter feedback... (Ctrl+V for image, Opt+Enter for new line, /help for commands)'
						}
						multiline={true}
						showCursor={true}
						onPaste={handlePaste}
						onImagePaste={handleImagePasteFromTextInput}
					/>
				) : (
					<Text italic color="gray">
						{state.feedback || 'No feedback'}
					</Text>
				)}
			</Box>

			<Text color={state.connectionError ? 'red' : 'green'}>{state.status}</Text>
		</Box>
	);
}
