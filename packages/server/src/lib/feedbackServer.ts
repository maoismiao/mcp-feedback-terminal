import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { type Server as HttpServer, createServer } from 'node:http';
import { join } from 'node:path';
import { WebSocket, WebSocketServer } from 'ws';

function getProjectDirectory(): string {
	if (process.env.MCP_PROJECT_DIR) {
		return process.env.MCP_PROJECT_DIR;
	}
	return process.cwd();
}

function getPortFilePath(): string {
	return join(getProjectDirectory(), '.mcp-feedback-port');
}

export interface FeedbackOptions {
	port?: number;
	summary: string;
	timeout?: number;
}

export interface ImageData {
	name: string;
	data: string;
}

export interface FeedbackResult {
	interactive_feedback: string;
	images?: ImageData[];
}

let globalWss: WebSocketServer | null = null;
let globalHttpServer: HttpServer | null = null;
let isServerRunning = false;

function savePortInfo(port: number): void {
	const portFile = getPortFilePath();
	const projectDir = getProjectDirectory();

	try {
		writeFileSync(portFile, port.toString(), 'utf8');
		process.env.MCP_FEEDBACK_PORT = port.toString();
		console.error(`[FeedbackServer] Port info saved to ${portFile}: ${port}`);
		console.error(`[FeedbackServer] Project: ${projectDir}`);
	} catch (error) {
		console.error('[FeedbackServer] Failed to save port info:', error);
	}
}

export function getServerPort(): number | null {
	const portFile = getPortFilePath();
	try {
		if (existsSync(portFile)) {
			const portStr = readFileSync(portFile, 'utf8').trim();
			const port = Number.parseInt(portStr, 10);
			if (!Number.isNaN(port)) {
				console.error(`[FeedbackServer] Found port ${port} from ${portFile}`);
				return port;
			}
		}
	} catch (error) {
		console.error('[FeedbackServer] Failed to read port file:', error);
	}

	if (process.env.MCP_FEEDBACK_PORT) {
		const port = Number.parseInt(process.env.MCP_FEEDBACK_PORT, 10);
		if (!Number.isNaN(port)) {
			console.error(`[FeedbackServer] Found port ${port} from environment variable`);
			return port;
		}
	}

	return null;
}

function clearPortInfo(): void {
	const portFile = getPortFilePath();
	try {
		if (existsSync(portFile)) {
			unlinkSync(portFile);
			console.error(`[FeedbackServer] Cleared port file: ${portFile}`);
		}
		process.env.MCP_FEEDBACK_PORT = undefined;
	} catch (error) {
		console.error('[FeedbackServer] Failed to clear port info:', error);
	}
}

async function isPortInUse(port: number): Promise<boolean> {
	return new Promise(resolve => {
		const server = createServer();

		server.listen(port, () => {
			server.close(() => {
				resolve(false);
			});
		});

		server.on('error', () => {
			resolve(true);
		});
	});
}

async function findAvailablePort(startPort: number): Promise<number> {
	let port = startPort;
	while (port < startPort + 100) {
		if (!(await isPortInUse(port))) {
			return port;
		}
		port++;
	}
	throw new Error(`No available port found in range ${startPort}-${startPort + 99}`);
}

export async function startFeedbackServer(port = 9543): Promise<void> {
	if (isServerRunning) {
		console.error('[FeedbackServer] Server is already running.');
		return;
	}

	let finalPort = port;

	if (await isPortInUse(port)) {
		console.error(`[FeedbackServer] Port ${port} is occupied. Looking for available port...`);
		finalPort = await findAvailablePort(port);
		console.error(`[FeedbackServer] Using available port: ${finalPort}`);
	}

	return new Promise((resolve, reject) => {
		globalHttpServer = createServer();
		globalWss = new WebSocketServer({ server: globalHttpServer });

		globalWss.on('connection', (ws: WebSocket) => {
			console.error('[FeedbackServer] Client connected.');

			ws.on('close', () => {
				console.error('[FeedbackServer] Client disconnected.');
			});

			ws.on('error', error => {
				console.error('[FeedbackServer] WebSocket error:', error);
			});
		});

		globalHttpServer.listen(finalPort, () => {
			isServerRunning = true;
			savePortInfo(finalPort);
			console.error(`
      ===============================================================
      [FeedbackServer] WebSocket server started
      Server is listening on: ws://localhost:${finalPort}
      Project Directory: ${getProjectDirectory()}
      Port file: ${getPortFilePath()}
      
      Multiple Cursor instances supported - each project uses its own port.
      
      Please connect using a WebSocket client and send your feedback
      in the following JSON format:
      {
        "interactive_feedback": "Your feedback message here...",
        "images": [
          {
            "name": "filename1.png",
            "data": "base64_encoded_string_of_image_1"
          }
        ]
      }
      The 'images' array is optional.
      Ready to receive feedback requests...
      ===============================================================
      `);
			resolve();
		});

		globalHttpServer.on('error', err => {
			console.error('[FeedbackServer] Server error:', err);
			reject(err);
		});
	});
}

export function stopFeedbackServer(): void {
	if (!isServerRunning) {
		return;
	}

	console.error('[FeedbackServer] Shutting down server...');

	if (globalWss) {
		for (const client of globalWss.clients) {
			client.close();
		}
		globalWss.close();
		globalWss = null;
	}

	if (globalHttpServer) {
		globalHttpServer.close();
		globalHttpServer = null;
	}

	clearPortInfo();
	isServerRunning = false;
}

export function getInteractiveFeedback(options: FeedbackOptions): Promise<FeedbackResult> {
	const { summary, timeout = 600000 } = options;

	return new Promise((resolve, reject) => {
		if (!isServerRunning || !globalWss) {
			reject(new Error('Feedback server is not running. Please start the server first.'));
			return;
		}

		const timeoutId: NodeJS.Timeout = setTimeout(() => {
			if (!feedbackReceived) {
				console.error(
					`[FeedbackServer] Timeout: No feedback received within ${timeout / 1000} seconds.`
				);
				cleanup();

				if (!clientConnected) {
					reject(new Error('Feedback timed out: No client connected within the timeout period.'));
				} else {
					reject(new Error('Feedback timed out: Client connected but no feedback received.'));
				}
			}
		}, timeout);

		let feedbackReceived = false;
		let clientConnected = false;

		const handleMessage = (ws: WebSocket, message: Buffer) => {
			if (feedbackReceived) return;

			try {
				const feedback: FeedbackResult = JSON.parse(message.toString());
				console.error('[FeedbackServer] Feedback received.');
				feedbackReceived = true;
				clearTimeout(timeoutId);

				cleanup();

				resolve(feedback);
			} catch {
				console.error('[FeedbackServer] Error parsing feedback.');
				ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON format.' }));
			}
		};

		const messageHandler = (message: Buffer) => {
			const ws = Array.from(globalWss!.clients).find(
				client => client.readyState === WebSocket.OPEN
			);
			if (ws) {
				handleMessage(ws, message);
			}
		};

		const connectionHandler = (ws: WebSocket) => {
			console.error('[FeedbackServer] New client connected during feedback wait.');
			clientConnected = true;

			ws.send(JSON.stringify({ type: 'summary', data: summary }));

			ws.on('message', messageHandler);
		};

		const cleanup = () => {
			globalWss!.removeListener('connection', connectionHandler);

			for (const client of globalWss!.clients) {
				client.removeListener('message', messageHandler);
			}
		};

		const activeClients = Array.from(globalWss.clients).filter(
			client => client.readyState === WebSocket.OPEN
		);

		if (activeClients.length > 0) {
			console.error('[FeedbackServer] Found active clients, sending summary...');
			clientConnected = true;

			for (const client of activeClients) {
				client.send(JSON.stringify({ type: 'summary', data: summary }));
				client.on('message', messageHandler);
			}
		} else {
			console.error('[FeedbackServer] No active clients found. Waiting for client connection...');
			globalWss.on('connection', connectionHandler);
		}

		console.error('[FeedbackServer] Waiting for feedback...');
	});
}
