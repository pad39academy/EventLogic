/**
 * Background Jobs Service
 * Handles periodic tasks like hotel occupancy updates to improve dashboard performance
 * Enhanced with event-driven processing capabilities
 */

import { storage } from "../storage";
import { EventService } from "./event";

export class BackgroundJobsService {
  private intervalId: NodeJS.Timeout | null = null;
  private eventProcessorInterval: NodeJS.Timeout | null = null;
  private readonly UPDATE_INTERVAL = 15 * 60 * 1000; // 15 minutes
  private readonly EVENT_PROCESSING_INTERVAL = 30 * 1000; // 30 seconds for event processing
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
    
    this.isRunning = true;
    console.log(`✅ Background jobs started:`);
    console.log(`   - Hotel occupancy updates every ${this.UPDATE_INTERVAL / 60000} minutes`);
    console.log(`   - Event processing every ${this.EVENT_PROCESSING_INTERVAL / 1000} seconds`);
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
   * Background job to update dashboard statistics views
   */
  private async updateHotelOccupancyJob(): Promise<void> {
    try {
      console.log("📊 [Background] Starting dashboard stats aggregation...");
      const startTime = Date.now();
      
      // Update hotel occupancy data first
      await storage.updateAllHotelOccupancy();
      
      // Publish background job completed event
      await EventService.publishEvent(
        'background_job_executed',
        'dashboard_stats_aggregation',
        'system',
        {
          jobName: 'dashboard_stats_aggregation',
          duration: Date.now() - startTime,
          status: 'success'
        }
      );
      
      const duration = Date.now() - startTime;
      console.log(`✅ [Background] Dashboard stats updated in ${duration}ms`);
      
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