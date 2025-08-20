# Dynamic Occupancy System Implementation

## Overview
The Ievolve Event Management System now features a **dynamic occupancy calculation system** that automatically updates hotel room occupancy based on participant assignments using intelligent room-sharing rules.

## Key Features Implemented

### 1. Dynamic Room Calculation Rules
- **Players:** 3 participants per room
- **Coaches:** 2 participants per room  
- **Officials:** 1 participant per room

### 2. Automatic Occupancy Updates
The system automatically recalculates occupancy when:
- ✅ **Participant uploads** (coaches/officials/players)
- ✅ **Participant modifications** (hotel reassignments)
- ✅ **Participant deletions** (removed from system)
- ✅ **Manual recalculation** (admin trigger)

### 3. Real-Time Data Flow
```
Participant Assignment → Room Calculation → Hotel Occupancy Update → UI Refresh
```

## Implementation Details

### Backend Changes

#### New Storage Methods
```javascript
// server/storage.ts
calculateHotelOccupancy(hotelId, instanceCode)    // Calculate rooms needed
updateHotelOccupancy(hotelId, instanceCode)       // Update specific hotel
updateAllHotelOccupancy()                         // Update all hotels
```

#### Upload Services Enhanced
- `uploadCoachesOfficials()` - Auto-updates hotel occupancy after upload
- `uploadPlayers()` - Auto-updates hotel occupancy after upload
- Both methods call `updateHotelOccupancy()` for each participant added

#### API Routes Updated
- `PUT /api/admin/participants/:id` - Updates occupancy on hotel reassignment
- `DELETE /api/admin/participants/:id` - Updates occupancy on participant removal
- `POST /api/admin/recalculate-occupancy` - Manual recalculation endpoint

### Frontend Changes

#### New Component
- `RecalculateOccupancy` - Manual recalculation interface with room sharing rules display

#### Updated Dashboard
- Hotel management section now includes dynamic occupancy control
- Real-time occupancy updates reflected in hotel table
- Manual recalculation button for administrators

## Room Sharing Logic

### Calculation Formula
```javascript
const playerRooms = Math.ceil(playerCount / 3);
const coachRooms = Math.ceil(coachCount / 2);
const officialRooms = officialCount;
const totalOccupiedRooms = playerRooms + coachRooms + officialRooms;
```

### Example Calculation
**Scenario:** Hotel CHN001 has:
- 15 Players → Math.ceil(15/3) = 5 rooms
- 6 Coaches → Math.ceil(6/2) = 3 rooms  
- 4 Officials → 4 rooms
- **Total:** 12 occupied rooms

## Benefits of Dynamic System

### For Event Management
1. **Accurate Planning:** Real-time capacity requirements
2. **Efficient Allocation:** Optimal room utilization
3. **Cost Control:** Precise accommodation budgeting
4. **Scalability:** Handles participant changes dynamically

### For Administrators
1. **Live Updates:** No manual recalculation needed
2. **Transparency:** Clear room sharing rules
3. **Flexibility:** Manual override capability
4. **Audit Trail:** All changes logged automatically

## Data Consistency

### Automatic Triggers
- Participant uploads automatically trigger occupancy updates
- Hotel reassignments update both old and new hotels
- Participant deletions immediately reduce occupancy

### Manual Override
- Admin can force recalculation for all hotels
- Useful for data cleanup or verification
- One-click operation with full system update

## Validation & Error Handling

### Upload Validation
- Hotel existence validation before participant assignment
- Minimum stay duration requirements (3+ days)
- Duplicate participant prevention

### Occupancy Constraints
- Available rooms cannot go below zero
- Total rooms serve as maximum capacity
- Real-time feedback on capacity exceeded

## Performance Considerations

### Efficient Updates
- Single-hotel updates for individual changes
- Bulk updates only when necessary
- Optimized database queries with targeted updates

### Caching Strategy
- Frontend query invalidation on occupancy changes
- Real-time UI updates without full page reload
- Background processing for large uploads

## Migration from Static System

### Before (Static)
- Fixed occupancy values stored in database
- Manual updates required for changes
- No relationship to actual participant assignments

### After (Dynamic)
- Calculated occupancy based on participants
- Automatic updates on data changes
- Real-time reflection of actual requirements

## Future Enhancements

### Potential Additions
1. **Date-based Occupancy:** Track daily occupancy variations
2. **Room Type Matching:** Different sharing rules by room type
3. **Gender-based Allocation:** Separate room assignments by gender
4. **Custom Sharing Rules:** Hotel-specific accommodation policies

## Testing & Validation

### Upload Testing
1. Upload coaches/officials data
2. Verify occupancy calculation
3. Check room sharing rules applied correctly

### Modification Testing
1. Change participant hotel assignment
2. Verify old hotel occupancy decreased
3. Verify new hotel occupancy increased

### Manual Recalculation
1. Click "Recalculate Occupancy" button
2. Verify all hotels updated simultaneously
3. Check audit log for recalculation entry

## Troubleshooting

### Common Issues
1. **Occupancy not updating:** Check participant hotel assignments
2. **Incorrect calculations:** Verify room sharing rules applied
3. **Manual recalculation fails:** Check admin permissions and database connection

### Debug Steps
1. Check browser console for errors
2. Verify API endpoints responding correctly
3. Review audit logs for update attempts
4. Validate participant data integrity

## Summary

The dynamic occupancy system transforms the Ievolve Event Management System from a static room tracking tool into an intelligent accommodation planning platform. By automatically calculating room requirements based on participant assignments and room-sharing rules, the system provides accurate, real-time occupancy data that supports efficient event management and cost-effective accommodation planning.