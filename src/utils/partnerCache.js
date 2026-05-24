// Shared, module-level cache for chat-partner profiles. Multiple pages
// (Chat list, dashboards) all need to render the partner's display name
// next to a chat preview, and previously each page rolled its own loop:
//
//   for (const c of chats) {
//     if (!map[c.userUid]) map[c.userUid] = await getUser(c.userUid);
//   }
//
// That fetched every partner SEQUENTIALLY on every chats update — even
// for chats that aren't rendered (`chats.slice(0, 4)`). With ~100 chats
// the dashboard sat there for many seconds. This module fixes both
// problems: cache survives across mounts/navigation, and concurrent
// callers for the same uid share a single in-flight request.

import { useEffect, useState } from 'react';
import { getUser } from '../services/api.js';

const cache = new Map();
const inflight = new Map();

export function getCachedPartner(uid) {
  return cache.get(uid) || null;
}

export function fetchPartnerCached(uid) {
  if (cache.has(uid)) return Promise.resolve(cache.get(uid));
  if (inflight.has(uid)) return inflight.get(uid);
  const p = (async () => {
    try {
      const u = await getUser(uid);
      const value = u || { displayName: 'Unknown' };
      cache.set(uid, value);
      return value;
    } finally {
      inflight.delete(uid);
    }
  })();
  inflight.set(uid, p);
  return p;
}

export function setCachedPartner(uid, value) {
  cache.set(uid, value || { displayName: 'Unknown' });
}

/**
 * React hook: given a list of partner uids, returns a map
 * { [uid]: { displayName, ... } } that fills in as data arrives.
 *
 * Cached uids hydrate synchronously on mount (no flicker for chats the
 * user has seen before in this session). Uncached uids are fetched in
 * PARALLEL — not sequentially — so the dashboard doesn't wait on 100
 * round-trips when it only needs 4 names.
 */
export function usePartnerNames(uids) {
  const key = (uids || []).join('|');
  const [names, setNames] = useState(() => {
    const seed = {};
    for (const uid of uids || []) {
      const c = cache.get(uid);
      if (c) seed[uid] = c;
    }
    return seed;
  });

  useEffect(() => {
    if (!uids || uids.length === 0) return;
    let cancelled = false;

    // Hydrate cache hits immediately, even on re-mount.
    const hydrated = {};
    let hadHit = false;
    for (const uid of uids) {
      const c = cache.get(uid);
      if (c) { hydrated[uid] = c; hadHit = true; }
    }
    if (hadHit) setNames((prev) => ({ ...prev, ...hydrated }));

    const todo = uids.filter((uid) => !cache.has(uid));
    if (todo.length === 0) return;

    Promise.all(todo.map(fetchPartnerCached)).then((results) => {
      if (cancelled) return;
      const patch = {};
      todo.forEach((uid, i) => { patch[uid] = results[i]; });
      setNames((prev) => ({ ...prev, ...patch }));
    });

    return () => { cancelled = true; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return names;
}
