import { useEffect, useRef, useState, useCallback } from 'react';
import { useToast } from './use-toast';

export interface QueueNotification {
  type: 'queue_update' | 'operation_ready' | 'operation_blocked' | 'position_changed';
  operationType: string;
  queueId?: string;
  position?: number;
  estimatedWaitTime?: number;
  message: string;
  blockedBy?: string;
  timestamp?: string;
}

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
}

export interface WebSocketHookOptions {
  userId?: string;
  sessionId?: string;
  autoConnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export interface WebSocketHook {
  isConnected: boolean;
  isConnecting: boolean;
  lastMessage: WebSocketMessage | null;
  queueNotifications: QueueNotification[];
  connectionError: string | null;
  connect: () => void;
  disconnect: () => void;
  subscribe: (topic: string) => void;
  unsubscribe: (topic: string) => void;
  clearNotifications: () => void;
}

export const useWebSocket = (options: WebSocketHookOptions = {}): WebSocketHook => {
  const {
    userId,
    sessionId,
    autoConnect = false,
    reconnectInterval = 5000,
    maxReconnectAttempts = 5
  } = options;

  const { toast } = useToast();
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [queueNotifications, setQueueNotifications] = useState<QueueNotification[]>([]);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [subscribedTopics] = useState<Set<string>>(new Set());

  const clearReconnectTimeout = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  };

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      setLastMessage(message);

      switch (message.type) {
        case 'connection_established':
          console.log('✅ WebSocket connected successfully');
          setIsConnected(true);
          setIsConnecting(false);
          setConnectionError(null);
          reconnectAttemptsRef.current = 0;
          break;

        case 'authenticated':
          console.log('🔐 WebSocket authenticated:', message.data);
          // Auto-subscribe to queue notifications after authentication
          subscribe('queue_notifications');
          break;

        case 'queue_notification':
          const notification = message.data as QueueNotification;
          console.log('📱 Queue notification received:', notification);
          
          setQueueNotifications(prev => [...prev, notification]);
          
          // Show toast notification based on type
          switch (notification.type) {
            case 'operation_ready':
              toast({
                title: "Operation Ready",
                description: notification.message,
                variant: 'default'
              });
              break;
              
            case 'operation_blocked':
              toast({
                title: "Operation Blocked",
                description: notification.message,
                variant: 'destructive'
              });
              break;
              
            case 'position_changed':
              toast({
                title: "Queue Position Updated",
                description: notification.message,
                variant: 'default'
              });
              break;
          }
          break;

        case 'subscribed':
          console.log('📡 Subscribed to topic:', message.data.topic);
          subscribedTopics.add(message.data.topic);
          break;

        case 'unsubscribed':
          console.log('📡 Unsubscribed from topic:', message.data.topic);
          subscribedTopics.delete(message.data.topic);
          break;

        case 'error':
          console.error('❌ WebSocket error:', message.data);
          setConnectionError(message.data.error);
          toast({
            title: "WebSocket Error",
            description: message.data.error,
            variant: 'destructive'
          });
          break;

        case 'pong':
          // Handle ping response - connection is alive
          break;

        default:
          console.log('📨 WebSocket message:', message);
      }
    } catch (error) {
      console.error('❌ Failed to parse WebSocket message:', error);
    }
  }, [toast]);

  const attemptReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached');
      setConnectionError('Connection failed after multiple attempts');
      return;
    }

    reconnectAttemptsRef.current++;
    console.log(`🔄 Reconnecting... attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts}`);
    
    reconnectTimeoutRef.current = setTimeout(() => {
      connect();
    }, reconnectInterval);
  }, [reconnectInterval, maxReconnectAttempts]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('⚠️ WebSocket already connected');
      return;
    }

    if (isConnecting) {
      console.log('⚠️ WebSocket connection already in progress');
      return;
    }

    clearReconnectTimeout();
    setIsConnecting(true);
    setConnectionError(null);

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      console.log('🔌 Connecting to WebSocket:', wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('🔌 WebSocket connection opened');
        
        // Authenticate if credentials are available
        if (userId && sessionId) {
          ws.send(JSON.stringify({
            type: 'authenticate',
            data: { userId, sessionId }
          }));
        }
      };

      ws.onmessage = handleMessage;

      ws.onclose = (event) => {
        console.log('🔌 WebSocket connection closed:', event.code, event.reason);
        setIsConnected(false);
        setIsConnecting(false);
        wsRef.current = null;

        if (event.code !== 1000) { // Not a normal closure
          attemptReconnect();
        }
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket connection error:', error);
        setConnectionError('Connection failed');
        setIsConnecting(false);
      };

    } catch (error) {
      console.error('❌ Failed to create WebSocket connection:', error);
      setConnectionError('Failed to create connection');
      setIsConnecting(false);
    }
  }, [userId, sessionId, handleMessage, attemptReconnect]);

  const disconnect = useCallback(() => {
    clearReconnectTimeout();
    
    if (wsRef.current) {
      console.log('🔌 Disconnecting WebSocket');
      wsRef.current.close(1000); // Normal closure
      wsRef.current = null;
    }
    
    setIsConnected(false);
    setIsConnecting(false);
    setConnectionError(null);
    reconnectAttemptsRef.current = 0;
  }, []);

  const subscribe = useCallback((topic: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'subscribe',
        data: { topic }
      }));
    } else {
      console.warn('⚠️ Cannot subscribe - WebSocket not connected');
    }
  }, []);

  const unsubscribe = useCallback((topic: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'unsubscribe',
        data: { topic }
      }));
    }
  }, []);

  const clearNotifications = useCallback(() => {
    setQueueNotifications([]);
  }, []);

  // Auto-connect if enabled and credentials are available
  useEffect(() => {
    if (autoConnect && userId && sessionId) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, userId, sessionId, connect, disconnect]);

  // Ping to keep connection alive
  useEffect(() => {
    if (isConnected && wsRef.current) {
      const pingInterval = setInterval(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000); // Ping every 30 seconds

      return () => clearInterval(pingInterval);
    }
  }, [isConnected]);

  return {
    isConnected,
    isConnecting,
    lastMessage,
    queueNotifications,
    connectionError,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    clearNotifications
  };
};