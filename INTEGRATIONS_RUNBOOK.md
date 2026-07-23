# Integrations Gateway Runbook

This runbook covers the disabled-by-default `tonari-hatake-integrations`
Worker. It does not authorize production end-user access. The current shared
token guard is for controlled operator testing only.

## Safety Rules

- Never put a credential in Git, `wrangler.toml`, browser code, command
  arguments, screenshots, or chat messages.
- Keep `INTEGRATIONS_ENABLED` absent or set to `false` until every preflight
  check passes.
- Store provider credentials only with `wrangler secret put`.
- Do not keep provider credentials in the Pages project. The static site is
  not an integration runtime.
- Stop first and investigate later: disabling integrations is the first
  incident action.

## Preflight

```powershell
git status --short --branch
node --test tools\bff.test.mjs tools\domain.test.mjs tools\gateway.test.mjs tools\import.test.mjs
npx.cmd --yes wrangler@latest deploy --config wrangler.integrations.toml --dry-run
```

Confirm that the deployed gateway is still disabled:

```powershell
curl.exe -i https://tonari-hatake-integrations.makoto-monda.workers.dev/api/integrations/status
```

Expected result: `503 integration-disabled`.

## Secret Staging

Run each command interactively. Wrangler prompts for the value so it does not
appear in the command line.

```powershell
npx.cmd --yes wrangler@latest secret put BFF_ACCESS_TOKEN --config wrangler.integrations.toml
npx.cmd --yes wrangler@latest secret put WAGRI_CLIENT_ID --config wrangler.integrations.toml
npx.cmd --yes wrangler@latest secret put WAGRI_CLIENT_SECRET --config wrangler.integrations.toml
npx.cmd --yes wrangler@latest secret put XARVIO_ACCESS_TOKEN --config wrangler.integrations.toml
```

Stage only the credentials for providers included in the approved test. Leave
`INTEGRATIONS_ENABLED` disabled. A `BFF_ACCESS_TOKEN` must contain at least 32
random characters.

## Controlled Operator Test

1. Record the current Worker version from the deployment output or dashboard.
2. Confirm the Cloudflare Rate Limiting binding is present.
3. Restrict the test audience and distribute the operator token out of band.
4. Enable the flag interactively:

```powershell
npx.cmd --yes wrangler@latest secret put INTEGRATIONS_ENABLED --config wrangler.integrations.toml
```

Enter `true` only for the approved test window. Call the status route with the
`X-Tonari-BFF-Token` header, then exercise one provider at a time. Never embed
that header value in the frontend.

## Stop And Roll Back

Disable new provider calls first:

```powershell
npx.cmd --yes wrangler@latest secret put INTEGRATIONS_ENABLED --config wrangler.integrations.toml
```

Enter `false`, then confirm the status route returns
`503 integration-disabled`. If code rollback is also required, use the
Cloudflare dashboard to select the last known-good Worker version. Check the
installed Wrangler rollback syntax with `wrangler rollback --help` before
using the CLI because deployment commands can change between releases.

After an incident, record the Worker version, time window, provider, response
class, and whether any request reached the provider. Do not put tokens or raw
provider diagnostics in the incident record.

## Production Gate

Do not enable this gateway for end users until all of the following exist:

- application login or verified Cloudflare Access JWT;
- organization and role authorization;
- per-user or per-tenant limiter keys;
- consent, provenance, and audit records;
- licensed redacted contract fixtures;
- provider token lifecycle and revocation handling;
- an approved data retention and deletion policy.
