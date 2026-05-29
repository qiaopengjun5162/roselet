# 安全策略

## 支持的版本

| 版本 | 支持状态 |
| --- | --- |
| 0.1.x | ✅ 当前版本 |

## 报告漏洞

如果您发现安全漏洞，请**不要**公开提交 Issue。

请通过以下方式私密报告：
- 邮件：qiaopengjun@example.com
- GitHub Security Advisory（推荐）

我们会在 48 小时内响应，并在修复后公开致谢。

## 安全最佳实践

### 1. JWT 密钥管理

**强制要求**：
- 生产环境必须设置 `JWT_SECRET` 环境变量
- 最小长度：32 字节
- 推荐长度：64 字节

```bash
# 生成强密钥
openssl rand -base64 48
```

**警告**：
- 默认密钥 `roselet-dev-secret` 仅用于开发
- 启动时会检查并警告弱密钥

### 2. 数据库安全

**连接安全**：
```bash
# 使用 SSL 连接
DATABASE_URL="postgres://user:pass@host/db?sslmode=require"
```

**SQL 注入防护**：
- ✅ 所有查询使用 SQLx 参数化
- ✅ 无字符串拼接 SQL

### 3. 输入验证

**已实现**：
- 昵称长度：1-50 字符
- 玫瑰内容：每段 ≤500 字符
- 颜色枚举：red/white/yellow
- UUID 格式验证

**XSS 防护**：
- 前端：React 自动转义
- 后端：返回纯文本，不渲染 HTML

### 4. 认证与授权

**JWT 认证**：
- HS256 算法
- 7 天过期时间
- 包含 user_id + nickname

**权限控制**：
- ✅ 编辑/删除玫瑰：仅 owner
- ✅ 点赞：需登录
- ✅ 个人花圃：需登录
- ✅ 用户资料：需登录

### 5. 速率限制

**当前状态**：未实现

**建议**：
- 在反向代理层（Nginx/Caddy）添加
- 注册：10 次/小时/IP
- 创建玫瑰：20 次/小时/用户
- API 调用：100 次/分钟/IP

### 6. CORS 配置

**当前状态**：允许所有来源（开发模式）

**生产建议**：
```rust
// crates/backend/src/main.rs
let cors = CorsLayer::new()
    .allow_origin("https://roselet.example.com".parse::<HeaderValue>()?)
    .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE])
    .allow_headers([AUTHORIZATION, CONTENT_TYPE]);
```

### 7. 依赖审计

```bash
# 检查已知漏洞
just audit

# 或手动运行
cargo deny check advisories
```

**自动化**：
- GitHub Actions 每次 push 运行审计
- Dependabot 自动更新依赖

## 已知限制

1. **无速率限制** - 建议在反向代理层添加
2. **无日志审计** - 建议添加 tracing 日志
3. **WebSocket 无认证** - 当前广播所有新玫瑰（公开数据）
4. **AI API Key 明文存储** - 环境变量，建议使用密钥管理服务

## 安全审计历史

| 日期 | 审计内容 | 结果 |
|------|---------|------|
| 2026-05-29 | 全面代码审计 | 无高危漏洞 |
| 2026-05-28 | JWT 安全修复 | 移除硬编码密钥 |

## 合规性

- **GDPR**：用户可删除自己的玫瑰（数据删除权）
- **隐私**：仅存储昵称，无敏感个人信息
- **开源许可**：MIT License

## 联系方式

安全问题请联系：qiaopengjun@example.com
