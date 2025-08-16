import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, X, CheckCircle, AlertTriangle } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { UploadResult } from "@/lib/types";

interface UploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  uploadType?: UploadType;
  onUploadTypeChange?: (type: UploadType | "") => void;
}

type UploadType = "hotel_inventory" | "coaches_officials" | "players";

export default function UploadModal({ 
  open, 
  onOpenChange, 
  uploadType: propsUploadType,
  onUploadTypeChange 
}: UploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploadType, setUploadType] = useState<UploadType | "">(propsUploadType || "");
  
  // Sync with props when they change
  useEffect(() => {
    if (propsUploadType) {
      setUploadType(propsUploadType);
    }
  }, [propsUploadType]);
  // Mandatory validation options (not user-selectable)
  const mandatoryOptions = {
    validateHotelIds: true,
    enforceMinimumStay: true,
    skipDuplicates: true,
  };
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      try {
        const endpoint = `/api/admin/upload/${uploadType.replace('_', '-')}`;
        const response = await fetch(endpoint, {
          method: 'POST',
          body: formData,
          credentials: 'include',
        });

        clearInterval(progressInterval);
        setUploadProgress(100);

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Upload failed');
        }

        return await response.json();
      } catch (error) {
        clearInterval(progressInterval);
        throw error;
      }
    },
    onSuccess: (result: UploadResult) => {
      setUploadResult(result);
      if (result.success) {
        toast({
          title: "Upload successful",
          description: `Created ${result.created} records`,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard"] });
      } else {
        toast({
          title: "Upload failed",
          description: `${result.errors.length} errors occurred`,
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      setUploadProgress(0);
      toast({
        title: "Upload failed",
        description: error.message || "An error occurred during upload",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleUpload = () => {
    if (!file || !uploadType) {
      toast({
        title: "Missing information",
        description: "Please select a file and upload type",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('uploadType', uploadType);
    formData.append('options', JSON.stringify(mandatoryOptions));

    setUploadProgress(0);
    setUploadResult(null);
    uploadMutation.mutate(formData);
  };

  const handleClose = () => {
    setFile(null);
    setUploadType(propsUploadType || "");
    setUploadProgress(0);
    setUploadResult(null);
    onUploadTypeChange?.("");
    onOpenChange(false);
  };

  const getUploadTypeLabel = (type: string) => {
    switch (type) {
      case "hotel_inventory": return "Hotel Inventory Sheet";
      case "coaches_officials": return "Coach & Official Data Sheet";
      case "players": return "Player Data Sheet";
      default: return "Select sheet type...";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-full max-h-[90vh] overflow-y-auto" data-testid="upload-modal">
        <DialogHeader>
          <DialogTitle>Upload Data Sheet</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* File Upload Area */}
          <div className="border-2 border-gray-300 border-dashed rounded-lg p-6 text-center hover:border-primary-400 transition-colors">
            <div className="mx-auto h-12 w-12 text-gray-400 mb-4">
              <Upload className="h-12 w-12" />
            </div>
            <div className="text-sm">
              <Label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-primary-600 hover:text-primary-500">
                <span>Click to upload</span>
                <Input
                  id="file-upload"
                  type="file"
                  className="sr-only"
                  accept=".psv,.csv"
                  onChange={handleFileSelect}
                  data-testid="input-file-upload"
                />
              </Label>
              <span className="text-gray-500"> or drag and drop</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">PSV files up to 10MB</p>
            {file && (
              <p className="text-sm text-primary-600 mt-2" data-testid="text-selected-file">
                Selected: {file.name}
              </p>
            )}
          </div>

          {/* Upload Type Selection */}
          {/* Only show type selection if not pre-selected */}
          {!propsUploadType && (
            <div className="space-y-2">
              <Label>Data Sheet Type</Label>
              <Select value={uploadType} onValueChange={(value: UploadType) => setUploadType(value)}>
                <SelectTrigger data-testid="select-upload-type">
                  <SelectValue placeholder="Select sheet type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hotel_inventory">Hotel Inventory Sheet</SelectItem>
                  <SelectItem value="coaches_officials">Coach & Official Data Sheet</SelectItem>
                  <SelectItem value="players">Player Data Sheet</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          
          {/* Show selected type when pre-selected */}
          {propsUploadType && (
            <div className="space-y-2">
              <Label>Data Sheet Type</Label>
              <div className="p-3 bg-gray-50 border rounded-md">
                <span className="text-sm font-medium">
                  {propsUploadType === "hotel_inventory" && "Hotel Inventory Sheet"}
                  {propsUploadType === "coaches_officials" && "Coach & Official Data Sheet"}
                  {propsUploadType === "players" && "Player Data Sheet"}
                </span>
              </div>
            </div>
          )}

          {/* Hotel Inventory Format Guide */}
          {uploadType === "hotel_inventory" && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5">
                <h4 className="text-[10px] font-semibold text-blue-900 mb-1.5">Required Format (14 columns)</h4>
                <div className="text-[8px] text-blue-800 font-mono bg-blue-100 p-1 rounded leading-tight">
                  <div className="space-y-0.5">
                    <div>HotelID|InstanceCode|HotelName|Location|District</div>
                    <div>Address|Pincode|PointOfContact|ContactPhone</div>
                    <div>StartDate|EndDate|TotalRooms|OccupiedRooms|AvailableRooms</div>
                  </div>
                </div>
                <div className="mt-1 text-[8px] text-blue-700">
                  <strong>Alternative:</strong> camelCase or lowercase accepted
                </div>
                <div className="mt-1.5 space-y-0.5 text-[8px] text-blue-700">
                  <div className="font-medium">New Required Fields:</div>
                  <div className="space-y-0.5">
                    <div>• <strong>pointOfContact</strong> - Hotel staff contact</div>
                    <div>• <strong>contactPhoneNumber</strong> - Hotel phone</div>
                  </div>
                </div>
              </div>
              
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                <h4 className="text-[10px] font-semibold text-amber-900 mb-1.5">Mandatory Validations</h4>
                <div className="space-y-0.5 text-[8px] text-amber-800">
                  <div className="flex items-start space-x-1">
                    <div className="w-1 h-1 bg-amber-600 rounded-full mt-0.5 flex-shrink-0"></div>
                    <span className="leading-tight">Hotel ID validation (prevent overlapping dates)</span>
                  </div>
                  <div className="flex items-start space-x-1">
                    <div className="w-1 h-1 bg-amber-600 rounded-full mt-0.5 flex-shrink-0"></div>
                    <span className="leading-tight">Minimum 3-day stay enforcement</span>
                  </div>
                  <div className="flex items-start space-x-1">
                    <div className="w-1 h-1 bg-amber-600 rounded-full mt-0.5 flex-shrink-0"></div>
                    <span className="leading-tight">Duplicate detection (skip existing combinations)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Progress Bar */}
          {uploadMutation.isPending && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="w-full" data-testid="upload-progress" />
            </div>
          )}

          {/* Upload Result */}
          {uploadResult && (
            <div className="space-y-3">
              {uploadResult.success ? (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Upload successful! Created {uploadResult.created} records.
                    {uploadResult.warnings.length > 0 && ` ${uploadResult.warnings.length} warnings.`}
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Upload failed with {uploadResult.errors.length} errors.
                  </AlertDescription>
                </Alert>
              )}

              {uploadResult.errors.length > 0 && (
                <div className="max-h-32 overflow-y-auto">
                  <h4 className="text-sm font-medium text-error-600 mb-2">Errors:</h4>
                  <ul className="text-xs text-error-600 space-y-1">
                    {uploadResult.errors.map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}

              {uploadResult.warnings.length > 0 && (
                <div className="max-h-32 overflow-y-auto">
                  <h4 className="text-sm font-medium text-warning-600 mb-2">Warnings:</h4>
                  <ul className="text-xs text-warning-600 space-y-1">
                    {uploadResult.warnings.map((warning, index) => (
                      <li key={index}>• {warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleClose}
              disabled={uploadMutation.isPending}
              data-testid="button-cancel-upload"
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleUpload}
              disabled={!file || !uploadType || uploadMutation.isPending}
              data-testid="button-upload-file"
            >
              {uploadMutation.isPending ? "Uploading..." : "Upload & Validate"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
