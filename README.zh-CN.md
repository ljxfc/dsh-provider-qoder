# dsh-provider-qoder

[English](README.md) · **简体中文**

面向 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的 Qoder CN 提供方插件。它保留了 Qoder 的 PAT 换取、COSY 签名、WAF 编码、SSE 传输，以及实时模型目录。提供方路由为 `qoder-cn`。

主要目标版本是 DeepSeek Harness Desktop `v0.2.0-rc.2`（`dsh 0.2.0-rc.2`），声明为 `engines.dsh: ^0.2.0-rc.2`。

## 在 DeepSeek Harness Desktop 中安装

使用 Desktop 的插件管理器：

1. 打开 **Plugins**（插件）。
2. 选择 **Add plugin**（添加插件）。
3. 填入 `https://github.com/ljxfc/dsh-provider-qoder`。
4. 安装该包；若 `dsh-provider-qoder` 尚未启用，请打开这个新 bundle。
5. 打开 **Models**（模型），其中应能看到 `qoder-cn` 提供方。

这条 GitHub 安装路径就是 Desktop 的推荐流程。插件包声明了 `dsh.bundle.patch`，并自带构建产物 `dist/index.js`，因此 Desktop 不需要保持 `qodercn` 进程运行。

该包声明了**零运行时依赖**，而且构建产物已提交进仓库，所以安装它只新增一个包、不执行构建、也不拉取别的任何东西：它发布的六个文件就是插件的全部。带 tag 的版本列在 **Releases** 下，当前为 `v0.2.0`。

如果要测试尚未推送的本地副本，Desktop 的 **Add plugin** 对话框也接受绝对目录路径，例如 `D:\plugins\dsh-provider-qoder`。

## PAT 配置

在 **Models** 中打开 `qoder-cn` 那一行的 **Edit** 卡片后，把 PAT 粘贴进 Qoder 卡片并点击 **Save**。客户端扩展会通过 DSH 凭据服务以 `QODERCN_PERSONAL_ACCESS_TOKEN` 写入；PAT 不会被写进设置文档。

如果客户端卡片不可用，可以在启动或重启 Desktop 之前，在启动环境里配置 Qoder PAT：

```powershell
# 必须先完全关闭 Desktop。`$env:` 只会被本 PowerShell 进程启动的子进程继承。
Get-Process -Name 'DeepSeek Harness' -ErrorAction SilentlyContinue | Stop-Process
$env:QODERCN_PERSONAL_ACCESS_TOKEN = 'pt-your-qoder-pat'
Start-Process 'D:\DeepSeek Harness\DeepSeek Harness.exe'
```

若要在 Windows 上长期生效，可在 **Windows 设置 → 系统 → 关于 → 高级系统设置 → 环境变量 → 用户变量** 里添加同名同值，然后完全重启 Desktop。推荐用 Models 卡片的方式，因为它把 PAT 存进 DSH 凭据服务，而不会把密钥留在进程环境里。

提供方会先查已存储的凭据，再查启动环境。`QODERCN_PAT` 是可用的别名；`QODER_API_KEY` 仅在其值以 `pt-` 开头时可用。不要把 Qoder 的 job token（`jt-...`）当作 PAT 使用。

公网 CN 云不需要任何端点设置。企业 VPC 则需在启动 Desktop 前于启动环境中设置 `QODER_VPC_INSTANCE`，或通过当前生效的 DSH 配置提供对应的 `llm-qoder` profile 键值。

## 适用范围

适配器绑定的是**账号**，而不是组织、租户或套餐。它需要一个 Qoder CN 个人访问令牌和一个可达的端点；此后每个请求都携带该令牌自身的身份与套餐。

- **账号** —— 任何能签发 PAT 的 Qoder CN 账号：个人（免费或付费）、团队、企业。模型选择器列出的是该账号在实时目录中能取到的模型，聊天链路对它们完全相同。
- **部署形态** —— 默认走公网 CN 云（`gateway.qoder.com.cn`、`openapi.qoder.com.cn`）。**团队版与企业版套餐同样由该云提供服务**：团队成员账号无需任何额外配置，也就是下面已验证的那条路径。私有 VPC 租户通过设置 `QODER_VPC_INSTANCE`（别名 `QODER_VPC_ENDPOINT`、`QODERCN_VPC_ENDPOINT`、`QODERCN_CLI_VPC_ENDPOINT`）或提供方的 `baseURL`/`openApiUrl` 选项支持；gateway、openapi 与控制台主机名由实例名推导。
- **套餐差异只影响额度相关的界面，并且会降级显示。** 套餐、网关额度池与加油包余额是分别读取的：三者中只要有一个能返回，报告就能渲染，只有三者全部失败才算错误。套餐未开放的额度池会显示为未启用，而不是缺失；加油包卡片只在有余额时出现。
- **PAT 展示的是该令牌自身的视图** —— 它的个人额度池，以及其组织启用了组织池时的组织额度池。组织管理员的令牌会从同样的端点返回管理员自己的身份与额度池；面板打印服务返回的身份，而不假设某个角色。

### 已验证 / 未验证

公网 CN 云这条路径已用一个真实的团队账号端到端验证（Teams 套餐、组织成员、零 VPC 配置）。私有 VPC 路径已经实现——包括端点推导——但尚未在真实租户上跑过，免费或个人账号同样未验证。请把这两者视为未经测试：一旦出问题，把收到的响应开成 issue 是最快的修复方式。

## 套餐与额度

客户端部分可以在两处展示 Qoder CN 的套餐与积分用量。

- **侧边栏卡片** —— 位于 **Settings**（设置）正上方的一个底栏入口。默认关闭；在 **Settings → `qoder-cn` 提供方 → 集成与显示 → 在侧边栏显示额度卡片** 中打开（即 `showSidebarQuota` 设置）。关闭时它不渲染任何内容，也不会在后台轮询额度。卡片会跟随侧边栏自身的形态：侧边栏折叠成窄栏时是一个 36px 的进度环，展开时则是完整卡片——进度环、套餐档位、已用/总量积分、进度条、重置时间。
- **额度面板** —— 点击卡片即可在中栏打开。它列出计费周期、该账号的积分池，以及重置倒计时。`×` 会回到对话；打开面板不会切换会话。

这两个界面都读取套餐额度服务（`/api/v2/user/plan`、`/api/v2/quota/usage`、`/api/v1/me/usage`）。未配置 PAT 时会如实报告这一状态，而不是报错。Qoder CN 每个计费周期只报告一个积分池，也不提供滚动的 5 小时或每周窗口，因此这些界面只展示周期额度。

## 模型与传输

省略 `models` 时，适配器会签名并拉取 Qoder 的实时目录 `/algo/api/v2/model/list`。已知的 wire key 会保留稳定的选择器 id，例如 `gm51model` → `glm-5.2`；新返回的 key 仍可用其 wire id 直接选用。静态 `models` 列表是一个可选的完整覆盖。

模型发现与聊天请求都走提供方自己的连接。`qodercn` CLI 不需要保持运行。

## CLI / 开发用途

对 DSH CLI 或源码检出，等价的包操作是：

```sh
dsh plugin --profile web add https://github.com/ljxfc/dsh-provider-qoder
```

它本质上是在该 profile 里执行 `pnpm add`，因此可以用包说明符锁定版本——已针对 `v0.2.0` 端到端验证：

```sh
dsh plugin --profile <profile> add github:ljxfc/dsh-provider-qoder#v0.2.0
```

两种写法都会把该包记入 profile 的 `dsh.profile.bundles`，因此 bundle 会在下次启动时启用，不需要第二步操作。

这是开发 / CLI 的替代路径；Desktop 用户请用 **Plugins → Add plugin**。

## 卸载

在 Desktop 中，从 **Plugins** 里禁用并移除该 bundle。CLI：

```sh
dsh plugin --profile web remove dsh-provider-qoder
```

## 许可证

MIT
