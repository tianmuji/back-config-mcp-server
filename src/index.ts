#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod/v3";

import { ConfigClient } from "./config-client.js";
import { loadCredentials, saveCredentials, startSsoLogin, clearCredentials } from "./auth.js";
import {
  formatKeyList,
  formatConfigDetail,
  formatHistoryList,
  formatTestList,
  formatPlatforms,
} from "./formatters.js";

const OPERATE_BASE_URL = process.env.OPERATE_BASE_URL || "https://operate.intsig.net";
const client = new ConfigClient(OPERATE_BASE_URL);

async function requireAuth(): Promise<string | null> {
  if (!client.isAuthenticated()) {
    const savedCreds = await loadCredentials();
    if (savedCreds) {
      client.setCredentials(savedCreds);
      console.error("Restored saved credentials (valid until " + new Date(savedCreds.expiresAt).toLocaleString() + ")");
    }
  }
  if (!client.isAuthenticated()) {
    return "Not authenticated. Please call the 'back-config-auth' tool first to login via browser.";
  }
  return null;
}

const server = new McpServer({
  name: "back-config",
  version: "1.0.0",
}, {
  instructions: `# 后台配置可视化助手

帮助用户通过 MCP 工具管理 CamScanner 后台配置（back_config）。

## 可用 MCP 工具

1. **back-config-auth** — 浏览器登录 operate 平台
2. **back-config-logout** — 退出登录
3. **list_keys** — 列出指定平台下所有配置 key
4. **get_config** — 获取某个 key 的完整配置详情
5. **update_config** — 更新/保存配置
6. **add_key** — 新增配置 key
7. **delete_key** — 删除配置 key
8. **rollback** — 一键回退到上一版本
9. **set_online** — 一键上线配置
10. **get_history** — 获取配置变更历史
11. **rollback_to_version** — 回退到指定历史版本
12. **list_platforms** — 列出支持的平台
13. **get_ab_tests** — 获取 AB 实验列表

## 支持的平台

android, ios, web, ios_hd, ios_plus, harmony

## 工作流程

### 查看配置
1. 使用 list_keys 获取所有 key 列表
2. 使用 get_config 查看具体某个 key 的详细配置（包含条件、值列表、子key等）

### 修改配置
1. 先用 get_config 获取当前配置
2. 修改需要变更的字段
3. 使用 update_config 保存变更
4. 如果是线上环境，会有确认提示

### 回退配置
1. 使用 get_history 查看变更历史
2. 使用 rollback 一键回退到上一版本，或 rollback_to_version 回退到指定版本

### 新增/删除 key
1. 使用 add_key 创建新的配置 key
2. 使用 delete_key 删除不需要的 key`,
});

// Tool: back-config-auth
server.tool(
  "back-config-auth",
  "Login to operate platform via browser. Opens a Chromium window for SSO login.",
  {},
  async () => {
    if (client.isAuthenticated()) {
      return { content: [{ type: "text", text: "Already authenticated. Use 'back-config-logout' to re-authenticate." }] };
    }
    try {
      const creds = await startSsoLogin({ operateBaseUrl: OPERATE_BASE_URL });
      client.setCredentials(creds);
      await saveCredentials(creds);
      return { content: [{ type: "text", text: "Authentication successful! You can now use all back-config tools." }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Authentication failed: ${err.message}` }] };
    }
  }
);

// Tool: back-config-logout
server.tool(
  "back-config-logout",
  "Clear saved credentials and logout.",
  {},
  async () => {
    await clearCredentials();
    client.setCredentials(null);
    return { content: [{ type: "text", text: "Logged out. Call 'back-config-auth' to login again." }] };
  }
);

// Tool: list_platforms
server.tool(
  "list_platforms",
  "List all supported platforms for back config.",
  {},
  async () => {
    return { content: [{ type: "text", text: formatPlatforms() }] };
  }
);

// Tool: list_keys
server.tool(
  "list_keys",
  "List all configuration keys for a given platform. Returns key names, notes, and child key info.",
  {
    platform: z.enum(["android", "ios", "web", "ios_hd", "ios_plus", "harmony"]).describe("Target platform"),
  },
  async ({ platform }) => {
    const authErr = await requireAuth();
    if (authErr) return { content: [{ type: "text", text: authErr }] };

    try {
      const res = await client.getConfigMessage("all", platform);
      if (res.errno !== 0) {
        return { content: [{ type: "text", text: `API error (errno: ${res.errno}): ${res.message || res.errmsg || JSON.stringify(res)}` }] };
      }
      const data = res.data;
      return { content: [{ type: "text", text: formatKeyList(Array.isArray(data) ? data : []) }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }] };
    }
  }
);

// Tool: get_config
server.tool(
  "get_config",
  "Get full configuration detail for a specific key on a given platform. Returns conditions, value list, child keys, metadata, etc.",
  {
    key: z.string().describe("Configuration key name"),
    platform: z.enum(["android", "ios", "web", "ios_hd", "ios_plus", "harmony"]).describe("Target platform"),
  },
  async ({ key, platform }) => {
    const authErr = await requireAuth();
    if (authErr) return { content: [{ type: "text", text: authErr }] };

    try {
      const res = await client.getConfigMessage(key, platform);
      if (res.errno !== 0) {
        return { content: [{ type: "text", text: `API error (errno: ${res.errno}): ${res.message || res.errmsg || JSON.stringify(res)}` }] };
      }
      return { content: [{ type: "text", text: formatConfigDetail(res.data) }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }] };
    }
  }
);

// Tool: update_config
server.tool(
  "update_config",
  "Update/save configuration for a key. Pass the full configuration object as JSON string.",
  {
    config_json: z.string().describe("Full configuration object as JSON string (same structure as get_config returns)"),
    platform: z.enum(["android", "ios", "web", "ios_hd", "ios_plus", "harmony"]).describe("Target platform"),
  },
  async ({ config_json, platform }) => {
    const authErr = await requireAuth();
    if (authErr) return { content: [{ type: "text", text: authErr }] };

    try {
      JSON.parse(config_json);
    } catch {
      return { content: [{ type: "text", text: "Error: config_json is not valid JSON." }] };
    }

    try {
      const res = await client.setConfigMessage(config_json, platform);
      const success = res.errno === 0 || res.data;
      return {
        content: [{
          type: "text",
          text: success ? "Configuration saved successfully." : `Save failed: ${res.message || JSON.stringify(res)}`,
        }],
      };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }] };
    }
  }
);

// Tool: add_key
server.tool(
  "add_key",
  "Add a new configuration key with default structure.",
  {
    key: z.string().describe("New key name to add"),
    platform: z.enum(["android", "ios", "web", "ios_hd", "ios_plus", "harmony"]).describe("Target platform"),
  },
  async ({ key, platform }) => {
    const authErr = await requireAuth();
    if (authErr) return { content: [{ type: "text", text: authErr }] };

    const config = {
      key,
      value_default: "1",
      value_type: "number",
      value_list: [{ value: 0, conditions: [{}] }],
    };

    try {
      const res = await client.setConfigMessage(JSON.stringify(config), platform, 1);
      const success = res.errno === 0 || res.data;
      return {
        content: [{
          type: "text",
          text: success ? `Key "${key}" added successfully on ${platform}.` : `Add failed: ${res.message || JSON.stringify(res)}`,
        }],
      };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }] };
    }
  }
);

// Tool: delete_key
server.tool(
  "delete_key",
  "Delete a configuration key. This action is irreversible.",
  {
    key: z.string().describe("Key name to delete"),
    platform: z.enum(["android", "ios", "web", "ios_hd", "ios_plus", "harmony"]).describe("Target platform"),
  },
  async ({ key, platform }) => {
    const authErr = await requireAuth();
    if (authErr) return { content: [{ type: "text", text: authErr }] };

    try {
      const res = await client.setConfigMessage(JSON.stringify({ key }), platform, 3);
      const success = res.errno === 0 || res.data;
      return {
        content: [{
          type: "text",
          text: success ? `Key "${key}" deleted successfully from ${platform}.` : `Delete failed: ${res.message || JSON.stringify(res)}`,
        }],
      };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }] };
    }
  }
);

// Tool: rollback
server.tool(
  "rollback",
  "Rollback a configuration key to its previous version (one-step back).",
  {
    key: z.string().describe("Key name to rollback"),
    platform: z.enum(["android", "ios", "web", "ios_hd", "ios_plus", "harmony"]).describe("Target platform"),
  },
  async ({ key, platform }) => {
    const authErr = await requireAuth();
    if (authErr) return { content: [{ type: "text", text: authErr }] };

    try {
      const res = await client.setConfigMessage(JSON.stringify({ key }), platform, 5);
      const success = res.errno === 0 || res.data;
      return {
        content: [{
          type: "text",
          text: success ? `Key "${key}" rolled back successfully on ${platform}.` : `Rollback failed: ${res.message || JSON.stringify(res)}`,
        }],
      };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }] };
    }
  }
);

// Tool: set_online
server.tool(
  "set_online",
  "Push a configuration key online (publish to production).",
  {
    key: z.string().describe("Key name to set online"),
    platform: z.enum(["android", "ios", "web", "ios_hd", "ios_plus", "harmony"]).describe("Target platform"),
  },
  async ({ key, platform }) => {
    const authErr = await requireAuth();
    if (authErr) return { content: [{ type: "text", text: authErr }] };

    try {
      const res = await client.setConfigMessage(JSON.stringify({ key }), platform, 4);
      const success = res.errno === 0 || res.data;
      return {
        content: [{
          type: "text",
          text: success ? `Key "${key}" set online successfully on ${platform}.` : `Set online failed: ${res.message || JSON.stringify(res)}`,
        }],
      };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }] };
    }
  }
);

// Tool: get_history
server.tool(
  "get_history",
  "Get change history of configuration for a specific key and platform. Supports time range filter and pagination.",
  {
    key: z.string().optional().describe("Configuration key name (default: 'all' to get all keys' history)"),
    platform: z.enum(["android", "ios", "web", "ios_hd", "ios_plus", "harmony"]).describe("Target platform"),
    page: z.number().optional().describe("Page number (default: 1)"),
    start_time: z.number().optional().describe("Start time as unix timestamp in seconds"),
    end_time: z.number().optional().describe("End time as unix timestamp in seconds"),
  },
  async ({ key, platform, page, start_time, end_time }) => {
    const authErr = await requireAuth();
    if (authErr) return { content: [{ type: "text", text: authErr }] };

    const timeSpace: number[] = [];
    if (start_time && end_time) {
      timeSpace.push(start_time, end_time);
    }

    try {
      const res = await client.getHistoryList(key || "all", platform, timeSpace, page || 1);
      const data = res.errno === 0 ? res.data : res;
      return { content: [{ type: "text", text: formatHistoryList(data) }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }] };
    }
  }
);

// Tool: rollback_to_version
server.tool(
  "rollback_to_version",
  "Rollback configuration to a specific historical version by its record ID.",
  {
    key: z.string().describe("Configuration key name"),
    platform: z.enum(["android", "ios", "web", "ios_hd", "ios_plus", "harmony"]).describe("Target platform"),
    record_id: z.string().describe("History record ID to rollback to (from get_history)"),
  },
  async ({ key, platform, record_id }) => {
    const authErr = await requireAuth();
    if (authErr) return { content: [{ type: "text", text: authErr }] };

    try {
      const res = await client.setBackConfig(key, platform, record_id);
      const success = res.errno === 0 || res.data;
      return {
        content: [{
          type: "text",
          text: success
            ? `Key "${key}" rolled back to version ${record_id} on ${platform}.`
            : `Rollback failed: ${res.message || JSON.stringify(res)}`,
        }],
      };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }] };
    }
  }
);

// Tool: get_ab_tests
server.tool(
  "get_ab_tests",
  "Get AB test experiment list for a platform. Useful for configuring conditions with AB test references.",
  {
    platform: z.enum(["android", "ios", "web", "ios_hd", "ios_plus", "harmony"]).describe("Target platform"),
  },
  async ({ platform }) => {
    const authErr = await requireAuth();
    if (authErr) return { content: [{ type: "text", text: authErr }] };

    try {
      const res = await client.getTestList(platform);
      const data = res.errno === 0 ? res.data : res;
      return { content: [{ type: "text", text: formatTestList(data) }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }] };
    }
  }
);

// --- Start ---
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Back-Config MCP Server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
