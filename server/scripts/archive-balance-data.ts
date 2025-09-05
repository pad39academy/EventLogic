#!/usr/bin/env tsx

/**
 * Archive Balance Data Script
 * Archives old hotel balance data beyond the retention window
 * 
 * Usage:
 *   npm run archive-balance-data
 *   tsx server/scripts/archive-balance-data.ts
 *   tsx server/scripts/archive-balance-data.ts --dry-run
 *   tsx server/scripts/archive-balance-data.ts --days=60
 */

import { db } from '../db';
import { hotelDailyBalance } from '@shared/schema';
import { lt, sql } from 'drizzle-orm';

interface ArchiveOptions {
  dryRun: boolean;
  retentionDays: number;
  archivePath?: string;
}

class BalanceArchiver {
  
  /**
   * Archive old balance records beyond retention window
   */
  static async archiveOldBalances(options: ArchiveOptions): Promise<{
    recordsFound: number;
    recordsArchived: number;
    cutoffDate: string;
    success: boolean;
  }> {
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - options.retentionDays);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
    
    console.log(`📋 Balance Data Archive Process`);
    console.log(`🗓️ Retention: ${options.retentionDays} days`);
    console.log(`📅 Cutoff Date: ${cutoffDateStr}`);
    console.log(`🧪 Dry Run: ${options.dryRun ? 'YES' : 'NO'}`);
    console.log('');
    
    try {
      // Find records to archive
      const recordsToArchive = await db.select({
        id: hotelDailyBalance.id,
        hotelId: hotelDailyBalance.hotelId,
        instanceCode: hotelDailyBalance.instanceCode,
        balanceDate: hotelDailyBalance.balanceDate,
        totalRooms: hotelDailyBalance.totalRooms,
        calculatedOccupiedRooms: hotelDailyBalance.calculatedOccupiedRooms,
        occupancyPercentage: hotelDailyBalance.occupancyPercentage,
        createdAt: hotelDailyBalance.createdAt,
      })
      .from(hotelDailyBalance)
      .where(lt(hotelDailyBalance.balanceDate, cutoffDateStr))
      .orderBy(hotelDailyBalance.balanceDate, hotelDailyBalance.hotelId);
      
      console.log(`📊 Found ${recordsToArchive.length} records to archive`);
      
      if (recordsToArchive.length === 0) {
        console.log('✅ No records need archiving');
        return {
          recordsFound: 0,
          recordsArchived: 0,
          cutoffDate: cutoffDateStr,
          success: true,
        };
      }
      
      // Group by hotel for reporting
      const hotelStats = recordsToArchive.reduce((acc, record) => {
        const key = `${record.hotelId}-${record.instanceCode}`;
        if (!acc[key]) {
          acc[key] = { hotelId: record.hotelId, instanceCode: record.instanceCode, count: 0 };
        }
        acc[key].count++;
        return acc;
      }, {} as Record<string, { hotelId: string; instanceCode: string; count: number }>);
      
      console.log('\n📈 Records by hotel:');
      Object.values(hotelStats).forEach(stat => {
        console.log(`  ${stat.hotelId}-${stat.instanceCode}: ${stat.count} records`);
      });
      
      // Show date range being archived
      const oldestDate = recordsToArchive[0]?.balanceDate;
      const newestDate = recordsToArchive[recordsToArchive.length - 1]?.balanceDate;
      console.log(`\n📅 Date range: ${oldestDate} to ${newestDate}`);
      
      if (options.dryRun) {
        console.log('\n🧪 DRY RUN - No records will be deleted');
        console.log('Run without --dry-run to perform actual archival');
        return {
          recordsFound: recordsToArchive.length,
          recordsArchived: 0,
          cutoffDate: cutoffDateStr,
          success: true,
        };
      }
      
      // Export data before deletion (optional)
      if (options.archivePath) {
        console.log(`\n💾 Exporting data to ${options.archivePath}...`);
        await this.exportToFile(recordsToArchive, options.archivePath);
      }
      
      // Perform deletion
      console.log('\n🗑️ Deleting old balance records...');
      const result = await db.delete(hotelDailyBalance)
        .where(lt(hotelDailyBalance.balanceDate, cutoffDateStr));
      
      console.log(`✅ Successfully archived ${recordsToArchive.length} records`);
      console.log(`🧹 Database cleanup complete`);
      
      return {
        recordsFound: recordsToArchive.length,
        recordsArchived: recordsToArchive.length,
        cutoffDate: cutoffDateStr,
        success: true,
      };
      
    } catch (error) {
      console.error('❌ Archive process failed:', error);
      return {
        recordsFound: 0,
        recordsArchived: 0,
        cutoffDate: cutoffDateStr,
        success: false,
      };
    }
  }
  
  /**
   * Export balance data to JSON file
   */
  static async exportToFile(records: any[], filePath: string): Promise<void> {
    const fs = await import('fs');
    const path = await import('path');
    
    const archiveData = {
      exportDate: new Date().toISOString(),
      recordCount: records.length,
      records: records,
    };
    
    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(filePath, JSON.stringify(archiveData, null, 2));
    console.log(`✅ Exported ${records.length} records to ${filePath}`);
  }
  
  /**
   * Generate archive statistics
   */
  static async getArchiveStats(retentionDays: number): Promise<{
    totalRecords: number;
    recordsInWindow: number;
    recordsToArchive: number;
    oldestRecord: string | null;
    newestRecord: string | null;
  }> {
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
    
    // Get total record count
    const [totalCount] = await db.select({
      count: sql<number>`COUNT(*)`,
    }).from(hotelDailyBalance);
    
    // Get records in retention window
    const [windowCount] = await db.select({
      count: sql<number>`COUNT(*)`,
    })
    .from(hotelDailyBalance)
    .where(sql`${hotelDailyBalance.balanceDate} >= ${cutoffDateStr}`);
    
    // Get records to archive
    const [archiveCount] = await db.select({
      count: sql<number>`COUNT(*)`,
    })
    .from(hotelDailyBalance)
    .where(lt(hotelDailyBalance.balanceDate, cutoffDateStr));
    
    // Get date range
    const [dateRange] = await db.select({
      oldest: sql<string>`MIN(${hotelDailyBalance.balanceDate})`,
      newest: sql<string>`MAX(${hotelDailyBalance.balanceDate})`,
    }).from(hotelDailyBalance);
    
    return {
      totalRecords: totalCount.count,
      recordsInWindow: windowCount.count,
      recordsToArchive: archiveCount.count,
      oldestRecord: dateRange.oldest,
      newestRecord: dateRange.newest,
    };
  }
}

// CLI execution
async function main() {
  const args = process.argv.slice(2);
  
  const options: ArchiveOptions = {
    dryRun: args.includes('--dry-run'),
    retentionDays: 30, // Default: 30 days
  };
  
  // Parse retention days
  const daysArg = args.find(arg => arg.startsWith('--days='));
  if (daysArg) {
    options.retentionDays = parseInt(daysArg.split('=')[1]);
  }
  
  // Parse archive path
  const pathArg = args.find(arg => arg.startsWith('--export='));
  if (pathArg) {
    options.archivePath = pathArg.split('=')[1];
  }
  
  console.log('🏨 Hotel Balance Data Archive Tool\n');
  
  // Show current statistics
  console.log('📊 Current Statistics:');
  const stats = await BalanceArchiver.getArchiveStats(options.retentionDays);
  console.log(`   Total Records: ${stats.totalRecords}`);
  console.log(`   In Window (${options.retentionDays}d): ${stats.recordsInWindow}`);
  console.log(`   To Archive: ${stats.recordsToArchive}`);
  console.log(`   Date Range: ${stats.oldestRecord} to ${stats.newestRecord}`);
  console.log('');
  
  // Run archival process
  const result = await BalanceArchiver.archiveOldBalances(options);
  
  if (result.success) {
    console.log('\n🎉 Archive process completed successfully');
    process.exit(0);
  } else {
    console.log('\n💥 Archive process failed');
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default BalanceArchiver;