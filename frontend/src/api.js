const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || "Request failed");
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
