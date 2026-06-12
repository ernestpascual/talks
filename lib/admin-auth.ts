import { ADMIN_PASSWORD } from "./admin-config";

const STORAGE_KEY = "admin-auth";
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

type AdminSession = {
  loggedInAt: number;
};

function getSession(): AdminSession | null {
  if (typeof window === "undefined") return null;

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AdminSession;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function isAuthenticated(): boolean {
  const session = getSession();
  if (!session) return false;

  if (Date.now() - session.loggedInAt > SESSION_MS) {
    logout();
    return false;
  }

  return true;
}

export function login(password: string): boolean {
  if (typeof window === "undefined") return false;
  if (password !== ADMIN_PASSWORD) return false;

  const session: AdminSession = { loggedInAt: Date.now() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  localStorage.setItem("admin-password", password);
  return true;
}

export function logout(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem("admin-password");
}
