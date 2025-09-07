# Coach & Official Data Upload Format Guide

## Overview

This guide provides comprehensive specifications for uploading coach and official participant data to the Ievolve Event Management System. The system processes coach and official registration data with accommodation assignments, booking details, and contact information.

## File Format Specifications

**File Format**: PSV with pipe separator `|`
**Header Row**: Required (must match exactly)
**Columns**: 15 columns as specified below
**File Extension**: `.psv` or `.csv`

```
ROLE|COACH_ID|NAME|MOBILE_NUMBER|DISCIPLINE|LOCATION|DISTRICT|HOTEL_ID|STADIUM|BOOKING_START_DATE|BOOKING_END_DATE|BOOKING_REFERENCE_NUMBER|NOTIFY_TRANSPORT_CONTACT|TRAVEL_POC_NAME|TRAVEL_POC_MOBILE|VENUE_POC_NAME|VENUE_POC_MOBILE
```

## Required Columns & Validation Rules

### 1. ROLE
- **Type**: Text
- **Required**: Yes
- **Valid Values**: "coach", "official"
- **Case Sensitive**: No (system normalizes to lowercase)
- **Example**: `coach` or `official`

### 2. COACH_ID
- **Type**: Text (Unique Identifier)
- **Required**: Yes
- **Format**: Alphanumeric with hyphens/underscores allowed
- **Validation**: Must be unique across all participants
- **Example**: `COACH-001`, `OFF-2025-015`, `TN-COACH-25`

### 3. NAME
- **Type**: Text
- **Required**: Yes
- **Min Length**: 2 characters
- **Max Length**: 100 characters
- **Format**: Full name with proper capitalization
- **Example**: `Dr. Rajesh Kumar`, `Ms. Priya Sharma`

### 4. MOBILE_NUMBER
- **Type**: Text
- **Required**: No (but recommended)
- **Format**: Indian mobile number with/without country code
- **Auto-Processing**: System adds +91 prefix if missing
- **Validation**: 10-digit number after country code
- **Examples**: 
  - `9876543210` (auto-converted to +919876543210)
  - `+919876543210`

### 5. DISCIPLINE
- **Type**: Text
- **Required**: Yes
- **Format**: Sport/activity name
- **Example**: `Cricket`, `Football`, `Badminton`, `Athletics`, `Swimming`

### 6. LOCATION
- **Type**: Text
- **Required**: Yes
- **Format**: City/venue location
- **Example**: `Chennai`, `Coimbatore`, `Madurai`, `Tiruchirappalli`

### 7. DISTRICT
- **Type**: Text
- **Required**: Yes
- **Format**: Tamil Nadu district name
- **Example**: `Chennai`, `Coimbatore`, `Madurai`, `Tiruchirappalli`, `Salem`

### 8. HOTEL_ID
- **Type**: Text
- **Required**: Yes
- **Validation**: Must exist in hotel inventory
- **Cross-Reference**: System validates against uploaded hotel data, hotel name automatically fetched
- **Example**: `HOTEL-001`, `CHN-HOTEL-5`, `CM2025-015`

### 9. STADIUM
- **Type**: Text
- **Required**: No
- **Format**: Venue/stadium name
- **Example**: `M. A. Chidambaram Stadium`, `Nehru Stadium`

### 10. BOOKING_START_DATE
- **Type**: Date
- **Required**: Yes
- **Format**: DD/MM/YYYY
- **Validation**: Must be valid date
- **Business Rule**: Check-in date for accommodation
- **Example**: `15/08/2025`

### 11. BOOKING_END_DATE
- **Type**: Date
- **Required**: Yes
- **Format**: DD/MM/YYYY
- **Validation**: Must be after start date
- **Business Rule**: Minimum 3-day stay duration required
- **Example**: `20/08/2025`

### 12. BOOKING_REFERENCE_NUMBER
- **Type**: Text
- **Required**: No
- **Format**: Reference/confirmation number
- **Example**: `BK2025001`, `REF-CHN-001`

### 13. NOTIFY_TRANSPORT_CONTACT
- **Type**: Text
- **Required**: No
- **Format**: Transport notification contact details
- **Example**: `Mr. Kumar - 9876543210`, `Chennai Bus Stand`

### 14. TRAVEL_POC_NAME
- **Type**: Text
- **Required**: No
- **Format**: Travel point of contact name
- **Example**: `Mr. Rajesh Kumar`, `Ms. Priya Sharma`

### 15. TRAVEL_POC_MOBILE
- **Type**: Text
- **Required**: No
- **Format**: Travel POC mobile number
- **Auto-Processing**: System adds +91 prefix if missing
- **Example**: `9876543210`, `+919876543210`

### 16. VENUE_POC_NAME
- **Type**: Text
- **Required**: No
- **Format**: Venue point of contact name
- **Example**: `Mr. Venue Manager`, `Stadium Coordinator`

### 17. VENUE_POC_MOBILE
- **Type**: Text
- **Required**: No
- **Format**: Venue POC mobile number
- **Auto-Processing**: System adds +91 prefix if missing
- **Example**: `9876543210`, `+919876543210`

## Business Rules & Validations

### Mandatory Validations
1. **Minimum Stay Duration**: 3 days minimum booking period
2. **Hotel Existence**: HOTEL_ID must exist in inventory system
3. **Unique Participant ID**: COACH_ID must be unique across all participants
4. **Date Logic**: BOOKING_END_DATE must be after BOOKING_START_DATE

### Data Processing Rules
1. **Mobile Number Normalization**: Auto-adds +91 country code for all mobile fields
2. **Role Standardization**: Converts to lowercase
3. **Duplicate Handling**: Warnings for existing participants
4. **Hotel Validation**: Cross-checks against hotel inventory, hotel name fetched automatically
5. **Location Inheritance**: Players inherit location/district/discipline from coaches

## Sample Data Format

```
ROLE|COACH_ID|NAME|MOBILE_NUMBER|DISCIPLINE|LOCATION|DISTRICT|HOTEL_ID|STADIUM|BOOKING_START_DATE|BOOKING_END_DATE|BOOKING_REFERENCE_NUMBER|NOTIFY_TRANSPORT_CONTACT|TRAVEL_POC_NAME|TRAVEL_POC_MOBILE|VENUE_POC_NAME|VENUE_POC_MOBILE
coach|COACH-001|DR. RAJESH KUMAR|9876543210|Cricket|Chennai|Chennai|HOTEL-001|M. A. Chidambaram Stadium|15/08/2025|20/08/2025|BK2025001|Mr. Kumar Transport|Mr. Travel POC|9876543211|Mr. Venue POC|9876543212
official|OFF-001|MS. PRIYA SHARMA|9987654321|Football|Chennai|Chennai|HOTEL-002|Nehru Stadium|16/08/2025|22/08/2025|BK2025002|Chennai Central|Ms. Official Travel|9987654322|Ms. Stadium Manager|9987654323
coach|TN-COACH-25|MR. SURESH BABU|8765432109|Badminton|Coimbatore|Coimbatore|CHN-001|Express Sports Complex|14/08/2025|18/08/2025|REF-CHN-001|Bus Terminal POC|Mr. Coimbatore Travel|8765432110|Mr. Complex Manager|8765432111
```

## Common Validation Errors

### Critical Errors (Upload Fails)
- **Missing Required Headers**: All 12 columns must be present
- **Invalid Hotel ID**: Hotel not found in inventory
- **Insufficient Stay Duration**: Less than 3 days booking
- **Invalid Date Format**: Incorrect DD/MM/YYYY format
- **Invalid Date Logic**: End date before start date

### Warnings (Upload Continues)
- **Duplicate Participant**: COACH_id already exists
- **Hotel Name Mismatch**: Name doesn't match inventory
- **Missing Optional Fields**: Empty Stadium or Transport_POC

## Data Preparation Tips

### Before Upload
1. **Verify Hotel Inventory**: Ensure all Hotel_IDs exist in system
2. **Check Date Ranges**: Minimum 3-day booking periods
3. **Validate Mobile Numbers**: Use standard 10-digit format
4. **Standardize Names**: Proper capitalization and formatting

### Quality Checks
1. **No Empty Required Fields**: ROLE, COACH_id, Name, Discipline, Hotel_ID, dates
2. **Consistent Date Format**: DD/MM/YYYY throughout
3. **Unique Identifiers**: No duplicate COACH_id values
4. **Valid Hotel References**: Cross-check with hotel inventory

## Technical Specifications

- **Character Encoding**: UTF-8
- **File Size Limit**: 10MB maximum
- **Row Limit**: 5,000 participants per upload
- **Separator**: Pipe character `|` only
- **Line Endings**: Unix (LF) or Windows (CRLF) compatible

## Upload Process Flow

1. **File Validation**: Format and header verification
2. **Data Parsing**: Row-by-row processing
3. **Business Rule Checks**: Date, hotel, and stay validations
4. **Cross-References**: Hotel and coach existence verification
5. **Data Insertion**: Create participant records
6. **Result Summary**: Success count, errors, and warnings report

This format ensures accurate coach and official data import with proper accommodation assignments and booking management for the CM Trophy 2025 event system.