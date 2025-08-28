// Centralized date utilities for Indian format (DD/MM/YYYY) and consistent handling

/**
 * Formats a date to Indian format: DD/MM/YYYY
 * Handles Date objects, ISO strings, and various input formats
 */
export function formatToIndianDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  
  let dateObj: Date;
  if (typeof date === 'string') {
    // Parse ISO string or other string formats
    dateObj = new Date(date);
  } else {
    dateObj = date;
  }
  
  // Check if date is valid
  if (isNaN(dateObj.getTime())) {
    return '';
  }
  
  // Format as DD/MM/YYYY
  const day = dateObj.getDate().toString().padStart(2, '0');
  const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
  const year = dateObj.getFullYear();
  
  return `${day}/${month}/${year}`;
}

/**
 * Formats a date for HTML date input (YYYY-MM-DD)
 * Used in form inputs that expect ISO date format
 * Handles timezone properly to prevent date shifts
 */
export function formatForDateInput(date: Date | string | null | undefined): string {
  if (!date) return '';
  
  let dateObj: Date;
  if (typeof date === 'string') {
    dateObj = new Date(date);
  } else {
    dateObj = date;
  }
  
  if (isNaN(dateObj.getTime())) {
    return '';
  }
  
  // Use UTC date components to avoid timezone shift for database dates
  const year = dateObj.getUTCFullYear();
  const month = (dateObj.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = dateObj.getUTCDate().toString().padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Parses an Indian format date (DD/MM/YYYY) to a Date object
 */
export function parseIndianDate(dateString: string): Date | null {
  if (!dateString) return null;
  
  const parts = dateString.split('/');
  if (parts.length !== 3) return null;
  
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
  const year = parseInt(parts[2], 10);
  
  const date = new Date(year, month, day);
  
  // Validate the date
  if (date.getDate() !== day || date.getMonth() !== month || date.getFullYear() !== year) {
    return null;
  }
  
  return date;
}

/**
 * Creates a date at midnight UTC to avoid timezone issues
 * This ensures consistent date handling across different timezones
 */
export function createUTCDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

/**
 * Converts a date string from HTML input (YYYY-MM-DD) to UTC Date
 * Prevents timezone shifting issues
 */
export function parseInputDate(dateString: string): Date {
  if (!dateString) throw new Error('Date string is required');
  
  const parts = dateString.split('-');
  if (parts.length !== 3) throw new Error('Invalid date format');
  
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  
  return createUTCDate(year, month, day);
}

/**
 * Gets the current date in Indian timezone for comparison
 */
export function getCurrentIndianDate(): Date {
  const now = new Date();
  // Convert to Indian timezone (UTC+5:30)
  const indianTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
  // Return as date only (no time component)
  return new Date(indianTime.getFullYear(), indianTime.getMonth(), indianTime.getDate());
}

/**
 * Compares two dates ignoring time components
 */
export function compareDatesOnly(date1: Date | string, date2: Date | string): number {
  const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
  const d2 = typeof date2 === 'string' ? new Date(date2) : date2;
  
  const d1DateOnly = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate());
  const d2DateOnly = new Date(d2.getFullYear(), d2.getMonth(), d2.getDate());
  
  return d1DateOnly.getTime() - d2DateOnly.getTime();
}

/**
 * Calculates the difference in days between two dates
 */
export function daysDifference(startDate: Date | string, endDate: Date | string): number {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
  
  const startDateOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endDateOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  
  const diffTime = endDateOnly.getTime() - startDateOnly.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Formats date range for display in Indian format using UTC components
 * Prevents timezone shift issues for database dates
 */
export function formatDateRange(startDate: Date | string, endDate: Date | string): string {
  const start = formatToIndianDateUTC(startDate);
  const end = formatToIndianDateUTC(endDate);
  return `${start} → ${end}`;
}

/**
 * Formats a date to Indian format using UTC components (for database dates)
 * Prevents timezone shift issues that cause date display discrepancies
 */
export function formatToIndianDateUTC(date: Date | string | null | undefined): string {
  if (!date) return '';
  
  let dateObj: Date;
  if (typeof date === 'string') {
    dateObj = new Date(date);
  } else {
    dateObj = date;
  }
  
  if (isNaN(dateObj.getTime())) {
    return '';
  }
  
  // Use UTC components for database dates to prevent timezone shifts
  const day = dateObj.getUTCDate().toString().padStart(2, '0');
  const month = (dateObj.getUTCMonth() + 1).toString().padStart(2, '0');
  const year = dateObj.getUTCFullYear();
  
  return `${day}/${month}/${year}`;
}

/**
 * Formats a timestamp to IST (Indian Standard Time) format 
 * Returns: DD/MM/YYYY, HH:MM IST
 */
export function formatToIST(timestamp: Date | string | null | undefined): string {
  if (!timestamp) return '';
  
  let dateObj: Date;
  if (typeof timestamp === 'string') {
    dateObj = new Date(timestamp);
  } else {
    dateObj = timestamp;
  }
  
  if (isNaN(dateObj.getTime())) {
    return '';
  }
  
  // Convert to IST (UTC+5:30)
  const istOffset = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes in milliseconds
  const istTime = new Date(dateObj.getTime() + istOffset);
  
  const day = istTime.getUTCDate().toString().padStart(2, '0');
  const month = (istTime.getUTCMonth() + 1).toString().padStart(2, '0');
  const year = istTime.getUTCFullYear();
  const hours = istTime.getUTCHours().toString().padStart(2, '0');
  const minutes = istTime.getUTCMinutes().toString().padStart(2, '0');
  
  return `${day}/${month}/${year}, ${hours}:${minutes} IST`;
}