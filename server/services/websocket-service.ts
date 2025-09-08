import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import type { Server } from 'http';
import { EventService } from './event';

export interface WSClient {
  ws: WebSocket;
  userId: string;
  sessionId: string;
  subscribedTopics: Set<string>;
  lastPing: Date;
}

export interface WSMessage {
  type: string;
  data: any;
  timestamp: string;
}

export interface QueueNotification {
  type: 'queue_update' | 'operation_ready' | 'operation_blocked' | 'position_changed';
  operationType: string;
  queueId?: string;
  position?: number;
  estimatedWaitTime?: number;
  message: string;
  blockedBy?: string;
}

export class WebSocketService {
  private static wss: WebSocketServer | null = null;
  private static clients = new Map<string, WSClient>();
  private static isInitialized = false;

  /**
   * Initialize WebSocket server
   */
  static initialize(server: Server): void {
    if (this.isInitialized) {
      console.log('⚠️ WebSocket server already initialized');
      return;
    }

    console.log('🔌 Initializing WebSocket server...');

    this.wss = new WebSocketServer({ 
      server,
      path: '/ws',
      clientTracking: true
    });

    this.wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
      this.handleConnection(ws, request);
    });

    // Setup periodic ping to maintain connections
    setInterval(() => {
      this.pingClients();
    }, 30000); // Ping every 30 seconds

    // Setup cleanup for stale connections
    setInterval(() => {
      this.cleanupStaleConnections();
    }, 60000); // Cleanup every minute

    this.isInitialized = true;
    console.log('✅ WebSocket server initialized on path /ws');
  }

  /**
   * Handle new WebSocket connection
   */
  private static handleConnection(ws: WebSocket, request: IncomingMessage): void {
    console.log('🔌 New WebSocket connection established');

    const connectionContext = {
      clientInfo: null as WSClient | null
    };

    ws.on('message', (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        const updatedClientInfo = this.handleMessage(ws, data, connectionContext.clientInfo);
        if (updatedClientInfo) {
          connectionContext.clientInfo = updatedClientInfo;
        }
      } catch (error) {
        console.error('❌ Invalid WebSocket message:', error);
        this.sendError(ws, 'Invalid message format');
      }
    });

    ws.on('close', () => {
      if (connectionContext.clientInfo?.sessionId) {
        this.removeClient(connectionContext.clientInfo.sessionId);
        console.log(`🔌 Client disconnected: ${connectionContext.clientInfo.userId} (${connectionContext.clientInfo.sessionId})`);
      }
    });

    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
    });

    // Send welcome message
    this.send(ws, {
      type: 'connection_established',
      data: { message: 'Connected to operation queue notifications' },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  private static handleMessage(ws: WebSocket, message: any, clientInfo: WSClient | null): WSClient | null {
    const { type, data } = message;

    switch (type) {
      case 'authenticate':
        return this.authenticateClient(ws, data);
      
      case 'subscribe':
        if (clientInfo) {
          this.subscribeToTopic(clientInfo, data.topic);
        } else {
          this.sendError(ws, 'Must authenticate first');
        }
        break;
      
      case 'unsubscribe':
        if (clientInfo) {
          this.unsubscribeFromTopic(clientInfo, data.topic);
        }
        break;
      
      case 'ping':
        if (clientInfo) {
          clientInfo.lastPing = new Date();
        }
        this.send(ws, {
          type: 'pong',
          data: { timestamp: new Date().toISOString() },
          timestamp: new Date().toISOString()
        });
        break;
      
      default:
        this.sendError(ws, `Unknown message type: ${type}`);
    }
    
    return clientInfo;
  }

  /**
   * Authenticate WebSocket client
   */
  private static authenticateClient(ws: WebSocket, data: any): WSClient | null {
    const { userId, sessionId } = data;

    if (!userId || !sessionId) {
      this.sendError(ws, 'Missing userId or sessionId');
      return null;
    }

    const client: WSClient = {
      ws,
      userId,
      sessionId,
      subscribedTopics: new Set(),
      lastPing: new Date()
    };

    this.clients.set(sessionId, client);

    this.send(ws, {
      type: 'authenticated',
      data: { 
        userId, 
        sessionId,
        message: 'Successfully authenticated'
      },
      timestamp: new Date().toISOString()
    });

    console.log(`✅ Client authenticated: ${userId} (${sessionId})`);
    return client;
  }

  /**
   * Subscribe client to a topic
   */
  private static subscribeToTopic(client: WSClient, topic: string): void {
    client.subscribedTopics.add(topic);
    
    this.send(client.ws, {
      type: 'subscribed',
      data: { topic, message: `Subscribed to ${topic}` },
      timestamp: new Date().toISOString()
    });

    console.log(`📡 Client ${client.userId} subscribed to topic: ${topic}`);
  }

  /**
   * Unsubscribe client from a topic
   */
  private static unsubscribeFromTopic(client: WSClient, topic: string): void {
    client.subscribedTopics.delete(topic);
    
    this.send(client.ws, {
      type: 'unsubscribed',
      data: { topic, message: `Unsubscribed from ${topic}` },
      timestamp: new Date().toISOString()
    });

    console.log(`📡 Client ${client.userId} unsubscribed from topic: ${topic}`);
  }

  /**
   * Send queue notification to specific user
   */
  static sendQueueNotification(
    userId: string, 
    sessionId: string, 
    notification: QueueNotification
  ): void {
    const client = this.clients.get(sessionId);
    
    if (!client || client.userId !== userId) {
      console.log(`📱 Client not connected: ${userId} (${sessionId})`);
      return;
    }

    if (!client.subscribedTopics.has('queue_notifications')) {
      console.log(`📱 Client not subscribed to queue notifications: ${userId}`);
      return;
    }

    this.send(client.ws, {
      type: 'queue_notification',
      data: notification,
      timestamp: new Date().toISOString()
    });

    console.log(`📱 Queue notification sent to ${userId}: ${notification.type}`);
  }

  /**
   * Broadcast notification to all users subscribed to a topic
   */
  static broadcast(topic: string, message: WSMessage): void {
    let sentCount = 0;

    this.clients.forEach((client) => {
      if (client.subscribedTopics.has(topic)) {
        this.send(client.ws, message);
        sentCount++;
      }
    });

    console.log(`📡 Broadcast to ${sentCount} clients on topic: ${topic}`);
  }

  /**
   * Send operation ready notification
   */
  static notifyOperationReady(userId: string, sessionId: string, operationType: string, queueId: string): void {
    this.sendQueueNotification(userId, sessionId, {
      type: 'operation_ready',
      operationType,
      queueId,
      message: `Your ${operationType} operation can now proceed`,
      estimatedWaitTime: 0
    });
  }

  /**
   * Send operation blocked notification
   */
  static notifyOperationBlocked(
    userId: string, 
    sessionId: string, 
    operationType: string, 
    blockedBy: string,
    position: number,
    estimatedWaitTime: number
  ): void {
    this.sendQueueNotification(userId, sessionId, {
      type: 'operation_blocked',
      operationType,
      blockedBy,
      position,
      estimatedWaitTime,
      message: `Your ${operationType} operation is queued (position ${position}). Blocked by ${blockedBy} operation.`
    });
  }

  /**
   * Send queue position update
   */
  static notifyPositionChanged(
    userId: string, 
    sessionId: string, 
    operationType: string,
    newPosition: number,
    estimatedWaitTime: number
  ): void {
    this.sendQueueNotification(userId, sessionId, {
      type: 'position_changed',
      operationType,
      position: newPosition,
      estimatedWaitTime,
      message: `Your queue position has changed to #${newPosition} (estimated wait: ${Math.ceil(estimatedWaitTime / 60)} minutes)`
    });
  }

  /**
   * Remove client from active connections
   */
  private static removeClient(sessionId: string): void {
    this.clients.delete(sessionId);
  }

  /**
   * Send message to WebSocket client
   */
  private static send(ws: WebSocket, message: WSMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send error message to client
   */
  private static sendError(ws: WebSocket, error: string): void {
    this.send(ws, {
      type: 'error',
      data: { error, message: error },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Ping all clients to maintain connections
   */
  private static pingClients(): void {
    let activeCount = 0;
    
    this.clients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        this.send(client.ws, {
          type: 'ping',
          data: { timestamp: new Date().toISOString() },
          timestamp: new Date().toISOString()
        });
        activeCount++;
      } else {
        this.removeClient(client.sessionId);
      }
    });

    if (activeCount > 0) {
      console.log(`💗 Pinged ${activeCount} active WebSocket clients`);
    }
  }

  /**
   * Clean up stale connections
   */
  private static cleanupStaleConnections(): void {
    const staleThreshold = 5 * 60 * 1000; // 5 minutes
    const now = new Date();
    let cleanedCount = 0;

    this.clients.forEach((client, sessionId) => {
      const timeSinceLastPing = now.getTime() - client.lastPing.getTime();
      
      if (timeSinceLastPing > staleThreshold || client.ws.readyState !== WebSocket.OPEN) {
        client.ws.terminate();
        this.removeClient(sessionId);
        cleanedCount++;
      }
    });

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} stale WebSocket connections`);
    }
  }

  /**
   * Get current client statistics
   */
  static getStats(): { totalClients: number; topicSubscriptions: Record<string, number> } {
    const stats = {
      totalClients: this.clients.size,
      topicSubscriptions: {} as Record<string, number>
    };

    this.clients.forEach((client) => {
      client.subscribedTopics.forEach((topic) => {
        stats.topicSubscriptions[topic] = (stats.topicSubscriptions[topic] || 0) + 1;
      });
    });

    return stats;
  }

  /**
   * Shutdown WebSocket server
   */
  static shutdown(): void {
    if (this.wss) {
      console.log('🔌 Shutting down WebSocket server...');
      
      // Close all client connections
      this.clients.forEach((client) => {
        client.ws.terminate();
      });
      this.clients.clear();
      
      // Close server
      this.wss.close();
      this.wss = null;
      this.isInitialized = false;
      
      console.log('✅ WebSocket server shut down');
    }
  }
}