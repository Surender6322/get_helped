import { useEffect, useState } from 'react';
import { subscribeToasts } from '../utils/notifications.js';

export default function ToastHost() {
  const [items, setItems] = useState([]); // { id, title, body, onClick }

  useEffect(
    () =>
      subscribeToasts(({ title, body, onClick }) => {
        const id = Math.random().toString(36).slice(2);
        setItems((cur) => [...cur, { id, title, body, onClick }]);
        setTimeout(() => {
          setItems((cur) => cur.filter((t) => t.id !== id));
        }, 5000);
      }),
    []
  );

  if (items.length === 0) return null;

  return (
    <div className="toast-host" aria-live="polite">
      {items.map((t) => (
        <button
          key={t.id}
          type="button"
          className="toast"
          onClick={() => {
            t.onClick?.();
            setItems((cur) => cur.filter((x) => x.id !== t.id));
          }}
        >
          <div className="toast-title">{t.title}</div>
          {t.body && <div className="toast-body">{t.body}</div>}
        </button>
      ))}
    </div>
  );
}
