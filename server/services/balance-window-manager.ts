import { db } from '../db';
import { 
  hotelDailyBalance, 
  hotels, 
  participants,
  type InsertHotelDailyBalance 
} from '@shared/schema';
import { eq, and, sql, lte, gte, lt } from 'drizzle-orm';

/**
 * Balance Window Manager - Maintains 30+100 day rolling window for hotel occupancy
 * Phase 1: 30 days past + 100 days future = 130 days total
 * Phase 2: 100 days past + 100 days future = 200 days total
 */
export class BalanceWindowManager {
  
  /**
   * Ensures exactly 130 days of balance data per hotel (Phase 1)
   * Past 30 days + Today + Future 99 days = 130 days total
   */
  static async ensureBalanceWindow(hotelId: string, instanceCode: string): Promise<void> {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 30); // 30 days back
    
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + 99);   // 99 days forward
    
    console.log(`🏨 Ensuring 130-day balance window for ${hotelId}-${instanceCode}`);
    console.log(`📅 Date range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
    
    // Get hotel info
    const [hotel] = await db.select()
      .from(hotels)
      .where(and(
        eq(hotels.hotelId, hotelId),
        eq(hotels.instanceCode, instanceCode)
      ));
    
    if (!hotel) {
      throw new Error(`Hotel not found: ${hotelId}-${instanceCode}`);
    }
    
    // Generate 130-day window
    const dates = this.generateDateRange(startDate, endDate);
    
    let created = 0;
    let updated = 0;
    
    for (const date of dates) {
      const result = await this.ensureDailyBalance(hotelId, instanceCode, date, hotel.totalRooms);
      if (result === 'created') created++;
      if (result === 'updated') updated++;
    }
    
    console.log(`✅ Balance window ensured: ${created} created, ${updated} updated`);
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
    
    // Apply business rules: 3 players per room, 2 coaches per room, 1 official per room
    const roomsForPlayers = Math.ceil(playersCount / 3);
    const roomsForCoaches = Math.ceil(coachesCount / 2);
    const roomsForOfficials = officialsCount;
    
    const calculatedOccupiedRooms = roomsForPlayers + roomsForCoaches + roomsForOfficials;
    const availableRooms = Math.max(0, totalRooms - calculatedOccupiedRooms);
    
    // Calculate pending checkout rooms
    const pendingCheckoutPlayersRooms = Math.ceil(pendingCheckoutPlayers / 3);
    const pendingCheckoutCoachesRooms = Math.ceil(pendingCheckoutCoaches / 2);
    const pendingCheckoutOfficialsRooms = pendingCheckoutOfficials;
    const pendingCheckoutRooms = pendingCheckoutPlayersRooms + pendingCheckoutCoachesRooms + pendingCheckoutOfficialsRooms;
    
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
   * Auto-cleanup: Remove balances older than the window (Phase 1: 30 days)
   */
  static async cleanupExpiredBalances(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30); // Phase 1: Keep 30 days back
    
    const result = await db.delete(hotelDailyBalance)
      .where(lt(hotelDailyBalance.balanceDate, cutoffDate.toISOString().split('T')[0]));
    
    console.log(`🧹 Cleaned up balance records older than ${cutoffDate.toISOString().split('T')[0]}`);
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