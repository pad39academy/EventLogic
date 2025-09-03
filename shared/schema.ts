import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, pgEnum, jsonb, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const userRoleEnum = pgEnum("user_role", ["admin", "coach"]);
export const participantRoleEnum = pgEnum("participant_role", ["coach", "official", "player"]);
export const checkinStatusEnum = pgEnum("checkin_status", ["pending", "checked_in", "checked_out"]);
export const bookingTypeEnum = pgEnum("booking_type", ["regular", "pre_event", "post_event"]);
export const hotelStatusEnum = pgEnum("hotel_status", ["upcoming", "active", "expired"]);
export const notificationStatusEnum = pgEnum("notification_status", ["unread", "read"]);
export const notificationTypeEnum = pgEnum("notification_type", ["match_lost", "early_checkout", "custom", "general"]);
export const audienceTypeEnum = pgEnum("audience_type", ["coaches_only", "all_participants", "discipline_specific"]);

// Users table (Admins and Coaches)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").unique(), // For admins
  password: text("password"), // For admins (hashed)
  mobileNumber: text("mobile_number").unique(), // For coaches
  name: text("name").notNull(),
  role: userRoleEnum("role").notNull(),
  coachId: text("coach_id").unique(), // For coaches (COA_001, etc.)
  isActive: boolean("is_active").default(true),
  // Hotel verification fields for coaches
  isHotelVerified: boolean("is_hotel_verified").default(false), // Coach has verified hotel code
  verifiedHotelId: text("verified_hotel_id"), // Which hotel they verified for
  verificationFailedAttempts: integer("verification_failed_attempts").default(0), // Failed attempts counter
  lastFailedAttempt: timestamp("last_failed_attempt"), // Last failed verification attempt
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Hotels table
export const hotels = pgTable("hotels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  hotelId: text("hotel_id").notNull(), // CHN001, MDU005, etc.
  instanceCode: text("instance_code").notNull(), // 1, 2, 3, etc.
  hotelName: text("hotel_name").notNull(),
  location: text("location").notNull(), // Alwarpet, Teynampet, T.Nagar
  district: text("district").notNull(), // Chennai, Coimbatore, Madurai
  address: text("address").notNull(),
  pincode: text("pincode").notNull(),
  pointOfContact: text("point_of_contact"), // Hotel staff contact person
  contactPhoneNumber: text("contact_phone_number"), // Hotel staff phone
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  totalRooms: integer("total_rooms").notNull(),
  occupiedRooms: integer("occupied_rooms").default(0),
  availableRooms: integer("available_rooms").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Participants table (Coaches, Officials, Players)
export const participants = pgTable("participants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  participantId: text("participant_id").notNull().unique(), // COA_001, OFC_001, PLA_001
  name: text("name").notNull(),
  mobileNumber: text("mobile_number"),
  role: participantRoleEnum("role").notNull(),
  // discipline and hotelName removed - players get this from their coach
  discipline: text("discipline"), // Only for coaches and officials
  district: text("district"), // Only for coaches and officials - players get from coach
  location: text("location"), // Only for coaches and officials - players get from coach
  teamName: text("team_name"),
  coachId: text("coach_id"), // For players, references coach
  hotelId: text("hotel_id").notNull(),
  // hotelName removed - players get this from their coach's hotel assignment
  stadium: text("stadium"),
  bookingStartDate: timestamp("booking_start_date").notNull(),
  bookingEndDate: timestamp("booking_end_date").notNull(),
  bookingReference: text("booking_reference").notNull(),
  bookingType: bookingTypeEnum("booking_type").default("regular"),
  // Renamed from transportPoc
  notifyTransport: text("notify_transport"), // For coaches and officials
  // New POC fields for coaches
  travelPocName: text("travel_poc_name"), // For coaches
  travelPocMobile: text("travel_poc_mobile"), // For coaches
  venuePocName: text("venue_poc_name"), // For coaches
  venuePocMobile: text("venue_poc_mobile"), // For coaches
  checkinStatus: checkinStatusEnum("checkin_status").default("pending"),
  checkinTime: timestamp("checkin_time"),
  checkoutTime: timestamp("checkout_time"),
  actualCheckoutDate: timestamp("actual_checkout_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Reassignments table
export const reassignments = pgTable("reassignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  originalParticipantId: text("original_participant_id").notNull(),
  newParticipantId: text("new_participant_id").notNull(),
  newBookingReference: text("new_booking_reference").notNull(),
  reason: text("reason"),
  reassignedBy: text("reassigned_by").notNull(),
  reassignedAt: timestamp("reassigned_at").defaultNow(),
});

// OTP table for SMS verification
export const otpVerifications = pgTable("otp_verifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  phoneNumber: text("phone_number").notNull(),
  email: text("email"), // For admin OTP
  otp: text("otp").notNull(),
  purpose: text("purpose").notNull(), // "admin_login", "coach_login"
  isUsed: boolean("is_used").default(false),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Notifications table
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fromUserId: text("from_user_id").notNull(), // Admin who sent the notification
  toParticipantId: text("to_participant_id").notNull(), // Participant who receives the notification (coach, official, or player)
  toParticipantRole: participantRoleEnum("to_participant_role").notNull(), // Role of the recipient
  teamName: text("team_name"), // Can be null for general notifications
  discipline: text("discipline"), // Can be null for general notifications
  notificationType: notificationTypeEnum("notification_type").notNull(),
  audienceType: audienceTypeEnum("audience_type").notNull(), // Target audience
  targetDisciplines: text("target_disciplines").array().default([]), // Array of disciplines for discipline-specific notifications
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  checkoutDate: timestamp("checkout_date"), // Suggested checkout date
  status: notificationStatusEnum("status").default("unread"),
  sentAt: timestamp("sent_at").defaultNow(),
  readAt: timestamp("read_at"),
});

// Settings table for global configuration
export const settings = pgTable("settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(), // Setting key (e.g., "checkin_time_window_hours")
  value: text("value").notNull(), // Setting value as string
  description: text("description"), // Description of the setting
  updatedBy: text("updated_by").notNull(), // Admin who updated the setting
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Audit log table
export const auditLog = pgTable("audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  actionType: text("action_type").notNull(), // upload, edit, delete, checkin, checkout, reassign, verify_hotel
  targetEntity: text("target_entity").notNull(), // participant, hotel, etc.
  targetId: text("target_id"),
  details: jsonb("details"),
  timestamp: timestamp("timestamp").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  auditLogs: many(auditLog),
  sentNotifications: many(notifications, { relationName: "sentNotifications" }),
  receivedNotifications: many(notifications, { relationName: "receivedNotifications" }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  fromUser: one(users, {
    fields: [notifications.fromUserId],
    references: [users.id],
    relationName: "sentNotifications",
  }),
  toParticipant: one(participants, {
    fields: [notifications.toParticipantId],
    references: [participants.participantId],
  }),
}));

export const participantsRelations = relations(participants, ({ one, many }) => ({
  coach: one(users, {
    fields: [participants.coachId],
    references: [users.coachId],
  }),
  reassignments: many(reassignments),
}));

export const reassignmentsRelations = relations(reassignments, ({ one }) => ({
  originalParticipant: one(participants, {
    fields: [reassignments.originalParticipantId],
    references: [participants.participantId],
  }),
  reassignedBy: one(users, {
    fields: [reassignments.reassignedBy],
    references: [users.id],
  }),
}));

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  user: one(users, {
    fields: [auditLog.userId],
    references: [users.id],
  }),
}));

// Zod schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertHotelSchema = createInsertSchema(hotels).omit({
  id: true,
  createdAt: true,
});

// Hotel update schema (excludes hotelId, instanceCode, and id)
export const updateHotelSchema = createInsertSchema(hotels).omit({
  id: true,
  hotelId: true,
  instanceCode: true,
  createdAt: true,
}).extend({
  // Override date fields to accept strings and transform to Date objects
  startDate: z.string().min(1, "Start date is required").transform((str) => {
    // Parse date string in YYYY-MM-DD format and create UTC date
    const parts = str.split('-');
    if (parts.length !== 3) throw new Error('Invalid date format');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
    const day = parseInt(parts[2], 10);
    return new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  }),
  endDate: z.string().min(1, "End date is required").transform((str) => {
    // Parse date string in YYYY-MM-DD format and create UTC date
    const parts = str.split('-');
    if (parts.length !== 3) throw new Error('Invalid date format');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
    const day = parseInt(parts[2], 10);
    return new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  }),
}).refine((data) => data.endDate > data.startDate, {
  message: "End date must be after start date",
  path: ["endDate"],
});

export const insertParticipantSchema = createInsertSchema(participants).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Update schemas for different participant roles
export const updatePlayerSchema = createInsertSchema(participants).omit({
  id: true,
  participantId: true, // Cannot change participant ID
  role: true, // Cannot change role
  discipline: true, // Inherited from coach
  district: true, // Inherited from coach
  location: true, // Inherited from coach
  bookingType: true, // Managed by admin separately
  checkinStatus: true, // Managed by check-in/out process
  checkinTime: true, // Managed by check-in/out process
  checkoutTime: true, // Managed by check-in/out process
  actualCheckoutDate: true, // Managed by check-in/out process
  notifyTransport: true, // Not applicable for players
  travelPocName: true, // Not applicable for players
  travelPocMobile: true, // Not applicable for players
  venuePocName: true, // Not applicable for players
  venuePocMobile: true, // Not applicable for players
  createdAt: true,
  updatedAt: true,
}).extend({
  // Hotel change reason (optional - only required if hotel is changed)
  changeReason: z.string().optional(),
  // Override date fields to accept strings and transform to Date objects
  bookingStartDate: z.string().min(1, "Start date is required").transform((str) => {
    const parts = str.split('-');
    if (parts.length !== 3) throw new Error('Invalid date format');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    return new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  }),
  bookingEndDate: z.string().min(1, "End date is required").transform((str) => {
    const parts = str.split('-');
    if (parts.length !== 3) throw new Error('Invalid date format');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    return new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  }),
}).refine((data) => {
  const startDate = typeof data.bookingStartDate === 'string' ? new Date(data.bookingStartDate) : data.bookingStartDate;
  const endDate = typeof data.bookingEndDate === 'string' ? new Date(data.bookingEndDate) : data.bookingEndDate;
  const diffTime = endDate.getTime() - startDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays >= 3;
}, {
  message: "Booking must be at least 3 days",
  path: ["bookingEndDate"],
}).refine((data) => {
  const startDate = typeof data.bookingStartDate === 'string' ? new Date(data.bookingStartDate) : data.bookingStartDate;
  const endDate = typeof data.bookingEndDate === 'string' ? new Date(data.bookingEndDate) : data.bookingEndDate;
  return endDate > startDate;
}, {
  message: "End date must be after start date",
  path: ["bookingEndDate"],
});

export const updateCoachSchema = createInsertSchema(participants).omit({
  id: true,
  participantId: true, // Cannot change participant ID
  role: true, // Cannot change role
  teamName: true, // Not applicable for coaches
  coachId: true, // Not applicable for coaches
  stadium: true, // Optional field for coaches
  bookingStartDate: true, // Managed by admin separately
  bookingEndDate: true, // Managed by admin separately
  bookingReference: true, // Managed by admin separately
  bookingType: true, // Managed by admin separately
  checkinStatus: true, // Managed by check-in/out process
  checkinTime: true, // Managed by check-in/out process
  checkoutTime: true, // Managed by check-in/out process
  actualCheckoutDate: true, // Managed by check-in/out process
  createdAt: true,
  updatedAt: true,
}).extend({
  // Hotel change reason (optional - only required if hotel is changed)
  changeReason: z.string().optional(),
});

export const updateOfficialSchema = createInsertSchema(participants).omit({
  id: true,
  participantId: true, // Cannot change participant ID
  role: true, // Cannot change role
  teamName: true, // Not applicable for officials
  coachId: true, // Not applicable for officials
  stadium: true, // Optional field for officials
  bookingStartDate: true, // Managed by admin separately
  bookingEndDate: true, // Managed by admin separately
  bookingReference: true, // Managed by admin separately
  bookingType: true, // Managed by admin separately
  checkinStatus: true, // Managed by check-in/out process
  checkinTime: true, // Managed by check-in/out process
  checkoutTime: true, // Managed by check-in/out process
  actualCheckoutDate: true, // Managed by check-in/out process
  travelPocName: true, // Not applicable for officials
  travelPocMobile: true, // Not applicable for officials
  venuePocName: true, // Not applicable for officials
  venuePocMobile: true, // Not applicable for officials
  createdAt: true,
  updatedAt: true,
}).extend({
  // Hotel change reason (optional - only required if hotel is changed)
  changeReason: z.string().optional(),
});

export const insertReassignmentSchema = createInsertSchema(reassignments).omit({
  id: true,
  reassignedAt: true,
});

export const insertAuditLogSchema = createInsertSchema(auditLog).omit({
  id: true,
  timestamp: true,
});

export const insertOtpSchema = createInsertSchema(otpVerifications).omit({
  id: true,
  createdAt: true,
});

export const insertSettingsSchema = createInsertSchema(settings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Notification schemas
export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  sentAt: true,
  readAt: true,
});

export const updateNotificationSchema = createSelectSchema(notifications).pick({
  status: true,
  readAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Hotel = typeof hotels.$inferSelect;
export type InsertHotel = z.infer<typeof insertHotelSchema>;
export type UpdateHotel = z.infer<typeof updateHotelSchema>;
export type Participant = typeof participants.$inferSelect;
export type InsertParticipant = z.infer<typeof insertParticipantSchema>;
export type UpdatePlayer = z.infer<typeof updatePlayerSchema>;
export type UpdateCoach = z.infer<typeof updateCoachSchema>;
export type UpdateOfficial = z.infer<typeof updateOfficialSchema>;
export type Reassignment = typeof reassignments.$inferSelect;
export type InsertReassignment = z.infer<typeof insertReassignmentSchema>;
export type AuditLog = typeof auditLog.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type OtpVerification = typeof otpVerifications.$inferSelect;
export type InsertOtpVerification = z.infer<typeof insertOtpSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type UpdateNotification = z.infer<typeof updateNotificationSchema>;
export type Settings = typeof settings.$inferSelect;
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type HotelVerificationRequest = z.infer<typeof hotelVerificationSchema>;

// Additional schemas for API validation
export const loginSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  mobileNumber: z.string().optional(),
  otp: z.string().optional(),
  role: z.enum(["admin", "coach"]).optional(),
});

export const otpRequestSchema = z.object({
  phoneNumber: z.string().optional(),
  mobileNumber: z.string().optional(),
  email: z.string().email().optional(),
  purpose: z.enum(["admin_login", "coach_login"]),
});

export const otpVerifySchema = z.object({
  phoneNumber: z.string().optional(),
  mobileNumber: z.string().optional(),
  email: z.string().email().optional(),
  otp: z.string().length(6),
  purpose: z.enum(["admin_login", "coach_login"]),
});

export const hotelVerificationSchema = z.object({
  hotelCode: z.string().min(1, "Hotel code is required"),
});

export const uploadFileSchema = z.object({
  type: z.enum(["hotel_inventory", "coaches_officials", "players"]),
  validateHotelIds: z.boolean().default(true),
  enforceMinimumStay: z.boolean().default(true),
  skipDuplicates: z.boolean().default(false),
});

export const checkinSchema = z.object({
  participantIds: z.array(z.string()),
  checkinTime: z.string().datetime().optional(),
});

export const checkoutSchema = z.object({
  participantIds: z.array(z.string()),
  checkoutTime: z.string().datetime().optional(),
  newCheckoutDate: z.string().datetime().optional(),
});

export type LoginRequest = z.infer<typeof loginSchema>;
export type UploadFileRequest = z.infer<typeof uploadFileSchema>;
export type CheckinRequest = z.infer<typeof checkinSchema>;

// Hotel status calculation utility
export function calculateHotelStatus(startDate: Date, endDate: Date): "upcoming" | "active" | "expired" {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Reset time to 00:00:00
  const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  
  if (today < start) {
    return "upcoming";
  } else if (today > end) {
    return "expired";
  } else {
    return "active";
  }
}

// Extended hotel type with computed status
export type HotelWithStatus = Hotel & {
  status: "upcoming" | "active" | "expired";
};
export type CheckoutRequest = z.infer<typeof checkoutSchema>;
