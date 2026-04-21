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

## 配置数据结构

每个配置 key 包含以下核心字段：

- **key** — 配置键名
- **note** — 字段说明
- **notion** — Notion 文档链接
- **gray_plan** — 灰度介绍
- **value_type** — 值类型 (number / string)
- **value_default** — 默认值
- **abtest** — 是否为 AB 测试 (0/1)
- **ip_country_first** — 是否优先使用 IP 判定国家
- **conditions** — 显示条件列表
- **value_list** — 值列表，每个值可有独立的条件
- **child_keys** — 子 key（最多 3 层嵌套）

### 条件字段说明

条件用于控制配置的下发范围，支持：

- **地理定向**: country, black_country, language, black_language, ip_city, black_ip_city
- **版本控制**: app_version, black_version, min_ver, max_ver
- **用户属性**: account_type, has_paid, new_user, is_vip, was_vip, reg_days
- **灰度控制**: gray_start, gray_end (百分比区间)
- **白名单**: white_users (UID), white_devices (设备ID)
- **AB 实验**: abtest_name, abtest_groupid
- **设备属性**: mobile_brand, android_api, ios_version, device_model, harmonyos_version
- **渠道归因**: af_media_source, af_campaign, branch_media_source 等

## 工作流程

### 查看配置

1. 如果未认证，先调用 `back-config-auth` 登录
2. 使用 `list_keys` 获取指定平台的所有 key
3. 使用 `get_config` 查看具体 key 的详细配置

### 修改配置

1. 先用 `get_config` 获取当前完整配置
2. 在返回的 JSON 基础上修改需要变更的字段
3. 使用 `update_config` 传入修改后的完整配置 JSON 保存
4. **注意**: 保存前需要清理临时 UI 属性（show, key_mes, select_key）

### 新增/删除 key

1. 使用 `add_key` 创建新 key（会自动创建默认结构）
2. 使用 `delete_key` 删除 key（不可撤销，谨慎操作）

### 回退配置

1. 使用 `rollback` 一键回退到上一版本
2. 或使用 `get_history` 查看历史，再用 `rollback_to_version` 回退到指定版本

### 上线配置

1. 使用 `set_online` 将配置推送到线上

## 注意事项

- 线上环境操作需谨慎，修改前建议先查看历史记录
- 删除 key 操作不可逆
- 修改配置时传入的 JSON 必须是完整的配置对象
- 子 key 支持最多 3 层嵌套
