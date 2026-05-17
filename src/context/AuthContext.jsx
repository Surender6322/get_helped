import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { flushSync } from 'react-dom';
import {
  watchAuth,
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
} from '../services/api.js';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Cross-tab / external auth changes (e.g. another tab signing out) still
  // flow through the watcher. Same-tab sign-in/out also goes through this,
  // but we *additionally* commit state synchronously below so callers can
  // trust that `user` is up-to-date the moment `await login()` resolves.
  useEffect(() => {
    const unsub = watchAuth((u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  // Wrap each auth mutation so that:
  //   1. The API call runs.
  //   2. We *synchronously* flush the new auth state into React via
  //      flushSync. This guarantees that by the time the promise resolves
  //      in the caller, `useAuth().user` already reflects the new value —
  //      so an immediate `navigate()` always lands on the right route.
  const login = useCallback(async (creds) => {
    const u = await apiLogin(creds);
    flushSync(() => {
      setUser(u);
      setLoading(false);
    });
    return u;
  }, []);

  const register = useCallback(async (creds) => {
    const u = await apiRegister(creds);
    flushSync(() => {
      setUser(u);
      setLoading(false);
    });
    return u;
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    flushSync(() => {
      setUser(null);
      setLoading(false);
    });
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
