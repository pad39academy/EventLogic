import { storage } from "../storage";
import { type InsertHotel, type InsertParticipant, type InsertUser } from "@shared/schema";
import { AuthService } from "./auth";

export interface UploadResult {
  success: boolean;
  created: number;
  errors: string[];
  warnings: string[];
}

export class UploadService {
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

          // Validate dates
          const startDate = new Date(hotelData.startDate);
          const endDate = new Date(hotelData.endDate);
          
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

          await storage.createHotel(insertHotel);
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
          // This business rule applies to actual participant bookings, not hotel inventory
          const startDate = new Date(data.BOOKING_START_DATE);
          const endDate = new Date(data.BOOKING_END_DATE);
          const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
          
          if (daysDiff < 3) {
            result.errors.push(`Row ${i + 1}: Coach/Official booking duration must be at least 3 days. Current: ${daysDiff} days`);
            continue;
          }

          // Check if participant already exists
          const existing = await storage.getParticipantByParticipantId(data.COACH_ID);
          if (existing) {
            result.warnings.push(`Row ${i + 1}: Participant ${data.COACH_ID} already exists`);
            continue;
          }

          // Normalize mobile number format (ensure +91 prefix for Indian numbers)
          let normalizedMobile = data.MOBILE_NUMBER;
          if (normalizedMobile && !normalizedMobile.startsWith('+')) {
            if (normalizedMobile.startsWith('91')) {
              normalizedMobile = '+' + normalizedMobile;
            } else if (normalizedMobile.length === 10) {
              normalizedMobile = '+91' + normalizedMobile;
            }
          }

          // Create coach user account if role is COACH
          if (data.ROLE === 'COACH') {
            // Check if user exists by coachId or mobile number
            let existingUser = await storage.getUserByCoachId(data.COACH_ID);
            if (!existingUser) {
              existingUser = await storage.getUserByMobile(normalizedMobile);
            }
            
            if (!existingUser) {
              await storage.createUser({
                mobileNumber: normalizedMobile,
                name: data.NAME,
                role: "coach",
                coachId: data.COACH_ID,
                isActive: true,
              });
            } else if (existingUser.coachId !== data.COACH_ID) {
              // Update existing user with coachId if missing
              await storage.updateUser(existingUser.id, {
                coachId: data.COACH_ID,
                name: data.NAME, // Update name to match PSV data
              });
            }
          }

          const insertParticipant: InsertParticipant = {
            participantId: data.COACH_ID,
            name: data.NAME,
            mobileNumber: normalizedMobile,
            role: data.ROLE.toLowerCase() as "coach" | "official",
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

          await storage.createParticipant(insertParticipant);
          
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
          const coach = await storage.getUserByCoachId(data.COACH_ID);
          if (!coach) {
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
          const startDate = new Date(data.BOOKING_START_DATE);
          const endDate = new Date(data.BOOKING_END_DATE);
          const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
          
          if (daysDiff < 3) {
            result.errors.push(`Row ${i + 1}: Player booking duration must be at least 3 days. Current: ${daysDiff} days`);
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
            // discipline, district, location removed - players get these from their coach
            teamName: data.TEAM_NAME,
            coachId: data.COACH_ID,
            hotelId: data.HOTEL_ID,
            bookingStartDate: startDate,
            bookingEndDate: endDate,
            bookingReference: data.BOOKING_REFERENCE,
            checkinStatus: "pending",
          };

          await storage.createParticipant(insertParticipant);
          
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
