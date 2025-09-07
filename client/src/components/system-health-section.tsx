import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { 
  Activity, Server, Database, Clock, Users, Zap, AlertTriangle, CheckCircle, RefreshCw, X
} from "lucide-react";

interface Connection {
  pid: number;
  username: string;
  database: string;
  client_addr: string;
  application_name: string;
  state: string;
  query_start: string;
  duration: string;
  query: string;
  wait_event: string;
}

interface Query {
  pid: number;
  usename: string;
  datname: string;
  state: string;
  query_start: string;
  duration: string;
  query: string;
  application_name: string;
}

interface PerformanceMetrics {
  cacheHit: {
    ratio: number;
    heap_read: number;
    heap_hit: number;
  };
  indexHit: {
    ratio: number;
  };
  databaseSize: {
    size: string;
    size_bytes: number;
  };
}

export default function SystemHealthSection() {
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [selectedQuery, setSelectedQuery] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch connections
  const { data: connections, isLoading: connectionsLoading } = useQuery({
    queryKey: ["/api/admin/technical/connections"],
    queryFn: async () => {
      const response = await fetch("/api/admin/technical/connections", {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch connections');
      return await response.json();
    },
    refetchInterval: autoRefresh ? 5000 : false
  });

  // Fetch running queries
  const { data: queries, isLoading: queriesLoading } = useQuery({
    queryKey: ["/api/admin/technical/running-queries"],
    queryFn: async () => {
      const response = await fetch("/api/admin/technical/running-queries", {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch running queries');
      return await response.json();
    },
    refetchInterval: autoRefresh ? 5000 : false
  });

  // Fetch performance metrics
  const { data: metrics } = useQuery({
    queryKey: ["/api/admin/technical/performance-metrics"],
    queryFn: async () => {
      const response = await fetch("/api/admin/technical/performance-metrics", {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch performance metrics');
      return await response.json();
    },
    refetchInterval: autoRefresh ? 30000 : false
  });

  // Fetch slow queries
  const { data: slowQueries } = useQuery({
    queryKey: ["/api/admin/technical/slow-queries"],
    queryFn: async () => {
      const response = await fetch("/api/admin/technical/slow-queries", {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch slow queries');
      return await response.json();
    }
  });

  // Kill query mutation
  const killQueryMutation = useMutation({
    mutationFn: async (pid: number) => {
      const response = await fetch("/api/admin/technical/kill-query", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pid }),
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to kill query');
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Query Cancelled",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/technical/running-queries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/technical/connections"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Kill Query",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const formatDuration = (duration: string) => {
    if (!duration) return 'N/A';
    // Parse PostgreSQL interval format
    const match = duration.match(/(\d+):(\d+):(\d+)/);
    if (match) {
      const [, hours, minutes, seconds] = match;
      if (hours !== '00') return `${hours}h ${minutes}m`;
      if (minutes !== '00') return `${minutes}m ${seconds}s`;
      return `${seconds}s`;
    }
    return duration;
  };

  const truncateQuery = (query: string, maxLength = 80) => {
    if (!query) return 'N/A';
    return query.length > maxLength ? query.substring(0, maxLength) + '...' : query;
  };

  const getStateColor = (state: string) => {
    switch (state.toLowerCase()) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'idle': return 'bg-gray-100 text-gray-800';
      case 'idle in transaction': return 'bg-yellow-100 text-yellow-800';
      case 'waiting': return 'bg-red-100 text-red-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  const formatPercentage = (value: number) => {
    return value ? `${value.toFixed(1)}%` : 'N/A';
  };

  return (
    <div className="space-y-6">
      {/* System Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Connections</p>
                <p className="text-2xl font-bold text-green-600">
                  {connections?.total || 0}
                </p>
              </div>
              <Users className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Running Queries</p>
                <p className="text-2xl font-bold text-blue-600">
                  {queries?.total || 0}
                </p>
              </div>
              <Database className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Cache Hit Ratio</p>
                <p className="text-2xl font-bold text-purple-600">
                  {formatPercentage(metrics?.cacheHit?.ratio)}
                </p>
              </div>
              <Zap className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Database Size</p>
                <p className="text-2xl font-bold text-orange-600">
                  {metrics?.databaseSize?.size || 'N/A'}
                </p>
              </div>
              <Server className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Real-time Monitoring
            </span>
            <Button
              onClick={() => setAutoRefresh(!autoRefresh)}
              variant={autoRefresh ? "default" : "outline"}
              size="sm"
              data-testid="button-auto-refresh"
            >
              {autoRefresh ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Auto Refresh ON
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Auto Refresh OFF
                </>
              )}
            </Button>
          </CardTitle>
          <CardDescription>
            {autoRefresh 
              ? "Automatically refreshing every 5 seconds" 
              : "Click auto refresh to enable real-time updates"
            }
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Active Connections */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Active Database Connections ({connections?.total || 0})
          </CardTitle>
          <CardDescription>
            Currently active database connections and their status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {connectionsLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin" />
              <span className="ml-2">Loading connections...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">PID</th>
                    <th className="text-left py-2">User</th>
                    <th className="text-left py-2">Database</th>
                    <th className="text-left py-2">Client</th>
                    <th className="text-left py-2">State</th>
                    <th className="text-left py-2">Duration</th>
                    <th className="text-left py-2">Application</th>
                    <th className="text-left py-2">Current Query</th>
                  </tr>
                </thead>
                <tbody>
                  {connections?.connections?.map((conn: Connection, index: number) => (
                    <tr key={index} className="border-b">
                      <td className="py-2 font-mono text-xs">{conn.pid}</td>
                      <td className="py-2">{conn.username}</td>
                      <td className="py-2">{conn.database}</td>
                      <td className="py-2 text-xs">{conn.client_addr || 'local'}</td>
                      <td className="py-2">
                        <Badge className={getStateColor(conn.state)}>
                          {conn.state}
                        </Badge>
                      </td>
                      <td className="py-2 text-xs">{formatDuration(conn.duration)}</td>
                      <td className="py-2 text-xs">{conn.application_name || 'N/A'}</td>
                      <td className="py-2 text-xs font-mono max-w-xs">
                        {truncateQuery(conn.query)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Running Queries */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Active Queries ({queries?.total || 0})
          </CardTitle>
          <CardDescription>
            Currently executing database queries
            {queries?.longRunning?.length > 0 && (
              <span className="ml-2 text-red-600">
                • {queries.longRunning.length} long-running detected
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {queriesLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin" />
              <span className="ml-2">Loading queries...</span>
            </div>
          ) : (
            <div className="space-y-4">
              {queries?.queries?.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                  <p>No active queries running</p>
                </div>
              ) : (
                queries?.queries?.map((query: Query, index: number) => (
                  <div key={index} className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-4 mb-2">
                          <span className="font-mono text-sm">PID: {query.pid}</span>
                          <Badge className={getStateColor(query.state)}>
                            {query.state}
                          </Badge>
                          <span className="text-sm text-gray-600">
                            Duration: {formatDuration(query.duration)}
                          </span>
                          <span className="text-sm text-gray-600">
                            User: {query.usename}
                          </span>
                        </div>
                        <div className="bg-gray-50 p-3 rounded text-sm font-mono overflow-x-auto">
                          {selectedQuery === `${query.pid}-${index}` ? (
                            <div>
                              <div className="mb-2 flex justify-end">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setSelectedQuery(null)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                              <pre className="whitespace-pre-wrap text-xs">
                                {query.query}
                              </pre>
                            </div>
                          ) : (
                            <div 
                              className="cursor-pointer"
                              onClick={() => setSelectedQuery(`${query.pid}-${index}`)}
                            >
                              {truncateQuery(query.query, 200)}
                              {query.query.length > 200 && (
                                <span className="text-blue-600 ml-2">(click to expand)</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => killQueryMutation.mutate(query.pid)}
                        disabled={killQueryMutation.isPending}
                        className="ml-4"
                        data-testid={`button-kill-query-${query.pid}`}
                      >
                        {killQueryMutation.isPending ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Performance Metrics */}
      {metrics && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Performance Metrics
            </CardTitle>
            <CardDescription>
              Database cache efficiency and performance indicators
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <h4 className="font-medium">Buffer Cache Hit Ratio</h4>
                <div className="text-2xl font-bold text-green-600">
                  {formatPercentage(metrics.cacheHit?.ratio)}
                </div>
                <p className="text-sm text-gray-600">
                  {metrics.cacheHit?.ratio > 95 ? 'Excellent' : 
                   metrics.cacheHit?.ratio > 90 ? 'Good' : 'Needs attention'}
                </p>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium">Index Hit Ratio</h4>
                <div className="text-2xl font-bold text-blue-600">
                  {formatPercentage(metrics.indexHit?.ratio)}
                </div>
                <p className="text-sm text-gray-600">
                  {metrics.indexHit?.ratio > 95 ? 'Excellent' : 
                   metrics.indexHit?.ratio > 90 ? 'Good' : 'Consider adding indexes'}
                </p>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium">Database Size</h4>
                <div className="text-2xl font-bold text-orange-600">
                  {metrics.databaseSize?.size}
                </div>
                <p className="text-sm text-gray-600">
                  Total storage used
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Slow Queries */}
      {slowQueries?.slowQueries?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Slow Query Analysis
            </CardTitle>
            <CardDescription>
              Queries that may need optimization (avg execution time &gt; 1s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {slowQueries.slowQueries.map((query: any, index: number) => (
                <div key={index} className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <div className="space-y-1">
                      <div className="flex gap-4 text-sm">
                        <span>Calls: {query.calls}</span>
                        <span>Avg Time: {Math.round(query.mean_time)}ms</span>
                        <span>Total Time: {Math.round(query.total_time)}ms</span>
                        <span>Cache Hit: {formatPercentage(query.hit_percent)}</span>
                      </div>
                    </div>
                    <Badge variant="destructive">
                      Slow Query
                    </Badge>
                  </div>
                  <div className="bg-gray-50 p-3 rounded text-sm font-mono overflow-x-auto">
                    {truncateQuery(query.query, 300)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}