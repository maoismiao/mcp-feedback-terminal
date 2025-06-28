#!/usr/bin/env node
import { FastMCP } from 'fastmcp';
import { z } from 'zod';
import {
	getInteractiveFeedback,
	startFeedbackServer,
	stopFeedbackServer,
} from './lib/feedbackServer.js';

const server = new FastMCP({
	name: 'mcp-feedback-server',
	version: '1.3.9',
});

// Add the interactive feedback tool
server.addTool({
	name: 'interactive_feedback',
	description: `Interactive feedback collection tool for LLM agents.

USAGE RULES:
1. During any process, task, or conversation, whether asking, replying, or completing phased tasks, you must call this tool to ask for feedback.
2. Unless receiving termination instructions, all steps must repeatedly call this tool.
3. Whenever user feedback is received, if the feedback content is not empty, you must call this tool again and adjust behavior based on the feedback content.
4. Only when the user explicitly indicates "end" or "no more interaction needed" can you stop calling this tool, and the process is considered complete.
5. You should summarize what have done for user review.

Args:
    summary: Summary of AI work completed for user review

Environment Variables:
    MCP_FEEDBACK_TIMEOUT: Timeout in seconds for waiting user feedback (default: 600 seconds = 10 minutes)
    MCP_PROJECT_DIR: Project directory path for context

Returns:
    list: List containing TextContent and MCPImage objects representing user feedback`,
	parameters: z.object({
		summary: z.string().optional().describe('Summary of AI work completed for user review'),
	}),
	execute: async (args: { summary?: string }, { log }: { log: any }) => {
		const { summary = 'I have completed the task you requested.' } = args;

		// Use the MCP_PROJECT_DIR environment variable directly
		const projectDir = process.env.MCP_PROJECT_DIR;
		if (projectDir) {
			log.info(`Using project directory from environment: ${projectDir}`);
		}

		const timeoutSeconds = process.env.MCP_FEEDBACK_TIMEOUT
			? Number.parseInt(process.env.MCP_FEEDBACK_TIMEOUT, 10)
			: 600;

		if (Number.isNaN(timeoutSeconds) || timeoutSeconds <= 0) {
			return 'Error: Invalid MCP_FEEDBACK_TIMEOUT environment variable. Must be a positive number.';
		}

		const timeoutMs = timeoutSeconds * 1000;

		log.info('Starting interactive feedback process...', {
			summary,
			timeout_seconds: timeoutSeconds,
		});

		try {
			const feedbackResult = await getInteractiveFeedback({
				summary: summary,
				timeout: timeoutMs,
			});

			log.info('Feedback process completed successfully.');

			const responseContent: any[] = [];

			if (feedbackResult.interactive_feedback?.trim()) {
				let feedbackText = feedbackResult.interactive_feedback;
				if (feedbackResult.images && feedbackResult.images.length > 0) {
					const imageNames = feedbackResult.images.map(img => img.name).join(', ');
					feedbackText += `\n\n(Attached images: ${imageNames})`;
				}
				responseContent.push({
					type: 'text',
					text: feedbackText,
				});
			}

			if (feedbackResult.images && feedbackResult.images.length > 0) {
				for (const img of feedbackResult.images) {
					const mimeType = getMimeTypeFromFilename(img.name);
					responseContent.push({
						type: 'image',
						data: img.data,
						mimeType: mimeType,
					});
				}
			}

			if (responseContent.length === 0) {
				return 'User did not provide any feedback.';
			}

			return {
				content: responseContent,
			};
		} catch (error) {
			log.error('Feedback process failed:', {
				error: error instanceof Error ? error.message : String(error),
			});

			let errorMessage = 'An unknown error occurred during feedback collection.';
			if (error instanceof Error) {
				errorMessage = `Error during feedback collection: ${error.message}`;
			}

			return errorMessage;
		}
	},
});

function getMimeTypeFromFilename(filename: string): string {
	const extension = filename.toLowerCase().split('.').pop();
	switch (extension) {
		case 'png':
			return 'image/png';
		case 'jpg':
		case 'jpeg':
			return 'image/jpeg';
		case 'gif':
			return 'image/gif';
		case 'webp':
			return 'image/webp';
		case 'svg':
			return 'image/svg+xml';
		case 'bmp':
			return 'image/bmp';
		default:
			return 'image/png';
	}
}

function parseArgs(): { port: number } {
	const args = process.argv.slice(2);
	let port = 9543;

	for (let i = 0; i < args.length; i++) {
		if (args[i] === '--port' && i + 1 < args.length) {
			const portArg = Number.parseInt(args[i + 1], 10);
			if (!Number.isNaN(portArg) && portArg > 0 && portArg <= 65535) {
				port = portArg;
			} else {
				console.error(`[Main] Invalid port: ${args[i + 1]}. Using default port ${port}.`);
			}
		}
	}

	return { port };
}

async function startServers() {
	try {
		const { port } = parseArgs();
		console.error(`[Main] Starting feedback server on port ${port}...`);

		await startFeedbackServer(port);

		server.start({
			transportType: 'stdio',
		});

		console.error('[Main] Both MCP server and WebSocket feedback server are running.');
	} catch (error) {
		console.error('[Main] Failed to start servers:', error);
		process.exit(1);
	}
}

process.on('SIGINT', () => {
	console.error('[Main] Received SIGINT, shutting down gracefully...');
	stopFeedbackServer();
	process.exit(0);
});

process.on('SIGTERM', () => {
	console.error('[Main] Received SIGTERM, shutting down gracefully...');
	stopFeedbackServer();
	process.exit(0);
});

startServers();
