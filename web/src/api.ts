import { Bootstrap, SafeUser } from './types';

const TOKEN_KEY = 'hoarding_token';

export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) || '';
}
export function setToken(token: string): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function req<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { ...(options.headers as Record<string, string> || {}) };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (options.body && typeof options.body === 'string') headers['Content-Type'] = 'application/json';
  const res = await fetch(`/api${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) setToken('');
    throw new Error(data.error || `请求失败（${res.status}）`);
  }
  return data as T;
}

export const api = {
  login: (username: string, password: string) =>
    req<{ token: string; user: SafeUser }>('/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  bootstrap: () => req<Bootstrap>('/bootstrap'),
  createSubmission: (payload: unknown) =>
    req('/submissions', { method: 'POST', body: JSON.stringify(payload) }),
  review: (id: string, payload: unknown) =>
    req(`/submissions/${id}/review`, { method: 'POST', body: JSON.stringify(payload) }),
  claimTask: (id: string) => req(`/tasks/${id}/claim`, { method: 'POST' }),
  reportTask: (id: string, payload: unknown) =>
    req(`/tasks/${id}/report`, { method: 'POST', body: JSON.stringify(payload) }),
  accept: (id: string, payload: unknown) =>
    req(`/submissions/${id}/accept`, { method: 'POST', body: JSON.stringify(payload) }),
  createTicket: (payload: unknown) =>
    req('/tickets', { method: 'POST', body: JSON.stringify(payload) }),
  ticketAction: (id: string, payload: unknown) =>
    req(`/tickets/${id}/action`, { method: 'POST', body: JSON.stringify(payload) }),
  settle: (id: string) => req(`/acceptances/${id}/settle`, { method: 'POST' }),
  completeInspection: (id: string, payload: unknown) =>
    req(`/inspections/${id}/complete`, { method: 'POST', body: JSON.stringify(payload) }),
};

export async function uploadFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body: fd,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '上传失败');
  return data.url as string;
}
