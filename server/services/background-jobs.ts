/**
 * Background Jobs Service
 * Handles periodic tasks like hotel occupancy updates to improve dashboard performance
 * Enhanced with event-driven processing capabilities
 */

import { storage } from "../storage";
import { EventService } from "./event";
import { OperationLockService } from "./operation-lock-service";
import { OperationQueueService } from "./operation-queue-service";
import { WebSocketService } from "./websocket-service";

export class BackgroundJobsService {
  private intervalId: NodeJS.Timeout | null = null;
  private eventProcessorInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly UPDATE_INTERVAL = 15 * 60 * 1000; // 15 minutes
  private readonly EVENT_PROCESSING_INTERVAL = 30 * 1000; // 30 seconds for event processing
  private readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes for cleanup tasks
  private isRunning = false;

  /**
   * Start background jobs for periodic hotel occupancy updates and event processing
   * This reduces the load on dashboard requests by pre-calculating occupancy
   * and ensures all events are processed reliably
   */
  start(): void {
    if (this.isRunning) {
      console.log("🔄 Background jobs already running");
      return;
    }

    console.log("🚀 Starting background jobs service...");
    
    // Run initial update
    this.updateHotelOccupancyJob();
    
    // Schedule periodic updates
    this.intervalId = setInterval(() => {
      this.updateHotelOccupancyJob();
    }, this.UPDATE_INTERVAL);

    // Schedule event processing
    this.eventProcessorInterval = setInterval(() => {
      this.processEventsJob();
    }, this.EVENT_PROCESSING_INTERVAL);

    // Schedule cleanup tasks
    this.cleanupInterval = setInterval(() => {
      this.cleanupJob();
    }, this.CLEANUP_INTERVAL);
    
    this.isRunning = true;
    console.log(`✅ Background jobs started:`);
    console.log(`   - Hotel occupancy updates every ${this.UPDATE_INTERVAL / 60000} minutes`);
    console.log(`   - Event processing every ${this.EVENT_PROCESSING_INTERVAL / 1000} seconds`);
    console.log(`   - Cleanup tasks every ${this.CLEANUP_INTERVAL / 60000} minutes`);
  }

  /**
   * Stop background jobs
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.eventProcessorInterval) {
      clearInterval(this.eventProcessorInterval);
      this.eventProcessorInterval = null;
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.isRunning = false;
    console.log("🛑 Background jobs stopped");
  }

  /**
   * Get current status
   */
  getStatus(): { running: boolean; nextUpdate?: number } {
    return {
      running: this.isRunning,
      nextUpdate: this.intervalId ? Date.now() + this.UPDATE_INTERVAL : undefined
    };
  }

  /**
   * Manual trigger for hotel occupancy update
   */
  async triggerUpdate(): Promise<void> {
    console.log("🔄 Manual trigger: Updating hotel occupancy...");
    await this.updateHotelOccupancyJob();
  }

  /**
   * Manual trigger for event processing
   */
  async triggerEventProcessing(): Promise<void> {
    console.log("🔄 Manual trigger: Processing events...");
    await this.processEventsJob();
  }

  /**
   * Background job to update dashboard statistics views with operation coordination
   */
  private async updateHotelOccupancyJob(): Promise<void> {
    let lockResult: any = null;
    
    try {
      console.log("📊 [Background] Starting coordinated dashboard stats aggregation...");
      const startTime = Date.now();
      
      // Try to acquire operation lock for balance calculation
      const lockResult = await OperationLockService.acquireOperationLock(
        'balance_recalculation',
        'system',
        'background_session',
        'global',
        30 // 30 minute timeout
      );

      if (!lockResult.granted) {
        console.log("⏳ [Background] Dashboard stats blocked by user operation, skipping this cycle");
        
        // Notify about background job being skipped via broadcast
        WebSocketService.broadcast('system_notifications', {
          type: 'background_job_status',
          data: {
            jobType: 'dashboard_stats',
            status: 'skipped',
            reason: lockResult.reason,
            blockedBy: lockResult.conflictingOperation,
            nextAttempt: new Date(Date.now() + this.UPDATE_INTERVAL).toISOString()
          },
          timestamp: new Date().toISOString()
        });
        
        return;
      }

      try {
        // ⚡ OPTIMIZED: Use fast dashboard stats calculation
        console.log("⚡ OPTIMIZED: Fast dashboard stats calculation...");
        await storage.getDashboardStatsOptimized(undefined, true);
        
        const duration = Date.now() - startTime;
        console.log(`⚡ [Background] OPTIMIZED dashboard stats updated in ${duration}ms (was 160+ seconds!)`);
        
        // Publish background job completed event
        await EventService.publishEvent(
          'background_job_executed',
          'dashboard_stats_aggregation',
          'system',
          {
            jobName: 'dashboard_stats_aggregation',
            duration: duration,
            status: 'success',
            operationId: lockResult.lock?.id
          }
        );

      } finally {
        // Always release lock
        if (lockResult.lock) {
          await OperationLockService.releaseOperationLock(lockResult.lock.id, 'system');
          console.log("🔓 [Background] Dashboard stats lock released");
        }
      }
      
    } catch (error) {
      console.error("❌ [Background] Dashboard stats update failed:", error);
      
      // Publish failure event
      await EventService.publishEvent(
        'background_job_executed',
        'dashboard_stats_aggregation',
        'system',
        {
          jobName: 'dashboard_stats_aggregation',
          duration: 0,
          status: 'error',
          error: (error as Error).message || 'Unknown error'
        }
      );
    }
  }

  /**
   * Background job to process pending events
   */
  private async processEventsJob(): Promise<void> {
    try {
      console.log("📧 [Background] Processing pending events...");
      const startTime = Date.now();
      
      // Process up to 50 pending events per cycle
      await EventService.processPendingEvents(50);
      
      // Retry failed events (up to 3 retries, max 5 events per cycle)
      await EventService.retryFailedEvents(3, 5);
      
      const duration = Date.now() - startTime;
      console.log(`✅ [Background] Event processing completed in ${duration}ms`);
      
    } catch (error) {
      console.error("❌ [Background] Event processing failed:", error);
    }
  }

  /**
   * Background job to run cleanup tasks
   */
  private async cleanupJob(): Promise<void> {
    try {
      console.log("🧹 [Background] Starting cleanup tasks...");
      const startTime = Date.now();

      // Run cleanup tasks in parallel
      const [
        expiredCleanupResult,
        sessionCleanupResult
      ] = await Promise.all([
        // Clean up expired locks
        OperationLockService.cleanupExpiredLocks(),
        
        // Clean up stale sessions (after 1 hour of inactivity)
        OperationLockService.cleanupStaleSessions(60)
      ]);

      // Clean up old queue entries (if method exists)
      let queueCleanupCount = 0;
      try {
        if (typeof OperationQueueService.cleanupOldQueueEntries === 'function') {
          queueCleanupCount = await OperationQueueService.cleanupOldQueueEntries();
        }
      } catch (error) {
        console.error("❌ Queue cleanup error:", error);
      }

      const duration = Date.now() - startTime;
      const totalCleaned = expiredCleanupResult.cleanedCount + 
                          sessionCleanupResult.cleanedCount + 
                          queueCleanupCount;
      const totalErrors = expiredCleanupResult.errorCount + 
                         sessionCleanupResult.errorCount;

      console.log(`🧹 [Background] Cleanup completed in ${duration}ms`);
      console.log(`   - Total cleaned: ${totalCleaned} items`);
      console.log(`   - Total errors: ${totalErrors} errors`);

      // Publish cleanup event if items were cleaned or errors occurred
      if (totalCleaned > 0 || totalErrors > 0) {
        await EventService.publishEvent(
          'background_job_executed',
          'cleanup_tasks',
          'system',
          {
            jobName: 'cleanup_tasks',
            duration: duration,
            status: totalErrors > 0 ? 'partial_success' : 'success',
            cleaned: totalCleaned,
            errors: totalErrors,
            details: {
              expiredLocks: expiredCleanupResult,
              staleSessions: sessionCleanupResult,
              queueCleanup: { cleanedCount: queueCleanupCount, errorCount: 0 }
            }
          }
        );
      }
    } catch (error) {
      console.error("❌ [Background] Cleanup tasks failed:", error);
      
      // Publish failure event
      await EventService.publishEvent(
        'background_job_executed',
        'cleanup_tasks',
        'system',
        {
          jobName: 'cleanup_tasks',
          duration: 0,
          status: 'error',
          error: (error as Error).message || 'Unknown error'
        }
      );
    }
  }
}

// Singleton instance
let backgroundJobsService: BackgroundJobsService | null = null;

export function createBackgroundJobsService(): BackgroundJobsService {
  if (!backgroundJobsService) {
    backgroundJobsService = new BackgroundJobsService();
  }
  return backgroundJobsService;
}

export function getBackgroundJobsService(): BackgroundJobsService | null {
  return backgroundJobsService;
}