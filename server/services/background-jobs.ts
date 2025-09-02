/**
 * Background Jobs Service
 * Handles periodic tasks like hotel occupancy updates to improve dashboard performance
 */

import type { DatabaseStorage } from "./storage";

export class BackgroundJobsService {
  private storage: DatabaseStorage;
  private intervalId: NodeJS.Timeout | null = null;
  private readonly UPDATE_INTERVAL = 10 * 60 * 1000; // 10 minutes
  private isRunning = false;

  constructor(storage: DatabaseStorage) {
    this.storage = storage;
  }

  /**
   * Start background job for periodic hotel occupancy updates
   * This reduces the load on dashboard requests by pre-calculating occupancy
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
    
    this.isRunning = true;
    console.log(`✅ Background jobs started (updating every ${this.UPDATE_INTERVAL / 60000} minutes)`);
  }

  /**
   * Stop background jobs
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
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
   * Background job to update all hotel occupancy data
   */
  private async updateHotelOccupancyJob(): Promise<void> {
    try {
      console.log("🏨 [Background] Starting hotel occupancy update...");
      const startTime = Date.now();
      
      await this.storage.updateAllHotelOccupancy();
      
      const duration = Date.now() - startTime;
      console.log(`✅ [Background] Hotel occupancy updated in ${duration}ms`);
      
      // Also invalidate dashboard cache to ensure fresh data
      this.storage.invalidateDashboardCache();
      
    } catch (error) {
      console.error("❌ [Background] Hotel occupancy update failed:", error);
    }
  }
}

// Singleton instance
let backgroundJobsService: BackgroundJobsService | null = null;

export function createBackgroundJobsService(storage: DatabaseStorage): BackgroundJobsService {
  if (!backgroundJobsService) {
    backgroundJobsService = new BackgroundJobsService(storage);
  }
  return backgroundJobsService;
}

export function getBackgroundJobsService(): BackgroundJobsService | null {
  return backgroundJobsService;
}