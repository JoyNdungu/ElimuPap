import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { flushOfflineQueue, getOfflineQueue } from '../utils/offlineCache';
import { syncAllForOffline, getOfflineMeta } from '../utils/offlineSync';
import { flushOfflineUploads, getPendingUploads } from '../utils/offlineUploads';

export default function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [queuedCount, setQueuedCount] = useState(() => getOfflineQueue().length);
  const [pendingUploadCount, setPendingUploadCount] = useState(0);
  const [syncedNotice, setSyncedNotice] = useState(0);

  const refreshCounts = useCallback(async () => {
    const uploads = await getPendingUploads();
    setQueuedCount(getOfflineQueue().length);
    setPendingUploadCount(uploads.length);
  }, []);

  useEffect(() => {
    const runAutoSync = (force = false) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      if (!localStorage.getItem('elimupap_token')) return;

      const meta = getOfflineMeta();
      const stale = !meta?.syncedAt || (Date.now() - new Date(meta.syncedAt).getTime()) > 3 * 60 * 1000;
      if (force || stale) {
        syncAllForOffline({ includeFiles: true }).catch(() => {});
      }
    };

    const syncPending = async (autoPullBundle = false) => {
      if (!navigator.onLine) {
        await refreshCounts();
        return;
      }
      const token = localStorage.getItem('elimupap_token');
      if (!token) return;

      const [actionCount, uploadCount] = await Promise.all([
        flushOfflineQueue(api),
        flushOfflineUploads(api),
      ]);
      await refreshCounts();
      const total = actionCount + uploadCount;
      if (total > 0) {
        setSyncedNotice(total);
        setTimeout(() => setSyncedNotice(0), 5000);
        runAutoSync(true);
      } else if (autoPullBundle) {
        runAutoSync(false);
      }
    };

    const handleOnline = () => {
      setIsOnline(true);
      syncPending(true);
    };
    const handleOffline = () => {
      setIsOnline(false);
      refreshCounts();
    };
    const handleQueueUpdate = () => {
      refreshCounts();
    };
    const handleAuthOrDataChange = () => {
      // Automatically pull fresh notes/units/summaries for offline use right after login or edits
      setTimeout(() => runAutoSync(true), 800);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        syncPending(true);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('elimupap:queue-updated', handleQueueUpdate);
    window.addEventListener('elimupap:uploads-updated', handleQueueUpdate);
    window.addEventListener('elimupap:auth-changed', handleAuthOrDataChange);
    window.addEventListener('elimupap:data-changed', handleAuthOrDataChange);
    window.addEventListener('elimupap:uploads-synced', handleAuthOrDataChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Flush any pending offline activity/uploads & auto-sync offline bundle on startup
    syncPending(false);
    if (navigator.onLine && localStorage.getItem('elimupap_token')) {
      setTimeout(() => runAutoSync(false), 1500);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('elimupap:queue-updated', handleQueueUpdate);
      window.removeEventListener('elimupap:uploads-updated', handleQueueUpdate);
      window.removeEventListener('elimupap:auth-changed', handleAuthOrDataChange);
      window.removeEventListener('elimupap:data-changed', handleAuthOrDataChange);
      window.removeEventListener('elimupap:uploads-synced', handleAuthOrDataChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshCounts]);

  if (syncedNotice > 0 && isOnline) {
    return (
      <div
        role="status"
        className="w-full bg-emerald-500/15 border-b border-emerald-500/30 text-emerald-700 dark:text-emerald-300 px-4 py-2 text-xs font-medium flex items-center justify-center gap-2 z-50"
      >
        <span className="w-2 h-2 rounded-full bg-emerald-500" />
        <span>
          Back online — synced {syncedNotice} offline item{syncedNotice === 1 ? '' : 's'}!
        </span>
      </div>
    );
  }

  if (isOnline) return null;

  const totalPending = queuedCount + pendingUploadCount;

  return (
    <div
      role="status"
      className="w-full bg-amber-500/15 border-b border-amber-500/30 text-amber-800 dark:text-amber-300 px-4 py-2 text-xs font-medium flex items-center justify-center gap-2 z-50"
    >
      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
      <span>
        Offline Mode — Saved notes, offline uploads, summaries, flashcards, study plan &amp; tutor history work offline.
        {totalPending > 0 ? ` (${totalPending} pending sync)` : ''}
      </span>
    </div>
  );
}
