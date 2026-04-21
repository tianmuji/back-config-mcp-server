---
name: back-config
description: "后台配置可视化助手。当用户提到后台配置、back_config、feature flag、灰度配置、配置管理、条件下发等关键词时触发，或用户要求查询、修改、回退后台配置时触发。"
argument-hint: <key 名称或平台>
disable-model-invocation: false
allowed-tools: ["mcp__plugin_back_config_back-config__*"]
---

# 后台配置可视化助手

帮助用户通过 MCP 工具管理 CamScanner 后台配置（back_config），支持查询、新增、修改、删除、回退和上线配置。

## 可用 MCP 工具

来自 back-config MCP server：

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

1. 如果未认证，先调用 `back-config-auth` 登录
2. 使用 `list_keys` 获取指定平台的所有 key
3. 使用 `get_config` 查看具体 key 的详细配置

### 修改配置

1. 先用 `get_config` 获取当前完整配置
2. 在返回的 JSON 基础上修改需要变更的字段
3. 使用 `update_config` 传入修改后的完整配置 JSON 保存

### 回退配置

1. 使用 `rollback` 一键回退到上一版本
2. 或使用 `get_history` 查看历史，再用 `rollback_to_version` 回退到指定版本
