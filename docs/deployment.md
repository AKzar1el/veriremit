# VeriRemit Deployment

VeriRemit deliberately separates the browser UI from the live agent runtime.

## Recommended topology

- **Web:** build `apps/web` as a static Vite application. Vercel is suitable for this layer.
- **Agent/API:** run `Dockerfile.agent` on a long-lived Node container host with persistent storage mounted at `/var/lib/veriremit`.
- **Why not edge/serverless for the live agent:** Foxit's official integration is a local stdio MCP process. The agent owns that child process for its service lifetime and closes it during graceful shutdown. A persistent container is the conservative runtime for this requirement.

Fixture mode can be used for public UI previews, but fixture behavior must never be presented as live Nutrient/Foxit evidence.

### Access-control requirement

`VERIREMIT_WEB_ORIGIN` configures CORS only; **it is not authentication**. For a live sponsor demo, keep the agent private/local or place it behind an authenticated access proxy/reverse proxy and expose only the intended reviewer UI. Do not publish the live agent API directly to the internet. The current filesystem repository is also single-instance only; do not run multiple agent replicas against the same data directory.

## Agent container

Build from the repository root:

```bash
docker build -f Dockerfile.agent -t veriremit-agent .
```

The image defaults to `VERIREMIT_PROVIDER_MODE=fixture`. Live mode is enabled only by runtime environment configuration; no provider secret is copied into the image.

Required live environment variables:

```text
VERIREMIT_PROVIDER_MODE=live
VERIREMIT_PUBLIC_BASE_URL=https://<agent-host>
VERIREMIT_WEB_ORIGIN=https://<web-host>
VERIREMIT_SIGNER_EMAIL=<human signer email>
NUTRIENT_API_KEY=<secret>
NUTRIENT_DWS_VIEWER_API_KEY=<secret>
FOXIT_CLIENT_ID=<secret>
FOXIT_CLIENT_SECRET=<secret>
FOXIT_API_HOST=https://na1.fusion.foxit.com/pdf-services
FOXIT_ESIGN_HOST=https://na1.fusion.foxit.com
```

`OPENAI_API_KEY` is required only for the bounded natural-language agent path; deterministic verification, case state, audit integrity, Nutrient extraction, Foxit MCP, and eSign do not depend on model judgment.

Mount persistent storage:

```text
/var/lib/veriremit
```

The container runs as the non-root `node` user.

## Web

Build-time environment:

```text
VITE_API_BASE_URL=https://<agent-host>
```

If this variable is absent, the web app uses same-origin `/api/...` paths, which is convenient for local development or a reverse-proxy deployment.

When `VITE_API_BASE_URL` points at a separate agent origin, set the agent's `VERIREMIT_WEB_ORIGIN` to the exact public web origin. The API does not use wildcard CORS.

## Health and verification

Agent readiness:

```bash
curl -fsS https://<agent-host>/health
```

Then run the synthetic demo flow in fixture mode before configuring live secrets. Live sponsor claims require the credential-gated checks documented in `docs/verification/live-provider-checklist.md`.

## Current execution status

The deployment configuration is repository-tested for pathing, secret hygiene, and runtime composition. This sandbox does not provide Docker and cannot currently reach npm to install external packages, so the container itself has not been built here. No deployment success claim should be made until a networked runtime builds the image and the health/MCP checks complete.
