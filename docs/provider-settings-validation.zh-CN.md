# 容量设置与前端改版验收

日期：2026-11-03（北京时间）。实现分支：`feat/capacity-settings-ui`。

## 改动与核心数据流

设置卡片 → `client/settings.ts` 的带版本写入 → Host 的 `llm-qoder` → `index.ts::resolveAdapterOptions` → `capacity.ts::resolveCapacity` → DSH 模型预算 / Qoder 请求。

- 上下文：自动、128K、200K、256K、500K、1M、自定义；支持提供商默认与按模型覆盖。
- 输出：自动、8192、16384、32768、65536、131072、自定义；实际值受已知上限与上下文空间约束。
- `modelLimits` 在根配置与提供商 profile 之间按模型、按字段继承；恢复自动不删除上层配置。
- 支持的上下文档位写入 `parameters.context_length`；未声明档位只改变本地预算，详情及模型选择器明确标注。
- 设置读取失败禁写；冲突重读重试一次；成功后核对 Host 回读；旧响应不覆盖新状态。
- 额度刷新失败保留最后一次成功报告和时间。PAT 不进入设置文档或前端回显。
- 未增加运行时依赖。保留 DSH 原生设置、模型选择器、侧栏与面板入口。

## 当前证据

| 项目 | 结果与证据 |
| --- | --- |
| 自动化 | `npm test`：84/84 通过，覆盖配置继承、上下文档位、输出请求、旧调用兼容、设置冲突/只读/失败回读、额度保留与流式回归 |
| 浏览器组件流程 | Playwright 驱动真实 React 组件和 controller；保存500K、1M、输出8192、自定义750000、负数拒绝、刷新持久化、恢复自动、只读、拒绝保存回滚、额度失败保留、面板返回均通过 |
| 呈现 | 中英、浅深色、390px窄屏、侧栏折叠/展开；组件容器无横向溢出，截图已实际查看 |
| 实际 Host 挂载 | 使用已安装 Desktop 自带的 DSH **0.2.1-rc.5** 启动独立 `qoder-validation` profile，插件从当前 checkout 加载，真实 Models 页面显示新卡片，`qoder/models` 能返回能力数据 |
| 实际 Host 持久化 | 页面选择500K→1M、输出8192；Host 写入独立 profile 的 `cordis.patch.yml`；刷新页面后仍为1M/8192。没有改日常 profile |
| 独立适配器真实网关 | 账号目录返回10个模型；`qwen3.8-flash` 声明200000/400000/1000000，选择1M、输出64，一次短请求返回 `OK`，完成事件存在 |
| 完整 DSH 对话 | 独立真实 Host 通过进程环境取得既有PAT，选择 Qwen3.8-Flash，继承已保存的1M/8192设置，发送“Reply exactly OK. Do not use tools.”，收到 `OK.` 且会话显示已完成 |
| 打包 | 构建产物 `dist/index.js`、`dist/client.js` 更新；打包范围包含产物与说明，不包含测试profile、日志或任何凭据 |
| 审查 | 两轮独立审查，已修复目录故障阻断旧生成、虚构档位、覆盖继承丢失、能力来源错误与订阅漏更新；复审未发现其他实质性阻断问题 |

截图在本地忽略目录 `output/playwright/`：

- `settings-light-zh.png`、`settings-dark-en.png`、`settings-dark-narrow-zh.png`、`quota-light-zh.png`：合成账户组件验收，不含真实密钥。
- `actual-host-settings.png`、`actual-host-model-details.png`：真实 Host 设置界面。
- `actual-host-live-response.png`：真实 DSH 对话结果。
- `output/validation/live-gateway.json`：不含凭据的独立网关测试结果。

Host 视图截图采用桌面尺寸；390px检查的是插件组件容器，不代表 DSH 自身设置导航在手机宽度下也适配。

## 协议证据与边界

对本机 Qoder CN CLI 1.1.64 的静态检查定位到实际请求构造：

```js
if(c?.contextWindow!==void 0&&UE(O,c.contextWindow))
  U.context_length=c.contextWindow;
// 同一构造函数返回 parameters: U, model_config: g
```

可执行文件 SHA-256：`04ea27ed4e51dd440e282c01984e887d1e172cc1a1364ca97f2bb0995e16df42`，定位偏移 `163984096`。CLI 的验证函数优先校验 advertised windows；插件只对明确声明的档位发送该字段，避免把普通回退值误当作可选档位。

模型 `context_config` 的默认值、所有档位与 `max_input_tokens` 分开理解。没有档位信息时，现有代码将 `max_input_tokens` 作为保守的总历史预算回退，不把输出上限加上去、不把它标为可协商档位；这可能提前压缩，不能据此推断精确的输入输出合计能力。

短请求验证了1M档位的协议接受，不代表送入完整百万token、长期稳定性或每个模型/套餐均支持1M。500K在本次选用模型的目录中并未声明，因此只验证本地选择/持久化/警告，不声称其服务端支持。真实端到端使用公网CN团队账号；私有VPC、免费/个人账户和其他Desktop版本本次未新增实测。

原桌面进程保持运行；测试使用独立 DSH_HOME。真实PAT仅由原凭据读取到内存，再通过测试进程环境传入，未写入测试凭据文件。测试进程在验收后关闭。未发布npm或GitHub版本。

## 复现

```powershell
npm test
npm pack --dry-run

# 临时开发依赖，不写入插件 package.json：
npm install --prefix "$env:TEMP/dsh-qoder-ui-validation" --no-package-lock --ignore-scripts react@18.3.1 react-dom@18.3.1
node scripts/preview-ui.mjs
# 另一终端：
npx --yes --package @playwright/cli playwright-cli -s=qoder-validation open http://127.0.0.1:47831
npx --yes --package @playwright/cli playwright-cli -s=qoder-validation run-code --filename=scripts/check-ui.browser.js

# 可选，允许一次真实短请求；PAT从既有环境读取，不打印：
node scripts/check-live.mjs --live
# 仅在本机凭据文件中能唯一找到Qoder PAT时，才可显式选择：
node scripts/check-live.mjs --live --stored-pat
```

真实 Host 流程：启动独立测试 profile并通过当前checkout加载插件 → 模型 → Qoder卡片。`scripts/check-host-settings.browser.js` 需要先处于该页面；它只更改隔离profile中的测试容量设置，不能对日常profile直接执行。账号、端点与 profile 路径因设备而异，不复制本机认证地址。

## 学习检查点

- **A级：** `capacity.ts::resolveCapacity`（容量优先级）与 `selectedGatewayContext`（本地预算到服务端协议的边界）、`adapter.ts` 的模型解析与请求构造。
- **B级：** `client/settings.ts` 的版本写入和回读、`client/capacity.tsx` 的有效值/本层值区别、`usage-wire.ts` 的只读能力协议。
- **C级：** CSS、构建、预览脚本，出问题时查即可。

小练习（约10分钟）：保持模型级覆盖不变，只修改提供商默认上下文，再恢复模型自动；观察“覆盖来源”、有效值和请求档位怎样变化。最后选500K，对比目录中是否存在该档位，解释为什么保存成功仍可能显示本地预算警告。
