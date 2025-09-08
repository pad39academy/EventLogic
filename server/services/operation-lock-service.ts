import { db } from "../db";
import { operationLocks, operationQueue, users } from "../../shared/schema";
import { and, eq, lt, gte, or, desc, asc, sql } from "drizzle-orm";
import type { 
  OperationLock, 
  InsertOperationLock, 
  OperationQueue, 
  InsertOperationQueue,
  UpdateOperationLock,
  UpdateOperationQueue
} from "../../shared/schema";
import { EventService } from "./event";
import { WebSocketService } from "./websocket-service";

// Operation priorities (lower number = higher priority)
export const OPERATION_PRIORITIES = {
  // FOUNDATION DATA (Level 1)
  hotel_upload: 1,
  hotel_edit: 1,
  
  // INFRASTRUCTURE SETUP (Level 2)
  balance_window_creation: 2,
  balance_bucket_initialization: 2,
  
  // BALANCE INTEGRITY (Level 3) 
  balance_recalculation: 3,
  occupancy_update: 3,
  
  // PARTICIPANT DATA (Level 4)
  coach_upload: 4,
  coach_edit: 4,
  official_upload: 4,
  official_edit: 4,
  coaches_officials_batch: 4,
  
  // DEPENDENT DATA (Level 5)
  player_upload: 5,
  player_edit: 5,
  participant_bulk_operations: 5
};

// Conflicting operations matrix
export const CONFLICTING_OPERATIONS: Record<string, string[]> = {
  // Hotel operations conflict with everything (foundation)
  'hotel_upload': ['*'],
  'hotel_edit': ['*'],
  
  // Balance window creation conflicts with participant operations
  'balance_window_creation': [
    'coach_upload', 'coach_edit', 'official_upload', 'official_edit',
    'player_upload', 'player_edit', 'balance_recalculation', 'occupancy_update'
  ],
  
  // Balance operations conflict with participant operations
  'balance_recalculation': [
    'coach_upload', 'coach_edit', 'official_upload', 'official_edit',
    'player_upload', 'player_edit'
  ],
  'occupancy_update': [
    'coach_upload', 'coach_edit', 'official_upload', 'official_edit',
    'player_upload', 'player_edit'
  ],
  
  // Participant operations wait for balance infrastructure
  'coach_upload': ['balance_window_creation', 'balance_recalculation', 'hotel_upload'],
  'official_upload': ['balance_window_creation', 'balance_recalculation', 'hotel_upload'],
  'player_upload': ['balance_window_creation', 'balance_recalculation', 'hotel_upload', 'coach_upload'],
  
  // Edit operations have same conflicts as upload operations
  'coach_edit': ['balance_window_creation', 'balance_recalculation', 'hotel_upload'],
  'official_edit': ['balance_window_creation', 'balance_recalculation', 'hotel_upload'],
  'player_edit': ['balance_window_creation', 'balance_recalculation', 'hotel_upload', 'coach_upload']
};

export interface ConflictResult {
  canProceed: boolean;
  conflictingOperations: OperationLock[];
  estimatedWaitTime: number; // in seconds
  queuePosition?: number;
}

export interface OperationLockResult {
  granted: boolean;
  lock?: OperationLock;
  conflictingOperation?: string;
  conflictingAdmin?: string;
  estimatedWait?: number;
  reason?: string;
}

export class OperationLockService {
  
  /**
   * Check if an operation can proceed or if there are conflicts
   */
  static async checkOperationConflicts(
    operationType: string, 
    scope: string = 'global'
  ): Promise<ConflictResult> {
    console.log(`🔍 Checking conflicts for operation: ${operationType}`);
    
    // Get conflicting operation types
    const conflictingTypes = this.getConflictingOperationTypes(operationType);
    
    if (conflictingTypes.length === 0) {
      return {
        canProceed: true,
        conflictingOperations: [],
        estimatedWaitTime: 0
      };
    }
    
    // Check for active locks that conflict
    let conflictingLocks: any[] = [];
    
    if (conflictingTypes.length > 0) {
      conflictingLocks = await db.select({
        id: operationLocks.id,
        operationType: operationLocks.operationType,
        lockedByUserId: operationLocks.lockedByUserId,
        expiresAt: operationLocks.expiresAt,
        metadata: operationLocks.metadata
      })
      .from(operationLocks)
      .leftJoin(users, eq(operationLocks.lockedByUserId, users.id))
      .where(
        and(
          eq(operationLocks.status, 'active'),
          or(
            eq(operationLocks.operationScope, scope),
            eq(operationLocks.operationScope, 'global')
          ),
          // Check if operation type conflicts
          or(...conflictingTypes.map(type => eq(operationLocks.operationType, type))),
          // Only include non-expired locks
          gte(operationLocks.expiresAt, new Date())
        )
      );
    }
    
    if (conflictingLocks.length === 0) {
      return {
        canProceed: true,
        conflictingOperations: [],
        estimatedWaitTime: 0
      };
    }
    
    // Calculate estimated wait time based on lock expiration
    const now = new Date();
    const estimatedWaitTime = Math.max(
      ...conflictingLocks.map(lock => 
        Math.ceil((lock.expiresAt!.getTime() - now.getTime()) / 1000)
      )
    );
    
    console.log(`⚠️ Found ${conflictingLocks.length} conflicting operations. Estimated wait: ${estimatedWaitTime}s`);
    
    return {
      canProceed: false,
      conflictingOperations: conflictingLocks as OperationLock[],
      estimatedWaitTime: Math.max(estimatedWaitTime, 0)
    };
  }
  
  /**
   * Attempt to acquire an operation lock
   */
  static async acquireOperationLock(
    operationType: string,
    userId: string,
    sessionId: string,
    scope: string = 'global',
    timeoutMinutes: number = 30
  ): Promise<OperationLockResult> {
    
    console.log(`🔒 Attempting to acquire lock: ${operationType} for user ${userId}`);
    
    return await db.transaction(async (tx) => {
      // Check for conflicts within transaction
      const conflictCheck = await this.checkOperationConflicts(operationType, scope);
      
      if (!conflictCheck.canProceed) {
        console.log(`❌ Cannot acquire lock - conflicts detected`);
        
        const conflictingOp = conflictCheck.conflictingOperations[0];
        const conflictingUser = await tx.select({ name: users.name })
          .from(users)
          .where(eq(users.id, conflictingOp.lockedByUserId!))
          .limit(1);
        
        // Send WebSocket notification about blocked operation
        WebSocketService.notifyOperationBlocked(
          userId, 
          sessionId, 
          operationType, 
          conflictingOp.operationType, 
          1, // Position in queue (will be updated by queue service)
          conflictCheck.estimatedWaitTime
        );
        
        return {
          granted: false,
          conflictingOperation: conflictingOp.operationType,
          conflictingAdmin: conflictingUser[0]?.name || 'Unknown Admin',
          estimatedWait: conflictCheck.estimatedWaitTime,
          reason: `Operation blocked by ${conflictingOp.operationType}`
        };
      }
      
      // Create the lock
      const expiresAt = new Date(Date.now() + (timeoutMinutes * 60 * 1000));
      
      const insertLock: InsertOperationLock = {
        operationType,
        operationScope: scope,
        lockedByUserId: userId,
        lockedBySessionId: sessionId,
        expiresAt,
        metadata: {
          timestamp: new Date().toISOString(),
          priority: (OPERATION_PRIORITIES as Record<string, number>)[operationType] || 99
        }
      };
      
      const [lock] = await tx.insert(operationLocks).values(insertLock).returning();
      
      console.log(`✅ Lock acquired: ${operationType} (expires: ${expiresAt.toISOString()})`);
      
      // Publish lock event
      await EventService.publishEvent(
        'operation_locked',
        operationType,
        'operation',
        {
          operationType,
          userId,
          sessionId,
          expiresAt: expiresAt.toISOString(),
          scope
        },
        { userId, source: 'operation_lock_service' }
      );
      
      return {
        granted: true,
        lock,
        reason: 'Lock acquired successfully'
      };
    });
  }
  
  /**
   * Release an operation lock
   */
  static async releaseOperationLock(lockId: string, userId?: string): Promise<boolean> {
    console.log(`🔓 Releasing lock: ${lockId}`);
    
    return await db.transaction(async (tx) => {
      // Verify lock ownership if userId provided
      const whereClause = userId 
        ? and(eq(operationLocks.id, lockId), eq(operationLocks.lockedByUserId, userId))
        : eq(operationLocks.id, lockId);
      
      const [lock] = await tx.select()
        .from(operationLocks)
        .where(whereClause)
        .limit(1);
      
      if (!lock) {
        console.log(`❌ Lock not found or not owned by user: ${lockId}`);
        return false;
      }
      
      // Update lock status
      await tx.update(operationLocks)
        .set({
          status: 'completed',
          completedAt: new Date()
        })
        .where(eq(operationLocks.id, lockId));
      
      console.log(`✅ Lock released: ${lock.operationType}`);
      
      // Publish unlock event
      await EventService.publishEvent(
        'operation_unlocked',
        lock.operationType,
        'operation',
        {
          operationType: lock.operationType,
          lockId,
          completedAt: new Date().toISOString()
        },
        { userId: lock.lockedByUserId || undefined, source: 'operation_lock_service' }
      );
      
      return true;
    });
  }
  
  /**
   * Comprehensive cleanup of expired locks with queue processing
   */
  static async cleanupExpiredLocks(): Promise<{ cleanedCount: number; errorCount: number }> {
    let cleanedCount = 0;
    let errorCount = 0;

    try {
      console.log('🧹 Starting comprehensive expired lock cleanup...');
      
      // Import OperationQueueService dynamically to avoid circular dependency
      const { OperationQueueService } = await import('./operation-queue-service');
      
      // Find all expired locks
      const expiredLocks = await db
        .select()
        .from(operationLocks)
        .where(
          and(
            eq(operationLocks.status, 'active'),
            sql`${operationLocks.expiresAt} < now()`
          )
        );

      console.log(`🔍 Found ${expiredLocks.length} expired locks to clean up`);

      for (const lock of expiredLocks) {
        try {
          await db.transaction(async (tx) => {
            // Mark lock as expired
            await tx
              .update(operationLocks)
              .set({
                status: 'expired',
                failedAt: new Date(),
                errorMessage: 'Lock expired due to timeout'
              })
              .where(eq(operationLocks.id, lock.id));

            // Process any queued operations for this operation type
            await OperationQueueService.processQueueForOperationType(lock.operationType);

            // Publish unlock event
            await EventService.publishEvent(
              'operation_unlocked',
              lock.operationType,
              'operation',
              {
                operationType: lock.operationType,
                userId: lock.lockedByUserId,
                sessionId: lock.lockedBySessionId,
                reason: 'expired'
              },
              { userId: lock.lockedByUserId || 'system', source: 'lock_cleanup' }
            );

            cleanedCount++;
          });

          console.log(`✅ Cleaned expired lock: ${lock.operationType} (${lock.id})`);
        } catch (error) {
          console.error(`❌ Failed to clean expired lock ${lock.id}:`, error);
          errorCount++;
        }
      }

      console.log(`🧹 Lock cleanup completed: ${cleanedCount} cleaned, ${errorCount} errors`);
      return { cleanedCount, errorCount };
    } catch (error) {
      console.error('❌ Lock cleanup failed:', error);
      return { cleanedCount, errorCount: errorCount + 1 };
    }
  }

  /**
   * Clean up stale session locks
   */
  static async cleanupStaleSessions(maxSessionIdleMinutes: number = 60): Promise<{ cleanedCount: number; errorCount: number }> {
    let cleanedCount = 0;
    let errorCount = 0;

    try {
      console.log(`🧹 Starting stale session cleanup (idle > ${maxSessionIdleMinutes} minutes)...`);
      
      // Import OperationQueueService dynamically to avoid circular dependency
      const { OperationQueueService } = await import('./operation-queue-service');
      
      const staleThreshold = new Date(Date.now() - (maxSessionIdleMinutes * 60 * 1000));

      // Find locks from potentially stale sessions
      const staleLocks = await db
        .select()
        .from(operationLocks)
        .where(
          and(
            eq(operationLocks.status, 'active'),
            sql`${operationLocks.lockedAt} < ${staleThreshold}`
          )
        );

      console.log(`🔍 Found ${staleLocks.length} potentially stale session locks`);

      for (const lock of staleLocks) {
        try {
          // Check if session is still active by looking for recent activity
          const hasRecentActivity = await this.checkSessionActivity(lock.lockedBySessionId);
          
          if (!hasRecentActivity) {
            await db.transaction(async (tx) => {
              // Mark lock as expired due to stale session
              await tx
                .update(operationLocks)
                .set({
                  status: 'expired',
                  failedAt: new Date(),
                  errorMessage: 'Lock expired due to stale session'
                })
                .where(eq(operationLocks.id, lock.id));

              // Process any queued operations for this operation type
              await OperationQueueService.processQueueForOperationType(lock.operationType);

              // Publish unlock event
              await EventService.publishEvent(
                'operation_unlocked',
                lock.operationType,
                'operation',
                {
                  operationType: lock.operationType,
                  userId: lock.lockedByUserId,
                  sessionId: lock.lockedBySessionId,
                  reason: 'stale_session'
                },
                { userId: lock.lockedByUserId || 'system', source: 'session_cleanup' }
              );

              cleanedCount++;
            });

            console.log(`✅ Cleaned stale session lock: ${lock.operationType} (${lock.id})`);
          }
        } catch (error) {
          console.error(`❌ Failed to clean stale lock ${lock.id}:`, error);
          errorCount++;
        }
      }

      console.log(`🧹 Session cleanup completed: ${cleanedCount} cleaned, ${errorCount} errors`);
      return { cleanedCount, errorCount };
    } catch (error) {
      console.error('❌ Session cleanup failed:', error);
      return { cleanedCount, errorCount: errorCount + 1 };
    }
  }

  /**
   * Check if a session has recent activity (simple heuristic)
   * Since we don't have direct access to session storage, we use lock creation time
   */
  private static async checkSessionActivity(sessionId?: string | null): Promise<boolean> {
    if (!sessionId) return false;

    try {
      // Simple heuristic: Check if there are other recent locks from the same session
      // This indicates the session is still active
      const recentThreshold = new Date(Date.now() - (30 * 60 * 1000)); // 30 minutes
      
      const recentLocks = await db
        .select({ count: sql<number>`count(*)` })
        .from(operationLocks)
        .where(
          and(
            eq(operationLocks.lockedBySessionId, sessionId),
            sql`${operationLocks.lockedAt} > ${recentThreshold}`
          )
        );

      // If there are recent locks from this session, consider it active
      const hasRecentActivity = (recentLocks[0]?.count || 0) > 1;
      
      return hasRecentActivity;
    } catch (error) {
      console.error('Error checking session activity:', error);
      return false; // Assume inactive on error to err on the side of cleanup
    }
  }

  /**
   * Emergency force unlock - removes all active locks for a specific operation type
   */
  static async forceUnlockOperationType(operationType: string, reason: string = 'force_unlock'): Promise<{ unlockedCount: number; errorCount: number }> {
    let unlockedCount = 0;
    let errorCount = 0;

    try {
      console.log(`🚨 Force unlocking all locks for operation type: ${operationType}`);
      
      // Import OperationQueueService dynamically to avoid circular dependency
      const { OperationQueueService } = await import('./operation-queue-service');
      
      const activeLocks = await db
        .select()
        .from(operationLocks)
        .where(
          and(
            eq(operationLocks.operationType, operationType),
            eq(operationLocks.status, 'active')
          )
        );

      for (const lock of activeLocks) {
        try {
          await db.transaction(async (tx) => {
            // Mark lock as cancelled
            await tx
              .update(operationLocks)
              .set({
                status: 'cancelled',
                failedAt: new Date(),
                errorMessage: reason
              })
              .where(eq(operationLocks.id, lock.id));

            // Publish unlock event
            await EventService.publishEvent(
              'operation_unlocked',
              lock.operationType,
              'operation',
              {
                operationType: lock.operationType,
                userId: lock.lockedByUserId,
                sessionId: lock.lockedBySessionId,
                reason: 'force_unlock'
              },
              { userId: 'system', source: 'force_unlock' }
            );

            unlockedCount++;
          });

          console.log(`✅ Force unlocked: ${lock.operationType} (${lock.id})`);
        } catch (error) {
          console.error(`❌ Failed to force unlock ${lock.id}:`, error);
          errorCount++;
        }
      }

      // Process any queued operations
      await OperationQueueService.processQueueForOperationType(operationType);

      console.log(`🚨 Force unlock completed: ${unlockedCount} unlocked, ${errorCount} errors`);
      return { unlockedCount, errorCount };
    } catch (error) {
      console.error('❌ Force unlock failed:', error);
      return { unlockedCount: 0, errorCount: errorCount + 1 };
    }
  }

  /**
   * Get comprehensive lock status and statistics
   */
  static async getLockStatistics(): Promise<{
    activeLocks: number;
    expiredLocks: number;
    completedLocks: number;
    failedLocks: number;
    queuedOperations: number;
    oldestActiveLock?: Date;
    locksByType: Record<string, number>;
  }> {
    try {
      const [lockStats, queueStats] = await Promise.all([
        db
          .select({
            status: operationLocks.status,
            operationType: operationLocks.operationType,
            lockedAt: operationLocks.lockedAt
          })
          .from(operationLocks),
        db
          .select({ count: sql<number>`count(*)` })
          .from(operationQueue)
          .where(eq(operationQueue.status, 'waiting'))
      ]);

      const stats = {
        activeLocks: 0,
        expiredLocks: 0,
        completedLocks: 0,
        failedLocks: 0,
        queuedOperations: queueStats[0]?.count || 0,
        oldestActiveLock: undefined as Date | undefined,
        locksByType: {} as Record<string, number>
      };

      lockStats.forEach(lock => {
        // Count by status
        switch (lock.status) {
          case 'active':
            stats.activeLocks++;
            if (!stats.oldestActiveLock || lock.lockedAt < stats.oldestActiveLock) {
              stats.oldestActiveLock = lock.lockedAt;
            }
            break;
          case 'expired':
            stats.expiredLocks++;
            break;
          case 'completed':
            stats.completedLocks++;
            break;
          case 'failed':
            stats.failedLocks++;
            break;
        }

        // Count by operation type
        stats.locksByType[lock.operationType] = (stats.locksByType[lock.operationType] || 0) + 1;
      });

      return stats;
    } catch (error) {
      console.error('❌ Failed to get lock statistics:', error);
      throw error;
    }
  }
  
  /**
   * Get conflicting operation types for a given operation
   */
  static getConflictingOperationTypes(operationType: string): string[] {
    const conflicts = CONFLICTING_OPERATIONS[operationType] || [];
    
    // Handle wildcard conflicts
    if (conflicts.includes('*')) {
      // Return all operation types except itself
      return Object.keys(OPERATION_PRIORITIES).filter(type => type !== operationType);
    }
    
    return conflicts;
  }
  
  /**
   * Get active operations (for debugging/monitoring)
   */
  static async getActiveOperations(): Promise<OperationLock[]> {
    return await db.select()
      .from(operationLocks)
      .where(
        and(
          eq(operationLocks.status, 'active'),
          gte(operationLocks.expiresAt, new Date())
        )
      )
      .orderBy(desc(operationLocks.lockedAt));
  }
  
  /**
   * Check if user has any active locks
   */
  static async getUserActiveLocks(userId: string): Promise<OperationLock[]> {
    return await db.select()
      .from(operationLocks)
      .where(
        and(
          eq(operationLocks.lockedByUserId, userId),
          eq(operationLocks.status, 'active'),
          gte(operationLocks.expiresAt, new Date())
        )
      );
  }
}