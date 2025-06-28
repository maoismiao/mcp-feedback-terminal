**English** | [中文](./README-zh.md)

# MCP Feedback Terminal Quick Start

## 📹 Demo

[Demo Video](./demo.gif)

> **Platform Support:** Currently supports macOS and Cursor only.

## 🚀 Quick Start

### Step 1: Configure MCP Server

Create a `.cursor` directory in your project root (if it doesn't exist), then add the `mcp.json` configuration file:

**.cursor/mcp.json**
```json
{
  "mcpServers": {
    "mcp-feedback-terminal": {
      "command": "npx",
      "args": ["mcp-feedback-server@latest"],
      "env": {
          "MCP_FEEDBACK_TIMEOUT": "600",
          "MCP_PROJECT_DIR": "/path/to/your/project"
        }
      }
    }
}
```

**Note:** Please replace the value of `MCP_PROJECT_DIR` with your actual project path.

### Step 2: Start the Service

Execute the following command in your project root directory to start MCP Feedback Terminal:

```bash
npx mcp-feedback-terminal
```

**Important:** After startup, a `.mcp-feedback-port` file will be generated in the project root directory. This file contains server port information, please do not delete this file.

### Configuration Description

- `MCP_FEEDBACK_TIMEOUT`: Timeout for waiting for user feedback (in seconds), default is 600 seconds (10 minutes)
- `MCP_PROJECT_DIR`: Project directory path, used to provide context information 