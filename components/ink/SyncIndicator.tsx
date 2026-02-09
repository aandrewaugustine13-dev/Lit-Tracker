import React from 'react';
import { SyncStatus } from '../../services/cloudSync';

interface Props {
  status: SyncStatus;
}

export const SyncIndicator: React.FC<Props> = ({ status }) => {
  const getIcon = () => {
    switch (status.status) {
      case 'saving':
        return (
          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="32" strokeLinecap="round" />
          </svg>
        );
      case 'saved':
        return (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
          </svg>
        );
    }
  };

  const getLabel = () => {
    switch (status.status) {
      case 'saving':
        return 'Saving...';
      case 'saved':
        return 'Saved';
      case 'error':
        return 'Sync error';
      default:
        return 'Ready';
    }
  };

  const getColor = () => {
    switch (status.status) {
      case 'saving':
        return 'text-ember-400';
      case 'saved':
        return 'text-green-400';
      case 'error':
        return 'text-red-400';
      default:
        return 'text-steel-500';
    }
  };

  return (
    <div className={`flex items-center gap-2 text-xs ${getColor()}`} title={status.error}>
      {getIcon()}
      <span>{getLabel()}</span>
    </div>
  );
};
