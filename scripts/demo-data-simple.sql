-- Demo Data Generation Script for 70% Hotel Occupancy
-- This script generates realistic participant data for impressive demos

-- First, let's see current capacity
DO $$
DECLARE
    total_capacity INTEGER;
    target_participants INTEGER;
    hotel_rec RECORD;
    participant_counter INTEGER := 3000;
    coach_counter INTEGER := 1000;
    official_counter INTEGER := 500;
    i INTEGER;
    target_rooms INTEGER;
    participants_for_hotel INTEGER;
    random_role VARCHAR;
    random_discipline VARCHAR;
    random_district VARCHAR;
    random_first_name VARCHAR;
    random_last_name VARCHAR;
    mobile_number VARCHAR;
    participant_id VARCHAR;
    team_name VARCHAR;
    role_type VARCHAR;
    
    -- Arrays for random generation
    disciplines VARCHAR[] := ARRAY['Athletics', 'Football', 'Cricket', 'Basketball', 'Volleyball', 'Badminton', 'Tennis', 'Hockey', 'Swimming', 'Wrestling', 'Boxing', 'Kabaddi'];
    districts VARCHAR[] := ARRAY['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tirunelveli', 'Vellore', 'Erode', 'Dindigul', 'Thanjavur', 'Kanchipuram', 'Tiruppur'];
    male_names VARCHAR[] := ARRAY['Arjun', 'Karthik', 'Rajesh', 'Vijay', 'Suresh', 'Ramesh', 'Dinesh', 'Mahesh', 'Prakash', 'Ganesh', 'Rakesh', 'Arun', 'Varun', 'Kishore', 'Mohan', 'Ravi', 'Sanjay', 'Ajay', 'Vinay', 'Manoj'];
    female_names VARCHAR[] := ARRAY['Priya', 'Kavya', 'Divya', 'Shreya', 'Meera', 'Neha', 'Pooja', 'Anjali', 'Sneha', 'Deepika', 'Anitha', 'Sunitha', 'Lalitha', 'Savitha', 'Kavitha', 'Nithya'];
    last_names VARCHAR[] := ARRAY['Kumar', 'Raj', 'Singh', 'Sharma', 'Reddy', 'Nair', 'Iyer', 'Rao', 'Prasad', 'Gupta', 'Krishnan', 'Subramanian', 'Venkatesh', 'Ramachandran'];
    
BEGIN
    RAISE NOTICE 'Starting demo data generation for 70%% hotel occupancy...';
    
    -- Calculate total capacity
    SELECT SUM(total_rooms) INTO total_capacity FROM hotels;
    target_participants := ROUND(total_capacity * 0.70 * 1.8); -- ~1.8 people per room
    
    RAISE NOTICE 'Total hotel capacity: % rooms', total_capacity;
    RAISE NOTICE 'Target participants: % (for 70%% occupancy)', target_participants;
    
    -- Generate participants for each hotel
    FOR hotel_rec IN SELECT * FROM hotels WHERE total_rooms > 5 ORDER BY total_rooms DESC LIMIT 25
    LOOP
        -- Calculate target rooms for this hotel (70% occupancy)
        target_rooms := ROUND(hotel_rec.total_rooms * 0.70);
        participants_for_hotel := target_rooms * 2; -- Average 2 people per room
        
        RAISE NOTICE 'Processing hotel: % - Target: % rooms, % participants', 
            hotel_rec.hotel_name, target_rooms, participants_for_hotel;
        
        -- Generate participants for this hotel
        FOR i IN 1..participants_for_hotel
        LOOP
            -- Determine role (80% players, 15% coaches, 5% officials)
            IF random() < 0.80 THEN
                role_type := 'player';
                participant_id := 'PLY_' || LPAD(participant_counter::TEXT, 4, '0');
                participant_counter := participant_counter + 1;
            ELSIF random() < 0.90 THEN
                role_type := 'coach';
                participant_id := 'COA_' || LPAD(coach_counter::TEXT, 4, '0');
                coach_counter := coach_counter + 1;
            ELSE
                role_type := 'official';
                participant_id := 'OFC_' || LPAD(official_counter::TEXT, 4, '0');
                official_counter := official_counter + 1;
            END IF;
            
            -- Random selections
            random_discipline := disciplines[1 + floor(random() * array_length(disciplines, 1))];
            random_district := districts[1 + floor(random() * array_length(districts, 1))];
            
            -- Generate name (70% male, 30% female)
            IF random() < 0.70 THEN
                random_first_name := male_names[1 + floor(random() * array_length(male_names, 1))];
            ELSE
                random_first_name := female_names[1 + floor(random() * array_length(female_names, 1))];
            END IF;
            random_last_name := last_names[1 + floor(random() * array_length(last_names, 1))];
            
            -- Generate mobile number
            mobile_number := '+919' || LPAD(floor(random() * 900000000 + 100000000)::TEXT, 9, '0');
            
            -- Generate team name
            team_name := random_district || ' ' || 
                        (ARRAY['Tigers', 'Lions', 'Eagles', 'Warriors', 'Champions', 'Stars'])[1 + floor(random() * 6)];
            
            -- Insert participant
            INSERT INTO participants (
                participant_id, name, mobile_number, role, discipline, district, team_name,
                hotel_id, hotel_name, stadium, booking_start_date, booking_end_date,
                booking_reference, booking_type, transport_poc, checkin_status
            ) VALUES (
                participant_id,
                random_first_name || ' ' || random_last_name,
                mobile_number,
                role_type,
                random_discipline,
                random_district,
                CASE WHEN role_type = 'official' THEN '' ELSE team_name END,
                hotel_rec.hotel_id,
                hotel_rec.hotel_name,
                random_discipline || ' Stadium, ' || hotel_rec.location,
                hotel_rec.start_date,
                hotel_rec.end_date,
                'R_' || upper(left(role_type, 3)) || '_' || hotel_rec.hotel_id || '_' || upper(left(random_discipline, 3)) || '_REG',
                'regular',
                '+919344' || LPAD(floor(random() * 1000000)::TEXT, 6, '0'),
                CASE 
                    WHEN random() < 0.85 THEN 'checked_in'
                    WHEN random() < 0.95 THEN 'pending'
                    ELSE 'checked_out'
                END
            );
            
        END LOOP;
        
    END LOOP;
    
    RAISE NOTICE 'Demo data generation completed!';
    RAISE NOTICE 'Updating hotel occupancy rates...';
    
END $$;