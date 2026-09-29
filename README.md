# dsh-provider-qoder

Qoder CN provider plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). It keeps Qoder's PAT exchange, COSY signing, WAF encoding, SSE transport, and live model catalog. The provider route is `qoder-cn`.

The primary target is DeepSeek Harness Desktop `v0.1.7-rc.2` (`dsh-v0.1.7-rc.2`).

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
