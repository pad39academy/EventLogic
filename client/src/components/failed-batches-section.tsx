import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Clock, Database } from 'lucide-react';

interface FailedBatch {
  eventId: string;
  batchNumber: number;
  errorMessage: string;
  failedAt: string;
  uploadType: string;
  rowNumbers: {
    start: number;
    end: number;
    count: number;
  };
}

interface FailedBatchesResponse {
  failedBatches: FailedBatch[];
  totalFailed: number;
}

export default function FailedBatchesSection() {
  // Get failed batches data
  const { data: failedData, isLoading, error } = useQuery({
    queryKey: ['/api/admin/failed-batches'],
    queryFn: async (): Promise<FailedBatchesResponse> => {
      const response = await fetch('/api/admin/failed-batches', {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch failed batches');
      }
      return await response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-96 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="text-center py-8">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-700">Failed to load failed batches information</p>
        </CardContent>
      </Card>
    );
  }

  const failedBatches = failedData?.failedBatches || [];

  return (
    <>
      {/* Failed Batches Header */}
      <div className="mb-8">
        <div className="md:flex md:items-center md:justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
              Failed Batch Analysis
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Track and resolve failed batch uploads with specific row number information for recovery
            </p>
          </div>
        </div>
      </div>

      {failedBatches.length === 0 ? (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="text-center py-8">
            <Database className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-green-800 mb-2">No Failed Batches</h3>
            <p className="text-green-700">All batch uploads have been processed successfully!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Summary */}
          <Card className="border-orange-200 bg-orange-50">
            <CardHeader>
              <CardTitle className="text-orange-800 flex items-center">
                <AlertTriangle className="h-5 w-5 mr-2" />
                Failed Batches Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-orange-700">
                <strong>{failedData?.totalFailed || 0}</strong> batch(es) have failed and require attention
              </p>
            </CardContent>
          </Card>

          {/* Failed Batches List */}
          <div className="grid gap-6">
            {failedBatches.map((batch) => (
              <Card key={batch.eventId} className="border-red-200">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-red-800 flex items-center">
                      <AlertTriangle className="h-5 w-5 mr-2" />
                      Batch #{batch.batchNumber} Failed
                    </CardTitle>
                    <Badge variant="destructive">
                      {batch.uploadType}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Error Message */}
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Error Message:</h4>
                    <p className="text-sm text-red-700 bg-red-50 p-3 rounded border border-red-200">
                      {batch.errorMessage}
                    </p>
                  </div>

                  {/* Row Information */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded border">
                      <h4 className="font-medium text-gray-900 mb-2">File Row Numbers:</h4>
                      <div className="text-sm text-gray-700 space-y-1">
                        <p><strong>Start Row:</strong> {batch.rowNumbers.start}</p>
                        <p><strong>End Row:</strong> {batch.rowNumbers.end}</p>
                        <p><strong>Record Count:</strong> {batch.rowNumbers.count}</p>
                      </div>
                    </div>

                    <div className="bg-blue-50 p-4 rounded border border-blue-200">
                      <h4 className="font-medium text-blue-900 mb-2">Recovery Instructions:</h4>
                      <div className="text-sm text-blue-700 space-y-1">
                        <p>1. Open your original file</p>
                        <p>2. Copy header row (Row 1)</p>
                        <p>3. Copy rows {batch.rowNumbers.start}-{batch.rowNumbers.end}</p>
                        <p>4. Create new file and re-upload</p>
                      </div>
                    </div>
                  </div>

                  {/* Timestamp */}
                  <div className="flex items-center text-sm text-gray-500">
                    <Clock className="h-4 w-4 mr-2" />
                    Failed at: {new Date(batch.failedAt).toLocaleString()}
                  </div>

                  {/* Command Line Recovery (Optional) */}
                  <div className="bg-gray-100 p-4 rounded border">
                    <h4 className="font-medium text-gray-900 mb-2">Command Line Recovery:</h4>
                    <div className="text-sm font-mono text-gray-800 space-y-1">
                      <p># Extract header + failed rows</p>
                      <p>head -1 original_file.psv &gt; failed_batch_{batch.batchNumber}.psv</p>
                      <p>sed -n '{batch.rowNumbers.start},{batch.rowNumbers.end}p' original_file.psv &gt;&gt; failed_batch_{batch.batchNumber}.psv</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </>
  );
}