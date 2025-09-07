# Hotel Occupancy Rate Calculation - Detailed Explanation (UPDATED - Dynamic System)

## Overview
The occupancy rate in the Ievolve Event Management System is now **DYNAMIC** and updates automatically based on participant assignments. The system calculates room requirements using intelligent room-sharing rules and updates occupancy in real-time when participants are uploaded, modified, or deleted.

## How Occupancy Rate is Calculated

### Individual Hotel Occupancy (58/70 = 83% in your example)

**Formula:**
```
Occupied Rooms = Total Rooms - Available Rooms
Occupancy Percentage = (Occupied Rooms ÷ Total Rooms) × 100
```

**From your screenshot (Raj Park Hotel):**
- **Total Rooms:** 70
- **Available Rooms:** 12  
- **Occupied Rooms:** 70 - 12 = 58
- **Occupancy Rate:** (58 ÷ 70) × 100 = 83%

### Database Schema Fields

Each hotel record contains these key fields:
```sql
totalRooms: integer          -- Maximum capacity (e.g., 70)
availableRooms: integer      -- Currently unoccupied (e.g., 12)  
occupiedRooms: integer       -- Currently occupied (e.g., 58)
```

**Important:** The `occupiedRooms` field is stored in the database but the calculation primarily uses:
`Occupied Rooms = Total Rooms - Available Rooms`

## What the Occupancy Rate Represents

### **Dynamic Room Allocation** (Participant-Based)
The occupancy rate now shows:
- ✅ **Real-time room requirements** based on assigned participants
- ✅ **Intelligent room sharing** using defined rules
- ✅ **Automatic updates** when participant data changes
- ✅ **Accurate capacity planning** for event management

### **Room Sharing Rules**
The system uses these intelligent allocation rules:
- 👥 **3 Players per room** - Players share accommodation
- 👔 **2 Coaches per room** - Coaches share double occupancy
- 🏛️ **1 Official per room** - Officials get individual rooms

### **What the System Does NOT Track**
The occupancy rate does NOT show:
- ❌ **Today's actual check-in status**
- ❌ **Physical presence in hotels**
- ❌ **Date-specific daily utilization**

## Code Implementation

### Frontend Calculation
```javascript
// In hotel-table.tsx (line 426-428)
const occupiedRooms = hotel.totalRooms - hotel.availableRooms;
const occupancyPercentage = Math.round((occupiedRooms / hotel.totalRooms) * 100);
```

### Backend Dashboard Stats
```javascript
// In storage.ts (line 487-489)
const totalRooms = allHotels.reduce((sum, hotel) => sum + hotel.totalRooms, 0);
const occupiedRooms = allHotels.reduce((sum, hotel) => sum + (hotel.occupiedRooms || 0), 0);
const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;
```

## Hotel Status vs. Occupancy Rate

### Hotel Status (Date-Based)
- **Upcoming:** Start date is in the future
- **Active:** Current date is between start and end date
- **Expired:** End date has passed

### Occupancy Rate (Room-Based)
- **Independent of dates**
- **Based purely on room allocation**
- **Shows administrative booking status**

## Example from Your Screenshot

**Raj Park Hotel (ID: B-002)**
- **Date Range:** 26/12/2025 to 01/01/2026 (December 26, 2025 to January 1, 2026)
- **Status:** Upcoming (because start date is in future)
- **Occupancy:** 58/70 = 83% (based on current room allocation)
- **Instance:** 1

**Key Insight:** Even though this hotel's booking period is in the future (Upcoming status), it already shows 83% occupancy because 58 rooms have been allocated to participants for that future period.

## When Does Occupancy Rate Change?

The occupancy rate changes when:

1. **Participants are assigned** to hotels (increases occupancy)
2. **Participants are reassigned** to different hotels (decreases original, increases new)
3. **Hotel room inventory is updated** manually by admin
4. **Bulk uploads** of participant data with hotel assignments

## Practical Implications

### For Event Planning
- **83% occupancy** means most rooms are already allocated
- **Only 12 rooms available** for additional participants  
- **Administrative planning** is well advanced for this hotel

### For Real-Time Management
- **Check-in status** is tracked separately in the participants table
- **Actual room utilization** would require checking participant check-in times
- **Date-based availability** requires looking at hotel start/end dates

## Visual Indicators

### Occupancy Color Coding
- **🔴 90%+ (Red):** Full - Critical capacity
- **🟡 70-89% (Yellow):** High - Limited availability  
- **🔵 30-69% (Blue):** Medium - Moderate availability
- **🟢 0-29% (Green):** Low - Plenty of availability

**Your hotel at 83%** falls in the **High (Yellow)** category, indicating limited remaining capacity.

## Summary

The **58/70 = 83%** occupancy rate you see represents:
- **Administrative allocation:** 58 rooms are assigned to participants
- **Static calculation:** Based on current database values
- **Planning status:** Shows how full the hotel is booked
- **Not date-dependent:** Independent of today's date or hotel's active period

This system is designed for **event planning and room allocation management** rather than real-time hotel operations tracking.