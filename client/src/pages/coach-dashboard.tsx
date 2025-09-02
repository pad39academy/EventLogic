import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatToIndianDate, formatToIST } from "@/../../shared/dateUtils";
import { useToast } from "@/hooks/use-toast";
import { logout } from "@/lib/auth";
import { useLocation } from "wouter";
import { 
  Calendar, LogOut, Phone, LogIn, Users as UsersIcon, Bell
} from "lucide-react";
import ievolveSymbol from "@/assets/logos/ievolve-symbol.jpg";
import { NotificationsList } from "@/components/notifications-list";
import HotelVerificationModal from "@/components/hotel-verification-modal";
import type { Participant } from "@/lib/types";

interface CoachDashboardData {
  coach: Participant;
  players: Participant[];
}

export default function CoachDashboard() {
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [actionMode, setActionMode] = useState<'none' | 'checkin' | 'checkout'>('none');
  const [activeTab, setActiveTab] = useState("team");
  const [showHotelVerificationModal, setShowHotelVerificationModal] = useState(false);
  const [pendingCheckinAction, setPendingCheckinAction] = useState<(() => void) | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Get current user
  const { data: authData } = useQuery({
    queryKey: ["/api/auth/me"],
  });

  const user = authData?.user as any;

  // Get unread notification count
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["/api/coach/notifications/unread-count"],
    enabled: !!user,
  });

  const unreadCountNumber = typeof unreadCount === 'number' ? unreadCount : 0;

  // Get coach dashboard data
  const { data: dashboardData, isLoading, error, refetch } = useQuery({
    queryKey: ["/api/coach/dashboard"],
    queryFn: async (): Promise<CoachDashboardData> => {
      const response = await fetch("/api/coach/dashboard", {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }
      return await response.json();
    },
    retry: 2,
    staleTime: 0, // No caching - always fetch fresh data
  });

  // Handle errors gracefully
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-600 mb-4">Error loading dashboard: {error.message}</p>
          <Button onClick={() => logoutMutation.mutate()}>
            Return to Login
          </Button>
        </div>
      </div>
    );
  }

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

  // Check-in mutation
  const checkinMutation = useMutation({
    mutationFn: async (participantIds: string[]) => {
      const response = await fetch("/api/coach/checkin", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantIds }),
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Check-in failed');
      }
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/coach/dashboard"] });
      toast({
        title: "Success",
        description: `${data.checkedIn} participants checked in successfully`,
      });
      setSelectedPlayers([]);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Check-in failed",
        variant: "destructive",
      });
    },
  });

  // Check-out mutation
  const checkoutMutation = useMutation({
    mutationFn: async (participantIds: string[]) => {
      const response = await fetch("/api/coach/checkout", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantIds }),
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Check-out failed');
      }
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/coach/dashboard"] });
      toast({
        title: "Success",
        description: `${data.checkedOut} participants checked out successfully`,
      });
      setSelectedPlayers([]); // Clear selection after checkout
      setActiveTab("team"); // Return to team view
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Check-out failed",
        variant: "destructive",
      });
    },
  });

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "checked_in":
        return <Badge className="bg-success-100 text-success-800">Checked In</Badge>;
      case "checked_out":
        return <Badge variant="secondary">Checked Out</Badge>;
      default:
        return <Badge className="bg-warning-100 text-warning-800">Pending Check-in</Badge>;
    }
  };

  // Check if hotel verification is required before check-in
  const requiresHotelVerification = () => {
    return !(user as any)?.isHotelVerified;
  };

  const handleCheckinWithVerification = (checkinAction: () => void) => {
    if (requiresHotelVerification()) {
      setPendingCheckinAction(() => checkinAction);
      setShowHotelVerificationModal(true);
    } else {
      checkinAction();
    }
  };

  const onHotelVerificationSuccess = () => {
    // Execute the pending check-in action after successful verification
    if (pendingCheckinAction) {
      pendingCheckinAction();
      setPendingCheckinAction(null);
    }
    // Close the modal
    setShowHotelVerificationModal(false);
  };

  const handleSingleCheckin = (participantId: string) => {
    handleCheckinWithVerification(() => {
      checkinMutation.mutate([participantId]);
    });
  };

  const handleSingleCheckout = (participantId: string) => {
    checkoutMutation.mutate([participantId]);
  };

  // Handle selected players check-in
  const handleSelectedCheckin = () => {
    const pendingSelected = selectedPlayers.filter(id => {
      const player = players.find(p => p.participantId === id);
      return player?.checkinStatus === 'pending';
    });
    if (pendingSelected.length > 0) {
      checkinMutation.mutate(pendingSelected);
      clearActionMode(); // Clear action mode and selection after action
    }
  };

  // Handle top-level check-in (shows hotel verification modal first)
  const handleTopLevelCheckin = () => {
    if (pendingCount === 0) return;
    
    handleCheckinWithVerification(() => {
      // This will be executed after successful hotel verification
      setActionMode('checkin');
      setSelectedPlayers([]); // Clear previous selections
    });
  };

  // Handle top-level check-out (shows player selection directly)
  const handleTopLevelCheckout = () => {
    if (checkedInCount === 0) return;
    setActionMode('checkout');
    setSelectedPlayers([]); // Clear previous selections
  };

  // Clear action mode
  const clearActionMode = () => {
    setActionMode('none');
    setSelectedPlayers([]);
  };

  // Handle selected players check-out
  const handleSelectedCheckout = () => {
    const checkedInSelected = selectedPlayers.filter(id => {
      const player = players.find(p => p.participantId === id);
      return player?.checkinStatus === 'checked_in';
    });
    if (checkedInSelected.length > 0) {
      checkoutMutation.mutate(checkedInSelected);
      clearActionMode(); // Clear action mode and selection after action
    }
  };

  const handleBulkCheckin = () => {
    const pendingPlayers = dashboardData?.players.filter(p => p.checkinStatus === 'pending').map(p => p.participantId) || [];
    if (pendingPlayers.length > 0) {
      handleCheckinWithVerification(() => {
        checkinMutation.mutate(pendingPlayers);
      });
    }
  };

  const handleCoachCheckin = () => {
    if (dashboardData?.coach) {
      handleCheckinWithVerification(() => {
        checkinMutation.mutate([dashboardData.coach.participantId]);
      });
    }
  };

  const handleCoachCheckout = () => {
    if (dashboardData?.coach) {
      checkoutMutation.mutate([dashboardData.coach.participantId]);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading coach dashboard...</p>
        </div>
      </div>
    );
  }

  if (!dashboardData || !dashboardData.coach) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Unable to load coach data</p>
          <Button onClick={() => logoutMutation.mutate()}>
            Return to Login
          </Button>
        </div>
      </div>
    );
  }

  const { coach, players } = dashboardData;
  const checkedInCount = players.filter(p => p.checkinStatus === 'checked_in').length;
  const pendingCount = players.filter(p => p.checkinStatus === 'pending').length;
  const checkedOutCount = players.filter(p => p.checkinStatus === 'checked_out').length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 rounded-lg overflow-hidden">
                <img 
                  src={ievolveSymbol} 
                  alt="Ievolve" 
                  className="h-full w-full object-cover"
                />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900" data-testid="header-title">Ievolve Events</h1>
                <p className="text-sm text-gray-500" data-testid="header-subtitle">Coach Portal</p>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="flex items-center space-x-1 text-red-600 border-red-600 hover:bg-red-50"
              onClick={() => logoutMutation.mutate()}
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4" />
              <span className="text-xs">Logout</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-md mx-auto px-4">
          <div className="flex space-x-1">
            <button
              onClick={() => setActiveTab("team")}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-t-lg ${
                activeTab === "team"
                  ? "bg-primary-100 text-primary-700 border-b-2 border-primary-500"
                  : "text-gray-500 hover:text-gray-700"
              }`}
              data-testid="tab-my-team"
            >
              <UsersIcon className="h-4 w-4 inline mr-1" />
              My Team
            </button>
            <button
              onClick={() => setActiveTab("messages")}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-t-lg relative ${
                activeTab === "messages"
                  ? "bg-primary-100 text-primary-700 border-b-2 border-primary-500"
                  : "text-gray-500 hover:text-gray-700"
              }`}
              data-testid="tab-messages"
            >
              <Bell className="h-4 w-4 inline mr-1" />
              Message
              {unreadCountNumber > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {unreadCountNumber}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Coach Dashboard Content */}
      <div className="max-w-md mx-auto px-4 py-6">
        {/* Messages Tab Content */}
        {activeTab === "messages" && (
          <div className="space-y-4">
            <NotificationsList />
          </div>
        )}

        {/* Check-in Selection Content */}
        {activeTab === "checkin-selection" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  <LogIn className="h-5 w-5 mr-2" />
                  Select Players to Check In
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setActiveTab("team")}
                  data-testid="button-back-to-team"
                >
                  Back
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {players.filter(p => p.checkinStatus === 'pending').map((player) => (
                <div key={player.participantId} className="flex items-center space-x-3 p-3 border rounded-lg">
                  <Checkbox
                    checked={selectedPlayers.includes(player.participantId)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedPlayers([...selectedPlayers, player.participantId]);
                      } else {
                        setSelectedPlayers(selectedPlayers.filter(id => id !== player.participantId));
                      }
                    }}
                    data-testid={`checkbox-checkin-${player.participantId}`}
                  />
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs bg-gray-200">
                      {getInitials(player.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{player.name}</p>
                    <p className="text-xs text-gray-500">{player.participantId}</p>
                  </div>
                </div>
              ))}
              <div className="flex space-x-3 pt-4">
                <Button 
                  onClick={handleSelectedCheckin}
                  disabled={selectedPlayers.length === 0 || checkinMutation.isPending}
                  className="flex-1"
                  data-testid="button-confirm-checkin"
                >
                  Check In Selected ({selectedPlayers.length})
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => {
                    setSelectedPlayers([]);
                    setActiveTab("team");
                  }}
                  data-testid="button-cancel-checkin"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Checkout Selection Content */}
        {activeTab === "checkout-selection" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  <LogOut className="h-5 w-5 mr-2" />
                  Select Players to Check Out
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setActiveTab("team")}
                  data-testid="button-back-to-team-checkout"
                >
                  Back
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {players.filter(p => p.checkinStatus === 'checked_in').map((player) => (
                <div key={player.participantId} className="flex items-center space-x-3 p-3 border rounded-lg">
                  <Checkbox
                    checked={selectedPlayers.includes(player.participantId)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedPlayers([...selectedPlayers, player.participantId]);
                      } else {
                        setSelectedPlayers(selectedPlayers.filter(id => id !== player.participantId));
                      }
                    }}
                    data-testid={`checkbox-checkout-${player.participantId}`}
                  />
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs bg-gray-200">
                      {getInitials(player.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{player.name}</p>
                    <p className="text-xs text-gray-500">{player.participantId}</p>
                    {player.checkinTime && (
                      <p className="text-xs text-gray-400">
                        Checked in: {formatToIST(player.checkinTime)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              <div className="flex space-x-3 pt-4">
                <Button 
                  onClick={handleSelectedCheckout}
                  disabled={selectedPlayers.length === 0 || checkoutMutation.isPending}
                  variant="outline"
                  className="flex-1 border-red-600 text-red-600 hover:bg-red-50"
                  data-testid="button-confirm-checkout"
                >
                  Check Out Selected ({selectedPlayers.length})
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => {
                    setSelectedPlayers([]);
                    setActiveTab("team");
                  }}
                  data-testid="button-cancel-checkout"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Team Content */}
        {activeTab === "team" && (
          <>
            {/* Coach Info Card */}
            <Card className="mb-6">
              <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-primary-100">
                  <span className="text-lg font-medium text-primary-600">
                    {coach?.name ? getInitials(coach.name) : 'C'}
                  </span>
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h2 className="text-lg font-medium text-gray-900" data-testid="text-coach-name">
                  {coach?.name || 'Coach'}
                </h2>
                <p className="text-sm text-gray-500" data-testid="text-coach-discipline">
                  {coach?.discipline || 'Unknown'} Coach • {coach?.participantId || 'N/A'}
                </p>
                <p className="text-sm text-gray-500" data-testid="text-coach-mobile">
                  {coach?.mobileNumber || 'No mobile'}
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary-600" data-testid="text-total-players">
                  {players.length}
                </div>
                <div className="text-sm text-gray-500">Total Players</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-success-600" data-testid="text-checked-in-players">
                  {checkedInCount}
                </div>
                <div className="text-sm text-gray-500">Checked In</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* My Accommodation */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Coach Accommodation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Hotel</span>
              <span className="text-sm font-medium text-gray-900" data-testid="text-coach-hotel">
                {coach?.hotelId ? `Hotel ID: ${coach.hotelId}` : 'No hotel assigned'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Booking Reference</span>
              <span className="text-sm font-medium text-gray-900 font-mono" data-testid="text-coach-booking-ref">
                {coach?.bookingReference || 'N/A'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Check-in Date</span>
              <span className="text-sm font-medium text-gray-900" data-testid="text-coach-checkin-date">
                {coach?.bookingStartDate ? formatToIndianDate(coach.bookingStartDate) : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Check-out Date</span>
              <span className="text-sm font-medium text-gray-900" data-testid="text-coach-checkout-date">
                {coach?.bookingEndDate ? formatToIndianDate(coach.bookingEndDate) : 'N/A'}
              </span>
            </div>
            {/* New coach fields */}
            {coach?.location && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Location</span>
                <span className="text-sm font-medium text-gray-900" data-testid="text-coach-location">
                  {coach.location}
                </span>
              </div>
            )}
            {coach?.district && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">District</span>
                <span className="text-sm font-medium text-gray-900" data-testid="text-coach-district">
                  {coach.district}
                </span>
              </div>
            )}
            {(coach?.travelPocName || coach?.travelPocMobile) && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Travel POC</span>
                <span className="text-sm font-medium text-gray-900" data-testid="text-coach-travel-poc">
                  {coach.travelPocName} {coach.travelPocMobile && `(${coach.travelPocMobile})`}
                </span>
              </div>
            )}
            {(coach?.venuePocName || coach?.venuePocMobile) && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Venue POC</span>
                <span className="text-sm font-medium text-gray-900" data-testid="text-coach-venue-poc">
                  {coach.venuePocName} {coach.venuePocMobile && `(${coach.venuePocMobile})`}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Coach Status</span>
              <div className="text-right" data-testid="badge-coach-status">
                {getStatusBadge(coach?.checkinStatus || 'pending')}
                {coach?.checkinTime && (
                  <div className="text-xs text-gray-500 mt-1">
                    Check-in: {formatToIST(coach.checkinTime)}
                  </div>
                )}
                {coach?.checkoutTime && (
                  <div className="text-xs text-gray-500 mt-1">
                    Check-out: {formatToIST(coach.checkoutTime)}
                  </div>
                )}
              </div>
            </div>
            {coach?.checkinStatus === 'pending' && (
              <Button 
                className="w-full mt-4"
                onClick={handleCoachCheckin}
                disabled={checkinMutation.isPending}
                data-testid="button-coach-checkin"
              >
                {checkinMutation.isPending ? "Checking In..." : "Check In Now"}
              </Button>
            )}
            {coach?.checkinStatus === 'checked_in' && (
              <Button 
                variant="outline"
                className="w-full mt-4 border-red-600 text-red-600 hover:bg-red-50"
                onClick={handleCoachCheckout}
                disabled={checkoutMutation.isPending}
                data-testid="button-coach-checkout"
              >
                {checkoutMutation.isPending ? "Checking Out..." : "Check Out Now"}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Team Players */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>My Team Players</CardTitle>
              <div className="flex items-center space-x-4">
                {selectedPlayers.length > 0 && (
                  <span className="text-sm text-primary-600 font-medium" data-testid="text-selected-count">
                    {selectedPlayers.length} selected
                  </span>
                )}
                <span className="text-sm text-gray-500" data-testid="text-player-count">
                  {players.length} players
                </span>
              </div>
            </div>
            
            {/* Top-level Action Buttons - only show when no action mode is active */}
            {actionMode === 'none' && (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Button 
                  className="flex items-center justify-center py-2 px-4"
                  onClick={handleTopLevelCheckin}
                  disabled={pendingCount === 0 || checkinMutation.isPending}
                  data-testid="button-checkin-top"
                >
                  <LogIn className="h-4 w-4 mr-2" />
                  Check In ({pendingCount})
                </Button>
                <Button 
                  variant="outline"
                  className="flex items-center justify-center py-2 px-4"
                  onClick={handleTopLevelCheckout}
                  disabled={checkedInCount === 0 || checkoutMutation.isPending}
                  data-testid="button-checkout-top"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Check Out ({checkedInCount})
                </Button>
              </div>
            )}
            {players.length > 0 && actionMode !== 'none' && (() => {
              const eligiblePlayers = players.filter(p => 
                actionMode === 'checkin' ? p.checkinStatus === 'pending' :
                actionMode === 'checkout' ? p.checkinStatus === 'checked_in' : false
              );
              if (eligiblePlayers.length === 0) return null;
              return (
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={eligiblePlayers.length > 0 && eligiblePlayers.every(p => selectedPlayers.includes(p.participantId))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedPlayers(eligiblePlayers.map(p => p.participantId));
                        } else {
                          setSelectedPlayers([]);
                        }
                      }}
                      className="rounded border-gray-300"
                      data-testid="checkbox-select-all"
                    />
                    <label className="text-sm text-gray-600">
                      Select All {actionMode === 'checkin' ? 'Pending' : 'Checked In'} ({eligiblePlayers.length})
                    </label>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearActionMode}
                    data-testid="button-cancel-action"
                  >
                    Cancel
                  </Button>
                </div>
              );
            })()}
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Selected Actions */}
            {selectedPlayers.length > 0 && (
              <div className="mb-4 p-4 bg-primary-50 border border-primary-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-primary-700 font-medium">
                    {selectedPlayers.length} player{selectedPlayers.length !== 1 ? 's' : ''} selected
                  </span>
                  <div className="flex space-x-2">
                    {selectedPlayers.some(id => {
                      const player = players.find(p => p.participantId === id);
                      return player?.checkinStatus === 'pending';
                    }) && (
                      <Button 
                        size="sm"
                        onClick={() => handleSelectedCheckin()}
                        disabled={checkinMutation.isPending}
                        data-testid="button-selected-checkin"
                      >
                        <LogIn className="h-4 w-4 mr-1" />
                        Check In Selected
                      </Button>
                    )}
                    {selectedPlayers.some(id => {
                      const player = players.find(p => p.participantId === id);
                      return player?.checkinStatus === 'checked_in';
                    }) && (
                      <Button 
                        size="sm"
                        variant="outline"
                        className="border-error-600 text-error-600 hover:bg-error-50"
                        onClick={() => handleSelectedCheckout()}
                        disabled={checkoutMutation.isPending}
                        data-testid="button-selected-checkout"
                      >
                        <LogOut className="h-4 w-4 mr-1" />
                        Check Out Selected
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {players.map((player) => (
              <div 
                key={player.id} 
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                data-testid={`player-card-${player.participantId}`}
              >
                <div className="flex items-center space-x-3">
                  {(() => {
                    const showCheckbox = actionMode !== 'none' && (
                      (actionMode === 'checkin' && player.checkinStatus === 'pending') ||
                      (actionMode === 'checkout' && player.checkinStatus === 'checked_in')
                    );
                    
                    return showCheckbox ? (
                      <input
                        type="checkbox"
                        checked={selectedPlayers.includes(player.participantId)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedPlayers(prev => [...prev, player.participantId]);
                          } else {
                            setSelectedPlayers(prev => prev.filter(id => id !== player.participantId));
                          }
                        }}
                        className="rounded border-gray-300"
                        data-testid={`checkbox-${player.participantId}`}
                      />
                    ) : (
                      <div className="w-4"></div> // Placeholder to maintain spacing
                    );
                  })()}
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className={
                      player.checkinStatus === 'checked_in' ? 'bg-success-100' :
                      player.checkinStatus === 'checked_out' ? 'bg-gray-100' : 'bg-warning-100'
                    }>
                      <span className={`text-sm font-medium ${
                        player.checkinStatus === 'checked_in' ? 'text-success-600' :
                        player.checkinStatus === 'checked_out' ? 'text-gray-600' : 'text-warning-600'
                      }`}>
                        {getInitials(player.name)}
                      </span>
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium text-gray-900" data-testid={`player-name-${player.participantId}`}>
                      {player.name}
                    </p>
                    <p className="text-xs text-gray-500" data-testid={`player-id-${player.participantId}`}>
                      {player.participantId}
                      {player.mobileNumber && ` • ${player.mobileNumber}`}
                    </p>
                    <p className="text-xs text-gray-500 font-mono" data-testid={`player-booking-${player.participantId}`}>
                      {player.bookingReference}
                    </p>
                    {player.checkinTime && (
                      <p className="text-xs text-gray-400 mt-1" data-testid={`player-checkin-${player.participantId}`}>
                        Check-in: {formatToIST(player.checkinTime)}
                      </p>
                    )}
                    {player.checkoutTime && (
                      <p className="text-xs text-gray-400 mt-1" data-testid={`player-checkout-${player.participantId}`}>
                        Check-out: {formatToIST(player.checkoutTime)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center">
                  {player.checkinStatus === 'pending' ? (
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300" data-testid={`status-${player.participantId}`}>
                      Pending
                    </Badge>
                  ) : player.checkinStatus === 'checked_in' ? (
                    <Badge className="bg-success-100 text-success-800" data-testid={`status-${player.participantId}`}>
                      Checked In
                    </Badge>
                  ) : (
                    <Badge variant="secondary" data-testid={`status-${player.participantId}`}>
                      Checked Out
                    </Badge>
                  )}
                </div>
              </div>
            ))}

            {players.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-500">No players assigned to your team yet.</p>
              </div>
            )}


            {/* Main Actions - only show when no action mode is active */}
            {actionMode === 'none' && (
              <div className="mt-6 grid grid-cols-2 gap-3">
                <Button 
                  className="flex items-center justify-center py-3 px-4"
                  onClick={handleTopLevelCheckin}
                  disabled={pendingCount === 0 || checkinMutation.isPending}
                  data-testid="button-checkin"
                >
                  <LogIn className="h-4 w-4 mr-2" />
                  Check In ({pendingCount})
                </Button>
                <Button 
                  variant="outline"
                  className="flex items-center justify-center py-3 px-4"
                  onClick={handleTopLevelCheckout}
                  disabled={checkedInCount === 0 || checkoutMutation.isPending}
                  data-testid="button-checkout"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Check Out ({checkedInCount})
                </Button>
              </div>
            )}

            {/* Action Mode Buttons - show when action mode is active */}
            {actionMode !== 'none' && selectedPlayers.length > 0 && (
              <div className="mt-6 flex space-x-3">
                {actionMode === 'checkin' && (
                  <Button 
                    className="flex-1"
                    onClick={handleSelectedCheckin}
                    disabled={checkinMutation.isPending}
                    data-testid="button-confirm-checkin"
                  >
                    <LogIn className="h-4 w-4 mr-2" />
                    Check In Selected ({selectedPlayers.length})
                  </Button>
                )}
                {actionMode === 'checkout' && (
                  <Button 
                    variant="outline"
                    className="flex-1 border-red-600 text-red-600 hover:bg-red-50"
                    onClick={handleSelectedCheckout}
                    disabled={checkoutMutation.isPending}
                    data-testid="button-confirm-checkout"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Check Out Selected ({selectedPlayers.length})
                  </Button>
                )}
                <Button 
                  variant="outline"
                  onClick={clearActionMode}
                  data-testid="button-cancel-action-bottom"
                >
                  Cancel
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
          </>
        )}
      </div>

      {/* Hotel Verification Modal */}
      <HotelVerificationModal
        open={showHotelVerificationModal}
        onOpenChange={setShowHotelVerificationModal}
        onVerificationSuccess={onHotelVerificationSuccess}
      />
    </div>
  );
}
