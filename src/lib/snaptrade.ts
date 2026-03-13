import { Snaptrade } from 'snaptrade-typescript-sdk';

let _client: Snaptrade | null = null;

function getClient(): Snaptrade {
  if (!_client) {
    const clientId = process.env.SNAPTRADE_CLIENT_ID;
    const consumerKey = process.env.SNAPTRADE_CONSUMER_KEY;
    if (!clientId || !consumerKey) {
      throw new Error(
        'SnapTrade credentials not configured. Set SNAPTRADE_CLIENT_ID and SNAPTRADE_CONSUMER_KEY.'
      );
    }
    _client = new Snaptrade({ clientId, consumerKey });
  }
  return _client;
}

/**
 * Register a new SnapTrade user. Returns userId + userSecret.
 */
export async function registerUser(userId: string) {
  const res = await getClient().authentication.registerSnapTradeUser({ userId });
  return res.data;
}

/**
 * Delete a SnapTrade user registration.
 */
export async function deleteUser(userId: string) {
  const res = await getClient().authentication.deleteSnapTradeUser({ userId });
  return res.data;
}

/**
 * Reset a SnapTrade user's secret. Use when the user already exists
 * but we don't have their secret stored locally.
 */
export async function resetUserSecret(userId: string) {
  const res = await getClient().authentication.resetSnapTradeUserSecret({ userId });
  return res.data;
}

/**
 * Generate a redirect URL for the SnapTrade Connection Portal.
 */
export async function generateConnectionPortalUrl(
  userId: string,
  userSecret: string,
  opts?: { broker?: string; reconnect?: string; customRedirect?: string }
) {
  const res = await getClient().authentication.loginSnapTradeUser({
    userId,
    userSecret,
    broker: opts?.broker,
    reconnect: opts?.reconnect,
    customRedirect: opts?.customRedirect,
  });
  return res.data;
}

/**
 * List all brokerage accounts for a user.
 */
export async function listAccounts(userId: string, userSecret: string) {
  const res = await getClient().accountInformation.listUserAccounts({
    userId,
    userSecret,
  });
  return res.data;
}

/**
 * Get holdings for a specific account.
 */
export async function getAccountHoldings(
  userId: string,
  userSecret: string,
  accountId: string
) {
  const res = await getClient().accountInformation.getUserHoldings({
    userId,
    userSecret,
    accountId,
  });
  return res.data;
}

/**
 * Get holdings for all accounts belonging to a user.
 * NOTE: This endpoint is deprecated by SnapTrade. Prefer getAccountPositions.
 */
export async function getAllHoldings(userId: string, userSecret: string) {
  const res = await getClient().accountInformation.getAllUserHoldings({
    userId,
    userSecret,
  });
  return res.data;
}

/**
 * Get positions for a specific account using the recommended fine-grained API.
 * Returns an array of Position objects (symbol, units, price, etc.).
 */
export async function getAccountPositions(
  userId: string,
  userSecret: string,
  accountId: string
) {
  const res = await getClient().accountInformation.getUserAccountPositions({
    userId,
    userSecret,
    accountId,
  });
  return res.data;
}

/**
 * Fetch positions for ALL accounts in parallel using the per-account API.
 * This is the recommended approach (getAllUserHoldings is deprecated).
 * Returns a map of accountId → Position[].
 */
export async function getAllPositionsByAccount(
  userId: string,
  userSecret: string
): Promise<{ accountId: string; positions: Awaited<ReturnType<typeof getAccountPositions>> }[]> {
  // First, list all accounts
  const accounts = await listAccounts(userId, userSecret);
  if (!Array.isArray(accounts) || accounts.length === 0) return [];

  // Fetch positions for each account in parallel
  const results = await Promise.allSettled(
    accounts.map(async (acct) => {
      const id = (acct as Record<string, unknown>).id as string;
      const positions = await getAccountPositions(userId, userSecret, id);
      return { accountId: id, positions };
    })
  );

  return results
    .filter((r): r is PromiseFulfilledResult<{ accountId: string; positions: Awaited<ReturnType<typeof getAccountPositions>> }> => r.status === 'fulfilled')
    .map(r => r.value);
}

/**
 * Get account balances.
 */
export async function getAccountBalances(
  userId: string,
  userSecret: string,
  accountId: string
) {
  const res = await getClient().accountInformation.getUserAccountBalance({
    userId,
    userSecret,
    accountId,
  });
  return res.data;
}

/**
 * Disconnect (remove) a brokerage authorization.
 */
export async function deleteBrokerageAuthorization(
  userId: string,
  userSecret: string,
  authorizationId: string
) {
  const res = await getClient().connections.removeBrokerageAuthorization({
    userId,
    userSecret,
    authorizationId,
  });
  return res.data;
}
