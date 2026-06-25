# Roselet 单机蓝绿后端发布设计

## 背景

Roselet 当前生产后端部署在一台 AWS Lightsail 上：

- Caddy 负责 `https://roselet.47.131.238.0.sslip.io`
- Rust backend 容器监听 `127.0.0.1:3001`
- Postgres 容器与 backend 共机部署

现有发布方式是：

1. GitHub Actions 构建并推送 GHCR 镜像
2. SSH 到 Lightsail
3. `docker compose up -d backend`
4. 在同一台机器上用新镜像替换旧容器

这个流程在“单 backend 容器 + 单上游反代”的结构下，会产生短暂的发布窗口。我们已经通过 Caddy `lb_try_duration 15s` 把“可见 502”显著压低，但受控验证仍看到少量 TLS handshake failure 和超时。这说明当前方案已经从“明显错误”改善到“短抖动”，但还不满足“接近零中断”的目标。

本设计目标是在**不增加第二台机器**的前提下，把发布方式升级为**单机蓝绿切换**，让新版本在接流量前先完成启动和健康检查，再平滑切走旧版本。

## 目标

- 发布新后端镜像时，不再依赖“停旧实例、起新实例”的单槽位替换。
- 在同一台 Lightsail 上同时维护两个 backend 槽位，支持蓝绿切换。
- Caddy 只把流量转发给当前健康且被标记为“活动槽位”的 backend。
- 发布过程中，用户不应再看到 `502`；理想结果是全程 `200`，最差也只允许极短延迟上升。
- 保留当前 GHCR + GitHub Actions + SSH 到 Lightsail 的发布主线，不引入第二台机器。
- 保持 Postgres 单实例不变，不在本轮引入主从复制或数据库迁移编排系统。

## 非目标

- 不新增第二台服务器或外部负载均衡器。
- 不在本轮引入 Kubernetes、Nomad、Swarm。
- 不做数据库零停机迁移编排；数据库仍按当前单机 Postgres 运维。
- 不解决“发布时 schema 不兼容”的所有问题；本轮只优化应用容器切换。
- 不修改 Web / 小程序业务逻辑；前端缓存兜底保持现状。

## 方案对比

### 方案 A：继续单实例 + 更激进重试

做法：

- 继续调 Caddy `lb_try_duration`
- 拉长客户端超时
- 尽量把“切镜像瞬间不可达”变成等待

优点：

- 改动最小

缺点：

- 本质上仍是“旧实例退出后新实例才启动”
- 只能缓和错误表象，不能真正做到零中断
- 目前已经验证：`502` 可以下降，但 TLS 握手失败和超时仍会残留

结论：

- 不作为主方案

### 方案 B：单机蓝绿切换（推荐）

做法：

- 同机同时运行两个 backend 槽位
- 新版本先启动到空闲槽位
- 健康检查通过后再切换活动槽位
- 旧槽位延迟下线

优点：

- 不需要第二台机器
- 与当前 Lightsail 架构兼容
- 能显著缩小发布窗口，把“停旧起新”改成“先起新再切流”

缺点：

- 需要改 Compose、Caddy、部署脚本和回滚流程

结论：

- 推荐采用

### 方案 C：双机或外部负载均衡

做法：

- 两台机器分别跑旧版和新版
- 前面挂真正的 LB

优点：

- 最接近严格零中断

缺点：

- 增加成本
- 超出“单机内完成”的约束

结论：

- 本轮不采用

## 推荐方案

采用**方案 B：单机蓝绿切换**。

核心思路：

- 一台 Lightsail 上保留两个 backend 槽位：`blue` 和 `green`
- 两个槽位绑定不同本地端口，例如：
  - `127.0.0.1:3001`
  - `127.0.0.1:3002`
- Caddy 同时知道两个 upstream，但只把主流量发给当前“活动槽位”
- 部署时总是把新镜像部署到“空闲槽位”
- 空闲槽位 `/health` 通过后，再切换活动槽位
- 切换完成后，再停止旧槽位

这个方案的关键不是“Caddy 自动猜哪一个应该接流量”，而是**部署脚本显式维护活动槽位状态**，避免 Caddy 在两个都健康时随机或轮询分流，导致同一时刻用户访问命中不同版本。

## 架构设计

### 容器布局

当前：

- `db`
- `backend`

目标：

- `db`
- `backend_blue`
- `backend_green`

两个 backend：

- 使用同一个镜像标签
- 使用同一份 `.env.production`
- 连接同一个 Postgres
- 仅端口不同

建议端口：

- `backend_blue` -> `127.0.0.1:3001:3001`
- `backend_green` -> `127.0.0.1:3002:3001`

容器内进程仍监听 `3001`，宿主机用不同映射区分槽位。

### 活动槽位状态

服务器本地新增一个小状态文件：

```text
~/roselet/.active_backend_slot
```

可能值：

- `blue`
- `green`

部署脚本启动时：

1. 读取当前活动槽位
2. 推导空闲槽位
3. 把新镜像部署到空闲槽位
4. 健康通过后切换 `.active_backend_slot`
5. 停掉旧槽位

如果状态文件不存在：

- 默认以 `blue` 为首次槽位
- 首次部署后写入活动槽位

### Caddy 路由策略

关键要求：

- Caddy 必须知道两个 upstream
- 但正常情况下只能把请求导向当前活动槽位

推荐方式：

1. 由部署脚本渲染 `/etc/caddy/Caddyfile`
2. 根据 `.active_backend_slot` 生成不同的 upstream 顺序或不同的 route
3. reload Caddy 时切换主 upstream

示意：

```caddyfile
(roselet_backend_blue_primary) {
    reverse_proxy 127.0.0.1:3001 127.0.0.1:3002 {
        lb_policy first
        health_uri /health
        health_interval 2s
        health_timeout 1s
    }
}

(roselet_backend_green_primary) {
    reverse_proxy 127.0.0.1:3002 127.0.0.1:3001 {
        lb_policy first
        health_uri /health
        health_interval 2s
        health_timeout 1s
    }
}
```

含义：

- 当前活动槽位排在第一个
- 空闲槽位排在第二个，作为短暂 fallback
- 如果主槽位异常，Caddy 仍可快速尝试备用槽位

这里的关键是 `lb_policy first`，而不是 round robin。这样在两个都健康时，流量稳定命中主槽位，不会混流。

### 健康检查

健康检查分两层：

1. **部署脚本主动检查**
   - 直接探测 `http://127.0.0.1:<slot-port>/health`
   - 只有通过后才允许切换活动槽位

2. **Caddy upstream 健康检查**
   - `health_uri /health`
   - `health_interval 2s`
   - `health_timeout 1s`

作用区分：

- 部署脚本负责“切流前确认新槽位可用”
- Caddy 负责“运行时快速绕开刚刚失活的主槽位”

## 发布流程

### 正常发布

1. 读取 `.active_backend_slot`
2. 计算 `idle_slot`
3. 拉取新镜像
4. 启动 `idle_slot`
5. 轮询 `http://127.0.0.1:<idle-port>/health`
6. 新槽位健康后，更新 `.active_backend_slot`
7. 根据新活动槽位渲染 Caddy 配置并 reload
8. 等待公网健康检查稳定通过
9. 停止旧槽位
10. 更新 `.current_backend_image`

### 回滚

如果新槽位启动失败：

- 不切换 `.active_backend_slot`
- 不 reload Caddy
- 旧槽位继续承接流量

如果新槽位启动成功但切流后公网探测失败：

1. 立即把 `.active_backend_slot` 改回旧槽位
2. 重新渲染并 reload Caddy
3. 停止失败的新槽位
4. 保留 `.previous_backend_image`

### 首次部署

首次没有双槽位状态时：

- 启动 `blue`
- 写 `.active_backend_slot=blue`
- Caddy 使用 `blue_primary`

## 文件改动设计

### 1. `deploy/lightsail/docker-compose.backend.yml`

从一个 `backend` 服务改为：

- `backend_blue`
- `backend_green`

共享：

- 相同镜像
- 相同环境变量
- 相同数据库依赖

不同：

- 宿主机端口绑定
- 容器名/服务名

### 2. `deploy/lightsail/Caddyfile`

从单 upstream 改为：

- 带 `lb_policy first`
- 带 `health_uri`
- 允许通过模板或脚本切换主槽位顺序

这里建议不要手写两个完全独立的成品文件，而是：

- 保留一个模板文件，带明显的主槽位占位
- 部署脚本渲染最终 `/etc/caddy/Caddyfile`

### 3. `scripts/lightsail-deploy.sh`

这是本轮核心改动点。

新增职责：

- 读取/初始化 `.active_backend_slot`
- 计算空闲槽位
- 只启动空闲槽位
- 轮询新槽位健康
- 渲染活动槽位对应的 Caddy 配置
- reload Caddy
- 探测公网健康
- 停止旧槽位

### 4. `docs/AWS_LIGHTSAIL_DEPLOYMENT.md`

新增：

- 蓝绿部署说明
- 当前活动槽位文件说明
- 手动回滚命令
- 如何单独检查 `blue` / `green` 槽位

### 5. `AGENTS.md` / `CLAUDE.md`

补充新的非显然约束：

- 生产 backend 不再是单槽位
- 不允许直接只操作某个旧的单 `backend` 服务名
- 任何运维命令都必须先确认当前活动槽位

## 错误处理

### 新槽位启动失败

- 不切流
- 保持旧槽位在线
- 输出新槽位日志
- workflow 失败

### Caddy reload 失败

- 不停止旧槽位
- 活动槽位文件回滚
- 输出 `caddy validate` / `systemctl status caddy`

### 公网健康检查失败

- 回滚活动槽位
- reload Caddy 回旧配置
- 停止新槽位
- workflow 失败

### 两个槽位都不健康

- 视为严重生产事故
- 保留日志和镜像信息
- 不自动做进一步 destructive 操作

## 测试与验证

### 本地/仓库级验证

- `bash -n scripts/lightsail-deploy.sh`
- `docker compose -f deploy/lightsail/docker-compose.backend.yml config`
- `caddy validate --config deploy/lightsail/Caddyfile --adapter caddyfile`（如果本机有 Caddy）

### 服务器级验证

- 启动空闲槽位并探测：

```bash
curl http://127.0.0.1:3001/health
curl http://127.0.0.1:3002/health
```

- 验证活动槽位：

```bash
cat ~/roselet/.active_backend_slot
```

- 验证公网：

```bash
curl -i https://roselet.47.131.238.0.sslip.io/health
curl -i 'https://roselet.47.131.238.0.sslip.io/api/garden?page=1&per_page=3'
```

### 受控发布验证

发布新镜像时做连续探测：

```bash
for i in $(seq 1 80); do
  curl -sS -o /tmp/health.out -w '%{http_code}\n' --max-time 2 \
    https://roselet.47.131.238.0.sslip.io/health
  sleep 1
done
```

成功标准：

- 不出现 `502`
- 理想状态是不出现连接错误
- 允许极少数高延迟，但不应持续

## 风险

### 共享数据库 schema 风险

蓝绿切换只能降低应用切流抖动，不能自动解决：

- 新旧版本同时连同一个数据库
- schema 不兼容 migration

因此发布约束仍需保留：

- 先确保 migration 向后兼容
- 已发布 migration 只能追加，不能改旧文件

### 单机资源压力

同机双槽位意味着切换窗口内会短暂运行两个 backend 容器。

风险：

- Lightsail `micro_3_0` 内存更紧

缓解：

- 切换完成后尽快停旧槽位
- 保持 release 二进制体积受控
- 必要时观察 swap / OOM 记录

### Caddy 配置复杂度提高

从单 upstream 升级到蓝绿后：

- 运维需要理解主槽位/备槽位
- 手工命令更容易误操作

缓解：

- 所有手工步骤文档化
- 统一通过 `scripts/lightsail-deploy.sh` 操作
- 明确禁止绕过活动槽位文件直接乱切

## 分阶段实施

### 第 1 阶段

- 引入双槽位 compose
- 引入活动槽位文件
- 部署脚本支持“先起后切再停”
- Caddy 按主槽位优先 + 备用槽位 fallback

### 第 2 阶段

- 做受控发布验证
- 记录是否还存在 TLS handshake failure / timeout

### 第 3 阶段

- 如果仍有短抖动，再评估是否把 Caddy reload 影响降到更低
- 若单机内仍无法满足要求，再重新评估双机方案

## 结论

在“单机内完成、尽量不加钱”的前提下，Roselet 后端发布要继续逼近零中断，最合理的路线是：

- 不再继续堆单实例重试
- 改成**单机蓝绿切换**
- 由部署脚本显式维护活动槽位
- 由 Caddy 对活动槽位优先转发、对备用槽位保留健康 fallback

这是一条工程复杂度和稳定性最平衡的路线，值得进入实现阶段。
