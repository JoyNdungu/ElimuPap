import api from '../api/axios';
import { saveCachedResponse, flushOfflineQueue } from './offlineCache';

export const FILES_CACHE_NAME = 'elimupap-files-v1';
const META_KEY = 'elimupap_offline_meta';
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export function getOfflineMeta() {
  try {
    const raw = localStorage.getItem(META_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function resolveNoteFileUrls(note) {
  const urls = [];
  if (note?.converted_pdf_filename) {
    urls.push(`${API_BASE}/converted/${note.converted_pdf_filename}`);
  }
  if (note?.safe_filename && !note?.file_url) {
    urls.push(`${API_BASE}/uploads/${note.safe_filename}`);
  }
  if (note?.file_url) {
    const u = note.file_url.startsWith('http') ? note.file_url : `${API_BASE}${note.file_url}`;
    urls.push(u);
  }
  return [...new Set(urls)];
}

/**
 * Resolve a binary file URL from Cache Storage (as an object URL) when offline
 * or when already pre-downloaded. Returns null if not cached.
 */
export async function getOfflineFileUrl(remoteUrl) {
  if (!remoteUrl || typeof caches === 'undefined') return null;
  try {
    const cache = await caches.open(FILES_CACHE_NAME);
    const match = await cache.match(remoteUrl);
    if (!match) return null;
    const blob = await match.blob();
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

/**
 * Download and store all study notes, extracted text, cached summaries,
 * study plan, exams, SRS flashcards, and attached PDF/DOCX/Audio files for offline use.
 */
export async function syncAllForOffline({ includeFiles = true, onProgress } = {}) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('You are currently offline. Connect to the internet to sync.');
  }

  const token = localStorage.getItem('elimupap_token');
  if (!token) return null;

  // 1. Push any queued offline reviews / timer sessions first
  await flushOfflineQueue(api);

  onProgress?.({ stage: 'bundle', label: 'Downloading notes, summaries & flashcards…' });

  const [bundleRes, statsRes] = await Promise.all([
    api.get('/ai/offline-bundle', { headers: { Authorization: `Bearer ${token}` } }),
    api.get('/progress/stats', { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
  ]);

  const bundle = bundleRes.data || {};
  const notes = Array.isArray(bundle.notes) ? bundle.notes : [];
  const summaries = bundle.summaries || {};

  // Save list endpoints to offlineCache
  const noteListLite = notes.map(({ extracted_text, ...rest }) => rest);
  saveCachedResponse('get', '/notes', null, noteListLite);
  notes.forEach((n) => {
    if (n?.id) {
      saveCachedResponse('get', `/notes/${n.id}`, null, n);
    }
  });

  Object.entries(summaries).forEach(([noteId, summaryData]) => {
    saveCachedResponse('post', '/ai/summary', { note_id: noteId }, summaryData);
  });

  if (Array.isArray(bundle.units)) {
    saveCachedResponse('get', '/units', null, bundle.units);
  }
  if (Array.isArray(bundle.exams)) {
    saveCachedResponse('get', '/exams', null, bundle.exams);
  }
  if (bundle.study_plan) {
    saveCachedResponse('get', '/study-plan/active', null, bundle.study_plan);
  }
  if (Array.isArray(bundle.srs_cards)) {
    saveCachedResponse('get', '/ai/srs/due', null, bundle.srs_cards);
  }
  if (statsRes?.data) {
    saveCachedResponse('get', '/progress/stats', null, statsRes.data);
  }

  // 2. Cache binary PDFs / DOCX / Audio files into Browser Cache Storage
  let fileCount = 0;
  if (includeFiles && typeof caches !== 'undefined') {
    const fileUrls = [];
    notes.forEach((n) => {
      resolveNoteFileUrls(n).forEach((u) => fileUrls.push(u));
    });
    const uniqueUrls = [...new Set(fileUrls)];

    if (uniqueUrls.length > 0) {
      const cache = await caches.open(FILES_CACHE_NAME);
      for (let i = 0; i < uniqueUrls.length; i++) {
        const url = uniqueUrls[i];
        onProgress?.({
          stage: 'files',
          label: `Saving document ${i + 1} of ${uniqueUrls.length} for offline reading…`,
        });
        try {
          const existing = await cache.match(url);
          if (existing) {
            fileCount++;
            continue;
          }
          const res = await fetch(url, { mode: 'cors' });
          if (res && res.ok) {
            await cache.put(url, res.clone());
            fileCount++;
          }
        } catch {
          // Skip individual file fetch failures (e.g. missing local file)
        }
      }
    }
  }

  const meta = {
    syncedAt: new Date().toISOString(),
    noteCount: notes.length,
    summaryCount: Object.keys(summaries).length,
    fileCount,
  };
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
    window.dispatchEvent(new CustomEvent('elimupap:offline-synced', { detail: meta }));
  } catch {}

  return meta;
}
