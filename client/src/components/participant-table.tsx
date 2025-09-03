import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatToIndianDate, formatToIST } from "@/../../shared/dateUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Edit, Plus, RefreshCw, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { EditParticipantModal } from "./edit-participant-modal";
import type { Participant, ParticipantFilters } from "@/lib/types";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface ParticipantTableProps {
  isAdmin?: boolean;
  coachId?: string;
}

export default function ParticipantTable({ isAdmin = false, coachId }: ParticipantTableProps) {
  const [searchInput, setSearchInput] = useState("");
  const [showAddParticipantDialog, setShowAddParticipantDialog] = useState(false);
  const [filters, setFilters] = useState<ParticipantFilters>({
    search: "",
    discipline: "",
    role: "",
    checkinStatus: "",
    hotelId: "",
    page: 1,
    limit: 10,
    sortBy: "createdAt",
    sortOrder: "desc",
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Edit modal state
  const [editingParticipant, setEditingParticipant] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const handleEditParticipant = (participant: any) => {
    setEditingParticipant(participant);
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setEditingParticipant(null);
  };

  const { data: participantResponse = {}, isLoading } = useQuery({
    queryKey: [
      isAdmin ? "/api/admin/dashboard/participants" : "/api/coach/dashboard",
      filters
    ],
    queryFn: async () => {
      const endpoint = isAdmin ? "/api/admin/dashboard/participants" : "/api/coach/dashboard";
      const params = new URLSearchParams();
      
      if (isAdmin) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value) params.append(key, value.toString());
        });
      }

      const response = await fetch(`${endpoint}?${params}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch participants');
      }

      const data = await response.json();
      return isAdmin ? data : { data: data.players || [], pagination: null };
    },
  });

  const participants = participantResponse.data || [];
  const pagination = participantResponse.pagination;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "checked_in":
        return <Badge className="bg-success-100 text-success-800" data-testid={`status-checked-in`}>Checked In</Badge>;
      case "checked_out":
        return <Badge variant="secondary" data-testid={`status-checked-out`}>Checked Out</Badge>;
      default:
        return <Badge className="bg-warning-100 text-warning-800" data-testid={`status-pending`}>Pending</Badge>;
    }
  };


  // Admin check-in mutation
  const checkinMutation = useMutation({
    mutationFn: async (participantId: string) => {
      const response = await fetch("/api/admin/checkin", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantIds: [participantId] }),
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Check-in failed');
      }
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard/participants"] });
      toast({
        title: "Success",
        description: `Participant checked in successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Check-in failed",
        variant: "destructive",
      });
    },
  });

  // Admin check-out mutation
  const checkoutMutation = useMutation({
    mutationFn: async (participantId: string) => {
      const response = await fetch("/api/admin/checkout", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantIds: [participantId] }),
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Check-out failed');
      }
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard/participants"] });
      toast({
        title: "Success",
        description: `Participant checked out successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Check-out failed",
        variant: "destructive",
      });
    },
  });

  const handleAdminCheckin = (participantId: string) => {
    checkinMutation.mutate(participantId);
  };

  const handleAdminCheckout = (participantId: string) => {
    checkoutMutation.mutate(participantId);
  };

  // Add participant mutation
  const addParticipantMutation = useMutation({
    mutationFn: async (participantData: any) => {
      const response = await fetch("/api/admin/participants", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(participantData),
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to add participant');
      }
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard/participants"] });
      setShowAddParticipantDialog(false);
      toast({
        title: "Success",
        description: "Participant added successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add participant",
        variant: "destructive",
      });
    },
  });

  // Handle search button click
  const handleSearch = () => {
    setFilters({ ...filters, search: searchInput, page: 1 });
  };

  // Handle Enter key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "coach":
        return "bg-warning-100";
      case "official":
        return "bg-primary-100";
      case "player":
        return "bg-success-100";
      default:
        return "bg-gray-100";
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle>
              {isAdmin ? "Participant Management" : "My Team Players"}
            </CardTitle>
            <p className="text-sm text-gray-500 mt-1">
              {isAdmin 
                ? "Manage bookings, check-ins, and accommodations"
                : `${participants.length} players under your supervision`
              }
            </p>
          </div>
          {isAdmin && (
            <div className="flex gap-2">
              <Button 
                variant="outline"
                size="sm"
                onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard/participants"] })}
                data-testid="button-refresh-participants"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button 
                onClick={() => setShowAddParticipantDialog(true)}
                data-testid="button-add-participant"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Participant
              </Button>
            </div>
          )}
        </div>

        {/* Search and Filters - Admin only */}
        {isAdmin && (
          <div className="space-y-4 mt-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
            <div className="flex gap-2 sm:col-span-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search participants..."
                  className="pl-10"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  data-testid="input-search-participants"
                />
              </div>
              <Button onClick={handleSearch} data-testid="button-search-participants">
                Search
              </Button>
            </div>
            <Select
              value={filters.discipline || "all"}
              onValueChange={(value) => setFilters({ ...filters, discipline: value === "all" ? "" : value, page: 1 })}
            >
              <SelectTrigger data-testid="select-discipline">
                <SelectValue placeholder="All Disciplines" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Disciplines</SelectItem>
                <SelectItem value="Football">Football</SelectItem>
                <SelectItem value="Athletics">Athletics</SelectItem>
                <SelectItem value="Swimming">Swimming</SelectItem>
                <SelectItem value="Basketball">Basketball</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.checkinStatus || "all"}
              onValueChange={(value) => setFilters({ ...filters, checkinStatus: value === "all" ? "" : value, page: 1 })}
            >
              <SelectTrigger data-testid="select-status">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="checked_in">Checked In</SelectItem>
                <SelectItem value="checked_out">Checked Out</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.role || "all"}
              onValueChange={(value) => setFilters({ ...filters, role: value === "all" ? "" : value, page: 1 })}
            >
              <SelectTrigger data-testid="select-role">
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="coach">Coach</SelectItem>
                <SelectItem value="official">Official</SelectItem>
                <SelectItem value="player">Player</SelectItem>
              </SelectContent>
            </Select>
            </div>
            
            {/* Page Size Selector and Top Pagination */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <label htmlFor="pageSize" className="text-sm font-medium text-gray-700">
                  Rows per page:
                </label>
                <Select
                  value={filters.limit?.toString() || "10"}
                  onValueChange={(value) => setFilters({ ...filters, limit: parseInt(value), page: 1 })}
                >
                  <SelectTrigger className="w-20" data-testid="select-page-size">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Pagination Controls - Top */}
              {pagination && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-700">Page {pagination.page} of {pagination.totalPages}</span>
                  <nav className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!pagination.hasPrev}
                      onClick={() => setFilters({ ...filters, page: 1 })}
                      data-testid="button-first-top"
                    >
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!pagination.hasPrev}
                      onClick={() => setFilters({ ...filters, page: pagination.page - 1 })}
                      data-testid="button-prev-top"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!pagination.hasNext}
                      onClick={() => setFilters({ ...filters, page: pagination.page + 1 })}
                      data-testid="button-next-top"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!pagination.hasNext}
                      onClick={() => setFilters({ ...filters, page: pagination.totalPages })}
                      data-testid="button-last-top"
                    >
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </nav>
                </div>
              )}
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent>
        <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead>Participant</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Discipline</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Coach ID</TableHead>
                <TableHead>Hotel/Booking</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {participants.map((participant: Participant) => (
                <TableRow key={participant.id} className="hover:bg-gray-50" data-testid={`participant-row-${participant.participantId}`}>
                  <TableCell>
                    <div>
                      <div className="text-sm font-medium text-gray-900" data-testid={`participant-name-${participant.participantId}`}>
                        {participant.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {participant.participantId}
                        {participant.mobileNumber && ` • ${participant.mobileNumber}`}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-gray-900 capitalize">
                      {participant.role}
                    </div>
                    {participant.teamName && (
                      <div className="text-sm text-gray-500">
                        {participant.teamName}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-gray-900">
                      {participant.discipline || '-'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-gray-900">
                      {participant.location || '-'}
                    </div>
                    {participant.district && (
                      <div className="text-sm text-gray-500">
                        {participant.district}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-gray-900">
                      {participant.coachId ? (
                        <span className="font-mono bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs">
                          {participant.coachId}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">No Coach</span>
                      )}
                    </div>
                    {participant.role === 'player' && !participant.coachId && (
                      <div className="text-xs text-orange-600 mt-1">
                        ⚠ Missing coach assignment
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-gray-900">
                      {participant.hotelName || `Hotel ID: ${participant.hotelId}`}
                    </div>
                    <div className="text-sm text-gray-500 font-mono">
                      {participant.bookingReference}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-gray-900">
                      {formatToIndianDate(participant.bookingStartDate)} - {formatToIndianDate(participant.bookingEndDate)}
                    </div>
                    <div className="text-sm text-gray-500">
                      {Math.ceil((new Date(participant.bookingEndDate).getTime() - new Date(participant.bookingStartDate).getTime()) / (1000 * 3600 * 24))} days
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {getStatusBadge(participant.checkinStatus)}
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
                    <div className="flex space-x-2">
                      {isAdmin ? (
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => handleEditParticipant(participant)}
                          data-testid={`button-edit-${participant.participantId}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      ) : (
                        <>
                          {participant.checkinStatus === 'pending' ? (
                            <Button 
                              size="sm" 
                              className="bg-primary-600 text-white hover:bg-primary-700"
                              data-testid={`button-checkin-${participant.participantId}`}
                            >
                              Check In
                            </Button>
                          ) : participant.checkinStatus === 'checked_in' ? (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="border-error-600 text-error-600 hover:bg-error-50"
                              data-testid={`button-checkout-${participant.participantId}`}
                            >
                              Check Out
                            </Button>
                          ) : (
                            <Badge variant="secondary">Completed</Badge>
                          )}
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Controls - Bottom */}
        {isAdmin && pagination && (
          <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 mt-4">
            <div className="text-sm text-gray-700">
              Showing <span className="font-medium">{pagination.startIndex}</span> to{' '}
              <span className="font-medium">{pagination.endIndex}</span> of{' '}
              <span className="font-medium">{pagination.total}</span> participants
              {filters.search && ` matching "${filters.search}"`}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700">Page {pagination.page} of {pagination.totalPages}</span>
              <nav className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!pagination.hasPrev}
                  onClick={() => setFilters({ ...filters, page: 1 })}
                  data-testid="button-first-bottom"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!pagination.hasPrev}
                  onClick={() => setFilters({ ...filters, page: pagination.page - 1 })}
                  data-testid="button-prev-bottom"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!pagination.hasNext}
                  onClick={() => setFilters({ ...filters, page: pagination.page + 1 })}
                  data-testid="button-next-bottom"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!pagination.hasNext}
                  onClick={() => setFilters({ ...filters, page: pagination.totalPages })}
                  data-testid="button-last-bottom"
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </nav>
            </div>
          </div>
        )}
      </CardContent>

      {/* Add Participant Dialog */}
      <Dialog open={showAddParticipantDialog} onOpenChange={setShowAddParticipantDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Participant</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-gray-600">
              <p className="mb-3">You can add a single participant manually or upload bulk data using the PSV upload options above.</p>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-primary-500 rounded-full"></div>
                  <span>Use "Coach & Official Data" upload for coaches and officials</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-primary-500 rounded-full"></div>
                  <span>Use "Player Data Sheet" upload for players</span>
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setShowAddParticipantDialog(false)}
                data-testid="button-cancel-add-participant"
              >
                Cancel
              </Button>
              <Button 
                onClick={() => {
                  setShowAddParticipantDialog(false);
                  toast({
                    title: "Info",
                    description: "Please use the PSV upload options above to add participants efficiently",
                  });
                }}
                data-testid="button-confirm-add-participant"
              >
                Got it
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Participant Modal */}
      <EditParticipantModal
        participant={editingParticipant}
        isOpen={isEditModalOpen}
        onClose={handleCloseEditModal}
      />
    </Card>
  );
}
