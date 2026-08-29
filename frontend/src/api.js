function resolveApiBase() {
  const isProd = import.meta.env.PROD;
  let raw = (import.meta.env.VITE_API_URL || "").trim();
  if (!raw) {
    raw = isProd
      ? "https://impactbackend-production.up.railway.app"
      : "http://127.0.0.1:8000";
  }
  if (!/^https?:\/\//i.test(raw)) {
    raw = `https://${raw}`;
  }
  return raw.replace(/\/$/, "").replace(/\/api$/i, "");
}

const API = resolveApiBase();

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

function orgFormData(payload, file) {
  const form = new FormData();
  Object.entries(payload || {}).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    form.append(key, typeof value === "boolean" ? String(value) : value);
  });
  if (file) form.append("image", file);
  return form;
}

async function request(path, options = {}, retry = true) {
  const headers = { ...(options.headers || {}) };
  const isForm = typeof FormData !== "undefined" && options.body instanceof FormData;
  if (!isForm && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
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

export function getOrganizations(params = {}) {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.location) query.set("location", params.location);
  if (params.category) query.set("category", params.category);
  const suffix = query.toString() ? `?${query}` : "";
  return request(`/api/organizations/${suffix}`);
}

export function getOrganization(id) {
  return request(`/api/organizations/${id}/`);
}

function localExtract(description) {
  const map = [
    [["notebook", "notebooks", "pencil", "pencils", "stationery"], "school_supplies"],
    [["textbook", "textbooks", "book", "books"], "education"],
    [["shirt", "shirts", "clothes", "clothing", "uniform", "uniforms", "dress", "jacket"], "clothing"],
    [["food", "rice", "meal", "meals"], "food"],
    [["soap", "hygiene", "toothbrush"], "hygiene"],
    [["toy", "toys"], "toys"],
    [["blanket", "blankets"], "blankets"],
    [["shoe", "shoes"], "shoes"],
    [["household", "utensil"], "household"],
  ];
  const chunks = String(description || "").split(/,|\band\b/i);
  const items = [];
  for (const chunk of chunks) {
    const text = chunk.trim();
    if (!text) continue;
    const qtyMatch = text.match(/(\d+)/);
    const quantity = qtyMatch ? Number(qtyMatch[1]) : /several|some|few/i.test(text) ? 5 : 1;
    const lowered = text.toLowerCase();
    let category = "other";
    for (const [keywords, cat] of map) {
      if (keywords.some((word) => new RegExp(`\\b${word}\\b`).test(lowered))) {
        category = cat;
        break;
      }
    }
    const name = text.replace(/^(i have|we have|donating)\s+/i, "").replace(/^\d+\s+/, "").trim();
    if (name) items.push({ item_name: name, category, quantity, intended_users: "", condition: null });
  }
  return items.length ? items : [{ item_name: description.slice(0, 80), category: "other", quantity: 1, intended_users: "", condition: null }];
}

export async function extractDonationItems(payload) {
  try {
    return await request("/api/donations/extract/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch (err) {
    const description = payload?.description || "";
    if (!description) throw err;
    return { items: localExtract(description) };
  }
}

export function analyzeDonation(payload) {
  return request("/api/donations/analyze/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getDonationMatches(id, params = {}) {
  const query = new URLSearchParams();
  if (params.org) query.set("org", params.org);
  const suffix = query.toString() ? `?${query}` : "";
  return request(`/api/donations/${id}/matches/${suffix}`);
}

export function pledgeMatch(id) {
  return request(`/api/matches/${id}/pledge/`, { method: "POST" });
}

export function acceptMatch(id) {
  return request(`/api/matches/${id}/accept/`, { method: "POST" });
}

export function declineMatch(id) {
  return request(`/api/matches/${id}/decline/`, { method: "POST" });
}

export function deliverMatch(id) {
  return request(`/api/matches/${id}/deliver/`, { method: "POST" });
}

export function getInboxMatches() {
  return request("/api/organizations/me/matches/");
}

export function claimOrganization(id) {
  return request(`/api/organizations/${id}/claim/`, { method: "POST" });
}

export function getNotifications() {
  return request("/api/notifications/");
}

export function markNotificationRead(id) {
  return request(`/api/notifications/${id}/read/`, { method: "POST" });
}

export function markAllNotificationsRead() {
  return request("/api/notifications/read-all/", { method: "POST" });
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

export function checkEmail(email) {
  const query = new URLSearchParams({ email: email || "" });
  return request(`/api/auth/check-email/?${query}`);
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

export function createMyOrganization(payload, file) {
  return request("/api/organizations/me/", {
    method: "POST",
    body: file ? orgFormData(payload, file) : JSON.stringify(payload),
  });
}

export function updateMyOrganization(payload, file) {
  return request("/api/organizations/me/", {
    method: "PATCH",
    body: file ? orgFormData(payload, file) : JSON.stringify(payload),
  });
}

export function getMyDonations() {
  return request("/api/donations/mine/");
}
