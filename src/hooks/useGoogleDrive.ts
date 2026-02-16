import { useState, useCallback } from 'react';
import {
  DriveFile,
  listDriveFiles,
  fetchDriveFileContent,
  requestDriveToken,
  hasValidToken,
  isGoogleDriveConfigured,
} from '../services/googleDrive';

interface UseGoogleDriveReturn {
  /** Whether VITE_GOOGLE_CLIENT_ID is set */
  configured: boolean;
  /** Whether we have a valid unexpired token */
  authenticated: boolean;
  /** Currently listed files */
  files: DriveFile[];
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;
  /** Whether there are more files to load */
  hasMore: boolean;
  /** Authenticate and load initial file list */
  connect: () => Promise<void>;
  /** Search files by name */
  search: (query: string) => Promise<void>;
  /** Load next page of results */
  loadMore: () => Promise<void>;
  /** Fetch the text content of a file */
  fetchContent: (file: DriveFile) => Promise<string>;
}

export function useGoogleDrive(): UseGoogleDriveReturn {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageToken, setPageToken] = useState<string | undefined>();
  const [lastQuery, setLastQuery] = useState<string | undefined>();

  const configured = isGoogleDriveConfigured();
  const authenticated = hasValidToken();

  const connect = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await requestDriveToken();
      const result = await listDriveFiles();
      setFiles(result.files);
      setPageToken(result.nextPageToken);
      setLastQuery(undefined);
    } catch (err: any) {
      // User closed popup or denied access — not a crash
      if (err.message?.includes('popup_closed') || err.message?.includes('access_denied')) {
        setError('Google Drive access was not granted.');
      } else {
        setError(err.message || 'Failed to connect to Google Drive');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const search = useCallback(async (query: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await listDriveFiles({ query: query || undefined });
      setFiles(result.files);
      setPageToken(result.nextPageToken);
      setLastQuery(query || undefined);
    } catch (err: any) {
      setError(err.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!pageToken || loading) return;
    setLoading(true);
    try {
      const result = await listDriveFiles({ query: lastQuery, pageToken });
      setFiles(prev => [...prev, ...result.files]);
      setPageToken(result.nextPageToken);
    } catch (err: any) {
      setError(err.message || 'Failed to load more files');
    } finally {
      setLoading(false);
    }
  }, [pageToken, lastQuery, loading]);

  const fetchContent = useCallback(async (file: DriveFile): Promise<string> => {
    return fetchDriveFileContent(file);
  }, []);

  return {
    configured,
    authenticated,
    files,
    loading,
    error,
    hasMore: !!pageToken,
    connect,
    search,
    loadMore,
    fetchContent,
  };
}
