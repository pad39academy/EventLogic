# Coach & Official Data Upload Format Guide

## Overview

This guide provides comprehensive specifications for uploading coach and official participant data to the Ievolve Event Management System. The system processes coach and official registration data with accommodation assignments, booking details, and contact information.

## File Format Specifications

**File Format**: PSV with pipe separator `|`
**Header Row**: Required (must match exactly)
**Columns**: 12 columns as specified below
**File Extension**: `.psv` or `.csv`

```
ROLE|COACH_id|Name|Mobile_Number|Discipline|Hotel_ID|Hotel_Name|Stadium|Booking_Start_Date|Booking_End_Date|Booking_Reference_Number|Transport_POC
```

## Required Columns & Validation Rules

### 1. ROLE
- **Type**: Text
- **Required**: Yes
- **Valid Values**: "coach", "official"
- **Case Sensitive**: No (system normalizes to lowercase)
- **Example**: `coach` or `official`

### 2. COACH_id
- **Type**: Text (Unique Identifier)
- **Required**: Yes
- **Format**: Alphanumeric with hyphens/underscores allowed
- **Validation**: Must be unique across all participants
- **Example**: `COACH-001`, `OFF-2025-015`, `TN-COACH-25`

### 3. Name
- **Type**: Text
- **Required**: Yes
- **Min Length**: 2 characters
- **Max Length**: 100 characters
- **Format**: Full name with proper capitalization
- **Example**: `Dr. Rajesh Kumar`, `Ms. Priya Sharma`

### 4. Mobile_Number
- **Type**: Text
- **Required**: No (but recommended)
- **Format**: Indian mobile number with/without country code
- **Auto-Processing**: System adds +91 prefix if missing
- **Validation**: 10-digit number after country code
- **Examples**: 
  - `9876543210` (auto-converted to +919876543210)
  - `+919876543210`

### 5. Discipline
- **Type**: Text
- **Required**: Yes
- **Format**: Sport/activity name
- **Example**: `Cricket`, `Football`, `Badminton`, `Athletics`, `Swimming`

### 6. Hotel_ID
- **Type**: Text
- **Required**: Yes
- **Validation**: Must exist in hotel inventory
- **Cross-Reference**: System validates against uploaded hotel data
- **Example**: `HOTEL-001`, `CHN-HOTEL-5`, `CM2025-015`

### 7. Hotel_Name
- **Type**: Text
- **Required**: Yes
- **Format**: Full hotel name
- **Validation**: Should match hotel inventory (warning if mismatch)
- **Example**: `The Leela Palace Chennai`, `Hotel Savera`

### 8. Stadium
- **Type**: Text
- **Required**: No
- **Format**: Venue/stadium name
- **Example**: `M. A. Chidambaram Stadium`, `Nehru Stadium`

### 9. Booking_Start_Date
- **Type**: Date
- **Required**: Yes
- **Format**: DD/MM/YYYY
- **Validation**: Must be valid date
- **Business Rule**: Check-in date for accommodation
- **Example**: `15/08/2025`

### 10. Booking_End_Date
- **Type**: Date
- **Required**: Yes
- **Format**: DD/MM/YYYY
- **Validation**: Must be after start date
- **Business Rule**: Minimum 3-day stay duration required
- **Example**: `20/08/2025`

### 11. Booking_Reference_Number
- **Type**: Text
- **Required**: No
- **Format**: Reference/confirmation number
- **Example**: `BK2025001`, `REF-CHN-001`

### 12. Transport_POC
- **Type**: Text
- **Required**: No
- **Format**: Transport point of contact details
- **Example**: `Mr. Kumar - 9876543210`, `Chennai Bus Stand`

## Business Rules & Validations

### Mandatory Validations
1. **Minimum Stay Duration**: 3 days minimum booking period
2. **Hotel Existence**: Hotel_ID must exist in inventory system
3. **Unique Participant ID**: COACH_id must be unique across all participants
4. **Date Logic**: Booking_End_Date must be after Booking_Start_Date

### Data Processing Rules
1. **Mobile Number Normalization**: Auto-adds +91 country code
2. **Role Standardization**: Converts to lowercase
3. **Duplicate Handling**: Warnings for existing participants
4. **Hotel Validation**: Cross-checks against hotel inventory

## Sample Data Format

```
ROLE|COACH_id|Name|Mobile_Number|Discipline|Hotel_ID|Hotel_Name|Stadium|Booking_Start_Date|Booking_End_Date|Booking_Reference_Number|Transport_POC
coach|COACH-001|Dr. Rajesh Kumar|9876543210|Cricket|HOTEL-001|The Leela Palace Chennai|M. A. Chidambaram Stadium|15/08/2025|20/08/2025|BK2025001|Mr. Kumar Transport
official|OFF-001|Ms. Priya Sharma|9987654321|Football|HOTEL-002|ITC Grand Chola|Nehru Stadium|16/08/2025|22/08/2025|BK2025002|Chennai Central
coach|TN-COACH-25|Mr. Suresh Babu|8765432109|Badminton|CHN-001|Hotel Savera|Express Sports Complex|14/08/2025|18/08/2025|REF-CHN-001|Bus Terminal POC
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