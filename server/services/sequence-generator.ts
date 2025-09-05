import { db } from '../db';
import { eventStore } from '@shared/schema';
import { eq, sql, desc } from 'drizzle-orm';

/**
 * Sequence Number Generator for Event Store Daily Partitions
 * Generates sequential numbers per day for event ordering
 */
export class SequenceGenerator {
  
  /**
   * Generate the next sequence number for a given date
   * Ensures atomic sequence generation within daily partition
   */
  static async getNextSequenceNumber(eventDate: Date): Promise<number> {
    const partitionKey = eventDate.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    return await db.transaction(async (tx) => {
      // Get the highest sequence number for this date
      const [lastEvent] = await tx.select({
        sequenceNumber: eventStore.sequenceNumber
      })
      .from(eventStore)
      .where(eq(eventStore.partitionKey, partitionKey))
      .orderBy(desc(eventStore.sequenceNumber))
      .limit(1);
      
      const nextSequence = lastEvent ? Number(lastEvent.sequenceNumber) + 1 : 1;
      
      return nextSequence;
    });
  }
  
  /**
   * Generate partition key from date (YYYY-MM-DD format)
   */
  static generatePartitionKey(date: Date): string {
    return date.toISOString().split('T')[0];
  }
  
  /**
   * Generate correlation ID for event tracking
   */
  static generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Validate sequence integrity for a given date
   * Ensures no gaps in sequence numbers
   */
  static async validateSequenceIntegrity(eventDate: Date): Promise<{
    isValid: boolean;
    gaps: number[];
    totalEvents: number;
    expectedSequence: number;
  }> {
    const partitionKey = eventDate.toISOString().split('T')[0];
    
    // Get all sequence numbers for this date
    const sequences = await db.select({
      sequenceNumber: eventStore.sequenceNumber
    })
    .from(eventStore)
    .where(eq(eventStore.partitionKey, partitionKey))
    .orderBy(eventStore.sequenceNumber);
    
    const sequenceNumbers = sequences.map(s => Number(s.sequenceNumber));
    const totalEvents = sequenceNumbers.length;
    const expectedSequence = totalEvents + 1;
    
    // Check for gaps
    const gaps: number[] = [];
    for (let i = 1; i <= totalEvents; i++) {
      if (!sequenceNumbers.includes(i)) {
        gaps.push(i);
      }
    }
    
    return {
      isValid: gaps.length === 0,
      gaps,
      totalEvents,
      expectedSequence,
    };
  }
  
  /**
   * Get event statistics for a date range
   */
  static async getEventStats(startDate: Date, endDate: Date): Promise<{
    totalEvents: number;
    dailyBreakdown: Array<{
      date: string;
      eventCount: number;
      maxSequence: number;
    }>;
  }> {
    const startKey = startDate.toISOString().split('T')[0];
    const endKey = endDate.toISOString().split('T')[0];
    
    // Get event counts per day
    const dailyStats = await db.select({
      partitionKey: eventStore.partitionKey,
      eventCount: sql<number>`COUNT(*)`,
      maxSequence: sql<number>`MAX(${eventStore.sequenceNumber})`,
    })
    .from(eventStore)
    .where(sql`${eventStore.partitionKey} BETWEEN ${startKey} AND ${endKey}`)
    .groupBy(eventStore.partitionKey)
    .orderBy(eventStore.partitionKey);
    
    const totalEvents = dailyStats.reduce((sum, day) => sum + day.eventCount, 0);
    
    const dailyBreakdown = dailyStats.map(stat => ({
      date: stat.partitionKey,
      eventCount: stat.eventCount,
      maxSequence: stat.maxSequence,
    }));
    
    return {
      totalEvents,
      dailyBreakdown,
    };
  }
  
  /**
   * Repair sequence gaps (emergency use only)
   * Re-sequences events to eliminate gaps
   */
  static async repairSequenceGaps(eventDate: Date): Promise<{
    gapsFound: number;
    eventsResequenced: number;
  }> {
    console.warn(`🔧 EMERGENCY: Repairing sequence gaps for ${eventDate.toISOString().split('T')[0]}`);
    
    const partitionKey = eventDate.toISOString().split('T')[0];
    
    return await db.transaction(async (tx) => {
      // Get all events for this date, ordered by creation time
      const events = await tx.select({
        id: eventStore.id,
        sequenceNumber: eventStore.sequenceNumber,
        createdAt: eventStore.createdAt,
      })
      .from(eventStore)
      .where(eq(eventStore.partitionKey, partitionKey))
      .orderBy(eventStore.createdAt);
      
      const originalGaps = await this.validateSequenceIntegrity(eventDate);
      
      // Re-sequence events in chronological order
      let resequenced = 0;
      for (let i = 0; i < events.length; i++) {
        const expectedSequence = i + 1;
        const currentSequence = Number(events[i].sequenceNumber);
        
        if (currentSequence !== expectedSequence) {
          await tx.update(eventStore)
            .set({ sequenceNumber: expectedSequence })
            .where(eq(eventStore.id, events[i].id));
          
          resequenced++;
        }
      }
      
      return {
        gapsFound: originalGaps.gaps.length,
        eventsResequenced: resequenced,
      };
    });
  }
}