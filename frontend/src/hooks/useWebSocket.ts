import { useEffect, useRef, useCallback } from "react";
import { fetchDashboardData } from "@/hooks/useDashboardData";
import { useJobStore } from "@/stores/jobStore";
import { useAuthStore } from "@/stores/authStore";
import type { Job } from "@/types";
import { toast } from "sonner";

const WS_BASE =
  import.meta.env.VITE_WS_URL?.replace(/\/$/, "") ||
  `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws`;

export function useWebSocket(jobId?: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // Prevent simultaneous connection attempts (StrictMode double-invoke fix)
  const isConnectingRef = useRef(false);
  const isMountedRef = useRef(true);

  const updateJob = useJobStore((s) => s.updateJob);
  const token = useAuthStore((s) => s.accessToken);

  const onJobUpdateRef = useRef<(data: Job) => void>(() => {});
  onJobUpdateRef.current = (data: Job) => {
    updateJob(data);
    if (data.status === "completed") {
      toast.success("Job completed");
      fetchDashboardData().catch(() => undefined);
    } else if (data.status === "failed") {
      toast.error(data.error_message || "Job failed");
      fetchDashboardData().catch(() => undefined);
    }
  };

  const cleanup = useCallback(() => {
    // Clear timers
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    // Close existing socket cleanly
    if (wsRef.current) {
      const ws = wsRef.current;
      ws.onopen = null;
      ws.onclose = null;
      ws.onerror = null;
      ws.onmessage = null;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close(1000, "Cleanup");
      }
      wsRef.current = null;
    }
    isConnectingRef.current = false;
  }, []);

  const connect = useCallback(() => {
    if (!token) return;
    if (!isMountedRef.current) return;
    // Block if already connecting or connected
    if (isConnectingRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    if (wsRef.current?.readyState === WebSocket.CONNECTING) return;

    isConnectingRef.current = true;

    const validJobId =
      typeof jobId === "string" && jobId.trim() !== "" && jobId !== "[object Object]"
        ? jobId.trim()
        : null;

    const url = validJobId
      ? `${WS_BASE}/jobs/${validJobId}?token=${encodeURIComponent(token)}`
      : `${WS_BASE}?token=${encodeURIComponent(token)}`;

    console.log("[WS] Connecting to:", url);
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!isMountedRef.current) { ws.close(1000, "Unmounted"); return; }
      isConnectingRef.current = false;
      console.log("[WS] Connected");
      heartbeatIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send("ping");
        }
      }, 30000);
    };

    ws.onclose = (event) => {
      isConnectingRef.current = false;
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      // Only reconnect for abnormal closures when still mounted
      if (isMountedRef.current && event.code !== 1000) {
        console.log("[WS] Disconnected, reconnecting in 5s...", event.code);
        reconnectTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) connect();
        }, 5000);
      }
    };

    ws.onerror = () => {
      // onerror is always followed by onclose — let onclose handle reconnect
      isConnectingRef.current = false;
    };

    ws.onmessage = (event) => {
      if (event.data === "pong") return;
      try {
        const data = JSON.parse(event.data) as Job;
        onJobUpdateRef.current(data);
      } catch (e) {
        console.error("[WS] Message parse error:", e);
      }
    };
  }, [jobId, token, cleanup]);

  useEffect(() => {
    isMountedRef.current = true;

    // Small delay prevents StrictMode double-invoke race (mount→unmount→remount)
    const initTimer = setTimeout(() => {
      if (isMountedRef.current) connect();
    }, 50);

    return () => {
      isMountedRef.current = false;
      clearTimeout(initTimer);
      cleanup();
    };
  }, [connect, cleanup]);

  return wsRef;
}
