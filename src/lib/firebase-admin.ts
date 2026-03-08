import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

function initAdmin() {
  if (getApps().length > 0) return getApps()[0];

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccount) {
    try {
      const parsed = JSON.parse(serviceAccount);
      return initializeApp({ credential: cert(parsed) });
    } catch {
      console.warn('[Firebase Admin] Failed to parse service account JSON, using default credentials');
    }
  }

  // Fall back to Application Default Credentials (works on GCP)
  return initializeApp();
}

const app = initAdmin();
const adminAuth = getAuth(app);

/**
 * Verify a Firebase ID token from a Bearer header.
 * Returns the decoded token (with `uid`) or null.
 */
export async function verifyIdToken(authHeader: string | null) {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  try {
    return await adminAuth.verifyIdToken(token);
  } catch (e) {
    console.warn('[Firebase Admin] Token verification failed:', e);
    return null;
  }
}

export { adminAuth };
