import React, { useEffect, useMemo, useState } from 'react';
import styles from './ShareDashboardModal.module.css';

export default function ShareDashboardModal({
  open,
  dashboardId,
  onClose,
  onShared,
}) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);

  const [selected, setSelected] = useState([]); // { userId, email, name, role }
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = useMemo(
    () => !!dashboardId && selected.length > 0 && !submitting,
    [dashboardId, selected.length, submitting]
  );

  // Debounced async search, react-select-like behavior.
  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const q = query.trim();
    if (!q) {
      setSuggestions([]);
      setSearching(false);
      return undefined;
    }

    setSearching(true);
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/auth/search-users?email=${encodeURIComponent(q)}`
        );
        const data = await res.json().catch(() => []);
        if (!cancelled) {
          if (res.ok) setSuggestions(Array.isArray(data) ? data : []);
          else setSuggestions([]);
        }
      } catch {
        if (!cancelled) setSuggestions([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [open, query]);

  // Reset state on open
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setSuggestions([]);
    setSearching(false);
    setSelected([]);
    setSubmitError('');
    setSubmitting(false);
  }, [open]);

  const selectedIdSet = useMemo(
    () => new Set(selected.map((s) => String(s.userId))),
    [selected]
  );

  const addUser = (u) => {
    if (!u?.id) return;
    const idStr = String(u.id);
    if (selectedIdSet.has(idStr)) return;
    setSelected((prev) => [
      ...prev,
      { userId: u.id, email: u.email, name: u.name, role: 'Viewer' },
    ]);

    // Remove from current dropdown result list. If this was the last visible suggestion,
    // close dropdown and clear the search text.
    setSuggestions((prev) => {
      const next = prev.filter((x) => String(x.id) !== idStr);
      if (next.length === 0) {
        setQuery('');
        setSearching(false);
      }
      return next;
    });
  };

  const removeUser = (userId) => {
    const idStr = String(userId);
    setSelected((prev) => prev.filter((x) => String(x.userId) !== idStr));
  };

  const updateRole = (userId, role) => {
    const idStr = String(userId);
    setSelected((prev) =>
      prev.map((x) => (String(x.userId) === idStr ? { ...x, role } : x))
    );
  };

  const clearQuery = () => {
    setQuery('');
    setSuggestions([]);
    setSearching(false);
  };

  const submitShare = async () => {
    if (!dashboardId) return;
    setSubmitError('');
    setSubmitting(true);
    try {
      const payload = {
        shares: selected.map((s) => ({
          userId: s.userId,
          email: s.email,
          role: s.role,
        })),
      };

      const res = await fetch(`/api/bi/dashboards/${dashboardId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitError(data?.error || 'Failed to share dashboard');
        return;
      }

      onShared?.(data);
      onClose?.();
    } catch (e) {
      setSubmitError(e.message || 'Failed to share dashboard');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className={styles.overlay}
      role='dialog'
      aria-modal='true'
      aria-labelledby='share-dashboard-title'
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose?.()}
      tabIndex={-1}
    >
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <h3 className={styles.title} id='share-dashboard-title'>
              Share dashboard
            </h3>
            <p className={styles.subtitle}>
              Search users by email, assign roles, and send access.
            </p>
          </div>
          <button
            type='button'
            className={styles.closeBtn}
            onClick={onClose}
            aria-label='Close'
          >
            X
          </button>
        </div>

        <label className={styles.fieldLabel} htmlFor='share-user-email'>
          Add users by email
        </label>
        <div className={styles.asyncWrap}>
          <input
            id='share-user-email'
            className={styles.input}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Type email to search...'
            autoComplete='off'
            disabled={submitting}
          />

          {query.trim() && !submitting ? (
            <button
              type='button'
              className={styles.clearBtn}
              onClick={clearQuery}
              aria-label='Clear email input'
              title='Clear'
            >
              ×
            </button>
          ) : null}

          {suggestions.length > 0 ? (
            <div className={styles.suggestions} role='listbox'>
              {suggestions.map((u) => {
                const idStr = String(u.id);
                const disabled = selectedIdSet.has(idStr);
                return (
                  <button
                    key={idStr}
                    type='button'
                    className={styles.suggestionRow}
                    onClick={() => addUser(u)}
                    disabled={disabled}
                    title={disabled ? 'Already selected' : 'Add user'}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div className={styles.suggEmail}>{u.email}</div>
                      {u.name ? (
                        <div className={styles.suggName}>{u.name}</div>
                      ) : null}
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: 12 }}>
                      {disabled ? 'Added' : 'Add'}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : query.trim() && searching ? (
            <div className={styles.suggestions} style={{ padding: 12 }}>
              Searching...
            </div>
          ) : null}
        </div>

        {selected.length > 0 ? (
          <div className={styles.tagWrap} aria-label='Selected users'>
            {selected.map((s) => (
              <div key={String(s.userId)} className={styles.tag}>
                <span className={styles.tagEmail}>{s.email}</span>
                <select
                  className={styles.roleSelect}
                  value={s.role}
                  disabled={submitting}
                  onChange={(e) => updateRole(s.userId, e.target.value)}
                  aria-label={`Role for ${s.email}`}
                >
                  <option value='Viewer'>Viewer</option>
                  <option value='Editor'>Editor</option>
                </select>
                <button
                  type='button'
                  className={styles.removeBtn}
                  onClick={() => removeUser(s.userId)}
                  disabled={submitting}
                  aria-label={`Remove ${s.email}`}
                  title='Remove'
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {submitError ? <div className={styles.error}>{submitError}</div> : null}

        <div className={styles.actions}>
          <button
            type='button'
            className={styles.btnSecondary}
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type='button'
            className={styles.btnPrimary}
            onClick={submitShare}
            disabled={!canSubmit}
            aria-busy={submitting}
          >
            {submitting ? (
              <>
                <span className={styles.spinner} aria-hidden />
                Sharing...
              </>
            ) : (
              'Share'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
