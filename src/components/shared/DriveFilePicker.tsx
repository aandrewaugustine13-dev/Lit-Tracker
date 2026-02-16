import React, { useState, useEffect, useRef } from 'react';
import { X, Search, FileText, File, Loader2, HardDrive, ChevronRight, RefreshCw } from 'lucide-react';
import { useGoogleDrive } from '../../hooks/useGoogleDrive';
import { DriveFile } from '../../services/googleDrive';

// =============================================================================
// DRIVE FILE PICKER — Browse Google Drive and select a script file
// =============================================================================

interface DriveFilePickerProps {
  /** Called with the file's text content and filename */
  onSelect: (content: string, filename: string) => void;
  onClose: () => void;
}

/** Format bytes to human readable */
function formatSize(bytes: string | undefined): string {
  if (!bytes) return '';
  const n = parseInt(bytes, 10);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Format ISO date to relative/short string */
function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Get file type label */
function fileTypeLabel(mimeType: string): string {
  if (mimeType === 'application/vnd.google-apps.document') return 'Google Doc';
  if (mimeType === 'text/plain') return 'Text';
  if (mimeType === 'text/markdown') return 'Markdown';
  return 'File';
}

export const DriveFilePicker: React.FC<DriveFilePickerProps> = ({ onSelect, onClose }) => {
  const drive = useGoogleDrive();
  const [searchInput, setSearchInput] = useState('');
  const [fetchingFile, setFetchingFile] = useState<string | null>(null); // file ID being fetched
  const [fetchError, setFetchError] = useState<string | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Connect on mount if configured
  useEffect(() => {
    if (drive.configured && !drive.authenticated && !drive.loading) {
      drive.connect();
    }
  }, [drive.configured]);

  // Debounced search
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!drive.authenticated) return;

    searchTimeout.current = setTimeout(() => {
      drive.search(searchInput);
    }, 400);

    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [searchInput]);

  const handleFileClick = async (file: DriveFile) => {
    setFetchingFile(file.id);
    setFetchError(null);
    try {
      const content = await drive.fetchContent(file);
      if (!content || content.trim().length === 0) {
        setFetchError('File appears to be empty.');
        setFetchingFile(null);
        return;
      }
      onSelect(content, file.name);
    } catch (err: any) {
      setFetchError(err.message || 'Failed to fetch file content');
      setFetchingFile(null);
    }
  };

  // Infinite scroll
  const handleScroll = () => {
    if (!listRef.current || !drive.hasMore || drive.loading) return;
    const { scrollTop, scrollHeight, clientHeight } = listRef.current;
    if (scrollHeight - scrollTop - clientHeight < 100) {
      drive.loadMore();
    }
  };

  // ─── Not configured ────────────────────────────────────────────────────────
  if (!drive.configured) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm">
        <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md border border-stone-200 p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-xl text-ink">Google Drive</h2>
            <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-lg transition-colors">
              <X className="w-5 h-5 text-stone-500" />
            </button>
          </div>
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center mx-auto">
              <HardDrive className="w-8 h-8 text-stone-400" />
            </div>
            <p className="text-sm text-stone-600 leading-relaxed">
              Google Drive integration needs a Client ID to work. Add this to your <code className="text-xs bg-stone-100 px-1.5 py-0.5 rounded">.env</code> file:
            </p>
            <pre className="text-xs bg-stone-50 border border-stone-200 rounded-lg p-3 text-left text-stone-700 overflow-x-auto">
              VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
            </pre>
            <p className="text-xs text-stone-500">
              Get this from the Google Cloud Console under APIs &amp; Services → Credentials → OAuth 2.0 Client IDs.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Connecting / Auth needed ──────────────────────────────────────────────
  if (!drive.authenticated && !drive.loading && drive.error) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm">
        <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md border border-stone-200 p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-xl text-ink">Google Drive</h2>
            <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-lg transition-colors">
              <X className="w-5 h-5 text-stone-500" />
            </button>
          </div>
          <div className="text-center space-y-4">
            <p className="text-sm text-red-600">{drive.error}</p>
            <button
              onClick={drive.connect}
              className="px-6 py-2.5 bg-ember-500 hover:bg-ember-600 text-white rounded-lg font-body font-semibold text-sm transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── File picker ───────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col border border-stone-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <HardDrive className="w-5 h-5 text-ember-500" />
            <h2 className="font-display text-lg text-ink">Google Drive</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-stone-500" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-stone-100 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search your files..."
              className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm text-ink placeholder:text-stone-400 focus:outline-none focus:border-ember-500 focus:ring-1 focus:ring-ember-500/20 transition-all"
              autoFocus
            />
          </div>
        </div>

        {/* File list */}
        <div ref={listRef} onScroll={handleScroll} className="flex-1 overflow-y-auto min-h-0">
          {drive.loading && drive.files.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="w-6 h-6 text-stone-400 animate-spin" />
              <p className="text-sm text-stone-500">
                {drive.authenticated ? 'Loading files...' : 'Connecting to Google Drive...'}
              </p>
            </div>
          ) : drive.files.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <FileText className="w-8 h-8 text-stone-300" />
              <p className="text-sm text-stone-500">
                {searchInput ? 'No files match your search' : 'No text files found'}
              </p>
              {searchInput && (
                <button
                  onClick={() => setSearchInput('')}
                  className="text-xs text-ember-500 hover:underline"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-stone-100">
              {drive.files.map((file) => {
                const isFetching = fetchingFile === file.id;
                return (
                  <button
                    key={file.id}
                    onClick={() => handleFileClick(file)}
                    disabled={!!fetchingFile}
                    className="w-full px-5 py-3 flex items-center gap-3 hover:bg-stone-50 transition-colors text-left disabled:opacity-50 group"
                  >
                    <div className="w-9 h-9 rounded-lg bg-stone-100 group-hover:bg-stone-200 flex items-center justify-center flex-shrink-0 transition-colors">
                      {isFetching ? (
                        <Loader2 className="w-4 h-4 text-ember-500 animate-spin" />
                      ) : file.mimeType === 'application/vnd.google-apps.document' ? (
                        <FileText className="w-4 h-4 text-blue-500" />
                      ) : (
                        <File className="w-4 h-4 text-stone-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-ink font-body truncate">{file.name}</p>
                      <p className="text-[11px] text-stone-500 flex items-center gap-2">
                        <span>{fileTypeLabel(file.mimeType)}</span>
                        {file.size && (
                          <>
                            <span className="text-stone-300">·</span>
                            <span>{formatSize(file.size)}</span>
                          </>
                        )}
                        <span className="text-stone-300">·</span>
                        <span>{formatDate(file.modifiedTime)}</span>
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-stone-500 flex-shrink-0 transition-colors" />
                  </button>
                );
              })}

              {/* Load more / Loading indicator */}
              {drive.loading && drive.files.length > 0 && (
                <div className="py-3 flex justify-center">
                  <Loader2 className="w-4 h-4 text-stone-400 animate-spin" />
                </div>
              )}
              {drive.hasMore && !drive.loading && (
                <button
                  onClick={drive.loadMore}
                  className="w-full py-3 text-xs text-ember-500 hover:text-ember-600 font-body font-semibold transition-colors"
                >
                  Load more files
                </button>
              )}
            </div>
          )}
        </div>

        {/* Error bar */}
        {(drive.error || fetchError) && (
          <div className="px-5 py-3 border-t border-red-100 bg-red-50 flex items-center gap-2 flex-shrink-0">
            <X className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-xs text-red-700 flex-1">{fetchError || drive.error}</p>
            <button
              onClick={() => { setFetchError(null); drive.connect(); }}
              className="p-1 hover:bg-red-100 rounded transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5 text-red-500" />
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 border-t border-stone-200 bg-stone-50 rounded-b-2xl flex-shrink-0">
          <p className="text-[10px] text-stone-500 text-center">
            Showing text files, Google Docs, and scripts from your Drive
          </p>
        </div>
      </div>
    </div>
  );
};
