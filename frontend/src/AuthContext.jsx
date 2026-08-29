import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  becomeReceiver,
  clearTokens,
  getAccessToken,
  getMe,
  loginAccount,
  registerAccount,
  setTokens,
  updateMe,
} from "./api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) {
      setReady(true);
      return;
    }
    getMe()
      .then(setUser)
      .catch(() => {
        clearTokens();
        setUser(null);
      })
      .finally(() => setReady(true));
  }, []);

  async function applyAuth(data) {
    setTokens(data);
    setUser(data.user);
    return data.user;
  }

  const value = useMemo(
    () => ({
      user,
      ready,
      isAuthenticated: Boolean(user),
      roles: user?.roles || [],
      isReceiver: Boolean(user?.is_receiver),
      hasOrganization: Boolean(user?.organization),
      async login(email, password) {
        return applyAuth(await loginAccount({ email, password }));
      },
      async register(payload) {
        return applyAuth(await registerAccount(payload));
      },
      async refreshMe() {
        const next = await getMe();
        setUser(next);
        return next;
      },
      async saveProfile(payload) {
        const next = await updateMe(payload);
        setUser(next);
        return next;
      },
      async enableReceiver() {
        return applyAuth(await becomeReceiver());
      },
      logout() {
        clearTokens();
        setUser(null);
      },
    }),
    [user, ready]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
