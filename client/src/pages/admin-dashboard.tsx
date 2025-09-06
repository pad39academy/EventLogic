import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { logout } from "@/lib/auth";
import { useLocation } from "wouter";
import { 
  Calendar, Bell, User, Upload, Download, Plus, Menu,
  Building, UserCheck, Users as UsersIcon, LogOut, Clock, Shield, Zap
} from "lucide-react";
import ievolveSymbol from "@/assets/logos/ievolve-symbol.jpg";
import StatsCards from "@/components/stats-cards";
import UploadModal from "@/components/upload-modal";
import ParticipantTable from "@/components/participant-table";
import HotelTable from "@/components/hotel-table";
import CheckoutBoard from "@/components/checkout-board";
import CheckinBoard from "@/components/checkin-board";
import AddHotelModal from "@/components/add-hotel-modal";
import { SendNotificationEnhanced } from "@/components/send-notification-enhanced";
import { AdminNotificationsList } from "@/components/admin-notifications-list";
import TimeWindowSettings from "@/components/time-window-settings";
import FailedBatchesSection from "@/components/failed-batches-section";

import type { DashboardStats } from "@/lib/types";

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [addHotelModalOpen, setAddHotelModalOpen] = useState(false);
  const [hotelAddMode, setHotelAddMode] = useState<"new" | "instance">("new");
  const [uploadType, setUploadType] = useState<"hotel_inventory" | "coaches_officials" | "players" | "">("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Get current user
  const { data: authData } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const response = await fetch("/api/auth/me", {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Not authenticated');
      }
      return await response.json();
    }
  });

  const user = authData?.user || null;

  // Get dashboard statistics
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/admin/dashboard/stats"],
    queryFn: async (): Promise<DashboardStats> => {
      const response = await fetch("/api/admin/dashboard/stats", {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard stats');
      }
      return await response.json();
    },
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Success", description: "Logged out successfully" });
      // Force navigation to login page
      setTimeout(() => {
        setLocation("/");
        window.location.reload();
      }, 500);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Logout failed",
        variant: "destructive",
      });
    },
  });

  // Export participants mutation
  const exportMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/export/participants", {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Export failed');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `participants-${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Data exported successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Export failed",
        variant: "destructive",
      });
    },
  });

  const handleUploadClick = (type: "hotel_inventory" | "coaches_officials" | "players") => {
    setUploadType(type);
    setUploadModalOpen(true);
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  if (statsLoading || !stats) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="animate-pulse">
          <div className="bg-white shadow-sm border-b border-gray-200 h-16"></div>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="h-8 bg-gray-200 rounded mb-4"></div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white p-5 rounded-lg shadow h-32"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Header */}
      <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0 flex items-center">
                <div className="h-8 w-8 rounded-lg overflow-hidden">
                  <img 
                    src={ievolveSymbol} 
                    alt="Ievolve" 
                    className="h-full w-full object-cover"
                  />
                </div>
                <span className="ml-3 text-xl font-semibold text-gray-900">Ievolve Events</span>
              </div>
              <div className="hidden md:block">
                <div className="ml-10 flex items-baseline space-x-4">
                  <button 
                    onClick={() => setActiveTab("dashboard")}
                    className={`px-3 py-2 rounded-md text-sm font-medium ${activeTab === "dashboard" ? "bg-primary-100 text-primary-700" : "text-gray-500 hover:text-gray-700"}`} 
                    data-testid="nav-dashboard"
                  >
                    Dashboard
                  </button>
                  <button 
                    onClick={() => setActiveTab("participants")}
                    className={`px-3 py-2 rounded-md text-sm font-medium ${activeTab === "participants" ? "bg-primary-100 text-primary-700" : "text-gray-500 hover:text-gray-700"}`}
                    data-testid="nav-participants"
                  >
                    Participants
                  </button>
                  <button 
                    onClick={() => setActiveTab("hotels")}
                    className={`px-3 py-2 rounded-md text-sm font-medium ${activeTab === "hotels" ? "bg-primary-100 text-primary-700" : "text-gray-500 hover:text-gray-700"}`}
                    data-testid="nav-hotels"
                  >
                    Hotels
                  </button>
                  <button 
                    onClick={() => setActiveTab("checkin")}
                    className={`px-3 py-2 rounded-md text-sm font-medium ${activeTab === "checkin" ? "bg-primary-100 text-primary-700" : "text-gray-500 hover:text-gray-700"}`}
                    data-testid="nav-checkin"
                  >
                    Check-in
                  </button>
                  <button 
                    onClick={() => setActiveTab("checkout")}
                    className={`px-3 py-2 rounded-md text-sm font-medium ${activeTab === "checkout" ? "bg-primary-100 text-primary-700" : "text-gray-500 hover:text-gray-700"}`}
                    data-testid="nav-checkout"
                  >
                    Checkout
                  </button>
                  <button 
                    onClick={() => setActiveTab("reports")}
                    className={`px-3 py-2 rounded-md text-sm font-medium ${activeTab === "reports" ? "bg-primary-100 text-primary-700" : "text-gray-500 hover:text-gray-700"}`}
                    data-testid="nav-reports"
                  >
                    Reports
                  </button>
                  <button 
                    onClick={() => setActiveTab("failed-batches")}
                    className={`px-3 py-2 rounded-md text-sm font-medium ${activeTab === "failed-batches" ? "bg-primary-100 text-primary-700" : "text-gray-500 hover:text-gray-700"}`}
                    data-testid="nav-failed-batches"
                  >
                    Failed Batches
                  </button>
                  <button 
                    onClick={() => setActiveTab("notifications")}
                    className={`px-3 py-2 rounded-md text-sm font-medium ${activeTab === "notifications" ? "bg-primary-100 text-primary-700" : "text-gray-500 hover:text-gray-700"}`}
                    data-testid="nav-notifications"
                  >
                    Send Notification
                  </button>
                  <button 
                    onClick={() => setActiveTab("database-optimize")}
                    className={`px-3 py-2 rounded-md text-sm font-medium ${activeTab === "database-optimize" ? "bg-primary-100 text-primary-700" : "text-gray-500 hover:text-gray-700"}`}
                    data-testid="nav-database-optimize"
                  >
                    <Zap className="h-4 w-4 mr-2 inline" />
                    DB Optimize
                  </button>
                  {/* <button 
                    onClick={() => setActiveTab("settings")}
                    className={`px-3 py-2 rounded-md text-sm font-medium ${activeTab === "settings" ? "bg-primary-100 text-primary-700" : "text-gray-500 hover:text-gray-700"}`}
                    data-testid="nav-settings"
                  >
                    Settings
                  </button> */}
                  {/* Temporarily disabled
                  <button 
                    onClick={() => setActiveTab("sent-notifications")}
                    className={`px-3 py-2 rounded-md text-sm font-medium ${activeTab === "sent-notifications" ? "bg-primary-100 text-primary-700" : "text-gray-500 hover:text-gray-700"}`}
                    data-testid="nav-sent-notifications"
                  >
                    Sent Notifications
                  </button>
                  <button 
                    onClick={() => setActiveTab("audit")}
                    className={`px-3 py-2 rounded-md text-sm font-medium ${activeTab === "audit" ? "bg-primary-100 text-primary-700" : "text-gray-500 hover:text-gray-700"}`}
                    data-testid="nav-audit"
                  >
                    Audit Log
                  </button>
                  */}
                </div>
              </div>
            </div>
            
            <div className="hidden md:block">
              <div className="ml-4 flex items-center md:ml-6">
                <Button variant="ghost" size="sm" className="p-1 rounded-full text-gray-400 hover:text-gray-500" data-testid="button-notifications">
                  <Bell className="h-6 w-6" />
                </Button>
                <div className="ml-3 relative">
                  <div className="flex items-center space-x-3">
                    <span className="text-sm font-medium text-gray-700" data-testid="text-admin-name">
                      {user?.name || "Admin User"}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleLogout}
                      className="flex items-center space-x-2 text-red-600 border-red-600 hover:bg-red-50"
                      data-testid="button-logout"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Logout</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="md:hidden">
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" className="bg-gray-100 inline-flex items-center justify-center p-2 rounded-md text-gray-400" data-testid="button-mobile-menu">
                    <Menu className="h-6 w-6" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-80">
                  <SheetHeader>
                    <SheetTitle>Navigation</SheetTitle>
                  </SheetHeader>
                  <div className="mt-6 space-y-1">
                    <button
                      onClick={() => { setActiveTab("dashboard"); setMobileMenuOpen(false); }}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium ${
                        activeTab === "dashboard" ? "bg-primary-100 text-primary-700" : "text-gray-500 hover:text-gray-700"
                      }`}
                      data-testid="nav-dashboard-mobile"
                    >
                      <Calendar className="h-4 w-4 mr-3 inline" />
                      Dashboard
                    </button>
                    <button
                      onClick={() => { setActiveTab("participants"); setMobileMenuOpen(false); }}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium ${
                        activeTab === "participants" ? "bg-primary-100 text-primary-700" : "text-gray-500 hover:text-gray-700"
                      }`}
                      data-testid="nav-participants-mobile"
                    >
                      <UsersIcon className="h-4 w-4 mr-3 inline" />
                      Participants
                    </button>
                    <button
                      onClick={() => { setActiveTab("hotels"); setMobileMenuOpen(false); }}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium ${
                        activeTab === "hotels" ? "bg-primary-100 text-primary-700" : "text-gray-500 hover:text-gray-700"
                      }`}
                      data-testid="nav-hotels-mobile"
                    >
                      <Building className="h-4 w-4 mr-3 inline" />
                      Hotels
                    </button>
                    <button
                      onClick={() => { setActiveTab("checkin"); setMobileMenuOpen(false); }}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium ${
                        activeTab === "checkin" ? "bg-primary-100 text-primary-700" : "text-gray-500 hover:text-gray-700"
                      }`}
                      data-testid="nav-checkin-mobile"
                    >
                      <UserCheck className="h-4 w-4 mr-3 inline" />
                      Check-in Board
                    </button>
                    <button
                      onClick={() => { setActiveTab("checkout"); setMobileMenuOpen(false); }}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium ${
                        activeTab === "checkout" ? "bg-primary-100 text-primary-700" : "text-gray-500 hover:text-gray-700"
                      }`}
                      data-testid="nav-checkout-mobile"
                    >
                      <UserCheck className="h-4 w-4 mr-3 inline" />
                      Check-out Board
                    </button>
                    <button
                      onClick={() => { setActiveTab("notifications"); setMobileMenuOpen(false); }}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium ${
                        activeTab === "notifications" ? "bg-primary-100 text-primary-700" : "text-gray-500 hover:text-gray-700"
                      }`}
                      data-testid="nav-notifications-mobile"
                    >
                      <Bell className="h-4 w-4 mr-3 inline" />
                      Send Notification
                    </button>
                    <button
                      onClick={() => { setActiveTab("database-optimize"); setMobileMenuOpen(false); }}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium ${
                        activeTab === "database-optimize" ? "bg-primary-100 text-primary-700" : "text-gray-500 hover:text-gray-700"
                      }`}
                      data-testid="nav-database-optimize-mobile"
                    >
                      <Zap className="h-4 w-4 mr-3 inline" />
                      DB Optimize
                    </button>
                    <div className="border-t pt-4 mt-4">
                      <div className="px-3 py-2">
                        <p className="text-sm font-medium text-gray-700">{user?.name || "Admin User"}</p>
                      </div>
                      <button
                        onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
                        className="w-full text-left px-3 py-2 rounded-md text-sm font-medium text-red-600 hover:bg-red-50"
                        data-testid="button-logout-mobile"
                      >
                        <LogOut className="h-4 w-4 mr-3 inline" />
                        Logout
                      </button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tab Content */}
        {activeTab === "dashboard" && (
          <>
            {/* Dashboard Header */}
            <div className="mb-8">
              <div className="md:flex md:items-center md:justify-between">
                <div className="flex-1 min-w-0">
                  <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate" data-testid="header-title">
                    CM Trophy 2025 - Admin Dashboard
                  </h2>
                  <p className="mt-1 text-sm text-gray-500" data-testid="header-subtitle">
                    Manage accommodations, check-ins, and event logistics
                  </p>
                  {stats?.lastUpdated && (
                    <div className="mt-2 flex items-center text-xs text-gray-400" data-testid="last-updated">
                      <Clock className="h-3 w-3 mr-1" />
                      Last updated: {new Date(stats.lastUpdated).toLocaleString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                        day: '2-digit',
                        month: '2-digit', 
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                      })} IST (Updates every 15 minutes automatically)
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Statistics Cards */}
            <div className="mb-8">
              <StatsCards stats={stats} />
            </div>
          </>
        )}

        {activeTab === "participants" && (
          <>
            {/* Participants Header */}
            <div className="mb-8">
              <div className="md:flex md:items-center md:justify-between">
                <div className="flex-1 min-w-0">
                  <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate" data-testid="header-title">
                    Participant Management
                  </h2>
                  <p className="mt-1 text-sm text-gray-500" data-testid="header-subtitle">
                    Upload participant data, manage check-ins, and track accommodations
                  </p>
                </div>
                <div className="mt-4 flex md:mt-0 md:ml-4 space-x-3">
                  <Button
                    variant="outline"
                    onClick={() => exportMutation.mutate()}
                    disabled={exportMutation.isPending}
                    data-testid="button-export-data"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {exportMutation.isPending ? "Exporting..." : "Export Data"}
                  </Button>
                </div>
              </div>
            </div>

            {/* Participant Data Upload Section */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Participant Data Upload</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* Coach & Official Data Upload */}
                  <div 
                    className="border-2 border-gray-300 border-dashed rounded-lg p-6 text-center hover:border-primary-400 transition-colors cursor-pointer"
                    onClick={() => handleUploadClick("coaches_officials")}
                    data-testid="upload-area-coaches-officials"
                  >
                    <div className="mx-auto h-12 w-12 text-gray-400 mb-4">
                      <UserCheck className="h-12 w-12" />
                    </div>
                    <div className="text-sm">
                      <p className="font-medium text-gray-900">Coach & Official Data</p>
                      <p className="text-gray-500 mt-1">Upload coach and official information</p>
                    </div>
                    <div className="mt-4">
                      <Button variant="secondary" size="sm" data-testid="button-upload-coaches-officials">
                        <Upload className="h-4 w-4 mr-2" />
                        Upload PSV
                      </Button>
                    </div>
                  </div>

                  {/* Player Data Upload */}
                  <div 
                    className="border-2 border-gray-300 border-dashed rounded-lg p-6 text-center hover:border-primary-400 transition-colors cursor-pointer"
                    onClick={() => handleUploadClick("players")}
                    data-testid="upload-area-players"
                  >
                    <div className="mx-auto h-12 w-12 text-gray-400 mb-4">
                      <UsersIcon className="h-12 w-12" />
                    </div>
                    <div className="text-sm">
                      <p className="font-medium text-gray-900">Player Data Sheet</p>
                      <p className="text-gray-500 mt-1">Upload player registration data</p>
                    </div>
                    <div className="mt-4">
                      <Button variant="secondary" size="sm" data-testid="button-upload-players">
                        <Upload className="h-4 w-4 mr-2" />
                        Upload PSV
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Participants Management */}
            <ParticipantTable isAdmin={true} />
          </>
        )}

        {activeTab === "hotels" && (
          <>
            {/* Hotels Header */}
            <div className="mb-8">
              <div className="md:flex md:items-center md:justify-between">
                <div className="flex-1 min-w-0">
                  <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate" data-testid="header-title">
                    Hotel Management
                  </h2>
                  <p className="mt-1 text-sm text-gray-500" data-testid="header-subtitle">
                    Upload hotel inventory and manage accommodation bookings
                  </p>
                </div>
                <div className="mt-4 flex md:mt-0 md:ml-4">
                  <Button
                    onClick={() => setAddHotelModalOpen(true)}
                    className="flex items-center space-x-2"
                    data-testid="button-add-hotel"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add Hotel</span>
                  </Button>
                </div>
              </div>
            </div>

            {/* Hotel Data Upload Section */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Hotel Inventory Upload</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-1">
                  {/* Hotel Inventory Upload */}
                  <div 
                    className="border-2 border-gray-300 border-dashed rounded-lg p-6 text-center hover:border-primary-400 transition-colors cursor-pointer"
                    onClick={() => handleUploadClick("hotel_inventory")}
                    data-testid="upload-area-hotel-inventory"
                  >
                    <div className="mx-auto h-12 w-12 text-gray-400 mb-4">
                      <Building className="h-12 w-12" />
                    </div>
                    <div className="text-sm">
                      <p className="font-medium text-gray-900">Hotel Inventory Sheet</p>
                      <p className="text-gray-500 mt-1">Upload hotel room availability data</p>
                    </div>
                    <div className="mt-4">
                      <Button variant="secondary" size="sm" data-testid="button-upload-hotel-inventory">
                        <Upload className="h-4 w-4 mr-2" />
                        Upload PSV
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Hotel Management Overview */}
            <HotelTable />
          </>
        )}

        {activeTab === "checkin" && (
          <>
            {/* Checkin Header */}
            <div className="mb-8">
              <div className="md:flex md:items-center md:justify-between">
                <div className="flex-1 min-w-0">
                  <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate" data-testid="header-title">
                    Check-in Management
                  </h2>
                  <p className="mt-1 text-sm text-gray-500" data-testid="header-subtitle">
                    Manage participant arrivals and track check-in status
                  </p>
                </div>
              </div>
            </div>

            {/* Checkin Board */}
            <CheckinBoard />
          </>
        )}

        {activeTab === "checkout" && (
          <>
            {/* Checkout Header */}
            <div className="mb-8">
              <div className="md:flex md:items-center md:justify-between">
                <div className="flex-1 min-w-0">
                  <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate" data-testid="header-title">
                    Checkout Management
                  </h2>
                  <p className="mt-1 text-sm text-gray-500" data-testid="header-subtitle">
                    Manage participant checkouts and track overdue accommodations
                  </p>
                </div>
              </div>
            </div>

            {/* Checkout Board */}
            <CheckoutBoard />
          </>
        )}

        {activeTab === "reports" && (
          <>
            {/* Reports Header */}
            <div className="mb-8">
              <div className="md:flex md:items-center md:justify-between">
                <div className="flex-1 min-w-0">
                  <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate" data-testid="header-title">
                    Reports & Analytics
                  </h2>
                  <p className="mt-1 text-sm text-gray-500" data-testid="header-subtitle">
                    Generate reports and view analytics for the event
                  </p>
                </div>
              </div>
            </div>

            {/* Reports Content - Placeholder for now */}
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-gray-500">Reports functionality coming soon...</p>
              </CardContent>
            </Card>
          </>
        )}

        {activeTab === "notifications" && (
          <>
            {/* Notifications Header */}
            <div className="mb-8">
              <div className="md:flex md:items-center md:justify-between">
                <div className="flex-1 min-w-0">
                  <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate" data-testid="header-title">
                    Send Notifications
                  </h2>
                  <p className="mt-1 text-sm text-gray-500" data-testid="header-subtitle">
                    Send notifications to team coaches about match results, checkout dates, or general updates
                  </p>
                </div>
              </div>
            </div>

            {/* Send Notification Component */}
            <div className="mb-8">
              <SendNotificationEnhanced />
            </div>
          </>
        )}

        {activeTab === "failed-batches" && <FailedBatchesSection />}

        {activeTab === "database-optimize" && (
          <>
            {/* Database Optimize Header */}
            <div className="mb-8">
              <div className="md:flex md:items-center md:justify-between">
                <div className="flex-1 min-w-0">
                  <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate" data-testid="header-title">
                    <Zap className="h-6 w-6 mr-3 inline text-yellow-500" />
                    Database Optimization
                  </h2>
                  <p className="mt-1 text-sm text-gray-500" data-testid="header-subtitle">
                    Manually warm database indexes and application caches for optimal performance after data reloads
                  </p>
                </div>
              </div>
            </div>

            {/* Database Optimization Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              
              {/* Database Index Warming */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Shield className="h-5 w-5 mr-2 text-blue-500" />
                    Database Index Warming
                  </CardTitle>
                  <CardDescription>
                    Warm critical database indexes through strategic queries to improve query performance
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <DatabaseIndexWarming />
                </CardContent>
              </Card>

              {/* Application Cache Warming */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Clock className="h-5 w-5 mr-2 text-green-500" />
                    Application Cache Warming
                  </CardTitle>
                  <CardDescription>
                    Pre-load application caches for dashboard, hotels, and participants data
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ApplicationCacheWarming />
                </CardContent>
              </Card>

              {/* Database Table Analysis */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Calendar className="h-5 w-5 mr-2 text-purple-500" />
                    Database Table Analysis
                  </CardTitle>
                  <CardDescription>
                    Update PostgreSQL table statistics for optimal query planning and performance
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <DatabaseTableAnalysis />
                </CardContent>
              </Card>

            </div>

            {/* Database Management Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              
              {/* Database Diagnostics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <User className="h-5 w-5 mr-2 text-orange-500" />
                    Database Diagnostics
                  </CardTitle>
                  <CardDescription>
                    Check table row counts, foreign key constraints, and identify why data persists after truncate
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <DatabaseDiagnostics />
                </CardContent>
              </Card>

              {/* Comprehensive Cleanup */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Building className="h-5 w-5 mr-2 text-red-500" />
                    Comprehensive Cleanup
                  </CardTitle>
                  <CardDescription>
                    Complete database cleanup with foreign key handling and sequence resets
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ComprehensiveCleanup />
                </CardContent>
              </Card>

            </div>

            {/* Performance Tips */}
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-blue-800">💡 Database Management Guide</CardTitle>
              </CardHeader>
              <CardContent className="text-blue-700">
                <ul className="space-y-2 text-sm">
                  <li><strong>Performance optimization:</strong> Run Index warming → Table analysis → Cache warming</li>
                  <li><strong>Data persistence issue:</strong> Use Diagnostics to identify what data remains after truncate</li>
                  <li><strong>Complete cleanup:</strong> Use Comprehensive Cleanup for proper foreign key handling</li>
                  <li><strong>Background processes:</strong> System may auto-regenerate data - check logs for uploads</li>
                  <li><strong>Expected timing:</strong> Diagnostics ~200ms, Cleanup ~800ms, Optimization ~2-4 seconds</li>
                </ul>
              </CardContent>
            </Card>
          </>
        )}

        {/* Temporarily disabled - Sent Notifications
        {activeTab === "sent-notifications" && (
          <>
            <div className="mb-8">
              <div className="md:flex md:items-center md:justify-between">
                <div className="flex-1 min-w-0">
                  <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate" data-testid="header-title">
                    Sent Notifications
                  </h2>
                  <p className="mt-1 text-sm text-gray-500" data-testid="header-subtitle">
                    View delivery status and recipient details for all sent messages
                  </p>
                </div>
              </div>
            </div>
            <div className="mb-8">
              <AdminNotificationsList />
            </div>
          </>
        )}
        */}

        {/* Temporarily disabled - Audit Log
        {activeTab === "audit" && (
          <>
            <div className="mb-8">
              <div className="md:flex md:items-center md:justify-between">
                <div className="flex-1 min-w-0">
                  <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate" data-testid="header-title">
                    Audit Log
                  </h2>
                  <p className="mt-1 text-sm text-gray-500" data-testid="header-subtitle">
                    Track all system changes and user activities
                  </p>
                </div>
              </div>
            </div>
            <Card>
              <CardContent className="p-6">
                <div className="text-center">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Audit Logs Available</h3>
                  <p className="text-gray-600 mb-4">
                    Your 3 recent HOTEL-001 updates have been successfully logged:
                  </p>
                  <div className="space-y-2 text-left max-w-2xl mx-auto">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <span className="text-sm font-medium text-green-800">✓ Point of Contact Update:</span>
                      <span className="text-sm text-green-700 ml-2">"Rajesh Kumar" → "Rajesh Kumar Sundar"</span>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <span className="text-sm font-medium text-blue-800">✓ Phone Number Update:</span>
                      <span className="text-sm text-blue-700 ml-2">"+919840123456" → "+919840129456"</span>
                    </div>
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                      <span className="text-sm font-medium text-purple-800">✓ Location Update (Property-wide):</span>
                      <span className="text-sm text-purple-700 ml-2">"Alwarpet" → "Saidapet" (affected all 6 instances)</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 mt-4">
                    All changes are tracked with timestamps and user information for compliance and accountability.
                  </p>
                </div>
              </CardContent>
            </Card>
          </>
        )}
        */}

        {/* Settings temporarily disabled
        {activeTab === "settings" && (
          <>
            <div className="mb-8">
              <div className="md:flex md:items-center md:justify-between">
                <div className="flex-1 min-w-0">
                  <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate" data-testid="header-title">
                    System Settings
                  </h2>
                  <p className="mt-1 text-sm text-gray-500" data-testid="header-subtitle">
                    Configure access controls and system-wide parameters
                  </p>
                </div>
              </div>
            </div>

            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Clock className="h-5 w-5" />
                  <span>Coach Access Control</span>
                </CardTitle>
                <CardDescription>
                  Configure when coaches can perform check-in and check-out operations relative to their booking dates
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TimeWindowSettings />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="h-5 w-5" />
                  <span>Security Settings</span>
                </CardTitle>
                <CardDescription>
                  Hotel verification and authentication settings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center space-x-3">
                      <div className="h-3 w-3 bg-green-500 rounded-full"></div>
                      <div>
                        <p className="text-sm font-medium text-green-800">Hotel Verification Enabled</p>
                        <p className="text-sm text-green-600">
                          Coaches must verify their hotel code before accessing check-in/out features
                        </p>
                      </div>
                    </div>
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      Active
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h4 className="font-medium text-gray-900">Maximum Failed Attempts</h4>
                      <p className="text-2xl font-bold text-gray-700">10</p>
                      <p className="text-sm text-gray-600">Before account lockout</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h4 className="font-medium text-gray-900">Verification Method</h4>
                      <p className="text-sm text-gray-700">Hotel ID Code</p>
                      <p className="text-sm text-gray-600">Provided by hotel reception</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
        */}

        {/* Placeholder to prevent empty tab error when settings is removed */}
        {activeTab === "settings" && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">Settings temporarily disabled</p>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      <UploadModal
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        uploadType={uploadType as "hotel_inventory" | "coaches_officials" | "players" | undefined}
        onUploadTypeChange={setUploadType}
      />

      {/* Add Hotel Modal */}
      <AddHotelModal
        open={addHotelModalOpen}
        onOpenChange={setAddHotelModalOpen}
        mode={hotelAddMode}
        onModeChange={setHotelAddMode}
      />

    </div>
  );
}

// ⚡ Database Index Warming Component
function DatabaseIndexWarming() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const warmIndexesMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/admin/database/warm-indexes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to warm database indexes');
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "✅ Database Indexes Warmed",
        description: data.message,
        duration: 5000,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/dashboard/stats'] });
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Database Warming Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  return (
    <div className="space-y-4">
      <Button 
        onClick={() => warmIndexesMutation.mutate()}
        disabled={warmIndexesMutation.isPending}
        className="w-full"
        data-testid="button-warm-indexes"
      >
        {warmIndexesMutation.isPending ? (
          <>
            <Clock className="h-4 w-4 mr-2 animate-spin" />
            Warming Indexes...
          </>
        ) : (
          <>
            <Shield className="h-4 w-4 mr-2" />
            Warm Database Indexes
          </>
        )}
      </Button>
      
      <div className="text-xs text-gray-500 space-y-1">
        <p><strong>Target:</strong> Hotel balance, participant role, occupancy date indexes</p>
        <p><strong>Method:</strong> Strategic query execution to warm PostgreSQL indexes</p>
        <p><strong>Duration:</strong> ~100-500ms</p>
      </div>
    </div>
  );
}

// 🔥 Application Cache Warming Component  
function ApplicationCacheWarming() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const warmCachesMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/admin/database/warm-caches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to warm application caches');
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "🔥 Application Caches Warmed",
        description: data.message,
        duration: 5000,
      });
      // Invalidate all relevant caches
      queryClient.invalidateQueries({ queryKey: ['/api/admin/dashboard/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/hotels'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/participants'] });
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Cache Warming Failed", 
        description: error.message,
        variant: "destructive",
      });
    }
  });

  return (
    <div className="space-y-4">
      <Button 
        onClick={() => warmCachesMutation.mutate()}
        disabled={warmCachesMutation.isPending}
        className="w-full"
        variant="secondary"
        data-testid="button-warm-caches"
      >
        {warmCachesMutation.isPending ? (
          <>
            <Clock className="h-4 w-4 mr-2 animate-spin" />
            Warming Caches...
          </>
        ) : (
          <>
            <Zap className="h-4 w-4 mr-2" />
            Warm Application Caches
          </>
        )}
      </Button>
      
      <div className="text-xs text-gray-500 space-y-1">
        <p><strong>Target:</strong> Dashboard stats, hotel listings, participant data</p>
        <p><strong>Method:</strong> Pre-load application caches through API calls</p>
        <p><strong>Duration:</strong> ~1-3 seconds</p>
      </div>
    </div>
  );
}

// 📊 Database Table Analysis Component
function DatabaseTableAnalysis() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const analyzeTablesMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/admin/database/analyze-tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to analyze database tables');
      }
      return response.json();
    },
    onSuccess: (data) => {
      const { summary } = data;
      toast({
        title: "📊 Database Tables Analyzed",
        description: `${summary.tablesAnalyzed}/${summary.totalTables} tables analyzed in ${summary.totalDuration}ms`,
        duration: 5000,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/dashboard/stats'] });
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Table Analysis Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  return (
    <div className="space-y-4">
      <Button 
        onClick={() => analyzeTablesMutation.mutate()}
        disabled={analyzeTablesMutation.isPending}
        className="w-full"
        variant="outline"
        data-testid="button-analyze-tables"
      >
        {analyzeTablesMutation.isPending ? (
          <>
            <Clock className="h-4 w-4 mr-2 animate-spin" />
            Analyzing Tables...
          </>
        ) : (
          <>
            <Calendar className="h-4 w-4 mr-2" />
            Analyze Database Tables
          </>
        )}
      </Button>
      
      <div className="text-xs text-gray-500 space-y-1">
        <p><strong>Target:</strong> Hotels, participants, balance, users, audit tables</p>
        <p><strong>Method:</strong> PostgreSQL ANALYZE commands to update statistics</p>
        <p><strong>Duration:</strong> ~200-800ms</p>
      </div>
    </div>
  );
}

// 🔍 Database Diagnostics Component
function DatabaseDiagnostics() {
  const { toast } = useToast();

  const diagnoseMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/admin/database/diagnose-tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to diagnose database tables');
      }
      return response.json();
    },
    onSuccess: (data) => {
      const { summary, tableCounts } = data;
      const tableDetails = Object.entries(tableCounts)
        .map(([table, info]: [string, any]) => `${table}: ${info.count} rows`)
        .join(', ');
      
      toast({
        title: "🔍 Database Diagnostics Complete",
        description: `${summary.totalRows} total rows in ${summary.tablesWithData} tables. ${tableDetails}`,
        duration: 8000,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Diagnostics Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  return (
    <div className="space-y-4">
      <Button 
        onClick={() => diagnoseMutation.mutate()}
        disabled={diagnoseMutation.isPending}
        className="w-full"
        variant="secondary"
        data-testid="button-diagnose-tables"
      >
        {diagnoseMutation.isPending ? (
          <>
            <Clock className="h-4 w-4 mr-2 animate-spin" />
            Running Diagnostics...
          </>
        ) : (
          <>
            <User className="h-4 w-4 mr-2" />
            Diagnose Database
          </>
        )}
      </Button>
      
      <div className="text-xs text-gray-500 space-y-1">
        <p><strong>Checks:</strong> Row counts, foreign keys, constraint conflicts</p>
        <p><strong>Purpose:</strong> Identify why data persists after truncate</p>
        <p><strong>Duration:</strong> ~200-500ms</p>
      </div>
    </div>
  );
}

// 🧹 Comprehensive Cleanup Component
function ComprehensiveCleanup() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const cleanupMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/admin/database/comprehensive-cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to perform comprehensive cleanup');
      }
      return response.json();
    },
    onSuccess: (data) => {
      const { summary } = data;
      toast({
        title: "🧹 Database Cleanup Complete",
        description: `${summary.tablesTruncated}/${summary.totalTables} tables cleaned, sequences reset`,
        duration: 5000,
      });
      // Invalidate all caches after cleanup
      queryClient.invalidateQueries({ queryKey: ['/api/admin/dashboard/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/hotels'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/participants'] });
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Cleanup Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  return (
    <div className="space-y-4">
      <Button 
        onClick={() => cleanupMutation.mutate()}
        disabled={cleanupMutation.isPending}
        className="w-full bg-red-500 hover:bg-red-600"
        data-testid="button-comprehensive-cleanup"
      >
        {cleanupMutation.isPending ? (
          <>
            <Clock className="h-4 w-4 mr-2 animate-spin" />
            Cleaning Database...
          </>
        ) : (
          <>
            <Building className="h-4 w-4 mr-2" />
            Complete Cleanup
          </>
        )}
      </Button>
      
      <div className="text-xs text-gray-500 space-y-1">
        <p><strong>⚠️ WARNING:</strong> Deletes all hotels, participants, balance data</p>
        <p><strong>Method:</strong> CASCADE truncation with sequence reset</p>
        <p><strong>Duration:</strong> ~500-1000ms</p>
      </div>
    </div>
  );
}
