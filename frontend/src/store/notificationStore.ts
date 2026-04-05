import { create } from 'zustand';
import {
  actOnNotification,
  dismissNotification,
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  snoozeNotification,
  type NotificationFeedState,
  type NotificationItem,
} from '@/services/api/notifications';
import { getErrorMessage } from '@/utils/apiError';

interface NotificationState {
  items: NotificationItem[];
  unreadCount: number;
  activeState: NotificationFeedState;
  nextCursor: string | null;
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  isCounting: boolean;
  error: string | null;
  fetchUnreadCount: () => Promise<number>;
  fetchNotifications: (state?: NotificationFeedState, opts?: { append?: boolean }) => Promise<void>;
  markRead: (notificationId: string) => Promise<NotificationItem | null>;
  markAllRead: () => Promise<void>;
  dismiss: (notificationId: string) => Promise<NotificationItem | null>;
  snooze: (notificationId: string, hours?: number) => Promise<NotificationItem | null>;
  act: (notificationId: string, actionKey?: string) => Promise<{ path: string | null; action_key: string | null } | null>;
  clearError: () => void;
}

function replaceItem(items: NotificationItem[], next: NotificationItem) {
  return items.map((item) => (item.id === next.id ? next : item));
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  items: [],
  unreadCount: 0,
  activeState: 'actionable',
  nextCursor: null,
  hasMore: false,
  isLoading: false,
  isLoadingMore: false,
  isCounting: false,
  error: null,

  fetchUnreadCount: async () => {
    set({ isCounting: true });
    try {
      const unreadCount = await getUnreadNotificationCount();
      set({ unreadCount, isCounting: false });
      return unreadCount;
    } catch (error: unknown) {
      set({ isCounting: false, error: getErrorMessage(error, 'message.operationFail') });
      throw error;
    }
  },

  fetchNotifications: async (state = get().activeState, opts) => {
    const append = opts?.append ?? false;
    const cursor = append ? get().nextCursor : null;
    set({
      activeState: state,
      isLoading: append ? get().isLoading : true,
      isLoadingMore: append,
      error: null,
    });
    try {
      const result = await listNotifications({
        state,
        cursor: cursor ?? undefined,
      });
      set({
        items: append ? [...get().items, ...result.notifications] : result.notifications,
        nextCursor: result.next_cursor,
        hasMore: result.has_more,
        isLoading: false,
        isLoadingMore: false,
      });
    } catch (error: unknown) {
      set({
        isLoading: false,
        isLoadingMore: false,
        error: getErrorMessage(error, 'message.operationFail'),
      });
      throw error;
    }
  },

  markRead: async (notificationId: string) => {
    try {
      const notification = await markNotificationRead(notificationId);
      set((state) => ({
        items: replaceItem(state.items, notification),
        unreadCount: Math.max(0, state.unreadCount - (state.items.find((item) => item.id === notificationId)?.unread ? 1 : 0)),
      }));
      return notification;
    } catch (error: unknown) {
      set({ error: getErrorMessage(error, 'message.operationFail') });
      throw error;
    }
  },

  markAllRead: async () => {
    try {
      await markAllNotificationsRead();
      set((state) => ({
        items: state.items.map((item) => ({
          ...item,
          unread: false,
          read_at: item.read_at ?? new Date().toISOString(),
        })),
        unreadCount: 0,
      }));
    } catch (error: unknown) {
      set({ error: getErrorMessage(error, 'message.operationFail') });
      throw error;
    }
  },

  dismiss: async (notificationId: string) => {
    try {
      const notification = await dismissNotification(notificationId);
      set((state) => ({
        items: replaceItem(state.items, notification),
        unreadCount: Math.max(0, state.unreadCount - (state.items.find((item) => item.id === notificationId)?.unread ? 1 : 0)),
      }));
      return notification;
    } catch (error: unknown) {
      set({ error: getErrorMessage(error, 'message.operationFail') });
      throw error;
    }
  },

  snooze: async (notificationId: string, hours?: number) => {
    try {
      const notification = await snoozeNotification(notificationId, hours);
      set((state) => ({
        items: replaceItem(state.items, notification),
        unreadCount: Math.max(0, state.unreadCount - (state.items.find((item) => item.id === notificationId)?.unread ? 1 : 0)),
      }));
      return notification;
    } catch (error: unknown) {
      set({ error: getErrorMessage(error, 'message.operationFail') });
      throw error;
    }
  },

  act: async (notificationId: string, actionKey?: string) => {
    try {
      const result = await actOnNotification(notificationId, actionKey);
      set((state) => ({
        items: replaceItem(state.items, result.notification),
        unreadCount: Math.max(0, state.unreadCount - (state.items.find((item) => item.id === notificationId)?.unread ? 1 : 0)),
      }));
      return result.target;
    } catch (error: unknown) {
      set({ error: getErrorMessage(error, 'message.operationFail') });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));
