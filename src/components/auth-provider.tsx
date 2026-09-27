"use client";
import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "@/lib/client-api";
import type { SessionUser } from "@/lib/auth";

export type Portal = "vendor" | "manager";

interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
  login: (
    username: string,
    password: string,
    setup?: boolean,
    fullName?: string,
    portal?: "admin"
  ) => Promise<{ ok: boolean; error?: string }>;
  loginWithPin: (userId: number, pin: string, portal?: Portal) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const res = await api.get<SessionUser>("/api/auth/me");
    if (res.ok && res.data) {
      setUser(res.data);
    } else {
      setUser(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (
    username: string,
    password: string,
    setup = false,
    fullName?: string,
    portal?: "admin"
  ) => {
    const res = await api.post<SessionUser>("/api/auth/login", { username, password, setup, fullName, portal });
    if (res.ok && res.data) {
      setUser(res.data);
      return { ok: true };
    }
    return { ok: false, error: res.error || "Erreur de connexion" };
  };

  const loginWithPin = async (userId: number, pin: string, portal?: Portal) => {
    const res = await api.post<SessionUser>("/api/auth/pin", { userId, pin, portal });
    if (res.ok && res.data) {
      setUser(res.data);
      return { ok: true };
    }
    return { ok: false, error: res.error || "Code incorrect" };
  };

  const logout = async () => {
    await api.post("/api/auth/logout");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithPin, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
