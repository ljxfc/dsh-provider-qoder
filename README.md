# dsh-provider-qoder

**English** · [简体中文](README.zh-CN.md)

Qoder CN provider plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). It keeps Qoder's PAT exchange, COSY signing, WAF encoding, SSE transport, and live model catalog. The provider route is `qoder-cn`.

The primary target is DeepSeek Harness Desktop `v0.2.0-rc.2` (`dsh 0.2.0-rc.2`), declared as `engines.dsh: ^0.2.0-rc.2`.

## Install in DeepSeek Harness Desktop

Use the Desktop plugin manager:

1. Open **Plugins**.
2. Select **Add plugin**.
3. Enter `https://github.com/ljxfc/dsh-provider-qoder`.
4. Install the package; if `dsh-provider-qoder` is not already enabled, turn on the new bundle.
5. Open **Models**. The `qoder-cn` provider should be listed there.

This GitHub install path is the intended Desktop flow. The plugin package declares `dsh.bundle.patch` and includes the generated `dist/index.js`, so Desktop does not need a running `qodercn` process.

The package declares **no runtime dependencies** and its build is committed, so installing it adds exactly one package, runs no build, and installs nothing else; the files it ships are the whole plugin. Tagged releases are listed under **Releases**; `v0.2.1` is the current one.

To test an unpushed working copy, Desktop's **Add plugin** dialog also accepts an absolute local directory — the path to your own checkout, for example `C:\src\dsh-provider-qoder`.

## PAT configuration

After opening the `qoder-cn` row's **Edit** card in **Models**, paste the PAT into the Qoder card and click **Save**. The client extension writes it through the DSH credentials service under `QODERCN_PERSONAL_ACCESS_TOKEN`; the PAT is not written to the settings document.

If the client card is unavailable, configure the Qoder PAT in the launch environment before starting or restarting Desktop:

```powershell
# Desktop must be fully closed first. `$env:` is inherited only by children
# started from this PowerShell process.
Get-Process -Name 'DeepSeek Harness' -ErrorAction SilentlyContinue | Stop-Process
$env:QODERCN_PERSONAL_ACCESS_TOKEN = 'pt-your-qoder-pat'
# Adjust to where Desktop is actually installed.
Start-Process '<your install dir>\DeepSeek Harness.exe'
```

For a persistent Windows setup, add the same name/value under **Windows Settings → System → About → Advanced system settings → Environment Variables → User variables**, then fully restart Desktop. The Models card is preferred because it stores the PAT in the DSH credentials service without putting the secret in the process environment.

The provider checks the stored credential first and then the launch environment. `QODERCN_PAT` is an accepted alias; `QODER_API_KEY` is accepted only when its value starts with `pt-`. Do not use a Qoder job token (`jt-...`) as the PAT.

Public CN cloud needs no endpoint settings. For an enterprise VPC, set `QODER_VPC_INSTANCE` in the launch environment before starting Desktop, or provide the corresponding `llm-qoder` profile value through the active DSH configuration.

## Compatibility scope

The adapter is bound to an **account**, not to an organisation, tenancy, or plan. It needs a Qoder CN personal access token and a reachable endpoint; every request afterwards carries that token's own identity and plan.

- **Accounts** — any Qoder CN account that can issue a PAT: personal (free or paid), team, or enterprise. The model selector lists whatever the live catalog serves that account, and the chat route is identical for all of them.
- **Deployment** — public CN cloud by default (`gateway.qoder.com.cn`, `openapi.qoder.com.cn`). A **team or enterprise plan is served there too**: a team member's account needs no extra configuration, which is the path verified below. A private VPC tenant is supported by setting `QODER_VPC_INSTANCE` (aliases `QODER_VPC_ENDPOINT`, `QODERCN_VPC_ENDPOINT`, `QODERCN_CLI_VPC_ENDPOINT`) or the `baseURL`/`openApiUrl` provider options; the gateway, openapi, and dashboard hosts are derived from the instance name.
- **Plan differences reach only the quota surfaces, and they degrade.** The plan, the gateway pools, and the add-on balance are read independently: a report renders as long as one of the three answers, and only all three failing is an error. A pool the plan does not expose is reported as dormant rather than missing, and the add-on card exists only when there is a balance.
- **A PAT shows that token's own view** — its personal pool, plus the organisation pool when its organisation has one enabled. An organisation administrator's token returns the administrator's own identity and pools from the same endpoints; the panel prints the identity the service reports rather than assuming a role.

### Verified, and not

The public CN cloud path is verified end to end against a live team account (Teams plan, organisation member, zero VPC configuration). The private VPC path is implemented — endpoint derivation included — but has not been exercised against a real tenant, and neither has a free or personal account. Treat those as untested: if one misbehaves, an issue with the response you got is the fastest fix.

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

It is a `pnpm add` inside the profile, so a package specifier pins the version — verified end to end against `v0.2.0`. `v0.2.1` changes only the credits and the docs:

```sh
dsh plugin --profile <profile> add github:ljxfc/dsh-provider-qoder#v0.2.1
```

Either form also records the package in the profile's `dsh.profile.bundles`, so the bundle is enabled on the next start rather than needing a second step.

This is a development/CLI alternative; Desktop users should use **Plugins → Add plugin**.

## Remove

In Desktop, disable and remove the bundle from **Plugins**. For the CLI:

```sh
dsh plugin --profile web remove dsh-provider-qoder
```

## Credits

Forked from [minglu6/dsh-provider-qoder](https://github.com/minglu6/dsh-provider-qoder).

The client quota surfaces adapt the two-surface layout, the ref-counted polling helper, and the usage-module file split from [Mars-Sea/dsh-commandcode-provider](https://github.com/Mars-Sea/dsh-commandcode-provider) (MIT). See [NOTICE](NOTICE).

## License

MIT
