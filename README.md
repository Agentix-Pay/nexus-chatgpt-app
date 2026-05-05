# Agentix Nexus — ChatGPT App

The MCP-based ChatGPT App for Agentix Nexus. Provides inline shopping UX in ChatGPT (and any MCP-compatible host: Claude Desktop, Anthropic Apps, future agents): product cards, order summaries, payment confirmation sheets, all rendered natively in chat without leaving for a browser.

> **Status: scaffold.** Tools are wired against the live Nexus API at `agentix-nexus.fly.dev`. UI components and the OpenAI Apps host integration are stubbed pending platform finalization. See [docs/10-chatgpt-app.md](https://github.com/Agentix-Pay/nexus/blob/master/docs/10-chatgpt-app.md) in the nexus repo for the full architecture, payment integration plan, and roadmap.

## Why this exists vs the Custom GPT

The Custom GPT (`https://chatgpt.com/g/g-69f...nexus-shopping-assistant`) we already shipped uses the OpenAPI Actions integration. It works, but the UI is markdown text only — no inline payment buttons, no rich cards, no Apple Pay. ChatGPT Apps (the newer platform) supports those, plus ports cleanly to Claude Desktop, Anthropic-built agents, and future MCP-compatible hosts. Long-term home for Nexus.

## What's in the box

```
nexus-chatgpt-app/
├── manifest.json              # ChatGPT App manifest (OAuth, MCP endpoint, UI components)
├── src/
│   ├── server.ts              # MCP server entry (stdio + future SSE)
│   ├── client.ts              # Thin HTTP client wrapping calls to Nexus API
│   ├── tools/                 # 7 tools — list_merchants, search_products, get_product,
│   │                          # create_checkout, complete_checkout, create_handoff, get_order_status
│   ├── components/            # UI component specs (ProductCard, OrderSummary, PaymentSheet)
│   └── auth/                  # JWT verification helpers (planned)
└── tests/                     # Vitest tests against tools (planned)
```

## Run locally

```bash
cd nexus-chatgpt-app
npm install
cp .env.example .env
# Set NEXUS_FALLBACK_API_KEY=nexus_xxx for browse/search testing

npm run dev
# → MCP server on stdio
```

To connect from Claude Desktop (sanity check before ChatGPT integration):

```jsonc
// ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "agentix-nexus": {
      "command": "node",
      "args": ["/Users/danishvirani/code/nexus-chatgpt-app/dist/server.js"],
      "env": {
        "NEXUS_FALLBACK_API_KEY": "nexus_..."
      }
    }
  }
}
```

Then restart Claude Desktop and the 7 Nexus tools appear. This is a great way to test logic before wiring into the OpenAI Apps publisher dashboard.

## Tools

| Tool | When the agent calls it | Backed by |
|---|---|---|
| `list_merchants` | First turn or "what stores are available?" | `GET /acp/v1/merchants` |
| `search_products` | Shopper describes a product | `GET /acp/v1/products?merchantId=…&q=…` |
| `get_product` | Shopper picks a result | `GET /acp/v1/products/:id?merchantId=…` |
| `create_handoff` | Shopper wants a checkout link (Flow B) | `POST /acp/v1/handoff` — returns merchant URL or our shell |
| `create_checkout` | Shopper wants in-chat checkout (Flow A) | `POST /acp/v1/checkouts` — paired with `complete_checkout` |
| `complete_checkout` | Finalize Flow A — Walmart-style "Charged $X" | `POST /acp/v1/checkouts/:id/complete` |
| `get_order_status` | "Where's my order?" | `GET /acp/v1/orders/:id` |

Each tool's response includes `_meta.uiComponent` indicating which inline UI to render (`ProductCard`, `OrderSummary`, `PaymentSheet`, etc.). When the OpenAI Apps SDK is fully documented for these primitives, the components in `src/components/` get wired up.

## Auth model

- **Discovery (browse/search):** unauthenticated, uses the App's per-environment ISV API key (the same kind of key the Custom GPT uses today). Read-only.
- **Purchase (checkout, complete, order status):** OAuth via Nexus's `/oauth/authorize` flow. Same provider as the Custom GPT Option B — JWT-based now, Cognito Hosted UI when AWS migration completes.

The OpenAI Apps platform routes the JWT back to us via `_meta.bearer_token` on tool invocations. We extract it in the server and pass to handlers.

## Per-merchant checkout mode

The merchant's `checkoutMode` (set by Agentix admin) determines which tool the agent picks for purchase:

| `merchant.checkoutMode` | Agent picks | Result |
|---|---|---|
| `SIGNED_URL` | `create_handoff` | Link → our hosted shell at `agentixpay.ai/control-center/checkout/<id>` |
| `MERCHANT_PAGE` | `create_handoff` | Link → merchant's own checkout (Shopify, WooCommerce) |
| `IN_APP` | `create_checkout` + `complete_checkout` | Native payment sheet inline in ChatGPT (with stored card / Apple Pay / Shop Pay) |
| `AUTO` | system-decides based on platform + flags | Same as above but Nexus picks |

## Roadmap

| Phase | Effort | Outcome |
|---|---|---|
| 1. Tools wired to live Nexus API (✅ this scaffold) | done | Logic works against `agentix-nexus.fly.dev` |
| 2. UI components fully implemented (`ProductCard`, `OrderSummary`, `PaymentSheet`) | 1 week | Inline rich UI in chat |
| 3. OpenAI Apps publisher registration + manifest finalization | 2-3 days | Listed as a Beta App |
| 4. Apple Pay / Shop Pay integration via App SDK payment primitives | 1 week | One-tap checkout |
| 5. Real-time updates via MCP resources (cart sync, order status pushes) | 1 week | Live updates |
| 6. Submit for OpenAI App Store review | passive ~2 weeks | Public launch |

Total: ~5-6 focused weeks to public ChatGPT App.

## License

MIT (or Agentix-internal — TBD)
