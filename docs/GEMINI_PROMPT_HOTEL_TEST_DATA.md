# Gemini Prompt: Generate Hotel Inventory Test Data

## Primary Instruction

Generate realistic hotel inventory test data in PSV (Pipe-Separated Values) format for the Ievolve Event Management System. Create comprehensive test scenarios covering all validation rules, edge cases, and business logic requirements.

## Required Output Format

**File Format**: PSV with pipe separator `|`
**Header Row**: Required
**Columns**: 14 columns as specified below
**Records**: Generate 25-30 hotel records with diverse scenarios

```
hotelId|instanceCode|hotelName|location|district|address|pincode|pointOfContact|contactPhoneNumber|startDate|endDate|totalRooms|occupiedRooms|availableRooms
```

## Data Generation Requirements

### Hotel ID Patterns (hotelId)
Generate diverse hotel ID formats:
- **Tournament Style**: TR-001, TR-002, TR-025
- **City Codes**: CHN-001, BLR-002, MDU-003, CBE-004
- **Event Codes**: CM2025-001, SPORTS-2025-015
- **Mixed Format**: HOTEL-999, INN-2025-A, RESORT-150
- **Simple Numeric**: H001, H025, VENUE-50

### Instance Management (instanceCode)
Create multiple instances for same hotels:
- Hotel TR-001: instances 1, 2, 3 (different date ranges)
- Hotel CHN-005: instances 1, 2 (different periods)
- Hotel BLR-010: instances 1, 2, 3, 4 (quarterly bookings)
- Ensure property details remain identical across instances
- Only dates and room availability should vary

### Geographic Coverage (location/district)
**Tamil Nadu Focus** with realistic locations:
- **Chennai**: T.Nagar, Adyar, Anna Nagar, Egmore, Mylapore
- **Coimbatore**: RS Puram, Peelamedu, Saibaba Colony
- **Madurai**: Anna Nagar, K.K.Nagar, Goripalayam
- **Tiruchirappalli**: Cantonment, Srirangam, Thillai Nagar
- **Salem**: Five Roads, Fairlands, Cherry Road
- **Vellore**: Gandhi Nagar, Katpadi, Officers Line

### Hotel Categories & Names
**Luxury Hotels** (100-300 rooms):
- The Leela Palace Chennai
- ITC Grand Chola
- Taj Coromandel
- Hyatt Regency Chennai
- Marriott Executive Apartments

**Mid-Range Hotels** (50-150 rooms):
- Hotel Savera
- GRT Grand Days
- The Residency Towers
- Hotel Palmshore
- Fortune Select Grand

**Budget Hotels** (25-75 rooms):
- Hotel Kanchi
- Raj Park Hotel
- Hotel Mass
- City Tower Hotel
- Hotel Rathna Residency

**Business Hotels** (40-120 rooms):
- Hotel Vijay Park Inn
- Green Park Hotels
- Hotel Picnic
- Shelter Hotel
- Park Plaza

### Realistic Address Patterns
**Chennai Addresses**:
- 123 Anna Salai, T.Nagar, Chennai
- 45 Mount Road, Guindy, Chennai  
- 78 Cathedral Road, Gopalapuram, Chennai
- 234 ECR Road, Besant Nagar, Chennai

**Other Cities**:
- 56 Cross Cut Road, Coimbatore
- 89 West Masi Street, Madurai
- 12 Collector Office Road, Tiruchirappalli
- 67 Omalur Main Road, Salem

### Contact Information
**Point of Contact Names**:
- Mr. Rajesh Kumar (Manager)
- Ms. Priya Sharma (Assistant Manager)
- Mr. Suresh Babu (Front Office Manager)
- Ms. Lakshmi Devi (Operations Head)
- Mr. Karthik Raman (Guest Relations)

**Phone Numbers** (Indian format):
- +91 9876543210
- +91 9987654321
- +91 8765432109
- +91 7654321098
- 044-28234567 (Chennai landline)
- 0422-2345678 (Coimbatore landline)

### Date Range Scenarios

**Current Year (2025) Bookings**:
- **Q3 2025**: July-September events
- **Q4 2025**: October-December tournaments
- **Year-end**: December-January overlap

**Realistic Date Patterns**:
- **Short Events**: 3-7 days (weekend tournaments)
- **Medium Events**: 7-14 days (district championships)  
- **Long Events**: 14-30 days (state level competitions)
- **Training Camps**: 21-45 days (extended programs)

**Specific Date Examples**:
- 2025-08-15 to 2025-08-22 (7 days)
- 2025-09-10 to 2025-09-20 (10 days)
- 2025-10-05 to 2025-10-25 (20 days)
- 2025-11-15 to 2025-12-15 (30 days)

### Room Inventory Logic

**Capacity Distribution**:
- **Large Hotels**: 200-300 total rooms
- **Medium Hotels**: 75-150 total rooms  
- **Small Hotels**: 25-75 total rooms
- **Boutique**: 15-40 total rooms

**Occupancy Scenarios**:
- **New Bookings**: occupiedRooms = 0, availableRooms = totalRooms
- **Partial Occupancy**: occupiedRooms = 10-30% of total
- **High Occupancy**: occupiedRooms = 60-80% of total
- **Full Occupancy**: occupiedRooms = totalRooms, availableRooms = 0

### Validation Test Cases

**Edge Cases to Include**:
1. **Minimum Values**: 1 room hotels, 1-day bookings
2. **Maximum Values**: 300+ room hotels, 45-day bookings
3. **Date Conflicts**: Same hotel different instances with overlapping dates (should fail)
4. **Perfect Overlaps**: Same hotel instances with adjacent date ranges
5. **Gap Periods**: Same hotel with gaps between instance dates
6. **Room Logic**: Ensure availableRooms + occupiedRooms = totalRooms

**Business Rule Testing**:
1. **Property Consistency**: Same hotel details across instances
2. **Realistic Geography**: Matching pincode with location/district
3. **Contact Validation**: Proper phone number formats
4. **Date Logic**: End date always after start date

### Indian Context Specifics

**Postal Codes (Pincode)**:
- Chennai: 600001-600119
- Coimbatore: 641001-641108  
- Madurai: 625001-625022
- Tiruchirappalli: 620001-620024
- Salem: 636001-636016
- Vellore: 632001-632014

**Cultural Names**:
- Hotel Sri Venkateshwara
- Sangam Hotel  
- Hotel Tamil Nadu
- Lakshmi Residency
- Kaveri Lodge

## Expected Output Format

**Important**: Start your PSV file with the exact header row, then add the data rows.

```
hotelId|instanceCode|hotelName|location|district|address|pincode|pointOfContact|contactPhoneNumber|startDate|endDate|totalRooms|occupiedRooms|availableRooms
TR-001|1|The Leela Palace Chennai|T.Nagar|Chennai|123 Anna Salai, T.Nagar|600017|Mr. Rajesh Kumar|+91 9876543210|2025-08-15|2025-08-22|200|0|200
TR-001|2|The Leela Palace Chennai|T.Nagar|Chennai|123 Anna Salai, T.Nagar|600017|Mr. Rajesh Kumar|+91 9876543210|2025-10-01|2025-10-15|200|15|185
CHN-005|1|ITC Grand Chola|Guindy|Chennai|45 Mount Road, Guindy|600032|Ms. Priya Sharma|044-28234567|2025-09-10|2025-09-25|250|25|225
BLR-010|1|Taj West End|Brigade Road|Bangalore Urban|25 Race Course Road, Bangalore|560001|Mr. Suresh Babu|+91 8765432109|2025-11-01|2025-11-14|180|0|180
```

## Quality Checklist

**Data Validation Requirements**:
- [ ] All required fields populated
- [ ] Realistic hotel names and locations
- [ ] Valid Indian postal codes
- [ ] Proper phone number formats
- [ ] Logical date ranges (end > start)
- [ ] Room math accuracy (available + occupied = total)
- [ ] Consistent property details across instances
- [ ] No date overlaps for same hotel
- [ ] Mix of occupancy scenarios
- [ ] Diverse hotel ID formats

**Business Logic Validation**:
- [ ] Geographic accuracy (pincode matches location)
- [ ] Realistic room counts for hotel types
- [ ] Appropriate contact information
- [ ] Event-appropriate date ranges
- [ ] Tamil Nadu sporting event context

## Final Instructions

1. **Start with the header row**: Always begin output with the exact column names as specified
2. **Generate exactly 25-30 records** covering all scenarios
3. **Include 5-7 hotels with multiple instances** to test instance logic
4. **Ensure data realism** - use actual Tamil Nadu locations and realistic hotel names
5. **Test edge cases** - include minimum/maximum values and boundary conditions
6. **Maintain consistency** - same hotel properties across instances
7. **Validate output** - double-check all business rules and constraints

**Critical**: Your output must be ready-to-use PSV format starting with:
```
hotelId|instanceCode|hotelName|location|district|address|pincode|pointOfContact|contactPhoneNumber|startDate|endDate|totalRooms|occupiedRooms|availableRooms
```

Create comprehensive test data that thoroughly validates the hotel inventory system while maintaining realistic Indian hospitality industry context.