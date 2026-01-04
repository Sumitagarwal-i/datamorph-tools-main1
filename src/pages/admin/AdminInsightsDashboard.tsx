import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
} from "recharts";

type TimeRangeKey = "24h" | "7d" | "30d" | "90d" | "all";

const RANGE_OPTIONS: Array<{ key: TimeRangeKey; label: string; ms: number | null }> = [
  { key: "24h", label: "Last 24 hours", ms: 24 * 60 * 60 * 1000 },
  { key: "7d", label: "Last 7 days", ms: 7 * 24 * 60 * 60 * 1000 },
  { key: "30d", label: "Last 30 days", ms: 30 * 24 * 60 * 60 * 1000 },
  { key: "90d", label: "Last 90 days", ms: 90 * 24 * 60 * 60 * 1000 },
  { key: "all", label: "All time", ms: null },
];

type AnalyticsEventRow = {
  id: number;
  event_type: string;
  timestamp: string;
  file_name: string | null;
  file_type: string | null;
  metadata: any;
};

type AnalyticsRequestRow = {
  id: number;
  timestamp: string;
  file_type: string;
  latency_ms: number;
  success: boolean;
  cache_hit: boolean | null;
  tokens_used: number | null;
  total_errors: number;
  total_warnings: number;
};

type AnalyticsFeedbackRow = {
  id: number;
  timestamp: string;
  file_name: string | null;
  file_type: string | null;
  main_answer: string | null;
  follow_up: string | null;
  free_text: string | null;
  use_case: string | null;
};

type ConversionRow = {
  id: string;
  timestamp: string;
  input_format: string;
  output_format: string;
  item_count: number;
};

type FeedbackRow = {
  id: string;
  created_at: string;
  email: string | null;
  message: string;
};

function toStartIso(range: TimeRangeKey): string | null {
  const opt = RANGE_OPTIONS.find((r) => r.key === range);
  if (!opt || opt.ms == null) return null;
  return new Date(Date.now() - opt.ms).toISOString();
}

function toDayKey(iso: string): string {
  // YYYY-MM-DD
  return iso.slice(0, 10);
}

const COLORS = ["#4F7CFF", "#22c55e", "#f59e0b", "#ef4444", "#a855f7", "#06b6d4"];

const AdminInsightsDashboard = () => {
  const [range, setRange] = useState<TimeRangeKey>("30d");
  const [loading, setLoading] = useState(false);

  const [events, setEvents] = useState<AnalyticsEventRow[]>([]);
  const [requests, setRequests] = useState<AnalyticsRequestRow[]>([]);
  const [inspectFeedback, setInspectFeedback] = useState<AnalyticsFeedbackRow[]>([]);
  const [conversions, setConversions] = useState<ConversionRow[]>([]);
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);

  const startIso = useMemo(() => toStartIso(range), [range]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const untyped = supabase as any;

      const eventsQ = untyped
        .from("analytics_events")
        .select("id,event_type,timestamp,file_name,file_type,metadata")
        .order("timestamp", { ascending: false })
        .limit(2000);
      const requestsQ = untyped
        .from("analytics_requests")
        .select(
          "id,timestamp,file_type,latency_ms,success,cache_hit,tokens_used,total_errors,total_warnings"
        )
        .order("timestamp", { ascending: false })
        .limit(2000);
      const inspectFeedbackQ = untyped
        .from("analytics_feedbacks")
        .select("id,timestamp,file_name,file_type,main_answer,follow_up,free_text,use_case")
        .order("timestamp", { ascending: false })
        .limit(1000);

      const conversionsQ = (supabase as any)
        .from("conversions")
        .select("id,timestamp,input_format,output_format,item_count")
        .order("timestamp", { ascending: false })
        .limit(1000);

      const feedbackQ = (supabase as any)
        .from("feedback")
        .select("id,created_at,email,message")
        .order("created_at", { ascending: false })
        .limit(500);

      if (startIso) {
        eventsQ.gte("timestamp", startIso);
        requestsQ.gte("timestamp", startIso);
        inspectFeedbackQ.gte("timestamp", startIso);
        conversionsQ.gte("timestamp", startIso);
        feedbackQ.gte("created_at", startIso);
      }

      const [eventsRes, requestsRes, inspectFbRes, convRes, fbRes] = await Promise.all([
        eventsQ,
        requestsQ,
        inspectFeedbackQ,
        conversionsQ,
        feedbackQ,
      ]);

      if (eventsRes.error) throw eventsRes.error;
      if (requestsRes.error) throw requestsRes.error;
      if (inspectFbRes.error) throw inspectFbRes.error;
      if (convRes.error) throw convRes.error;
      if (fbRes.error) throw fbRes.error;

      setEvents((eventsRes.data || []) as AnalyticsEventRow[]);
      setRequests((requestsRes.data || []) as AnalyticsRequestRow[]);
      setInspectFeedback((inspectFbRes.data || []) as AnalyticsFeedbackRow[]);
      setConversions((convRes.data || []) as ConversionRow[]);
      setFeedback((fbRes.data || []) as FeedbackRow[]);
    } catch (e: any) {
      console.error(e);
      toast.error("Failed to load analytics. Check Supabase RLS / access.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const kpis = useMemo(() => {
    const totalUiEvents = events.length;
    const totalRequests = requests.length;

    const analysisStart = events.filter((e) => e.event_type === "analysis_start").length;
    const analysisComplete = events.filter((e) => e.event_type === "analysis_complete").length;
    const uploads = events.filter((e) => e.event_type === "file_upload").length;
    const pastes = events.filter((e) => e.event_type === "file_paste").length;

    const successfulRequests = requests.filter((r) => r.success).length;
    const successRate = totalRequests ? (successfulRequests / totalRequests) * 100 : 0;

    const avgLatency = totalRequests
      ? Math.round(requests.reduce((sum, r) => sum + (r.latency_ms || 0), 0) / totalRequests)
      : 0;

    const totalTokens = requests.reduce((sum, r) => sum + (r.tokens_used || 0), 0);

    return {
      totalUiEvents,
      totalRequests,
      analysisStart,
      analysisComplete,
      uploads,
      pastes,
      successRate,
      avgLatency,
      totalTokens,
    };
  }, [events, requests]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of events) {
      const key = toDayKey(e.timestamp);
      map.set(key, (map.get(key) || 0) + 1);
    }

    const data = Array.from(map.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return data;
  }, [events]);

  const topEventTypes = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of events) {
      map.set(e.event_type, (map.get(e.event_type) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([event_type, count]) => ({ event_type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [events]);

  const latencyByDay = useMemo(() => {
    const map = new Map<string, { sum: number; n: number }>();
    for (const r of requests) {
      const key = toDayKey(r.timestamp);
      const cur = map.get(key) || { sum: 0, n: 0 };
      cur.sum += r.latency_ms || 0;
      cur.n += 1;
      map.set(key, cur);
    }
    return Array.from(map.entries())
      .map(([date, v]) => ({ date, avg_latency_ms: v.n ? Math.round(v.sum / v.n) : 0 }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [requests]);

  const feedbackBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const f of inspectFeedback) {
      const key = f.main_answer || "(missing)";
      map.set(key, (map.get(key) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [inspectFeedback]);

  const recentEvents = useMemo(() => events.slice(0, 25), [events]);
  const recentInspectFeedback = useMemo(() => inspectFeedback.slice(0, 20), [inspectFeedback]);
  const recentContactFeedback = useMemo(() => feedback.slice(0, 20), [feedback]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">Product Insights</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Usage analytics, performance telemetry, and feedback.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Select value={range} onValueChange={(v) => setRange(v as TimeRangeKey)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select range" />
            </SelectTrigger>
            <SelectContent>
              {RANGE_OPTIONS.map((opt) => (
                <SelectItem key={opt.key} value={opt.key}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="secondary" onClick={loadAll} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">UI Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-foreground">{kpis.totalUiEvents}</div>
            <div className="mt-2 text-xs text-muted-foreground">
              Uploads: {kpis.uploads} • Pastes: {kpis.pastes}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Analyze Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-foreground">{kpis.totalRequests}</div>
            <div className="mt-2 text-xs text-muted-foreground">
              Success rate: {kpis.successRate.toFixed(1)}% • Avg latency: {kpis.avgLatency}ms
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Feedback</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-foreground">{inspectFeedback.length}</div>
            <div className="mt-2 text-xs text-muted-foreground">
              Contact messages: {feedback.length} • Conversions: {conversions.length}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">UI activity over time</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={eventsByDay} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#4F7CFF" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top UI events</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topEventTypes} margin={{ left: 8, right: 8, top: 8, bottom: 32 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                <XAxis dataKey="event_type" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#4F7CFF" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">API latency over time</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={latencyByDay} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="avg_latency_ms" stroke="#22c55e" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Inspect feedback sentiment</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip />
                <Pie data={feedbackBreakdown} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={2}>
                  {feedbackBreakdown.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent UI events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[420px] overflow-auto rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>File</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentEvents.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(row.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm font-medium">{row.event_type}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {(row.file_name || row.metadata?.file_name || "—") + (row.file_type || row.metadata?.file_type ? ` (${row.file_type || row.metadata?.file_type})` : "")}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!recentEvents.length && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                        No events in this range.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Inspect feedback</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[420px] overflow-auto rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Answer</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentInspectFeedback.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(row.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm font-medium">{row.main_answer || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {(row.follow_up || "").slice(0, 80) || "—"}
                        {row.free_text ? " • " + row.free_text.slice(0, 80) : ""}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!recentInspectFeedback.length && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                        No Inspect feedback in this range.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent contact messages</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-[420px] overflow-auto rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentContactFeedback.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(row.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm">{row.email || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.message}</TableCell>
                  </TableRow>
                ))}
                {!recentContactFeedback.length && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                      No messages in this range.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminInsightsDashboard;
