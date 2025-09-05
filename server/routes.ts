import type { Express } from "express";
import { createServer, type Server } from "http";
import express from "express";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import { pool } from "./db";
import { storage } from "./storage";
import { AuthService } from "./services/auth";
import { UploadService } from "./services/upload";
import { NotificationService } from "./services/notification";
import { 
  loginSchema, uploadFileSchema, checkinSchema, checkoutSchema,
  otpRequestSchema, otpVerifySchema, hotelVerificationSchema, updateHotelSchema, calculateHotelStatus,
  type User, type Participant, type Hotel, type UpdateHotel 
} from "@shared/schema";
import { db } from "./db";
import { users, participants, settings } from "@shared/schema";
import { eq } from "drizzle-orm";
import multer from "multer";
import { z } from "zod";

const PgSession = ConnectPgSimple(session);

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.mimetype === 'text/plain' || file.originalname.endsWith('.psv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and PSV files are allowed'));
    }
  },
});

declare module 'express-session' {
  interface SessionData {
    user: User;
    userId: string;
  }
}

// Middleware to check authentication
const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!req.session.user && !req.session.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  next();
};

// Middleware to check admin role
const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};

// Middleware to check coach role
const requireCoach = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!req.session.user || req.session.user.role !== "coach") {
    return res.status(403).json({ message: "Coach access required" });
  }
  next();
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Session configuration
  app.use(session({
    store: new PgSession({
      pool: pool,
      tableName: 'session',
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  }));

  // Initialize default admin
  await AuthService.createDefaultAdmin();

  // Authentication routes
  
  // Admin login step 1: email/password verification + OTP send
  app.post("/api/auth/admin/login", async (req, res) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      const result = await AuthService.loginAdminStep1(email, password);
      res.json(result);
    } catch (error) {
      res.status(401).json({ message: error instanceof Error ? error.message : "Login failed" });
    }
  });

  // Admin login step 2: OTP verification
  app.post("/api/auth/admin/verify-otp", async (req, res) => {
    try {
      const { mobileNumber, otp } = otpVerifySchema.parse(req.body);
      
      if (!mobileNumber || !otp) {
        return res.status(400).json({ message: "Mobile number and OTP are required" });
      }

      const user = await AuthService.loginAdminStep2(mobileNumber, otp);
      req.session.userId = user.id;
      req.session.user = user;
      
      // Audit logging now handled automatically via event_store.user_id

      res.json({ user: { id: user.id, name: user.name, role: user.role } });
    } catch (error) {
      res.status(401).json({ message: error instanceof Error ? error.message : "Login failed" });
    }
  });

  // Coach login step 1: mobile number + OTP send
  app.post("/api/auth/coach/login", async (req, res) => {
    try {
      const { mobileNumber } = loginSchema.parse(req.body);
      
      if (!mobileNumber) {
        return res.status(400).json({ message: "Mobile number required" });
      }

      const result = await AuthService.loginCoach(mobileNumber);
      res.json(result);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to send OTP" });
    }
  });

  // Coach login step 2: OTP verification
  app.post("/api/auth/coach/verify-otp", async (req, res) => {
    try {
      const { mobileNumber, otp } = otpVerifySchema.parse(req.body);
      
      if (!mobileNumber || !otp) {
        return res.status(400).json({ message: "Mobile number and OTP required" });
      }

      const user = await AuthService.verifyCoachOTP(mobileNumber, otp);
      req.session.userId = user.id;
      req.session.user = user;
      
      // Force session save
      await new Promise((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          else resolve(true);
        });
      });
      
      console.log('Coach session saved:', {
        userId: req.session.userId,
        userRole: req.session.user?.role,
        coachId: req.session.user?.coachId,
        sessionId: req.sessionID
      });

      // Audit logging now handled automatically via event_store.user_id

      res.json({ 
        user: { 
          id: user.id, 
          name: user.name, 
          role: user.role, 
          coachId: user.coachId,
          isHotelVerified: user.isHotelVerified || false,
          verificationFailedAttempts: user.verificationFailedAttempts || 0
        } 
      });
    } catch (error) {
      res.status(401).json({ message: error instanceof Error ? error.message : "Login failed" });
    }
  });

  // Coach hotel verification step
  app.post("/api/auth/coach/verify-hotel", requireCoach, async (req, res) => {
    try {
      const { hotelCode } = hotelVerificationSchema.parse(req.body);
      const userId = req.session.user!.id;
      const coachId = req.session.user!.coachId;
      
      if (!coachId) {
        return res.status(400).json({ message: "Coach ID not found" });
      }

      // Get current user to check failed attempts
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if user has exceeded maximum failed attempts
      if ((currentUser.verificationFailedAttempts || 0) >= 10) {
        return res.status(429).json({ 
          message: "Maximum verification attempts exceeded. Please logout and try again." 
        });
      }

      // Find coach's assigned hotel using their participant record
      const [coachParticipant] = await db.select().from(participants).where(
        eq(participants.participantId, coachId)
      );
      
      if (!coachParticipant) {
        return res.status(404).json({ message: "Coach assignment not found" });
      }

      // Verify hotel code matches assigned hotel ID
      if (hotelCode !== coachParticipant.hotelId) {
        // Increment failed attempts
        await db.update(users)
          .set({ 
            verificationFailedAttempts: (currentUser.verificationFailedAttempts || 0) + 1,
            lastFailedAttempt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(users.id, userId));

        await storage.createAuditLog({
          userId: userId,
          actionType: "verify_hotel",
          targetEntity: "hotel",
          targetId: hotelCode,
          details: { success: false, coachId, attemptedCode: hotelCode, assignedHotel: coachParticipant.hotelId },
        });

        return res.status(400).json({ 
          message: `Invalid hotel code. This code does not match your assigned hotel.`,
          failedAttempts: (currentUser.verificationFailedAttempts || 0) + 1,
          maxAttempts: 10
        });
      }

      // Valid hotel code - update user as verified
      await db.update(users)
        .set({ 
          isHotelVerified: true,
          verifiedHotelId: hotelCode,
          verificationFailedAttempts: 0, // Reset on successful verification
          updatedAt: new Date()
        })
        .where(eq(users.id, userId));

      // Update session
      req.session.user!.isHotelVerified = true;
      req.session.user!.verifiedHotelId = hotelCode;
      req.session.user!.verificationFailedAttempts = 0;

      await storage.createAuditLog({
        userId: userId,
        actionType: "verify_hotel",
        targetEntity: "hotel",
        targetId: hotelCode,
        details: { success: true, coachId, verifiedHotel: hotelCode },
      });

      // Force session save
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
        }
      });

      res.json({ 
        success: true, 
        message: "Hotel verified successfully",
        hotelName: coachParticipant.hotelName,
        hotelId: coachParticipant.hotelId
      });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Hotel verification failed" });
    }
  });

  // Settings management routes (Admin only)
  app.get("/api/admin/settings/checkin-time-window", requireAdmin, async (req, res) => {
    try {
      const [setting] = await db.select().from(settings).where(
        eq(settings.key, "checkin_time_window_hours")
      );
      
      if (!setting) {
        // Create default setting if it doesn't exist
        const [newSetting] = await db.insert(settings).values({
          key: "checkin_time_window_hours",
          value: "4",
          description: "Hours before check-in time that coaches can access check-in features",
          updatedBy: req.session.user!.name,
        }).returning();
        
        return res.json(newSetting);
      }
      
      res.json(setting);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to get settings" });
    }
  });

  app.put("/api/admin/settings/checkin-time-window", requireAdmin, async (req, res) => {
    try {
      const { value } = req.body;
      
      if (!value || isNaN(Number(value)) || Number(value) < 0 || Number(value) > 72) {
        return res.status(400).json({ message: "Value must be a number between 0 and 72" });
      }

      const [updated] = await db.update(settings)
        .set({ 
          value: value.toString(),
          updatedBy: req.session.user!.name,
          updatedAt: new Date()
        })
        .where(eq(settings.key, "checkin_time_window_hours"))
        .returning();

      if (!updated) {
        // Create if it doesn't exist
        const [newSetting] = await db.insert(settings).values({
          key: "checkin_time_window_hours",
          value: value.toString(),
          description: "Hours before check-in time that coaches can access check-in features",
          updatedBy: req.session.user!.name,
        }).returning();
        
        return res.json(newSetting);
      }

      await storage.createAuditLog({
        userId: req.session.user!.id,
        actionType: "update_setting",
        targetEntity: "setting",
        targetId: "checkin_time_window_hours",
        details: { newValue: value, updatedBy: req.session.user!.name },
      });

      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to update settings" });
    }
  });

  // Resend OTP for both admin and coach
  app.post("/api/auth/resend-otp", async (req, res) => {
    try {
      const { mobileNumber, purpose } = otpRequestSchema.parse(req.body);
      
      if (!mobileNumber || !purpose) {
        return res.status(400).json({ message: "Mobile number and purpose required" });
      }

      const result = await AuthService.resendOTP(mobileNumber, purpose);
      res.json(result);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to resend OTP" });
    }
  });

  app.post("/api/auth/logout", requireAuth, async (req, res) => {
    const userId = req.session.user!.id;
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  // Get current user
  app.get("/api/auth/me", (req, res) => {
    console.log('Session check:', {
      hasUser: !!req.session.user,
      userId: req.session.userId,
      userRole: req.session.user?.role,
      sessionId: req.sessionID
    });
    
    if (req.session.user) {
      const { id, name, role, coachId, isHotelVerified, verifiedHotelId, verificationFailedAttempts } = req.session.user;
      res.json({ 
        user: { 
          id, 
          name, 
          role, 
          coachId,
          isHotelVerified: isHotelVerified || false,
          verifiedHotelId,
          verificationFailedAttempts: verificationFailedAttempts || 0
        } 
      });
    } else {
      res.status(401).json({ message: "Not authenticated" });
    }
  });

  // Data upload routes (Admin only)
  app.post("/api/admin/upload/hotel-inventory", requireAdmin, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "File is required" });
      }

      const content = req.file.buffer.toString('utf-8');
      // 🚀 OPTIMIZED: Use batch upload for 10-20x faster processing
      const result = await UploadService.uploadHotelInventoryBatch(content);

      // Audit logging now handled automatically via event_store.user_id

      res.json(result);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Upload failed" });
    }
  });

  app.post("/api/admin/upload/coaches-officials", requireAdmin, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "File is required" });
      }

      const content = req.file.buffer.toString('utf-8');
      // 🚀 OPTIMIZED: Use batch upload for 10-20x faster processing
      const result = await UploadService.uploadCoachesOfficialsBatch(content);

      // Update all hotel occupancy after successful upload
      if (result.success && result.created > 0) {
        await storage.updateAllHotelOccupancy();
      }

      // Audit logging now handled automatically via event_store.user_id

      res.json(result);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Upload failed" });
    }
  });

  app.post("/api/admin/upload/players", requireAdmin, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "File is required" });
      }

      const content = req.file.buffer.toString('utf-8');
      // 🚀 OPTIMIZED: Use batch upload for 10-20x faster processing
      const result = await UploadService.uploadPlayersBatch(content);

      // Update all hotel occupancy after successful upload
      if (result.success && result.created > 0) {
        await storage.updateAllHotelOccupancy();
      }

      // Audit logging now handled automatically via event_store.user_id

      res.json(result);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Upload failed" });
    }
  });

  // Dashboard routes - now using pre-aggregated views for instant loading
  app.get("/api/admin/dashboard/stats", requireAdmin, async (req, res) => {
    try {
      // Check if user wants to force refresh views (fallback to old method)
      const forceRefresh = req.query.forceRefresh === 'true';
      
      if (forceRefresh) {
        // Use old method for manual refresh
        const stats = await storage.getDashboardStats(undefined, true);
        res.json(stats);
      } else {
        // Use lightning-fast pre-aggregated views
        const stats = await storage.getDashboardStatsFromViews();
        res.json(stats);
      }
    } catch (error) {
      console.error('Dashboard stats error:', error);
      // Fallback to old method if views fail
      try {
        const stats = await storage.getDashboardStats();
        res.json(stats);
      } catch (fallbackError) {
        res.status(500).json({ message: error instanceof Error ? error.message : "Failed to get stats" });
      }
    }
  });

  // Update participant endpoint
  app.put("/api/admin/participants/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      // Get current participant to determine role and check for hotel changes
      const currentParticipant = await storage.getParticipantById(id);
      if (!currentParticipant) {
        return res.status(404).json({ message: "Participant not found" });
      }

      let validatedData;
      const { role } = currentParticipant;

      // Validate based on role
      if (role === 'player') {
        const { updatePlayerSchema } = await import('@shared/schema');
        validatedData = updatePlayerSchema.parse(updateData);
      } else if (role === 'coach') {
        const { updateCoachSchema } = await import('@shared/schema');
        validatedData = updateCoachSchema.parse(updateData);
      } else if (role === 'official') {
        const { updateOfficialSchema } = await import('@shared/schema');
        validatedData = updateOfficialSchema.parse(updateData);
      } else {
        return res.status(400).json({ message: "Invalid participant role" });
      }

      // Check if hotel is being changed and reason is required
      const hotelChanged = validatedData.hotelId && validatedData.hotelId !== currentParticipant.hotelId;
      if (hotelChanged && !validatedData.changeReason?.trim()) {
        return res.status(400).json({ message: "Change reason is required when updating hotel assignment" });
      }

      // Remove changeReason from update data as it's not a participant field
      const { changeReason, ...participantUpdateData } = validatedData;

      // Update participant
      const updatedParticipant = await storage.updateParticipant(id, participantUpdateData);

      // If hotel changed, create reassignment record
      if (hotelChanged) {
        await storage.createReassignment({
          originalParticipantId: currentParticipant.participantId,
          newParticipantId: currentParticipant.participantId, // Same participant, different assignment
          newBookingReference: currentParticipant.bookingReference,
          reason: changeReason,
          reassignedBy: req.session.userId!,
        });
      }

      // Create audit log
      await storage.createAuditLog({
        userId: req.session.userId!,
        actionType: "edit",
        targetEntity: "participant",
        targetId: id,
        details: {
          changes: participantUpdateData,
          hotelChanged,
          reason: changeReason || null,
        },
      });

      res.json(updatedParticipant);
    } catch (error) {
      console.error('Update participant error:', error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to update participant" });
    }
  });

  // Get available hotels for participant assignment
  app.get("/api/admin/available-hotels", requireAdmin, async (req, res) => {
    try {
      const { startDate, endDate, excludeParticipantId } = req.query;
      
      if (startDate && endDate) {
        // Date-based hotel availability
        const start = new Date(startDate as string);
        const end = new Date(endDate as string);
        const availableHotels = await storage.getAvailableHotelsForDates(start, end, excludeParticipantId as string);
        res.json(availableHotels);
      } else {
        // General available hotels (current implementation)
        const availableHotels = await storage.getAvailableHotels();
        res.json(availableHotels);
      }
    } catch (error) {
      console.error('Get available hotels error:', error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to get available hotels" });
    }
  });

  app.get("/api/admin/dashboard/participants", requireAdmin, async (req, res) => {
    try {
      const filters = req.query;
      const participants = await storage.getParticipants(filters);
      
      // Calculate pagination metadata
      const page = parseInt(filters.page as string) || 1;
      const limit = parseInt(filters.limit as string) || 10;
      
      // Get total count without pagination
      const totalCountFilters = { ...filters };
      delete totalCountFilters.page;
      delete totalCountFilters.limit;
      const totalParticipants = await storage.getParticipants(totalCountFilters);
      const total = totalParticipants.length;
      
      const totalPages = Math.ceil(total / limit);
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedData = participants.slice(startIndex, endIndex);
      
      res.json({
        data: paginatedData,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
          startIndex: startIndex + 1,
          endIndex: Math.min(endIndex, total)
        }
      });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to get participants" });
    }
  });

  app.get("/api/admin/dashboard/hotels", requireAdmin, async (req, res) => {
    try {
      const { search, district, status, sortBy, sortOrder } = req.query;
      
      const filters = {
        search: search as string,
        district: district as string,
        status: status as "upcoming" | "active" | "expired",
        sortBy: sortBy as string,
        sortOrder: sortOrder as "asc" | "desc"
      };
      
      // Remove undefined values
      Object.keys(filters).forEach(key => {
        if (filters[key as keyof typeof filters] === undefined || filters[key as keyof typeof filters] === "") {
          delete filters[key as keyof typeof filters];
        }
      });
      
      // ⚡ OPTIMIZED: Use pre-calculated balance data for today's occupancy
      const hotels = await storage.getHotelsWithTodayOccupancy(filters);
      
      // Add computed status to each hotel
      const hotelsWithStatus = hotels.map(hotel => ({
        ...hotel,
        status: calculateHotelStatus(hotel.startDate, hotel.endDate)
      }));
      
      res.json(hotelsWithStatus);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to get hotels" });
    }
  });

  // Audit log endpoint
  app.get("/api/admin/audit-logs", requireAdmin, async (req, res) => {
    try {
      const auditLogs = await storage.getAuditLogs();
      res.json(auditLogs);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to get audit logs" });
    }
  });

  // Check hotel ID availability and suggest instance code
  app.get("/api/admin/hotels/check-id", requireAdmin, async (req, res) => {
    try {
      const { hotelId } = req.query;
      
      if (!hotelId || typeof hotelId !== 'string') {
        return res.status(400).json({ message: "Hotel ID is required" });
      }

      const existingHotels = await storage.getHotelsByHotelId(hotelId);
      const exists = existingHotels.length > 0;
      
      // Calculate next available instance code
      const existingInstanceCodes = existingHotels.map((h: any) => parseInt(h.instanceCode)).filter((code: number) => !isNaN(code));
      const maxInstanceCode = existingInstanceCodes.length > 0 ? Math.max(...existingInstanceCodes) : 0;
      const suggestedInstanceCode = maxInstanceCode + 1;

      // Calculate date range summary
      let earliestStart = null;
      let latestEnd = null;
      if (existingHotels.length > 0) {
        const startDates = existingHotels.map((h: any) => new Date(h.startDate));
        const endDates = existingHotels.map((h: any) => new Date(h.endDate));
        earliestStart = new Date(Math.min(...startDates.map(d => d.getTime())));
        latestEnd = new Date(Math.max(...endDates.map(d => d.getTime())));
      }

      res.json({
        exists,
        suggestedInstanceCode: suggestedInstanceCode.toString(),
        earliestStart,
        latestEnd,
        existingInstances: existingHotels.map((h: any) => ({
          id: h.id,
          instanceCode: h.instanceCode,
          hotelName: h.hotelName,
          location: h.location,
          district: h.district,
          address: h.address,
          pincode: h.pincode,
          pointOfContact: h.pointOfContact,
          contactPhoneNumber: h.contactPhoneNumber,
          startDate: h.startDate,
          endDate: h.endDate
        }))
      });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to check hotel ID" });
    }
  });

  // Add new hotel manually
  app.post("/api/admin/hotels", requireAdmin, async (req, res) => {
    try {
      console.log('Manual hotel creation request:', req.body);
      const { mode } = req.body;
      
      // Validate the request body
      const hotelData = {
        hotelId: req.body.hotelId,
        hotelName: req.body.hotelName,
        location: req.body.location,
        district: req.body.district,
        address: req.body.address,
        pincode: req.body.pincode,
        startDate: req.body.startDate, // Already transformed by schema
        endDate: req.body.endDate, // Already transformed by schema
        totalRooms: parseInt(req.body.totalRooms),
        availableRooms: parseInt(req.body.availableRooms),
        pointOfContact: req.body.pointOfContact || '',
        contactPhoneNumber: req.body.contactPhoneNumber || '',
        occupiedRooms: 0
      };

      // Check if hotel ID already exists and get next instance code
      const existingHotels = await storage.getHotelsByHotelId(hotelData.hotelId);
      const existingInstanceCodes = existingHotels.map((h: any) => parseInt(h.instanceCode)).filter((code: number) => !isNaN(code));
      const maxInstanceCode = existingInstanceCodes.length > 0 ? Math.max(...existingInstanceCodes) : 0;
      const instanceCode = (maxInstanceCode + 1).toString();

      // Check for date conflicts with existing instances
      const conflictingHotels = await storage.checkHotelDateConflicts(
        hotelData.hotelId,
        instanceCode, // This will be the new instance, so it won't conflict with itself
        hotelData.startDate,
        hotelData.endDate
      );

      if (conflictingHotels.length > 0) {
        const conflictDetails = conflictingHotels.map(h => {
          const start = new Date(h.startDate).toLocaleDateString();
          const end = new Date(h.endDate).toLocaleDateString();
          return `Instance ${h.instanceCode} (${start} - ${end})`;
        }).join(', ');
        
        return res.status(400).json({ 
          message: `Date range conflicts with existing hotel instances: ${conflictDetails}. Please choose non-overlapping dates.`,
          conflicts: conflictingHotels.map(h => ({ 
            id: h.id, 
            instanceCode: h.instanceCode, 
            startDate: h.startDate, 
            endDate: h.endDate 
          }))
        });
      }

      // Create the hotel with the calculated instance code
      const newHotel = await storage.createHotel({
        ...hotelData,
        instanceCode
      });

      // Create audit log entry
      const user = req.session.user;
      if (user) {
        await storage.createAuditLog({
          userId: user.id,
          actionType: 'create',
          targetEntity: 'hotel',
          targetId: newHotel.id,
          details: {
            action: mode === 'new' ? 'manual_hotel_creation' : 'manual_instance_creation',
            mode: mode,
            hotelId: hotelData.hotelId,
            instanceCode: instanceCode,
            hotelName: hotelData.hotelName,
            location: hotelData.location,
            district: hotelData.district
          }
        });
      }

      console.log('Hotel created successfully:', newHotel);
      res.status(201).json(newHotel);
    } catch (error) {
      console.error('Hotel creation error:', error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to create hotel" });
    }
  });

  // Hotel management endpoints
  app.get("/api/admin/hotels/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const hotel = await storage.getHotelById(id);
      
      if (!hotel) {
        return res.status(404).json({ message: "Hotel not found" });
      }
      
      res.json(hotel);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to get hotel" });
    }
  });

  app.put("/api/admin/hotels/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      console.log('Hotel update request:', { id, body: req.body });
      
      const updates = updateHotelSchema.parse(req.body);
      console.log('Parsed updates:', updates);
      
      // Get original hotel for audit logging
      const originalHotel = await storage.getHotelById(id);
      if (!originalHotel) {
        return res.status(404).json({ message: "Hotel not found" });
      }

      // The dates are already Date objects from the schema transformation
      const startDate = updates.startDate;
      const endDate = updates.endDate;

      // Only check for date conflicts if dates are actually being changed
      // Compare dates using local date components to avoid timezone issues
      const originalStart = new Date(originalHotel.startDate);
      const originalEnd = new Date(originalHotel.endDate);
      const newStart = new Date(startDate);
      const newEnd = new Date(endDate);
      
      const originalStartStr = `${originalStart.getFullYear()}-${(originalStart.getMonth() + 1).toString().padStart(2, '0')}-${originalStart.getDate().toString().padStart(2, '0')}`;
      const originalEndStr = `${originalEnd.getFullYear()}-${(originalEnd.getMonth() + 1).toString().padStart(2, '0')}-${originalEnd.getDate().toString().padStart(2, '0')}`;
      const newStartStr = `${newStart.getFullYear()}-${(newStart.getMonth() + 1).toString().padStart(2, '0')}-${newStart.getDate().toString().padStart(2, '0')}`;
      const newEndStr = `${newEnd.getFullYear()}-${(newEnd.getMonth() + 1).toString().padStart(2, '0')}-${newEnd.getDate().toString().padStart(2, '0')}`;
      
      const datesChanged = (originalStartStr !== newStartStr || originalEndStr !== newEndStr);

      let conflictingHotels: any[] = [];
      if (datesChanged) {
        conflictingHotels = await storage.checkHotelDateConflicts(
          originalHotel.hotelId,
          originalHotel.instanceCode,
          startDate,
          endDate
        );
      }

      if (conflictingHotels.length > 0) {
        const conflictDetails = conflictingHotels.map(h => {
          const start = new Date(h.startDate).toLocaleDateString();
          const end = new Date(h.endDate).toLocaleDateString();
          return `Instance ${h.instanceCode} (${start} - ${end})`;
        }).join(', ');
        
        return res.status(400).json({ 
          message: `Date range conflicts with existing hotel instances: ${conflictDetails}. Please choose non-overlapping dates.`,
          conflicts: conflictingHotels.map(h => ({ 
            id: h.id, 
            instanceCode: h.instanceCode, 
            startDate: h.startDate, 
            endDate: h.endDate 
          }))
        });
      }

      // Updates already contain properly converted dates
      const updateData = updates;

      // Detect field changes for audit logging
      const changes: Record<string, { from: any; to: any }> = {};
      Object.keys(updateData).forEach(key => {
        const newValue = updateData[key as keyof typeof updateData];
        const oldValue = originalHotel[key as keyof typeof originalHotel];
        
        // Compare values (handle dates specially)
        let isChanged = false;
        if (key === 'startDate' || key === 'endDate') {
          const newDate = new Date(newValue as Date);
          const oldDate = new Date(oldValue as Date);
          // Compare date components to avoid timezone issues
          const newDateStr = `${newDate.getFullYear()}-${(newDate.getMonth() + 1).toString().padStart(2, '0')}-${newDate.getDate().toString().padStart(2, '0')}`;
          const oldDateStr = `${oldDate.getFullYear()}-${(oldDate.getMonth() + 1).toString().padStart(2, '0')}-${oldDate.getDate().toString().padStart(2, '0')}`;
          isChanged = newDateStr !== oldDateStr;
        } else {
          isChanged = newValue !== oldValue;
        }
        
        if (isChanged) {
          changes[key] = { from: oldValue, to: newValue };
        }
      });

      // Only update if there are actual changes
      if (Object.keys(changes).length === 0) {
        return res.json({ message: "No changes detected", hotel: originalHotel });
      }

      // Separate changes into instance-specific and property-wide changes
      const propertyWideFields = ['address', 'location', 'pincode', 'district'];
      const propertyWideChanges: Record<string, any> = {};
      const instanceSpecificChanges: Record<string, any> = {};

      Object.keys(changes).forEach(field => {
        if (propertyWideFields.includes(field)) {
          propertyWideChanges[field] = updateData[field as keyof typeof updateData];
        } else {
          instanceSpecificChanges[field] = updateData[field as keyof typeof updateData];
        }
      });

      let updatedHotels: any[] = [];

      // Update property-wide changes across all instances of the same hotel
      if (Object.keys(propertyWideChanges).length > 0) {
        updatedHotels = await storage.updateHotelsByHotelId(originalHotel.hotelId, propertyWideChanges);
        
        // Log property-wide changes
        await storage.createAuditLog({
          userId: req.session.user!.id,
          actionType: "edit",
          targetEntity: "hotel",
          targetId: originalHotel.hotelId,
          details: { 
            hotelId: originalHotel.hotelId,
            action: "property_wide_update",
            affectedInstances: updatedHotels.length,
            changes: Object.keys(propertyWideChanges).reduce((acc, field) => {
              acc[field] = { from: originalHotel[field as keyof typeof originalHotel], to: propertyWideChanges[field] };
              return acc;
            }, {} as Record<string, any>),
            changedFields: Object.keys(propertyWideChanges)
          },
        });
      }

      // Update instance-specific changes only for this instance
      let updatedHotel = originalHotel;
      if (Object.keys(instanceSpecificChanges).length > 0) {
        const result = await storage.updateHotel(id, instanceSpecificChanges);
        
        if (!result) {
          return res.status(404).json({ message: "Hotel not found or update failed" });
        }
        updatedHotel = result;

        // Log instance-specific changes
        await storage.createAuditLog({
          userId: req.session.user!.id,
          actionType: "edit",
          targetEntity: "hotel",
          targetId: id,
          details: { 
            hotelId: originalHotel.hotelId,
            instanceCode: originalHotel.instanceCode,
            action: "instance_specific_update",
            changes: Object.keys(instanceSpecificChanges).reduce((acc, field) => {
              acc[field] = { from: originalHotel[field as keyof typeof originalHotel], to: instanceSpecificChanges[field] };
              return acc;
            }, {} as Record<string, any>),
            changedFields: Object.keys(instanceSpecificChanges)
          },
        });
      }

      console.log('Hotel updated successfully:', updatedHotel.id);

      const affectedInstances = Object.keys(propertyWideChanges).length > 0 ? updatedHotels.length : 1;
      
      res.json({ 
        message: `Hotel updated successfully${affectedInstances > 1 ? ` (${affectedInstances} instances affected)` : ''}`, 
        hotel: updatedHotel,
        changes: Object.keys(changes),
        affectedInstances
      });
    } catch (error) {
      console.error('Hotel update error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to update hotel" });
    }
  });

  // Coach dashboard routes
  app.get("/api/coach/dashboard", requireCoach, async (req, res) => {
    try {
      const coachId = req.session.user!.coachId;
      console.log('Coach dashboard request:', {
        userId: req.session.user!.id,
        coachId,
        sessionId: req.sessionID
      });
      
      if (!coachId) {
        return res.status(400).json({ message: "Coach ID not found" });
      }

      // Batch database queries for better performance
      const [players, coach] = await Promise.all([
        storage.getParticipantsByCoachId(coachId),
        storage.getParticipantByParticipantId(coachId)
      ]);
      
      console.log('Coach dashboard response:', {
        coachFound: !!coach,
        playersCount: players.length,
        coachData: coach ? { id: coach.id, name: coach.name, role: coach.role } : null
      });
      
      res.json({ coach, players });
    } catch (error) {
      console.error('Coach dashboard error:', error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to get dashboard data" });
    }
  });

  // Helper function to check time-based access
  const checkTimeBasedAccess = async (participant: any): Promise<{ allowed: boolean; message?: string; hoursUntil?: number }> => {
    // Get the time window setting
    const [setting] = await db.select().from(settings).where(
      eq(settings.key, "checkin_time_window_hours")
    );
    
    const timeWindowHours = parseInt(setting?.value || "4", 10);
    const now = new Date();
    const bookingStartDate = new Date(participant.bookingStartDate);
    
    // Calculate the allowed access time (time window hours before booking start)
    const allowedAccessTime = new Date(bookingStartDate.getTime() - (timeWindowHours * 60 * 60 * 1000));
    
    // Check if current time is within the allowed window
    if (now < allowedAccessTime) {
      // Format the allowed access time in DD/MM/YYYY HH:mm:ss format
      const day = allowedAccessTime.getDate().toString().padStart(2, '0');
      const month = (allowedAccessTime.getMonth() + 1).toString().padStart(2, '0');
      const year = allowedAccessTime.getFullYear();
      const hours = allowedAccessTime.getHours().toString().padStart(2, '0');
      const minutes = allowedAccessTime.getMinutes().toString().padStart(2, '0');
      const seconds = allowedAccessTime.getSeconds().toString().padStart(2, '0');
      
      const formattedDateTime = `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
      
      return { 
        allowed: false, 
        message: `You are allowed check-in time is after ${formattedDateTime}`,
        hoursUntil: Math.ceil((allowedAccessTime.getTime() - now.getTime()) / (1000 * 60 * 60))
      };
    }
    
    // Check if current time is past the booking end date
    const bookingEndDate = new Date(participant.bookingEndDate);
    if (now > bookingEndDate) {
      return { 
        allowed: false, 
        message: "Booking period has ended. Contact hotel reception for assistance." 
      };
    }
    
    return { allowed: true };
  };

  // Check-in/Check-out routes
  app.post("/api/coach/checkin", requireCoach, async (req, res) => {
    try {
      const { participantIds } = checkinSchema.parse(req.body);
      const coachId = req.session.user!.coachId;
      
      if (!coachId) {
        return res.status(400).json({ message: "Coach ID not found" });
      }

      // Check if coach is hotel verified
      if (!req.session.user!.isHotelVerified) {
        return res.status(403).json({ message: "Hotel verification required before check-in access" });
      }

      const checkedInParticipants: Participant[] = [];
      const accessDeniedParticipants: string[] = [];
      
      for (const participantId of participantIds) {
        const participant = await storage.getParticipantByParticipantId(participantId);
        
        if (!participant) {
          continue;
        }

        // Verify participant belongs to this coach
        if (participant.coachId !== coachId && participant.participantId !== coachId) {
          continue;
        }

        // Check time-based access for this participant
        const accessCheck = await checkTimeBasedAccess(participant);
        if (!accessCheck.allowed) {
          accessDeniedParticipants.push(participant.name);
          continue;
        }

        const updated = await storage.updateParticipant(participant.id, {
          checkinStatus: "checked_in",
          checkinTime: new Date(),
        });

        if (updated) {
          checkedInParticipants.push(updated);
        }
      }

      // Send notification to transport POC if coach is checking in players
      const coach = await storage.getParticipantByParticipantId(coachId);
      if (coach && coach.transportPoc && checkedInParticipants.length > 0) {
        const playerCount = checkedInParticipants.filter(p => p.role === 'player').length;
        if (playerCount > 0) {
          await NotificationService.sendCheckinNotification(
            coach.transportPoc,
            coachId,
            playerCount,
            new Date().toLocaleString()
          );
        }
      }

      await storage.createAuditLog({
        userId: req.session.user!.id,
        actionType: "checkin",
        targetEntity: "participant",
        details: { 
          participantIds, 
          checkedInCount: checkedInParticipants.length,
          accessDeniedCount: accessDeniedParticipants.length,
          accessDeniedNames: accessDeniedParticipants 
        },
      });

      let message = "";
      if (checkedInParticipants.length > 0 && accessDeniedParticipants.length === 0) {
        message = "Check-in successful";
      } else if (checkedInParticipants.length > 0 && accessDeniedParticipants.length > 0) {
        message = `Partial check-in: ${checkedInParticipants.length} successful, ${accessDeniedParticipants.length} access denied due to time restrictions`;
      } else if (accessDeniedParticipants.length > 0) {
        // All participants were denied access - return error status
        const firstDenied = await storage.getParticipantByParticipantId(participantIds[0]);
        if (firstDenied) {
          const accessCheck = await checkTimeBasedAccess(firstDenied);
          message = accessCheck.message || "Check-in access not yet available";
        } else {
          message = "Check-in access not yet available";
        }
        return res.status(403).json({ message });
      } else {
        message = "No participants were eligible for check-in";
        return res.status(400).json({ message });
      }

      res.json({ 
        message, 
        checkedIn: checkedInParticipants.length,
        participants: checkedInParticipants,
        accessDenied: accessDeniedParticipants.length,
        deniedNames: accessDeniedParticipants
      });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Check-in failed" });
    }
  });

  app.post("/api/coach/checkout", requireCoach, async (req, res) => {
    try {
      const { participantIds, newCheckoutDate } = checkoutSchema.parse(req.body);
      const coachId = req.session.user!.coachId;
      
      if (!coachId) {
        return res.status(400).json({ message: "Coach ID not found" });
      }

      // Checkout does not require hotel verification - only check-in does

      const checkedOutParticipants: Participant[] = [];
      
      for (const participantId of participantIds) {
        const participant = await storage.getParticipantByParticipantId(participantId);
        
        if (!participant) {
          continue;
        }

        // Verify participant belongs to this coach
        if (participant.coachId !== coachId && participant.participantId !== coachId) {
          continue;
        }

        // Validate new checkout date is not after original end date
        if (newCheckoutDate) {
          const newDate = new Date(newCheckoutDate);
          if (newDate > participant.bookingEndDate) {
            continue;
          }
        }

        const updated = await storage.updateParticipant(participant.id, {
          checkinStatus: "checked_out",
          checkoutTime: new Date(),
          actualCheckoutDate: newCheckoutDate ? new Date(newCheckoutDate) : undefined,
        });

        if (updated) {
          checkedOutParticipants.push(updated);
        }
      }

      await storage.createAuditLog({
        userId: req.session.user!.id,
        actionType: "checkout",
        targetEntity: "participant",
        details: { participantIds, checkedOutCount: checkedOutParticipants.length, newCheckoutDate },
      });

      res.json({ 
        message: "Check-out successful", 
        checkedOut: checkedOutParticipants.length,
        participants: checkedOutParticipants 
      });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Check-out failed" });
    }
  });

  // Admin check-in/check-out endpoints
  app.post("/api/admin/checkin", requireAdmin, async (req, res) => {
    try {
      const { participantIds } = checkinSchema.parse(req.body);
      
      const checkedInParticipants: Participant[] = [];
      
      for (const participantId of participantIds) {
        const participant = await storage.getParticipantByParticipantId(participantId);
        
        if (!participant) {
          continue;
        }

        const updated = await storage.updateParticipant(participant.id, {
          checkinStatus: "checked_in",
          checkinTime: new Date(),
        });

        if (updated) {
          checkedInParticipants.push(updated);
        }
      }

      await storage.createAuditLog({
        userId: req.session.user!.id,
        actionType: "checkin",
        targetEntity: "participant",
        details: { participantIds, checkedInCount: checkedInParticipants.length },
      });

      res.json({ 
        message: "Check-in successful", 
        checkedIn: checkedInParticipants.length,
        participants: checkedInParticipants 
      });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Check-in failed" });
    }
  });

  app.post("/api/admin/checkout", requireAdmin, async (req, res) => {
    try {
      const { participantIds, newCheckoutDate } = checkoutSchema.parse(req.body);
      
      const checkedOutParticipants: Participant[] = [];
      
      for (const participantId of participantIds) {
        const participant = await storage.getParticipantByParticipantId(participantId);
        
        if (!participant) {
          continue;
        }

        // Validate new checkout date is not after original end date
        if (newCheckoutDate) {
          const newDate = new Date(newCheckoutDate);
          if (newDate > participant.bookingEndDate) {
            continue;
          }
        }

        const updated = await storage.updateParticipant(participant.id, {
          checkinStatus: "checked_out",
          checkoutTime: new Date(),
          actualCheckoutDate: newCheckoutDate ? new Date(newCheckoutDate) : undefined,
        });

        if (updated) {
          checkedOutParticipants.push(updated);
        }
      }

      await storage.createAuditLog({
        userId: req.session.user!.id,
        actionType: "checkout",
        targetEntity: "participant",
        details: { participantIds, checkedOutCount: checkedOutParticipants.length, newCheckoutDate },
      });

      res.json({ 
        message: "Check-out successful", 
        checkedOut: checkedOutParticipants.length,
        participants: checkedOutParticipants 
      });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Check-out failed" });
    }
  });

  // Checkin dashboard endpoint
  app.get("/api/admin/dashboard/checkin", requireAdmin, async (req, res) => {
    try {
      const participants = await storage.getParticipants();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const checkinData = participants.map((participant: any) => {
        const bookingStartDate = new Date(participant.bookingStartDate);
        const timeDiff = bookingStartDate.getTime() - today.getTime();
        const daysUntilArrival = Math.ceil(timeDiff / (1000 * 3600 * 24));
        
        return {
          ...participant,
          daysUntilArrival,
          isLate: daysUntilArrival < 0 && participant.checkinStatus === "pending"
        };
      }).filter((p: any) => p.checkinStatus === "pending" || p.checkinStatus === "checked_in");

      // Calculate stats
      const stats = {
        totalPending: checkinData.filter((p: any) => p.checkinStatus === "pending").length,
        dueToday: checkinData.filter((p: any) => p.daysUntilArrival === 0 && p.checkinStatus === "pending").length,
        late: checkinData.filter((p: any) => p.isLate).length,
        completed: checkinData.filter((p: any) => {
          const checkinDate = p.checkinTime ? new Date(p.checkinTime) : null;
          return p.checkinStatus === "checked_in" && checkinDate && 
                 checkinDate.toDateString() === today.toDateString();
        }).length
      };

      res.json({ participants: checkinData, stats });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to fetch checkin data" });
    }
  });

  // Checkout dashboard endpoint
  app.get("/api/admin/dashboard/checkout", requireAdmin, async (req, res) => {
    try {
      const participants = await storage.getParticipants();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const checkoutData = participants.map((participant: any) => {
        const bookingEndDate = new Date(participant.bookingEndDate);
        const timeDiff = bookingEndDate.getTime() - today.getTime();
        const daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24));
        
        return {
          ...participant,
          daysRemaining,
          isOverdue: daysRemaining < 0 && participant.checkinStatus !== "checked_out"
        };
      }).filter((p: any) => p.checkinStatus === "checked_in" || p.checkinStatus === "checked_out");

      // Calculate stats
      const stats = {
        totalCheckedIn: checkoutData.filter((p: any) => p.checkinStatus === "checked_in").length,
        dueToday: checkoutData.filter((p: any) => p.daysRemaining === 0 && p.checkinStatus === "checked_in").length,
        overdue: checkoutData.filter((p: any) => p.isOverdue).length,
        completed: checkoutData.filter((p: any) => {
          const checkoutDate = p.checkoutTime ? new Date(p.checkoutTime) : null;
          return p.checkinStatus === "checked_out" && checkoutDate && 
                 checkoutDate.toDateString() === today.toDateString();
        }).length
      };

      res.json({ participants: checkoutData, stats });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to fetch checkout data" });
    }
  });

  // Admin early checkout
  app.post("/api/admin/early-checkout", requireAdmin, async (req, res) => {
    try {
      const { participantIds, newCheckoutDate } = checkoutSchema.parse(req.body);
      
      const notifications: Array<{ to: string; message: string }> = [];
      const updatedParticipants: Participant[] = [];
      
      for (const participantId of participantIds) {
        const participant = await storage.getParticipantByParticipantId(participantId);
        
        if (!participant) {
          continue;
        }

        const updated = await storage.updateParticipant(participant.id, {
          actualCheckoutDate: newCheckoutDate ? new Date(newCheckoutDate) : undefined,
        });

        if (updated) {
          updatedParticipants.push(updated);

          // Send notification to participant and coach
          if (participant.mobileNumber) {
            notifications.push({
              to: participant.mobileNumber,
              message: `CM Trophy Update: Your checkout date has been updated to ${newCheckoutDate}. Please plan accordingly. - Ievolve Events`
            });
          }

          // If it's a player, also notify the coach
          if (participant.role === 'player' && participant.coachId) {
            const coach = await storage.getUserByCoachId(participant.coachId);
            if (coach && coach.mobileNumber) {
              notifications.push({
                to: coach.mobileNumber,
                message: `CM Trophy Update: Player ${participant.name}'s checkout date has been updated to ${newCheckoutDate}. - Ievolve Events`
              });
            }
          }
        }
      }

      // Send all notifications
      if (notifications.length > 0) {
        await NotificationService.sendBulkNotifications(notifications);
      }

      await storage.createAuditLog({
        userId: req.session.user!.id,
        actionType: "early_checkout",
        targetEntity: "participant",
        details: { participantIds, newCheckoutDate, notificationsSent: notifications.length },
      });

      res.json({ 
        message: "Early checkout processed", 
        updated: updatedParticipants.length,
        notificationsSent: notifications.length 
      });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Early checkout failed" });
    }
  });

  // Participant management (Admin only)
  app.get("/api/admin/participants/:id", requireAdmin, async (req, res) => {
    try {
      const participant = await storage.getParticipantById(req.params.id);
      if (!participant) {
        return res.status(404).json({ message: "Participant not found" });
      }
      res.json(participant);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to get participant" });
    }
  });

  app.put("/api/admin/participants/:id", requireAdmin, async (req, res) => {
    try {
      const original = await storage.getParticipantById(req.params.id);
      const updated = await storage.updateParticipant(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ message: "Participant not found" });
      }

      // Update hotel occupancy if hotel assignment changed
      if (original && original.hotelId !== updated.hotelId) {
        // Update occupancy for both old and new hotels
        await storage.updateHotelOccupancy(original.hotelId, '1');
        await storage.updateHotelOccupancy(updated.hotelId, '1');
      } else if (updated.hotelId) {
        // Update occupancy for the current hotel
        await storage.updateHotelOccupancy(updated.hotelId, '1');
      }

      await storage.createAuditLog({
        userId: req.session.user!.id,
        actionType: "edit",
        targetEntity: "participant",
        targetId: req.params.id,
        details: req.body,
      });

      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to update participant" });
    }
  });

  app.delete("/api/admin/participants/:id", requireAdmin, async (req, res) => {
    try {
      const participant = await storage.getParticipantById(req.params.id);
      const success = await storage.deleteParticipant(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Participant not found" });
      }

      // Update hotel occupancy after deleting participant
      if (participant && participant.hotelId) {
        await storage.updateHotelOccupancy(participant.hotelId, '1');
      }

      await storage.createAuditLog({
        userId: req.session.user!.id,
        actionType: "delete",
        targetEntity: "participant",
        targetId: req.params.id,
      });

      res.json({ message: "Participant deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to delete participant" });
    }
  });

  // Create new participant (Admin only)
  app.post("/api/admin/participants", requireAdmin, async (req, res) => {
    try {
      const participantData = req.body;

      // Validate required fields based on role
      if (!participantData.role || !participantData.participantId || !participantData.name) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Validate hotel exists
      const hotel = await storage.getHotelByHotelId(participantData.hotelId);
      if (!hotel) {
        return res.status(400).json({ message: `Hotel ${participantData.hotelId} not found` });
      }

      // For players, validate coach exists
      if (participantData.role === 'player') {
        if (!participantData.coachId) {
          return res.status(400).json({ message: "Coach assignment is required for players" });
        }
        const coach = await storage.getParticipantByParticipantId(participantData.coachId);
        if (!coach || coach.role !== 'coach') {
          return res.status(400).json({ message: `Coach ${participantData.coachId} not found` });
        }
      }

      // Validate 3-day minimum booking
      const startDate = new Date(participantData.bookingStartDate);
      const endDate = new Date(participantData.bookingEndDate);
      const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
      
      if (daysDiff < 3) {
        return res.status(400).json({ 
          message: `Booking duration must be at least 3 days. Current: ${daysDiff} days` 
        });
      }

      // Check if participant ID already exists
      const existing = await storage.getParticipantByParticipantId(participantData.participantId);
      if (existing) {
        return res.status(400).json({ 
          message: `Participant ID ${participantData.participantId} already exists` 
        });
      }

      // Normalize mobile number
      if (participantData.mobileNumber) {
        participantData.mobileNumber = participantData.mobileNumber.startsWith('+91') 
          ? participantData.mobileNumber 
          : `+91${participantData.mobileNumber}`;
      }

      // Prepare participant data for insertion
      const insertData = {
        participantId: participantData.participantId,
        name: participantData.name,
        mobileNumber: participantData.mobileNumber || null,
        role: participantData.role,
        hotelId: participantData.hotelId,
        bookingStartDate: startDate,
        bookingEndDate: endDate,
        bookingReference: participantData.bookingReference,
        // Role-specific fields
        ...(participantData.role !== 'player' && {
          discipline: participantData.discipline,
          location: participantData.location,
          district: participantData.district,
          stadium: participantData.stadium,
          notifyTransport: participantData.notifyTransport,
        }),
        ...(participantData.role === 'coach' && {
          travelPocName: participantData.travelPocName,
          travelPocMobile: participantData.travelPocMobile,
          venuePocName: participantData.venuePocName,
          venuePocMobile: participantData.venuePocMobile,
        }),
        ...(participantData.role === 'player' && {
          coachId: participantData.coachId,
          teamName: participantData.teamName,
        }),
      };

      const newParticipant = await storage.createParticipant(insertData);

      // For coaches, create user account for login
      if (participantData.role === 'coach' && participantData.mobileNumber) {
        try {
          await storage.createUser({
            email: `${participantData.participantId}@ievolve.com`,
            username: participantData.participantId,
            role: 'coach',
            participantId: participantData.participantId,
            mobileNumber: participantData.mobileNumber,
            isVerified: true
          });
        } catch (error) {
          console.warn(`Failed to create user account for coach ${participantData.participantId}:`, error);
        }
      }

      // Update hotel occupancy
      await storage.updateHotelOccupancy(participantData.hotelId, '1');

      // Create audit log
      await storage.createAuditLog({
        userId: req.session.user!.id,
        actionType: "create",
        targetEntity: "participant",
        targetId: newParticipant.id,
        details: { participantData }
      });

      res.status(201).json(newParticipant);
    } catch (error) {
      console.error("Error creating participant:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to create participant" 
      });
    }
  });

  // Get all coaches (Admin only)
  app.get("/api/admin/coaches", requireAdmin, async (req, res) => {
    try {
      const participants = await storage.getParticipants();
      const coaches = participants
        .filter(p => p.role === 'coach')
        .map(coach => ({
          participantId: coach.participantId,
          name: coach.name,
          discipline: coach.discipline,
          district: coach.district,
          location: coach.location,
          teamName: coach.teamName,
          mobileNumber: coach.mobileNumber,
          hotelId: coach.hotelId
        }));
      
      res.json(coaches);
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to get coaches" 
      });
    }
  });

  // Export data (Admin only)
  app.get("/api/admin/export/participants", requireAdmin, async (req, res) => {
    try {
      const filters = req.query;
      const participants = await storage.getParticipants(filters);
      
      // Convert to CSV
      const headers = [
        'ID', 'Name', 'Mobile', 'Role', 'Discipline', 'District', 'Team',
        'Hotel ID', 'Hotel Name', 'Booking Reference', 'Start Date', 'End Date',
        'Status', 'Check-in Time', 'Check-out Time'
      ];
      
      const rows = participants.map(p => [
        p.participantId,
        p.name,
        p.mobileNumber || '',
        p.role,
        p.discipline,
        p.district || '',
        p.teamName || '',
        p.hotelId,
        p.hotelName,
        p.bookingReference,
        p.bookingStartDate.toISOString().split('T')[0],
        p.bookingEndDate.toISOString().split('T')[0],
        p.checkinStatus,
        p.checkinTime?.toISOString() || '',
        p.checkoutTime?.toISOString() || ''
      ]);

      const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="participants.csv"');
      res.send(csv);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Export failed" });
    }
  });

  // Audit logs (Admin only)
  app.get("/api/admin/audit-logs", requireAdmin, async (req, res) => {
    try {
      const filters = req.query;
      const logs = await storage.getAuditLogs(filters);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to get audit logs" });
    }
  });

  // Manual occupancy recalculation endpoint (Admin only)
  app.post("/api/admin/recalculate-occupancy", requireAdmin, async (req, res) => {
    try {
      await storage.updateAllHotelOccupancy();
      
      await storage.createAuditLog({
        userId: req.session.user!.id,
        actionType: "recalculate",
        targetEntity: "hotel",
        details: { action: "manual_occupancy_recalculation" },
      });
      
      res.json({ message: "Hotel occupancy recalculated successfully" });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to recalculate occupancy" });
    }
  });

  // Notification endpoints
  
  // Admin: Send enhanced notification with audience targeting
  app.post("/api/admin/notifications/send-enhanced", requireAdmin, async (req, res) => {
    try {
      const { audienceType, notificationType, subject, message, checkoutDate, targetDisciplines, teamName } = req.body;
      
      if (!audienceType || !notificationType || !subject || !message) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const participants = await storage.getParticipants();
      let targetParticipants: typeof participants = [];

      // Filter participants based on audience type
      switch (audienceType) {
        case "coaches_only":
          targetParticipants = participants.filter(p => p.role === 'coach');
          break;
        case "all_participants":
          targetParticipants = participants;
          break;
        case "discipline_specific":
          if (!targetDisciplines || targetDisciplines.length === 0) {
            return res.status(400).json({ message: "Target disciplines required for discipline-specific notifications" });
          }
          targetParticipants = participants.filter(p => targetDisciplines.includes(p.discipline));
          break;
        default:
          return res.status(400).json({ message: "Invalid audience type" });
      }

      const notifications = [];
      const smsPromises = [];

      // Create notifications for each target participant
      for (const participant of targetParticipants) {
        const notification = await storage.createNotification({
          fromUserId: req.session.user!.id,
          toParticipantId: participant.participantId,
          toParticipantRole: participant.role,
          teamName: participant.teamName || teamName,
          discipline: participant.discipline,
          notificationType,
          audienceType,
          targetDisciplines: audienceType === "discipline_specific" ? targetDisciplines : [],
          subject,
          message: message.replace('{checkoutDate}', checkoutDate ? new Date(checkoutDate).toLocaleDateString('en-IN') : ''),
          checkoutDate: checkoutDate ? new Date(checkoutDate) : undefined,
        });

        notifications.push(notification);

        // Send SMS notification for coaches and officials
        if ((participant.role === 'coach' || participant.role === 'official') && participant.mobileNumber) {
          smsPromises.push(
            NotificationService.sendSMS(
              participant.mobileNumber, 
              notification.message
            ).catch(error => console.error(`SMS failed for ${participant.participantId}:`, error))
          );
        }
      }

      // Send all SMS notifications concurrently
      await Promise.allSettled(smsPromises);

      await storage.createAuditLog({
        userId: req.session.user!.id,
        actionType: "notification_send",
        targetEntity: "notification",
        details: { 
          audienceType, 
          targetDisciplines, 
          notificationType, 
          subject, 
          recipientCount: notifications.length 
        },
      });

      res.json({ 
        message: "Notifications sent successfully", 
        recipientCount: notifications.length,
        notifications 
      });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to send notifications" });
    }
  });

  // Admin: Send notification to specific team coach (legacy endpoint)
  app.post("/api/admin/notifications/send", requireAdmin, async (req, res) => {
    try {
      const { toCoachId, teamName, notificationType, subject, message, checkoutDate } = req.body;
      
      if (!toCoachId || !teamName || !notificationType || !subject || !message) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Get coach participant record
      const coach = await storage.getParticipantByParticipantId(toCoachId);
      if (!coach || coach.role !== 'coach') {
        return res.status(404).json({ message: "Coach not found" });
      }

      const notification = await storage.createNotification({
        fromUserId: req.session.user!.id,
        toParticipantId: toCoachId,
        toParticipantRole: 'coach',
        teamName,
        discipline: coach.discipline,
        notificationType,
        audienceType: 'coaches_only',
        targetDisciplines: [],
        subject,
        message,
        checkoutDate: checkoutDate ? new Date(checkoutDate) : undefined,
      });

      // Send SMS notification
      if (coach.mobileNumber) {
        await NotificationService.sendSMS(coach.mobileNumber, message);
      }

      await storage.createAuditLog({
        userId: req.session.user!.id,
        actionType: "notification_send",
        targetEntity: "notification",
        targetId: notification.id,
        details: { toCoachId, teamName, notificationType, subject },
      });

      res.json({ message: "Notification sent successfully", notification });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to send notification" });
    }
  });

  // Admin: Get list of teams for notification dropdown
  app.get("/api/admin/teams", requireAdmin, async (req, res) => {
    try {
      const participants = await storage.getParticipants();
      const teamMap = new Map();
      participants
        .filter(p => p.teamName && p.role === 'coach')
        .forEach(p => {
          teamMap.set(p.participantId, { 
            teamName: p.teamName, 
            coachId: p.participantId,
            discipline: p.discipline 
          });
        });
      const teams = Array.from(teamMap.values());
      
      res.json(teams);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to get teams" });
    }
  });

  // Admin: Search coaches for notification
  app.get("/api/admin/coaches/search", requireAdmin, async (req, res) => {
    try {
      const { query } = req.query;
      const participants = await storage.getParticipants();
      let coaches = participants.filter(p => p.role === 'coach');
      
      // Filter by search query if provided
      if (query && typeof query === 'string') {
        const searchTerm = query.toLowerCase();
        coaches = coaches.filter(coach => 
          coach.name.toLowerCase().includes(searchTerm) ||
          coach.participantId.toLowerCase().includes(searchTerm) ||
          (coach.teamName && coach.teamName.toLowerCase().includes(searchTerm)) ||
          (coach.discipline && coach.discipline.toLowerCase().includes(searchTerm))
        );
      }
      
      const searchResults = coaches.map(coach => ({
        coachId: coach.participantId,
        name: coach.name,
        teamName: coach.teamName,
        discipline: coach.discipline,
        mobileNumber: coach.mobileNumber,
        hotelName: coach.hotelName
      }));
      
      res.json(searchResults);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to search coaches" });
    }
  });

  // Admin: Get team members for specific coach
  app.get("/api/admin/coaches/:coachId/team-members", requireAdmin, async (req, res) => {
    try {
      const { coachId } = req.params;
      const participants = await storage.getParticipants();
      
      // Find the coach first
      const coach = participants.find(p => p.participantId === coachId && p.role === 'coach');
      if (!coach) {
        return res.status(404).json({ message: "Coach not found" });
      }
      
      // Find all team members (players and officials) with same team name and discipline
      const teamMembers = participants.filter(p => 
        p.teamName === coach.teamName && 
        p.discipline === coach.discipline &&
        p.participantId !== coachId && // Exclude the coach themselves
        (p.role === 'player' || p.role === 'official')
      );
      
      const memberData = teamMembers.map(member => ({
        participantId: member.participantId,
        name: member.name,
        role: member.role,
        mobileNumber: member.mobileNumber,
        hotelName: member.hotelName
      }));
      
      res.json({
        coach: {
          coachId: coach.participantId,
          name: coach.name,
          teamName: coach.teamName,
          discipline: coach.discipline
        },
        teamMembers: memberData,
        totalMembers: memberData.length
      });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to get team members" });
    }
  });

  // Admin: Get list of disciplines with participant counts
  app.get("/api/admin/disciplines", requireAdmin, async (req, res) => {
    try {
      const participants = await storage.getParticipants();
      const disciplineMap = new Map();
      
      participants.forEach(p => {
        if (p.discipline) {
          const current = disciplineMap.get(p.discipline) || 0;
          disciplineMap.set(p.discipline, current + 1);
        }
      });
      
      const disciplines = Array.from(disciplineMap.entries()).map(([discipline, count]) => ({
        discipline,
        count
      }));
      
      res.json(disciplines);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to get disciplines" });
    }
  });

  // Test endpoint for disciplines (bypassing auth for testing)
  app.get("/api/test/disciplines", async (req, res) => {
    try {
      const participants = await storage.getParticipants();
      const disciplineMap = new Map();
      
      participants.forEach(p => {
        if (p.discipline) {
          const current = disciplineMap.get(p.discipline) || 0;
          disciplineMap.set(p.discipline, current + 1);
        }
      });
      
      const disciplines = Array.from(disciplineMap.entries()).map(([discipline, count]) => ({
        discipline,
        count
      }));
      
      res.json(disciplines);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to get disciplines" });
    }
  });

  // Test endpoint for teams (bypassing auth for testing)
  app.get("/api/test/teams", async (req, res) => {
    try {
      const participants = await storage.getParticipants();
      const teamMap = new Map();
      participants
        .filter(p => p.teamName && p.role === 'coach')
        .forEach(p => {
          teamMap.set(p.participantId, { 
            teamName: p.teamName, 
            coachId: p.participantId,
            discipline: p.discipline 
          });
        });
      const teams = Array.from(teamMap.values());
      
      res.json(teams);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to get teams" });
    }
  });

  // Admin: Get all sent notifications with details
  app.get("/api/admin/notifications", requireAdmin, async (req, res) => {
    try {
      const allNotifications = await storage.getAllNotifications();

      // Group notifications by message (for bulk sends)
      const groupedNotifications = new Map<string, any>();
      
      allNotifications.forEach((notification: any) => {
        const key = `${notification.fromUserId}-${notification.subject}-${notification.sentAt?.getTime()}`;
        if (!groupedNotifications.has(key)) {
          groupedNotifications.set(key, {
            ...notification,
            recipientCount: 1,
            recipients: [notification.toParticipantId],
            readCount: notification.status === 'read' ? 1 : 0,
            unreadCount: notification.status === 'unread' ? 1 : 0
          });
        } else {
          const existing = groupedNotifications.get(key);
          existing.recipientCount++;
          existing.recipients.push(notification.toParticipantId);
          if (notification.status === 'read') existing.readCount++;
          if (notification.status === 'unread') existing.unreadCount++;
        }
      });

      const result = Array.from(groupedNotifications.values());
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to get notifications" });
    }
  });

  // Admin: Send notification to selected coaches and team members
  app.post("/api/admin/notifications/send-to-coaches", requireAdmin, async (req, res) => {
    try {
      const { selectedCoaches, includeTeamMembers, notificationType, subject, message, checkoutDate } = req.body;
      
      if (!selectedCoaches || !Array.isArray(selectedCoaches) || selectedCoaches.length === 0) {
        return res.status(400).json({ message: "At least one coach must be selected" });
      }
      
      if (!notificationType || !subject || !message) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const participants = await storage.getParticipants();
      const notifications = [];
      const smsPromises = [];
      let recipientCount = 0;

      // Process each selected coach
      for (const coachId of selectedCoaches) {
        const coach = participants.find(p => p.participantId === coachId && p.role === 'coach');
        if (!coach) {
          continue; // Skip if coach not found
        }

        // Create notification for coach
        const coachNotification = await storage.createNotification({
          fromUserId: req.session.user!.id,
          toParticipantId: coach.participantId,
          toParticipantRole: 'coach',
          teamName: coach.teamName,
          discipline: coach.discipline,
          notificationType,
          audienceType: 'coaches_only',
          targetDisciplines: [],
          subject,
          message: message.replace('{checkoutDate}', checkoutDate ? new Date(checkoutDate).toLocaleDateString('en-IN') : ''),
          checkoutDate: checkoutDate ? new Date(checkoutDate) : undefined,
        });

        notifications.push(coachNotification);
        recipientCount++;

        // Send SMS to coach
        if (coach.mobileNumber) {
          smsPromises.push(
            NotificationService.sendSMS(coach.mobileNumber, coachNotification.message)
          );
        }

        // Include team members if requested
        if (includeTeamMembers) {
          const teamMembers = participants.filter(p => 
            p.teamName === coach.teamName && 
            p.discipline === coach.discipline &&
            p.participantId !== coachId &&
            (p.role === 'player' || p.role === 'official')
          );

          for (const member of teamMembers) {
            const memberNotification = await storage.createNotification({
              fromUserId: req.session.user!.id,
              toParticipantId: member.participantId,
              toParticipantRole: member.role,
              teamName: member.teamName,
              discipline: member.discipline,
              notificationType,
              audienceType: 'all_participants',
              targetDisciplines: [],
              subject,
              message: message.replace('{checkoutDate}', checkoutDate ? new Date(checkoutDate).toLocaleDateString('en-IN') : ''),
              checkoutDate: checkoutDate ? new Date(checkoutDate) : undefined,
            });

            notifications.push(memberNotification);
            recipientCount++;

            // Send SMS to team member if they have a mobile number
            if (member.mobileNumber) {
              smsPromises.push(
                NotificationService.sendSMS(member.mobileNumber, memberNotification.message)
              );
            }
          }
        }
      }

      // Send all SMS notifications
      if (smsPromises.length > 0) {
        try {
          await Promise.all(smsPromises);
        } catch (error) {
          console.error('Some SMS notifications failed to send:', error);
        }
      }

      // Create audit log
      await storage.createAuditLog({
        userId: req.session.user!.id,
        actionType: "notification_send",
        targetEntity: "notification",
        targetId: notifications[0]?.id || 'bulk',
        details: { 
          selectedCoaches, 
          includeTeamMembers, 
          notificationType, 
          subject, 
          recipientCount 
        },
      });

      res.json({
        message: "Notifications sent successfully",
        recipientCount,
        notificationIds: notifications.map(n => n.id)
      });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to send notifications" });
    }
  });

  // Test endpoint for sending enhanced notifications (bypassing auth for testing)
  app.post("/api/test/notifications/send-enhanced", async (req, res) => {
    try {
      const { audienceType, notificationType, subject, message, checkoutDate, targetDisciplines, teamName } = req.body;
      
      // Mock user for testing
      const mockUser = { id: 'test-user', name: 'Test Admin', role: 'admin' };
      
      console.log('Test notification request:', {
        audienceType,
        notificationType,
        subject,
        message,
        checkoutDate,
        targetDisciplines,
        teamName
      });

      // Create notification records - for this test, we'll create one sample record
      const notificationData = {
        fromUserId: mockUser.id,
        toParticipantId: 'COACH-00001', // Sample participant ID 
        toParticipantRole: 'coach' as const,
        teamName: teamName || null,
        discipline: targetDisciplines.length > 0 ? targetDisciplines[0] : null,
        notificationType,
        audienceType,
        targetDisciplines: audienceType === "discipline_specific" ? targetDisciplines : [],
        subject,
        message,
        checkoutDate: checkoutDate ? new Date(checkoutDate) : null,
        status: 'unread' as const,
      };

      const notification = await storage.createNotification(notificationData);

      // Calculate recipients based on audience type
      let recipientCount = 0;
      const participants = await storage.getParticipants();
      
      switch (audienceType) {
        case "coaches_only":
          recipientCount = participants.filter(p => p.role === 'coach').length;
          break;
        case "all_participants":
          recipientCount = participants.length;
          break;
        case "discipline_specific":
          recipientCount = participants.filter(p => 
            targetDisciplines.includes(p.discipline || '')
          ).length;
          break;
        default:
          recipientCount = 0;
      }

      console.log(`Test notification sent to ${recipientCount} recipients`);

      res.json({
        message: "Notification sent successfully",
        notification,
        recipientCount,
        recipients: audienceType
      });
    } catch (error) {
      console.error('Test notification error:', error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to send notification" });
    }
  });

  // Coach: Get notifications for current coach
  app.get("/api/coach/notifications", requireCoach, async (req, res) => {
    try {
      const coachId = req.session.user!.coachId;
      if (!coachId) {
        return res.status(400).json({ message: "Coach ID not found" });
      }

      const notifications = await storage.getNotificationsByParticipantId(coachId);
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to get notifications" });
    }
  });

  // Coach: Mark notification as read
  app.post("/api/coach/notifications/:id/read", requireCoach, async (req, res) => {
    try {
      const notification = await storage.getNotificationById(req.params.id);
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }

      // Verify notification belongs to this coach
      if (notification.toParticipantId !== req.session.user!.coachId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const updatedNotification = await storage.markNotificationAsRead(req.params.id);
      res.json({ message: "Notification marked as read", notification: updatedNotification });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to mark notification as read" });
    }
  });

  // Coach: Get unread notification count
  app.get("/api/coach/notifications/unread-count", requireCoach, async (req, res) => {
    try {
      const coachId = req.session.user!.coachId;
      if (!coachId) {
        return res.status(400).json({ message: "Coach ID not found" });
      }

      const count = await storage.getUnreadNotificationCountByParticipantId(coachId);
      res.json(count);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to get unread count" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
