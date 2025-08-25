#!/usr/bin/env node

/**
 * Demo Data Generator for Ievolve Event Management System
 * Generates realistic participant data to achieve ~70% hotel occupancy
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { participants, hotels } from '../shared/schema.js';
import { sql, eq } from 'drizzle-orm';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

// Tamil Nadu districts and realistic names
const districts = [
  'Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tirunelveli',
  'Vellore', 'Erode', 'Dindigul', 'Thanjavur', 'Kanchipuram', 'Tiruppur',
  'Karur', 'Cuddalore', 'Dharmapuri', 'Krishnagiri', 'Nagapattinam', 'Namakkal',
  'Perambalur', 'Pudukkottai', 'Ramanathapuram', 'Sivaganga', 'Tenkasi',
  'Theni', 'Thiruvallur', 'Thiruvarur', 'Thoothukudi', 'Virudhunagar'
];

const disciplines = [
  'Athletics', 'Football', 'Cricket', 'Basketball', 'Volleyball', 'Badminton',
  'Tennis', 'Table Tennis', 'Hockey', 'Swimming', 'Wrestling', 'Boxing',
  'Kabaddi', 'Kho Kho', 'Chess', 'Weightlifting'
];

const maleNames = [
  'Arjun', 'Karthik', 'Rajesh', 'Vijay', 'Suresh', 'Ramesh', 'Dinesh', 'Mahesh',
  'Prakash', 'Ganesh', 'Rakesh', 'Nitesh', 'Mukesh', 'Naresh', 'Ritesh', 'Umesh',
  'Arun', 'Varun', 'Tarun', 'Kishore', 'Mohan', 'Rohan', 'Sohan', 'Gopal',
  'Ravi', 'Sanjay', 'Ajay', 'Vinay', 'Manoj', 'Ashok', 'Deepak', 'Pawan',
  'Sankar', 'Kumar', 'Prasad', 'Rao', 'Reddy', 'Nair', 'Iyer', 'Sharma'
];

const femaleNames = [
  'Priya', 'Kavya', 'Divya', 'Shreya', 'Meera', 'Neha', 'Pooja', 'Anjali',
  'Sneha', 'Deepika', 'Anitha', 'Sunitha', 'Lalitha', 'Savitha', 'Kavitha', 'Nithya',
  'Sriya', 'Arya', 'Maya', 'Riya', 'Siya', 'Tiya', 'Diya', 'Kiya',
  'Lakshmi', 'Saraswati', 'Parvathi', 'Durga', 'Kamala', 'Vimala', 'Shobha', 'Rekha'
];

const lastNames = [
  'Kumar', 'Raj', 'Singh', 'Sharma', 'Reddy', 'Nair', 'Iyer', 'Rao', 'Prasad',
  'Gupta', 'Agarwal', 'Jain', 'Shah', 'Patel', 'Desai', 'Mehta', 'Modi',
  'Krishnan', 'Subramanian', 'Venkatesh', 'Ramachandran', 'Balakrishnan'
];

// Generate mobile number
function generateMobileNumber() {
  const prefixes = ['98', '99', '94', '95', '96', '97', '90', '91', '92', '93'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const remaining = Math.floor(Math.random() * 90000000) + 10000000;
  return `+91${prefix}${remaining}`;
}

// Generate participant ID
function generateParticipantId(role, index) {
  const rolePrefix = {
    'player': 'PLY',
    'coach': 'COA', 
    'official': 'OFC'
  };
  return `${rolePrefix[role]}_${String(index).padStart(4, '0')}`;
}

// Generate team name
function generateTeamName(discipline, district) {
  const teamTypes = ['Tigers', 'Lions', 'Eagles', 'Warriors', 'Champions', 'Stars', 'Heroes', 'Legends'];
  const teamType = teamTypes[Math.floor(Math.random() * teamTypes.length)];
  return `${district} ${teamType}`;
}

// Calculate room requirements (3 players, 2 coaches, 1 official per room)
function calculateRoomRequirement(players, coaches, officials) {
  return Math.ceil(players / 3) + Math.ceil(coaches / 2) + officials;
}

async function generateDemoData() {
  try {
    console.log('🚀 Starting demo data generation...');
    
    // Get all hotels with their capacity
    const allHotels = await db.select().from(hotels);
    console.log(`📊 Found ${allHotels.length} hotels with total capacity: ${allHotels.reduce((sum, h) => sum + h.totalRooms, 0)} rooms`);
    
    // Target 70% occupancy
    const totalCapacity = allHotels.reduce((sum, h) => sum + h.totalRooms, 0);
    const targetOccupancy = Math.floor(totalCapacity * 0.70);
    console.log(`🎯 Target occupancy: ${targetOccupancy} rooms (70%)`);
    
    let participantCounter = {
      player: 1000,
      coach: 500,
      official: 300
    };
    
    const generatedParticipants = [];
    let totalRoomsNeeded = 0;
    
    // Distribute participants across hotels
    for (const hotel of allHotels) {
      // Calculate target rooms for this hotel (70% of capacity)
      const hotelTargetRooms = Math.floor(hotel.totalRooms * 0.70);
      
      if (hotelTargetRooms <= 0) continue;
      
      console.log(`🏨 Processing ${hotel.hotelName}: targeting ${hotelTargetRooms}/${hotel.totalRooms} rooms`);
      
      let hotelRoomsAllocated = 0;
      
      // Generate participants for each discipline
      const hotelDisciplines = Math.min(3, disciplines.length); // 1-3 disciplines per hotel
      const selectedDisciplines = disciplines.sort(() => 0.5 - Math.random()).slice(0, hotelDisciplines);
      
      for (const discipline of selectedDisciplines) {
        // Calculate participants needed for this discipline at this hotel
        const disciplineRooms = Math.floor(hotelTargetRooms / selectedDisciplines.length);
        
        // Generate teams (each team has players, coaches, officials)
        const teamsCount = Math.max(1, Math.floor(disciplineRooms / 8)); // ~8 rooms per team on average
        
        for (let teamIndex = 0; teamIndex < teamsCount; teamIndex++) {
          const district = districts[Math.floor(Math.random() * districts.length)];
          const teamName = generateTeamName(discipline, district);
          
          // Generate players (8-15 per team)
          const playersCount = Math.floor(Math.random() * 8) + 8;
          const coachesCount = Math.floor(Math.random() * 3) + 2; // 2-4 coaches
          const officialsCount = Math.floor(Math.random() * 2) + 1; // 1-2 officials
          
          const teamRooms = calculateRoomRequirement(playersCount, coachesCount, officialsCount);
          
          if (hotelRoomsAllocated + teamRooms > hotelTargetRooms) {
            break; // Hotel capacity reached
          }
          
          // Generate players
          for (let i = 0; i < playersCount; i++) {
            const isWoman = Math.random() > 0.5;
            const firstName = isWoman ? 
              femaleNames[Math.floor(Math.random() * femaleNames.length)] :
              maleNames[Math.floor(Math.random() * maleNames.length)];
            const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
            
            generatedParticipants.push({
              participantId: generateParticipantId('player', participantCounter.player++),
              name: `${firstName} ${lastName}`,
              mobileNumber: generateMobileNumber(),
              role: 'player',
              discipline,
              district,
              teamName,
              hotelId: hotel.hotelId,
              hotelName: hotel.hotelName,
              stadium: `${discipline} Stadium, ${hotel.location}`,
              bookingStartDate: new Date(hotel.startDate),
              bookingEndDate: new Date(hotel.endDate),
              bookingReference: `R_PLY_${hotel.hotelId}_${discipline.substring(0,3).toUpperCase()}_REG`,
              bookingType: 'regular',
              transportPoc: generateMobileNumber(),
              checkinStatus: Math.random() > 0.3 ? 'checked_in' : 'pending'
            });
          }
          
          // Generate coaches
          for (let i = 0; i < coachesCount; i++) {
            const isWoman = Math.random() > 0.3;
            const firstName = isWoman ? 
              femaleNames[Math.floor(Math.random() * femaleNames.length)] :
              maleNames[Math.floor(Math.random() * maleNames.length)];
            const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
            
            generatedParticipants.push({
              participantId: generateParticipantId('coach', participantCounter.coach++),
              name: `${firstName} ${lastName}`,
              mobileNumber: generateMobileNumber(),
              role: 'coach',
              discipline,
              district,
              teamName,
              hotelId: hotel.hotelId,
              hotelName: hotel.hotelName,
              stadium: `${discipline} Stadium, ${hotel.location}`,
              bookingStartDate: new Date(hotel.startDate),
              bookingEndDate: new Date(hotel.endDate),
              bookingReference: `R_COA_${hotel.hotelId}_${discipline.substring(0,3).toUpperCase()}_REG`,
              bookingType: 'regular',
              transportPoc: generateMobileNumber(),
              checkinStatus: Math.random() > 0.2 ? 'checked_in' : 'pending'
            });
          }
          
          // Generate officials
          for (let i = 0; i < officialsCount; i++) {
            const isWoman = Math.random() > 0.6;
            const firstName = isWoman ? 
              femaleNames[Math.floor(Math.random() * femaleNames.length)] :
              maleNames[Math.floor(Math.random() * maleNames.length)];
            const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
            
            generatedParticipants.push({
              participantId: generateParticipantId('official', participantCounter.official++),
              name: `${firstName} ${lastName}`,
              mobileNumber: generateMobileNumber(),
              role: 'official',
              discipline,
              district,
              teamName: '', // Officials usually don't have team names
              hotelId: hotel.hotelId,
              hotelName: hotel.hotelName,
              stadium: `${discipline} Stadium, ${hotel.location}`,
              bookingStartDate: new Date(hotel.startDate),
              bookingEndDate: new Date(hotel.endDate),
              bookingReference: `R_OFC_${hotel.hotelId}_${discipline.substring(0,3).toUpperCase()}_REG`,
              bookingType: 'regular',
              transportPoc: generateMobileNumber(),
              checkinStatus: Math.random() > 0.1 ? 'checked_in' : 'pending'
            });
          }
          
          hotelRoomsAllocated += teamRooms;
          totalRoomsNeeded += teamRooms;
        }
      }
      
      console.log(`✅ ${hotel.hotelName}: allocated ${hotelRoomsAllocated} rooms`);
    }
    
    console.log(`\n📈 Generated ${generatedParticipants.length} participants requiring ${totalRoomsNeeded} rooms`);
    console.log(`📊 Breakdown:`);
    console.log(`   - Players: ${generatedParticipants.filter(p => p.role === 'player').length}`);
    console.log(`   - Coaches: ${generatedParticipants.filter(p => p.role === 'coach').length}`);
    console.log(`   - Officials: ${generatedParticipants.filter(p => p.role === 'official').length}`);
    
    // Insert participants in batches
    console.log('\n💾 Inserting participants into database...');
    const batchSize = 100;
    let inserted = 0;
    
    for (let i = 0; i < generatedParticipants.length; i += batchSize) {
      const batch = generatedParticipants.slice(i, i + batchSize);
      await db.insert(participants).values(batch);
      inserted += batch.length;
      console.log(`   Inserted ${inserted}/${generatedParticipants.length} participants...`);
    }
    
    // Update hotel occupancy
    console.log('\n🔄 Updating hotel occupancy rates...');
    for (const hotel of allHotels) {
      const hotelParticipants = generatedParticipants.filter(p => p.hotelId === hotel.hotelId);
      const players = hotelParticipants.filter(p => p.role === 'player').length;
      const coaches = hotelParticipants.filter(p => p.role === 'coach').length;
      const officials = hotelParticipants.filter(p => p.role === 'official').length;
      
      const occupiedRooms = calculateRoomRequirement(players, coaches, officials);
      const availableRooms = hotel.totalRooms - occupiedRooms;
      
      await db.update(hotels)
        .set({
          occupiedRooms,
          availableRooms
        })
        .where(eq(hotels.id, hotel.id));
      
      console.log(`   Updated ${hotel.hotelName}: ${occupiedRooms}/${hotel.totalRooms} rooms (${Math.round(occupiedRooms/hotel.totalRooms*100)}%)`);
    }
    
    console.log('\n🎉 Demo data generation completed successfully!');
    console.log(`📊 Final stats will be visible in the admin dashboard`);
    
  } catch (error) {
    console.error('❌ Error generating demo data:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the generator
if (import.meta.url === `file://${process.argv[1]}`) {
  generateDemoData().catch(console.error);
}

export { generateDemoData };