import { db } from "../db";
import { operationQueue, operationLocks, users } from "../../shared/schema";
import { and, eq, desc, asc, lt } from "drizzle-orm";
import type { 
  OperationQueue, 
  InsertOperationQueue, 
  UpdateOperationQueue,
  OperationLock
} from "../../shared/schema";
import { EventService } from "./event";
import { OperationLockService, OPERATION_PRIORITIES } from "./operation-lock-service";

export interface QueueEntry {
  id: string;
  position: number;
  estimatedWaitTime: number;
  operationType: string;
  queuedAt: Date;
}

export interface NotificationTarget {
  userId: string;
  sessionId: string;
  operationType: string;
  message: string;
  estimatedWaitTime?: number;
  queuePosition?: number;
}

export class OperationQueueService {
  
  /**
   * Queue an operation when it cannot proceed due to conflicts
   */
  static async queueOperation(
    operationType: string,
    userId: string,
    sessionId: string,
    operationData: any = null,
    priority?: number
  ): Promise<QueueEntry> {
    
    console.log(`📥 Queuing operation: ${operationType} for user ${userId}`);
    
    // Get default priority if not specified
    const operationPriority = priority || (OPERATION_PRIORITIES as Record<string, number>)[operationType] || 99;
    
    // Find blocking operation
    const conflictCheck = await OperationLockService.checkOperationConflicts(operationType);
    const blockingLock = conflictCheck.conflictingOperations[0];
    
    const insertQueue: InsertOperationQueue = {
      userId,
      sessionId,
      operationType,
      operationData,
      priority: operationPriority,
      blockedByOperationId: blockingLock?.id,
      estimatedWaitTime: conflictCheck.estimatedWaitTime,
      metadata: {
        timestamp: new Date().toISOString(),
        blockingOperation: blockingLock?.operationType || 'unknown'
      }
    };
    
    const [queueEntry] = await db.insert(operationQueue).values(insertQueue).returning();
    
    // Calculate queue position
    const position = await this.calculateQueuePosition(queueEntry.id, operationPriority);
    
    console.log(`✅ Operation queued at position ${position}: ${operationType}`);
    
    // Publish queue event
    await EventService.publishEvent(
      'operation_queued',
      operationType,
      'operation',
      {
        operationType,
        userId,
        queuePosition: position,
        estimatedWaitTime: conflictCheck.estimatedWaitTime,
        blockingOperation: blockingLock?.operationType || 'unknown'
      },
      { userId, source: 'operation_queue_service' }
    );
    
    return {
      id: queueEntry.id,
      position,
      estimatedWaitTime: conflictCheck.estimatedWaitTime,
      operationType,
      queuedAt: queueEntry.queuedAt!
    };
  }
  
  /**
   * Process queue for a specific operation type when locks are released
   */
  static async processQueueForOperationType(operationType: string): Promise<void> {
    console.log(`🔄 Processing queue for operation type: ${operationType}`);
    
    // Get conflicting operation types
    const conflictingTypes = OperationLockService.getConflictingOperationTypes(operationType);
    conflictingTypes.push(operationType); // Include the operation itself
    
    // Get all waiting operations that could be unblocked
    const waitingOperations = await db.select()
      .from(operationQueue)
      .leftJoin(users, eq(operationQueue.userId, users.id))
      .where(
        and(
          eq(operationQueue.status, 'waiting'),
          // Operations that were blocked by this type
          ...(conflictingTypes.map(type => eq(operationQueue.operationType, type)))
        )
      )
      .orderBy(
        asc(operationQueue.priority), // Higher priority first (lower number)
        asc(operationQueue.queuedAt)   // Earlier queued time as tiebreaker
      );
    
    for (const operation of waitingOperations) {
      const canProceed = await this.checkIfOperationCanProceed(operation.operation_queue.id);
      
      if (canProceed) {
        await this.notifyOperationReady(
          operation.operation_queue.userId,
          operation.operation_queue.sessionId,
          operation.operation_queue.operationType,
          operation.operation_queue.id
        );
        
        // Update queue status
        await db.update(operationQueue)
          .set({ 
            status: 'ready',
            notifiedAt: new Date()
          })
          .where(eq(operationQueue.id, operation.operation_queue.id));
        
        break; // Only notify one operation at a time to prevent conflicts
      }
    }
    
    // Update queue positions for remaining operations
    await this.updateQueuePositions(conflictingTypes);
  }
  
  /**
   * Check if a queued operation can now proceed
   */
  static async checkIfOperationCanProceed(queueId: string): Promise<boolean> {
    const [queueEntry] = await db.select()
      .from(operationQueue)
      .where(eq(operationQueue.id, queueId))
      .limit(1);
    
    if (!queueEntry) return false;
    
    // Check for conflicts
    const conflictCheck = await OperationLockService.checkOperationConflicts(queueEntry.operationType);
    
    return conflictCheck.canProceed;
  }
  
  /**
   * Notify user that their operation can now proceed
   */
  static async notifyOperationReady(
    userId: string,
    sessionId: string,
    operationType: string,
    queueId: string
  ): Promise<void> {
    
    console.log(`🎉 Notifying user ${userId} that ${operationType} can proceed`);
    
    // Publish ready event
    await EventService.publishEvent(
      'operation_ready',
      operationType,
      'operation',
      {
        operationType,
        userId,
        sessionId,
        queueId,
        message: `Your ${operationType} operation can now proceed`
      },
      { userId, source: 'operation_queue_service' }
    );
    
    // TODO: Send WebSocket notification to user
    // This will be implemented when we add WebSocket support
    console.log(`📱 WebSocket notification would be sent to user ${userId} session ${sessionId}`);
  }
  
  /**
   * Cancel a queued operation
   */
  static async cancelQueuedOperation(
    queueId: string, 
    userId?: string,
    reason?: string
  ): Promise<boolean> {
    
    console.log(`❌ Cancelling queued operation: ${queueId}`);
    
    const whereClause = userId 
      ? and(eq(operationQueue.id, queueId), eq(operationQueue.userId, userId))
      : eq(operationQueue.id, queueId);
    
    const [queueEntry] = await db.select()
      .from(operationQueue)
      .where(whereClause)
      .limit(1);
    
    if (!queueEntry) {
      console.log(`❌ Queue entry not found or not owned by user: ${queueId}`);
      return false;
    }
    
    // Update status to cancelled
    await db.update(operationQueue)
      .set({
        status: 'cancelled',
        cancelledAt: new Date(),
        metadata: {
          ...queueEntry.metadata as any,
          cancellationReason: reason || 'User cancelled'
        }
      })
      .where(eq(operationQueue.id, queueId));
    
    // Publish cancellation event
    await EventService.publishEvent(
      'operation_cancelled',
      queueEntry.operationType,
      'operation',
      {
        operationType: queueEntry.operationType,
        queueId,
        reason: reason || 'User cancelled',
        userId: queueEntry.userId
      },
      { userId: queueEntry.userId, source: 'operation_queue_service' }
    );
    
    // Update queue positions for remaining operations
    const conflictingTypes = OperationLockService.getConflictingOperationTypes(queueEntry.operationType);
    await this.updateQueuePositions(conflictingTypes);
    
    return true;
  }
  
  /**
   * Calculate queue position for an operation
   */
  static async calculateQueuePosition(queueId: string, priority: number): Promise<number> {
    const higherPriorityOperations = await db.select()
      .from(operationQueue)
      .where(
        and(
          eq(operationQueue.status, 'waiting'),
          lt(operationQueue.priority, priority)
        )
      );
    
    return higherPriorityOperations.length + 1;
  }
  
  /**
   * Update queue positions after changes
   */
  static async updateQueuePositions(operationTypes: string[]): Promise<void> {
    const waitingOperations = await db.select()
      .from(operationQueue)
      .where(eq(operationQueue.status, 'waiting'))
      .orderBy(asc(operationQueue.priority), asc(operationQueue.queuedAt));
    
    let position = 1;
    for (const operation of waitingOperations) {
      // Publish position update event
      await EventService.publishEvent(
        'queue_position_updated',
        operation.operationType,
        'operation',
        {
          queueId: operation.id,
          operationType: operation.operationType,
          newPosition: position,
          userId: operation.userId
        },
        { userId: operation.userId, source: 'operation_queue_service' }
      );
      
      position++;
    }
  }
  
  /**
   * Get user's queued operations
   */
  static async getUserQueuedOperations(userId: string): Promise<OperationQueue[]> {
    return await db.select()
      .from(operationQueue)
      .where(
        and(
          eq(operationQueue.userId, userId),
          eq(operationQueue.status, 'waiting')
        )
      )
      .orderBy(asc(operationQueue.priority), asc(operationQueue.queuedAt));
  }
  
  /**
   * Get all waiting operations (for admin monitoring)
   */
  static async getWaitingOperations(): Promise<any[]> {
    return await db.select({
      id: operationQueue.id,
      operationType: operationQueue.operationType,
      userName: users.name,
      priority: operationQueue.priority,
      queuedAt: operationQueue.queuedAt,
      estimatedWaitTime: operationQueue.estimatedWaitTime
    })
    .from(operationQueue)
    .leftJoin(users, eq(operationQueue.userId, users.id))
    .where(eq(operationQueue.status, 'waiting'))
    .orderBy(asc(operationQueue.priority), asc(operationQueue.queuedAt));
  }
  
  /**
   * Cleanup completed and cancelled queue entries (maintenance job)
   */
  static async cleanupOldQueueEntries(olderThanHours: number = 24): Promise<number> {
    const cutoff = new Date(Date.now() - (olderThanHours * 60 * 60 * 1000));
    
    const result = await db.delete(operationQueue)
      .where(
        and(
          eq(operationQueue.status, 'completed'),
          lt(operationQueue.completedAt, cutoff)
        )
      );
    
    console.log(`🧹 Cleaned up ${result.rowCount} old queue entries`);
    
    return result.rowCount || 0;
  }
}