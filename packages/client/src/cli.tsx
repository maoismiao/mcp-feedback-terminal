#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from 'ink';
import App from './cli/app.js';

function parseArgs(): { port?: number } {
	const args = process.argv.slice(2);
	let port: number | undefined;

	for (let i = 0; i < args.length; i++) {
		if (args[i] === '--port' && i + 1 < args.length) {
			const portArg = Number.parseInt(args[i + 1], 10);
			if (!Number.isNaN(portArg) && portArg > 0 && portArg <= 65535) {
				port = portArg;
			} else {
				console.error(`[CLI] Invalid port: ${args[i + 1]}. Using auto-discovery.`);
			}
		}
	}

	if (port === undefined) {
		const portFilePath = join(process.cwd(), '.mcp-feedback-port');
		if (existsSync(portFilePath)) {
			try {
				const portContent = readFileSync(portFilePath, 'utf8').trim();
				const filePort = Number.parseInt(portContent, 10);
				if (!Number.isNaN(filePort) && filePort > 0 && filePort <= 65535) {
					port = filePort;
					console.log(`[CLI] Using port ${port} from .mcp-feedback-port file`);
				} else {
					console.error(`[CLI] Invalid port in .mcp-feedback-port file: ${portContent}`);
				}
			} catch (error) {
				console.error(`[CLI] Error reading .mcp-feedback-port file: ${error}`);
			}
		}
	}

	return { port };
}

const { port } = parseArgs();

render(<App port={port} />);
