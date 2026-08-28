// Tiny localStorage-backed favorites store, reused for saved filter colors,
// duotone pairs, and gradients. Fails silently if storage is unavailable
// (private browsing, quota, disabled) — favorites are a nice-to-have, never
// a hard requirement for the app to work.

const PREFIX = 'gooba:favorites:';
const MAX_ITEMS = 24;

export function loadFavorites(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveFavorites(key, list) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(list));
  } catch {
    // ignore — storage unavailable
  }
}

export function addFavorite(key, item) {
  const list = loadFavorites(key);
  list.unshift(item);
  const trimmed = list.slice(0, MAX_ITEMS);
  saveFavorites(key, trimmed);
  return trimmed;
}

export function removeFavorite(key, index) {
  const list = loadFavorites(key);
  list.splice(index, 1);
  saveFavorites(key, list);
  return list;
}
