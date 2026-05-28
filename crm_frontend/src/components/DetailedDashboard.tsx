import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, LineChart, Line, ResponsiveContainer } from "recharts";
import * as XLSX from 'xlsx';
import {
  Users, TrendingUp, Target, BarChart3, Download,
  DollarSign, Bed, MapPin, Calendar, Info
} from "lucide-react";

const DetailedDashboard = () => {
  const [selectedPeriod, setSelectedPeriod] = useState("current-month");
  const [selectedProperty, setSelectedProperty] = useState<string | null>(null);
  const stats = [
    {
      title: "Total Guests",
      value: "3,247",
      icon: Users,
      change: "+15%",
      color: "text-blue-600"
    },
    {
      title: "Total Leads",
      value: "456",
      icon: Target,
      change: "+12%",
      color: "text-green-600"
    },
    {
      title: "Revenue This Month",
      value: "₹2.8Cr",
      icon: TrendingUp,
      change: "+28%",
      color: "text-purple-600"
    },
    {
      title: "Room Nights Sold",
      value: "1,845",
      icon: Bed,
      change: "+18%",
      color: "text-orange-600"
    }
  ];

  const propertyPerformance = [
    {
      name: "Postcard Goa",
      leads: 156,
      revenue: 8520000,
      conversion: 32,
      roomNights: 487,
      guests: 892,
      occupancy: 89,
      avgRate: 17500,
      forecast: 524
    },
    {
      name: "Postcard Kerala",
      leads: 134,
      revenue: 6780000,
      conversion: 28,
      roomNights: 398,
      guests: 756,
      occupancy: 76,
      avgRate: 17000,
      forecast: 445
    },
    {
      name: "Postcard Rajasthan",
      leads: 142,
      revenue: 7350000,
      conversion: 35,
      roomNights: 425,
      guests: 823,
      occupancy: 82,
      avgRate: 17300,
      forecast: 468
    },
    {
      name: "Postcard Munnar",
      leads: 98,
      revenue: 4890000,
      conversion: 24,
      roomNights: 298,
      guests: 576,
      occupancy: 71,
      avgRate: 16400,
      forecast: 325
    }
  ];

  const salesTeamPerformance = [
    {
      name: "Rahul Sharma",
      leads: 87,
      conversions: 29,
      roomNights: 245,
      revenue: 4200000,
      conversionRate: 33.3
    },
    {
      name: "Priya Patel",
      leads: 92,
      conversions: 31,
      roomNights: 268,
      revenue: 4650000,
      conversionRate: 33.7
    },
    {
      name: "Amit Singh",
      leads: 78,
      conversions: 24,
      roomNights: 198,
      revenue: 3400000,
      conversionRate: 30.8
    },
    {
      name: "Sneha Reddy",
      leads: 85,
      conversions: 28,
      roomNights: 235,
      revenue: 4100000,
      conversionRate: 32.9
    },
    {
      name: "Vikram Joshi",
      leads: 114,
      conversions: 38,
      roomNights: 312,
      revenue: 5450000,
      conversionRate: 33.3
    }
  ];

  const monthlyTrend = [
    { month: 'Jan', revenue: 18500000, leads: 320, roomNights: 1245 },
    { month: 'Feb', revenue: 22100000, leads: 385, roomNights: 1456 },
    { month: 'Mar', revenue: 26800000, leads: 456, roomNights: 1789 },
    { month: 'Apr', revenue: 28200000, leads: 498, roomNights: 1845 }
  ];

  // SLA Performance Data for Property Managers
  const slaPerformance = [
    {
      property: "Postcard Goa",
      manager: "Rajesh Kumari",
      totalTickets: 45,
      withinSLA: 42,
      breachedSLA: 3,
      slaPercentage: 93.3,
      avgResolutionTime: "2.4 hours",
      status: "Excellent"
    },
    {
      property: "Postcard Kerala",
      manager: "Priya Nair",
      totalTickets: 38,
      withinSLA: 35,
      breachedSLA: 3,
      slaPercentage: 92.1,
      avgResolutionTime: "2.8 hours",
      status: "Excellent"
    },
    {
      property: "Postcard Rajasthan",
      manager: "Vikram Singh",
      totalTickets: 52,
      withinSLA: 46,
      breachedSLA: 6,
      slaPercentage: 88.5,
      avgResolutionTime: "3.2 hours",
      status: "Good"
    },
    {
      property: "Postcard Munnar",
      manager: "Meera Gupta",
      totalTickets: 29,
      withinSLA: 24,
      breachedSLA: 5,
      slaPercentage: 82.8,
      avgResolutionTime: "4.1 hours",
      status: "Needs Improvement"
    }
  ];

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  // Peak dates and pricing data for popup
  const propertyPeakData = {
    "Postcard Goa": {
      peakDates: [
        { date: "2024-05-15", checkIns: 45, avgPrice: 18500 },
        { date: "2024-05-22", checkIns: 52, avgPrice: 19200 },
        { date: "2024-05-29", checkIns: 48, avgPrice: 18800 },
      ],
      totalAvgPrice: 18833
    },
    "Postcard Kerala": {
      peakDates: [
        { date: "2024-05-12", checkIns: 38, avgPrice: 17800 },
        { date: "2024-05-19", checkIns: 41, avgPrice: 18200 },
        { date: "2024-05-26", checkIns: 35, avgPrice: 17500 },
      ],
      totalAvgPrice: 17833
    },
    "Postcard Rajasthan": {
      peakDates: [
        { date: "2024-05-10", checkIns: 42, avgPrice: 18100 },
        { date: "2024-05-17", checkIns: 46, avgPrice: 18500 },
        { date: "2024-05-24", checkIns: 39, avgPrice: 17900 },
      ],
      totalAvgPrice: 18167
    },
    "Postcard Munnar": {
      peakDates: [
        { date: "2024-05-14", checkIns: 28, avgPrice: 17200 },
        { date: "2024-05-21", checkIns: 32, avgPrice: 17600 },
        { date: "2024-05-28", checkIns: 25, avgPrice: 16800 },
      ],
      totalAvgPrice: 17200
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getSLAStatusColor = (status: string) => {
    switch (status) {
      case 'Excellent': return 'bg-green-100 text-green-800';
      case 'Good': return 'bg-blue-100 text-blue-800';
      case 'Needs Improvement': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const downloadExcel = (reportType: string) => {
    let data: any[] = [];
    let filename = '';

    switch (reportType) {
      case 'daily':
        data = propertyPerformance.map(p => ({
          Property: p.name,
          Leads: p.leads,
          Conversions: p.conversion,
          'Room Nights': p.roomNights,
          Revenue: p.revenue,
          'Occupancy %': p.occupancy,
          'Avg Rate': p.avgRate,
          'Tentative/Confirmed Business Next Month': p.forecast
        }));
        filename = 'Daily_Performance_Report.xlsx';
        break;
      case 'revenue':
        data = monthlyTrend.map(m => ({
          Month: m.month,
          Revenue: m.revenue,
          Leads: m.leads,
          'Room Nights': m.roomNights
        }));
        filename = 'Revenue_Report.xlsx';
        break;
      case 'team':
        data = salesTeamPerformance.map(s => ({
          'Sales Person': s.name,
          Leads: s.leads,
          Conversions: s.conversions,
          'Room Nights': s.roomNights,
          Revenue: s.revenue,
          'Conversion Rate %': s.conversionRate
        }));
        filename = 'Sales_Team_Performance.xlsx';
        break;
    }

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
    XLSX.writeFile(workbook, filename);
  };

  return (
    <div className="space-y-6">
      {/* Period Filter Buttons */}
      <Card>
        <CardHeader>
          <CardTitle>Data Period</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button
              variant={selectedPeriod === "current-month" ? "default" : "outline"}
              onClick={() => setSelectedPeriod("current-month")}
            >
              Current Month
            </Button>
            <Button
              variant={selectedPeriod === "quarter" ? "default" : "outline"}
              onClick={() => setSelectedPeriod("quarter")}
            >
              Quarter
            </Button>
            <Button
              variant={selectedPeriod === "ytd" ? "default" : "outline"}
              onClick={() => setSelectedPeriod("ytd")}
            >
              YTD
            </Button>
          </div>
        </CardContent>
      </Card>
      {/* Enhanced Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <Card key={index} className="bg-white shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  <p className={`text-sm ${stat.change.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                    {stat.change} from last month
                  </p>
                </div>
                <stat.icon className={`h-8 w-8 ${stat.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="properties" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="properties">Property Performance</TabsTrigger>
          <TabsTrigger value="sales-team">Sales Team</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="properties" className="space-y-6">
          {/* Property Performance Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {propertyPerformance.map((property, index) => (
              <Card key={index} className="bg-white shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{property.name}</span>
                    <Badge className="bg-blue-100 text-blue-800">
                      {property.occupancy}% occupancy
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-gray-600">Leads</p>
                      <p className="text-xl font-bold text-blue-600">{property.leads}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Conversions</p>
                      <p className="text-xl font-bold text-green-600">{property.conversion}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Room Nights</p>
                      <p className="text-xl font-bold text-purple-600">{property.roomNights}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Guests</p>
                      <p className="text-xl font-bold text-orange-600">{property.guests}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Revenue</p>
                      <p className="text-lg font-bold text-green-600">{formatCurrency(property.revenue)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Tentative/Confirmed Business Next Month</p>
                      <p className="text-lg font-bold text-teal-600">{property.forecast} nights</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Property Performance Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Property Revenue Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={{}} className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={propertyPerformance}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="revenue" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sales-team" className="space-y-6">
          {/* Sales Team Performance Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {salesTeamPerformance.map((member, index) => (
              <Card key={index} className="bg-white shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{member.name}</span>
                    <Badge className="bg-green-100 text-green-800">
                      {member.conversionRate}%
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-sm text-gray-600">Leads</p>
                      <p className="text-lg font-bold text-blue-600">{member.leads}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Conversions</p>
                      <p className="text-lg font-bold text-green-600">{member.conversions}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Room Nights</p>
                      <p className="text-lg font-bold text-purple-600">{member.roomNights}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Revenue</p>
                      <p className="text-lg font-bold text-green-600">{formatCurrency(member.revenue)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Sales Team Performance Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Sales Team Revenue Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={{}} className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={salesTeamPerformance}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="revenue" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          {/* SLA Performance Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Ticketing SLA Performance - Property Wise
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {slaPerformance.map((property, index) => (
                  <Card key={index} className="border-l-4 border-l-blue-500">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-semibold text-lg">{property.property}</h3>
                          <p className="text-sm text-gray-600">Manager: {property.manager}</p>
                        </div>
                        <Badge className={getSLAStatusColor(property.status)}>
                          {property.status}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div>
                          <p className="text-sm text-gray-600">Total Tickets</p>
                          <p className="text-xl font-bold text-blue-600">{property.totalTickets}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">SLA Compliance</p>
                          <p className="text-xl font-bold text-green-600">{property.slaPercentage}%</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="text-sm text-gray-600">Within SLA</p>
                          <p className="text-lg font-semibold text-green-600">{property.withinSLA}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Breached SLA</p>
                          <p className="text-lg font-semibold text-red-600">{property.breachedSLA}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Avg Resolution Time</p>
                        <p className="text-lg font-semibold text-purple-600">{property.avgResolutionTime}</p>
                      </div>
                      <div className="mt-3">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${property.slaPercentage >= 90 ? 'bg-green-500' : property.slaPercentage >= 80 ? 'bg-blue-500' : 'bg-red-500'}`}
                            style={{ width: `${property.slaPercentage}%` }}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Monthly Trend Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Monthly Performance Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={{}} className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} />
                    <Line type="monotone" dataKey="leads" stroke="#10b981" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Property Distribution Pie Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Guest Distribution by Property</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={{}} className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={propertyPerformance}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, guests }) => `${name}: ${guests}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="guests"
                    >
                      {propertyPerformance.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Next Month Forecast */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Next Month Check-in Forecast
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {propertyPerformance.map((property, index) => (
                  <Dialog key={index}>
                    <DialogTrigger asChild>
                      <div className="text-center p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                        <p className="text-sm font-medium text-gray-600">{property.name}</p>
                        <p className="text-2xl font-bold text-blue-600">{property.forecast}</p>
                        <p className="text-xs text-gray-500">room nights</p>
                        <Info className="h-4 w-4 mx-auto mt-1 text-gray-400" />
                      </div>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>{property.name} - Peak Dates & Pricing</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="bg-blue-50 p-3 rounded-lg">
                          <h4 className="font-semibold text-blue-900 mb-2">Average Pricing Next Month</h4>
                          <p className="text-xl font-bold text-blue-600">
                            ₹{propertyPeakData[property.name as keyof typeof propertyPeakData]?.totalAvgPrice?.toLocaleString() || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <h4 className="font-semibold mb-3">Peak Check-in Dates</h4>
                          <div className="space-y-2">
                            {propertyPeakData[property.name as keyof typeof propertyPeakData]?.peakDates.map((peak, idx) => (
                              <div key={idx} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                                <div>
                                  <p className="font-medium">{peak.date}</p>
                                  <p className="text-sm text-gray-600">{peak.checkIns} check-ins</p>
                                </div>
                                <div className="text-right">
                                  <p className="font-semibold text-green-600">₹{peak.avgPrice.toLocaleString()}</p>
                                  <p className="text-xs text-gray-500">avg rate</p>
                                </div>
                              </div>
                            )) || <p className="text-gray-500">No peak data available</p>}
                          </div>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                ))}
              </div>
              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-blue-900">Total Forecast</span>
                  <span className="text-xl font-bold text-blue-600">
                    {propertyPerformance.reduce((sum, p) => sum + p.forecast, 0)} room nights
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Download Reports</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Button
                  onClick={() => downloadExcel('daily')}
                  className="h-20 flex flex-col items-center justify-center space-y-2 bg-blue-600 hover:bg-blue-700"
                >
                  <Download className="h-6 w-6" />
                  <span>Daily Performance</span>
                </Button>
                <Button
                  onClick={() => downloadExcel('revenue')}
                  className="h-20 flex flex-col items-center justify-center space-y-2 bg-green-600 hover:bg-green-700"
                >
                  <Download className="h-6 w-6" />
                  <span>Revenue Report</span>
                </Button>
                <Button
                  onClick={() => downloadExcel('team')}
                  className="h-20 flex flex-col items-center justify-center space-y-2 bg-purple-600 hover:bg-purple-700"
                >
                  <Download className="h-6 w-6" />
                  <span>Sales Team Report</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DetailedDashboard;