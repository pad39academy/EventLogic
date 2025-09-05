import { db } from '../db';
import { 
  hotelDailyBalance, 
  hotels, 
  participants,
  type InsertHotelDailyBalance 
} from '@shared/schema';
import { eq, and, sql, lte, gte, lt } from 'drizzle-orm';

/**
 * Balance Window Manager - Maintains balance data only for actual hotel operation dates
 * Uses hotel's actual start_date to end_date for efficient, targeted balance tracking
 */
export class BalanceWindowManager {
  
  /**
   * Ensures balance data only for hotel's actual operating date range
   * Uses hotel.start_date to hotel.end_date for efficient database utilization
   */
  static async ensureBalanceWindow(hotelId: string, instanceCode: string): Promise<void> {
    // Get hotel info with actual operating dates
    const [hotel] = await db.select()
      .from(hotels)
      .where(and(
        eq(hotels.hotelId, hotelId),
        eq(hotels.instanceCode, instanceCode)
      ));
    
    if (!hotel) {
      throw new Error(`Hotel not found: ${hotelId}-${instanceCode}`);
    }
    
    const startDate = new Date(hotel.startDate);
    const endDate = new Date(hotel.endDate);
    
    console.log(`🏨 Ensuring balance window for ${hotelId}-${instanceCode}`);
    console.log(`📅 Hotel operating range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
    
    // Generate only dates hotel is actually operating
    const dates = this.generateDateRange(startDate, endDate);
    
    let created = 0;
    let updated = 0;
    
    for (const date of dates) {
      const result = await this.ensureDailyBalance(hotelId, instanceCode, date, hotel.totalRooms);
      if (result === 'created') created++;
      if (result === 'updated') updated++;
    }
    
    console.log(`✅ Balance window ensured: ${created} created, ${updated} updated for ${dates.length} operating days`);
  }
  
  /**
   * Ensures a single day's balance exists and is calculated
   */
  static async ensureDailyBalance(
    hotelId: string, 
    instanceCode: string, 
    date: Date,
    totalRooms: number
  ): Promise<'created' | 'updated' | 'exists'> {
    
    // Check if balance already exists for this date
    const [existingBalance] = await db.select()
      .from(hotelDailyBalance)
      .where(and(
        eq(hotelDailyBalance.hotelId, hotelId),
        eq(hotelDailyBalance.instanceCode, instanceCode),
        eq(hotelDailyBalance.balanceDate, date.toISOString().split('T')[0])
      ));
    
    // Calculate current occupancy for this date
    const balance = await this.calculateDailyBalance(hotelId, instanceCode, date, totalRooms);
    
    if (existingBalance) {
      // Update existing balance if data has changed
      const hasChanged = (
        existingBalance.playersCount !== balance.playersCount ||
        existingBalance.coachesCount !== balance.coachesCount ||
        existingBalance.officialsCount !== balance.officialsCount ||
        existingBalance.pendingCheckoutPlayers !== balance.pendingCheckoutPlayers
      );
      
      if (hasChanged) {
        await db.update(hotelDailyBalance)
          .set({
            ...balance,
            calculatedAt: new Date(),
          })
          .where(eq(hotelDailyBalance.id, existingBalance.id));
        
        return 'updated';
      }
      
      return 'exists';
    } else {
      // Create new balance record
      await db.insert(hotelDailyBalance).values({
        hotelId,
        instanceCode,
        balanceDate: date.toISOString().split('T')[0],
        totalRooms,
        ...balance,
      } as InsertHotelDailyBalance);
      
      return 'created';
    }
  }
  
  /**
   * Calculate daily balance for a specific hotel and date
   * Uses precise room consumption: 1 room (official), 0.5 room (coach), 1/3 room (player)
   */
  static async calculateDailyBalance(
    hotelId: string, 
    instanceCode: string, 
    date: Date,
    totalRooms: number
  ): Promise<{
    playersCount: number;
    coachesCount: number;
    officialsCount: number;
    calculatedOccupiedRooms: number;
    availableRooms: number;
    occupancyPercentage: string;
    pendingCheckoutPlayers: number;
    pendingCheckoutCoaches: number;
    pendingCheckoutOfficials: number;
    pendingCheckoutRooms: number;
  }> {
    
    // Get all participants for this hotel on this date
    const allParticipants = await db.select()
      .from(participants)
      .where(and(
        eq(participants.hotelId, hotelId),
        lte(participants.bookingStartDate, date),
        gte(participants.bookingEndDate, date)
      ));
    
    // Calculate total occupancy by role
    const playersCount = allParticipants.filter(p => p.role === 'player').length;
    const coachesCount = allParticipants.filter(p => p.role === 'coach').length;
    const officialsCount = allParticipants.filter(p => p.role === 'official').length;
    
    // Calculate pending checkout (checked in but not checked out)
    const pendingCheckoutParticipants = allParticipants.filter(p => p.checkinStatus === 'checked_in');
    const pendingCheckoutPlayers = pendingCheckoutParticipants.filter(p => p.role === 'player').length;
    const pendingCheckoutCoaches = pendingCheckoutParticipants.filter(p => p.role === 'coach').length;
    const pendingCheckoutOfficials = pendingCheckoutParticipants.filter(p => p.role === 'official').length;
    
    // NEW LOGIC: Precise room consumption based on participant roles
    // Official: 1 full room, Coach: 0.5 room, Player: 1/3 room
    const roomsConsumedByPlayers = playersCount * (1/3);     // 1/3 room per player
    const roomsConsumedByCoaches = coachesCount * 0.5;       // 0.5 room per coach
    const roomsConsumedByOfficials = officialsCount * 1;     // 1 full room per official
    
    const totalRoomsConsumed = roomsConsumedByPlayers + roomsConsumedByCoaches + roomsConsumedByOfficials;
    const calculatedOccupiedRooms = Math.ceil(totalRoomsConsumed); // Round up for room allocation
    const availableRooms = Math.max(0, totalRooms - calculatedOccupiedRooms);
    
    // Calculate pending checkout rooms using same logic
    const pendingPlayersRooms = pendingCheckoutPlayers * (1/3);
    const pendingCoachesRooms = pendingCheckoutCoaches * 0.5;
    const pendingOfficialsRooms = pendingCheckoutOfficials * 1;
    const pendingCheckoutRooms = Math.ceil(pendingPlayersRooms + pendingCoachesRooms + pendingOfficialsRooms);
    
    const occupancyPercentage = totalRooms > 0 
      ? ((calculatedOccupiedRooms / totalRooms) * 100).toFixed(2)
      : "0.00";
    
    return {
      playersCount,
      coachesCount,
      officialsCount,
      calculatedOccupiedRooms,
      availableRooms,
      occupancyPercentage,
      pendingCheckoutPlayers,
      pendingCheckoutCoaches,
      pendingCheckoutOfficials,
      pendingCheckoutRooms,
    };
  }
  
  /**
   * Auto-cleanup: Remove balances outside hotel operating ranges
   */
  static async cleanupExpiredBalances(): Promise<any> {
    // Remove balance records that are outside any hotel's operating range
    const result = await db.delete(hotelDailyBalance)
      .where(sql`
        NOT EXISTS (
          SELECT 1 FROM hotels h 
          WHERE h.hotel_id = ${hotelDailyBalance.hotelId} 
          AND h.instance_code = ${hotelDailyBalance.instanceCode}
          AND ${hotelDailyBalance.balanceDate} BETWEEN h.start_date AND h.end_date
        )
      `);
    
    console.log(`🧹 Cleaned up balance records outside hotel operating ranges`);
    return result;
  }
  
  /**
   * Initialize balance windows for all hotels
   */
  static async initializeAllHotelBalances(): Promise<void> {
    console.log(`🚀 Initializing balance windows for all hotels...`);
    
    // Get all unique hotel-instance combinations
    const allHotels = await db.select({
      hotelId: hotels.hotelId,
      instanceCode: hotels.instanceCode,
    })
    .from(hotels)
    .groupBy(hotels.hotelId, hotels.instanceCode);
    
    let processed = 0;
    for (const hotel of allHotels) {
      try {
        await this.ensureBalanceWindow(hotel.hotelId, hotel.instanceCode);
        processed++;
        console.log(`✅ Processed ${processed}/${allHotels.length}: ${hotel.hotelId}-${hotel.instanceCode}`);
      } catch (error) {
        console.error(`❌ Failed to process ${hotel.hotelId}-${hotel.instanceCode}:`, error);
      }
    }
    
    console.log(`🎉 Balance window initialization complete: ${processed}/${allHotels.length} hotels processed`);
  }
  
  /**
   * Get balance data for a specific hotel and date range
   */
  static async getBalanceData(
    hotelId: string,
    instanceCode: string,
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    return await db.select()
      .from(hotelDailyBalance)
      .where(and(
        eq(hotelDailyBalance.hotelId, hotelId),
        eq(hotelDailyBalance.instanceCode, instanceCode),
        gte(hotelDailyBalance.balanceDate, startDate.toISOString().split('T')[0]),
        lte(hotelDailyBalance.balanceDate, endDate.toISOString().split('T')[0])
      ))
      .orderBy(hotelDailyBalance.balanceDate);
  }
  
  /**
   * Validate if sufficient room capacity exists for participant booking
   * Returns validation result with detailed information
   */
  static async validateBalanceAvailability(
    hotelId: string,
    instanceCode: string,
    participantRole: 'player' | 'coach' | 'official',
    startDate: Date,
    endDate: Date
  ): Promise<{
    isValid: boolean;
    availableRooms: number;
    requiredRooms: number;
    conflictDates: string[];
    message: string;
  }> {
    
    // Calculate room consumption for this participant type
    const roomConsumption = participantRole === 'official' ? 1 : 
                           participantRole === 'coach' ? 0.5 : 1/3; // player
    
    const dates = this.generateDateRange(startDate, endDate);
    const conflictDates: string[] = [];
    let minAvailableRooms = Infinity;
    
    // Check balance availability for each date in the range
    for (const date of dates) {
      const [balance] = await db.select()
        .from(hotelDailyBalance)
        .where(and(
          eq(hotelDailyBalance.hotelId, hotelId),
          eq(hotelDailyBalance.instanceCode, instanceCode),
          eq(hotelDailyBalance.balanceDate, date.toISOString().split('T')[0])
        ));
      
      if (!balance) {
        // No balance record means hotel doesn't operate on this date
        conflictDates.push(date.toISOString().split('T')[0]);
        continue;
      }
      
      // Check if sufficient rooms available
      const availableCapacity = balance.availableRooms || 0;
      minAvailableRooms = Math.min(minAvailableRooms, availableCapacity);
      
      if (availableCapacity < Math.ceil(roomConsumption)) {
        conflictDates.push(date.toISOString().split('T')[0]);
      }
    }
    
    const isValid = conflictDates.length === 0;
    const message = isValid 
      ? `✅ Sufficient capacity available for ${participantRole}`
      : `❌ Insufficient capacity on dates: ${conflictDates.join(', ')}`;
    
    return {
      isValid,
      availableRooms: minAvailableRooms === Infinity ? 0 : minAvailableRooms,
      requiredRooms: Math.ceil(roomConsumption),
      conflictDates,
      message,
    };
  }

  /**
   * Generate array of dates between start and end (inclusive)
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
}