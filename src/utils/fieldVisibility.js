const SYSTEM_FIELDS = new Set(['_id', 'createdAt', 'updatedAt']);

export function isSystemFieldName(name) {
  return SYSTEM_FIELDS.has(String(name || '').trim());
}

export function filterVisibleFields(fields = []) {
  const list = Array.isArray(fields) ? fields : [];
  return list.filter((f) => !isSystemFieldName(f?.name));
}

export function filterRowSystemFields(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return row;
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (isSystemFieldName(k)) continue;
    out[k] = v;
  }
  return out;
}
