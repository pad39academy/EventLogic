import { 
  users, hotels, participants, reassignments, notifications,
  eventStore, eventHandlers, hotelOccupancyBalance, hotelDailyBalance,
  type User, type InsertUser, type Hotel, type InsertHotel, type UpdateHotel,
  type Participant, type InsertParticipant, type Reassignment, 
  type InsertReassignment,
  type Notification, type InsertNotification, type UpdateNotification,
  type EventStore, type InsertEventStore, type HotelOccupancyBalance,
  calculateHotelStatus, type HotelWithStatus
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, lt, gt, or, like, ilike, desc, asc, sql, isNotNull } from "drizzle-orm";
import { BalanceWindowManager } from './services/balance-window-manager';

export interface IStorage {
  // User management
  getUser(id: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
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
  getAvailableHotels(): Promise<(Hotel & { availableRooms: number })[]>;
  getAvailableHotelsForDates(startDate: Date, endDate: Date, excludeParticipantId?: string): Promise<(Hotel & { availableRooms: number; suggestedDates?: { start: Date; end: Date } })[]>;
  getHotelsWithTodayOccupancyPaginated(filters: HotelFilters & { page: number; limit: number }): Promise<{ data: any[]; pagination: { page: number; totalPages: number; total: number; hasNext: boolean; hasPrev: boolean } }>;

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

  // Audit logging - REMOVED: functionality consolidated into event_store table

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

  // Event-driven architecture methods
  getParticipantsByHotelAndDate(hotelId: string, date: Date): Promise<Participant[]>;
  createEvent(event: InsertEventStore): Promise<EventStore>;
  getEventsByAggregateId(aggregateId: string): Promise<EventStore[]>;
  getHotelOccupancyBalanceByDate(hotelId: string, instanceCode: string, startDate: Date, endDate: Date): Promise<HotelOccupancyBalance[]>;
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

  async getUsers(): Promise<User[]> {
    return await db.select().from(users);
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

  // ⚡ OPTIMIZED: Get hotels with today's occupancy from pre-calculated balance
  async getHotelsWithTodayOccupancy(filters?: HotelFilters): Promise<Hotel[]> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    let query = db
      .select({
        // All hotel fields
        id: hotels.id,
        hotelId: hotels.hotelId,
        instanceCode: hotels.instanceCode,
        hotelName: hotels.hotelName,
        address: hotels.address,
        location: hotels.location,
        pincode: hotels.pincode,
        district: hotels.district,
        totalRooms: hotels.totalRooms,
        pointOfContact: hotels.pointOfContact,
        contactPhoneNumber: hotels.contactPhoneNumber,
        startDate: hotels.startDate,
        endDate: hotels.endDate,
        createdAt: hotels.createdAt,
        
        // ⚡ FAST: Pre-calculated occupancy from balance table
        occupiedRooms: hotelDailyBalance.calculatedOccupiedRooms,
        availableRooms: hotelDailyBalance.availableRooms,
        occupancyPercentage: hotelDailyBalance.occupancyPercentage,
      })
      .from(hotels)
      .leftJoin(
        hotelDailyBalance,
        and(
          eq(hotels.hotelId, hotelDailyBalance.hotelId),
          eq(hotels.instanceCode, hotelDailyBalance.instanceCode),
          eq(hotelDailyBalance.balanceDate, today)
        )
      );

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

    // Convert occupancyPercentage to string and ensure defaults  
    hotelResults = hotelResults.map(hotel => ({
      ...hotel,
      occupiedRooms: hotel.occupiedRooms ?? 0,
      availableRooms: hotel.availableRooms ?? (hotel.totalRooms - (hotel.occupiedRooms ?? 0)),
      occupancyPercentage: hotel.occupancyPercentage ? hotel.occupancyPercentage.toString() : "0.00",
    }));

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

  async getHotelsWithTodayOccupancyPaginated(filters: HotelFilters & { page: number; limit: number }): Promise<{ data: any[]; pagination: { page: number; totalPages: number; total: number; hasNext: boolean; hasPrev: boolean } }> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    let query = db
      .select({
        // All hotel fields
        id: hotels.id,
        hotelId: hotels.hotelId,
        instanceCode: hotels.instanceCode,
        hotelName: hotels.hotelName,
        address: hotels.address,
        location: hotels.location,
        pincode: hotels.pincode,
        district: hotels.district,
        totalRooms: hotels.totalRooms,
        pointOfContact: hotels.pointOfContact,
        contactPhoneNumber: hotels.contactPhoneNumber,
        startDate: hotels.startDate,
        endDate: hotels.endDate,
        createdAt: hotels.createdAt,
        
        // ⚡ FAST: Pre-calculated occupancy from balance table
        occupiedRooms: hotelDailyBalance.calculatedOccupiedRooms,
        availableRooms: hotelDailyBalance.availableRooms,
        occupancyPercentage: hotelDailyBalance.occupancyPercentage,
      })
      .from(hotels)
      .leftJoin(
        hotelDailyBalance,
        and(
          eq(hotels.hotelId, hotelDailyBalance.hotelId),
          eq(hotels.instanceCode, hotelDailyBalance.instanceCode),
          eq(hotelDailyBalance.balanceDate, today)
        )
      );

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

    // Convert occupancyPercentage to string and ensure defaults  
    hotelResults = hotelResults.map(hotel => ({
      ...hotel,
      occupiedRooms: hotel.occupiedRooms ?? 0,
      availableRooms: hotel.availableRooms ?? (hotel.totalRooms - (hotel.occupiedRooms ?? 0)),
      occupancyPercentage: hotel.occupancyPercentage ? hotel.occupancyPercentage.toString() : "0.00",
    }));

    // Apply sorting in JavaScript
    const sortBy = filters?.sortBy || 'hotelId';
    const sortOrder = filters?.sortOrder || 'asc';

    hotelResults.sort((a, b) => {
      let aVal = a[sortBy as keyof typeof a];
      let bVal = b[sortBy as keyof typeof b];

      // Handle date fields specially
      if (sortBy === 'startDate' || sortBy === 'endDate') {
        aVal = new Date(aVal as string).getTime();
        bVal = new Date(bVal as string).getTime();
      }

      // Handle numeric fields
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }

      // Handle string fields
      const aStr = String(aVal || '').toLowerCase();
      const bStr = String(bVal || '').toLowerCase();
      
      if (sortOrder === 'asc') {
        return aStr.localeCompare(bStr);
      } else {
        return bStr.localeCompare(aStr);
      }
    });

    // Apply status filter after getting data (since status is computed)
    if (filters?.status) {
      hotelResults = hotelResults.filter(hotel => {
        const status = calculateHotelStatus(hotel.startDate, hotel.endDate);
        return status === filters.status;
      });
    }

    // Calculate total after status filtering
    const total = hotelResults.length;

    // Apply pagination
    const offset = (filters.page - 1) * filters.limit;
    const paginatedResults = hotelResults.slice(offset, offset + filters.limit);

    // Calculate pagination info
    const totalPages = Math.ceil(total / filters.limit);
    const hasNext = filters.page < totalPages;
    const hasPrev = filters.page > 1;

    return {
      data: paginatedResults,
      pagination: {
        page: filters.page,
        totalPages,
        total,
        hasNext,
        hasPrev
      }
    };
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
    
    // Ensure balance window is created for the new hotel
    await BalanceWindowManager.ensureBalanceWindow(hotel.hotelId, hotel.instanceCode);
    
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
    let query = db.selectDistinct({
      id: participants.id,
      participantId: participants.participantId,
      name: participants.name,
      mobileNumber: participants.mobileNumber,
      role: participants.role,
      discipline: participants.discipline,
      district: participants.district,
      location: participants.location,
      teamName: participants.teamName,
      coachId: participants.coachId,
      hotelId: participants.hotelId,
      hotelName: hotels.hotelName,
      stadium: participants.stadium,
      bookingStartDate: participants.bookingStartDate,
      bookingEndDate: participants.bookingEndDate,
      bookingReference: participants.bookingReference,
      bookingType: participants.bookingType,
      notifyTransport: participants.notifyTransport,
      travelPocName: participants.travelPocName,
      travelPocMobile: participants.travelPocMobile,
      venuePocName: participants.venuePocName,
      venuePocMobile: participants.venuePocMobile,
      checkinStatus: participants.checkinStatus,
      checkinTime: participants.checkinTime,
      checkoutTime: participants.checkoutTime,
      actualCheckoutDate: participants.actualCheckoutDate,
      createdAt: participants.createdAt,
      updatedAt: participants.updatedAt
    }).from(participants)
    .leftJoin(hotels, eq(participants.hotelId, hotels.hotelId));
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
    const result = await db.selectDistinct({
      id: participants.id,
      participantId: participants.participantId,
      name: participants.name,
      mobileNumber: participants.mobileNumber,
      role: participants.role,
      discipline: participants.discipline,
      district: participants.district,
      location: participants.location,
      teamName: participants.teamName,
      coachId: participants.coachId,
      hotelId: participants.hotelId,
      hotelName: hotels.hotelName,
      stadium: participants.stadium,
      bookingStartDate: participants.bookingStartDate,
      bookingEndDate: participants.bookingEndDate,
      bookingReference: participants.bookingReference,
      bookingType: participants.bookingType,
      notifyTransport: participants.notifyTransport,
      travelPocName: participants.travelPocName,
      travelPocMobile: participants.travelPocMobile,
      venuePocName: participants.venuePocName,
      venuePocMobile: participants.venuePocMobile,
      checkinStatus: participants.checkinStatus,
      checkinTime: participants.checkinTime,
      checkoutTime: participants.checkoutTime,
      actualCheckoutDate: participants.actualCheckoutDate,
      createdAt: participants.createdAt,
      updatedAt: participants.updatedAt
    }).from(participants)
    .leftJoin(hotels, eq(participants.hotelId, hotels.hotelId))
    .where(eq(participants.id, id));
    return result[0] || undefined;
  }

  async getParticipantByParticipantId(participantId: string): Promise<Participant | undefined> {
    const result = await db.selectDistinct({
      id: participants.id,
      participantId: participants.participantId,
      name: participants.name,
      mobileNumber: participants.mobileNumber,
      role: participants.role,
      discipline: participants.discipline,
      district: participants.district,
      location: participants.location,
      teamName: participants.teamName,
      coachId: participants.coachId,
      hotelId: participants.hotelId,
      hotelName: hotels.hotelName,
      stadium: participants.stadium,
      bookingStartDate: participants.bookingStartDate,
      bookingEndDate: participants.bookingEndDate,
      bookingReference: participants.bookingReference,
      bookingType: participants.bookingType,
      notifyTransport: participants.notifyTransport,
      travelPocName: participants.travelPocName,
      travelPocMobile: participants.travelPocMobile,
      venuePocName: participants.venuePocName,
      venuePocMobile: participants.venuePocMobile,
      checkinStatus: participants.checkinStatus,
      checkinTime: participants.checkinTime,
      checkoutTime: participants.checkoutTime,
      actualCheckoutDate: participants.actualCheckoutDate,
      createdAt: participants.createdAt,
      updatedAt: participants.updatedAt
    }).from(participants)
    .leftJoin(hotels, eq(participants.hotelId, hotels.hotelId))
    .where(eq(participants.participantId, participantId));
    return result[0] || undefined;
  }

  async getParticipantsByCoachId(coachId: string): Promise<Participant[]> {
    return await db
      .selectDistinct({
        id: participants.id,
        participantId: participants.participantId,
        name: participants.name,
        mobileNumber: participants.mobileNumber,
        role: participants.role,
        discipline: participants.discipline,
        district: participants.district,
        location: participants.location,
        teamName: participants.teamName,
        coachId: participants.coachId,
        hotelId: participants.hotelId,
        hotelName: hotels.hotelName,
        stadium: participants.stadium,
        bookingStartDate: participants.bookingStartDate,
        bookingEndDate: participants.bookingEndDate,
        bookingReference: participants.bookingReference,
        bookingType: participants.bookingType,
        notifyTransport: participants.notifyTransport,
        travelPocName: participants.travelPocName,
        travelPocMobile: participants.travelPocMobile,
        venuePocName: participants.venuePocName,
        venuePocMobile: participants.venuePocMobile,
        checkinStatus: participants.checkinStatus,
        checkinTime: participants.checkinTime,
        checkoutTime: participants.checkoutTime,
        actualCheckoutDate: participants.actualCheckoutDate,
        createdAt: participants.createdAt,
        updatedAt: participants.updatedAt
      })
      .from(participants)
      .leftJoin(hotels, eq(participants.hotelId, hotels.hotelId))
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

  // Audit logging methods removed - functionality consolidated into event_store table
  // Use EventService.getAuditTrail() to query audit information from event_store

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

  /**
   * OPTIMIZED: Fast dashboard stats using pre-calculated balance data
   * Replaces 160+ second manual calculations with sub-second queries
   */
  async getDashboardStatsOptimized(date?: string, forceRefresh = false): Promise<DashboardStats> {
    // Return cached data if available and not expired
    if (!forceRefresh && this.dashboardStatsCache) {
      const isExpired = Date.now() - this.dashboardStatsCache.timestamp > this.CACHE_TTL;
      if (!isExpired) {
        console.log('⚡ Dashboard stats served from cache (OPTIMIZED)');
        return this.dashboardStatsCache.data;
      }
    }

    console.log('⚡ OPTIMIZED: Fast dashboard stats calculation...');
    const startTime = Date.now();

    // FAST: Single aggregated query for participant stats
    const [participantStats] = await db
      .select({
        totalParticipants: sql<number>`count(*)`,
        totalPlayers: sql<number>`count(*) filter (where role = 'player')`,
        totalCoaches: sql<number>`count(*) filter (where role = 'coach')`, 
        totalOfficials: sql<number>`count(*) filter (where role = 'official')`,
        checkedInCount: sql<number>`count(*) filter (where checkin_status = 'checked_in')`,
        checkedOutCount: sql<number>`count(*) filter (where checkin_status = 'checked_out')`,
        pendingActions: sql<number>`count(*) filter (where checkin_status = 'pending')`,
        totalTeams: sql<number>`count(distinct team_name) filter (where team_name is not null)`
      })
      .from(participants);

    // FAST: Single aggregated query for hotel stats  
    const [hotelStats] = await db
      .select({
        totalHotels: sql<number>`count(*)`,
        totalRooms: sql<number>`sum(total_rooms)`,
        totalAvailableRooms: sql<number>`sum(available_rooms)`
      })
      .from(hotels);

    // FAST: Use pre-calculated balance data for occupancy (instead of manual calculations)
    const today = new Date().toISOString().split('T')[0];
    const [occupancyStats] = await db
      .select({
        occupiedRooms: sql<number>`sum(calculated_occupied_rooms)`,
        avgOccupancyRate: sql<number>`avg(cast(occupancy_percentage as numeric))`,
        lastMaterialized: sql<Date>`max(calculated_at)`
      })
      .from(hotelDailyBalance)
      .where(eq(hotelDailyBalance.balanceDate, today));

    // Calculate estimated rooms needed (same logic, but from aggregated data)
    const estimatedRoomsNeeded = Math.ceil(participantStats.totalPlayers / 3) + 
                                Math.ceil(participantStats.totalCoaches / 2) + 
                                participantStats.totalOfficials;

    const stats = {
      totalParticipants: participantStats.totalParticipants || 0,
      totalTeams: participantStats.totalTeams || 0,
      totalPlayers: participantStats.totalPlayers || 0,
      checkedInCount: participantStats.checkedInCount || 0,
      checkedOutCount: participantStats.checkedOutCount || 0,
      pendingActions: participantStats.pendingActions || 0,
      totalHotels: hotelStats.totalHotels || 0,
      totalAvailableRooms: hotelStats.totalAvailableRooms || 0,
      totalRooms: hotelStats.totalRooms || 0,
      occupiedRooms: occupancyStats.occupiedRooms || 0,
      occupancyRate: Math.round(occupancyStats.avgOccupancyRate || 0),
      estimatedRoomsNeeded,
      lastUpdated: occupancyStats.lastMaterialized?.toISOString() || new Date().toISOString()
    };

    // Cache the computed stats
    this.dashboardStatsCache = {
      data: stats,
      timestamp: Date.now()
    };

    const totalTime = Date.now() - startTime;
    console.log(`⚡ OPTIMIZED dashboard stats completed in ${totalTime}ms (was 160+ seconds!)`);
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

  async getAvailableHotels(): Promise<(Hotel & { availableRooms: number })[]> {
    // Get all active hotels with their current occupancy
    const hotelsWithOccupancy = await db
      .select({
        id: hotels.id,
        hotelId: hotels.hotelId,
        instanceCode: hotels.instanceCode,
        hotelName: hotels.hotelName,
        location: hotels.location,
        district: hotels.district,
        address: hotels.address,
        pincode: hotels.pincode,
        pointOfContact: hotels.pointOfContact,
        contactPhoneNumber: hotels.contactPhoneNumber,
        startDate: hotels.startDate,
        endDate: hotels.endDate,
        totalRooms: hotels.totalRooms,
        occupiedRooms: hotels.occupiedRooms,
        availableRooms: hotels.availableRooms,
        createdAt: hotels.createdAt,
        currentParticipants: sql<number>`COALESCE(COUNT(${participants.id}), 0)`.as('currentParticipants'),
      })
      .from(hotels)
      .leftJoin(participants, eq(participants.hotelId, hotels.hotelId))
      .groupBy(hotels.id)
      .orderBy(hotels.hotelName);

    // Calculate actual available rooms based on room sharing rules
    return hotelsWithOccupancy.map(hotel => {
      const participantCount = Number(hotel.currentParticipants);
      
      // Room sharing rules: 3 players, 2 coaches, 1 official per room
      // For simplicity, assuming average 2.5 people per room (mixed roles)
      const estimatedRoomsNeeded = Math.ceil(participantCount / 2.5);
      const actualAvailableRooms = Math.max(0, hotel.totalRooms - estimatedRoomsNeeded);

      return {
        ...hotel,
        availableRooms: actualAvailableRooms,
      };
    }).filter(hotel => {
      // Only return hotels that have available rooms (remove strict date filtering for general availability)
      return hotel.availableRooms > 0;
    });
  }

  async getAvailableHotelsForDates(startDate: Date, endDate: Date, excludeParticipantId?: string): Promise<(Hotel & { availableRooms: number; suggestedDates?: { start: Date; end: Date } })[]> {
    // Get hotels that overlap with the requested date range
    const hotelsWithOccupancy = await db
      .select({
        id: hotels.id,
        hotelId: hotels.hotelId,
        instanceCode: hotels.instanceCode,
        hotelName: hotels.hotelName,
        location: hotels.location,
        district: hotels.district,
        address: hotels.address,
        pincode: hotels.pincode,
        pointOfContact: hotels.pointOfContact,
        contactPhoneNumber: hotels.contactPhoneNumber,
        startDate: hotels.startDate,
        endDate: hotels.endDate,
        totalRooms: hotels.totalRooms,
        occupiedRooms: hotels.occupiedRooms,
        availableRooms: hotels.availableRooms,
        createdAt: hotels.createdAt,
        participantCount: sql<number>`COALESCE(COUNT(CASE WHEN ${participants.id} IS NOT NULL ${excludeParticipantId ? sql`AND ${participants.id} != ${excludeParticipantId}` : sql``} THEN 1 END), 0)`.as('participantCount'),
        playerCount: sql<number>`COALESCE(COUNT(CASE WHEN ${participants.role} = 'player' ${excludeParticipantId ? sql`AND ${participants.id} != ${excludeParticipantId}` : sql``} THEN 1 END), 0)`.as('playerCount'),
        coachCount: sql<number>`COALESCE(COUNT(CASE WHEN ${participants.role} = 'coach' ${excludeParticipantId ? sql`AND ${participants.id} != ${excludeParticipantId}` : sql``} THEN 1 END), 0)`.as('coachCount'),
        officialCount: sql<number>`COALESCE(COUNT(CASE WHEN ${participants.role} = 'official' ${excludeParticipantId ? sql`AND ${participants.id} != ${excludeParticipantId}` : sql``} THEN 1 END), 0)`.as('officialCount'),
      })
      .from(hotels)
      .leftJoin(participants, and(
        eq(participants.hotelId, hotels.hotelId),
        // Only count participants whose booking dates overlap with the requested dates
        lte(participants.bookingStartDate, endDate),
        gte(participants.bookingEndDate, startDate)
      ))
      .where(and(
        // Hotel availability period must overlap with requested dates
        lte(hotels.startDate, endDate),
        gte(hotels.endDate, startDate)
      ))
      .groupBy(hotels.id)
      .orderBy(hotels.hotelName);

    const availableHotels = hotelsWithOccupancy.map(hotel => {
      const players = Number(hotel.playerCount);
      const coaches = Number(hotel.coachCount);
      const officials = Number(hotel.officialCount);
      
      // Calculate rooms needed based on specific role rules
      const roomsForPlayers = Math.ceil(players / 3);
      const roomsForCoaches = Math.ceil(coaches / 2);
      const roomsForOfficials = officials; // 1 official per room
      
      const totalRoomsNeeded = roomsForPlayers + roomsForCoaches + roomsForOfficials;
      const actualAvailableRooms = Math.max(0, hotel.totalRooms - totalRoomsNeeded);

      return {
        ...hotel,
        availableRooms: actualAvailableRooms,
      };
    });

    // For hotels with no availability, suggest alternative dates
    const hotelsWithSuggestions = await Promise.all(availableHotels.map(async hotel => {
      if (hotel.availableRooms > 0) {
        return hotel;
      }

      // Find the earliest available period for this hotel (simplified suggestion)
      const suggestedStart = new Date(Math.max(hotel.startDate.getTime(), Date.now()));
      const suggestedEnd = new Date(suggestedStart.getTime() + (endDate.getTime() - startDate.getTime()));
      
      // Ensure suggested end date is within hotel's availability period
      if (suggestedEnd <= hotel.endDate) {
        return {
          ...hotel,
          suggestedDates: {
            start: suggestedStart,
            end: suggestedEnd
          }
        };
      }

      return hotel;
    }));

    return hotelsWithSuggestions;
  }

  // Event-driven architecture methods
  async getParticipantsByHotelAndDate(hotelId: string, date: Date): Promise<Participant[]> {
    return await db.select()
      .from(participants)
      .where(and(
        eq(participants.hotelId, hotelId),
        lte(participants.bookingStartDate, date),
        gte(participants.bookingEndDate, date)
      ));
  }

  async createEvent(event: InsertEventStore): Promise<EventStore> {
    const [createdEvent] = await db.insert(eventStore).values(event).returning();
    return createdEvent;
  }

  async getEventsByAggregateId(aggregateId: string): Promise<EventStore[]> {
    return await db.select()
      .from(eventStore)
      .where(eq(eventStore.aggregateId, aggregateId))
      .orderBy(desc(eventStore.createdAt));
  }

  async getHotelOccupancyBalanceByDate(
    hotelId: string, 
    instanceCode: string, 
    startDate: Date, 
    endDate: Date
  ): Promise<HotelOccupancyBalance[]> {
    return await db.select()
      .from(hotelOccupancyBalance)
      .where(and(
        eq(hotelOccupancyBalance.hotelId, hotelId),
        eq(hotelOccupancyBalance.instanceCode, instanceCode),
        gte(hotelOccupancyBalance.date, startDate),
        lte(hotelOccupancyBalance.date, endDate)
      ))
      .orderBy(desc(hotelOccupancyBalance.date));
  }
}

export const storage = new DatabaseStorage();
