/**
 * Plaid client library.
 * Uses the official plaid-node SDK for banking, credit cards, and loans.
 */

import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  Products,
  CountryCode,
} from 'plaid';

let _client: PlaidApi | null = null;

function getClient(): PlaidApi {
  if (!_client) {
    const clientId = process.env.PLAID_CLIENT_ID;
    const secret = process.env.PLAID_SECRET;
    const env = process.env.PLAID_ENV || 'sandbox';

    if (!clientId || !secret) {
      throw new Error('Plaid credentials not configured. Set PLAID_CLIENT_ID and PLAID_SECRET.');
    }

    const config = new Configuration({
      basePath: PlaidEnvironments[env as keyof typeof PlaidEnvironments] || PlaidEnvironments.sandbox,
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': clientId,
          'PLAID-SECRET': secret,
        },
      },
    });

    _client = new PlaidApi(config);
  }
  return _client;
}

/**
 * Create a Link token for the Plaid Link frontend component.
 */
export async function createLinkToken(userId: string) {
  const client = getClient();
  const response = await client.linkTokenCreate({
    user: { client_user_id: userId },
    client_name: 'FireRunway',
    products: [Products.Auth, Products.Transactions],
    country_codes: [CountryCode.Us],
    language: 'en',
  });
  return response.data;
}

/**
 * Exchange a public token (from Plaid Link) for a permanent access token.
 */
export async function exchangePublicToken(publicToken: string) {
  const client = getClient();
  const response = await client.itemPublicTokenExchange({
    public_token: publicToken,
  });
  return response.data;
}

/**
 * Get all accounts and their balances for an access token.
 */
export async function getAccountBalances(accessToken: string) {
  const client = getClient();
  const response = await client.accountsBalanceGet({
    access_token: accessToken,
  });
  return response.data;
}

/**
 * Get institution info by ID.
 */
export async function getInstitution(institutionId: string) {
  const client = getClient();
  const response = await client.institutionsGetById({
    institution_id: institutionId,
    country_codes: [CountryCode.Us],
  });
  return response.data.institution;
}

/**
 * Remove an item (disconnect).
 */
export async function removeItem(accessToken: string) {
  const client = getClient();
  const response = await client.itemRemove({
    access_token: accessToken,
  });
  return response.data;
}
