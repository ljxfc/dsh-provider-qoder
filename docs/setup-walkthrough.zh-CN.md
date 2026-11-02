# 接入全过程：从一个跑不通的仓库到日常在用

这份记录不是事后追写的教程，而是倒推出来的操作日志：每一步都能在
`~/.dsh/profiles/desktop/.plugin-manager/logs/` 的 pnpm 日志或仓库提交历史里找到对应记录。
时间戳取自本机，格式 `YYYY-MM-DD HH:MM`。

---

## 0. 起点

| 东西 | 位置 |
|---|---|
| DSH 桌面版 | `D:\DeepSeek Harness`（当时 `0.1.7-rc.2`，现在 `0.2.1-rc.5`） |
| 用户 profile | `C:\Users\<你>\.dsh\profiles\desktop` |
| 插件源码 | `D:\plugins\dsh-provider-qoder` |
| 令牌 | Qoder CN 个人访问令牌（`pt-...`） |

起点状态不是「装个插件」，而是「仓库里的代码在当时的 DSH 上根本走不通」——路由注册了、模型拉不出来、请求签名对不上。所以第 1～4 步是「先让它能用」，第 5 步之后才是「配置」。

---

## 1. 第一次安装：从 GitHub 装（09-29 16:17:00）

**打开**：Plugins（插件）→ Add plugin（添加插件）→ 填 `https://github.com/ljxfc/dsh-provider-qoder`

日志实证：

```
+ dsh-provider-qoder github:ljxfc/dsh-provider-qoder
```

装是装上了，但**这一步之后它并不能用**。原因是远端那份代码还没对齐当时的 DSH 版本。这一步的价值是：确认了 DSH 能从一个仓库地址把插件拉下来并登记进 profile。

---

## 2. 改成本地目录（09-29 16:34:16 → 16:34:22）

九分钟内先删后装，两条日志紧挨着：

```
- dsh-provider-qoder github:ljxfc/dsh-provider-qoder     ← 卸掉 GitHub 来源
+ dsh-provider-qoder link:D:/plugins/dsh-provider-qoder  ← 换成指向本地源码目录
```

**这是整件事的分水岭。** 换成 `link:` 之后，profile 里那个包不再是快照，而是指向源码目录的符号链接：

- 改 `src/**` → `node scripts/build.mjs` → **重载窗口**，新界面就生效（浏览器那一半 `dist/client.js` 是每次窗口加载时重新取的）
- 改 host 那一半（`dist/index.js`）→ 需要重启 DSH 进程
- 不用再「删了重装」一次

后来的事实也证明了这点：profile 里至今是 `link:D:/plugins/dsh-provider-qoder`，而 GitHub 那条早已不在。

---

## 3. 三个来回的重装（16:50、16:58、17:03）

日志里还有三组 `-` / `+`，全是 `link:` 对 `link:`：

```
16:50:51  - link:...     16:50:56  + link:...
16:58:00  - link:...     16:58:07  + link:...
17:03:18  - link:...     17:03:22  + link:...
```

当时以为「重装一下才生效」，其实在第 2 步之后这一步就是多余的。**结论：`link:` 装好以后，重装没有意义，只有构建 + 重载/重启有意义。**

---

## 4. 把路由真正跑通（09-29 22:03 提交）

```
8d725b1  fix: make the Qoder route work end to end in dsh v0.1.7-rc.2
```

修的是链路本身：PAT 换取与刷新、COSY 请求签名、WAF 响应编码、SSE 流式解码、模型目录拉取。这一步之后，「在 Models 里能看到 `qoder-cn` 且能真正对话」才成立。

---

## 5. 配 PAT

（令牌本身怎么创建，见第 12 节第 4 步；这里只说填到哪。）

有两个入口，**首选界面那个**：

**① Models（模型）→ `qoder-cn` 那一行 → Edit → 粘贴 → Save**

凭据写进 DSH 凭据服务，键名 `QODERCN_PERSONAL_ACCESS_TOKEN`，落盘在 `~/.dsh/.credentials.yaml`。
好处是：令牌在凭据服务里，不进设置文档、不进进程环境。

**② 兜底：启动环境变量**

```powershell
Get-Process -Name 'DeepSeek Harness' -ErrorAction SilentlyContinue | Stop-Process
$env:QODERCN_PERSONAL_ACCESS_TOKEN = 'pt-...'
Start-Process 'D:\DeepSeek Harness\DeepSeek Harness.exe'
```

两个坑记一下：

- 只认 `pt-` 开头的**个人访问令牌**。`jt-` 开头的是 job token，填进去会在换取环节失败。
- `$env:` 只被本进程启动的子进程继承 —— 所以必须「先关掉再从这个窗口启动」，改成系统环境变量要**完全退出**（含托盘）后重开。

---

## 6. 让额度卡片出现（默认是关的）

**打开**：设置（Settings）→ `qoder-cn` 提供方 → **集成与显示** → **「在侧边栏显示额度卡片」**

落盘实证（`profiles/desktop/cordis.patch.yml`）：

```yaml
- id: llm-qoder
  name: dsh-provider-qoder
  config:
    showSidebarQuota: true
```

三个要点：

- **默认关**。关着时不渲染任何 DOM，也不起后台轮询 —— 这是刻意的，插件不该在你没要求的时候联网。
- 卡片落在侧边栏底栏、**Settings 齿轮正上方**。
- 卡片会跟随侧边栏形态：折叠成窄栏时是一个 36px 的进度环，展开时是整张卡片（环 + 套餐档位 + 已用/总量 + 进度条 + 重置时间）。

---

## 7. 点开面板（09-30 14:20 那一版）

点卡片 → 在中栏打开面板：计费周期、账号的积分池、重置倒计时。
右上 `×` 回到对话流，**不切换会话**（切会话会丢上下文，这个细节是刻意做的）。

---

## 8. 真正「用起来」的标志：默认模型切成 Qoder（09-30 之后）

```yaml
- id: agent-default-model
  config:
    provider: qoder-cn
    model: deepseek-v4-flash
    reasoningEffort: max
```

子代理的 `allowedModels` 里也加了 `qoder-cn / deepseek-v4-flash`。
到这一步它才从「一个装上去看的插件」变成「实际在干活的模型通道」。

---

## 9. 一次失败的产品决策：5h / 7d 滚动窗口

```
09-30 14:35  fca39bf  feat: measure and show rolling usage beside Qoder's monthly pool
09-30 15:09  16274ae  feat(quota-ui): drop the rolling spend windows and rebuild both quota surfaces
```

做了 34 分钟就删了。原因不是不好看，是**它不是服务端数据**：Qoder CN 每个计费周期只报告一个积分池，客户端自己累加出来的「5 小时用量」摆在服务端的月度数字旁边，读者会以为两个数字同源。宁可少一个数字，不要一个会误导的数字。

**残留**：`~/.dsh/qoder-spend.jsonl`（16 KB，最后写入 09-30 15:31）是那版的本地账本，功能删了文件还在，可以安全删除。

---

## 10. 发布出去

```
09-30 15:18  6905128  docs: state the compatibility scope
09-30 15:28  5f5a22e  docs: record the install specifiers that were verified
09-30 15:31  a3276f5  docs: add a Chinese README alongside the English one
10-09 17:19  1c7fe1c  docs: add the NOTICE credit and drop machine-specific paths
10-09 17:21  c232422  chore: release v0.2.1
10-18 18:04  1d00d49  fix(catalog): fallback to known default models when PAT is not yet configured
```

对应 GitHub 上：`v0.2.0` / `v0.2.1` 两个 Release，README 中英双版。

---

## 11. 这台机器现在的实际状态（核对表）

| 项目 | 现状 | 在哪看 |
|---|---|---|
| 装机方式 | `link:D:/plugins/dsh-provider-qoder` | profile `package.json` 的 dependencies |
| bundle 已启用 | `dsh.profile.bundles` 含 `dsh-provider-qoder` | profile `package.json` |
| 额度卡片 | 开 | `cordis.patch.yml` → `llm-qoder.config.showSidebarQuota: true` |
| 默认模型 | `qoder-cn / deepseek-v4-flash / max` | `cordis.patch.yml` → `agent-default-model` |
| PAT 存放 | 凭据服务，键名 `QODERCN_PERSONAL_ACCESS_TOKEN` | `~/.dsh/.credentials.yaml` |
| DSH 版本 | `0.2.1-rc.5`（插件要求 `^0.2.0-rc.2`，满足） | 程序文件版本 |

---

## 12. 换台机器重来一遍（从零到能用）

整件事的入口不是插件，是 **PAT**。没有令牌，插件装得再对也只是一个空的提供方。

### 第 1 步 · 装 DSH
装 DeepSeek Harness 桌面版，`>= 0.2.0-rc.2`（当前在用 `0.2.1-rc.5`）。

### 第 2 步 · 装插件
**Plugins（插件） → Add plugin（添加插件）** → 填仓库地址：

```
https://github.com/ljxfc/dsh-provider-qoder
```

想锁版本就用命令行（它本质是 profile 里的 `pnpm add`）：

```sh
dsh plugin --profile <profile> add github:ljxfc/dsh-provider-qoder#v0.2.1
```

### 第 3 步 · 确认插件是启用状态
Plugins 列表里 `dsh-provider-qoder` 的开关打开（`github:` 方式装完通常自动进 bundle 列表，`link:` 方式可能要自己打开）。

### 第 4 步 · 拿到 PAT ← 最关键的一步

1. 浏览器打开 **https://qoder.cn/**（`https://qoder.com.cn/` 也能开），点 **企业登录**，填自己的学校/公司邮箱（例如交大邮箱），走 SSO 认证登录
2. 登录后进个人主页，左侧栏点 **服务集成**
3. 「个人访问令牌」区块右上角点 **+ 新建令牌**，起个能认出来的名字（例如 `dsh-desktop`），创建
4. **令牌只显示这一次**，立刻复制下来，形如 `pt-xxxxxxxx...`

三条硬规则：

- 必须是 `pt-` 开头的**个人访问令牌**。`jt-` 开头的是 job token，填进去会在换取环节失败。
- 弹窗关掉就再也看不到明文了。丢了不用慌：回同一个页面删掉旧的、建一个新的。
- 过期时间自己定。到期后插件会认证失败，回同一页面再建一个即可；吊销也在这里（行尾的删除按钮）。

### 第 5 步 · 把 PAT 填进插件
**设置 → 模型 → `Qoder CN` 那一行 → 编辑** → 在 **Qoder PAT** 输入框粘贴 → **保存**。

卡片右上角变成「**PAT 已配置**」就说明它已经写进 DSH 凭据服务（键名 `QODERCN_PERSONAL_ACCESS_TOKEN`），不进设置文档、也不进进程环境。

### 第 6 步 · 打开额度卡片
同一张卡片往下 → **集成与显示** → 勾上「**在侧边栏显示额度卡片**」。

默认是关的：关着的时候左侧栏不渲染卡片，也不会在后台刷新额度。

### 第 7 步 · 验收
- 左侧栏底栏、齿轮正上方出现额度卡片（折叠时是进度环，展开是整卡）
- 点开卡片，中栏面板里能读到**计费周期 / 积分池 / 重置倒计时**

这两样都出来，就说明「登录 → 令牌 → 插件 → 额度服务」整条链路通了。

### 第 8 步 · 当主力用
默认模型选 `qoder-cn / deepseek-v4-flash`。

---

**只有要改代码时**，才把第 2 步换成 `link:` 指向本地源码目录（例：`link:D:/plugins/dsh-provider-qoder`）。

---

## 13. 对不上时查这张表

| 症状 | 原因 | 处置 |
|---|---|---|
| Models 里看不到 `qoder-cn` | bundle 没启用，或装完没重启 host | Plugins 里启用；改过 `dist/index.js` 就重启 |
| 能看到提供方但模型列表空 | 令牌没配 / 用了 `jt-` 令牌 / 远端目录没拉到 | 换成 `pt-` 令牌；`1d00d49` 之后有默认模型兜底 |
| 额度区域报「未配置」 | PAT 不在凭据服务也不在启动环境 | 走 Models 卡片的 Edit（第 12 节第 5 步） |
| 侧边栏卡片挤成一条 / 溢出 | 旧版没处理折叠窄栏的 `wide=false` | 已在 `16274ae` 修 |
| 改了界面但没变化 | 只重建了却没重载窗口 | 重载窗口；host 半的改动才需要重启 |
| 面板里显示 5h/7d | 装的是 `fca39bf` 那一版 | 升级到 `v0.2.1`，那两行已删除 |
