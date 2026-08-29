const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const ACCESS_KEY = "im_access";
const REFRESH_KEY = "im_refresh";

export function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY);
}

export function setTokens({ access, refresh }) {
  if (access) localStorage.setItem(ACCESS_KEY, access);
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

function formatError(data) {
  if (!data) return "Request failed";
  if (typeof data.detail === "string") return data.detail;
  if (Array.isArray(data.detail)) {
    const first = data.detail[0];
    return typeof first === "string" ? first : first?.string || "Request failed";
  }
  const firstKey = Object.keys(data)[0];
  if (!firstKey) return "Request failed";
  const value = data[firstKey];
  if (Array.isArray(value)) return value[0];
  if (typeof value === "string") return value;
  return "Request failed";
}

async function refreshAccess() {
  const refresh = localStorage.getItem(REFRESH_KEY);
  if (!refresh) return false;
  const response = await fetch(`${API}/api/auth/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });
  if (!response.ok) {
    clearTokens();
    return false;
  }
  const data = await response.json();
  if (data.access) localStorage.setItem(ACCESS_KEY, data.access);
  return Boolean(data.access);
}

async function request(path, options = {}, retry = true) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API}${path}`, { ...options, headers });
  const skipRefresh = ["/api/auth/login/", "/api/auth/register/", "/api/auth/refresh/"];
  if (
    response.status === 401 &&
    retry &&
    localStorage.getItem(REFRESH_KEY) &&
    !skipRefresh.includes(path)
  ) {
    const refreshed = await refreshAccess();
    if (refreshed) return request(path, options, false);
  }
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(formatError(data));
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export function getStats() {
  return request("/api/stats/");
}

export function getOrganizations() {
  return request("/api/organizations/");
}

export function getOrganization(id) {
  return request(`/api/organizations/${id}/`);
}

export function analyzeDonation(payload) {
  return request("/api/donations/analyze/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getDonationMatches(id) {
  return request(`/api/donations/${id}/matches/`);
}

export function createNeed(orgId, payload) {
  return request(`/api/organizations/${orgId}/needs/`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateNeed(id, payload) {
  return request(`/api/needs/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteNeed(id) {
  return request(`/api/needs/${id}/`, { method: "DELETE" });
}

export function registerAccount(payload) {
  return request("/api/auth/register/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function loginAccount(payload) {
  return request("/api/auth/login/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getMe() {
  return request("/api/auth/me/");
}

export function updateMe(payload) {
  return request("/api/auth/me/", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function becomeReceiver() {
  return request("/api/auth/become-receiver/", { method: "POST" });
}

export function getMyOrganization() {
  return request("/api/organizations/me/");
}

export function createMyOrganization(payload) {
  return request("/api/organizations/me/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateMyOrganization(payload) {
  return request("/api/organizations/me/", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function getMyDonations() {
  return request("/api/donations/mine/");
}
