import { useState, useEffect } from 'react';
import api from '../api/axios';
import { flushOfflineQueue, getOfflineQueue } from '../utils/offlineCache';
import { syncAllForOffline, getOfflineMeta } from '../utils/offlineSync';

export default function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [queuedCount, setQueuedCount] = useState(() => getOfflineQueue().length);
  const [syncedNotice, setSyncedNotice] = useState(0);

  useEffect(() => {
    const syncPending = async () => {
      if (!navigator.onLine) return;
      const token = localStorage.getItem('elimupap_token');
      if (!token) return;

      const count = await flushOfflineQueue(api);
      setQueuedCount(getOfflineQueue().length);
      if (count > 0) {
        setSyncedNotice(count);
        setTimeout(() => setSyncedNotice(0), 5000);
      }
    };

    const handleOnline = () => {
      setIsOnline(true);
      syncPending();
    };
    const handleOffline = () => setIsOnline(false);
    const handleQueueUpdate = (e) => {
      setQueuedCount(e?.detail?.count ?? getOfflineQueue().length);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('elimupap:queue-updated', handleQueueUpdate);

    // Flush any pending offline activity & do a quiet background sync if stale (>15 min)
    syncPending();
    if (navigator.onLine && localStorage.getItem('elimupap_token')) {
      const meta = getOfflineMeta();
      const stale = !meta?.syncedAt || (Date.now() - new Date(meta.syncedAt).getTime()) > 15 * 60 * 1000;
      if (stale) {
        setTimeout(() => {
          if (navigator.onLine) {
            syncAllForOffline({ includeFiles: true }).catch(() => {});
          }
        }, 2500);
      }
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('elimupap:queue-updated', handleQueueUpdate);
    };
  }, []);

  if (syncedNotice > 0 && isOnline) {
    return (
      <div
        role="status"
        className="w-full bg-emerald-500/15 border-b border-emerald-500/30 text-emerald-700 dark:text-emerald-300 px-4 py-2 text-xs font-medium flex items-center justify-center gap-2 z-50"
      >
        <span className="w-2 h-2 rounded-full bg-emerald-500" />
        <span>
          Back online — synced {syncedNotice} offline study session{syncedNotice === 1 ? '' : 's'}!
        </span>
      </div>
    );
  }

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="w-full bg-amber-500/15 border-b border-amber-500/30 text-amber-800 dark:text-amber-300 px-4 py-2 text-xs font-medium flex items-center justify-center gap-2 z-50"
    >
      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
      <span>
        Offline Mode — Saved notes, summaries, flashcards, study plan &amp; tutor history work offline.
        {queuedCount > 0 ? ` (${queuedCount} pending sync)` : ''}
      </span>
    </div>
  );
}
