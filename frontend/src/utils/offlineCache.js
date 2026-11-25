const PREFIX = 'elimupap_cache:';
const QUEUE_KEY = 'elimupap_sync_queue';

const CACHEABLE_GET_PREFIXES = [
  '/units',
  '/notes',
  '/exams',
  '/study-plan',
  '/progress/stats',
  '/ai/srs/due',
  '/ai/past-papers',
  '/ai/knowledge-graph',
  '/ai/tutor/conversations',
];

const CACHEABLE_POST_PATHS = [
  '/ai/summary',
  '/ai/flashcards',
  '/ai/mindmap',
  '/ai/quiz',
];

const QUEUEABLE_POST_PATHS = [
  '/ai/srs/review',
  '/progress/activity',
  '/progress/view',
];

function normalizePath(url) {
  const clean = (url || '').split('?')[0];
  return clean.length > 1 && clean.endsWith('/') ? clean.slice(0, -1) : clean;
}

export function buildCacheKey(method, url, data) {
  const cleanPath = normalizePath(url);
  const query = (url || '').includes('?') ? `?${url.split('?')[1]}` : '';
  if (method === 'get') {
    return `${PREFIX}GET:${cleanPath}${query}`;
  }
  if (method === 'post' && CACHEABLE_POST_PATHS.some((p) => cleanPath.endsWith(p))) {
    let bodyObj = {};
    try {
      bodyObj = typeof data === 'string' ? JSON.parse(data) : (data || {});
    } catch (_) {
      bodyObj = {};
    }
    const noteId = bodyObj.note_id || 'default';
    return `${PREFIX}POST:${cleanPath}:${noteId}`;
  }
  return null;
}

export function isCacheable(method, url) {
  const m = (method || 'get').toLowerCase();
  const cleanPath = normalizePath(url);
  if (m === 'get') {
    return CACHEABLE_GET_PREFIXES.some((p) => cleanPath.startsWith(p));
  }
  if (m === 'post') {
    return CACHEABLE_POST_PATHS.some((p) => cleanPath.endsWith(p));
  }
  return false;
}

export function isQueueableMutation(method, url) {
  const m = (method || '').toLowerCase();
  if (m !== 'post') return false;
  const cleanPath = normalizePath(url);
  return QUEUEABLE_POST_PATHS.some((p) => cleanPath.endsWith(p));
}

export function saveCachedResponse(method, url, requestData, responseData) {
  if (!isCacheable(method, url)) return;
  const key = buildCacheKey(method.toLowerCase(), url, requestData);
  if (!key) return;
  try {
    const payload = JSON.stringify({
      savedAt: Date.now(),
      data: responseData,
    });
    localStorage.setItem(key, payload);
  } catch (err) {
    // If localStorage quota is full, evict oldest cache entries
    try {
      const keys = Object.keys(localStorage).filter((k) => k.startsWith(PREFIX));
      for (let i = 0; i < Math.min(5, keys.length); i++) {
        localStorage.removeItem(keys[i]);
      }
      localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data: responseData }));
    } catch (_) {
      // Ignore storage errors silently
    }
  }
}

export function getCachedResponse(method, url, requestData) {
  if (!isCacheable(method, url)) return null;
  const key = buildCacheKey(method.toLowerCase(), url, requestData);
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.data ?? null;
  } catch (_) {
    return null;
  }
}

/**
 * Offline fallback quiz builder: if a student clicks Quiz while offline for a note
 * that already has a cached summary, build an interactive multiple-choice / recall
 * quiz from the cached definitions, quick_quiz, and key_points.
 */
export function buildOfflineQuizFromCache(requestData) {
  let bodyObj = {};
  try {
    bodyObj = typeof requestData === 'string' ? JSON.parse(requestData) : (requestData || {});
  } catch (_) {
    return null;
  }
  const noteId = bodyObj.note_id;
  if (!noteId) return null;

  const summary = getCachedResponse('post', '/ai/summary', { note_id: noteId });
  if (!summary) return null;

  const questions = [];
  const defs = Array.isArray(summary.definitions) ? summary.definitions : [];

  // Create multiple-choice questions from definitions if at least 2 terms exist
  if (defs.length >= 2) {
    defs.forEach((d, idx) => {
      if (!d?.term || !d?.definition) return;
      const distractors = defs
        .filter((_, j) => j !== idx)
        .map((other) => other.term)
        .slice(0, 3);
      while (distractors.length < 3) {
        distractors.push(`Concept ${distractors.length + 1}`);
      }
      const options = [d.term, ...distractors].sort((a, b) => a.localeCompare(b));
      questions.push({
        type: 'multiple_choice',
        question: `Which term best matches this definition: "${d.definition}"`,
        options,
        correct_answer: d.term,
        explanation: `${d.term}: ${d.definition}`,
      });
    });
  }

  // Add self-check text questions from quick_quiz
  const quick = Array.isArray(summary.quick_quiz) ? summary.quick_quiz : [];
  quick.forEach((qText, i) => {
    const fallbackAns = (summary.key_points && summary.key_points[i]) || summary.deck_overview || 'Review your summary takeaways.';
    questions.push({
      type: 'text_answer',
      question: qText,
      options: [],
      correct_answer: fallbackAns,
      explanation: fallbackAns,
    });
  });

  if (questions.length === 0) return null;

  return {
    quiz_title: `${summary.title || 'Offline'} (Offline Practice Quiz)`,
    questions: questions.slice(0, Number(bodyObj.num_questions) || 5),
    offline_generated: true,
  };
}

// ── Offline Mutation Queue (SRS reviews, study timer, activity logs) ──────────
export function getOfflineQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function enqueueOfflineAction(method, url, data) {
  try {
    const queue = getOfflineQueue();
    let parsedData = data;
    if (typeof data === 'string') {
      try { parsedData = JSON.parse(data); } catch {}
    }
    queue.push({
      id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      method: (method || 'post').toLowerCase(),
      url,
      data: parsedData,
      createdAt: Date.now(),
    });
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-100)));
    window.dispatchEvent(new CustomEvent('elimupap:queue-updated', { detail: { count: queue.length } }));
  } catch {
    // ignore storage errors
  }
}

export async function flushOfflineQueue(apiInstance) {
  const queue = getOfflineQueue();
  if (!queue.length || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    return 0;
  }

  const remaining = [];
  let synced = 0;

  for (const item of queue) {
    try {
      await apiInstance.request({
        method: item.method || 'post',
        url: item.url,
        data: item.data,
      });
      synced++;
    } catch (err) {
      if (!err?.response) {
        remaining.push(item); // Still offline — stop and keep remaining
      }
      // If 4xx/5xx server error, drop bad entry so queue doesn't block forever
    }
  }

  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
    window.dispatchEvent(new CustomEvent('elimupap:queue-updated', { detail: { count: remaining.length } }));
  } catch {}

  return synced;
}
