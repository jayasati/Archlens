'use client';

import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  SCAN_EVENTS,
  type ScanCompletedEvent,
  type ScanEvent,
  type ScanFailedEvent,
  type ScanProgressEvent,
} from '@archlens/shared-types';
import { API_BASE_URL } from '@/lib/constants';
import { useAuthToken } from './use-auth-token';

export interface ScanProgressState {
  status: 'idle' | 'connecting' | 'subscribed' | 'completed' | 'failed' | 'error';
  step: string | null;
  percent: number;
  message: string | null;
  reportId: string | null;
  error: string | null;
  events: ScanEvent[];
}

const initial: ScanProgressState = {
  status: 'idle',
  step: null,
  percent: 0,
  message: null,
  reportId: null,
  error: null,
  events: [],
};

interface Options {
  onCompleted?: (event: ScanCompletedEvent) => void;
  onFailed?: (event: ScanFailedEvent) => void;
}

/**
 * Connects to the API's /scans WebSocket namespace and subscribes to a
 * single scan, exposing the latest progress info.
 *
 * Pass `null`/`undefined` for `scanId` to disable — useful while the
 * "Re-scan" button hasn't been clicked yet.
 */
export function useScanProgress(
  scanId: string | null | undefined,
  options: Options = {}
): ScanProgressState {
  const token = useAuthToken();
  const [state, setState] = useState<ScanProgressState>(initial);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    if (!scanId || !token) {
      setState(initial);
      return;
    }

    setState({ ...initial, status: 'connecting' });

    const socket: Socket = io(`${API_BASE_URL}/scans`, {
      transports: ['websocket'],
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 5,
    });

    socket.on('connect', () => {
      socket.emit('subscribe', { scanId }, (ack: { ok?: boolean } | undefined) => {
        if (ack?.ok) {
          setState((s) => ({ ...s, status: 'subscribed' }));
        } else {
          setState((s) => ({ ...s, status: 'error', error: 'Subscribe rejected' }));
        }
      });
    });

    socket.on('connect_error', (err: Error) => {
      setState((s) => ({ ...s, status: 'error', error: err.message }));
    });

    socket.on('scan-event', (event: ScanEvent) => {
      setState((s) => ({ ...s, events: [...s.events, event] }));

      switch (event.type) {
        case SCAN_EVENTS.Started:
          setState((s) => ({ ...s, status: 'subscribed', step: 'started', percent: 0 }));
          break;
        case SCAN_EVENTS.Progress: {
          const p = event as ScanProgressEvent;
          setState((s) => ({
            ...s,
            step: p.step,
            percent: p.percent,
            message: p.message ?? null,
          }));
          break;
        }
        case SCAN_EVENTS.Completed: {
          const c = event as ScanCompletedEvent;
          setState((s) => ({
            ...s,
            status: 'completed',
            percent: 100,
            reportId: c.reportId,
          }));
          optionsRef.current.onCompleted?.(c);
          break;
        }
        case SCAN_EVENTS.Failed: {
          const f = event as ScanFailedEvent;
          setState((s) => ({ ...s, status: 'failed', error: f.error }));
          optionsRef.current.onFailed?.(f);
          break;
        }
      }
    });

    return () => {
      socket.emit('unsubscribe', { scanId });
      socket.disconnect();
    };
  }, [scanId, token]);

  return state;
}
