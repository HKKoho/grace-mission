'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Archive, ChevronRight, Loader2, MessageSquarePlus, Pencil, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { authFetch } from '@/lib/auth';
import { useT, type Messages } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { ChatSession } from './use-chat';

/* ------------------------------------------------------------------ */
/*  i18n                                                               */
/* ------------------------------------------------------------------ */

const messages = {
  en: {
    today: 'Today',
    yesterday: 'Yesterday',
    dateLocale: 'en-US',
    searchPlaceholder: 'Search conversations...',
    noMatching: 'No matching conversations',
    noConversations: 'No conversations yet',
    sessionFallback: (date: string) => `Session — ${date}`,
    rename: 'Rename',
    renameTitle: 'Rename Conversation',
    renameDescription: 'Enter a new name for this conversation.',
    renamePlaceholder: 'Conversation topic...',
    cancel: 'Cancel',
    save: 'Save',
    newChatTitle: 'Start New Conversation',
    newChatDescription:
      'Starting a new conversation will archive your current one. You can still view it later in the sidebar.',
    archiveAndStart: 'Archive & Start New',
  },
  'zh-TW': {
    today: '今天',
    yesterday: '昨天',
    dateLocale: 'zh-TW',
    searchPlaceholder: '搜尋對話…',
    noMatching: '找不到符合的對話',
    noConversations: '尚無對話',
    sessionFallback: (date: string) => `工作階段 — ${date}`,
    rename: '重新命名',
    renameTitle: '重新命名對話',
    renameDescription: '為此對話輸入新名稱。',
    renamePlaceholder: '對話主題…',
    cancel: '取消',
    save: '儲存',
    newChatTitle: '開始新對話',
    newChatDescription: '開始新對話會封存您目前的對話。您之後仍可在側邊欄檢視。',
    archiveAndStart: '封存並開始新對話',
  },
} satisfies Messages<{
  today: string;
  yesterday: string;
  dateLocale: string;
  searchPlaceholder: string;
  noMatching: string;
  noConversations: string;
  sessionFallback: (date: string) => string;
  rename: string;
  renameTitle: string;
  renameDescription: string;
  renamePlaceholder: string;
  cancel: string;
  save: string;
  newChatTitle: string;
  newChatDescription: string;
  archiveAndStart: string;
}>;

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface SessionSidebarProps {
  sessions: ChatSession[];
  selectedId: string | null;
  loading: boolean;
  loadingMore?: boolean;
  hasMore?: boolean;
  onSelect: (id: string) => void;
  onNewChat: (archiveCurrent?: boolean) => void;
  onLoadMore?: () => void;
  onSessionUpdated?: () => void;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

// Stable per-day key (local time, YYYY-MM-DD) used for grouping and expansion state.
function getDayKey(dateStr: string): string {
  const date = new Date(dateStr);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Human-friendly label for a day group: "Today", "Yesterday", or a localized date.
function formatDayLabel(
  dateStr: string,
  labels: { today: string; yesterday: string; locale: string },
): string {
  const date = new Date(dateStr);
  const today = new Date();
  const todayKey = getDayKey(today.toISOString());
  const dayKey = getDayKey(dateStr);
  if (dayKey === todayKey) return labels.today;
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (dayKey === getDayKey(yesterday.toISOString())) return labels.yesterday;
  const sameYear = date.getFullYear() === today.getFullYear();
  return date.toLocaleDateString(labels.locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: sameYear ? undefined : 'numeric',
  });
}

function formatShortDate(dateStr: string, locale: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function SessionSidebar({
  sessions,
  selectedId,
  loading,
  loadingMore = false,
  hasMore = false,
  onSelect,
  onNewChat,
  onLoadMore,
  onSessionUpdated,
}: SessionSidebarProps) {
  const t = useT(messages);
  const [renameSession, setRenameSession] = useState<ChatSession | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmNewChat, setConfirmNewChat] = useState(false);

  const handleNewChatClick = () => {
    // If there's an active session selected, ask for confirmation
    const currentSession = sessions.find((s) => s.id === selectedId);
    if (currentSession?.isActive) {
      setConfirmNewChat(true);
    } else {
      onNewChat(false);
    }
  };

  // Filter sessions by search query (case-insensitive match on topic or date)
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const query = searchQuery.toLowerCase();
    return sessions.filter((session) => {
      const topic = session.topic?.toLowerCase() ?? '';
      const date = formatShortDate(session.createdAt, t.dateLocale).toLowerCase();
      return topic.includes(query) || date.includes(query);
    });
  }, [sessions, searchQuery, t.dateLocale]);

  // Sort sessions by createdAt descending (newest first)
  const sorted = useMemo(
    () =>
      [...filtered].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [filtered],
  );

  // Group sessions by day (stable key) and preserve insertion order (already sorted desc).
  const { dayKeys, groups } = useMemo(() => {
    const map = new Map<string, ChatSession[]>();
    for (const session of sorted) {
      const key = getDayKey(session.createdAt);
      const list = map.get(key) ?? [];
      list.push(session);
      map.set(key, list);
    }
    return { dayKeys: Array.from(map.keys()), groups: map };
  }, [sorted]);

  // Track which day groups are expanded. Default: all collapsed.
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  const toggleDay = (key: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // When searching, auto-expand all matching day groups so results are visible.
  // When the user is viewing a session, ensure its day group is expanded.
  useEffect(() => {
    if (searchQuery.trim()) {
      setExpandedDays(new Set(dayKeys));
      return;
    }
    if (selectedId) {
      const selected = sorted.find((s) => s.id === selectedId);
      if (selected) {
        const key = getDayKey(selected.createdAt);
        setExpandedDays((prev) => {
          if (prev.has(key)) return prev;
          const next = new Set(prev);
          next.add(key);
          return next;
        });
      }
    }
  }, [searchQuery, dayKeys, selectedId, sorted]);

  const listRef = useRef<HTMLDivElement>(null);

  // Trigger onLoadMore when the user scrolls within ~80px of the bottom.
  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el || !onLoadMore || !hasMore || loadingMore) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom < 80) {
      onLoadMore();
    }
  }, [onLoadMore, hasMore, loadingMore]);

  const handleRename = (session: ChatSession) => {
    setRenameSession(session);
    setRenameValue(session.topic ?? '');
  };

  const handleRenameSubmit = async () => {
    if (!renameSession) return;
    setSaving(true);
    try {
      await authFetch(`/api/v1/chat/sessions/${renameSession.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ topic: renameValue.trim() || null }),
      });
      setRenameSession(null);
      onSessionUpdated?.();
    } catch {
      // Silently fail - user can retry
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-w-[260px] shrink-0 flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => {
            setSearchOpen(!searchOpen);
            if (searchOpen) setSearchQuery('');
          }}
        >
          {searchOpen ? <X className="size-4" /> : <Search className="size-4" />}
        </Button>
        <Button variant="ghost" size="icon" className="size-8" onClick={handleNewChatClick}>
          <MessageSquarePlus className="size-4" />
        </Button>
      </div>

      {/* Search input */}
      {searchOpen && (
        <div className="px-3 pb-2">
          <Input
            placeholder={t.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 text-sm"
            autoFocus
          />
        </div>
      )}

      {/* Session list */}
      <div ref={listRef} onScroll={handleScroll} className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : sorted.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            {searchQuery ? t.noMatching : t.noConversations}
          </p>
        ) : (
          dayKeys.map((dayKey) => {
            const daySessions = groups.get(dayKey) ?? [];
            const isExpanded = expandedDays.has(dayKey);
            const label = formatDayLabel(daySessions[0]!.createdAt, {
              today: t.today,
              yesterday: t.yesterday,
              locale: t.dateLocale,
            });
            return (
              <div key={dayKey}>
                <button
                  type="button"
                  onClick={() => toggleDay(dayKey)}
                  className="flex w-full items-center gap-1 px-3 py-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                  aria-expanded={isExpanded}
                >
                  <ChevronRight
                    className={cn(
                      'size-3 shrink-0 transition-transform duration-200',
                      isExpanded && 'rotate-90',
                    )}
                  />
                  <span className="flex-1 truncate">{label}</span>
                  <span className="text-[10px] tabular-nums opacity-60">{daySessions.length}</span>
                </button>
                {isExpanded &&
                  daySessions.map((session) => (
                    <ContextMenu key={session.id}>
                      <ContextMenuTrigger asChild>
                        <button
                          onClick={() => {
                            onSelect(session.id);
                          }}
                          className={cn(
                            'mx-2 flex w-[calc(100%-16px)] cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50',
                            selectedId === session.id && 'bg-muted',
                            !session.isActive && 'opacity-60',
                          )}
                        >
                          {!session.isActive && (
                            <Archive className="size-3 shrink-0 text-muted-foreground" />
                          )}
                          <span className="truncate">
                            {session.topic ??
                              t.sessionFallback(formatShortDate(session.createdAt, t.dateLocale))}
                          </span>
                        </button>
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        <ContextMenuItem onClick={() => handleRename(session)}>
                          <Pencil className="mr-2 size-4" />
                          {t.rename}
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  ))}
              </div>
            );
          })
        )}
        {loadingMore && (
          <div className="flex items-center justify-center py-3">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Rename Dialog */}
      <Dialog
        open={renameSession !== null}
        onOpenChange={(open) => !open && setRenameSession(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.renameTitle}</DialogTitle>
            <DialogDescription>{t.renameDescription}</DialogDescription>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            placeholder={t.renamePlaceholder}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !saving) {
                void handleRenameSubmit();
              }
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameSession(null)} disabled={saving}>
              {t.cancel}
            </Button>
            <Button onClick={() => void handleRenameSubmit()} disabled={saving}>
              {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              {t.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Chat Confirmation Dialog */}
      <Dialog open={confirmNewChat} onOpenChange={setConfirmNewChat}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.newChatTitle}</DialogTitle>
            <DialogDescription>{t.newChatDescription}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmNewChat(false)}>
              {t.cancel}
            </Button>
            <Button
              onClick={() => {
                setConfirmNewChat(false);
                onNewChat(true);
              }}
            >
              {t.archiveAndStart}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
