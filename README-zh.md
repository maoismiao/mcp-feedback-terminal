[English](./README.md) | **中文**

# MCP Feedback Terminal 快速开始

## 📹 演示视频

[演示视频](./demo.mp4)

> **平台支持：** 目前仅支持 macOS 和 Cursor。

## 🚀 快速开始

### 第一步：配置 MCP 服务器

在你的项目根目录下创建 `.cursor` 目录（如果不存在），然后添加 `mcp.json` 配置文件：

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

**注意：** 请将 `MCP_PROJECT_DIR` 的值替换为你的实际项目路径。

### 第二步：启动服务

在项目根目录下执行以下命令启动 MCP Feedback Terminal：

```bash
npx mcp-feedback-terminal
```

**重要提示：** 启动后会在项目根目录生成 `.mcp-feedback-port` 文件，该文件包含服务端口信息，请不要删除此文件。

### 配置说明

- `MCP_FEEDBACK_TIMEOUT`: 等待用户反馈的超时时间（秒），默认为 600 秒（10分钟）
- `MCP_PROJECT_DIR`: 项目目录路径，用于提供上下文信息
