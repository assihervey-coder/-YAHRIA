'use client';

// ═══════════════════════════════════════════════════════════════
// YAHRIA — useYahriaRealtime (Domain 11 client transport)
// Connects to /ws/yahria with auto-reconnect + backoff, keeps a
// bounded event log and per-type counters. Single connection per
// page (call once, pass down via props).
// ═══════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react';
import type { YahriaEvent } from '@/lib/yahria/realtime';

export type RealtimeStatus = 'connecting' | 'live' | 'offline';

interface UseYahriaRealtimeReturn {
  status: RealtimeStatus;
  events: YahriaEvent[];
  lastEvent: YahriaEvent | null;
  counters: Record<string, number>;
  total: number;
  clear: () => void;
}

const MAX_EVENTS = 200;

export function useYahriaRealtime(): UseYahriaRealtimeReturn {
  const [status, setStatus] = useState<RealtimeStatus>('connecting');
  const [events, setEvents] = useState<YahriaEvent[]>([]);
  const [counters, setCounters] = useState<Record<string, number>>({});
  const retryRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearedRef = useRef(false);

  const clear = useCallback(() => {
    setEvents([]);
    setCounters({});
    clearedRef.current = true;
  }, []);

  useEffect(() => {
    let disposed = false;
    let ws: WebSocket | null = null;

    const ingest = (e: YahriaEvent) => {
      setEvents((prev) => {
        if (prev.some((x) => x.id === e.id)) return prev; // dedupe (snapshot + live overlap)
        const next = [...prev, e];
        return next.length > MAX_EVENTS ? next.slice(next.length - MAX_EVENTS) : next;
      });
      setCounters((prev) => ({ ...prev, [e.type]: (prev[e.type] ?? 0) + 1 }));
    };

    const connect = () => {
      if (disposed) return;
      setStatus((s) => (s === 'live' ? s : 'connecting'));
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
      try {
        ws = new WebSocket(`${proto}://${window.location.host}/ws/yahria`);
      } catch {
        scheduleReconnect();
        return;
      }

      ws.onopen = () => {
        retryRef.current = 0;
        setStatus('live');
      };

      ws.onmessage = (raw) => {
        let msg: { kind?: string; event?: YahriaEvent; events?: YahriaEvent[] } | null = null;
        try { msg = JSON.parse(String(raw.data)); } catch { return; }
        if (!msg) return;
        if (msg.kind === 'event' && msg.event) ingest(msg.event);
        if (msg.kind === 'snapshot' && Array.isArray(msg.events) && !clearedRef.current) {
          for (const e of msg.events) ingest(e);
        }
      };

      ws.onclose = () => {
        setStatus('offline');
        scheduleReconnect();
      };
      ws.onerror = () => {
        try { ws?.close(); } catch { /* noop */ }
      };
    };

    const scheduleReconnect = () => {
      if (disposed) return;
      const delay = Math.min(1000 * 2 ** retryRef.current, 10000);
      retryRef.current += 1;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(connect, delay);
    };

    connect();

    return () => {
      disposed = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      try { ws?.close(); } catch { /* noop */ }
    };
  }, []);

  const lastEvent = events.length > 0 ? events[events.length - 1] : null;
  const total = Object.values(counters).reduce((a, b) => a + b, 0);

  return { status, events, lastEvent, counters, total, clear };
}
