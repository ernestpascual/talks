const STORAGE_KEY = "admin-auth";
const PASSWORD_KEY = "admin-password";
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

export function getAdminPassword(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(PASSWORD_KEY) || "";
}

export async function login(password: string): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!password || !password.trim()) return false;

  try {
    const res = await fetch("/api/admin/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: password.trim() }),
    });

    const data = await res.json();
    if (data.success) {
      const session: AdminSession = { loggedInAt: Date.now() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      localStorage.setItem(PASSWORD_KEY, password.trim());
      return true;
    }
    return false;
  } catch (err) {
    console.error("Admin auth request error:", err);
    return false;
  }
}

export function logout(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(PASSWORD_KEY);
}
