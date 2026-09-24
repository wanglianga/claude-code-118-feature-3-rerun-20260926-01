import { create } from 'zustand';
import { api, getToken, setToken } from './api';
import { Acceptance, Bootstrap, Inspection, InstallTask, SafeUser, Submission, Ticket } from './types';

const USER_KEY = 'hoarding_user';

interface AppState {
  user: SafeUser | null;
  ready: boolean;
  submissions: Submission[];
  tasks: InstallTask[];
  tickets: Ticket[];
  acceptances: Acceptance[];
  inspections: Inspection[];
  users: SafeUser[];
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
  /** 执行业务操作后自动刷新，保证三端状态同步 */
  act: <T>(fn: () => Promise<T>) => Promise<T>;
}

export const useStore = create<AppState>((set, get) => ({
  user: (() => {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw && getToken() ? (JSON.parse(raw) as SafeUser) : null;
    } catch { return null; }
  })(),
  ready: false,
  submissions: [], tasks: [], tickets: [], acceptances: [], inspections: [], users: [],

  login: async (username, password) => {
    const { token, user } = await api.login(username, password);
    setToken(token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    set({ user });
    await get().refresh();
  },

  logout: () => {
    setToken('');
    localStorage.removeItem(USER_KEY);
    set({
      user: null, ready: false,
      submissions: [], tasks: [], tickets: [], acceptances: [], inspections: [], users: [],
    });
  },

  refresh: async () => {
    if (!getToken()) return;
    const data: Bootstrap = await api.bootstrap();
    set({
      users: data.users, submissions: data.submissions, tasks: data.tasks,
      tickets: data.tickets, acceptances: data.acceptances, inspections: data.inspections,
      ready: true,
    });
  },

  act: async (fn) => {
    const r = await fn();
    await get().refresh();
    return r;
  },
}));

export const useUser = () => useStore(s => s.user);
