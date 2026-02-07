const STORAGE_KEY = 'banco-imobiliario-state-v1';

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (_error) {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function clearState() {
  localStorage.removeItem(STORAGE_KEY);
}
