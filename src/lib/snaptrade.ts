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
 * Generate a redirect URL for the SnapTrade Connection Portal.
 */
export async function generateConnectionPortalUrl(
  userId: string,
  userSecret: string,
  opts?: { broker?: string; reconnect?: string }
) {
  const res = await getClient().authentication.loginSnapTradeUser({
    userId,
    userSecret,
    broker: opts?.broker,
    reconnect: opts?.reconnect,
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
 */
export async function getAllHoldings(userId: string, userSecret: string) {
  const res = await getClient().accountInformation.getAllUserHoldings({
    userId,
    userSecret,
  });
  return res.data;
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
