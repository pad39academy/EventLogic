import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { 
  Calendar, Clock, LogIn, AlertTriangle, CheckCircle, 
  Search, Filter, Users, Building2 
} from "lucide-react";
import { formatToIndianDate, formatToIST } from "@/../../shared/dateUtils";

interface CheckinParticipant {
  id: string;
  participantId: string;
  name: string;
  role: string;
  discipline: string;
  hotelName: string;
  bookingReference: string;
  bookingStartDate: string;
  checkinStatus: string;
  checkinTime?: string;
  checkoutTime?: string;
  mobileNumber?: string;
  coachName?: string;
  daysUntilArrival: number;
  isLate: boolean;
}

interface CheckinStats {
  totalPending: number;
  dueToday: number;
  late: number;
  completed: number;
}

export default function CheckinBoard() {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [filterBy, setFilterBy] = useState("all");
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch checkin data with optimized backend
  const { data: checkinData, isLoading, refetch } = useQuery({
    queryKey: ["/api/admin/dashboard/checkin", filterBy, searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: "50",
        page: "1"
      });
      
      if (searchTerm) {
        params.append('search', searchTerm);
      }
      
      if (filterBy !== 'all') {
        params.append('status', filterBy);
      }

      const response = await fetch(`/api/admin/dashboard/checkin?${params.toString()}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch checkin data');
      }
      return await response.json();
    },
  });

  const participants: CheckinParticipant[] = checkinData?.participants || [];
  const stats: CheckinStats = checkinData?.stats || { 
    totalPending: 0, dueToday: 0, late: 0, completed: 0 
  };
  const pagination = checkinData?.pagination;

  // Bulk checkin mutation
  const bulkCheckinMutation = useMutation({
    mutationFn: async (participantIds: string[]) => {
      const response = await fetch("/api/admin/checkin", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantIds }),
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Bulk checkin failed');
      }
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard/checkin"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard/participants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard/stats"] });
      toast({
        title: "Success",
        description: `${data.checkedIn} participants checked in successfully`,
      });
      setSelectedParticipants([]);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Bulk checkin failed",
        variant: "destructive",
      });
    },
  });

  // Single checkin mutation
  const singleCheckinMutation = useMutation({
    mutationFn: async (participantId: string) => {
      const response = await fetch("/api/admin/checkin", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantIds: [participantId] }),
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Checkin failed');
      }
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard/checkin"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard/participants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard/stats"] });
      toast({
        title: "Success",
        description: "Participant checked in successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Checkin failed",
        variant: "destructive",
      });
    },
  });

  // No more client-side filtering - server does it all now
  const filteredParticipants = participants; // Data already filtered by server

  const handleSearch = () => {
    const trimmedSearch = searchInput.trim();
    setSearchTerm(trimmedSearch);
    // React Query will automatically refetch with new search term
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Auto-refetch when filters change
  React.useEffect(() => {
    refetch();
  }, [filterBy, refetch]);

  const handleSelectParticipant = (participantId: string) => {
    setSelectedParticipants(prev => 
      prev.includes(participantId) 
        ? prev.filter(id => id !== participantId)
        : [...prev, participantId]
    );
  };

  const handleSelectAll = () => {
    const checkableParticipants = filteredParticipants.filter(p => p.checkinStatus === "pending");
    if (selectedParticipants.length === checkableParticipants.length) {
      setSelectedParticipants([]);
    } else {
      setSelectedParticipants(checkableParticipants.map(p => p.participantId));
    }
  };

  const handleBulkCheckin = () => {
    if (selectedParticipants.length === 0) return;
    bulkCheckinMutation.mutate(selectedParticipants);
  };

  const handleSingleCheckin = (participantId: string) => {
    singleCheckinMutation.mutate(participantId);
  };

  const getStatusBadge = (participant: CheckinParticipant) => {
    if (participant.checkinStatus === "checked_in") {
      return (
        <Badge className="bg-success-100 text-success-800" data-testid={`status-${participant.participantId}`}>
          <CheckCircle className="w-3 h-3 mr-1" />
          Checked In
        </Badge>
      );
    }

    if (participant.isLate) {
      return (
        <Badge variant="destructive" data-testid={`status-${participant.participantId}`}>
          <AlertTriangle className="w-3 h-3 mr-1" />
          Late
        </Badge>
      );
    }

    if (participant.daysUntilArrival === 0) {
      return (
        <Badge className="bg-warning-100 text-warning-800" data-testid={`status-${participant.participantId}`}>
          <Clock className="w-3 h-3 mr-1" />
          Due Today
        </Badge>
      );
    }

    return (
      <Badge variant="secondary" data-testid={`status-${participant.participantId}`}>
        <Calendar className="w-3 h-3 mr-1" />
        Pending
      </Badge>
    );
  };

  const getDaysText = (days: number, isLate: boolean) => {
    if (isLate) {
      const lateDays = Math.abs(days);
      return (
        <span className="text-error-600 font-medium" data-testid="text-late-days">
          {lateDays} day{lateDays !== 1 ? 's' : ''} late
        </span>
      );
    }
    
    if (days === 0) {
      return <span className="text-warning-600 font-medium">Today</span>;
    }
    
    if (days === 1) {
      return <span className="text-gray-600">Tomorrow</span>;
    }
    
    return <span className="text-gray-600">{days} days</span>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-500">Loading checkin data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-500">Pending Check-ins</p>
                <p className="text-2xl font-bold text-gray-900" data-testid="stat-pending">{stats.totalPending}</p>
              </div>
              <Users className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-500">Due Today</p>
                <p className="text-2xl font-bold text-warning-600" data-testid="stat-due-today">{stats.dueToday}</p>
              </div>
              <Clock className="h-8 w-8 text-warning-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-500">Late Arrivals</p>
                <p className="text-2xl font-bold text-error-600" data-testid="stat-late">{stats.late}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-error-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-500">Completed Today</p>
                <p className="text-2xl font-bold text-success-600" data-testid="stat-completed">{stats.completed}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-success-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      {selectedParticipants.length > 0 && (
        <Card className="bg-primary-50 border-primary-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-primary-700 font-medium" data-testid="text-selected-count">
                {selectedParticipants.length} participant{selectedParticipants.length !== 1 ? 's' : ''} selected
              </span>
              <div className="flex space-x-2">
                <Button 
                  size="sm"
                  onClick={handleBulkCheckin}
                  disabled={bulkCheckinMutation.isPending}
                  data-testid="button-bulk-checkin"
                >
                  <LogIn className="h-4 w-4 mr-1" />
                  {bulkCheckinMutation.isPending ? "Checking In..." : "Check In Selected"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Table */}
      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <LogIn className="h-5 w-5 text-primary-600" />
                Check-in Management
              </CardTitle>
              <p className="text-sm text-gray-500 mt-1">
                Manage participant arrivals and track check-in status
              </p>
            </div>
            <Badge variant="outline" className="text-sm" data-testid="badge-total-count">
              {filteredParticipants.length} of {participants.length} participants
            </Badge>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex gap-2 flex-1">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search by name, ID, or hotel..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="pl-10"
                  data-testid="input-search-checkin"
                />
              </div>
              <Button onClick={handleSearch} data-testid="button-search-checkin">
                Search
              </Button>
            </div>
            
            <Select value={filterBy} onValueChange={setFilterBy}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Participants</SelectItem>
                <SelectItem value="pending">Pending Check-in</SelectItem>
                <SelectItem value="due_today">Due Today</SelectItem>
                <SelectItem value="late">Late Arrivals</SelectItem>
                <SelectItem value="checked_in">Checked In</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      checked={selectedParticipants.length === filteredParticipants.filter(p => p.checkinStatus === "pending").length && filteredParticipants.filter(p => p.checkinStatus === "pending").length > 0}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300"
                      data-testid="checkbox-select-all"
                    />
                  </TableHead>
                  <TableHead>Participant</TableHead>
                  <TableHead>Role & Discipline</TableHead>
                  <TableHead>Hotel</TableHead>
                  <TableHead>Check-in Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Arrival</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredParticipants.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      {participants.length === 0 ? "No participants found" : "No participants match the current filters"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredParticipants.map((participant) => (
                    <TableRow key={participant.participantId} data-testid={`checkin-row-${participant.participantId}`}>
                      <TableCell>
                        {participant.checkinStatus === "pending" && (
                          <input
                            type="checkbox"
                            checked={selectedParticipants.includes(participant.participantId)}
                            onChange={() => handleSelectParticipant(participant.participantId)}
                            className="rounded border-gray-300"
                            data-testid={`checkbox-${participant.participantId}`}
                          />
                        )}
                      </TableCell>
                      
                      <TableCell>
                        <div>
                          <div className="font-medium text-gray-900" data-testid={`participant-name-${participant.participantId}`}>
                            {participant.name}
                          </div>
                          <div className="text-sm text-gray-500" data-testid={`participant-id-${participant.participantId}`}>
                            {participant.participantId}
                          </div>
                          {participant.mobileNumber && (
                            <div className="text-xs text-gray-400">{participant.mobileNumber}</div>
                          )}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{participant.role}</div>
                          <div className="text-sm text-gray-500">{participant.discipline}</div>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div>
                          <div className="text-sm text-gray-900" data-testid={`hotel-name-${participant.participantId}`}>
                            {participant.hotelName}
                          </div>
                          <div className="text-xs text-gray-500 font-mono">
                            {participant.bookingReference}
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="text-sm text-gray-900" data-testid={`checkin-date-${participant.participantId}`}>
                          {formatToIndianDate(participant.bookingStartDate)}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="space-y-1">
                          {getStatusBadge(participant)}
                          {participant.checkinTime && (
                            <div className="text-xs text-gray-500" data-testid={`checkin-time-${participant.participantId}`}>
                              Check-in: {formatToIST(participant.checkinTime)}
                            </div>
                          )}
                          {participant.checkoutTime && (
                            <div className="text-xs text-gray-500" data-testid={`checkout-time-${participant.participantId}`}>
                              Check-out: {formatToIST(participant.checkoutTime)}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="text-sm" data-testid={`days-until-${participant.participantId}`}>
                          {getDaysText(participant.daysUntilArrival, participant.isLate)}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        {participant.checkinStatus === "pending" ? (
                          <Button 
                            size="sm"
                            onClick={() => handleSingleCheckin(participant.participantId)}
                            disabled={singleCheckinMutation.isPending}
                            data-testid={`button-checkin-${participant.participantId}`}
                          >
                            <LogIn className="h-4 w-4 mr-1" />
                            Check In
                          </Button>
                        ) : (
                          <span className="text-xs text-gray-500">
                            Completed
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}