# Agentix Nexus — ChatGPT App

The MCP-based ChatGPT App for Agentix Nexus. Provides inline shopping UX in ChatGPT (and any MCP-compatible host: Claude Desktop, Anthropic Apps, future agents): product cards, order summaries, payment confirmations, all rendered natively in chat.

> **Status: works locally + tests pass + ready to deploy.** The MCP server runs over either stdio or SSE/HTTP. All 7 tools are wired against the live Nexus API. UI components return polished HTML (matched to the `agentixpay.ai/pay/[id]` Flow B page). Boots in HTTP mode with manifest, health check, and SSE endpoints exposed. OpenAI Apps platform registration is the remaining work that depends on their publisher dashboard access.

See [docs/10-chatgpt-app.md](https://github.com/Agentix-Pay/nexus/blob/master/docs/10-chatgpt-app.md) in the nexus repo for the full architecture, payment integration plan, and roadmap.

## Why this exists vs the Custom GPT

The Custom GPT (`https://chatgpt.com/g/g-69f...nexus-shopping-assistant`) we already shipped uses the OpenAPI Actions integration. It works, but the UI is markdown text only — no inline payment buttons, no rich cards, no Apple Pay. ChatGPT Apps (the newer platform) supports those, plus ports cleanly to Claude Desktop, Anthropic-built agents, and future MCP-compatible hosts. Long-term home for Nexus.

## Architecture at a glance

```
ChatGPT / Claude Desktop / any MCP host
       │
       ▼  MCP (stdio or SSE)
┌──────────────────────────────────────┐
│ nexus-chatgpt-app                    │
│  ├── src/server.ts        ← MCP server, stdio + SSE transports
│  ├── src/tools/*          ← 7 tools mapped 1:1 to /acp/v1/* endpoints
│  ├── src/components/      ← 8 inline UI renderers (HTML)
│  └── src/client.ts        ← Thin HTTP client to Nexus API
└──────────────┬───────────────────────┘
               │  HTTPS + Bearer JWT (per-shopper)
               ▼
       Nexus API (nexus-api.agentixpay.ai)
```

Same Nexus backend the Custom GPT calls. The App is a thin MCP wrapper that adds inline UI rendering.

## Run locally

```bash
cd nexus-chatgpt-app
npm install
cp .env.example .env
# At minimum set NEXUS_FALLBACK_API_KEY=nexus_xxx for browse/search testing.

# stdio mode (for local MCP hosts like Claude Desktop):
npm run dev

# OR HTTP/SSE mode (for ChatGPT Apps, remote hosts):
npm run dev:http
# → MCP HTTP server on :4400
#   Manifest:  http://localhost:4400/manifest.json
#   Health:    http://localhost:4400/healthz
#   MCP SSE:   http://localhost:4400/mcp/sse
```

Build for production:

```bash
npm run build           # outputs dist/
npm start               # stdio
npm run start:http      # HTTP/SSE on :4400
```

## Test it in Claude Desktop (the easiest sanity check)

Drop this into `~/Library/Application Support/Claude/claude_desktop_config.json`:

```jsonc
{
  "mcpServers": {
    "agentix-nexus": {
      "command": "node",
      "args": ["/absolute/path/to/nexus-chatgpt-app/dist/server.js"],
      "env": {
        "NEXUS_FALLBACK_API_KEY": "nexus_xxx",
        "NEXUS_BASE_URL": "https://nexus-api.agentixpay.ai"
      }
    }
  }
}
```

Restart Claude Desktop. The 7 Nexus tools appear in the tool drawer. Try: *"What stores are available?"* → calls `list_merchants` → returns the merchant list. Then *"Find me a LEGO Bugatti"* → `search_products` → renders the product grid HTML inline. Same logic that ChatGPT Apps will surface; this is a great way to iterate on tool/UI changes before publishing.

## Tools

All 7 tools mirror Nexus's `/acp/v1/*` endpoints:

| Tool | When the agent calls it | UI component | Backed by |
|---|---|---|---|
| `list_merchants` | Start of session, "what stores?" | `MerchantList` | `GET /acp/v1/merchants` |
| `search_products` | Shopper describes a product | `ProductGrid` | `GET /acp/v1/products?merchantId=…` |
| `get_product` | Shopper picks a result | `ProductDetailCard` | `GET /acp/v1/products/:id?merchantId=…` |
| `create_handoff` | Flow B — "send me a link" | `CheckoutLinkCard` | `POST /acp/v1/handoff` |
| `create_checkout` | Flow A — "buy in chat" | `OrderSummary` | `POST /acp/v1/checkouts` |
| `complete_checkout` | Finalize Flow A | `OrderConfirmation` | `POST /acp/v1/checkouts/:id/complete` |
| `get_order_status` | "Where's my order?" | `OrderStatusCard` | `GET /acp/v1/orders/:id` |

Each response carries `_meta.uiHtml` (rendered HTML chunk for inline display) and `_meta.uiData` (structured payload for hosts that prefer to render their own UI from data).

## Auth model

- **Discovery** (`list_merchants`, `search_products`, `get_product`): unauthenticated. Uses `NEXUS_FALLBACK_API_KEY` (the App's per-environment ISV key — same one the Custom GPT uses).
- **Purchase** (`create_handoff`, `create_checkout`, `complete_checkout`): per-shopper JWT via OAuth. ChatGPT Apps platform forwards the JWT in `_meta.bearer_token` on tool calls; the server attaches it to outbound Nexus requests as `Authorization: Bearer <jwt>`. OAuth provider is Nexus's stub `/oauth/*` today, AWS Cognito Hosted UI when migration completes — same as the Custom GPT.

## Per-merchant `checkoutMode`

Nexus exposes `merchant.checkoutMode` on `list_merchants` responses. The App should pick the right tool:

| `merchant.checkoutMode` | App tool sequence | UX |
|---|---|---|
| `SIGNED_URL` | `create_handoff` | `CheckoutLinkCard` → click → opens Agentix-hosted checkout at `agentixpay.ai/pay/<id>` |
| `MERCHANT_PAGE` | `create_handoff` | `CheckoutLinkCard` → click → opens merchant's own checkout (Shopify, etc.) |
| `IN_APP` | `create_checkout` + `complete_checkout` | `OrderSummary` → `PaymentSheet` → `OrderConfirmation`, all inline |
| `AUTO` | system-decides based on platform + flags | Same as above; Nexus picks |

## Tests

```bash
npm test                  # unit tests (tests/**, excludes tests/e2e/)
npm run test:regression   # @regression-tagged tests only (passes if none exist)
npm run test:e2e          # e2e smoke against a running HTTP server on :4400
```

Currently 15 unit tests covering all UI renderers (XSS escaping, empty states, price formatting, demo/real mode banners, status pill colors, tracking links) plus 2 e2e smoke tests against `/healthz` and `/manifest.json`.

### CI

GitHub Actions runs three jobs in parallel on every PR + push to `master`. Mirrors the dashboard pipeline ([AGX-34](https://linear.app/agentix-pay/issue/AGX-34)) and sibling nexus ticket.

| Job | Triggers | Required? | What it runs |
|---|---|---|---|
| `unit-tests` | PR + push | ✅ blocks merge | `npm test` (Vitest over `tests/**`, excluding `tests/e2e/`) |
| `regression-tests` | PR + push | ✅ blocks merge | `npm run test:regression` (`--testNamePattern "@regression" --passWithNoTests`) |
| `e2e-tests` | PR (only when `src/**`, `tests/**`, `manifest.json` changes) + nightly @ 06:00 UTC + `workflow_dispatch` | ⚠️ advisory only | Builds + boots the HTTP MCP server on :4400, runs `tests/e2e/smoke.test.ts` against `/healthz` + `/manifest.json` |

**Tagging a test as `@regression`:** put the literal substring in the `it()` description.

```ts
it('escapes script tags in user input @regression', () => { /* ... */ });
```

**Promoting e2e to required:** track its pass rate for ~2 weeks; once stable, add `e2e-tests` to `master` branch protection via `gh api`.

## Deploy

Deploys run on **AWS via GitHub Actions** (Fly.io was decommissioned June 2026).
The image is built and pushed to ECR, then SSM-run onto the shared EC2 host into
the per-env compose project (`.github/workflows/deploy-aws-*.yml`):

- push to `main` → **dev** (`nexus-dev.agentixpay.ai`)
- push to `staged` → **test** (`nexus-test.agentixpay.ai`)
- publish a GitHub release → **prod** (`nexus.agentixpay.ai`)

The container's HTTP transport listens on `:4400` (behind Caddy/Cloudflare) and serves:

- `GET /manifest.json` — public App manifest (cached 5 min)
- `GET /healthz` — health check (used by the compose healthcheck + Caddy)
- `GET /mcp/sse` — MCP Server-Sent Events endpoint (ChatGPT Apps connect here)
- `POST /mcp/messages?sessionId=…` — message channel for the SSE session

Runtime env (`NEXUS_BASE_URL`, `PUBLIC_BASE_URL`, `NEXUS_FALLBACK_API_KEY`) is set
by the deploy bundle in the `agentix-pay-dashboard` repo
(`infra/aws/deploy/docker-compose.aws.yml` + the `agentix/<env>/nexus-app` secret).

Point the OpenAI Apps publisher manifest at the per-env public host, e.g. prod:
- App URL: `https://nexus.agentixpay.ai`
- MCP endpoint: `https://nexus.agentixpay.ai/mcp/sse`
- Manifest: `https://nexus.agentixpay.ai/manifest.json`

## What still needs the OpenAI side

| Item | Status |
|---|---|
| MCP server + tools + UI renderers | ✅ Done |
| stdio + SSE transports | ✅ Done |
| Manifest + health endpoints | ✅ Done |
| Tests | ✅ Done (15/15 passing) |
| Local Claude Desktop sanity check | ✅ Works |
| AWS hosting (ECR + EC2/compose via GitHub Actions) | ✅ Done |
| Apply for OpenAI Apps publisher access | ⏳ Pending OpenAI flow |
| Submit manifest for review | ⏳ Pending |
| Apple Pay / Shop Pay payment-sheet primitives | ⏳ Pending OpenAI Apps SDK docs |
| Public launch | ⏳ ~2 weeks review after submission |

## Layout

```
nexus-chatgpt-app/
├── manifest.json              # ChatGPT App manifest (OAuth, MCP endpoint, UI components)
├── Dockerfile                 # Multi-stage Node 20 alpine build
├── package.json               # express + @modelcontextprotocol/sdk + zod
├── src/
│   ├── server.ts              # MCP server entry — stdio + SSE/HTTP transports
│   ├── client.ts              # HTTP client wrapping Nexus API calls
│   ├── tools/                 # 7 tools — list_merchants, search_products, get_product,
│   │                          # create_checkout, complete_checkout, create_handoff, get_order_status
│   ├── components/
│   │   ├── render.ts          # 8 inline UI HTML renderers
│   │   └── README.md          # Component design specs
│   └── auth/                  # JWT helpers (planned for Cognito migration)
└── tests/
    └── render.test.ts         # 15 renderer tests
```

## License

MIT (or Agentix-internal — TBD)
