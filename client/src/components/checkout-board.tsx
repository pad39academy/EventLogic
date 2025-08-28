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
  Calendar, Clock, LogOut, AlertTriangle, CheckCircle, 
  Search, Filter, Users, Building2 
} from "lucide-react";
import { formatToIndianDate, formatToIST } from "@/../../shared/dateUtils";

interface CheckoutParticipant {
  id: string;
  participantId: string;
  name: string;
  role: string;
  discipline: string;
  hotelName: string;
  bookingReference: string;
  bookingEndDate: string;
  checkinStatus: string;
  checkinTime?: string;
  checkoutTime?: string;
  mobileNumber?: string;
  coachName?: string;
  daysRemaining: number;
  isOverdue: boolean;
}

interface CheckoutStats {
  totalCheckedIn: number;
  dueToday: number;
  overdue: number;
  completed: number;
}

export default function CheckoutBoard() {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [filterBy, setFilterBy] = useState("all");
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch checkout data
  const { data: checkoutData, isLoading } = useQuery({
    queryKey: ["/api/admin/dashboard/checkout"],
    queryFn: async () => {
      const response = await fetch("/api/admin/dashboard/checkout", {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch checkout data');
      }
      return await response.json();
    },
  });

  const participants: CheckoutParticipant[] = checkoutData?.participants || [];
  const stats: CheckoutStats = checkoutData?.stats || { 
    totalCheckedIn: 0, dueToday: 0, overdue: 0, completed: 0 
  };

  // Bulk checkout mutation
  const bulkCheckoutMutation = useMutation({
    mutationFn: async (participantIds: string[]) => {
      const response = await fetch("/api/admin/checkout", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantIds }),
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Bulk checkout failed');
      }
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard/checkout"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard/participants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard/stats"] });
      toast({
        title: "Success",
        description: `${data.checkedOut} participants checked out successfully`,
      });
      setSelectedParticipants([]);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Bulk checkout failed",
        variant: "destructive",
      });
    },
  });

  // Single checkout mutation
  const singleCheckoutMutation = useMutation({
    mutationFn: async (participantId: string) => {
      const response = await fetch("/api/admin/checkout", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantIds: [participantId] }),
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Checkout failed');
      }
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard/checkout"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard/participants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard/stats"] });
      toast({
        title: "Success",
        description: "Participant checked out successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Checkout failed",
        variant: "destructive",
      });
    },
  });

  // Filter participants
  const filteredParticipants = participants.filter(participant => {
    const matchesSearch = participant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         participant.participantId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         participant.hotelName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterBy === "all" || 
                         (filterBy === "due_today" && participant.daysRemaining === 0) ||
                         (filterBy === "overdue" && participant.isOverdue) ||
                         (filterBy === "checked_in" && participant.checkinStatus === "checked_in");
    
    return matchesSearch && matchesFilter;
  });

  const handleSelectAll = () => {
    if (selectedParticipants.length === filteredParticipants.length) {
      setSelectedParticipants([]);
    } else {
      setSelectedParticipants(filteredParticipants.map(p => p.participantId));
    }
  };

  const handleSelectParticipant = (participantId: string) => {
    setSelectedParticipants(prev => 
      prev.includes(participantId)
        ? prev.filter(id => id !== participantId)
        : [...prev, participantId]
    );
  };

  const handleBulkCheckout = () => {
    if (selectedParticipants.length > 0) {
      bulkCheckoutMutation.mutate(selectedParticipants);
    }
  };

  const handleSingleCheckout = (participantId: string) => {
    singleCheckoutMutation.mutate(participantId);
  };

  // Handle search button click
  const handleSearch = () => {
    setSearchTerm(searchInput);
  };

  // Handle Enter key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const getStatusBadge = (participant: CheckoutParticipant) => {
    if (participant.checkinStatus === "checked_out") {
      return <Badge className="bg-gray-100 text-gray-800">Checked Out</Badge>;
    }
    if (participant.isOverdue) {
      return <Badge variant="destructive">Overdue</Badge>;
    }
    if (participant.daysRemaining === 0) {
      return <Badge className="bg-warning-100 text-warning-800">Due Today</Badge>;
    }
    if (participant.daysRemaining <= 1) {
      return <Badge className="bg-blue-100 text-blue-800">Due Tomorrow</Badge>;
    }
    return <Badge className="bg-success-100 text-success-800">Checked In</Badge>;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Checkout Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="text-gray-500">Loading checkout data...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Checkout Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Users className="h-8 w-8 text-blue-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Currently Checked In
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {stats.totalCheckedIn}
                  </dd>
                </dl>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Calendar className="h-8 w-8 text-yellow-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Due Today
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {stats.dueToday}
                  </dd>
                </dl>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Overdue
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {stats.overdue}
                  </dd>
                </dl>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Completed Today
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {stats.completed}
                  </dd>
                </dl>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Checkout Management Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <LogOut className="h-5 w-5" />
              Checkout Management
            </CardTitle>
            {selectedParticipants.length > 0 && (
              <Button 
                onClick={handleBulkCheckout}
                disabled={bulkCheckoutMutation.isPending}
                className="bg-red-600 hover:bg-red-700"
                data-testid="button-bulk-checkout"
              >
                {bulkCheckoutMutation.isPending ? "Processing..." : `Check Out ${selectedParticipants.length} Selected`}
              </Button>
            )}
          </div>
          
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mt-4">
            <div className="flex gap-2 flex-1">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search by name, ID, or hotel..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="pl-10"
                  data-testid="input-search-checkout"
                />
              </div>
              <Button onClick={handleSearch} data-testid="button-search-checkout">
                Search
              </Button>
            </div>
            
            <Select value={filterBy} onValueChange={setFilterBy}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Participants</SelectItem>
                <SelectItem value="checked_in">Checked In</SelectItem>
                <SelectItem value="due_today">Due Today</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
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
                      checked={selectedParticipants.length === filteredParticipants.length && filteredParticipants.length > 0}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300"
                      data-testid="checkbox-select-all"
                    />
                  </TableHead>
                  <TableHead>Participant</TableHead>
                  <TableHead>Role & Discipline</TableHead>
                  <TableHead>Hotel</TableHead>
                  <TableHead>Checkout Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Days Remaining</TableHead>
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
                    <TableRow key={participant.participantId} data-testid={`checkout-row-${participant.participantId}`}>
                      <TableCell>
                        {participant.checkinStatus === "checked_in" && (
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
                        <div className="text-sm text-gray-900 capitalize">{participant.role}</div>
                        <div className="text-sm text-gray-500">{participant.discipline}</div>
                        {participant.coachName && (
                          <div className="text-xs text-gray-400">Coach: {participant.coachName}</div>
                        )}
                      </TableCell>
                      
                      <TableCell>
                        <div className="text-sm text-gray-900">{participant.hotelName}</div>
                        <div className="text-sm text-gray-500 font-mono">{participant.bookingReference}</div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="text-sm text-gray-900">
                          {formatToIndianDate(participant.bookingEndDate)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(participant.bookingEndDate).toLocaleDateString('en-US', { weekday: 'short' })}
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
                        <div className={`text-sm font-medium ${
                          participant.isOverdue ? 'text-red-600' :
                          participant.daysRemaining === 0 ? 'text-yellow-600' :
                          participant.daysRemaining <= 1 ? 'text-blue-600' :
                          'text-gray-900'
                        }`}>
                          {participant.isOverdue ? `${Math.abs(participant.daysRemaining)} days overdue` :
                           participant.daysRemaining === 0 ? 'Today' :
                           `${participant.daysRemaining} days`}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        {participant.checkinStatus === "checked_in" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-600 text-red-600 hover:bg-red-50"
                            onClick={() => handleSingleCheckout(participant.participantId)}
                            disabled={singleCheckoutMutation.isPending}
                            data-testid={`button-checkout-${participant.participantId}`}
                          >
                            <LogOut className="h-4 w-4 mr-1" />
                            Check Out
                          </Button>
                        ) : (
                          <Badge variant="secondary" className="text-xs">Completed</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          
          {filteredParticipants.length > 0 && (
            <div className="mt-4 text-sm text-gray-500 border-t pt-4">
              Showing {filteredParticipants.length} of {participants.length} participants
              {selectedParticipants.length > 0 && (
                <span className="ml-4 font-medium text-blue-600">
                  {selectedParticipants.length} selected
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}