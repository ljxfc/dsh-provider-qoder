# dsh-provider-qoder

Qoder CN provider plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). It keeps Qoder's PAT exchange, COSY signing, WAF encoding, SSE transport, and live model catalog. The provider route is `qoder-cn`.

The primary target is DeepSeek Harness Desktop `v0.2.0-rc.2` (`dsh 0.2.0-rc.2`), declared as `engines.dsh: ^0.2.0-rc.2`.

## Install in DeepSeek Harness Desktop

Use the Desktop plugin manager:

1. Open **Plugins**.
2. Select **Add plugin**.
3. Enter `https://github.com/ljxfc/dsh-provider-qoder`.
4. Install the package, then enable the new `dsh-provider-qoder` bundle.
5. Open **Models**. The `qoder-cn` provider should be listed there.

This GitHub install path is the intended Desktop flow. The plugin package declares `dsh.bundle.patch` and includes the generated `dist/index.js`, so Desktop does not need a running `qodercn` process.

To test an unpushed working copy, Desktop's **Add plugin** dialog also accepts an absolute local directory such as `D:\plugins\dsh-provider-qoder`.

## PAT configuration

After opening the `qoder-cn` row's **Edit** card in **Models**, paste the PAT into the Qoder card and click **Save**. The client extension writes it through the DSH credentials service under `QODERCN_PERSONAL_ACCESS_TOKEN`; the PAT is not written to the settings document.

If the client card is unavailable, configure the Qoder PAT in the launch environment before starting or restarting Desktop:

```powershell
# Desktop must be fully closed first. `$env:` is inherited only by children
# started from this PowerShell process.
Get-Process -Name 'DeepSeek Harness' -ErrorAction SilentlyContinue | Stop-Process
$env:QODERCN_PERSONAL_ACCESS_TOKEN = 'pt-your-qoder-pat'
Start-Process 'D:\DeepSeek Harness\DeepSeek Harness.exe'
```

For a persistent Windows setup, add the same name/value under **Windows Settings → System → About → Advanced system settings → Environment Variables → User variables**, then fully restart Desktop. The Models card is preferred because it stores the PAT in the DSH credentials service without putting the secret in the process environment.

The provider checks the stored credential first and then the launch environment. `QODERCN_PAT` is an accepted alias; `QODER_API_KEY` is accepted only when its value starts with `pt-`. Do not use a Qoder job token (`jt-...`) as the PAT.

Public CN cloud needs no endpoint settings. For an enterprise VPC, set `QODER_VPC_INSTANCE` in the launch environment before starting Desktop, or provide the corresponding `llm-qoder` profile value through the active DSH configuration.

## Plans and quota

The client half can show Qoder CN's plan and credit usage in two places.

- **Sidebar card** — a footer entry directly above **Settings**. It is off by default; turn it on under **Settings → the `qoder-cn` provider → 集成与显示 → 在侧边栏显示额度卡片** (the `showSidebarQuota` setting). While it is off, nothing renders and no background quota poll runs. The card follows the sidebar's own form: a 36px progress ring in the collapsed rail, and the full card — ring, plan tier, used/total credits, progress bar, reset time — when the sidebar is expanded.
- **Quota panel** — click the card to open it in the center column. It lists the billing cycle, the account's credit pools, and the reset countdown. The `×` returns to the conversation; opening the panel does not switch sessions.

Both surfaces read the plan quota service (`/api/v2/user/plan`, `/api/v2/quota/usage`, `/api/v1/me/usage`). A plan with no configured PAT reports that state instead of an error. Qoder CN reports a single credit pool per billing cycle and publishes no rolling 5-hour or weekly window, so the surfaces show the cycle only.

## Models and transport

When `models` is omitted, the adapter signs and fetches Qoder's live catalog from `/algo/api/v2/model/list`. Known wire keys retain stable selector ids such as `gm51model` → `glm-5.2`; newly returned keys remain addressable under their wire id. A static `models` list is an optional complete override.

Model discovery and chat requests use the provider's own connection. The `qodercn` CLI does not need to stay running.

## CLI/development alternative

For a DSH CLI or source checkout, the equivalent package operation is:

```sh
dsh plugin --profile web add https://github.com/ljxfc/dsh-provider-qoder
```

This is a development/CLI alternative; Desktop users should use **Plugins → Add plugin**.

## Remove

In Desktop, disable and remove the bundle from **Plugins**. For the CLI:

```sh
dsh plugin --profile web remove dsh-provider-qoder
```

## License

MIT
