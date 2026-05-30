import { describe, it, expect } from 'vitest';
import { readJsonBody, agentJson, agentError } from './http';

// ---------------------------------------------------------------------------
// readJsonBody
// ---------------------------------------------------------------------------

function makeRequest(body: string, contentType = 'application/json') {
  return new Request('http://localhost/test', {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body,
  });
}

describe('readJsonBody', () => {
  it('returns ok:true with parsed body for a valid JSON object', async () => {
    const req = makeRequest(JSON.stringify({ amount: 100, at: '2026-01-01' }));
    const result = await readJsonBody(req);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.body).toEqual({ amount: 100, at: '2026-01-01' });
    }
  });

  it('returns 400 when body is a JSON array', async () => {
    const req = makeRequest(JSON.stringify([1, 2, 3]));
    const result = await readJsonBody(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
      const body = await result.response.json();
      expect(body.ok).toBe(false);
    }
  });

  it('returns 400 when body is a JSON primitive (string)', async () => {
    const req = makeRequest('"just a string"');
    const result = await readJsonBody(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
    }
  });

  it('returns 400 when body is null JSON', async () => {
    const req = makeRequest('null');
    const result = await readJsonBody(req);
    expect(result.ok).toBe(false);
  });

  it('returns 400 when body is malformed JSON', async () => {
    const req = makeRequest('{ not json }');
    const result = await readJsonBody(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const body = await result.response.json();
      expect(body.error).toBe('Invalid JSON body');
    }
  });

  it('accepts an empty object body', async () => {
    const req = makeRequest('{}');
    const result = await readJsonBody(req);
    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// agentJson
// ---------------------------------------------------------------------------

describe('agentJson', () => {
  it('returns status 200 by default', async () => {
    const res = agentJson({ debt: { id: 'd1' } });
    expect(res.status).toBe(200);
  });

  it('includes ok:true in the body', async () => {
    const res = agentJson({ debt: { id: 'd1' } });
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it('spreads the data payload into the body', async () => {
    const res = agentJson({ debt: { id: 'd1', name: 'Test' } });
    const body = await res.json();
    expect(body.debt).toEqual({ id: 'd1', name: 'Test' });
  });

  it('uses the provided status code', async () => {
    const res = agentJson({ msg: 'created' }, 201);
    expect(res.status).toBe(201);
  });
});

// ---------------------------------------------------------------------------
// agentError
// ---------------------------------------------------------------------------

describe('agentError', () => {
  it('returns the specified status code', () => {
    expect(agentError('not found', 404).status).toBe(404);
  });

  it('includes ok:false in the body', async () => {
    const body = await agentError('oops', 500).json();
    expect(body.ok).toBe(false);
  });

  it('includes the error message in the body', async () => {
    const body = await agentError('Debt not found: d1', 404).json();
    expect(body.error).toBe('Debt not found: d1');
  });
});
