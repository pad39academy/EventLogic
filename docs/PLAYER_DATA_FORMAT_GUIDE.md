# Player Data Upload Format Guide

## Overview

This guide provides comprehensive specifications for uploading player participant data to the Ievolve Event Management System. The system processes player registration data with team assignments, coach relationships, accommodation details, and booking information.

## File Format Specifications

**File Format**: PSV with pipe separator `|`
**Header Row**: Required (must match exactly)
**Columns**: 9 columns as specified below
**File Extension**: `.psv` or `.csv`

```
COACH_ID|PLAYER_ID|PLAYER_NAME|MOBILE_NUMBER|TEAM_NAME|HOTEL_ID|BOOKING_REFERENCE|BOOKING_START_DATE|BOOKING_END_DATE
```

## Required Columns & Validation Rules

**Important Note**: Players no longer require `Discipline`, `District`, or `Location` columns in their data. These values are automatically inherited from their assigned coach's profile, ensuring consistency and reducing data redundancy.

### 1. COACH_ID
- **Type**: Text (Foreign Key)
- **Required**: Yes
- **Validation**: Must exist in coaches database
- **Cross-Reference**: Links player to registered coach
- **Example**: `COACH-001`, `TN-COACH-25`, `OFF-2025-015`

### 2. PLAYER_ID
- **Type**: Text (Unique Identifier)
- **Required**: Yes
- **Format**: Alphanumeric with hyphens/underscores allowed
- **Validation**: Must be unique across all participants
- **Example**: `PLAYER-001`, `TN-P-2025-150`, `CM-PLAYER-25`

### 3. PLAYER_NAME
- **Type**: Text
- **Required**: Yes
- **Min Length**: 2 characters
- **Max Length**: 100 characters
- **Format**: Full name with proper capitalization
- **Example**: `Arjun Tendulkar`, `Priya Krishnamurthy`

### 4. MOBILE_NUMBER
- **Type**: Text
- **Required**: No (but recommended for communication)
- **Format**: Indian mobile number with/without country code
- **Auto-Processing**: System adds +91 prefix if missing
- **Validation**: 10-digit number after country code
- **Examples**: 
  - `9876543210` (auto-converted to +919876543210)
  - `+919876543210`

### 5. TEAM_NAME
- **Type**: Text
- **Required**: Yes
- **Format**: Official team name
- **Example**: `Chennai Warriors`, `Coimbatore Lions`, `Madurai Eagles`

### 6. HOTEL_ID
- **Type**: Text
- **Required**: Yes
- **Validation**: Must exist in hotel inventory
- **Cross-Reference**: System validates against uploaded hotel data
- **Example**: `HOTEL-001`, `CHN-HOTEL-5`, `CM2025-015`

### 7. BOOKING_REFERENCE
- **Type**: Text
- **Required**: No
- **Format**: Booking confirmation number
- **Example**: `BK2025001`, `REF-PLR-001`, `CONFIRM-25-150`

### 8. BOOKING_START_DATE
- **Type**: Date
- **Required**: Yes
- **Format**: DD/MM/YYYY
- **Validation**: Must be valid date
- **Business Rule**: Player accommodation check-in date
- **Example**: `15/08/2025`

### 9. BOOKING_END_DATE
- **Type**: Date
- **Required**: Yes
- **Format**: DD/MM/YYYY
- **Validation**: Must be after start date
- **Business Rule**: Minimum 3-day stay duration required
- **Example**: `20/08/2025`

## Business Rules & Validations

### Mandatory Validations
1. **Coach Existence**: COACH_ID must exist in coaches database
2. **Hotel Existence**: HOTEL_ID must exist in inventory system
3. **Minimum Stay Duration**: 3 days minimum booking period
4. **Unique Player ID**: PLAYER_ID must be unique across all participants
5. **Date Logic**: BOOKING_END_DATE must be after BOOKING_START_DATE

### Data Processing Rules
1. **Mobile Number Normalization**: Auto-adds +91 country code
2. **Coach-Player Relationship**: Establishes team hierarchy
3. **Duplicate Handling**: Warnings for existing players
4. **Hotel Validation**: Cross-checks against hotel inventory, hotel name fetched automatically

### Team Management Rules
1. **Coach Assignment**: Players linked to their team coach
2. **Team Consistency**: Players should belong to same team as coach
3. **Inherited Properties**: Players automatically get discipline, district, and location from their assigned coach

## Sample Data Format

```
COACH_ID|PLAYER_ID|PLAYER_NAME|MOBILE_NUMBER|TEAM_NAME|HOTEL_ID|BOOKING_REFERENCE|BOOKING_START_DATE|BOOKING_END_DATE
COACH-001|PLAYER-001|ARJUN TENDULKAR|9876543210|Chennai Warriors|HOTEL-001|BK2025001|15/08/2025|20/08/2025
COACH-001|PLAYER-002|PRIYA KRISHNAMURTHY|9987654321|Chennai Warriors|HOTEL-001|BK2025002|15/08/2025|20/08/2025
TN-COACH-25|TN-P-001|KARTHIK RAJA|8765432109|Coimbatore Lions|CHN-001|REF-PLR-001|16/08/2025|22/08/2025
TN-COACH-25|TN-P-002|MEERA SUBRAMANIAN|7654321098|Coimbatore Lions|CHN-001|REF-PLR-002|16/08/2025|22/08/2025
```

## Common Validation Errors

### Critical Errors (Upload Fails)
- **Missing Required Headers**: All 9 columns must be present
- **Coach Not Found**: COACH_ID doesn't exist in database
- **Invalid Hotel ID**: Hotel not found in inventory
- **Insufficient Stay Duration**: Less than 3 days booking
- **Invalid Date Format**: Incorrect DD/MM/YYYY format
- **Invalid Date Logic**: End date before start date

### Warnings (Upload Continues)
- **Duplicate Player**: PLAYER_ID already exists
- **Team Mismatch**: Player team differs from coach team

## Data Preparation Tips

### Before Upload
1. **Verify Coach Database**: Ensure all COACH_IDs exist in system
2. **Check Hotel Inventory**: Confirm all HOTEL_IDs are available
3. **Validate Date Ranges**: Minimum 3-day booking periods
4. **Team Consistency**: Match players with correct coaches

### Quality Checks
1. **No Empty Required Fields**: COACH_ID, PLAYER_ID, PLAYER_NAME, TEAM_NAME, HOTEL_ID, dates
2. **Consistent Date Format**: DD/MM/YYYY throughout
3. **Unique Identifiers**: No duplicate PLAYER_ID values
4. **Valid References**: Cross-check coach and hotel existence

### Team Organization
1. **Coach-Player Mapping**: Group players under correct coaches
2. **Team Discipline Alignment**: Match player and team sports
3. **Accommodation Grouping**: Assign teammates to same hotels when possible

## Technical Specifications

- **Character Encoding**: UTF-8
- **File Size Limit**: 50MB maximum (larger player datasets)
- **Row Limit**: 10,000 players per upload
- **Separator**: Pipe character `|` only
- **Line Endings**: Unix (LF) or Windows (CRLF) compatible

## Upload Process Flow

1. **File Validation**: Format and header verification
2. **Data Parsing**: Row-by-row processing
3. **Coach Validation**: Verify COACH_ID existence
4. **Hotel Validation**: Confirm HOTEL_id availability
5. **Business Rule Checks**: Date, stay duration validations
6. **Team Relationship**: Establish coach-player links
7. **Data Insertion**: Create player participant records
8. **Result Summary**: Success count, errors, and warnings report

## Room Allocation Impact

Player uploads automatically trigger hotel occupancy recalculation based on:
- **Room Sharing Rules**: 3 players per room
- **Automatic Counts**: System updates occupied/available rooms
- **Coach Integration**: Players linked to coach accommodations
- **Team Grouping**: Preference for teammates in same hotel

This format ensures accurate player data import with proper team assignments, coach relationships, and accommodation management for the CM Trophy 2025 event system.