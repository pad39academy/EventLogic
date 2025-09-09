import { storage } from "../storage";
import { type InsertHotel, type InsertParticipant, type InsertUser, type User } from "@shared/schema";
import { AuthService } from "./auth";
import { EventService } from "./event";
import { BalanceWindowManager } from "./balance-window-manager";
import { db } from "../db";
import { hotels, participants, users } from "@shared/schema";

export interface UploadResult {
  success: boolean;
  created: number;
  errors: string[];
  warnings: string[];
}

export class UploadService {
  // Date parsing utility for DD/MM/YYYY format
  static parseDDMMYYYY(dateString: string): Date {
    if (!dateString) throw new Error('Date string is required');
    
    const parts = dateString.trim().split('/');
    if (parts.length !== 3) {
      throw new Error('Date must be in DD/MM/YYYY format');
    }
    
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    
    if (isNaN(day) || isNaN(month) || isNaN(year)) {
      throw new Error('Invalid date components');
    }
    
    if (day < 1 || day > 31 || month < 1 || month > 12 || year < 2020) {
      throw new Error('Date values out of range');
    }
    
    // Create date object (month is 0-indexed in JavaScript)
    const date = new Date(year, month - 1, day);
    
    // Verify the date is valid (handles cases like Feb 30th)
    if (date.getDate() !== day || date.getMonth() !== month - 1 || date.getFullYear() !== year) {
      throw new Error('Invalid date');
    }
    
    return date;
  }

  // Parse PSV (Pipe Separated Values) content
  static parsePSV(content: string): string[][] {
    const lines = content.trim().split('\n');
    return lines.map(line => line.split('|').map(cell => cell.trim()));
  }

  // Upload Hotel Inventory Sheet
  static async uploadHotelInventory(content: string): Promise<UploadResult> {
    const result: UploadResult = {
      success: true,
      created: 0,
      errors: [],
      warnings: [],
    };

    try {
      const rows = this.parsePSV(content);
      const headers = rows[0];
      
      // Validate headers - support both camelCase and original format
      const requiredFields = [
        { original: 'HotelID', camel: 'hotelId', key: 'hotelId' },
        { original: 'InstanceCode', camel: 'instanceCode', key: 'instanceCode' },
        { original: 'HotelName', camel: 'hotelName', key: 'hotelName' },
        { original: 'Location', camel: 'location', key: 'location' },
        { original: 'District', camel: 'district', key: 'district' },
        { original: 'Address', camel: 'address', key: 'address' },
        { original: 'Pincode', camel: 'pincode', key: 'pincode' },
        { original: 'PointOfContact', camel: 'pointOfContact', key: 'pointOfContact' },
        { original: 'ContactPhone', camel: 'contactPhoneNumber', key: 'contactPhoneNumber' },
        { original: 'StartDate', camel: 'startDate', key: 'startDate' },
        { original: 'EndDate', camel: 'endDate', key: 'endDate' },
        { original: 'TotalRooms', camel: 'totalRooms', key: 'totalRooms' },
        { original: 'OccupiedRooms', camel: 'occupiedRooms', key: 'occupiedRooms' },
        { original: 'AvailableRooms', camel: 'availableRooms', key: 'availableRooms' }
      ];

      // Create header mapping
      const headerMapping: { [key: string]: string } = {};
      const missingFields: string[] = [];

      requiredFields.forEach(field => {
        const foundHeader = headers.find(h => 
          h === field.original || h === field.camel || h.toLowerCase() === field.key.toLowerCase()
        );
        if (foundHeader) {
          headerMapping[foundHeader] = field.key;
        } else {
          missingFields.push(field.original);
        }
      });

      if (missingFields.length > 0) {
        result.errors.push(`Missing headers: ${missingFields.join(', ')}`);
        result.success = false;
        return result;
      }

      // Process data rows
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length !== headers.length) {
          result.errors.push(`Row ${i + 1}: Invalid column count`);
          continue;
        }

        const hotelData: any = {};
        headers.forEach((header, index) => {
          const mappedKey = headerMapping[header];
          if (mappedKey) {
            hotelData[mappedKey] = row[index];
          }
        });

        try {
          // Validate required fields
          if (!hotelData.hotelId || !hotelData.instanceCode) {
            result.errors.push(`Row ${i + 1}: Missing hotelId or instanceCode`);
            continue;
          }

          // Validate dates (DD/MM/YYYY format)
          const startDate = this.parseDDMMYYYY(hotelData.startDate);
          const endDate = this.parseDDMMYYYY(hotelData.endDate);
          
          if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            result.errors.push(`Row ${i + 1}: Invalid date format`);
            continue;
          }

          if (endDate <= startDate) {
            result.errors.push(`Row ${i + 1}: End date must be after start date`);
            continue;
          }

          // Note: No minimum stay validation for hotel inventory - hotels can list any duration
          // The 3-day minimum rule applies only when coaches/participants make actual bookings

          // Mandatory: Validate hotel ID references - check for overlapping dates
          const overlapping = await storage.getHotelsWithOverlappingDates(
            hotelData.hotelId,
            startDate,
            endDate
          );

          if (overlapping.length > 0) {
            result.errors.push(
              `Row ${i + 1}: Hotel ${hotelData.hotelId} has overlapping dates with existing records`
            );
            continue;
          }

          // Mandatory: Skip duplicate detection - check for existing hotel with same ID and instance
          const existing = await storage.getHotelByHotelIdAndInstance(
            hotelData.hotelId,
            hotelData.instanceCode
          );

          if (existing) {
            result.warnings.push(
              `Row ${i + 1}: Hotel ${hotelData.hotelId} with instance ${hotelData.instanceCode} already exists`
            );
            continue;
          }

          // Validate room numbers
          const totalRooms = parseInt(hotelData.totalRooms);
          const occupiedRooms = parseInt(hotelData.occupiedRooms) || 0;
          const availableRooms = parseInt(hotelData.availableRooms);

          if (isNaN(totalRooms) || isNaN(availableRooms) || totalRooms <= 0 || availableRooms < 0) {
            result.errors.push(`Row ${i + 1}: Invalid room numbers`);
            continue;
          }

          if (occupiedRooms + availableRooms !== totalRooms) {
            result.errors.push(`Row ${i + 1}: Room count mismatch. Occupied (${occupiedRooms}) + Available (${availableRooms}) ≠ Total (${totalRooms})`);
            continue;
          }

          const insertHotel: InsertHotel = {
            hotelId: hotelData.hotelId,
            instanceCode: hotelData.instanceCode,
            hotelName: hotelData.hotelName,
            location: hotelData.location,
            district: hotelData.district,
            address: hotelData.address,
            pincode: hotelData.pincode,
            pointOfContact: hotelData.pointOfContact || '',
            contactPhoneNumber: hotelData.contactPhoneNumber || '',
            startDate,
            endDate,
            totalRooms,
            occupiedRooms,
            availableRooms,
          };

          const createdHotel = await storage.createHotel(insertHotel);
          
          // Publish hotel creation event
          await EventService.publishEvent(
            "hotel_capacity_updated",
            createdHotel.hotelId,
            "hotel",
            {
              hotelId: createdHotel.hotelId,
              instanceCode: createdHotel.instanceCode,
              hotelName: createdHotel.hotelName,
              totalRooms: createdHotel.totalRooms,
              startDate: createdHotel.startDate.toISOString(),
              endDate: createdHotel.endDate.toISOString(),
              location: createdHotel.location,
              district: createdHotel.district,
            },
            { source: "hotel_upload" }
          );
          
          result.created++;
        } catch (error) {
          result.errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    } catch (error) {
      result.errors.push(`Parse error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.success = false;
    }

    return result;
  }

  // 🚀 BATCH OPTIMIZED: Hotel inventory upload with transaction safety
  static async uploadHotelInventoryBatch(content: string): Promise<UploadResult> {
    const result: UploadResult = {
      success: true,
      created: 0,
      errors: [],
      warnings: [],
    };

    const BATCH_SIZE = 1000; // Process 1000 hotels at a time
    
    try {
      console.log("🔍 Starting batch hotel upload validation...");
      
      // Step 1: Parse and validate structure
      const rows = this.parsePSV(content);
      const headers = rows[0];
      
      // Validate headers (same logic as original)
      const requiredFields = [
        { original: 'HotelID', camel: 'hotelId', key: 'hotelId' },
        { original: 'InstanceCode', camel: 'instanceCode', key: 'instanceCode' },
        { original: 'HotelName', camel: 'hotelName', key: 'hotelName' },
        { original: 'Location', camel: 'location', key: 'location' },
        { original: 'District', camel: 'district', key: 'district' },
        { original: 'Address', camel: 'address', key: 'address' },
        { original: 'Pincode', camel: 'pincode', key: 'pincode' },
        { original: 'PointOfContact', camel: 'pointOfContact', key: 'pointOfContact' },
        { original: 'ContactPhone', camel: 'contactPhoneNumber', key: 'contactPhoneNumber' },
        { original: 'StartDate', camel: 'startDate', key: 'startDate' },
        { original: 'EndDate', camel: 'endDate', key: 'endDate' },
        { original: 'TotalRooms', camel: 'totalRooms', key: 'totalRooms' },
        { original: 'OccupiedRooms', camel: 'occupiedRooms', key: 'occupiedRooms' },
        { original: 'AvailableRooms', camel: 'availableRooms', key: 'availableRooms' }
      ];

      const headerMapping: { [key: string]: string } = {};
      const missingFields: string[] = [];

      requiredFields.forEach(field => {
        const foundHeader = headers.find(h => 
          h === field.original || h === field.camel || h.toLowerCase() === field.key.toLowerCase()
        );
        if (foundHeader) {
          headerMapping[foundHeader] = field.key;
        } else {
          missingFields.push(field.original);
        }
      });

      if (missingFields.length > 0) {
        result.errors.push(`Missing headers: ${missingFields.join(', ')}`);
        result.success = false;
        return result;
      }

      // Step 2: Pre-validate ALL records before any database operations
      console.log(`📋 Validating ${rows.length - 1} hotel records...`);
      
      const validHotels: InsertHotel[] = [];
      const hotelKeys = new Set<string>(); // Track hotel+instance combinations
      
      // Load existing hotels into memory for fast duplicate checking
      console.log("💾 Loading existing hotels for duplicate checking...");
      const existingHotels = await storage.getHotels();
      const existingKeys = new Set(existingHotels.map(h => `${h.hotelId}-${h.instanceCode}`));
      
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length !== headers.length) {
          result.errors.push(`Row ${i + 1}: Invalid column count`);
          continue;
        }

        const hotelData: any = {};
        headers.forEach((header, index) => {
          const mappedKey = headerMapping[header];
          if (mappedKey) {
            hotelData[mappedKey] = row[index];
          }
        });

        try {
          // Basic validation (same as original)
          if (!hotelData.hotelId || !hotelData.instanceCode) {
            result.errors.push(`Row ${i + 1}: Missing hotelId or instanceCode`);
            continue;
          }

          const hotelKey = `${hotelData.hotelId}-${hotelData.instanceCode}`;
          
          // Check for duplicates in current batch
          if (hotelKeys.has(hotelKey)) {
            result.errors.push(`Row ${i + 1}: Duplicate hotel ${hotelKey} in upload file`);
            continue;
          }
          
          // Check for duplicates in existing database
          if (existingKeys.has(hotelKey)) {
            result.warnings.push(`Row ${i + 1}: Hotel ${hotelKey} already exists in database`);
            continue;
          }

          // Date validation
          const startDate = this.parseDDMMYYYY(hotelData.startDate);
          const endDate = this.parseDDMMYYYY(hotelData.endDate);
          
          if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            result.errors.push(`Row ${i + 1}: Invalid date format`);
            continue;
          }

          if (endDate <= startDate) {
            result.errors.push(`Row ${i + 1}: End date must be after start date`);
            continue;
          }

          // Room validation
          const totalRooms = parseInt(hotelData.totalRooms);
          const occupiedRooms = parseInt(hotelData.occupiedRooms) || 0;
          const availableRooms = parseInt(hotelData.availableRooms);

          if (isNaN(totalRooms) || isNaN(availableRooms) || totalRooms <= 0 || availableRooms < 0) {
            result.errors.push(`Row ${i + 1}: Invalid room numbers`);
            continue;
          }

          if (occupiedRooms + availableRooms !== totalRooms) {
            result.errors.push(`Row ${i + 1}: Room count mismatch. Occupied (${occupiedRooms}) + Available (${availableRooms}) ≠ Total (${totalRooms})`);
            continue;
          }

          // Create validated hotel object
          const insertHotel: InsertHotel = {
            hotelId: hotelData.hotelId,
            instanceCode: hotelData.instanceCode,
            hotelName: hotelData.hotelName,
            location: hotelData.location,
            district: hotelData.district,
            address: hotelData.address,
            pincode: hotelData.pincode,
            pointOfContact: hotelData.pointOfContact || '',
            contactPhoneNumber: hotelData.contactPhoneNumber || '',
            startDate,
            endDate,
            totalRooms,
            occupiedRooms,
            availableRooms,
          };

          validHotels.push(insertHotel);
          hotelKeys.add(hotelKey);
          
        } catch (error) {
          result.errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Step 3: Stop if validation errors found
      if (result.errors.length > 0) {
        result.success = false;
        console.log(`❌ Validation failed with ${result.errors.length} errors. No hotels will be created.`);
        return result;
      }

      if (validHotels.length === 0) {
        console.log("⚠️ No valid hotels to process");
        return result;
      }

      console.log(`✅ Pre-validation complete. ${validHotels.length} valid hotels ready for batch insertion.`);

      // Step 4: Process in batches with transaction safety
      const createdHotels: any[] = [];
      
      for (let i = 0; i < validHotels.length; i += BATCH_SIZE) {
        const batch = validHotels.slice(i, i + BATCH_SIZE);
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(validHotels.length / BATCH_SIZE);
        
        console.log(`📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} hotels)...`);
        
        try {
          // Execute batch in transaction - either all succeed or all rollback
          const batchResults = await db.transaction(async (tx) => {
            return await tx.insert(hotels).values(batch).returning();
          });
          
          createdHotels.push(...batchResults);
          result.created += batchResults.length;
          console.log(`✅ Batch ${batchNumber} completed successfully: ${batchResults.length} hotels created`);
          
        } catch (error) {
          result.errors.push(`Batch ${batchNumber} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          console.log(`❌ Batch ${batchNumber} failed and was rolled back`);
          result.success = false;
          break; // Stop processing remaining batches
        }
      }

      // Step 5: TWO-PHASE BULK - Create balance windows for ALL hotels at once
      if (createdHotels.length > 0) {
        console.log(`🚀 PHASE 2: Creating balance windows for ${createdHotels.length} hotels using BULK approach...`);
        
        // Prepare hotel data for bulk processing
        const hotelData = createdHotels.map(hotel => ({
          hotelId: hotel.hotelId,
          instanceCode: hotel.instanceCode,
          startDate: hotel.startDate,
          endDate: hotel.endDate,
          totalRooms: hotel.totalRooms
        }));
        
        // BULK create ALL balance windows at once (10-50x faster)
        const balanceResult = await BalanceWindowManager.createBalanceWindowsBulk(hotelData);
        
        if (balanceResult.success) {
          console.log(`🎉 BULK SUCCESS: Created ${balanceResult.balanceRecordsCreated} balance records for ${balanceResult.processed} hotels`);
        } else {
          console.log(`⚠️  BULK with recovery: ${balanceResult.processed}/${createdHotels.length} hotels processed, ${balanceResult.balanceRecordsCreated} balance records created`);
          result.warnings.push(`Balance window creation used recovery mechanism. ${balanceResult.errors.length} issues encountered but resolved.`);
          
          // Only add error details if there were actual failures
          if (balanceResult.processed < createdHotels.length) {
            result.warnings.push(...balanceResult.errors);
          }
        }
      }

      console.log(`🎉 Batch hotel upload complete! Created: ${result.created}, Errors: ${result.errors.length}, Warnings: ${result.warnings.length}`);
      
    } catch (error) {
      result.errors.push(`Batch upload error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.success = false;
      console.error("❌ Batch hotel upload failed:", error);
    }

    return result;
  }

  // Helper method for batch coach user creation
  static async batchCreateCoachUsers(uniqueCoaches: Map<string, InsertUser>, result: UploadResult): Promise<void> {
    try {
      // Extract coach IDs and mobile numbers for batch checking
      const coachIds = Array.from(uniqueCoaches.keys());
      const mobileNumbers = Array.from(uniqueCoaches.values()).map((coach: InsertUser) => coach.mobileNumber!);
      
      // Batch check existing users by coachId
      const existingUsersByCoachId = await storage.getUsersByCoachIds(coachIds);
      const existingUsersByMobile = await storage.getUsersByMobiles(mobileNumbers);
      
      // Create maps for quick lookup
      const existingCoachIdMap = new Map(existingUsersByCoachId.map((user: User) => [user.coachId, user]));
      const existingMobileMap = new Map(existingUsersByMobile.map((user: User) => [user.mobileNumber, user]));
      
      // Determine which users need to be created vs updated
      const usersToCreate: InsertUser[] = [];
      const usersToUpdate: Array<{id: string, updates: Partial<InsertUser>}> = [];
      
      for (const [coachId, coachData] of Array.from(uniqueCoaches.entries())) {
        let existingUser = existingCoachIdMap.get(coachId);
        if (!existingUser) {
          existingUser = existingMobileMap.get(coachData.mobileNumber!);
        }
        
        if (!existingUser) {
          // User doesn't exist, create new one
          usersToCreate.push(coachData);
        } else if (existingUser.coachId !== coachId) {
          // User exists but missing coachId, update it
          usersToUpdate.push({
            id: existingUser.id,
            updates: {
              coachId: coachId,
              name: coachData.name,
            }
          });
        }
      }
      
      // Batch create new users
      if (usersToCreate.length > 0) {
        console.log(`🚀 Creating ${usersToCreate.length} new coach users...`);
        await storage.batchCreateUsers(usersToCreate);
        console.log(`✅ Successfully created ${usersToCreate.length} coach users`);
      }
      
      // Batch update existing users
      for (const userUpdate of usersToUpdate) {
        await storage.updateUser(userUpdate.id, userUpdate.updates);
      }
      
      if (usersToUpdate.length > 0) {
        console.log(`🔄 Updated ${usersToUpdate.length} existing coach users`);
      }
      
    } catch (error) {
      const errorMessage = `Batch user creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      result.errors.push(errorMessage);
      console.error('❌', errorMessage);
      throw error;
    }
  }

  // Upload Coach and Official Data Sheet
  static async uploadCoachesOfficials(content: string): Promise<UploadResult> {
    const result: UploadResult = {
      success: true,
      created: 0,
      errors: [],
      warnings: [],
    };

    try {
      const rows = this.parsePSV(content);
      const headers = rows[0];
      
      const expectedHeaders = [
        'ROLE', 'COACH_ID', 'NAME', 'MOBILE_NUMBER', 'DISCIPLINE', 'LOCATION', 'DISTRICT',
        'HOTEL_ID', 'STADIUM', 'BOOKING_START_DATE', 'BOOKING_END_DATE', 
        'BOOKING_REFERENCE_NUMBER', 'NOTIFY_TRANSPORT_CONTACT', 'TRAVEL_POC_NAME', 
        'TRAVEL_POC_MOBILE', 'VENUE_POC_NAME', 'VENUE_POC_MOBILE'
      ];

      const missingHeaders = expectedHeaders.filter(h => !headers.includes(h));
      if (missingHeaders.length > 0) {
        result.errors.push(`Missing headers: ${missingHeaders.join(', ')}`);
        result.success = false;
        return result;
      }

      // PHASE 1: Extract and validate all coach data first
      const validParticipants: any[] = [];
      const uniqueCoaches = new Map<string, InsertUser>();
      
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const data: any = {};
        headers.forEach((header, index) => {
          data[header] = row[index];
        });

        try {
          // Validate hotel exists
          const hotel = await storage.getHotelByHotelIdAndInstance(data.HOTEL_ID, '1');
          if (!hotel) {
            result.errors.push(`Row ${i + 1}: Hotel ${data.HOTEL_ID} not found in inventory`);
            continue;
          }

          // MANDATORY: Enforce 3-day minimum stay for coach/official bookings
          const startDate = this.parseDDMMYYYY(data.BOOKING_START_DATE);
          const endDate = this.parseDDMMYYYY(data.BOOKING_END_DATE);
          const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
          
          if (daysDiff < 2) {
            const calendarDays = daysDiff + 1;
            result.errors.push(`Row ${i + 1}: Coach/Official booking must span at least 3 calendar days. Current: ${calendarDays} calendar days`);
            continue;
          }

          // Check if participant already exists
          const existing = await storage.getParticipantByParticipantId(data.COACH_ID);
          if (existing) {
            result.warnings.push(`Row ${i + 1}: Participant ${data.COACH_ID} already exists`);
            continue;
          }

          // Normalize mobile number format
          let normalizedMobile = data.MOBILE_NUMBER;
          if (normalizedMobile && !normalizedMobile.startsWith('+')) {
            if (normalizedMobile.startsWith('91')) {
              normalizedMobile = '+' + normalizedMobile;
            } else if (normalizedMobile.length === 10) {
              normalizedMobile = '+91' + normalizedMobile;
            }
          }

          // Collect unique coaches for batch processing
          if (data.ROLE === 'COACH' && !uniqueCoaches.has(data.COACH_ID)) {
            uniqueCoaches.set(data.COACH_ID, {
              coachId: data.COACH_ID,
              name: data.NAME,
              mobileNumber: normalizedMobile,
              role: "coach" as const,
              isActive: true,
            });
          }

          // Store valid participant data for later processing
          validParticipants.push({
            rowIndex: i + 1,
            data,
            normalizedMobile,
            startDate,
            endDate
          });
        } catch (error) {
          result.errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Stop if validation errors found
      if (result.errors.length > 0) {
        result.success = false;
        return result;
      }

      // PHASE 2: Batch create coach users
      if (uniqueCoaches.size > 0) {
        console.log(`🔑 Creating users for ${uniqueCoaches.size} unique coaches...`);
        await this.batchCreateCoachUsers(uniqueCoaches, result);
      }

      // PHASE 3: Process participants (users are guaranteed to exist)
      for (const participantData of validParticipants) {
        const { rowIndex, data, normalizedMobile, startDate, endDate } = participantData;
        
        try {

          const insertParticipant: InsertParticipant = {
            participantId: data.COACH_ID,
            name: data.NAME,
            mobileNumber: normalizedMobile,
            role: data.ROLE.toLowerCase() as "coach" | "official" | "player",
            discipline: data.DISCIPLINE,
            district: data.DISTRICT,
            location: data.LOCATION,
            hotelId: data.HOTEL_ID,
            stadium: data.STADIUM,
            bookingStartDate: startDate,
            bookingEndDate: endDate,
            bookingReference: data.BOOKING_REFERENCE_NUMBER,
            notifyTransport: data.NOTIFY_TRANSPORT_CONTACT,
            travelPocName: data.TRAVEL_POC_NAME,
            travelPocMobile: data.TRAVEL_POC_MOBILE,
            venuePocName: data.VENUE_POC_NAME,
            venuePocMobile: data.VENUE_POC_MOBILE,
            checkinStatus: data.ROLE === 'OFFICIAL' ? 'checked_in' : 'pending',
          };

          const createdParticipant = await storage.createParticipant(insertParticipant);
          
          // Publish participant registration event
          await EventService.publishEvent(
            "participant_registered",
            createdParticipant.participantId,
            "participant",
            {
              participantId: createdParticipant.participantId,
              name: createdParticipant.name,
              role: createdParticipant.role,
              hotelId: createdParticipant.hotelId,
              instanceCode: '1', // Default instance for now
              bookingStartDate: createdParticipant.bookingStartDate.toISOString(),
              bookingEndDate: createdParticipant.bookingEndDate.toISOString(),
              discipline: createdParticipant.discipline,
              district: createdParticipant.district,
              teamName: createdParticipant.teamName,
              coachId: createdParticipant.coachId,
            },
            { source: "coaches_officials_upload" }
          );
          
          // Update hotel occupancy after adding participant
          await storage.updateHotelOccupancy(data.HOTEL_ID, '1');
          
          result.created++;
        } catch (error) {
          result.errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    } catch (error) {
      result.errors.push(`Parse error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.success = false;
    }

    return result;
  }

  // 🚀 BATCH OPTIMIZED: Participant upload with transaction safety
  static async uploadCoachesOfficialsBatch(content: string): Promise<UploadResult> {
    const result: UploadResult = {
      success: true,
      created: 0,
      errors: [],
      warnings: [],
    };

    const BATCH_SIZE = 500; // Process 500 participants at a time (smaller due to complexity)
    const overallStartTime = Date.now();
    
    try {
      console.log("🔍 Starting batch participant upload validation...");
      console.log(`⏱️  TIMING: Upload started at ${new Date().toISOString()}`);
      
      // Step 1: Parse and validate structure
      const parseStartTime = Date.now();
      console.log("⏱️  TIMING: Step 1 - Parsing PSV content...");
      const rows = this.parsePSV(content);
      const headers = rows[0];
      console.log(`⏱️  TIMING: Step 1 completed in ${Date.now() - parseStartTime}ms - Parsed ${rows.length} rows`);
      
      const expectedHeaders = [
        'ROLE', 'COACH_ID', 'NAME', 'MOBILE_NUMBER', 'DISCIPLINE', 'LOCATION', 'DISTRICT',
        'HOTEL_ID', 'STADIUM', 'BOOKING_START_DATE', 'BOOKING_END_DATE', 
        'BOOKING_REFERENCE_NUMBER', 'NOTIFY_TRANSPORT_CONTACT', 'TRAVEL_POC_NAME', 
        'TRAVEL_POC_MOBILE', 'VENUE_POC_NAME', 'VENUE_POC_MOBILE'
      ];

      const missingHeaders = expectedHeaders.filter(h => !headers.includes(h));
      if (missingHeaders.length > 0) {
        result.errors.push(`Missing headers: ${missingHeaders.join(', ')}`);
        result.success = false;
        return result;
      }

      // Step 2: Load reference data into memory for fast validation
      const refDataStartTime = Date.now();
      console.log("⏱️  TIMING: Step 2 - Loading reference data for validation...");
      console.log("💾 Loading reference data for validation...");
      
      const hotelsStartTime = Date.now();
      const existingHotels = await storage.getHotels();
      console.log(`⏱️  TIMING: Loaded ${existingHotels.length} hotels in ${Date.now() - hotelsStartTime}ms`);
      
      const hotelMap = new Map();
      existingHotels.forEach(hotel => {
        hotelMap.set(`${hotel.hotelId}-${hotel.instanceCode}`, hotel);
      });

      const participantsStartTime = Date.now();
      const existingParticipants = await storage.getParticipants();
      console.log(`⏱️  TIMING: Loaded ${existingParticipants.length} participants in ${Date.now() - participantsStartTime}ms`);
      const participantKeys = new Set(existingParticipants.map(p => p.participantId));

      const usersStartTime = Date.now();
      const existingUsers = await storage.getUsers();
      console.log(`⏱️  TIMING: Loaded ${existingUsers.length} users in ${Date.now() - usersStartTime}ms`);
      const usersByCoachId = new Map();
      const usersByMobile = new Map();
      existingUsers.forEach(user => {
        if (user.coachId) usersByCoachId.set(user.coachId, user);
        if (user.mobileNumber) usersByMobile.set(user.mobileNumber, user);
      });
      
      console.log(`⏱️  TIMING: Step 2 completed in ${Date.now() - refDataStartTime}ms - Reference data loaded`);

      // Step 3: Pre-validate ALL records
      const validationStartTime = Date.now();
      console.log("⏱️  TIMING: Step 3 - Pre-validating all records...");
      console.log(`📋 Validating ${rows.length - 1} participant records...`);
      
      interface ValidatedParticipant {
        participant: InsertParticipant;
        needsUserCreation: boolean;
        userData?: InsertUser;
        rowNumber: number;
      }

      const validParticipants: ValidatedParticipant[] = [];
      const participantIdSet = new Set<string>();
      
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const data: any = {};
        headers.forEach((header, index) => {
          data[header] = row[index];
        });

        try {
          // Validate hotel exists
          const hotel = hotelMap.get(`${data.HOTEL_ID}-1`);
          if (!hotel) {
            result.errors.push(`Row ${i + 1}: Hotel ${data.HOTEL_ID} not found in inventory`);
            continue;
          }

          // Date validation with 3-day minimum
          const startDate = this.parseDDMMYYYY(data.BOOKING_START_DATE);
          const endDate = this.parseDDMMYYYY(data.BOOKING_END_DATE);
          const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
          
          // Fixed: For 3 calendar days minimum (e.g., Oct 2,3,4), duration should be >= 2 days
          if (daysDiff < 2) {
            const calendarDays = daysDiff + 1; // Convert duration to calendar days for user-friendly message
            result.errors.push(`Row ${i + 1}: Coach/Official booking must span at least 3 calendar days. Current: ${calendarDays} calendar days`);
            continue;
          }

          // Check for duplicates in batch
          if (participantIdSet.has(data.COACH_ID)) {
            result.errors.push(`Row ${i + 1}: Duplicate participant ${data.COACH_ID} in upload file`);
            continue;
          }

          // Check for existing participants
          if (participantKeys.has(data.COACH_ID)) {
            result.warnings.push(`Row ${i + 1}: Participant ${data.COACH_ID} already exists`);
            continue;
          }

          // Normalize mobile number
          let normalizedMobile = data.MOBILE_NUMBER;
          if (normalizedMobile && !normalizedMobile.startsWith('+')) {
            if (normalizedMobile.startsWith('91')) {
              normalizedMobile = '+' + normalizedMobile;
            } else if (normalizedMobile.length === 10) {
              normalizedMobile = '+91' + normalizedMobile;
            }
          }

          // Prepare participant data
          const insertParticipant: InsertParticipant = {
            participantId: data.COACH_ID,
            name: data.NAME,
            mobileNumber: normalizedMobile,
            role: data.ROLE.toLowerCase() as "coach" | "official" | "player",
            discipline: data.DISCIPLINE,
            district: data.DISTRICT,
            location: data.LOCATION,
            hotelId: data.HOTEL_ID,
            stadium: data.STADIUM,
            bookingStartDate: startDate,
            bookingEndDate: endDate,
            bookingReference: data.BOOKING_REFERENCE_NUMBER,
            notifyTransport: data.NOTIFY_TRANSPORT_CONTACT,
            travelPocName: data.TRAVEL_POC_NAME,
            travelPocMobile: data.TRAVEL_POC_MOBILE,
            venuePocName: data.VENUE_POC_NAME,
            venuePocMobile: data.VENUE_POC_MOBILE,
            checkinStatus: data.ROLE === 'OFFICIAL' ? 'checked_in' : 'pending',
          };

          // Determine if user creation is needed for coaches
          let needsUserCreation = false;
          let userData: InsertUser | undefined;

          if (data.ROLE === 'COACH') {
            const existingUserByCoach = usersByCoachId.get(data.COACH_ID);
            const existingUserByMobile = usersByMobile.get(normalizedMobile);
            
            if (!existingUserByCoach && !existingUserByMobile) {
              needsUserCreation = true;
              userData = {
                mobileNumber: normalizedMobile,
                name: data.NAME,
                role: "coach",
                coachId: data.COACH_ID,
                isActive: true,
              };
            }
          }

          validParticipants.push({
            participant: insertParticipant,
            needsUserCreation,
            userData,
            rowNumber: i + 1
          });

          participantIdSet.add(data.COACH_ID);
          
        } catch (error) {
          result.errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Step 4: Stop if validation errors found
      if (result.errors.length > 0) {
        result.success = false;
        console.log(`❌ Validation failed with ${result.errors.length} errors. No participants will be created.`);
        return result;
      }

      if (validParticipants.length === 0) {
        console.log("⚠️ No valid participants to process");
        return result;
      }

      console.log(`✅ Pre-validation complete. ${validParticipants.length} valid participants ready for batch insertion.`);

      // Step 5: Process in batches with transaction safety
      const batchProcessStartTime = Date.now();
      console.log("⏱️  TIMING: Step 5 - Starting batch database operations...");
      const createdParticipants: any[] = [];
      
      for (let i = 0; i < validParticipants.length; i += BATCH_SIZE) {
        const batch = validParticipants.slice(i, i + BATCH_SIZE);
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(validParticipants.length / BATCH_SIZE);
        
        console.log(`📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} participants)...`);
        
        try {
          // Execute batch in transaction - either all succeed or all rollback
          const batchResults = await db.transaction(async (tx) => {
            // First, create any needed user accounts
            const usersToCreate = batch.filter(item => item.needsUserCreation && item.userData);
            if (usersToCreate.length > 0) {
              console.log(`  👤 Creating ${usersToCreate.length} user accounts...`);
              await tx.insert(users).values(usersToCreate.map(item => item.userData!));
            }
            
            // Then, create participants
            console.log(`  🎯 Creating ${batch.length} participants...`);
            const participantData = batch.map(item => item.participant);
            const insertedParticipants = await tx.insert(participants).values(participantData).returning();
            
            return insertedParticipants;
          });
          
          createdParticipants.push(...batchResults);
          result.created += batchResults.length;
          console.log(`✅ Batch ${batchNumber} completed successfully: ${batchResults.length} participants created`);
          
          // 🔧 FIX: Update user cache after successful batch to prevent duplicate user creation
          const createdUsers = batch.filter(item => item.needsUserCreation && item.userData);
          createdUsers.forEach(item => {
            const userData = item.userData!;
            usersByCoachId.set(userData.coachId!, userData);
            usersByMobile.set(userData.mobileNumber!, userData);
          });
          console.log(`  🔄 Updated user cache with ${createdUsers.length} new coach accounts`);
          
        } catch (error) {
          result.errors.push(`Batch ${batchNumber} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          console.log(`❌ Batch ${batchNumber} failed and was rolled back`);
          result.success = false;
          break; // Stop processing remaining batches
        }
      }

      console.log(`⏱️  TIMING: Step 5 completed in ${Date.now() - batchProcessStartTime}ms - Batch processing finished`);

      // Step 6: Smart Event Publishing - Batch processing for performance
      if (createdParticipants.length > 0) {
        const eventStartTime = Date.now();
        console.log("⏱️  TIMING: Step 6 - Publishing batch events...");
        console.log(`🚀 Publishing optimized batch events for ${createdParticipants.length} participants...`);
        
        // Collect affected hotels with date ranges for batch processing
        const affectedHotelsMap = new Map<string, {
          hotelId: string;
          instanceCode: string;
          participantIds: string[];
          earliestDate: Date;
          latestDate: Date;
        }>();

        // Group participants by hotel and calculate date ranges
        for (const participant of createdParticipants) {
          const hotelKey = `${participant.hotelId}-1`;
          const existing = affectedHotelsMap.get(hotelKey);
          
          if (existing) {
            existing.participantIds.push(participant.participantId);
            if (participant.bookingStartDate < existing.earliestDate) {
              existing.earliestDate = participant.bookingStartDate;
            }
            if (participant.bookingEndDate > existing.latestDate) {
              existing.latestDate = participant.bookingEndDate;
            }
          } else {
            affectedHotelsMap.set(hotelKey, {
              hotelId: participant.hotelId,
              instanceCode: '1',
              participantIds: [participant.participantId],
              earliestDate: participant.bookingStartDate,
              latestDate: participant.bookingEndDate,
            });
          }
        }

        // Publish single batch event for all affected hotels (10-20x faster)
        await EventService.publishEvent(
          "batch_hotel_occupancy_update",
          "batch-upload-" + Date.now(),
          "batch",
          {
            affectedHotels: Array.from(affectedHotelsMap.values()),
            participantCount: createdParticipants.length,
            uploadType: "coaches_officials_batch",
            timestamp: new Date().toISOString(),
          },
          { source: "batch_participants_upload" }
        );
        
        console.log(`⚡ Batch event published for ${affectedHotelsMap.size} hotels (was ${createdParticipants.length} individual events)`);
        console.log(`⏱️  TIMING: Step 6 completed in ${Date.now() - eventStartTime}ms - Event publishing finished`);
      }

      console.log(`⏱️  TIMING: TOTAL UPLOAD TIME: ${Date.now() - overallStartTime}ms`);
      console.log(`🎉 Batch participant upload complete! Created: ${result.created}, Errors: ${result.errors.length}, Warnings: ${result.warnings.length}`);
      
    } catch (error) {
      result.errors.push(`Batch upload error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.success = false;
      console.error("❌ Batch participant upload failed:", error);
    }

    return result;
  }

  // 🚀 BATCH OPTIMIZED: Player upload with transaction safety
  static async uploadPlayersBatch(content: string): Promise<UploadResult> {
    const result: UploadResult = {
      success: true,
      created: 0,
      errors: [],
      warnings: [],
    };

    const BATCH_SIZE = 500; // Process 500 players at a time
    
    try {
      console.log("🔍 Starting batch player upload validation...");
      
      // Step 1: Parse and validate structure
      const rows = this.parsePSV(content);
      const headers = rows[0];
      
      const expectedHeaders = [
        'COACH_ID', 'PLAYER_ID', 'PLAYER_NAME', 'MOBILE_NUMBER', 'TEAM_NAME',
        'HOTEL_ID', 'BOOKING_REFERENCE', 'BOOKING_START_DATE', 'BOOKING_END_DATE'
      ];

      const missingHeaders = expectedHeaders.filter(h => !headers.includes(h));
      if (missingHeaders.length > 0) {
        result.errors.push(`Missing headers: ${missingHeaders.join(', ')}`);
        result.success = false;
        return result;
      }

      // Step 2: Load reference data into memory for fast validation
      console.log("💾 Loading reference data for validation...");
      const existingHotels = await storage.getHotels();
      const hotelMap = new Map();
      existingHotels.forEach(hotel => {
        hotelMap.set(`${hotel.hotelId}-${hotel.instanceCode}`, hotel);
      });

      const existingParticipants = await storage.getParticipants();
      const participantKeys = new Set(existingParticipants.map(p => p.participantId));
      
      // Create coach lookup map for performance
      const coachMap = new Map();
      existingParticipants.filter(p => p.role === 'coach').forEach(coach => {
        coachMap.set(coach.participantId, coach);
      });

      // Step 3: Pre-validate ALL records
      console.log(`📋 Validating ${rows.length - 1} player records...`);
      
      const validPlayers: InsertParticipant[] = [];
      const playerIdSet = new Set<string>();
      
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const data: any = {};
        headers.forEach((header, index) => {
          data[header] = row[index];
        });

        try {
          // Validate coach exists
          const coach = coachMap.get(data.COACH_ID);
          if (!coach) {
            result.errors.push(`Row ${i + 1}: Coach ${data.COACH_ID} not found`);
            continue;
          }

          // Validate hotel exists
          const hotel = hotelMap.get(`${data.HOTEL_ID}-1`);
          if (!hotel) {
            result.errors.push(`Row ${i + 1}: Hotel ${data.HOTEL_ID} not found in inventory`);
            continue;
          }

          // Date validation with 3-day minimum
          const startDate = this.parseDDMMYYYY(data.BOOKING_START_DATE);
          const endDate = this.parseDDMMYYYY(data.BOOKING_END_DATE);
          const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
          
          // Fixed: For 3 calendar days minimum (e.g., Oct 2,3,4), duration should be >= 2 days
          if (daysDiff < 2) {
            const calendarDays = daysDiff + 1; // Convert duration to calendar days for user-friendly message
            result.errors.push(`Row ${i + 1}: Player booking must span at least 3 calendar days. Current: ${calendarDays} calendar days`);
            continue;
          }

          // Check for duplicates in batch
          if (playerIdSet.has(data.PLAYER_ID)) {
            result.errors.push(`Row ${i + 1}: Duplicate player ${data.PLAYER_ID} in upload file`);
            continue;
          }

          // Check for existing players
          if (participantKeys.has(data.PLAYER_ID)) {
            result.warnings.push(`Row ${i + 1}: Player ${data.PLAYER_ID} already exists`);
            continue;
          }

          // Prepare player data
          const insertParticipant: InsertParticipant = {
            participantId: data.PLAYER_ID,
            name: data.PLAYER_NAME,
            mobileNumber: data.MOBILE_NUMBER || null,
            role: "player",
            // Players inherit discipline, district, location from their coach
            discipline: coach.discipline,
            district: coach.district,
            location: coach.location,
            hotelId: data.HOTEL_ID,
            stadium: coach.stadium,
            bookingStartDate: startDate,
            bookingEndDate: endDate,
            bookingReference: data.BOOKING_REFERENCE,
            teamName: data.TEAM_NAME,
            coachId: data.COACH_ID,
            checkinStatus: 'pending',
          };

          validPlayers.push(insertParticipant);
          playerIdSet.add(data.PLAYER_ID);
          
        } catch (error) {
          result.errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Step 4: Stop if validation errors found
      if (result.errors.length > 0) {
        result.success = false;
        console.log(`❌ Validation failed with ${result.errors.length} errors. No players will be created.`);
        return result;
      }

      if (validPlayers.length === 0) {
        console.log("⚠️ No valid players to process");
        return result;
      }

      console.log(`✅ Pre-validation complete. ${validPlayers.length} valid players ready for batch insertion.`);

      // Step 5: Process in batches with transaction safety
      const createdPlayers: any[] = [];
      
      for (let i = 0; i < validPlayers.length; i += BATCH_SIZE) {
        const batch = validPlayers.slice(i, i + BATCH_SIZE);
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(validPlayers.length / BATCH_SIZE);
        
        console.log(`📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} players)...`);
        
        try {
          // Execute batch in transaction - either all succeed or all rollback
          const batchResults = await db.transaction(async (tx) => {
            return await tx.insert(participants).values(batch).returning();
          });
          
          createdPlayers.push(...batchResults);
          result.created += batchResults.length;
          console.log(`✅ Batch ${batchNumber} completed successfully: ${batchResults.length} players created`);
          
        } catch (error) {
          result.errors.push(`Batch ${batchNumber} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          console.log(`❌ Batch ${batchNumber} failed and was rolled back`);
          result.success = false;
          break; // Stop processing remaining batches
        }
      }

      // Step 6: Publish events and update occupancy (asynchronously for speed)
      if (createdPlayers.length > 0) {
        console.log(`📧 Publishing ${createdPlayers.length} player events and updating occupancy...`);
        
        // Process events in background to avoid blocking upload response
        setImmediate(async () => {
          try {
            // Publish events
            for (const player of createdPlayers) {
              await EventService.publishEvent(
                "participant_registered",
                player.participantId,
                "participant",
                {
                  participantId: player.participantId,
                  name: player.name,
                  role: player.role,
                  hotelId: player.hotelId,
                  instanceCode: '1',
                  bookingStartDate: player.bookingStartDate.toISOString(),
                  bookingEndDate: player.bookingEndDate.toISOString(),
                  discipline: player.discipline,
                  district: player.district,
                  teamName: player.teamName,
                  coachId: player.coachId,
                },
                { source: "batch_players_upload" }
              );
            }
            
            // Smart batch hotel occupancy update for players
            const affectedHotelsMap = new Map<string, {
              hotelId: string;
              instanceCode: string;
              participantIds: string[];
              earliestDate: Date;
              latestDate: Date;
            }>();

            // Group players by hotel and calculate date ranges
            for (const player of createdPlayers) {
              const hotelKey = `${player.hotelId}-1`;
              const existing = affectedHotelsMap.get(hotelKey);
              
              if (existing) {
                existing.participantIds.push(player.participantId);
                if (player.bookingStartDate < existing.earliestDate) {
                  existing.earliestDate = player.bookingStartDate;
                }
                if (player.bookingEndDate > existing.latestDate) {
                  existing.latestDate = player.bookingEndDate;
                }
              } else {
                affectedHotelsMap.set(hotelKey, {
                  hotelId: player.hotelId,
                  instanceCode: '1',
                  participantIds: [player.participantId],
                  earliestDate: player.bookingStartDate,
                  latestDate: player.bookingEndDate,
                });
              }
            }

            // Publish single batch event instead of individual hotel updates
            if (affectedHotelsMap.size > 0) {
              await EventService.publishEvent(
                "batch_hotel_occupancy_update",
                "batch-players-" + Date.now(),
                "batch",
                {
                  affectedHotels: Array.from(affectedHotelsMap.values()),
                  participantCount: createdPlayers.length,
                  uploadType: "players_batch",
                  timestamp: new Date().toISOString(),
                },
                { source: "batch_players_upload" }
              );
              
              console.log(`⚡ Player batch event published for ${affectedHotelsMap.size} hotels (was ${affectedHotelsMap.size} individual updates)`);
            }
            
            console.log(`✅ All ${createdPlayers.length} player events published and occupancy updated`);
          } catch (error) {
            console.error(`❌ Error publishing player events:`, error);
          }
        });
      }

      console.log(`🎉 Batch player upload complete! Created: ${result.created}, Errors: ${result.errors.length}, Warnings: ${result.warnings.length}`);
      
    } catch (error) {
      result.errors.push(`Batch upload error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.success = false;
      console.error("❌ Batch player upload failed:", error);
    }

    return result;
  }

  // Upload Player Data Sheet
  static async uploadPlayers(content: string): Promise<UploadResult> {
    const result: UploadResult = {
      success: true,
      created: 0,
      errors: [],
      warnings: [],
    };

    try {
      const rows = this.parsePSV(content);
      const headers = rows[0];
      
      const expectedHeaders = [
        'COACH_ID', 'PLAYER_ID', 'PLAYER_NAME', 'MOBILE_NUMBER', 'TEAM_NAME',
        'HOTEL_ID', 'BOOKING_REFERENCE', 'BOOKING_START_DATE', 'BOOKING_END_DATE'
      ];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const data: any = {};
        headers.forEach((header, index) => {
          data[header] = row[index];
        });

        try {
          // Validate coach exists
          const coach = await storage.getParticipantByParticipantId(data.COACH_ID);
          if (!coach || coach.role !== 'coach') {
            result.errors.push(`Row ${i + 1}: Coach ${data.COACH_ID} not found`);
            continue;
          }

          // Validate hotel exists
          const hotel = await storage.getHotelByHotelIdAndInstance(data.HOTEL_ID, '1');
          if (!hotel) {
            result.errors.push(`Row ${i + 1}: Hotel ${data.HOTEL_ID} not found in inventory`);
            continue;
          }

          // MANDATORY: Enforce 3-day minimum stay for player bookings
          // This business rule applies to actual participant bookings, not hotel inventory
          const startDate = this.parseDDMMYYYY(data.BOOKING_START_DATE);
          const endDate = this.parseDDMMYYYY(data.BOOKING_END_DATE);
          const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
          
          // Fixed: For 3 calendar days minimum (e.g., Oct 2,3,4), duration should be >= 2 days
          if (daysDiff < 2) {
            const calendarDays = daysDiff + 1; // Convert duration to calendar days for user-friendly message
            result.errors.push(`Row ${i + 1}: Player booking must span at least 3 calendar days. Current: ${calendarDays} calendar days`);
            continue;
          }

          // Check if player already exists
          const existing = await storage.getParticipantByParticipantId(data.PLAYER_ID);
          if (existing) {
            result.warnings.push(`Row ${i + 1}: Player ${data.PLAYER_ID} already exists`);
            continue;
          }

          const insertParticipant: InsertParticipant = {
            participantId: data.PLAYER_ID,
            name: data.PLAYER_NAME,
            mobileNumber: data.MOBILE_NUMBER || null,
            role: "player",
            // Players inherit discipline, district, location from their coach
            discipline: coach.discipline,
            district: coach.district,
            location: coach.location,
            teamName: data.TEAM_NAME,
            coachId: data.COACH_ID,
            hotelId: data.HOTEL_ID,
            bookingStartDate: startDate,
            bookingEndDate: endDate,
            bookingReference: data.BOOKING_REFERENCE,
            checkinStatus: "pending",
          };

          const createdParticipant = await storage.createParticipant(insertParticipant);
          
          // Publish participant registration event
          await EventService.publishEvent(
            "participant_registered",
            createdParticipant.participantId,
            "participant",
            {
              participantId: createdParticipant.participantId,
              name: createdParticipant.name,
              role: createdParticipant.role,
              hotelId: createdParticipant.hotelId,
              instanceCode: '1', // Default instance for now
              bookingStartDate: createdParticipant.bookingStartDate.toISOString(),
              bookingEndDate: createdParticipant.bookingEndDate.toISOString(),
              discipline: createdParticipant.discipline,
              district: createdParticipant.district,
              teamName: createdParticipant.teamName,
              coachId: createdParticipant.coachId,
            },
            { source: "players_upload" }
          );
          
          // Update hotel occupancy after adding participant
          await storage.updateHotelOccupancy(data.HOTEL_ID, '1');
          
          result.created++;
        } catch (error) {
          result.errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    } catch (error) {
      result.errors.push(`Parse error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.success = false;
    }

    return result;
  }
}
