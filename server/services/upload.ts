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

          // Mandatory: Enforce minimum 3-day stay (only for booking data)
          const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
          if (daysDiff < 3) {
            result.errors.push(`Row ${i + 1}: Minimum 3-day stay required. Current duration: ${daysDiff} days`);
            continue;
          }

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
        'ROLE', 'COACH_id', 'Name', 'Mobile_Number', 'Discipline',
        'Hotel_ID', 'Hotel_Name', 'Stadium', 'Booking_Start_Date',
        'Booking_End_Date', 'Booking_Reference_Number', 'Transport_POC'
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
          const hotel = await storage.getHotelByHotelIdAndInstance(data.Hotel_ID, '1');
          if (!hotel) {
            result.errors.push(`Row ${i + 1}: Hotel ${data.Hotel_ID} not found in inventory`);
            continue;
          }

          // Validate minimum 3-day stay
          const startDate = new Date(data.Booking_Start_Date);
          const endDate = new Date(data.Booking_End_Date);
          const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
          
          if (daysDiff < 3) {
            result.errors.push(`Row ${i + 1}: Booking duration must be at least 3 days`);
            continue;
          }

          // Check if participant already exists
          const existing = await storage.getParticipantByParticipantId(data.COACH_id);
          if (existing) {
            result.warnings.push(`Row ${i + 1}: Participant ${data.COACH_id} already exists`);
            continue;
          }

          // Normalize mobile number format (ensure +91 prefix for Indian numbers)
          let normalizedMobile = data.Mobile_Number;
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
            let existingUser = await storage.getUserByCoachId(data.COACH_id);
            if (!existingUser) {
              existingUser = await storage.getUserByMobile(normalizedMobile);
            }
            
            if (!existingUser) {
              await storage.createUser({
                mobileNumber: normalizedMobile,
                name: data.Name,
                role: "coach",
                coachId: data.COACH_id,
                isActive: true,
              });
            } else if (existingUser.coachId !== data.COACH_id) {
              // Update existing user with coachId if missing
              await storage.updateUser(existingUser.id, {
                coachId: data.COACH_id,
                name: data.Name, // Update name to match PSV data
              });
            }
          }

          const insertParticipant: InsertParticipant = {
            participantId: data.COACH_id,
            name: data.Name,
            mobileNumber: normalizedMobile,
            role: data.ROLE.toLowerCase() as "coach" | "official",
            discipline: data.Discipline,
            hotelId: data.Hotel_ID,
            hotelName: data.Hotel_Name,
            stadium: data.Stadium,
            bookingStartDate: startDate,
            bookingEndDate: endDate,
            bookingReference: data.Booking_Reference_Number,
            transportPoc: data['Transport_POC'],
            checkinStatus: data.ROLE === 'OFFICIAL' ? 'checked_in' : 'pending',
          };

          await storage.createParticipant(insertParticipant);
          
          // Update hotel occupancy after adding participant
          await storage.updateHotelOccupancy(data.Hotel_ID, '1');
          
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
        'COACH_ID', 'PlayerID', 'Player_Name', 'Mobilenumber',
        'Discipline', 'District', 'Team_Name', 'Location',
        'HOTEL_id', 'BOOKING_REFERENCE', 'Booking_Start_Date', 'Booking_End_Date'
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
          const hotel = await storage.getHotelByHotelIdAndInstance(data.HOTEL_id, '1');
          if (!hotel) {
            result.errors.push(`Row ${i + 1}: Hotel ${data.HOTEL_id} not found in inventory`);
            continue;
          }

          // Validate minimum 3-day stay
          const startDate = new Date(data.Booking_Start_Date);
          const endDate = new Date(data.Booking_End_Date);
          const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
          
          if (daysDiff < 3) {
            result.errors.push(`Row ${i + 1}: Booking duration must be at least 3 days`);
            continue;
          }

          // Check if player already exists
          const existing = await storage.getParticipantByParticipantId(data.PlayerID);
          if (existing) {
            result.warnings.push(`Row ${i + 1}: Player ${data.PlayerID} already exists`);
            continue;
          }

          const insertParticipant: InsertParticipant = {
            participantId: data.PlayerID,
            name: data.Player_Name,
            mobileNumber: data.Mobilenumber || null,
            role: "player",
            discipline: data.Discipline,
            district: data.District,
            teamName: data.Team_Name,
            coachId: data.COACH_ID,
            hotelId: data.HOTEL_id,
            hotelName: data.Location,
            bookingStartDate: startDate,
            bookingEndDate: endDate,
            bookingReference: data.BOOKING_REFERENCE,
            checkinStatus: "pending",
          };

          await storage.createParticipant(insertParticipant);
          
          // Update hotel occupancy after adding participant
          await storage.updateHotelOccupancy(data.HOTEL_id, '1');
          
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
