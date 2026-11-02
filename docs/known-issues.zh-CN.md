# 已知问题

记录当前**尚未在代码层面解决**的问题。每条都注明证据强度：哪些是实际观察到的，哪些只是推断。

日期：2026-11-03（北京时间）。对应版本：`v0.3.1`。

## 1. 不开 `/goal` 模式时，回合会在一两分钟后自动结束

**状态：未修复。已观察到症状，根因待确认。**

### 现象

在普通对话里让它干一件稍长的活，大约一到两分钟后输出就停了，必须手动发「继续」才接着干。换成 `/goal` 模式则能一直做下去。

因为 `/goal` 会自动续下一轮，这个中断在那种模式下被掩盖了——所以「必须开 goal 模式才能干活」这个体验是可以复现的。

### 已知的证据

- 本机 `~/.dsh/profiles/desktop/cordis.patch.yml` 里 `agent-default-model` 是 `provider: qoder-cn`、`model: deepseek-v4-flash`、`reasoningEffort: max`。
- 同一文件里 `llm-qoder` 只设了 `showSidebarQuota: true`，**没有**设 `maxTokens`，因此走默认 `32768`。
- 适配器把这个值同时作为 `parameters.max_tokens` 和 `model_config.max_output_tokens` 发出去。
- `reasoningEffort: max` 时，思考 token 计入 `completion_tokens`，即占用的是同一份输出预算。

### 目前的推断（**尚未实测确认**）

当上游返回 `finish_reason: "length"` 时，`translate.ts::mapFinishReason` 给出 `{ kind: 'max-tokens' }`。DSH 的 `BlockAssembler` 在 `max-tokens` 下会**丢弃被截断的工具调用**，于是这一步没有可执行的东西，回合就此结束——表现就是「干到一半停了」。

如果这个推断成立，那么 32768 的输出预算在 `reasoningEffort: max` 下被思考吃掉大半，正文和工具调用先撞上限，一两分钟正好烧完。

**没有确认的原因**：需要读取某次真实请求的 `finish_reason` 才能定案。本仓库的验证脚本不记录它，会话日志里也没有留存这个字段（`defaultMaxTokens` / `"maxTokens":<数字>` 在 `~/.dsh/storages` 里搜不到）。

### 已排除的方向

- **不是 `streamIdleTimeoutMs`。** 默认 `300000`（5 分钟），且 profile 里没有覆盖，与一两分钟不符。
- **不是 DSH 的请求超时。** 在 DSH 打包产物里检索 `requestTimeoutMs` / `idleTimeoutMs`，只找到 `idleTimeoutMs` 默认 `600000`，没有 1–2 分钟量级的限制。
- **不是 `max_turn_requests`。** 它只出现在打包的 ACP 协议 schema 里，不是 DSH 的配置项。

### 可以试的办法（按可靠性排序）

1. **降低思考强度。** 把 `reasoningEffort` 从 `max` 降到 `high`。这是最直接的一招：同样 32768 的预算，思考少占一些，正文和工具调用就能多跑一会儿。
2. **抬高输出上限。** 设置 → 模型 → `qoder-cn` → **最大输出 token 数**，从 32768 往上调（先试 65536）。注意有天花板：
   - 输出 token 与输入 token **共享上下文窗口**。`deepseek-v4-flash` 的窗口是 128K，输出不可能超过它。
   - 真正的上限是该模型在目录里自己报的 `max_output_tokens`。填超了，网关要么直接 `400`，要么静默截断。
   - **不要填 1M。** 128K 窗口装不下，必然失败。
3. **用 `/goal` 模式跑长任务。** 现阶段这是最稳的绕法——它不是修复，只是让 DSH 自动续轮。

### 怎么确认

`performanceUsage: detailed` 打开后，看停下来的那一步 output token 数：

- 正好贴在 32768（或你设置的上限）→ 就是输出预算撞顶，按上面第 1、2 条处理。
- 离上限还远却停了 → 推断不成立，需要换方向排查，请把当时的设置和现象开成 issue。

## 2. COSY 签名与网关协议是跟客户端走的

**状态：长期风险，无法提前消除。**

适配器复刻的是 qodercli 的请求形态：COSY 签名头、`Encode=1` 的 WAF 编码正文、双层 SSE 信封，以及 `/algo/api/v2/model/list` 的目录格式。这些都是**从客户端逆向得到的事实**，不是公开契约。

Qoder 更新客户端或调整网关时，这些可能一起变，届时需要同步适配。当前能做的只有：`npm test` 覆盖协议解析层，CI 每次提交都跑；真实链路可用 `node scripts/check-live.mjs --live` 验证（需要 `QODERCN_PERSONAL_ACCESS_TOKEN`，只做一次短请求、不打印凭据）。

> 注意：`check-live.mjs --stored-pat` 会去读 `~/.dsh/.credentials.yaml`。除非你确实想用它，否则优先用环境变量那条路径。

## 3. `tagcheck` profile 里躺着一份 0.2.0 的旧拷贝

**状态：环境残留，不影响 `main`。**

`~/.dsh/profiles/tagcheck/node_modules/dsh-provider-qoder` 是一份**真实的**（非软链）`0.2.0` 拷贝，没有容量设置界面。`desktop` 和 `qqbot` 都正确软链到 `D:/plugins/dsh-provider-qoder`。

如果哪天切到 `tagcheck`，会看不到「模型与容量」分区——那不是 bug，是那份旧拷贝。清掉或重新链接即可。
