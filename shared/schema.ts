import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, pgEnum, jsonb, index, uniqueIndex, date, bigint, decimal } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const userRoleEnum = pgEnum("user_role", ["admin", "coach", "technical_admin"]);
export const participantRoleEnum = pgEnum("participant_role", ["coach", "official", "player"]);
export const checkinStatusEnum = pgEnum("checkin_status", ["pending", "checked_in", "checked_out"]);
export const bookingTypeEnum = pgEnum("booking_type", ["regular", "pre_event", "post_event"]);
export const hotelStatusEnum = pgEnum("hotel_status", ["upcoming", "active", "expired"]);
export const notificationStatusEnum = pgEnum("notification_status", ["unread", "read"]);
export const notificationTypeEnum = pgEnum("notification_type", ["match_lost", "early_checkout", "custom", "general"]);
export const audienceTypeEnum = pgEnum("audience_type", ["coaches_only", "all_participants", "discipline_specific"]);

// Event-driven architecture enums
export const eventTypeEnum = pgEnum("event_type", [
  // Booking events
  "booking_created", "booking_updated", "booking_cancelled",
  // Hotel occupancy events
  "hotel_occupancy_changed", "hotel_capacity_updated", "batch_hotel_occupancy_update",
  // Participant events
  "participant_registered", "participant_updated", "participant_deleted",
  "participant_checked_in", "participant_checked_out",
  // Admin events
  "bulk_upload_completed", "hotel_verification_completed",
  // Notification events
  "notification_sent", "otp_generated",
  // System events
  "audit_logged", "background_job_executed"
]);

export const eventStatusEnum = pgEnum("event_status", ["pending", "processed", "failed", "retrying"]);

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

// Event Store table for event-driven architecture with daily partitioning
export const eventStore = pgTable("event_store", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Daily partitioning fields for scalability
  eventDate: date("event_date").notNull(), // YYYY-MM-DD for partitioning
  sequenceNumber: bigint("sequence_number", { mode: "number" }).notNull(), // Daily sequence: 1, 2, 3...
  partitionKey: varchar("partition_key").notNull(), // "2025-09-05" format for daily partitions
  
  // Audit fields (consolidated from audit_log)
  userId: text("user_id"), // User who triggered this event
  
  // Existing fields
  eventType: eventTypeEnum("event_type").notNull(),
  aggregateId: text("aggregate_id").notNull(), // The ID of the entity this event affects
  aggregateType: text("aggregate_type").notNull(), // participant, hotel, user, etc.
  eventData: jsonb("event_data").notNull(), // The full event payload
  metadata: jsonb("metadata").default({}), // Additional context (correlation_id, etc.)
  eventVersion: integer("event_version").notNull().default(1), // For event schema evolution
  status: eventStatusEnum("status").default("pending"),
  processedAt: timestamp("processed_at"),
  failedAt: timestamp("failed_at"),
  retryCount: integer("retry_count").default(0),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  // Partition-optimized indexes for daily partitions
  partitionSeqIdx: index("event_partition_seq_idx").on(table.partitionKey, table.sequenceNumber),
  eventTypePartitionIdx: index("event_type_partition_idx").on(table.eventType, table.partitionKey),
  aggregatePartitionIdx: index("event_aggregate_partition_idx").on(table.aggregateId, table.partitionKey),
  
  // Audit query indexes (consolidated from audit_log)
  userEventTypeIdx: index("event_store_user_action_idx").on(table.userId, table.eventType),
  userAggregateIdx: index("event_store_user_target_idx").on(table.userId, table.aggregateType),
  
  // Legacy indexes for existing queries
  eventTypeIdx: index("event_store_event_type_idx").on(table.eventType),
  aggregateIdx: index("event_store_aggregate_idx").on(table.aggregateId, table.aggregateType),
  statusIdx: index("event_store_status_idx").on(table.status),
  createdAtIdx: index("event_store_created_at_idx").on(table.createdAt),
}));

// Event Handlers Tracking table
export const eventHandlers = pgTable("event_handlers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull().references(() => eventStore.id),
  handlerName: text("handler_name").notNull(), // occupancy_calculator, notification_sender, etc.
  status: eventStatusEnum("status").default("pending"),
  processedAt: timestamp("processed_at"),
  failedAt: timestamp("failed_at"),
  retryCount: integer("retry_count").default(0),
  errorMessage: text("error_message"),
  result: jsonb("result"), // Handler execution result
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  eventHandlerIdx: index("event_handlers_event_idx").on(table.eventId),
  handlerStatusIdx: index("event_handlers_status_idx").on(table.handlerName, table.status),
}));

// Hotel Daily Balance Ledger - Pre-calculated for lightning-fast reads (30+100 day window)
export const hotelDailyBalance = pgTable("hotel_daily_balance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Core identifiers
  hotelId: text("hotel_id").notNull(),
  instanceCode: text("instance_code").notNull(),
  balanceDate: date("balance_date").notNull(), // YYYY-MM-DD for date-based partitioning
  
  // ⚡ OPTIMIZED: Essential fast calculations only
  totalRooms: integer("total_rooms").notNull(),
  playersCount: integer("players_count").default(0),
  coachesCount: integer("coaches_count").default(0),
  officialsCount: integer("officials_count").default(0),
  calculatedOccupiedRooms: integer("calculated_occupied_rooms").default(0),
  
  // ⚡ REMOVED for performance:
  // - availableRooms (derived calculation - calculate on demand)
  // - occupancyPercentage (heavy decimal math - calculate offline)
  // - pendingCheckout* fields (use existing participant status)
  // - lastUpdatedEventId/Sequence (event tracking overhead)
  // - calculatedAt (timestamp overhead)
  
  // Minimal audit
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  // PRIMARY: Fast hotel-date queries for dashboard
  hotelDateIdx: uniqueIndex("hotel_date_unique_idx").on(table.hotelId, table.instanceCode, table.balanceDate),
  
  // ⚡ OPTIMIZED: Essential indexes only
  dateRangeIdx: index("balance_date_range_idx").on(table.balanceDate),
  // ⚡ REMOVED: occupancyIdx, pendingCheckoutIdx (heavy columns removed)
}));

// Legacy table (keep for migration compatibility)
export const hotelOccupancyBalance = pgTable("hotel_occupancy_balance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  hotelId: text("hotel_id").notNull(),
  instanceCode: text("instance_code").notNull(),
  date: timestamp("date").notNull(),
  totalRooms: integer("total_rooms").notNull(),
  playersCount: integer("players_count").default(0),
  coachesCount: integer("coaches_count").default(0),
  officialsCount: integer("officials_count").default(0),
  calculatedOccupiedRooms: integer("calculated_occupied_rooms").default(0),
  availableRooms: integer("available_rooms").default(0),
  lastEventId: varchar("last_event_id"),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  hotelDateIdx: index("hotel_occupancy_hotel_date_idx").on(table.hotelId, table.instanceCode, table.date),
  uniqueHotelDateIdx: index("unique_hotel_date_idx").on(table.hotelId, table.instanceCode, table.date),
}));

// Audit log functionality consolidated into event_store table for better performance

// Relations
export const usersRelations = relations(users, ({ many }) => ({
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

// Audit log relations removed - functionality consolidated into event_store

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

// insertAuditLogSchema removed - functionality consolidated into event_store

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
export type UserRole = 'admin' | 'coach' | 'technical_admin';
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
// AuditLog types removed - functionality consolidated into event_store
export type OtpVerification = typeof otpVerifications.$inferSelect;
export type InsertOtpVerification = z.infer<typeof insertOtpSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type UpdateNotification = z.infer<typeof updateNotificationSchema>;
export type Settings = typeof settings.$inferSelect;
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type HotelVerificationRequest = z.infer<typeof hotelVerificationSchema>;

// Event Store schemas
export const insertEventStoreSchema = createInsertSchema(eventStore).omit({
  id: true,
  createdAt: true,
});

export const insertEventHandlerSchema = createInsertSchema(eventHandlers).omit({
  id: true,
  createdAt: true,
});

export const insertHotelOccupancyBalanceSchema = createInsertSchema(hotelOccupancyBalance).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Event Store types
export type EventStore = typeof eventStore.$inferSelect;
export type InsertEventStore = z.infer<typeof insertEventStoreSchema>;
export type EventHandler = typeof eventHandlers.$inferSelect;
export type InsertEventHandler = z.infer<typeof insertEventHandlerSchema>;
export type HotelOccupancyBalance = typeof hotelOccupancyBalance.$inferSelect;
export type InsertHotelOccupancyBalance = z.infer<typeof insertHotelOccupancyBalanceSchema>;

// New Daily Balance types
export const insertHotelDailyBalanceSchema = createInsertSchema(hotelDailyBalance).omit({
  id: true,
  createdAt: true,
});
export type HotelDailyBalance = typeof hotelDailyBalance.$inferSelect;
export type InsertHotelDailyBalance = z.infer<typeof insertHotelDailyBalanceSchema>;

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
