import { db } from "../db";
import { storage } from "../storage";
import { 
  eventStore, eventHandlers, hotelOccupancyBalance, hotelDailyBalance, hotels, participants, auditLog,
  type InsertEventStore, type InsertEventHandler, type EventStore,
  type InsertHotelOccupancyBalance, type HotelOccupancyBalance, type InsertHotelDailyBalance
} from "@shared/schema";
import { SequenceGenerator } from './sequence-generator';
import { BalanceWindowManager } from './balance-window-manager';
import { eq, and, sql, gte, lte, desc } from "drizzle-orm";

// Event data type definitions
export interface BookingCreatedEvent {
  participantId: string;
  role: 'coach' | 'official' | 'player';
  hotelId: string;
  instanceCode: string;
  bookingStartDate: string;
  bookingEndDate: string;
  teamName?: string;
  coachId?: string;
}

export interface HotelOccupancyChangedEvent {
  hotelId: string;
  instanceCode: string;
  date: string;
  previousOccupancy: {
    playersCount: number;
    coachesCount: number;
    officialsCount: number;
    calculatedOccupiedRooms: number;
  };
  newOccupancy: {
    playersCount: number;
    coachesCount: number;
    officialsCount: number;
    calculatedOccupiedRooms: number;
  };
  totalRooms: number;
}

export interface ParticipantRegisteredEvent {
  participantId: string;
  name: string;
  role: 'coach' | 'official' | 'player';
  hotelId: string;
  instanceCode: string;
  bookingStartDate: string;
  bookingEndDate: string;
  discipline?: string;
  district?: string;
  teamName?: string;
  coachId?: string;
}

export class EventService {
  
  /**
   * Publish an event to the event store with ACID transaction + daily partitioning
   */
  static async publishEvent(
    eventType: string,
    aggregateId: string,
    aggregateType: string,
    eventData: any,
    metadata: any = {}
  ): Promise<EventStore> {
    const eventDate = new Date();
    
    // ACID + PARTITIONING: Wrap event creation + processing in single transaction
    return await db.transaction(async (tx) => {
      // Generate sequence number for daily partition
      const sequenceNumber = await SequenceGenerator.getNextSequenceNumber(eventDate);
      const partitionKey = SequenceGenerator.generatePartitionKey(eventDate);
      
      const insertEvent: InsertEventStore = {
        eventType: eventType as any,
        aggregateId,
        aggregateType,
        eventData,
        // Daily partitioning fields
        eventDate: eventDate.toISOString().split('T')[0],
        sequenceNumber,
        partitionKey,
        // Standard fields
        metadata: {
          ...metadata,
          timestamp: eventDate.toISOString(),
          correlationId: metadata.correlationId || SequenceGenerator.generateCorrelationId(),
        },
        status: "pending",
      };

      const [event] = await tx.insert(eventStore).values(insertEvent).returning();
      console.log(`📧 Event published: ${eventType} #${sequenceNumber} for ${aggregateType}:${aggregateId} on ${partitionKey}`);

      // Process event immediately within same transaction
      await this.processEventInTransaction(event.id, tx);

      return event;
    });
  }

  /**
   * Process a single event by running all registered handlers (within transaction)
   */
  static async processEventInTransaction(eventId: string, tx: any): Promise<void> {
    const [event] = await tx.select().from(eventStore).where(eq(eventStore.id, eventId));
    
    if (!event || event.status !== 'pending') {
      return;
    }

    console.log(`🔄 Processing event: ${event.eventType} (${eventId})`);

    try {
      // Get registered handlers for this event type
      const handlers = this.getEventHandlers(event.eventType);

      // Execute each handler within the same transaction
      for (const handlerName of handlers) {
        await this.executeHandlerInTransaction(event, handlerName, tx);
      }

      // Mark event as processed
      await tx.update(eventStore)
        .set({ 
          status: 'processed', 
          processedAt: new Date() 
        })
        .where(eq(eventStore.id, eventId));

      console.log(`✅ Event processed successfully: ${event.eventType} (${eventId})`);

    } catch (error) {
      console.error(`❌ Event processing failed: ${event.eventType} (${eventId})`, error);
      
      // Mark event as failed
      await tx.update(eventStore)
        .set({ 
          status: 'failed', 
          failedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        })
        .where(eq(eventStore.id, eventId));
      
      throw error; // Re-throw to rollback the entire transaction
    }
  }

  /**
   * Process a single event by running all registered handlers (legacy method)
   */
  static async processEvent(eventId: string): Promise<void> {
    const [event] = await db.select().from(eventStore).where(eq(eventStore.id, eventId));
    
    if (!event || event.status !== 'pending') {
      return;
    }

    console.log(`🔄 Processing event: ${event.eventType} (${eventId})`);

    try {
      // Get registered handlers for this event type
      const handlers = this.getEventHandlers(event.eventType);

      // Execute each handler
      for (const handlerName of handlers) {
        await this.executeHandler(event, handlerName);
      }

      // Mark event as processed
      await db.update(eventStore)
        .set({ 
          status: 'processed', 
          processedAt: new Date() 
        })
        .where(eq(eventStore.id, eventId));

      console.log(`✅ Event processed successfully: ${event.eventType} (${eventId})`);

    } catch (error) {
      console.error(`❌ Event processing failed: ${event.eventType} (${eventId})`, error);
      
      // Mark event as failed
      await db.update(eventStore)
        .set({ 
          status: 'failed', 
          failedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        })
        .where(eq(eventStore.id, eventId));
    }
  }

  /**
   * Execute a specific event handler within transaction (ACID compliant)
   */
  static async executeHandlerInTransaction(event: EventStore, handlerName: string, tx: any): Promise<void> {
    // Track handler execution
    const insertHandler: InsertEventHandler = {
      eventId: event.id,
      handlerName,
      status: 'pending',
    };

    const [handlerRecord] = await tx.insert(eventHandlers).values(insertHandler).returning();

    try {
      let result: any = null;

      // Execute the appropriate handler based on event type and handler name
      switch (handlerName) {
        case 'occupancy_calculator':
          result = await this.handleOccupancyCalculationInTransaction(event, tx);
          break;
        case 'notification_sender':
          result = await this.handleNotificationSending(event);
          break;
        case 'audit_logger':
          result = await this.handleAuditLoggingInTransaction(event, tx);
          break;
        default:
          throw new Error(`Unknown handler: ${handlerName}`);
      }

      // Mark handler as processed
      await tx.update(eventHandlers)
        .set({ 
          status: 'processed', 
          processedAt: new Date(),
          result: result || {}
        })
        .where(eq(eventHandlers.id, handlerRecord.id));

    } catch (error) {
      console.error(`Handler ${handlerName} failed for event ${event.id}:`, error);
      
      // Mark handler as failed
      await tx.update(eventHandlers)
        .set({ 
          status: 'failed', 
          failedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        })
        .where(eq(eventHandlers.id, handlerRecord.id));

      throw error; // Re-throw to fail the entire transaction
    }
  }

  /**
   * Execute a specific event handler (legacy method)
   */
  static async executeHandler(event: EventStore, handlerName: string): Promise<void> {
    // Track handler execution
    const insertHandler: InsertEventHandler = {
      eventId: event.id,
      handlerName,
      status: 'pending',
    };

    const [handlerRecord] = await db.insert(eventHandlers).values(insertHandler).returning();

    try {
      let result: any = null;

      // Execute the appropriate handler based on event type and handler name
      switch (handlerName) {
        case 'occupancy_calculator':
          result = await this.handleOccupancyCalculation(event);
          break;
        case 'notification_sender':
          result = await this.handleNotificationSending(event);
          break;
        case 'audit_logger':
          result = await this.handleAuditLogging(event);
          break;
        default:
          throw new Error(`Unknown handler: ${handlerName}`);
      }

      // Mark handler as processed
      await db.update(eventHandlers)
        .set({ 
          status: 'processed', 
          processedAt: new Date(),
          result: result || {}
        })
        .where(eq(eventHandlers.id, handlerRecord.id));

    } catch (error) {
      console.error(`Handler ${handlerName} failed for event ${event.id}:`, error);
      
      // Mark handler as failed
      await db.update(eventHandlers)
        .set({ 
          status: 'failed', 
          failedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        })
        .where(eq(eventHandlers.id, handlerRecord.id));

      throw error; // Re-throw to fail the entire event processing
    }
  }

  /**
   * Handle hotel occupancy calculation events within transaction (ACID compliant)
   */
  static async handleOccupancyCalculationInTransaction(event: EventStore, tx: any): Promise<any> {
    console.log(`🏨 Processing occupancy calculation for event: ${event.eventType} #${event.sequenceNumber}`);

    if (event.eventType === 'hotel_capacity_updated') {
      const eventData = event.eventData as any;
      
      // Ensure balance window exists for the hotel
      await BalanceWindowManager.ensureBalanceWindow(eventData.hotelId, eventData.instanceCode);
      
      console.log(`✅ Balance window ensured for hotel: ${eventData.hotelId}-${eventData.instanceCode}`);
      
      return { message: 'Balance window ensured for hotel' };
    }

    if (event.eventType === 'booking_created' || event.eventType === 'participant_registered') {
      const eventData = event.eventData as BookingCreatedEvent | ParticipantRegisteredEvent;
      
      // Update daily balance using new balance window manager
      await this.updateDailyBalanceForDateRange(
        eventData.hotelId, 
        eventData.instanceCode, 
        new Date(eventData.bookingStartDate),
        new Date(eventData.bookingEndDate),
        event.id,
        Number(event.sequenceNumber),
        tx
      );
      
      return { 
        message: 'Daily balance updated successfully',
        hotelId: eventData.hotelId,
        instanceCode: eventData.instanceCode,
        eventSequence: event.sequenceNumber,
      };
    }

    if (event.eventType === 'participant_deleted') {
      const eventData = event.eventData as any;
      
      // Recalculate balance window for affected hotel
      await this.recalculateHotelBalanceWindow(
        eventData.hotelId, 
        eventData.instanceCode, 
        event.id, 
        Number(event.sequenceNumber)
      );
      
      return { message: 'Hotel balance window recalculated after participant deletion' };
    }

    return { message: 'No occupancy calculation needed for this event type' };
  }

  /**
   * Handle hotel occupancy calculation events (legacy method)
   */
  static async handleOccupancyCalculation(event: EventStore): Promise<any> {
    console.log(`🏨 Processing occupancy calculation for event: ${event.eventType}`);

    if (event.eventType === 'booking_created' || event.eventType === 'participant_registered') {
      const eventData = event.eventData as BookingCreatedEvent | ParticipantRegisteredEvent;
      await this.updateHotelOccupancyBalance(
        eventData.hotelId, 
        eventData.instanceCode, 
        new Date(eventData.bookingStartDate),
        new Date(eventData.bookingEndDate),
        event.id
      );
      
      return { message: 'Occupancy balance updated successfully' };
    }

    if (event.eventType === 'participant_deleted') {
      const eventData = event.eventData as any;
      await this.recalculateHotelOccupancy(eventData.hotelId, eventData.instanceCode, event.id);
      
      return { message: 'Occupancy recalculated after participant deletion' };
    }

    return { message: 'No occupancy calculation needed for this event type' };
  }

  /**
   * Update hotel occupancy balance for date ranges within transaction (ACID compliant)
   */
  static async updateHotelOccupancyBalanceInTransaction(
    hotelId: string, 
    instanceCode: string, 
    startDate: Date, 
    endDate: Date,
    eventId: string,
    eventTimestamp: Date,
    tx: any
  ): Promise<void> {
    // Get hotel info within transaction
    const [hotel] = await tx.select()
      .from(hotels)
      .where(and(
        eq(hotels.hotelId, hotelId),
        eq(hotels.instanceCode, instanceCode)
      ));

    if (!hotel) {
      throw new Error(`Hotel not found: ${hotelId}-${instanceCode}`);
    }

    // Create date range for occupancy updates
    const dates = this.generateDateRange(startDate, endDate);
    
    for (const date of dates) {
      await this.updateSingleDateOccupancyInTransaction(
        hotelId, 
        instanceCode, 
        date, 
        hotel.totalRooms, 
        eventId,
        eventTimestamp,
        tx
      );
    }
  }

  /**
   * Update hotel occupancy balance for date ranges (legacy method)
   */
  static async updateHotelOccupancyBalance(
    hotelId: string, 
    instanceCode: string, 
    startDate: Date, 
    endDate: Date,
    eventId: string
  ): Promise<void> {
    const hotel = await storage.getHotelByHotelIdAndInstance(hotelId, instanceCode);
    if (!hotel) {
      throw new Error(`Hotel not found: ${hotelId}-${instanceCode}`);
    }

    // Create date range for occupancy updates
    const dates = this.generateDateRange(startDate, endDate);
    
    for (const date of dates) {
      await this.updateSingleDateOccupancy(hotelId, instanceCode, date, hotel.totalRooms, eventId);
    }
  }

  /**
   * Update occupancy for a single date within transaction with row-level locking (ACID compliant)
   */
  static async updateSingleDateOccupancyInTransaction(
    hotelId: string, 
    instanceCode: string, 
    date: Date, 
    totalRooms: number,
    eventId: string,
    eventTimestamp: Date,
    tx: any
  ): Promise<void> {
    // RACE CONDITION FIX: Use row-level locking to prevent concurrent updates
    const [existingBalance] = await tx.select()
      .from(hotelOccupancyBalance)
      .where(and(
        eq(hotelOccupancyBalance.hotelId, hotelId),
        eq(hotelOccupancyBalance.instanceCode, instanceCode),
        eq(hotelOccupancyBalance.date, date)
      ))
      .for('update'); // ROW-LEVEL LOCK - prevents concurrent modifications

    // Get current participants for this hotel and date within transaction
    const participants = await tx.select()
      .from(participants)
      .where(and(
        eq(participants.hotelId, hotelId),
        lte(participants.bookingStartDate, date),
        gte(participants.bookingEndDate, date)
      ));
    
    // Calculate occupancy by role
    const playersCount = participants.filter(p => p.role === 'player').length;
    const coachesCount = participants.filter(p => p.role === 'coach').length;
    const officialsCount = participants.filter(p => p.role === 'official').length;

    // Apply business rules: 3 players per room, 2 coaches per room, 1 official per room
    const roomsForPlayers = Math.ceil(playersCount / 3);
    const roomsForCoaches = Math.ceil(coachesCount / 2);
    const roomsForOfficials = officialsCount;
    
    const calculatedOccupiedRooms = roomsForPlayers + roomsForCoaches + roomsForOfficials;
    const availableRooms = Math.max(0, totalRooms - calculatedOccupiedRooms);

    const balanceData = {
      hotelId,
      instanceCode,
      date,
      totalRooms,
      playersCount,
      coachesCount,
      officialsCount,
      calculatedOccupiedRooms,
      availableRooms,
      lastEventId: eventId, // Keep for now, but will be replaced with better design
      updatedAt: new Date(),
    };

    if (existingBalance) {
      // Update existing balance (already locked)
      await tx.update(hotelOccupancyBalance)
        .set(balanceData)
        .where(eq(hotelOccupancyBalance.id, existingBalance.id));
    } else {
      // Create new balance record
      await tx.insert(hotelOccupancyBalance).values({
        ...balanceData,
        createdAt: new Date(),
      } as InsertHotelOccupancyBalance);
    }

    console.log(`📊 Updated occupancy for ${hotelId}-${instanceCode} on ${date.toDateString()}: ${calculatedOccupiedRooms}/${totalRooms} rooms occupied`);
  }

  /**
   * Update occupancy for a single date (legacy method)
   */
  static async updateSingleDateOccupancy(
    hotelId: string, 
    instanceCode: string, 
    date: Date, 
    totalRooms: number,
    eventId: string
  ): Promise<void> {
    // Get current participants for this hotel and date
    const participants = await storage.getParticipantsByHotelAndDate(hotelId, date);
    
    // Calculate occupancy by role
    const playersCount = participants.filter(p => p.role === 'player').length;
    const coachesCount = participants.filter(p => p.role === 'coach').length;
    const officialsCount = participants.filter(p => p.role === 'official').length;

    // Apply business rules: 3 players per room, 2 coaches per room, 1 official per room
    const roomsForPlayers = Math.ceil(playersCount / 3);
    const roomsForCoaches = Math.ceil(coachesCount / 2);
    const roomsForOfficials = officialsCount;
    
    const calculatedOccupiedRooms = roomsForPlayers + roomsForCoaches + roomsForOfficials;
    const availableRooms = Math.max(0, totalRooms - calculatedOccupiedRooms);

    // Check if balance record exists for this date
    const [existingBalance] = await db.select()
      .from(hotelOccupancyBalance)
      .where(and(
        eq(hotelOccupancyBalance.hotelId, hotelId),
        eq(hotelOccupancyBalance.instanceCode, instanceCode),
        eq(hotelOccupancyBalance.date, date)
      ));

    const balanceData = {
      hotelId,
      instanceCode,
      date,
      totalRooms,
      playersCount,
      coachesCount,
      officialsCount,
      calculatedOccupiedRooms,
      availableRooms,
      lastEventId: eventId,
      updatedAt: new Date(),
    };

    if (existingBalance) {
      // Update existing balance
      await db.update(hotelOccupancyBalance)
        .set(balanceData)
        .where(eq(hotelOccupancyBalance.id, existingBalance.id));
    } else {
      // Create new balance record
      await db.insert(hotelOccupancyBalance).values({
        ...balanceData,
        createdAt: new Date(),
      } as InsertHotelOccupancyBalance);
    }

    console.log(`📊 Updated occupancy for ${hotelId}-${instanceCode} on ${date.toDateString()}: ${calculatedOccupiedRooms}/${totalRooms} rooms occupied`);
  }

  /**
   * Update daily balance for a date range using Balance Window Manager
   */
  static async updateDailyBalanceForDateRange(
    hotelId: string, 
    instanceCode: string, 
    startDate: Date,
    endDate: Date,
    eventId: string,
    sequenceNumber: number,
    tx?: any
  ): Promise<void> {
    console.log(`📊 Updating daily balance for ${hotelId}-${instanceCode} (seq: ${sequenceNumber})`);
    console.log(`📅 Date range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
    
    // Ensure balance window exists (auto-expand if needed)
    await BalanceWindowManager.ensureBalanceWindow(hotelId, instanceCode);
    
    // Calculate and update balances for the affected date range
    const dates = BalanceWindowManager.generateDateRange(startDate, endDate);
    
    // Get hotel info for room count
    const [hotel] = await (tx || db).select()
      .from(hotels)
      .where(and(
        eq(hotels.hotelId, hotelId),
        eq(hotels.instanceCode, instanceCode)
      ));
    
    if (!hotel) {
      throw new Error(`Hotel not found: ${hotelId}-${instanceCode}`);
    }
    
    let updated = 0;
    for (const date of dates) {
      const result = await BalanceWindowManager.ensureDailyBalance(
        hotelId, 
        instanceCode, 
        date, 
        hotel.totalRooms
      );
      if (result !== 'exists') updated++;
    }
    
    console.log(`✅ Updated ${updated} daily balance records for ${dates.length} dates`);
  }
  
  /**
   * Recalculate entire balance window for a hotel
   */
  static async recalculateHotelBalanceWindow(
    hotelId: string, 
    instanceCode: string, 
    eventId: string,
    sequenceNumber: number
  ): Promise<void> {
    console.log(`🔄 Recalculating balance window for ${hotelId}-${instanceCode} (seq: ${sequenceNumber})`);
    
    // Force regenerate the entire balance window
    await BalanceWindowManager.ensureBalanceWindow(hotelId, instanceCode);
    
    console.log(`✅ Balance window recalculation complete for ${hotelId}-${instanceCode}`);
  }

  /**
   * Handle notification sending events
   */
  static async handleNotificationSending(event: EventStore): Promise<any> {
    // Implement notification logic based on event type
    console.log(`📱 Processing notification for event: ${event.eventType}`);
    
    // This would integrate with your existing notification service
    return { message: 'Notification sent successfully' };
  }

  /**
   * Handle audit logging events within transaction (ACID compliant)
   */
  static async handleAuditLoggingInTransaction(event: EventStore, tx: any): Promise<any> {
    console.log(`📝 Processing audit log for event: ${event.eventType}`);
    
    // Create audit log entry within transaction
    await tx.insert(auditLog).values({
      userId: event.metadata.userId || 'system',
      actionType: event.eventType,
      targetEntity: event.aggregateType,
      targetId: event.aggregateId,
      details: {
        eventId: event.id,
        eventData: event.eventData,
        metadata: event.metadata
      }
    });

    return { message: 'Audit log created successfully' };
  }

  /**
   * Handle audit logging events (legacy method)
   */
  static async handleAuditLogging(event: EventStore): Promise<any> {
    console.log(`📝 Processing audit log for event: ${event.eventType}`);
    
    // Create audit log entry
    await storage.createAuditLog({
      userId: event.metadata.userId || 'system',
      actionType: event.eventType,
      targetEntity: event.aggregateType,
      targetId: event.aggregateId,
      details: {
        eventId: event.id,
        eventData: event.eventData,
        metadata: event.metadata
      }
    });

    return { message: 'Audit log created successfully' };
  }

  /**
   * Get registered handlers for an event type
   */
  static getEventHandlers(eventType: string): string[] {
    const handlerMap: Record<string, string[]> = {
      'booking_created': ['occupancy_calculator', 'audit_logger'],
      'booking_updated': ['occupancy_calculator', 'audit_logger'],
      'booking_cancelled': ['occupancy_calculator', 'notification_sender', 'audit_logger'],
      'participant_registered': ['occupancy_calculator', 'audit_logger'],
      'participant_updated': ['occupancy_calculator', 'audit_logger'],
      'participant_deleted': ['occupancy_calculator', 'audit_logger'],
      'participant_checked_in': ['notification_sender', 'audit_logger'],
      'participant_checked_out': ['notification_sender', 'audit_logger'],
      'hotel_occupancy_changed': ['notification_sender', 'audit_logger'],
      'hotel_capacity_updated': ['occupancy_calculator', 'audit_logger'],
      'bulk_upload_completed': ['audit_logger'],
    };

    return handlerMap[eventType] || [];
  }

  /**
   * Generate date range between two dates
   */
  static generateDateRange(startDate: Date, endDate: Date): Date[] {
    const dates: Date[] = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      dates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return dates;
  }

  /**
   * Recalculate occupancy for entire hotel
   */
  static async recalculateHotelOccupancy(hotelId: string, instanceCode: string, eventId: string): Promise<void> {
    const hotel = await storage.getHotelByHotelIdAndInstance(hotelId, instanceCode);
    if (!hotel) return;

    // Get all occupancy balance records for this hotel
    const balanceRecords = await db.select()
      .from(hotelOccupancyBalance)
      .where(and(
        eq(hotelOccupancyBalance.hotelId, hotelId),
        eq(hotelOccupancyBalance.instanceCode, instanceCode)
      ));

    // Recalculate each date
    for (const balance of balanceRecords) {
      await this.updateSingleDateOccupancy(hotelId, instanceCode, balance.date, hotel.totalRooms, eventId);
    }
  }

  /**
   * Generate correlation ID for event tracking
   */
  static generateCorrelationId(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get occupancy balance for a specific hotel and date range
   */
  static async getOccupancyBalance(
    hotelId: string, 
    instanceCode: string, 
    startDate?: Date, 
    endDate?: Date
  ): Promise<HotelOccupancyBalance[]> {
    let query = db.select()
      .from(hotelOccupancyBalance)
      .where(and(
        eq(hotelOccupancyBalance.hotelId, hotelId),
        eq(hotelOccupancyBalance.instanceCode, instanceCode)
      ));

    if (startDate && endDate) {
      query = query.where(and(
        eq(hotelOccupancyBalance.hotelId, hotelId),
        eq(hotelOccupancyBalance.instanceCode, instanceCode),
        gte(hotelOccupancyBalance.date, startDate),
        lte(hotelOccupancyBalance.date, endDate)
      )) as any;
    }

    return await query.orderBy(desc(hotelOccupancyBalance.date));
  }

  /**
   * Process pending events (for background job)
   */
  static async processPendingEvents(limit: number = 50): Promise<void> {
    const pendingEvents = await db.select()
      .from(eventStore)
      .where(eq(eventStore.status, 'pending'))
      .orderBy(eventStore.createdAt)
      .limit(limit);

    console.log(`🔄 Processing ${pendingEvents.length} pending events`);

    for (const event of pendingEvents) {
      try {
        await this.processEvent(event.id);
      } catch (error) {
        console.error(`Failed to process event ${event.id}:`, error);
      }
    }
  }

  /**
   * Retry failed events
   */
  static async retryFailedEvents(maxRetries: number = 3, limit: number = 10): Promise<void> {
    const failedEvents = await db.select()
      .from(eventStore)
      .where(and(
        eq(eventStore.status, 'failed'),
        sql`${eventStore.retryCount} < ${maxRetries}`
      ))
      .orderBy(eventStore.failedAt)
      .limit(limit);

    console.log(`🔄 Retrying ${failedEvents.length} failed events`);

    for (const event of failedEvents) {
      try {
        // Increment retry count
        await db.update(eventStore)
          .set({ 
            status: 'retrying',
            retryCount: event.retryCount + 1
          })
          .where(eq(eventStore.id, event.id));

        await this.processEvent(event.id);
      } catch (error) {
        console.error(`Retry failed for event ${event.id}:`, error);
      }
    }
  }
}