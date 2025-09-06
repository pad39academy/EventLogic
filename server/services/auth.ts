import bcrypt from "bcryptjs";
import { users, otpVerifications, type User, type InsertUser, type InsertOtpVerification } from "../../shared/schema";
import { db } from "../db";
import { eq, and, or, gt } from "drizzle-orm";
import { sendSMS, generateOTP, formatOTPMessage } from "./sms";

export class AuthService {
  // Admin login with email/password + SMS OTP (2FA)
  static async loginAdminStep1(email: string, password: string) {
    const [user] = await db.select().from(users).where(
      and(
        eq(users.email, email), 
        or(eq(users.role, "admin"), eq(users.role, "technical_admin"))
      )
    );
    
    if (!user || !user.password) {
      throw new Error("Invalid credentials");
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      throw new Error("Invalid credentials");
    }

    // Step 1 passed, now send OTP for 2FA
    if (!user.mobileNumber) {
      throw new Error("Admin mobile number not configured for 2FA");
    }

    await this.sendOTP(user.mobileNumber, "admin_login");
    
    return { 
      message: "OTP sent to your registered mobile number", 
      requiresOTP: true,
      mobileNumber: user.mobileNumber
    };
  }

  // Admin OTP verification (Step 2 of login)
  static async loginAdminStep2(mobileNumber: string, otp: string) {
    const isValidOTP = await this.verifyOTP(mobileNumber, otp, "admin_login");
    if (!isValidOTP) {
      throw new Error("Invalid or expired OTP");
    }

    const [user] = await db.select().from(users).where(
      and(
        eq(users.mobileNumber, mobileNumber), 
        or(eq(users.role, "admin"), eq(users.role, "technical_admin"))
      )
    );

    if (!user) {
      throw new Error("Admin not found");
    }

    return user;
  }

  // Coach login with mobile number + OTP (single factor)
  static async loginCoach(mobileNumber: string) {
    const [user] = await db.select().from(users).where(
      and(eq(users.mobileNumber, mobileNumber), eq(users.role, "coach"))
    );
    
    if (!user) {
      throw new Error("Coach not found with this mobile number");
    }

    if (!user.isActive) {
      throw new Error("Account is inactive. Please contact administrator");
    }

    await this.sendOTP(mobileNumber, "coach_login");
    
    return { 
      message: "OTP sent to your mobile number",
      requiresOTP: true,
      mobileNumber
    };
  }

  // Coach OTP verification
  static async verifyCoachOTP(mobileNumber: string, otp: string) {
    const isValidOTP = await this.verifyOTP(mobileNumber, otp, "coach_login");
    if (!isValidOTP) {
      throw new Error("Invalid or expired OTP");
    }

    const [user] = await db.select().from(users).where(
      and(eq(users.mobileNumber, mobileNumber), eq(users.role, "coach"))
    );

    if (!user) {
      throw new Error("Coach not found");
    }

    return user;
  }

  // Send OTP to mobile number
  static async sendOTP(phoneNumber: string, purpose: "admin_login" | "coach_login") {
    // Clean up expired OTPs
    await db.delete(otpVerifications).where(
      and(
        eq(otpVerifications.phoneNumber, phoneNumber),
        eq(otpVerifications.purpose, purpose)
      )
    );

    // Generate new OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Store OTP in database
    await db.insert(otpVerifications).values({
      phoneNumber,
      otp,
      purpose,
      expiresAt,
      isUsed: false,
    });

    // Send SMS
    const message = formatOTPMessage(otp, purpose);
    const result = await sendSMS(phoneNumber, message);

    // Always log OTP to console for testing
    console.log(`🔑 ${purpose.toUpperCase()} OTP: ${otp} (for ${phoneNumber})`);

    if (!result.success) {
      throw new Error(`Failed to send OTP: ${result.error}`);
    }

    return { message: "OTP sent successfully" };
  }

  // Verify OTP
  static async verifyOTP(phoneNumber: string, otp: string, purpose: "admin_login" | "coach_login"): Promise<boolean> {
    const [storedOTP] = await db.select().from(otpVerifications).where(
      and(
        eq(otpVerifications.phoneNumber, phoneNumber),
        eq(otpVerifications.otp, otp),
        eq(otpVerifications.purpose, purpose),
        eq(otpVerifications.isUsed, false),
        gt(otpVerifications.expiresAt, new Date())
      )
    );

    if (!storedOTP) {
      return false;
    }

    // Mark OTP as used
    await db.update(otpVerifications)
      .set({ isUsed: true })
      .where(eq(otpVerifications.id, storedOTP.id));

    return true;
  }

  // Resend OTP
  static async resendOTP(phoneNumber: string, purpose: "admin_login" | "coach_login") {
    // Check if user exists
    const [user] = await db.select().from(users).where(
      and(
        eq(users.mobileNumber, phoneNumber),
        eq(users.role, purpose === "admin_login" ? "admin" : "coach")
      )
    );

    if (!user) {
      throw new Error("User not found with this mobile number");
    }

    // Check rate limiting (prevent spam)
    const recentOTP = await db.select().from(otpVerifications).where(
      and(
        eq(otpVerifications.phoneNumber, phoneNumber),
        eq(otpVerifications.purpose, purpose),
        gt(otpVerifications.createdAt, new Date(Date.now() - 1 * 60 * 1000)) // 1 minute
      )
    );

    if (recentOTP.length > 0) {
      throw new Error("Please wait 1 minute before requesting a new OTP");
    }

    return await this.sendOTP(phoneNumber, purpose);
  }

  // Create admin user
  static async createAdmin(userData: Omit<InsertUser, "role">) {
    const hashedPassword = await bcrypt.hash(userData.password!, 10);
    
    const [user] = await db.insert(users).values({
      ...userData,
      password: hashedPassword,
      role: "admin",
    }).returning();

    return user;
  }

  // Create coach user
  static async createCoach(userData: Omit<InsertUser, "role" | "password">) {
    const [user] = await db.insert(users).values({
      ...userData,
      role: "coach",
    }).returning();

    return user;
  }

  // Create default admin user (used during app initialization)
  static async createDefaultAdmin() {
    try {
      // Check if admin already exists
      const [existingAdmin] = await db.select().from(users).where(
        and(eq(users.email, "admin@ievolve.com"), eq(users.role, "admin"))
      );

      if (existingAdmin) {
        return existingAdmin;
      }

      // Create default admin with secure password and mobile number for 2FA
      const hashedPassword = await bcrypt.hash("IevolveAdmin2025!", 10);
      
      const [admin] = await db.insert(users).values({
        email: "admin@ievolve.com",
        password: hashedPassword,
        mobileNumber: "+918888888888", // Default admin mobile for 2FA
        name: "System Admin",
        role: "admin",
        isActive: true,
      }).returning();

      console.log("✅ Default admin created successfully");
      return admin;
    } catch (error) {
      console.log("⚠️  Default admin already exists or creation failed:", error);
      return null;
    }
  }
}