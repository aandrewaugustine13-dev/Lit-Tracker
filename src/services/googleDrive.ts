/**
 * Google Drive Service
 * Uses Google Identity Services (GIS) for on-demand Drive access.
 * Completely separate from Supabase auth — no backend needed.
 * 
 * Setup required:
 * 1. Google Cloud project with Drive API enabled
 * 2. OAuth 2.0 Client ID (Web application type)
 * 3. Authorized JavaScript origins: your app's URL(s)
 * 4. Set VITE_GOOGLE_CLIENT_ID in .env
 */

// ─── Types ─────────────────────────────────────────────────────────────────

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: string;
  iconLink?: string;
  webViewLink?: string;
}

export interface DriveListResponse {
  files: DriveFile[];
  nextPageToken?: string;
}

// ─── GIS Script Loader ─────────────────────────────────────────────────────

let gisLoaded = false;
let gisLoadPromise: Promise<void> | null = null;

function loadGisScript(): Promise<void> {
  if (gisLoaded) return Promise.resolve();
  if (gisLoadPromise) return gisLoadPromise;

  gisLoadPromise = new Promise((resolve, reject) => {
    // Check if already on page
    if ((window as any).google?.accounts?.oauth2) {
      gisLoaded = true;
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      gisLoaded = true;
      resolve();
    };
    script.onerror = () => {
      gisLoadPromise = null;
      reject(new Error('Failed to load Google Identity Services script'));
    };
    document.head.appendChild(script);
  });

  return gisLoadPromise;
}

// ─── Token Management ───────────────────────────────────────────────────────

let currentToken: string | null = null;
let tokenExpiry: number = 0;

export function getClientId(): string | null {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID || null;
}

export function isGoogleDriveConfigured(): boolean {
  return !!getClientId();
}

export function hasValidToken(): boolean {
  return !!currentToken && Date.now() < tokenExpiry;
}

export function clearToken(): void {
  currentToken = null;
  tokenExpiry = 0;
}

/**
 * Request a Google OAuth token with Drive read scope.
 * Opens Google consent popup on first call; silent on subsequent calls if consent exists.
 */
export async function requestDriveToken(): Promise<string> {
  const clientId = getClientId();
  if (!clientId) {
    throw new Error(
      'Google Client ID not configured. Add VITE_GOOGLE_CLIENT_ID to your .env file.'
    );
  }

  // Return cached token if still valid (with 60s buffer)
  if (currentToken && Date.now() < tokenExpiry - 60000) {
    return currentToken;
  }

  await loadGisScript();

  const google = (window as any).google;
  if (!google?.accounts?.oauth2) {
    throw new Error('Google Identity Services not available');
  }

  return new Promise((resolve, reject) => {
    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/drive.readonly',
      callback: (response: any) => {
        if (response.error) {
          reject(new Error(`Google auth error: ${response.error}`));
          return;
        }
        currentToken = response.access_token;
        // Token valid for ~3600 seconds, store with buffer
        tokenExpiry = Date.now() + (response.expires_in || 3600) * 1000;
        resolve(response.access_token);
      },
      error_callback: (error: any) => {
        reject(new Error(`Google auth failed: ${error.type || 'unknown'}`));
      },
    });

    tokenClient.requestAccessToken();
  });
}

// ─── Drive REST API ─────────────────────────────────────────────────────────

const DRIVE_API = 'https://www.googleapis.com/drive/v3';

/**
 * List files from Google Drive.
 * Filters for text-like files by default (docs, txt, fountain, fdx, markdown).
 */
export async function listDriveFiles(options?: {
  query?: string;
  pageToken?: string;
  pageSize?: number;
}): Promise<DriveListResponse> {
  const token = await requestDriveToken();
  const { query, pageToken, pageSize = 20 } = options || {};

  // Build query: user's files, not trashed, text-like types
  const mimeFilters = [
    "mimeType='application/vnd.google-apps.document'",
    "mimeType='text/plain'",
    "mimeType='text/markdown'",
    "mimeType='application/octet-stream'", // .fountain, .fdx
  ].join(' or ');

  let q = `trashed=false and (${mimeFilters})`;
  if (query) {
    q = `trashed=false and name contains '${query.replace(/'/g, "\\'")}'`;
  }

  const params = new URLSearchParams({
    q,
    pageSize: String(pageSize),
    orderBy: 'modifiedTime desc',
    fields: 'nextPageToken,files(id,name,mimeType,modifiedTime,size,iconLink,webViewLink)',
  });
  if (pageToken) params.set('pageToken', pageToken);

  const response = await fetch(`${DRIVE_API}/files?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const err = await response.text();
    if (response.status === 401) {
      clearToken();
      throw new Error('Drive token expired. Please try again.');
    }
    throw new Error(`Drive API error: ${response.status} — ${err}`);
  }

  return response.json();
}

/**
 * Fetch the text content of a Drive file.
 * Handles Google Docs (export as plain text) and regular files (download).
 */
export async function fetchDriveFileContent(file: DriveFile): Promise<string> {
  const token = await requestDriveToken();

  let url: string;
  if (file.mimeType === 'application/vnd.google-apps.document') {
    // Google Docs: export as plain text
    url = `${DRIVE_API}/files/${file.id}/export?mimeType=text/plain`;
  } else {
    // Regular files: download content
    url = `${DRIVE_API}/files/${file.id}?alt=media`;
  }

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const err = await response.text();
    if (response.status === 401) {
      clearToken();
      throw new Error('Drive token expired. Please try again.');
    }
    throw new Error(`Failed to fetch file: ${response.status} — ${err}`);
  }

  return response.text();
}
