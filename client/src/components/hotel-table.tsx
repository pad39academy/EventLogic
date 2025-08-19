import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Search, Building2, MapPin, Users, Bed, Edit3, Calendar, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { formatToIndianDate, formatForDateInput, formatDateRange } from "@/../../shared/dateUtils";

interface Hotel {
  id: string;
  hotelId: string;
  hotelName: string;
  location: string;
  district: string;
  address: string;
  pincode: string;
  pointOfContact?: string;
  contactPhoneNumber?: string;
  totalRooms: number;
  availableRooms: number;
  occupiedRooms: number;
  instanceCode: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  status: "upcoming" | "active" | "expired";
}

// Remove GroupedHotel interface since we'll display individual instances

// Hotel edit form schema
const hotelEditSchema = z.object({
  hotelName: z.string().min(1, "Hotel name is required"),
  location: z.string().min(1, "Location is required"),
  district: z.string().min(1, "District is required"),
  address: z.string().min(1, "Address is required"),
  pincode: z.string().min(6, "Pincode must be at least 6 digits"),
  pointOfContact: z.string().optional(),
  contactPhoneNumber: z.string().optional(),
  totalRooms: z.number().min(1, "Must have at least 1 room"),
  availableRooms: z.number().min(0, "Available rooms cannot be negative"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
});

const getOccupancyStatus = (occupied: number, total: number) => {
  const percentage = (occupied / total) * 100;
  if (percentage >= 90) return { label: "Full", variant: "destructive", color: "red-500" };
  if (percentage >= 70) return { label: "High", variant: "warning", color: "yellow-500" };
  if (percentage >= 30) return { label: "Medium", variant: "default", color: "blue-500" };
  return { label: "Low", variant: "success", color: "green-500" };
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case "active":
      return { label: "Active", variant: "default", color: "green" };
    case "upcoming":
      return { label: "Upcoming", variant: "secondary", color: "blue" };
    case "expired":
      return { label: "Expired", variant: "outline", color: "gray" };
    default:
      return { label: "Unknown", variant: "outline", color: "gray" };
  }
};

export default function HotelTable() {
  const [searchTerm, setSearchTerm] = useState("");
  const [districtFilter, setDistrictFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortField, setSortField] = useState<string>("hotelId");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [editingHotel, setEditingHotel] = useState<Hotel | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: hotels = [], isLoading, error } = useQuery<Hotel[]>({
    queryKey: ["/api/admin/dashboard/hotels", searchTerm, districtFilter, statusFilter, sortField, sortOrder],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (districtFilter !== "all") params.append('district', districtFilter);
      if (statusFilter !== "all") params.append('status', statusFilter);
      if (sortField) params.append('sortBy', sortField);
      if (sortOrder) params.append('sortOrder', sortOrder);
      
      const response = await fetch(`/api/admin/dashboard/hotels?${params.toString()}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch hotels');
      }
      
      return response.json();
    }
  });

  // Form for hotel editing
  const form = useForm<z.infer<typeof hotelEditSchema>>({
    resolver: zodResolver(hotelEditSchema),
    defaultValues: {
      hotelName: "",
      location: "",
      district: "",
      address: "",
      pincode: "",
      pointOfContact: "",
      contactPhoneNumber: "",
      totalRooms: 0,
      availableRooms: 0,
      startDate: "",
      endDate: "",
    },
  });

  // Mutation for updating hotel
  const updateHotelMutation = useMutation({
    mutationFn: async (data: { id: string; updates: z.infer<typeof hotelEditSchema> }) => {
      const response = await fetch(`/api/admin/hotels/${data.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(data.updates),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update hotel");
      }
      
      return await response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard/hotels"] });
      setIsEditModalOpen(false);
      setEditingHotel(null);
      form.reset();
      toast({
        title: "Hotel Updated",
        description: data.affectedInstances > 1 
          ? `Hotel updated successfully. ${data.affectedInstances} instances affected.`
          : "Hotel has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update hotel",
        variant: "destructive",
      });
    },
  });

  // Handle edit button click
  const handleEditHotel = (hotel: Hotel) => {
    console.log('Editing hotel:', hotel);
    console.log('Original dates:', {
      startDate: hotel.startDate,
      endDate: hotel.endDate,
      startFormatted: formatForDateInput(hotel.startDate),
      endFormatted: formatForDateInput(hotel.endDate)
    });
    
    setEditingHotel(hotel);
    form.reset({
      hotelName: hotel.hotelName,
      location: hotel.location,
      district: hotel.district,
      address: hotel.address,
      pincode: hotel.pincode,
      pointOfContact: hotel.pointOfContact || "",
      contactPhoneNumber: hotel.contactPhoneNumber || "",
      totalRooms: hotel.totalRooms,
      availableRooms: hotel.availableRooms,
      startDate: formatForDateInput(hotel.startDate),
      endDate: formatForDateInput(hotel.endDate),
    });
    setIsEditModalOpen(true);
  };

  // Handle form submission
  const onSubmit = (data: z.infer<typeof hotelEditSchema>) => {
    if (!editingHotel) return;
    updateHotelMutation.mutate({ id: editingHotel.id, updates: data });
  };

  // Handle column sorting
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // Get sort icon for column header
  const getSortIcon = (field: string) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 opacity-50" />;
    }
    return sortOrder === "asc" 
      ? <ArrowUp className="h-4 w-4" />
      : <ArrowDown className="h-4 w-4" />;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Hotel Inventory</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="text-gray-500">Loading hotels...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Hotel Inventory</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="text-red-500">Error loading hotels</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Display hotels directly from API (filtering and sorting handled server-side)
  const displayHotels = hotels;

  // Get unique districts for filter (from current results)
  const districts = Array.from(new Set(hotels.map(h => h.district)));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Hotel Inventory Overview
          </CardTitle>
          <Badge variant="outline" className="text-sm">
            {displayHotels.length} Hotel Instances
          </Badge>
        </div>
        
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search hotels, locations, or IDs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-hotel-search"
            />
          </div>
          
          <Select value={districtFilter} onValueChange={setDistrictFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Filter by district" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Districts</SelectItem>
              {districts.map(district => (
                <SelectItem key={district} value={district}>{district}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="upcoming">Upcoming</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("hotelName")}
                    className="h-auto p-0 font-medium hover:bg-transparent"
                    data-testid="sort-hotel-name"
                  >
                    Hotel Details
                    {getSortIcon("hotelName")}
                  </Button>
                </TableHead>
                <TableHead className="w-[120px]">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("district")}
                    className="h-auto p-0 font-medium hover:bg-transparent"
                    data-testid="sort-district"
                  >
                    District
                    {getSortIcon("district")}
                  </Button>
                </TableHead>
                <TableHead className="w-[120px]">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("location")}
                    className="h-auto p-0 font-medium hover:bg-transparent"
                    data-testid="sort-location"
                  >
                    Location
                    {getSortIcon("location")}
                  </Button>
                </TableHead>
                <TableHead className="w-[150px]">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("pointOfContact")}
                    className="h-auto p-0 font-medium hover:bg-transparent"
                    data-testid="sort-contact"
                  >
                    Point of Contact
                    {getSortIcon("pointOfContact")}
                  </Button>
                </TableHead>
                <TableHead className="w-[130px]">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("contactPhoneNumber")}
                    className="h-auto p-0 font-medium hover:bg-transparent"
                    data-testid="sort-phone"
                  >
                    Contact Phone
                    {getSortIcon("contactPhoneNumber")}
                  </Button>
                </TableHead>
                <TableHead className="w-[120px]">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("occupiedRooms")}
                    className="h-auto p-0 font-medium hover:bg-transparent"
                    data-testid="sort-occupancy"
                  >
                    Occupancy
                    {getSortIcon("occupiedRooms")}
                  </Button>
                </TableHead>
                <TableHead className="w-[100px]">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("status")}
                    className="h-auto p-0 font-medium hover:bg-transparent"
                    data-testid="sort-status"
                  >
                    Status
                    {getSortIcon("status")}
                  </Button>
                </TableHead>
                <TableHead className="w-[100px]">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("instanceCode")}
                    className="h-auto p-0 font-medium hover:bg-transparent"
                    data-testid="sort-instance"
                  >
                    Instance
                    {getSortIcon("instanceCode")}
                  </Button>
                </TableHead>
                <TableHead className="w-[150px]">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("startDate")}
                    className="h-auto p-0 font-medium hover:bg-transparent"
                    data-testid="sort-date"
                  >
                    Date Range
                    {getSortIcon("startDate")}
                  </Button>
                </TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayHotels.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                    No hotels found
                  </TableCell>
                </TableRow>
              ) : (
                displayHotels.map((hotel) => {
                  const occupiedRooms = hotel.totalRooms - hotel.availableRooms;
                  const occupancyPercentage = Math.round((occupiedRooms / hotel.totalRooms) * 100);
                  const status = getOccupancyStatus(occupiedRooms, hotel.totalRooms);
                  
                  return (
                    <TableRow key={hotel.id} data-testid={`hotel-row-${hotel.id}`}>
                      <TableCell>
                        <div>
                          <div className="font-medium text-gray-900" data-testid={`hotel-name-${hotel.id}`}>
                            {hotel.hotelName}
                          </div>
                          <div className="text-sm text-gray-500" data-testid={`hotel-id-${hotel.id}`}>
                            ID: {hotel.hotelId}
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="text-sm font-medium">{hotel.district}</div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-4 w-4 text-gray-400" />
                          <span className="text-sm">{hotel.location}</span>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="text-sm">
                          {hotel.pointOfContact ? (
                            <div className="font-medium">{hotel.pointOfContact}</div>
                          ) : (
                            <span className="text-gray-400 text-xs">Not provided</span>
                          )}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="text-sm">
                          {hotel.contactPhoneNumber ? (
                            <div>{hotel.contactPhoneNumber}</div>
                          ) : (
                            <span className="text-gray-400 text-xs">Not provided</span>
                          )}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="space-y-2">
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4 text-gray-400" />
                            <span className="text-sm font-medium" data-testid={`hotel-occupancy-${hotel.id}`}>
                              {occupiedRooms}/{hotel.totalRooms}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className={`bg-${status.color} h-2 rounded-full transition-all duration-300`}
                              style={{ width: `${occupancyPercentage}%` }}
                              data-testid={`hotel-progress-${hotel.id}`}
                            />
                          </div>
                          <div className="text-xs text-gray-500">{occupancyPercentage}%</div>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <Badge 
                          variant={
                            hotel.status === 'active' ? 'default' :
                            hotel.status === 'upcoming' ? 'secondary' :
                            hotel.status === 'expired' ? 'outline' : 'outline'
                          }
                          data-testid={`hotel-status-${hotel.id}`}
                        >
                          {hotel.status === 'active' ? 'Active' :
                           hotel.status === 'upcoming' ? 'Upcoming' :
                           hotel.status === 'expired' ? 'Expired' : 'Unknown'}
                        </Badge>
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Bed className="h-4 w-4 text-gray-400" />
                          <span className="text-sm font-medium">{hotel.instanceCode}</span>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium">
                            {formatToIndianDate(hotel.startDate)}
                          </div>
                          <div className="text-gray-500">to</div>
                          <div className="font-medium">
                            {formatToIndianDate(hotel.endDate)}
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditHotel(hotel)}
                          data-testid={`button-edit-${hotel.id}`}
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        
        {displayHotels.length > 0 && (
          <div className="mt-4 text-sm text-gray-500 border-t pt-4">
            Showing {displayHotels.length} hotel instances
            {sortField && (
              <span className="ml-2 text-xs">
                • Sorted by {sortField} ({sortOrder === "asc" ? "ascending" : "descending"})
              </span>
            )}
          </div>
        )}
      </CardContent>

      {/* Edit Hotel Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="h-5 w-5" />
              Edit Hotel Details
            </DialogTitle>
            <DialogDescription>
              Update hotel information. Note that Hotel ID cannot be changed.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="hotelName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hotel Name</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-hotel-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-hotel-location" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="district"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>District</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-hotel-district" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="totalRooms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total Rooms</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field} 
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          data-testid="input-hotel-total-rooms"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="availableRooms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Available Rooms</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field} 
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          data-testid="input-hotel-available-rooms"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-hotel-address" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="pincode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pincode</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-hotel-pincode" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="pointOfContact"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Point of Contact</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-hotel-contact" placeholder="Hotel staff contact person" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="contactPhoneNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Phone Number</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-hotel-phone" placeholder="Contact person's phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date (DD/MM/YYYY)</FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          {...field}
                          data-testid="input-hotel-start-date"
                        />
                      </FormControl>
                      <FormMessage />
                      {field.value && (
                        <div className="text-xs text-gray-500">
                          Display: {formatToIndianDate(field.value)}
                        </div>
                      )}
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date (DD/MM/YYYY)</FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          {...field}
                          data-testid="input-hotel-end-date"
                        />
                      </FormControl>
                      <FormMessage />
                      {field.value && (
                        <div className="text-xs text-gray-500">
                          Display: {formatToIndianDate(field.value)}
                        </div>
                      )}
                    </FormItem>
                  )}
                />
              </div>
              
              {editingHotel && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-600">
                    <strong>Hotel ID:</strong> {editingHotel.hotelId} • 
                    <strong> Instance:</strong> {editingHotel.instanceCode}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Original date range: {formatDateRange(editingHotel.startDate, editingHotel.endDate)}
                  </p>
                  <p className="text-xs text-gray-500">
                    Note: Hotel ID cannot be changed. Changes will only affect this instance.
                  </p>
                </div>
              )}
              
              <div className="flex justify-end gap-3 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsEditModalOpen(false)}
                  data-testid="button-cancel-edit"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateHotelMutation.isPending}
                  data-testid="button-save-hotel"
                >
                  {updateHotelMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}