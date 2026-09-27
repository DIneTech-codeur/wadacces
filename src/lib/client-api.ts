/**
 * Minimal typed API client for the browser.
 */
import type { ApiResponse } from "@/types";

async function request<T>(
  url: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      credentials: "include",
    });
    const data = await res.json().catch(() => ({ ok: false, error: "Erreur réseau" }));
    if (!res.ok && !data.error) {
      data.error = `Erreur ${res.status}`;
    }
    return data as ApiResponse<T>;
  } catch (e: any) {
    return { ok: false, error: e?.message || "Erreur réseau" };
  }
}

export const api = {
  get: <T>(url: string) => request<T>(url),
  post: <T>(url: string, body?: unknown) =>
    request<T>(url, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(url: string, body?: unknown) =>
    request<T>(url, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(url: string) => request<T>(url, { method: "DELETE" }),
};
