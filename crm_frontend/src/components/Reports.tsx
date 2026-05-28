import { useState } from "react";
import { format } from "date-fns";
import * as XLSX from 'xlsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  Building2, TrendingUp, Phone, DollarSign, Users, CalendarIcon,
  Download, RefreshCw, BarChart3, PieChart, LineChart,
  MapPin, Star, Clock, AlertTriangle
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";

interface ReportsProps {
  userName: string;
}

const Reports = ({ userName }: ReportsProps) => {
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());

  // Mock data for property reports
  const propertyData = [
    {
      name: "Postcard Goa",
      totalRevenue: "₹18,50,000",
      occupancy: "92%",
      avgRoomRate: "₹12,500",
      guestSatisfaction: 4.8,
      totalBookings: 148,
      cancellationRate: "8%",
      repeatGuests: "34%"
    },
    {
      name: "Postcard Udaipur",
      totalRevenue: "₹22,30,000",
      occupancy: "88%",
      avgRoomRate: "₹15,200",
      guestSatisfaction: 4.9,
      totalBookings: 127,
      cancellationRate: "5%",
      repeatGuests: "42%"
    },
    {
      name: "Postcard Munnar",
      totalRevenue: "₹16,80,000",
      occupancy: "85%",
      avgRoomRate: "₹11,800",
      guestSatisfaction: 4.7,
      totalBookings: 132,
      cancellationRate: "12%",
      repeatGuests: "28%"
    },
    {
      name: "Postcard Kerala",
      totalRevenue: "₹19,90,000",
      occupancy: "90%",
      avgRoomRate: "₹13,800",
      guestSatisfaction: 4.6,
      totalBookings: 141,
      cancellationRate: "7%",
      repeatGuests: "31%"
    }
  ];

  // Mock data for sales performance
  const salesData = [
    {
      agent: "Priya Sharma",
      totalLeads: 87,
      conversions: 24,
      conversionRate: "27.6%",
      revenue: "₹8,45,000",
      avgDealSize: "₹35,208",
      callsMade: 312,
      emailsSent: 156
    },
    {
      agent: "Rajesh Kumar",
      totalLeads: 92,
      conversions: 28,
      conversionRate: "30.4%",
      revenue: "₹9,80,000",
      avgDealSize: "₹35,000",
      callsMade: 298,
      emailsSent: 142
    },
    {
      agent: "Anita Patel",
      totalLeads: 78,
      conversions: 19,
      conversionRate: "24.4%",
      revenue: "₹6,95,000",
      avgDealSize: "₹36,579",
      callsMade: 267,
      emailsSent: 134
    }
  ];

  // Mock data for call center performance
  const callCenterData = [
    {
      agent: "Harleen Mehta",
      totalCalls: 245,
      avgCallDuration: "4:32",
      resolutionRate: "94%",
      customerSat: 4.7,
      ticketsCreated: 18,
      ticketsResolved: 23,
      responseTime: "1.2 min"
    },
    {
      agent: "Suresh Gupta",
      totalCalls: 198,
      avgCallDuration: "5:15",
      resolutionRate: "91%",
      customerSat: 4.5,
      ticketsCreated: 22,
      ticketsResolved: 19,
      responseTime: "1.8 min"
    },
    {
      agent: "Kavita Singh",
      totalCalls: 267,
      avgCallDuration: "3:58",
      resolutionRate: "96%",
      customerSat: 4.8,
      ticketsCreated: 15,
      ticketsResolved: 28,
      responseTime: "1.0 min"
    }
  ];

  // Mock projected revenue data
  const projectedData = [
    { month: "Jan 2024", actual: "₹67,50,000", projected: "₹70,00,000", variance: "-3.6%" },
    { month: "Feb 2024", actual: "₹72,30,000", projected: "₹68,50,000", variance: "+5.5%" },
    { month: "Mar 2024", actual: "₹78,90,000", projected: "₹75,00,000", variance: "+5.2%" },
    { month: "Apr 2024", projected: "₹82,50,000", forecast: "₹85,20,000" },
    { month: "May 2024", projected: "₹88,00,000", forecast: "₹91,50,000" },
    { month: "Jun 2024", projected: "₹92,30,000", forecast: "₹96,80,000" }
  ];

  // Excel download functions
  const downloadPropertyReport = (property: any) => {
    const workbook = XLSX.utils.book_new();

    const propertyDetails = [
      ['Property Name', property.name],
      ['Report Period', `${format(startDate, "PPP")} to ${format(endDate, "PPP")}`],
      [''],
      ['Performance Metrics', ''],
      ['Total Revenue', property.totalRevenue],
      ['Occupancy Rate', property.occupancy],
      ['Average Room Rate', property.avgRoomRate],
      ['Guest Satisfaction Rating', property.guestSatisfaction],
      ['Total Bookings', property.totalBookings],
      ['Cancellation Rate', property.cancellationRate],
      ['Repeat Guests Percentage', property.repeatGuests],
      [''],
      ['Additional Details', ''],
      ['Location Type', 'Premium Resort Property'],
      ['Room Categories', 'Deluxe, Premium, Suite'],
      ['Amenities', 'Pool, Spa, Restaurant, Conference Hall'],
      ['Staff Count', '45-60 employees'],
      ['Peak Season', 'October to March'],
      ['Off Season', 'April to September']
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(propertyDetails);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Property Report');

    XLSX.writeFile(workbook, `${property.name}_Detailed_Report_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const downloadSalesReport = (agent: any) => {
    const workbook = XLSX.utils.book_new();

    const salesDetails = [
      ['Sales Executive', agent.agent],
      ['Report Period', `${format(startDate, "PPP")} to ${format(endDate, "PPP")}`],
      [''],
      ['Performance Metrics', ''],
      ['Total Leads', agent.totalLeads],
      ['Conversions', agent.conversions],
      ['Conversion Rate', agent.conversionRate],
      ['Total Revenue', agent.revenue],
      ['Average Deal Size', agent.avgDealSize],
      ['Calls Made', agent.callsMade],
      ['Emails Sent', agent.emailsSent],
      [''],
      ['Lead Sources', ''],
      ['Website Inquiries', '35%'],
      ['Referrals', '25%'],
      ['Social Media', '20%'],
      ['Direct Walk-ins', '15%'],
      ['Partner Channels', '5%'],
      [''],
      ['Performance Trends', ''],
      ['Best Performing Month', 'March 2024'],
      ['Target Achievement', '108%'],
      ['Customer Satisfaction', '4.6/5']
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(salesDetails);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sales Report');

    XLSX.writeFile(workbook, `${agent.agent}_Sales_Report_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const downloadCallCenterReport = (agent: any) => {
    const workbook = XLSX.utils.book_new();

    const callCenterDetails = [
      ['Call Center Agent', agent.agent],
      ['Report Period', `${format(startDate, "PPP")} to ${format(endDate, "PPP")}`],
      [''],
      ['Performance Metrics', ''],
      ['Total Calls Handled', agent.totalCalls],
      ['Average Call Duration', agent.avgCallDuration],
      ['Resolution Rate', agent.resolutionRate],
      ['Customer Satisfaction', agent.customerSat],
      ['Tickets Created', agent.ticketsCreated],
      ['Tickets Resolved', agent.ticketsResolved],
      ['Average Response Time', agent.responseTime],
      [''],
      ['Call Categories', ''],
      ['Booking Inquiries', '40%'],
      ['Complaint Resolution', '25%'],
      ['Cancellation Requests', '15%'],
      ['General Information', '12%'],
      ['Technical Support', '8%'],
      [''],
      ['Quality Metrics', ''],
      ['First Call Resolution', '89%'],
      ['Escalation Rate', '6%'],
      ['Call Back Rate', '12%'],
      ['Training Hours Completed', '8 hours/month']
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(callCenterDetails);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Call Center Report');

    XLSX.writeFile(workbook, `${agent.agent}_CallCenter_Report_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  return (
    <div className="space-y-6 animate-panel-enter">
      <PageHeader
        title="Reports"
        subtitle="Property, sales, and call center analytics"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        }
      />
      <div className="rounded-md border border-border bg-primary-light/30 px-4 py-3 text-sm text-text-muted">
        Sample report data shown below. Live reporting API integration can replace these figures when connected.
      </div>

      {/* Date Range Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Report Period</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <div className="flex flex-col space-y-2">
              <label className="text-sm font-medium">Start Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[200px] justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex flex-col space-y-2">
              <label className="text-sm font-medium">End Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[200px] justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reports Tabs */}
      <Tabs defaultValue="property" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="property">Property Reports</TabsTrigger>
          <TabsTrigger value="sales">Sales Performance</TabsTrigger>
          <TabsTrigger value="callcenter">Call Center Performance</TabsTrigger>
        </TabsList>

        {/* Property Reports */}
        <TabsContent value="property" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Building2 className="h-5 w-5" />
                <span>Property Performance Overview</span>
              </CardTitle>
              <CardDescription>
                Performance metrics across all properties for the selected period
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {propertyData.map((property) => (
                  <Card key={property.name} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-xl font-semibold">{property.name}</h3>
                          <Badge variant="outline" className="mt-2">
                            <MapPin className="h-3 w-3 mr-1" />
                            Property
                          </Badge>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-green-600">{property.totalRevenue}</p>
                          <p className="text-sm text-muted-foreground">Total Revenue</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-3 bg-blue-50 rounded-lg">
                          <p className="text-sm text-muted-foreground">Occupancy Rate</p>
                          <p className="text-lg font-semibold text-blue-600">{property.occupancy}</p>
                        </div>
                        <div className="text-center p-3 bg-purple-50 rounded-lg">
                          <p className="text-sm text-muted-foreground">Avg Room Rate</p>
                          <p className="text-lg font-semibold text-purple-600">{property.avgRoomRate}</p>
                        </div>
                        <div className="text-center p-3 bg-orange-50 rounded-lg">
                          <p className="text-sm text-muted-foreground">Guest Rating</p>
                          <div className="flex items-center justify-center">
                            <Star className="h-4 w-4 text-orange-500 mr-1" />
                            <p className="text-lg font-semibold text-orange-600">{property.guestSatisfaction}</p>
                          </div>
                        </div>
                        <div className="text-center p-3 bg-green-50 rounded-lg">
                          <p className="text-sm text-muted-foreground">Total Bookings</p>
                          <p className="text-lg font-semibold text-green-600">{property.totalBookings}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4 mt-4">
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Cancellation Rate</p>
                          <p className="font-semibold">{property.cancellationRate}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Repeat Guests</p>
                          <p className="font-semibold">{property.repeatGuests}</p>
                        </div>
                        <div className="text-center">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => downloadPropertyReport(property)}
                          >
                            <BarChart3 className="h-4 w-4 mr-2" />
                            Detailed Report
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sales Performance */}
        <TabsContent value="sales" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5" />
                <span>Sales Team Performance</span>
              </CardTitle>
              <CardDescription>
                Individual and team sales metrics for the selected period
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {salesData.map((agent) => (
                  <Card key={agent.agent} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-xl font-semibold">{agent.agent}</h3>
                          <Badge variant="secondary" className="mt-2">
                            <Users className="h-3 w-3 mr-1" />
                            Sales Executive
                          </Badge>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-green-600">{agent.revenue}</p>
                          <p className="text-sm text-muted-foreground">Total Revenue</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-3 bg-blue-50 rounded-lg">
                          <p className="text-sm text-muted-foreground">Total Leads</p>
                          <p className="text-lg font-semibold text-blue-600">{agent.totalLeads}</p>
                        </div>
                        <div className="text-center p-3 bg-green-50 rounded-lg">
                          <p className="text-sm text-muted-foreground">Conversions</p>
                          <p className="text-lg font-semibold text-green-600">{agent.conversions}</p>
                        </div>
                        <div className="text-center p-3 bg-purple-50 rounded-lg">
                          <p className="text-sm text-muted-foreground">Conversion Rate</p>
                          <p className="text-lg font-semibold text-purple-600">{agent.conversionRate}</p>
                        </div>
                        <div className="text-center p-3 bg-orange-50 rounded-lg">
                          <p className="text-sm text-muted-foreground">Avg Deal Size</p>
                          <p className="text-lg font-semibold text-orange-600">{agent.avgDealSize}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4 mt-4">
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Calls Made</p>
                          <p className="font-semibold">{agent.callsMade}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Emails Sent</p>
                          <p className="font-semibold">{agent.emailsSent}</p>
                        </div>
                        <div className="text-center">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => downloadSalesReport(agent)}
                          >
                            <LineChart className="h-4 w-4 mr-2" />
                            View Details
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Call Center Performance */}
        <TabsContent value="callcenter" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Phone className="h-5 w-5" />
                <span>Call Center Performance</span>
              </CardTitle>
              <CardDescription>
                Call center agents' performance metrics for the selected period
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {callCenterData.map((agent) => (
                  <Card key={agent.agent} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-xl font-semibold">{agent.agent}</h3>
                          <Badge variant="secondary" className="mt-2">
                            <Phone className="h-3 w-3 mr-1" />
                            Call Center Agent
                          </Badge>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-blue-600">{agent.totalCalls}</p>
                          <p className="text-sm text-muted-foreground">Total Calls</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-3 bg-green-50 rounded-lg">
                          <p className="text-sm text-muted-foreground">Resolution Rate</p>
                          <p className="text-lg font-semibold text-green-600">{agent.resolutionRate}</p>
                        </div>
                        <div className="text-center p-3 bg-orange-50 rounded-lg">
                          <p className="text-sm text-muted-foreground">Customer Satisfaction</p>
                          <div className="flex items-center justify-center">
                            <Star className="h-4 w-4 text-orange-500 mr-1" />
                            <p className="text-lg font-semibold text-orange-600">{agent.customerSat}</p>
                          </div>
                        </div>
                        <div className="text-center p-3 bg-blue-50 rounded-lg">
                          <p className="text-sm text-muted-foreground">Avg Call Duration</p>
                          <p className="text-lg font-semibold text-blue-600">{agent.avgCallDuration}</p>
                        </div>
                        <div className="text-center p-3 bg-purple-50 rounded-lg">
                          <p className="text-sm text-muted-foreground">Response Time</p>
                          <p className="text-lg font-semibold text-purple-600">{agent.responseTime}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4 mt-4">
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Tickets Created</p>
                          <p className="font-semibold">{agent.ticketsCreated}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Tickets Resolved</p>
                          <p className="font-semibold">{agent.ticketsResolved}</p>
                        </div>
                        <div className="text-center">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => downloadCallCenterReport(agent)}
                          >
                            <PieChart className="h-4 w-4 mr-2" />
                            Performance Chart
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Reports;