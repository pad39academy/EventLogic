/**
 * Event-Driven Operations Service
 * Wraps existing operations to publish events and demonstrate 
 * how booking successful events trigger automatic hotel occupancy balance impact
 */

import { storage } from "../storage";
import { EventService } from "./event";
import { type InsertParticipant, type Participant } from "@shared/schema";

export class EventDrivenOperationsService {
  
  /**
   * Create participant with automatic event publishing
   * This demonstrates how booking success triggers occupancy balance impact
   */
  static async createParticipantWithEvents(
    participantData: InsertParticipant,
    userId: string
  ): Promise<Participant> {
    console.log(`📝 Creating participant with event-driven architecture: ${participantData.participantId}`);
    
    // 1. Create the participant (traditional operation)
    const participant = await storage.createParticipant(participantData);
    
    // 2. Publish booking created event (this triggers automatic occupancy balance impact)
    await EventService.publishEvent(
      'booking_created',
      participant.participantId,
      'participant',
      {
        participantId: participant.participantId,
        role: participant.role,
        hotelId: participant.hotelId,
        instanceCode: '1', // You could determine this from hotel lookup
        bookingStartDate: participant.bookingStartDate.toISOString(),
        bookingEndDate: participant.bookingEndDate.toISOString(),
        teamName: participant.teamName,
        coachId: participant.coachId,
      },
      {
        userId,
        operation: 'create_participant',
        source: 'admin_dashboard'
      }
    );
    
    // 3. Publish participant registered event
    await EventService.publishEvent(
      'participant_registered',
      participant.participantId,
      'participant',
      {
        participantId: participant.participantId,
        name: participant.name,
        role: participant.role,
        hotelId: participant.hotelId,
        instanceCode: '1',
        bookingStartDate: participant.bookingStartDate.toISOString(),
        bookingEndDate: participant.bookingEndDate.toISOString(),
        discipline: participant.discipline,
        district: participant.district,
        teamName: participant.teamName,
        coachId: participant.coachId,
      },
      {
        userId,
        operation: 'register_participant',
        source: 'admin_dashboard'
      }
    );
    
    console.log(`✅ Participant ${participant.participantId} created with events published`);
    console.log(`🏨 Hotel occupancy balance will be automatically updated via events`);
    
    return participant;
  }
  
  /**
   * Bulk create participants with events (for file uploads)
   */
  static async bulkCreateParticipantsWithEvents(
    participantsData: InsertParticipant[],
    userId: string,
    uploadType: string
  ): Promise<Participant[]> {
    console.log(`📊 Bulk creating ${participantsData.length} participants with event-driven architecture`);
    
    // 1. Create all participants
    const participants = await storage.bulkCreateParticipants(participantsData);
    
    // 2. Publish events for each participant
    for (const participant of participants) {
      // Booking created event for occupancy calculation
      await EventService.publishEvent(
        'booking_created',
        participant.participantId,
        'participant',
        {
          participantId: participant.participantId,
          role: participant.role,
          hotelId: participant.hotelId,
          instanceCode: '1',
          bookingStartDate: participant.bookingStartDate.toISOString(),
          bookingEndDate: participant.bookingEndDate.toISOString(),
          teamName: participant.teamName,
          coachId: participant.coachId,
        },
        {
          userId,
          operation: 'bulk_upload',
          uploadType,
          source: 'file_upload'
        }
      );
    }
    
    // 3. Publish bulk upload completed event
    await EventService.publishEvent(
      'bulk_upload_completed',
      `upload_${Date.now()}`,
      'upload',
      {
        uploadType,
        participantCount: participants.length,
        participantIds: participants.map(p => p.participantId),
        hotelIds: [...new Set(participants.map(p => p.hotelId))], // Unique hotel IDs
      },
      {
        userId,
        operation: 'bulk_upload_completed',
        source: 'file_upload'
      }
    );
    
    console.log(`✅ ${participants.length} participants created with events published`);
    console.log(`🏨 Hotel occupancy balances will be automatically updated via events`);
    
    return participants;
  }
  
  /**
   * Check-in participants with events
   */
  static async checkinParticipantsWithEvents(
    participantIds: string[],
    userId: string,
    checkinTime?: Date
  ): Promise<void> {
    console.log(`🏨 Checking in ${participantIds.length} participants with event-driven architecture`);
    
    const actualCheckinTime = checkinTime || new Date();
    
    // 1. Update participants check-in status
    for (const participantId of participantIds) {
      const participant = await storage.getParticipantByParticipantId(participantId);
      if (!participant) continue;
      
      await storage.updateParticipant(participant.id, {
        checkinStatus: 'checked_in',
        checkinTime: actualCheckinTime,
      });
      
      // 2. Publish check-in event
      await EventService.publishEvent(
        'participant_checked_in',
        participant.participantId,
        'participant',
        {
          participantId: participant.participantId,
          name: participant.name,
          role: participant.role,
          hotelId: participant.hotelId,
          checkinTime: actualCheckinTime.toISOString(),
          teamName: participant.teamName,
          coachId: participant.coachId,
        },
        {
          userId,
          operation: 'checkin',
          source: 'admin_dashboard'
        }
      );
    }
    
    console.log(`✅ ${participantIds.length} participants checked in with events published`);
  }
  
  /**
   * Update hotel with automatic occupancy recalculation
   */
  static async updateHotelWithEvents(
    hotelId: string,
    updates: any,
    userId: string
  ): Promise<void> {
    console.log(`🏨 Updating hotel ${hotelId} with event-driven architecture`);
    
    // 1. Update hotel
    const hotel = await storage.getHotelById(hotelId);
    if (!hotel) throw new Error('Hotel not found');
    
    const updatedHotel = await storage.updateHotel(hotelId, updates);
    if (!updatedHotel) throw new Error('Hotel update failed');
    
    // 2. If room capacity changed, publish capacity update event
    if (updates.totalRooms && updates.totalRooms !== hotel.totalRooms) {
      await EventService.publishEvent(
        'hotel_capacity_updated',
        hotel.hotelId,
        'hotel',
        {
          hotelId: hotel.hotelId,
          instanceCode: hotel.instanceCode,
          previousCapacity: hotel.totalRooms,
          newCapacity: updates.totalRooms,
          changeReason: updates.changeReason || 'Admin update',
        },
        {
          userId,
          operation: 'update_hotel_capacity',
          source: 'admin_dashboard'
        }
      );
    }
    
    console.log(`✅ Hotel ${hotelId} updated with events published`);
  }
  
  /**
   * Delete participant with automatic occupancy adjustment
   */
  static async deleteParticipantWithEvents(
    participantId: string,
    userId: string,
    reason?: string
  ): Promise<void> {
    console.log(`🗑️ Deleting participant ${participantId} with event-driven architecture`);
    
    // 1. Get participant details before deletion
    const participant = await storage.getParticipantByParticipantId(participantId);
    if (!participant) throw new Error('Participant not found');
    
    // 2. Delete participant
    await storage.deleteParticipant(participant.id);
    
    // 3. Publish deletion event (triggers occupancy recalculation)
    await EventService.publishEvent(
      'participant_deleted',
      participant.participantId,
      'participant',
      {
        participantId: participant.participantId,
        name: participant.name,
        role: participant.role,
        hotelId: participant.hotelId,
        instanceCode: '1',
        bookingStartDate: participant.bookingStartDate.toISOString(),
        bookingEndDate: participant.bookingEndDate.toISOString(),
        reason: reason || 'Admin deletion',
      },
      {
        userId,
        operation: 'delete_participant',
        source: 'admin_dashboard'
      }
    );
    
    console.log(`✅ Participant ${participantId} deleted with events published`);
    console.log(`🏨 Hotel occupancy balance will be automatically recalculated via events`);
  }
}

/**
 * Example of how events flow in your system:
 * 
 * 1. User creates a booking (participant) → booking_created event published
 * 2. Event processor picks up the event → occupancy_calculator handler runs
 * 3. Hotel occupancy balance table is automatically updated for affected date range
 * 4. Dashboard queries the balance table for real-time occupancy data
 * 5. All operations are audited via audit_logger handler
 * 
 * Benefits:
 * - Decoupled: Hotel occupancy calculation doesn't block participant creation
 * - Reliable: Events are persisted and can be retried if processing fails
 * - Auditable: Complete event trail for debugging and compliance
 * - Scalable: Event processing can be distributed and parallelized
 * - Consistent: All hotel occupancy changes go through the same event-driven flow
 */