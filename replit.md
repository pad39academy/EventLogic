# Ievolve Event Management System

## Overview

This is a comprehensive event management system built for the Ievolve Events organization. The application manages hotel accommodations, participant check-ins/check-outs, and team coordination for sports events. It features role-based access control with Admin and Team Coach dashboards, file upload capabilities for data management, and real-time notification systems. The system is designed to handle large-scale sporting events with multiple hotels, teams, and participants across different disciplines and locations.

## Recent Changes (August 2025)

- **Dynamic Occupancy System**: Implemented intelligent room allocation replacing static occupancy with real-time participant-based calculations using room sharing rules (3 players, 2 coaches, 1 official per room)
- **Automatic Occupancy Updates**: Upload processes, participant modifications, and deletions now automatically trigger hotel occupancy recalculation with manual override capability
- **Fresh Test Data Generated**: Complete database refresh with realistic 2025 Chief Minister Trophy data including 5 coaches, 50 players, 5 officials, and 5 hotels with multiple instances (13 total) across different date ranges
- **Cascading Hotel Updates**: Property-wide fields (address, location, pincode, district) now update across ALL instances of the same hotel while keeping room counts and dates instance-specific
- **Auto +91 Country Code**: Team coach login automatically adds +91 country code prefix with visual indicators and 10-digit validation
- **Custom Domain Support**: Added white-label error handling to hide Replit branding during server downtime with professional maintenance pages
- **Mobile-Optimized iframe**: Enhanced iframe wrapper with server monitoring, auto-recovery, and mobile-responsive scaling for customer demonstrations
- **Data Management Scripts**: Created cleanup and generation scripts for fresh test data with PSV export capabilities
- **Hotel Instance System**: Implemented numeric instance codes (1, 2, 3, etc.) for same hotels with different booking date ranges, replacing alphabetic codes
- **Hotel Status Tracking**: Added real-time status calculation (active, upcoming, expired) based on current date vs hotel booking dates with filtering capabilities
- **Hotel Edit Functionality**: Comprehensive hotel editing with date conflict validation, audit logging, and cascading property updates
- **Professional Demo Setup**: Complete solution for customer demos using custom domains without exposing Replit infrastructure
- **Manual Hotel Addition**: Dual-mode system with "New Hotel" and "Add Instance" options, smart validation, auto-population, and form reset functionality
- **Comprehensive Data Format Guide**: Created detailed PSV format specification with validation rules for hotel data uploads
- **AI Test Data Generation**: Created comprehensive Gemini prompt for generating realistic hotel inventory test data covering all validation scenarios and Tamil Nadu hospitality context
- **White-Label Error Handling**: Implemented comprehensive error handling system to hide Replit branding from customers with professional maintenance pages and custom 404 handling
- **Complete Offline Protection**: Created static error pages and reverse proxy configuration for 100% white-label experience even during complete server failures
- **Indian Date Format Implementation**: Fixed date formatting to use DD/MM/YYYY consistently and prevent timezone-related date shifts in hotel inventory management

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **React with TypeScript**: Modern component-based UI using functional components and hooks
- **Vite Build Tool**: Fast development server and optimized production builds
- **TanStack Query**: Server state management with caching and synchronization
- **Wouter**: Lightweight client-side routing
- **shadcn/ui Components**: Comprehensive UI component library built on Radix UI primitives with Table components for data display
- **Tailwind CSS**: Utility-first styling with custom design system variables
- **Responsive Design**: Mobile-first approach with adaptive layouts
- **Data Tables**: Professional table layouts for managing participants and hotel inventory

### Backend Architecture
- **Express.js**: RESTful API server with middleware-based architecture
- **TypeScript**: End-to-end type safety with shared schemas
- **Session-based Authentication**: Express sessions with PostgreSQL storage
- **MVC Pattern**: Organized service layer, storage abstraction, and route handlers
- **File Upload Processing**: Multer integration for CSV/PSV file handling
- **OTP System**: SMS-based authentication for coaches

### Database Design
- **PostgreSQL with Neon**: Serverless PostgreSQL database
- **Drizzle ORM**: Type-safe database operations with schema definitions
- **Relational Structure**: 
  - Users table for admins and coaches
  - Hotels table with instance-based inventory management
  - Participants table supporting coaches, officials, and players
  - Audit logging and reassignment tracking
- **Data Validation**: Unique constraints, date range validation, and referential integrity

### Authentication & Authorization
- **Dual Authentication System**:
  - Admin: Email/password with bcrypt hashing
  - Coach: Mobile number + OTP verification
- **Role-based Access Control**: Admin and coach roles with different permissions
- **Session Management**: Secure session storage with PostgreSQL backend
- **Route Protection**: Middleware-based authentication checks

### File Processing System
- **Multi-format Support**: CSV and PSV file uploads
- **Validation Engine**: Data integrity checks and duplicate prevention
- **Bulk Operations**: Efficient batch processing for large datasets
- **Error Handling**: Comprehensive validation reporting with warnings and errors

### Real-time Features
- **Notification System**: SMS integration for status updates and booking changes
- **Dashboard Analytics**: Real-time statistics and occupancy tracking
- **Status Management**: Check-in/check-out workflow with validation rules

## External Dependencies

### Database Services
- **Neon PostgreSQL**: Serverless PostgreSQL database hosting
- **Drizzle Kit**: Database migrations and schema management

### UI Framework & Components
- **Radix UI**: Comprehensive set of accessible UI primitives
- **Lucide React**: Icon library for consistent iconography
- **React Hook Form**: Form validation and state management
- **Zod**: Runtime type validation and schema definition

### Development & Build Tools
- **Vite**: Frontend build tool and development server
- **TypeScript**: Static type checking across the entire stack
- **Tailwind CSS**: Utility-first CSS framework
- **PostCSS**: CSS processing and optimization

### Authentication & Security
- **bcryptjs**: Password hashing for admin accounts
- **Express Session**: Session management middleware
- **Connect PG Simple**: PostgreSQL session store

### File Handling & Processing
- **Multer**: Multipart form data and file upload handling
- **CSV/PSV Parsers**: Custom parsing logic for data import

### Notification Services
- **SMS Integration**: Planned integration with Twilio or similar service for OTP and notifications

### Development Environment
- **Replit Integration**: Development environment optimization with runtime error handling
- **WebSocket Support**: Real-time connection capabilities for live updates