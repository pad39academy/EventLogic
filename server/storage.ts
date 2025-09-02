import { 
  users, hotels, participants, reassignments, auditLog, notifications,
  type User, type InsertUser, type Hotel, type InsertHotel, type UpdateHotel,
  type Participant, type InsertParticipant, type Reassignment, 
  type InsertReassignment, type AuditLog, type InsertAuditLog,
  type Notification, type InsertNotification, type UpdateNotification,
  calculateHotelStatus, type HotelWithStatus
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, lt, gt, or, like, ilike, desc, asc, sql, isNotNull } from "drizzle-orm";

export interface IStorage {
  // User management
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByMobile(mobileNumber: string): Promise<User | undefined>;
  getUserByCoachId(coachId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined>;

  // Hotel management
  getHotels(filters?: HotelFilters): Promise<Hotel[]>;
  getHotelById(id: string): Promise<Hotel | undefined>;
  getHotelByHotelIdAndInstance(hotelId: string, instanceCode: string): Promise<Hotel | undefined>;
  getHotelsByHotelId(hotelId: string): Promise<Hotel[]>;
  createHotel(hotel: InsertHotel): Promise<Hotel>;
  updateHotel(id: string, updates: Partial<InsertHotel>): Promise<Hotel | undefined>;
  updateHotelsByHotelId(hotelId: string, updates: Partial<InsertHotel>): Promise<Hotel[]>;
  deleteHotel(id: string): Promise<boolean>;
  getHotelsWithOverlappingDates(hotelId: string, startDate: Date, endDate: Date): Promise<Hotel[]>;
  checkHotelDateConflicts(hotelId: string, excludeInstanceCode: string, startDate: Date, endDate: Date): Promise<Hotel[]>;

  // Participant management
  getParticipants(filters?: ParticipantFilters): Promise<Participant[]>;
  getParticipantById(id: string): Promise<Participant | undefined>;
  getParticipantByParticipantId(participantId: string): Promise<Participant | undefined>;
  getParticipantsByCoachId(coachId: string): Promise<Participant[]>;
  createParticipant(participant: InsertParticipant): Promise<Participant>;
  updateParticipant(id: string, updates: Partial<InsertParticipant>): Promise<Participant | undefined>;
  deleteParticipant(id: string): Promise<boolean>;
  bulkCreateParticipants(participants: InsertParticipant[]): Promise<Participant[]>;

  // Reassignment management
  createReassignment(reassignment: InsertReassignment): Promise<Reassignment>;
  getReassignmentsByParticipant(participantId: string): Promise<Reassignment[]>;

  // Audit logging
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(filters?: AuditFilters): Promise<AuditLog[]>;

  // Notification management
  createNotification(notification: InsertNotification): Promise<Notification>;
  getNotificationsByParticipantId(participantId: string): Promise<Notification[]>;
  getNotificationsByCoachId(coachId: string): Promise<Notification[]>; // Legacy support
  getNotificationById(id: string): Promise<Notification | undefined>;
  updateNotification(id: string, updates: UpdateNotification): Promise<Notification | undefined>;
  markNotificationAsRead(id: string): Promise<Notification | undefined>;
  getUnreadNotificationCountByParticipantId(participantId: string): Promise<number>;
  getUnreadNotificationCount(coachId: string): Promise<number>; // Legacy support
  getAllNotifications(): Promise<Notification[]>;

  // Dashboard statistics
  getDashboardStats(): Promise<DashboardStats>;
}

export interface ParticipantFilters {
  search?: string;
  discipline?: string;
  role?: string;
  checkinStatus?: string;
  hotelId?: string;
  district?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface HotelFilters {
  search?: string;
  district?: string;
  location?: string;
  status?: "upcoming" | "active" | "expired";
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface AuditFilters {
  userId?: string;
  actionType?: string;
  targetEntity?: string;
  fromDate?: Date;
  toDate?: Date;
}

export interface DashboardStats {
  totalParticipants: number;
  totalTeams: number;
  totalPlayers: number;
  checkedInCount: number;
  checkedOutCount: number;
  pendingActions: number;
  totalHotels: number;
  totalAvailableRooms: number;
  totalRooms: number;
  occupiedRooms: number;
  occupancyRate: number;
  estimatedRoomsNeeded: number;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async getUserByMobile(mobileNumber: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.mobileNumber, mobileNumber));
    return user || undefined;
  }

  async getUserByCoachId(coachId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.coachId, coachId));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async getHotels(filters?: HotelFilters): Promise<Hotel[]> {
    let query = db.select().from(hotels);
    const conditions = [];

    if (filters?.search) {
      conditions.push(
        or(
          ilike(hotels.hotelName, `%${filters.search}%`),
          ilike(hotels.hotelId, `%${filters.search}%`),
          ilike(hotels.address, `%${filters.search}%`)
        )
      );
    }

    if (filters?.district) {
      conditions.push(eq(hotels.district, filters.district));
    }

    if (filters?.location) {
      conditions.push(eq(hotels.location, filters.location));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    let hotelResults = await query;

    // Apply sorting in JavaScript for now (to avoid TypeScript complexity)
    const sortBy = filters?.sortBy || 'hotelId';
    const sortOrder = filters?.sortOrder || 'asc';
    
    hotelResults.sort((a, b) => {
      let aVal: any, bVal: any;
      
      switch (sortBy) {
        case 'hotelName':
          aVal = a.hotelName;
          bVal = b.hotelName;
          break;
        case 'location':
          aVal = a.location;
          bVal = b.location;
          break;
        case 'startDate':
          aVal = new Date(a.startDate);
          bVal = new Date(b.startDate);
          break;
        case 'endDate':
          aVal = new Date(a.endDate);
          bVal = b.endDate;
          break;
        case 'totalRooms':
          aVal = a.totalRooms;
          bVal = b.totalRooms;
          break;
        case 'occupiedRooms':
          aVal = a.occupiedRooms;
          bVal = b.occupiedRooms;
          break;
        case 'instanceCode':
          aVal = parseInt(a.instanceCode);
          bVal = parseInt(b.instanceCode);
          break;
        case 'pointOfContact':
          aVal = a.pointOfContact || '';
          bVal = b.pointOfContact || '';
          break;
        case 'contactPhoneNumber':
          aVal = a.contactPhoneNumber || '';
          bVal = b.contactPhoneNumber || '';
          break;
        default:
          aVal = a.hotelId;
          bVal = b.hotelId;
      }
      
      if (typeof aVal === 'string') {
        const result = aVal.localeCompare(bVal);
        return sortOrder === 'desc' ? -result : result;
      } else {
        const result = aVal - bVal;
        return sortOrder === 'desc' ? -result : result;
      }
    });

    // Apply status filtering in JavaScript since it's computed
    if (filters?.status) {
      hotelResults = hotelResults.filter(hotel => {
        const status = calculateHotelStatus(hotel.startDate, hotel.endDate);
        return status === filters.status;
      });
    }

    return hotelResults;
  }

  async getHotelById(id: string): Promise<Hotel | undefined> {
    const [hotel] = await db.select().from(hotels).where(eq(hotels.id, id));
    return hotel || undefined;
  }

  async getHotelByHotelIdAndInstance(hotelId: string, instanceCode: string): Promise<Hotel | undefined> {
    const [hotel] = await db
      .select()
      .from(hotels)
      .where(and(eq(hotels.hotelId, hotelId), eq(hotels.instanceCode, instanceCode)));
    return hotel || undefined;
  }

  async getHotelsByHotelId(hotelId: string): Promise<Hotel[]> {
    return await db.select().from(hotels).where(eq(hotels.hotelId, hotelId));
  }

  async createHotel(insertHotel: InsertHotel): Promise<Hotel> {
    const [hotel] = await db.insert(hotels).values(insertHotel).returning();
    return hotel;
  }

  async updateHotel(id: string, updates: Partial<InsertHotel>): Promise<Hotel | undefined> {
    const [hotel] = await db
      .update(hotels)
      .set(updates)
      .where(eq(hotels.id, id))
      .returning();
    return hotel || undefined;
  }

  async updateHotelsByHotelId(hotelId: string, updates: Partial<InsertHotel>): Promise<Hotel[]> {
    const updatedHotels = await db
      .update(hotels)
      .set(updates)
      .where(eq(hotels.hotelId, hotelId))
      .returning();
    return updatedHotels;
  }

  async deleteHotel(id: string): Promise<boolean> {
    const result = await db.delete(hotels).where(eq(hotels.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getHotelsWithOverlappingDates(hotelId: string, startDate: Date, endDate: Date): Promise<Hotel[]> {
    return await db
      .select()
      .from(hotels)
      .where(
        and(
          eq(hotels.hotelId, hotelId),
          or(
            and(gte(hotels.startDate, startDate), lte(hotels.startDate, endDate)),
            and(gte(hotels.endDate, startDate), lte(hotels.endDate, endDate)),
            and(lte(hotels.startDate, startDate), gte(hotels.endDate, endDate))
          )
        )
      );
  }

  async checkHotelDateConflicts(hotelId: string, excludeInstanceCode: string, startDate: Date, endDate: Date): Promise<Hotel[]> {
    return await db
      .select()
      .from(hotels)
      .where(
        and(
          eq(hotels.hotelId, hotelId),
          sql`${hotels.instanceCode} != ${excludeInstanceCode}`,
          or(
            // Check if ranges overlap: start1 < end2 AND start2 < end1
            and(
              lt(sql`${startDate}`, hotels.endDate),
              lt(hotels.startDate, sql`${endDate}`)
            )
          )
        )
      );
  }

  async getParticipants(filters: ParticipantFilters = {}): Promise<Participant[]> {
    let query = db.select().from(participants);
    const conditions = [];

    if (filters.search) {
      conditions.push(
        or(
          ilike(participants.name, `%${filters.search}%`),
          ilike(participants.participantId, `%${filters.search}%`),
          ilike(participants.mobileNumber, `%${filters.search}%`)
        )
      );
    }

    if (filters.discipline) {
      conditions.push(eq(participants.discipline, filters.discipline));
    }

    if (filters.role) {
      conditions.push(sql`${participants.role} = ${filters.role}`);
    }

    if (filters.checkinStatus) {
      conditions.push(sql`${participants.checkinStatus} = ${filters.checkinStatus}`);
    }

    if (filters.hotelId) {
      conditions.push(eq(participants.hotelId, filters.hotelId));
    }

    if (filters.district) {
      conditions.push(eq(participants.district, filters.district));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    // Sorting
    const sortOrder = filters.sortOrder || 'desc';
    
    if (sortOrder === 'asc') {
      query = query.orderBy(asc(participants.createdAt)) as any;
    } else {
      query = query.orderBy(desc(participants.createdAt)) as any;
    }

    // Pagination
    if (filters.limit) {
      query = query.limit(filters.limit) as any;
      if (filters.page && filters.page > 1) {
        query = query.offset((filters.page - 1) * filters.limit) as any;
      }
    }

    return await query.execute();
  }

  async getParticipantById(id: string): Promise<Participant | undefined> {
    const [participant] = await db.select().from(participants).where(eq(participants.id, id));
    return participant || undefined;
  }

  async getParticipantByParticipantId(participantId: string): Promise<Participant | undefined> {
    const [participant] = await db.select().from(participants).where(eq(participants.participantId, participantId));
    return participant || undefined;
  }

  async getParticipantsByCoachId(coachId: string): Promise<Participant[]> {
    return await db
      .select()
      .from(participants)
      .where(eq(participants.coachId, coachId))
      .orderBy(asc(participants.name));
  }

  async createParticipant(insertParticipant: InsertParticipant): Promise<Participant> {
    const [participant] = await db.insert(participants).values(insertParticipant).returning();
    return participant;
  }

  async updateParticipant(id: string, updates: Partial<InsertParticipant>): Promise<Participant | undefined> {
    const [participant] = await db
      .update(participants)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(participants.id, id))
      .returning();
    return participant || undefined;
  }

  async deleteParticipant(id: string): Promise<boolean> {
    const result = await db.delete(participants).where(eq(participants.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async bulkCreateParticipants(insertParticipants: InsertParticipant[]): Promise<Participant[]> {
    const result = await db.insert(participants).values(insertParticipants).returning();
    // Invalidate cache since new participants affect dashboard stats
    this.invalidateDashboardCache();
    return result;
  }

  async createReassignment(insertReassignment: InsertReassignment): Promise<Reassignment> {
    const [reassignment] = await db.insert(reassignments).values(insertReassignment).returning();
    return reassignment;
  }

  async getReassignmentsByParticipant(participantId: string): Promise<Reassignment[]> {
    return await db
      .select()
      .from(reassignments)
      .where(eq(reassignments.originalParticipantId, participantId))
      .orderBy(desc(reassignments.reassignedAt));
  }

  async createAuditLog(insertAuditLog: InsertAuditLog): Promise<AuditLog> {
    const [log] = await db.insert(auditLog).values(insertAuditLog).returning();
    return log;
  }

  async getAuditLogs(filters: AuditFilters = {}): Promise<any[]> {
    const auditLogs = await db
      .select({
        id: auditLog.id,
        actionType: auditLog.actionType,
        targetEntity: auditLog.targetEntity,
        targetId: auditLog.targetId,
        details: auditLog.details,
        timestamp: auditLog.timestamp,
        userName: users.name,
        userEmail: users.email
      })
      .from(auditLog)
      .leftJoin(users, eq(auditLog.userId, users.id))
      .orderBy(desc(auditLog.timestamp))
      .limit(100);
    
    return auditLogs;
  }

  // Calculate dynamic occupancy for a specific hotel
  async calculateHotelOccupancy(hotelId: string, instanceCode: string): Promise<{ occupiedRooms: number; occupancyRate: number }> {
    // Get hotel details
    const hotel = await this.getHotelByHotelIdAndInstance(hotelId, instanceCode);
    if (!hotel) {
      return { occupiedRooms: 0, occupancyRate: 0 };
    }

    // Count participants assigned to this hotel (regardless of check-in status)
    const assignedParticipants = await db
      .select()
      .from(participants)
      .where(eq(participants.hotelId, hotelId));

    // Calculate rooms needed based on participant roles and sharing rules
    const playerCount = assignedParticipants.filter(p => p.role === 'player').length;
    const coachCount = assignedParticipants.filter(p => p.role === 'coach').length;
    const officialCount = assignedParticipants.filter(p => p.role === 'official').length;
    
    // Room allocation rules: 3 players per room, 2 coaches per room, 1 official per room
    const roomsForPlayers = Math.ceil(playerCount / 3);
    const roomsForCoaches = Math.ceil(coachCount / 2);
    const roomsForOfficials = officialCount;
    
    const occupiedRooms = roomsForPlayers + roomsForCoaches + roomsForOfficials;
    const occupancyRate = hotel.totalRooms > 0 ? (occupiedRooms / hotel.totalRooms) * 100 : 0;

    return { occupiedRooms, occupancyRate: Math.round(occupancyRate) };
  }

  // Update hotel occupancy for a specific hotel
  async updateHotelOccupancy(hotelId: string, instanceCode: string): Promise<void> {
    const { occupiedRooms } = await this.calculateHotelOccupancy(hotelId, instanceCode);
    
    const hotel = await this.getHotelByHotelIdAndInstance(hotelId, instanceCode);
    if (!hotel) return;

    const availableRooms = hotel.totalRooms - occupiedRooms;
    
    await db
      .update(hotels)
      .set({ 
        occupiedRooms,
        availableRooms: Math.max(0, availableRooms)
      })
      .where(and(eq(hotels.hotelId, hotelId), eq(hotels.instanceCode, instanceCode)));
  }

  // Update occupancy for all hotels
  async updateAllHotelOccupancy(): Promise<void> {
    const allHotels = await db.select().from(hotels);
    
    for (const hotel of allHotels) {
      await this.updateHotelOccupancy(hotel.hotelId, hotel.instanceCode);
    }
  }

  // Cache for dashboard stats (5 minutes TTL)
  private dashboardStatsCache: { data: DashboardStats; timestamp: number } | null = null;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  // Invalidate dashboard cache when data changes (kept for backward compatibility)
  invalidateDashboardCache(): void {
    this.dashboardStatsCache = null;
    console.log('🗑️ Dashboard cache invalidated');
  }

  async getDashboardStats(date?: string, forceRefresh = false): Promise<DashboardStats> {
    // Return cached data if available and not expired
    if (!forceRefresh && this.dashboardStatsCache) {
      const isExpired = Date.now() - this.dashboardStatsCache.timestamp > this.CACHE_TTL;
      if (!isExpired) {
        console.log('📊 Dashboard stats served from cache');
        return this.dashboardStatsCache.data;
      }
    }

    console.log('📊 Calculating fresh dashboard stats...');
    // Get total participants
    const totalParticipants = await db.select().from(participants);
    
    // Get checked in count
    const checkedInParticipants = await db
      .select()
      .from(participants)
      .where(sql`${participants.checkinStatus} = 'checked_in'`);

    // Get checked out count
    const checkedOutParticipants = await db
      .select()
      .from(participants)
      .where(sql`${participants.checkinStatus} = 'checked_out'`);

    // Get pending actions (participants with pending status)
    const pendingParticipants = await db
      .select()
      .from(participants)
      .where(sql`${participants.checkinStatus} = 'pending'`);

    // Get team and player counts
    const teams = await db.selectDistinct({ teamName: participants.teamName }).from(participants).where(isNotNull(participants.teamName));
    const players = await db.select().from(participants).where(eq(participants.role, 'player'));

    // Skip expensive hotel occupancy updates for cached requests
    // Only update if cache is expired or forced refresh
    if (forceRefresh || !this.dashboardStatsCache) {
      console.log('🔄 Updating hotel occupancy data...');
      await this.updateAllHotelOccupancy();
    }

    // Get updated hotel statistics
    const allHotels = await db.select().from(hotels);
    const totalAvailableRooms = allHotels.reduce((sum, hotel) => sum + hotel.availableRooms, 0);

    // Calculate estimated rooms needed (1 room per 3 players, 1 per 2 coaches, 1 per official)
    const playerCount = totalParticipants.filter((p: any) => p.role === 'player').length;
    const coachCount = totalParticipants.filter((p: any) => p.role === 'coach').length;
    const officialCount = totalParticipants.filter((p: any) => p.role === 'official').length;
    
    const estimatedRoomsNeeded = Math.ceil(playerCount / 3) + Math.ceil(coachCount / 2) + officialCount;

    const totalRooms = allHotels.reduce((sum, hotel) => sum + hotel.totalRooms, 0);
    const occupiedRooms = allHotels.reduce((sum, hotel) => sum + (hotel.occupiedRooms || 0), 0);
    const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;

    const stats = {
      totalParticipants: totalParticipants.length,
      totalTeams: teams.length,
      totalPlayers: players.length,
      checkedInCount: checkedInParticipants.length,
      checkedOutCount: checkedOutParticipants.length,
      pendingActions: pendingParticipants.length,
      totalHotels: allHotels.length,
      totalAvailableRooms: totalAvailableRooms,
      totalRooms: totalRooms,
      occupiedRooms: occupiedRooms,
      occupancyRate: Math.round(occupancyRate),
      estimatedRoomsNeeded,
    };

    // Cache the results
    this.dashboardStatsCache = {
      data: stats,
      timestamp: Date.now()
    };
    console.log('💾 Dashboard stats cached for 5 minutes');

    return stats;
  }

  // Job execution tracking methods using direct SQL  
  async updateJobExecution(
    jobName: string, 
    durationMs: number, 
    status: 'success' | 'error', 
    errorMessage?: string
  ): Promise<void> {
    await db.execute(
      sql`INSERT INTO dashboard_jobs (job_name, last_execution, execution_duration_ms, status, error_message, updated_at)
          VALUES (${jobName}, NOW(), ${durationMs}, ${status}, ${errorMessage || null}, NOW())
          ON CONFLICT (job_name) 
          DO UPDATE SET 
            last_execution = NOW(),
            execution_duration_ms = ${durationMs},
            status = ${status},
            error_message = ${errorMessage || null},
            updated_at = NOW()`
    );
  }

  async getJobExecution(jobName: string): Promise<any> {
    const result = await db.execute(
      sql`SELECT * FROM dashboard_jobs WHERE job_name = ${jobName}`
    );
    return result.rows[0] || null;
  }

  // Fast dashboard stats using pre-aggregated views
  async getDashboardStatsFromViews(): Promise<DashboardStats & { lastUpdated: Date }> {
    const result = await db.execute(
      sql`SELECT 
        ds.*,
        hs.*,
        dj.last_execution as last_updated
      FROM dashboard_stats_view ds
      CROSS JOIN hotel_stats_view hs
      CROSS JOIN dashboard_jobs dj 
      WHERE dj.job_name = 'dashboard_stats_aggregation'`
    );
    
    const row = result.rows[0] as any;
    
    return {
      totalParticipants: parseInt(row.total_participants),
      totalTeams: parseInt(row.total_teams),
      totalPlayers: parseInt(row.total_players),
      checkedInCount: parseInt(row.checked_in_count),
      checkedOutCount: parseInt(row.checked_out_count),
      pendingActions: parseInt(row.pending_actions),
      totalHotels: parseInt(row.total_hotels),
      totalAvailableRooms: parseInt(row.available_rooms),
      totalRooms: parseInt(row.total_rooms),
      occupiedRooms: parseInt(row.occupied_rooms),
      occupancyRate: parseInt(row.occupancy_rate),
      estimatedRoomsNeeded: parseInt(row.estimated_rooms_needed),
      lastUpdated: new Date(row.last_updated)
    };
  }

  // Notification methods
  async createNotification(insertNotification: InsertNotification): Promise<Notification> {
    const [notification] = await db.insert(notifications).values(insertNotification).returning();
    return notification;
  }

  async getNotificationsByParticipantId(participantId: string): Promise<Notification[]> {
    return await db
      .select()
      .from(notifications)
      .where(eq(notifications.toParticipantId, participantId))
      .orderBy(desc(notifications.sentAt));
  }

  async getNotificationsByCoachId(coachId: string): Promise<Notification[]> {
    // Legacy method - delegates to new method
    return this.getNotificationsByParticipantId(coachId);
  }

  async getNotificationById(id: string): Promise<Notification | undefined> {
    const [notification] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, id));
    return notification || undefined;
  }

  async updateNotification(id: string, updates: UpdateNotification): Promise<Notification | undefined> {
    const [notification] = await db
      .update(notifications)
      .set(updates)
      .where(eq(notifications.id, id))
      .returning();
    return notification || undefined;
  }

  async markNotificationAsRead(id: string): Promise<Notification | undefined> {
    return this.updateNotification(id, {
      status: "read",
      readAt: new Date(),
    });
  }

  async getUnreadNotificationCountByParticipantId(participantId: string): Promise<number> {
    const unreadNotifications = await db
      .select()
      .from(notifications)
      .where(and(
        eq(notifications.toParticipantId, participantId),
        eq(notifications.status, "unread")
      ));
    return unreadNotifications.length;
  }

  async getUnreadNotificationCount(coachId: string): Promise<number> {
    // Legacy method - delegates to new method
    return this.getUnreadNotificationCountByParticipantId(coachId);
  }

  async getAllNotifications(): Promise<Notification[]> {
    return await db
      .select()
      .from(notifications)
      .orderBy(desc(notifications.sentAt));
  }
}

export const storage = new DatabaseStorage();
