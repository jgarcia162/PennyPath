import { createHash, randomBytes } from 'node:crypto';

const TOKEN_PREFIX = 'pp_agent_';

export function generateAgentTokenPlaintext(): string {
  return TOKEN_PREFIX + randomBytes(32).toString('base64url');
}

export function hashAgentToken(plaintext: string): string {
  return createHash('sha256').update(plaintext, 'utf8').digest('hex');
}

export function isAgentTokenFormat(plaintext: string): boolean {
  return plaintext.startsWith(TOKEN_PREFIX) && plaintext.length > TOKEN_PREFIX.length + 20;
}
