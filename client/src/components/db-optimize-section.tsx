import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { 
  Database, Zap, BarChart, Trash2, RefreshCw, AlertTriangle, CheckCircle, Clock
} from "lucide-react";

interface TableStat {
  tablename: string;
  size: string;
  size_bytes: number;
  inserts: number;
  updates: number;
  deletes: number;
  live_tuples: number;
  dead_tuples: number;
  last_vacuum: string;
  last_analyze: string;
}

interface IndexRecommendation {
  tablename: string;
  seq_scan: number;
  seq_tup_read: number;
  priority: string;
  recommendation: string;
}

export default function DbOptimizeSection() {
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch database statistics
  const { data: dbStats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ["/api/admin/technical/db-stats"],
    queryFn: async () => {
      const response = await fetch("/api/admin/technical/db-stats", {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch database statistics');
      return await response.json();
    }
  });

  // Fetch index recommendations
  const { data: recommendations } = useQuery({
    queryKey: ["/api/admin/technical/index-recommendations"],
    queryFn: async () => {
      const response = await fetch("/api/admin/technical/index-recommendations", {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch recommendations');
      return await response.json();
    }
  });

  // Analyze tables mutation
  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/technical/analyze-tables", {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to analyze tables');
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Analysis Complete",
        description: data.message,
      });
      refetchStats();
      setSelectedAction(null);
    },
    onError: (error: any) => {
      toast({
        title: "Analysis Failed",
        description: error.message,
        variant: "destructive",
      });
      setSelectedAction(null);
    },
  });

  // Vacuum tables mutation
  const vacuumMutation = useMutation({
    mutationFn: async (fullVacuum: boolean = false) => {
      const response = await fetch("/api/admin/technical/vacuum-tables", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vacuum_full: fullVacuum }),
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to vacuum tables');
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Vacuum Complete",
        description: data.message,
      });
      refetchStats();
      setSelectedAction(null);
    },
    onError: (error: any) => {
      toast({
        title: "Vacuum Failed",
        description: error.message,
        variant: "destructive",
      });
      setSelectedAction(null);
    },
  });

  // Reindex mutation
  const reindexMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/technical/reindex-tables", {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to reindex tables');
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Reindex Complete",
        description: data.message,
      });
      refetchStats();
      setSelectedAction(null);
    },
    onError: (error: any) => {
      toast({
        title: "Reindex Failed",
        description: error.message,
        variant: "destructive",
      });
      setSelectedAction(null);
    },
  });

  // Event cleanup mutation
  const cleanupMutation = useMutation({
    mutationFn: async (days: number = 30) => {
      const response = await fetch("/api/admin/technical/cleanup-events", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days }),
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to cleanup events');
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Cleanup Complete",
        description: data.message,
      });
      setSelectedAction(null);
    },
    onError: (error: any) => {
      toast({
        title: "Cleanup Failed",
        description: error.message,
        variant: "destructive",
      });
      setSelectedAction(null);
    },
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'bg-red-100 text-red-800';
      case 'Medium': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-green-100 text-green-800';
    }
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  const isActionRunning = (action: string) => {
    return selectedAction === action && (
      analyzeMutation.isPending || 
      vacuumMutation.isPending || 
      reindexMutation.isPending || 
      cleanupMutation.isPending
    );
  };

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Quick Database Actions
          </CardTitle>
          <CardDescription>
            Essential maintenance operations for optimal database performance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button
              onClick={() => {
                setSelectedAction('analyze');
                analyzeMutation.mutate();
              }}
              disabled={isActionRunning('analyze')}
              className="flex items-center gap-2 h-auto py-4"
              data-testid="button-analyze-tables"
            >
              {isActionRunning('analyze') ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <BarChart className="h-4 w-4" />
              )}
              <div className="text-left">
                <div className="font-medium">Analyze Tables</div>
                <div className="text-xs opacity-80">Update statistics</div>
              </div>
            </Button>

            <Button
              onClick={() => {
                setSelectedAction('vacuum');
                vacuumMutation.mutate(false);
              }}
              disabled={isActionRunning('vacuum')}
              variant="outline"
              className="flex items-center gap-2 h-auto py-4"
              data-testid="button-vacuum-tables"
            >
              {isActionRunning('vacuum') ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Database className="h-4 w-4" />
              )}
              <div className="text-left">
                <div className="font-medium">Vacuum Tables</div>
                <div className="text-xs opacity-80">Clean dead tuples</div>
              </div>
            </Button>

            <Button
              onClick={() => {
                setSelectedAction('reindex');
                reindexMutation.mutate();
              }}
              disabled={isActionRunning('reindex')}
              variant="outline"
              className="flex items-center gap-2 h-auto py-4"
              data-testid="button-reindex-tables"
            >
              {isActionRunning('reindex') ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              <div className="text-left">
                <div className="font-medium">Rebuild Indexes</div>
                <div className="text-xs opacity-80">Optimize performance</div>
              </div>
            </Button>

            <Button
              onClick={() => {
                setSelectedAction('cleanup');
                cleanupMutation.mutate(30);
              }}
              disabled={isActionRunning('cleanup')}
              variant="outline"
              className="flex items-center gap-2 h-auto py-4"
              data-testid="button-cleanup-events"
            >
              {isActionRunning('cleanup') ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              <div className="text-left">
                <div className="font-medium">Cleanup Events</div>
                <div className="text-xs opacity-80">Remove old data</div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Database Tables Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Database Tables Overview
          </CardTitle>
          <CardDescription>
            Table sizes, activity statistics, and maintenance status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {statsLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin" />
              <span className="ml-2">Loading database statistics...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Table</th>
                    <th className="text-left py-2">Size</th>
                    <th className="text-left py-2">Live Tuples</th>
                    <th className="text-left py-2">Dead Tuples</th>
                    <th className="text-left py-2">Last Vacuum</th>
                    <th className="text-left py-2">Last Analyze</th>
                    <th className="text-left py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {dbStats?.tables?.map((table: TableStat, index: number) => (
                    <tr key={index} className="border-b">
                      <td className="py-2 font-medium">{table.tablename}</td>
                      <td className="py-2">{table.size}</td>
                      <td className="py-2">{formatNumber(table.live_tuples || 0)}</td>
                      <td className="py-2">
                        {table.dead_tuples > 1000 ? (
                          <Badge variant="destructive" className="text-xs">
                            {formatNumber(table.dead_tuples)}
                          </Badge>
                        ) : (
                          formatNumber(table.dead_tuples || 0)
                        )}
                      </td>
                      <td className="py-2">
                        {table.last_vacuum ? (
                          <span className="text-xs text-gray-600">
                            {new Date(table.last_vacuum).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">Never</span>
                        )}
                      </td>
                      <td className="py-2">
                        {table.last_analyze ? (
                          <span className="text-xs text-gray-600">
                            {new Date(table.last_analyze).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">Never</span>
                        )}
                      </td>
                      <td className="py-2">
                        {table.dead_tuples > 1000 ? (
                          <Badge variant="destructive" className="text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Needs Vacuum
                          </Badge>
                        ) : (
                          <Badge variant="default" className="text-xs bg-green-100 text-green-800">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Healthy
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Index Recommendations */}
      {recommendations?.recommendations?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Index Optimization Recommendations
            </CardTitle>
            <CardDescription>
              Tables that might benefit from additional indexes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recommendations.recommendations.map((rec: IndexRecommendation, index: number) => (
                <div key={index} className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium">Table: {rec.tablename}</h4>
                      <p className="text-sm text-gray-600 mt-1">{rec.recommendation}</p>
                      <div className="flex gap-4 text-xs text-gray-500 mt-2">
                        <span>Sequential Scans: {formatNumber(rec.seq_scan)}</span>
                        <span>Tuples Read: {formatNumber(rec.seq_tup_read)}</span>
                      </div>
                    </div>
                    <Badge className={getPriorityColor(rec.priority)}>
                      {rec.priority} Priority
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Index Statistics */}
      {dbStats?.indexes?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Index Usage Statistics
            </CardTitle>
            <CardDescription>
              Current index sizes and usage patterns
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Index</th>
                    <th className="text-left py-2">Table</th>
                    <th className="text-left py-2">Size</th>
                    <th className="text-left py-2">Tuples Read</th>
                    <th className="text-left py-2">Tuples Fetched</th>
                  </tr>
                </thead>
                <tbody>
                  {dbStats.indexes.slice(0, 10).map((index: any, i: number) => (
                    <tr key={i} className="border-b">
                      <td className="py-2 font-medium">{index.indexname}</td>
                      <td className="py-2">{index.tablename}</td>
                      <td className="py-2">{index.index_size}</td>
                      <td className="py-2">{formatNumber(index.idx_tup_read || 0)}</td>
                      <td className="py-2">{formatNumber(index.idx_tup_fetch || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}