import { db } from "../db";
import { operationLocks, operationQueue, users } from "../../shared/schema";
import { and, eq, lt, gte, or, desc, asc } from "drizzle-orm";
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
   * Force release expired locks (cleanup job)
   */
  static async cleanupExpiredLocks(): Promise<number> {
    console.log(`🧹 Cleaning up expired locks...`);
    
    const now = new Date();
    
    const expiredLocks = await db.select()
      .from(operationLocks)
      .where(
        and(
          eq(operationLocks.status, 'active'),
          lt(operationLocks.expiresAt, now)
        )
      );
    
    if (expiredLocks.length === 0) {
      return 0;
    }
    
    // Mark expired locks
    await db.update(operationLocks)
      .set({
        status: 'expired',
        completedAt: now
      })
      .where(
        and(
          eq(operationLocks.status, 'active'),
          lt(operationLocks.expiresAt, now)
        )
      );
    
    console.log(`🧹 Cleaned up ${expiredLocks.length} expired locks`);
    
    // Process queues for each expired operation type
    const processedTypes = new Set<string>();
    for (const lock of expiredLocks) {
      if (!processedTypes.has(lock.operationType)) {
        processedTypes.add(lock.operationType);
        // Trigger queue processing (will be implemented in OperationQueueService)
        console.log(`🔄 Processing queue for expired operation: ${lock.operationType}`);
      }
    }
    
    return expiredLocks.length;
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