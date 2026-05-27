import { describe, it, expect } from 'vitest';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:4400';

describe('e2e — MCP HTTP transport', () => {
  it('GET /healthz returns 200 + status=ok + tools count', async () => {
    const res = await fetch(`${BASE}/healthz`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status?: string; tools?: number };
    expect(body.status).toBe('ok');
    expect(body.tools).toBeGreaterThan(0);
  });

  it('GET /manifest.json returns the app manifest', async () => {
    const res = await fetch(`${BASE}/manifest.json`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id?: string; mcp?: { endpoint?: string } };
    expect(body.id).toBe('agentix-nexus');
    expect(body.mcp?.endpoint).toBeTruthy();
  });
});
