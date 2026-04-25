# Back-Config MCP Server

用于在 Claude Code 中管理 CamScanner 后台配置（back_config）的 MCP Server。

## 功能

| 工具 | 说明 |
|------|------|
| `back-config-auth` | 浏览器登录 operate 平台 |
| `back-config-logout` | 退出登录 |
| `list_platforms` | 列出支持的平台 |
| `list_keys` | 列出指定平台下所有配置 key |
| `get_config` | 获取某个 key 的完整配置详情 |
| `update_config` | 更新/保存配置 |
| `add_key` | 新增配置 key |
| `delete_key` | 删除配置 key |
| `rollback` | 一键回退到上一版本 |
| `rollback_to_version` | 回退到指定历史版本 |
| `set_online` | 一键上线配置 |
| `get_history` | 获取配置变更历史 |
| `get_ab_tests` | 获取 AB 实验列表 |

## 安装

```bash
# 1. 添加插件市场（仅首次）
claude plugin marketplace add tianmuji/camscanner-plugins

# 2. 安装插件
claude plugin install back-config@camscanner-plugins
```

安装后重启 Claude Code 即可使用。插件会自动注册 MCP Server 和 `/back-config` Skill。

### 前提条件

- Node.js >= 18
- Playwright Chromium（用于浏览器登录）：`npx playwright install chromium`

## 认证

首次使用时调用 `back-config-auth` 工具，会打开浏览器进行 SSO 登录。

- 浏览器数据持久化在 `~/.back-config-mcp/browser-data/`，保存的密码下次自动填充
- 认证信息保存在 `~/.back-config-mcp/credentials.json`，有效期 7 天

## 支持的平台

android, ios, web, ios_hd, ios_plus, harmony

## 使用示例

```
> 查看 Android 平台的所有配置 key
> 获取 show_gpt 配置的详情
> 帮我回退 xxx 配置到上一版本
> 查看 AB 实验列表
```

## 开发者指南

### 发布新版本

```bash
# 1. 修改代码并构建
npm run build

# 2. 更新版本号并发布到 npm
npm version patch   # bug fix: 1.0.0 → 1.0.1
npm version minor   # 新功能: 1.0.0 → 1.1.0
npm version major   # 破坏性变更: 1.0.0 → 2.0.0

npm publish --registry https://registry.npmjs.org/ --access public

# 3. 推送 tag 到远端
git push && git push --tags
```

用户下次启动 Claude Code 时，`npx -y @camscanner/back-config-mcp-server@latest` 会自动拉取新版本。
