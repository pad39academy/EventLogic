import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Building, AlertCircle, CheckCircle } from "lucide-react";
import { formatToIndianDate } from "@/../../shared/dateUtils";

const addHotelSchema = z.object({
  hotelId: z.string().min(1, "Hotel ID is required"),
  hotelName: z.string().min(1, "Hotel name is required"),
  location: z.string().min(1, "Location is required"),
  district: z.string().min(1, "District is required"),
  address: z.string().min(1, "Address is required"),
  pincode: z.string().min(6, "Pincode must be at least 6 characters"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  totalRooms: z.number().min(1, "Total rooms must be at least 1"),
  availableRooms: z.number().min(0, "Available rooms cannot be negative"),
  pointOfContact: z.string().optional(),
  contactPhoneNumber: z.string().optional(),
}).refine((data) => data.availableRooms <= data.totalRooms, {
  message: "Available rooms cannot exceed total rooms",
  path: ["availableRooms"],
}).refine((data) => new Date(data.endDate) > new Date(data.startDate), {
  message: "End date must be after start date",
  path: ["endDate"],
});

type AddHotelForm = z.infer<typeof addHotelSchema>;

interface AddHotelModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: "new" | "instance";
  onModeChange?: (mode: "new" | "instance") => void;
}

export default function AddHotelModal({ open, onOpenChange, mode = "new", onModeChange }: AddHotelModalProps) {
  const [hotelIdToCheck, setHotelIdToCheck] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<AddHotelForm>({
    resolver: zodResolver(addHotelSchema),
    defaultValues: {
      hotelId: "",
      hotelName: "",
      location: "",
      district: "",
      address: "",
      pincode: "",
      startDate: "",
      endDate: "",
      totalRooms: 1,
      availableRooms: 1,
      pointOfContact: "",
      contactPhoneNumber: "",
    },
  });

  // Check if hotel ID exists and get suggested instance code
  const { data: hotelCheckResult, isLoading: checkingHotelId } = useQuery({
    queryKey: ["/api/admin/hotels/check-id", hotelIdToCheck],
    queryFn: async () => {
      if (!hotelIdToCheck) return null;
      const response = await fetch(`/api/admin/hotels/check-id?hotelId=${encodeURIComponent(hotelIdToCheck)}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to check hotel ID');
      }
      return await response.json();
    },
    enabled: !!hotelIdToCheck && hotelIdToCheck.length > 0,
  });

  const addHotelMutation = useMutation({
    mutationFn: async (data: AddHotelForm) => {
      const response = await fetch("/api/admin/hotels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to add hotel');
      }
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Hotel added successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard/hotels"] });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add hotel",
        variant: "destructive",
      });
    },
  });

  const handleHotelIdChange = (value: string) => {
    form.setValue("hotelId", value);
    setHotelIdToCheck(value);
  };

  // Reset form when modal opens/closes or mode changes
  const resetForm = () => {
    form.reset({
      hotelId: "",
      hotelName: "",
      location: "",
      district: "",
      address: "",
      pincode: "",
      startDate: "",
      endDate: "",
      totalRooms: 1,
      availableRooms: 1,
      pointOfContact: "",
      contactPhoneNumber: "",
    });
    setHotelIdToCheck("");
  };

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open]);

  // Auto-populate fields in instance mode
  useEffect(() => {
    if (mode === "instance" && hotelCheckResult?.exists && hotelCheckResult.existingInstances?.length > 0) {
      const firstInstance = hotelCheckResult.existingInstances[0];
      form.setValue("hotelName", firstInstance.hotelName || "");
      form.setValue("location", firstInstance.location || "");
      form.setValue("district", firstInstance.district || "");
      form.setValue("address", firstInstance.address || "");
      form.setValue("pincode", firstInstance.pincode || "");
      form.setValue("pointOfContact", firstInstance.pointOfContact || "");
      form.setValue("contactPhoneNumber", firstInstance.contactPhoneNumber || "");
    }
  }, [mode, hotelCheckResult, form]);

  const onSubmit = (data: AddHotelForm) => {
    // Validate based on mode
    if (mode === "new" && hotelCheckResult?.exists) {
      toast({
        title: "Error",
        description: "Hotel ID already exists. Use 'Add Instance' mode or choose a different ID.",
        variant: "destructive",
      });
      return;
    }
    
    if (mode === "instance" && !hotelCheckResult?.exists) {
      toast({
        title: "Error", 
        description: "Hotel ID not found. Use 'New Hotel' mode to create a new hotel.",
        variant: "destructive",
      });
      return;
    }
    
    addHotelMutation.mutate({ ...data, mode });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Building className="h-5 w-5" />
            <span>{mode === "new" ? "Add New Hotel" : "Add Hotel Instance"}</span>
          </DialogTitle>
        </DialogHeader>

        {/* Mode Selection */}
        <div className="flex space-x-2 p-4 bg-gray-50 rounded-lg">
          <Button
            variant={mode === "new" ? "default" : "outline"}
            size="sm"
            onClick={() => onModeChange?.("new")}
            data-testid="button-mode-new"
          >
            New Hotel
          </Button>
          <Button
            variant={mode === "instance" ? "default" : "outline"}
            size="sm"
            onClick={() => onModeChange?.("instance")}
            data-testid="button-mode-instance"
          >
            Add Instance
          </Button>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Hotel ID Field with Validation Feedback */}
            <div className="space-y-2">
              <FormField
                control={form.control}
                name="hotelId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hotel ID</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., TR-001, HOTEL-001, CM2025-001"
                        {...field}
                        onChange={(e) => handleHotelIdChange(e.target.value)}
                        data-testid="input-hotel-id"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Hotel ID Check Result */}
              {hotelIdToCheck && (
                <Card className="mt-2">
                  <CardContent className="p-3">
                    {checkingHotelId ? (
                      <div className="flex items-center space-x-2 text-gray-600">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                        <span className="text-sm">Checking hotel ID...</span>
                      </div>
                    ) : hotelCheckResult ? (
                      <div className="space-y-2">
                        {/* Status based on mode */}
                        {mode === "new" ? (
                          hotelCheckResult.exists ? (
                            <div className="flex items-center space-x-2 text-red-600">
                              <AlertCircle className="h-4 w-4" />
                              <span className="text-sm font-medium">Hotel ID already exists. Switch to 'Add Instance' mode.</span>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-2 text-green-600">
                              <CheckCircle className="h-4 w-4" />
                              <span className="text-sm font-medium">Hotel ID available for new hotel</span>
                            </div>
                          )
                        ) : (
                          hotelCheckResult.exists ? (
                            <div className="flex items-center space-x-2 text-green-600">
                              <CheckCircle className="h-4 w-4" />
                              <span className="text-sm font-medium">Hotel found. Ready to add instance.</span>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-2 text-red-600">
                              <AlertCircle className="h-4 w-4" />
                              <span className="text-sm font-medium">Hotel ID not found. Switch to 'New Hotel' mode.</span>
                            </div>
                          )
                        )}
                        
                        {/* Instance information for existing hotels */}
                        {hotelCheckResult.exists && (
                          <div className="space-y-2">
                            <div className="text-sm text-gray-600">
                              <span className="font-medium">Next Instance Code: </span>
                              <Badge variant="outline" className="ml-1">
                                {hotelCheckResult.suggestedInstanceCode}
                              </Badge>
                            </div>
                            
                            <div className="text-sm text-gray-600">
                              <span className="font-medium">Existing Instances: </span>
                              {hotelCheckResult.existingInstances.map((instance: any, index: number) => (
                                <Badge key={index} variant="secondary" className="ml-1">
                                  {instance.instanceCode}
                                </Badge>
                              ))}
                            </div>
                            
                            {/* Instance Details Table */}
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                              <div className="text-sm">
                                <span className="font-medium text-blue-800">Instance Details:</span>
                                <div className="mt-2 space-y-1">
                                  {hotelCheckResult.existingInstances.map((instance: any, index: number) => (
                                    <div key={index} className="text-blue-700 text-xs">
                                      <span className="font-medium">Instance {instance.instanceCode}:</span> {formatToIndianDate(instance.startDate)} - {formatToIndianDate(instance.endDate)}
                                    </div>
                                  ))}
                                </div>
                                <div className="mt-2 text-xs text-blue-600">
                                  Choose dates that don't overlap with existing instances.
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Basic Hotel Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Show all fields for new mode, limited fields for instance mode */}
              <FormField
                control={form.control}
                name="hotelName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hotel Name</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Hotel name" 
                        {...field} 
                        disabled={mode === "instance" && hotelCheckResult?.exists}
                        data-testid="input-hotel-name" 
                      />
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
                      <Input 
                        placeholder="Location" 
                        {...field} 
                        disabled={mode === "instance" && hotelCheckResult?.exists}
                        data-testid="input-location" 
                      />
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
                      <Input 
                        placeholder="District" 
                        {...field} 
                        disabled={mode === "instance" && hotelCheckResult?.exists}
                        data-testid="input-district" 
                      />
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
                      <Input 
                        placeholder="Pincode" 
                        {...field} 
                        disabled={mode === "instance" && hotelCheckResult?.exists}
                        data-testid="input-pincode" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Address */}
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Full address" 
                      {...field} 
                      disabled={mode === "instance" && hotelCheckResult?.exists}
                      data-testid="input-address" 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Date Range */}
            <div className="space-y-4">
              {/* Date Guidance for instance mode */}
              {mode === "instance" && hotelCheckResult?.exists && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="text-sm text-amber-800">
                    <strong>⚠️ Date Conflict Prevention:</strong>
                    <div className="mt-1 text-amber-700">
                      Ensure your dates don't overlap with existing instances. Overall date range spans from{" "}
                      <strong>{formatToIndianDate(hotelCheckResult.earliestStart)}</strong> to{" "}
                      <strong>{formatToIndianDate(hotelCheckResult.latestEnd)}</strong>.
                    </div>
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-start-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-end-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Room Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="totalRooms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Rooms</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        data-testid="input-total-rooms"
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
                        min="0"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        data-testid="input-available-rooms"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Contact Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="pointOfContact"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Point of Contact (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Contact person name" {...field} data-testid="input-contact-person" />
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
                    <FormLabel>Contact Phone (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="+91xxxxxxxxxx" {...field} data-testid="input-contact-phone" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Form Actions */}
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={addHotelMutation.isPending}
                data-testid="button-add-hotel"
              >
                {addHotelMutation.isPending ? "Adding..." : "Add Hotel"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}