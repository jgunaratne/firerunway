import crypto from 'crypto';

const SNAPTRADE_API_URL = 'https://api.snaptrade.com/api/v1';

function getCredentials() {
  const clientId = process.env.SNAPTRADE_CLIENT_ID;
  const consumerKey = process.env.SNAPTRADE_CONSUMER_KEY;
  if (!clientId || !consumerKey) {
    throw new Error('SnapTrade credentials not configured. Set SNAPTRADE_CLIENT_ID and SNAPTRADE_CONSUMER_KEY.');
  }
  return { clientId, consumerKey };
}

function generateSignature(requestData: string, consumerKey: string): string {
  return crypto
    .createHmac('sha256', consumerKey)
    .update(requestData)
    .digest('base64');
}

async function snaptradeRequest(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  params?: Record<string, string>,
  body?: Record<string, unknown>,
) {
  const { clientId, consumerKey } = getCredentials();

  const url = new URL(`${SNAPTRADE_API_URL}${path}`);

  // Add clientId to query params
  url.searchParams.set('clientId', clientId);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  // Generate signature from query + body
  const sigContent = JSON.stringify(body || {}) + url.search;
  const signature = generateSignature(sigContent, consumerKey);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Signature': signature,
  };

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`SnapTrade ${method} ${path} failed:`, res.status, text);
    throw new Error(`SnapTrade API error: ${res.status} ${text}`);
  }

  return res.json();
}

/**
 * Register a new SnapTrade user. Returns userId + userSecret.
 */
export async function registerUser(userId: string) {
  return snaptradeRequest('POST', '/snapTrade/registerUser', {}, { userId });
}

/**
 * Delete a SnapTrade user registration.
 */
export async function deleteUser(userId: string) {
  return snaptradeRequest('DELETE', '/snapTrade/deleteUser', { userId });
}

/**
 * Generate a redirect URL for the SnapTrade Connection Portal.
 */
export async function generateConnectionPortalUrl(
  userId: string,
  userSecret: string,
  opts?: { broker?: string; reconnect?: string }
) {
  const body: Record<string, unknown> = { userId, userSecret };
  if (opts?.broker) body.broker = opts.broker;
  if (opts?.reconnect) body.reconnect = opts.reconnect;
  return snaptradeRequest('POST', '/snapTrade/login', {}, body);
}

/**
 * List all brokerage accounts for a user.
 */
export async function listAccounts(userId: string, userSecret: string) {
  return snaptradeRequest('GET', '/accounts', { userId, userSecret });
}

/**
 * Get holdings for a specific account.
 */
export async function getAccountHoldings(userId: string, userSecret: string, accountId: string) {
  return snaptradeRequest('GET', `/accounts/${accountId}/holdings`, { userId, userSecret });
}

/**
 * Get holdings for all accounts belonging to a user.
 */
export async function getAllHoldings(userId: string, userSecret: string) {
  return snaptradeRequest('GET', '/holdings', { userId, userSecret });
}

/**
 * Get account balances.
 */
export async function getAccountBalances(userId: string, userSecret: string, accountId: string) {
  return snaptradeRequest('GET', `/accounts/${accountId}/balances`, { userId, userSecret });
}

/**
 * Disconnect (remove) a brokerage authorization.
 */
export async function deleteBrokerageAuthorization(userId: string, userSecret: string, authorizationId: string) {
  return snaptradeRequest('DELETE', `/authorizations/${authorizationId}`, { userId, userSecret });
}
