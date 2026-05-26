/**
 * Chat message display helpers
 */

import type { ChatMessage } from '@/types/chat';

const GROUP_GAP_MS = 3 * 60 * 1000;

export type MessageSide = 'left' | 'right' | 'center';

export function getMessageSide(msg: ChatMessage): MessageSide {
  const role = msg.sender_participant?.role_in_room ?? 'unknown';
  if (msg.message_type === 'safety_notice') return 'center';
  if (role === 'roleA') return 'right';
  if (role === 'roleB') return 'left';
  return 'center';
}

export function isWithinGroupGap(a: ChatMessage | null, b: ChatMessage | null): boolean {
  if (!a || !b) return false;
  const aAt = new Date(a.created_at).getTime();
  const bAt = new Date(b.created_at).getTime();
  return Math.abs(bAt - aAt) <= GROUP_GAP_MS;
}

export function getGroupKey(msg: ChatMessage): string {
  const role = msg.sender_participant?.role_in_room ?? 'unknown';
  return `${role}:${msg.message_type}`;
}

export function getIsGroupStart(
  msg: ChatMessage,
  prev: ChatMessage | null,
  prevKey: string | null,
  groupKey: string
): boolean {
  return (
    !prev ||
    prevKey !== groupKey ||
    !isWithinGroupGap(prev, msg) ||
    msg.message_type === 'safety_notice'
  );
}

export function getIsGroupEnd(
  msg: ChatMessage,
  next: ChatMessage | null,
  nextKey: string | null,
  groupKey: string
): boolean {
  return (
    !next ||
    nextKey !== groupKey ||
    !isWithinGroupGap(msg, next) ||
    msg.message_type === 'safety_notice'
  );
}

export function shouldShowDayDivider(msg: ChatMessage, prev: ChatMessage | null, locale: string): boolean {
  const prevDay = prev ? new Date(prev.created_at).toLocaleDateString(locale) : null;
  const currentDay = new Date(msg.created_at).toLocaleDateString(locale);
  return !prev || prevDay !== currentDay;
}
