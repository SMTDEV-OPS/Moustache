import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Phone,
  PhoneCall,
  Clock,
  CheckCircle,
  Calendar,
  X,
  TrendingUp,
  Users,
  Ticket,
  Download,
  MapPin,
  Timer,
  Target
} from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Area, AreaChart } from "recharts";
import * as XLSX from 'xlsx';

// Mock data
const callMetrics = {
  totalCalls: 1247,
  callsAnswered: 1189,
  fcr: 78.5,
  avgAHT: "4:32",
  reservations: 156,
  cancellations: 23
};

const agentData = [
  { name: "Harleen M.", calls: 142, fcr: 85, aht: "4:12", reservations: 18, cancellations: 2, score: 92 },
  { name: "Rajesh K.", calls: 138, fcr: 82, aht: "4:45", reservations: 15, cancellations: 3, score: 89 },
  { name: "Priya S.", calls: 134, fcr: 79, aht: "4:28", reservations: 17, cancellations: 1, score: 91 },
  { name: "Amit T.", calls: 129, fcr: 76, aht: "4:58", reservations: 14, cancellations: 4, score: 86 },
  { name: "Neha R.", calls: 125, fcr: 81, aht: "4:35", reservations: 16, cancellations: 2, score: 88 }
];

const propertyCallData = [
  { property: "Postcard Goa", calls: 423, tickets: 67, avgTAT: "2.4 hrs", fcr: 82 },
  { property: "Postcard Udaipur", calls: 389, tickets: 52, avgTAT: "1.8 hrs", fcr: 79 },
  { property: "Postcard Munnar", calls: 377, tickets: 41, avgTAT: "3.1 hrs", fcr: 75 }
];

const ticketAnalysis = [
  { type: "Booking Issues", count: 45, avgTAT: "2.1 hrs", status: "Normal" },
  { type: "Payment Problems", count: 32, avgTAT: "1.5 hrs", status: "Good" },
  { type: "Cancellations", count: 28, avgTAT: "3.2 hrs", status: "Concern" },
  { type: "Modifications", count: 24, avgTAT: "2.8 hrs", status: "Normal" },
  { type: "Complaints", count: 18, avgTAT: "4.5 hrs", status: "Poor" }
];

const hourlyCallData = [
  { hour: "09:00", calls: 45, reservations: 6 },
  { hour: "10:00", calls: 62, reservations: 8 },
  { hour: "11:00", calls: 78, reservations: 12 },
  { hour: "12:00", calls: 85, reservations: 15 },
  { hour: "13:00", calls: 72, reservations: 9 },
  { hour: "14:00", calls: 68, reservations: 11 },
  { hour: "15:00", calls: 91, reservations: 18 },
  { hour: "16:00", calls: 95, reservations: 22 },
  { hour: "17:00", calls: 87, reservations: 16 },
  { hour: "18:00", calls: 74, reservations: 13 }
];

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', '#8884d8', '#82ca9d'];

interface CCManagerDashboardProps {
  userName: string;
}

const CCManagerDashboard = ({ userName }: CCManagerDashboardProps) => {
  const [selectedPeriod, setSelectedPeriod] = useState("today");

  const downloadReport = (reportType: string) => {
    let data: any[] = [];
    let filename = "";

    switch (reportType) {
      case 'agent-performance':
        data = agentData.map(agent => ({
          Agent: agent.name,
          'Total Calls': agent.calls,
          'FCR %': agent.fcr,
          'Avg AHT': agent.aht,
          Reservations: agent.reservations,
          Cancellations: agent.cancellations,
          'Performance Score': agent.score
        }));
        filename = "Agent_Performance_Report.xlsx";
        break;
      case 'property-analysis':
        data = propertyCallData.map(prop => ({
          Property: prop.property,
          'Total Calls': prop.calls,
          'Active Tickets': prop.tickets,
          'Avg TAT': prop.avgTAT,
          'FCR %': prop.fcr
        }));
        filename = "Property_Analysis_Report.xlsx";
        break;
      case 'ticket-analysis':
        data = ticketAnalysis.map(ticket => ({
          'Ticket Type': ticket.type,
          Count: ticket.count,
          'Avg TAT': ticket.avgTAT,
          Status: ticket.status
        }));
        filename = "Ticket_Analysis_Report.xlsx";
        break;
      case 'daily-summary':
        data = [{
          Date: new Date().toDateString(),
          'Total Calls': callMetrics.totalCalls,
          'Calls Answered': callMetrics.callsAnswered,
          'FCR %': callMetrics.fcr,
          'Avg AHT': callMetrics.avgAHT,
          Reservations: callMetrics.reservations,
          Cancellations: callMetrics.cancellations,
          'Answer Rate %': ((callMetrics.callsAnswered / callMetrics.totalCalls) * 100).toFixed(1)
        }];
        filename = "Daily_Summary_Report.xlsx";
        break;
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, filename);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Good': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'Normal': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'Concern': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'Poor': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Call Center Manager Dashboard</h1>
          <p className="text-muted-foreground">Welcome back, {userName}</p>
        </div>
        <div className="flex gap-2 items-center">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Calls</p>
                <p className="text-2xl font-bold">{callMetrics.totalCalls}</p>
              </div>
              <Phone className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Calls Answered</p>
                <p className="text-2xl font-bold">{callMetrics.callsAnswered}</p>
                <p className="text-xs text-green-600">
                  {((callMetrics.callsAnswered / callMetrics.totalCalls) * 100).toFixed(1)}% Rate
                </p>
              </div>
              <PhoneCall className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">FCR Rate</p>
                <p className="text-2xl font-bold">{callMetrics.fcr}%</p>
              </div>
              <CheckCircle className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg AHT</p>
                <p className="text-2xl font-bold">{callMetrics.avgAHT}</p>
              </div>
              <Clock className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Reservations</p>
                <p className="text-2xl font-bold text-green-600">{callMetrics.reservations}</p>
              </div>
              <Calendar className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Cancellations</p>
                <p className="text-2xl font-bold text-red-600">{callMetrics.cancellations}</p>
              </div>
              <X className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="agents">Agent Performance</TabsTrigger>
          <TabsTrigger value="properties">Property Analysis</TabsTrigger>
          <TabsTrigger value="tickets">Ticket Analysis</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Hourly Call Volume */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Hourly Call Volume & Conversions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    calls: { label: "Calls", color: "hsl(var(--primary))" },
                    reservations: { label: "Reservations", color: "hsl(var(--secondary))" }
                  }}
                  className="h-[300px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={hourlyCallData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="hour" />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Area type="monotone" dataKey="calls" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                      <Line type="monotone" dataKey="reservations" stroke="hsl(var(--secondary))" strokeWidth={3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Property Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Call Distribution by Property
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    calls: { label: "Calls", color: "hsl(var(--primary))" }
                  }}
                  className="h-[300px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={propertyCallData}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        fill="hsl(var(--primary))"
                        dataKey="calls"
                        label={({ property, calls }) => `${property}: ${calls}`}
                      >
                        {propertyCallData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent />} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="agents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Agent Performance Analysis
                </div>
                <Button onClick={() => downloadReport('agent-performance')} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {agentData.map((agent, index) => (
                  <Card key={index} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                          <span className="font-semibold text-primary">{agent.name.split(' ')[0][0]}</span>
                        </div>
                        <div>
                          <h3 className="font-semibold">{agent.name}</h3>
                          <p className="text-sm text-muted-foreground">Performance Score: {agent.score}%</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-5 gap-6 text-center">
                        <div>
                          <p className="text-sm text-muted-foreground">Calls</p>
                          <p className="font-semibold">{agent.calls}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">FCR</p>
                          <p className="font-semibold">{agent.fcr}%</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">AHT</p>
                          <p className="font-semibold">{agent.aht}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Reservations</p>
                          <p className="font-semibold text-green-600">{agent.reservations}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Cancellations</p>
                          <p className="font-semibold text-red-600">{agent.cancellations}</p>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="properties" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Property-wise Call Center Analysis
                </div>
                <Button onClick={() => downloadReport('property-analysis')} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {propertyCallData.map((property, index) => (
                  <Card key={index} className="p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-lg">{property.property}</h3>
                      <Badge variant={property.fcr > 80 ? "default" : property.fcr > 75 ? "secondary" : "destructive"}>
                        FCR: {property.fcr}%
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-4 mt-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-primary">{property.calls}</p>
                        <p className="text-sm text-muted-foreground">Total Calls</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-orange-600">{property.tickets}</p>
                        <p className="text-sm text-muted-foreground">Active Tickets</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-blue-600">{property.avgTAT}</p>
                        <p className="text-sm text-muted-foreground">Avg TAT</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tickets" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Ticket className="h-5 w-5" />
                  Ticket Analysis & TAT Performance
                </div>
                <Button onClick={() => downloadReport('ticket-analysis')} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {ticketAnalysis.map((ticket, index) => (
                  <Card key={index} className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">{ticket.type}</h3>
                        <p className="text-sm text-muted-foreground">Average TAT: {ticket.avgTAT}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-2xl font-bold">{ticket.count}</p>
                          <p className="text-sm text-muted-foreground">Total Tickets</p>
                        </div>
                        <Badge className={getStatusColor(ticket.status)}>
                          {ticket.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-2">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${ticket.status === 'Good' ? 'bg-green-600' :
                              ticket.status === 'Normal' ? 'bg-blue-600' :
                                ticket.status === 'Concern' ? 'bg-yellow-600' : 'bg-red-600'
                            }`}
                          style={{ width: `${Math.min((ticket.count / 50) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Call Center Reports & Analytics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <Target className="h-8 w-8 text-primary" />
                    <div>
                      <h3 className="font-semibold">Agent Performance Report</h3>
                      <p className="text-sm text-muted-foreground">Detailed agent metrics and KPIs</p>
                    </div>
                  </div>
                  <Button onClick={() => downloadReport('agent-performance')} className="w-full">
                    <Download className="h-4 w-4 mr-2" />
                    Download Agent Report
                  </Button>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <MapPin className="h-8 w-8 text-secondary" />
                    <div>
                      <h3 className="font-semibold">Property Analysis Report</h3>
                      <p className="text-sm text-muted-foreground">Property-wise call center metrics</p>
                    </div>
                  </div>
                  <Button onClick={() => downloadReport('property-analysis')} className="w-full">
                    <Download className="h-4 w-4 mr-2" />
                    Download Property Report
                  </Button>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <Ticket className="h-8 w-8 text-accent" />
                    <div>
                      <h3 className="font-semibold">Ticket Analysis Report</h3>
                      <p className="text-sm text-muted-foreground">TAT analysis and ticket metrics</p>
                    </div>
                  </div>
                  <Button onClick={() => downloadReport('ticket-analysis')} className="w-full">
                    <Download className="h-4 w-4 mr-2" />
                    Download Ticket Report
                  </Button>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <Timer className="h-8 w-8 text-primary" />
                    <div>
                      <h3 className="font-semibold">Daily Summary Report</h3>
                      <p className="text-sm text-muted-foreground">Complete daily operations summary</p>
                    </div>
                  </div>
                  <Button onClick={() => downloadReport('daily-summary')} className="w-full">
                    <Download className="h-4 w-4 mr-2" />
                    Download Daily Summary
                  </Button>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CCManagerDashboard;