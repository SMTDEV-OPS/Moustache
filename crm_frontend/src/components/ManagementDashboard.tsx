import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, TrendingUp, Users, Calendar, DollarSign, Target, BarChart3, Clock } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ManagementDashboardProps {
  userName: string;
}

const ManagementDashboard: React.FC<ManagementDashboardProps> = ({ userName }) => {
  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];

  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedProperty, setSelectedProperty] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedTeamMember, setSelectedTeamMember] = useState('');

  // Sample data for the table
  const leadsData = [
    {
      category: 'Leads received',
      status: 'Total',
      count: 560,
      roomNights: 3000,
      arr: 'ARR',
      roomRevenue: 'Room Revenue',
      totalRevenue: 'Total Revenue',
      isHeader: true,
      variant: 'primary'
    },
    {
      category: 'Current month',
      status: 'Total',
      count: 250,
      roomNights: 2000,
      arr: 'ARR',
      roomRevenue: 'Room Revenue',
      totalRevenue: 'Total Revenue',
      isHeader: true,
      variant: 'secondary'
    },
    {
      category: '',
      status: 'Tentative',
      count: 120,
      roomNights: 800,
      arr: '₹15,000',
      roomRevenue: '₹12,00,000',
      totalRevenue: '₹18,00,000',
      isHeader: false,
      variant: 'tentative'
    },
    {
      category: '',
      status: 'Confirmed',
      count: 85,
      roomNights: 900,
      arr: '₹18,000',
      roomRevenue: '₹16,20,000',
      totalRevenue: '₹24,30,000',
      isHeader: false,
      variant: 'confirmed'
    },
    {
      category: '',
      status: 'Cancelled',
      count: 45,
      roomNights: 300,
      arr: '₹16,000',
      roomRevenue: '₹4,80,000',
      totalRevenue: '₹7,20,000',
      isHeader: false,
      variant: 'cancelled'
    },
    {
      category: 'Future months',
      status: 'Total',
      count: 310,
      roomNights: 1000,
      arr: 'ARR',
      roomRevenue: 'Room Revenue',
      totalRevenue: 'Total Revenue',
      isHeader: true,
      variant: 'accent'
    },
    {
      category: '',
      status: 'Tentative',
      count: 180,
      roomNights: 600,
      arr: '₹20,000',
      roomRevenue: '₹12,00,000',
      totalRevenue: '₹18,00,000',
      isHeader: false,
      variant: 'tentative'
    },
    {
      category: '',
      status: 'Confirmed',
      count: 95,
      roomNights: 300,
      arr: '₹22,000',
      roomRevenue: '₹6,60,000',
      totalRevenue: '₹9,90,000',
      isHeader: false,
      variant: 'confirmed'
    },
    {
      category: '',
      status: 'Cancelled',
      count: 35,
      roomNights: 100,
      arr: '₹18,000',
      roomRevenue: '₹1,80,000',
      totalRevenue: '₹2,70,000',
      isHeader: false,
      variant: 'cancelled'
    }
  ];

  // Sales Cycle data
  const salesCycleData = [
    {
      team: 'Sales',
      leads: 450,
      converted: 72,
      conversionRate: '16.0%',
      salesCycle: 12,
      arr: '₹18,500',
      revenue: '₹1,33,20,000',
      roomNights: 720,
      isHeader: false
    },
    {
      team: 'Call Center',
      leads: 680,
      converted: 95,
      conversionRate: '14.0%',
      salesCycle: 8,
      arr: '₹16,200',
      revenue: '₹1,53,90,000',
      roomNights: 950,
      isHeader: false
    },
    {
      team: 'Hotel Team',
      leads: 320,
      converted: 64,
      conversionRate: '20.0%',
      salesCycle: 15,
      arr: '₹22,800',
      revenue: '₹1,45,92,000',
      roomNights: 640,
      isHeader: false
    }
  ];

  // Target vs Achieved data
  const targetAchievedData = [
    {
      category: 'Sales',
      type: 'team',
      target: 850,
      delivered: 720,
      roomNights: 3200,
      arr: '₹18,500',
      salesCycleDays: 14,
      isHeader: true
    },
    {
      category: 'Sales Person 1',
      type: 'individual',
      target: 170,
      delivered: 156,
      roomNights: 680,
      arr: '₹19,200',
      salesCycleDays: 12,
      isHeader: false
    },
    {
      category: 'Sales Person 2',
      type: 'individual',
      target: 170,
      delivered: 142,
      roomNights: 625,
      arr: '₹17,800',
      salesCycleDays: 18,
      isHeader: false
    },
    {
      category: 'Sales Person 3',
      type: 'individual',
      target: 170,
      delivered: 168,
      roomNights: 735,
      arr: '₹18,900',
      salesCycleDays: 10,
      isHeader: false
    },
    {
      category: 'Sales Person 4',
      type: 'individual',
      target: 170,
      delivered: 145,
      roomNights: 638,
      arr: '₹17,600',
      salesCycleDays: 15,
      isHeader: false
    },
    {
      category: 'Sales Person 5',
      type: 'individual',
      target: 170,
      delivered: 109,
      roomNights: 522,
      arr: '₹16,800',
      salesCycleDays: 22,
      isHeader: false
    },
    {
      category: 'CC Team',
      type: 'team',
      target: 720,
      delivered: 695,
      roomNights: 2800,
      arr: '₹16,200',
      salesCycleDays: 9,
      isHeader: true
    },
    {
      category: 'Agent 1',
      type: 'individual',
      target: 180,
      delivered: 175,
      roomNights: 720,
      arr: '₹16,800',
      salesCycleDays: 8,
      isHeader: false
    },
    {
      category: 'Agent 2',
      type: 'individual',
      target: 180,
      delivered: 168,
      roomNights: 685,
      arr: '₹15,900',
      salesCycleDays: 7,
      isHeader: false
    },
    {
      category: 'Agent 3',
      type: 'individual',
      target: 180,
      delivered: 172,
      roomNights: 695,
      arr: '₹16,100',
      salesCycleDays: 9,
      isHeader: false
    },
    {
      category: 'Agent 4',
      type: 'individual',
      target: 180,
      delivered: 180,
      roomNights: 700,
      arr: '₹16,500',
      salesCycleDays: 6,
      isHeader: false
    },
    {
      category: 'Hotel Team',
      type: 'team',
      target: 480,
      delivered: 512,
      roomNights: 1950,
      arr: '₹22,800',
      salesCycleDays: 16,
      isHeader: true
    },
    {
      category: 'Property 1',
      type: 'individual',
      target: 120,
      delivered: 128,
      roomNights: 485,
      arr: '₹23,200',
      salesCycleDays: 14,
      isHeader: false
    },
    {
      category: 'Property 2',
      type: 'individual',
      target: 120,
      delivered: 132,
      roomNights: 520,
      arr: '₹22,800',
      salesCycleDays: 16,
      isHeader: false
    },
    {
      category: 'Property 3',
      type: 'individual',
      target: 120,
      delivered: 125,
      roomNights: 495,
      arr: '₹22,600',
      salesCycleDays: 18,
      isHeader: false
    },
    {
      category: 'Property 4',
      type: 'individual',
      target: 120,
      delivered: 127,
      roomNights: 450,
      arr: '₹23,000',
      salesCycleDays: 15,
      isHeader: false
    }
  ];

  // Pipeline data by stay date
  const pipelineData = [
    {
      month: 'Open leads Current month',
      leads: 350,
      roomNights: 3000,
      arr: '₹20,000',
      roomRevenue: '₹60,00,000',
      totalRevenue: '₹90,00,000',
      status: 'current',
      isHeader: true
    },
    {
      month: 'Tentative',
      leads: 200,
      roomNights: 1800,
      arr: '₹19,500',
      roomRevenue: '₹35,10,000',
      totalRevenue: '₹52,65,000',
      status: 'tentative',
      isHeader: false
    },
    {
      month: 'Confirmed',
      leads: 150,
      roomNights: 1200,
      arr: '₹20,500',
      roomRevenue: '₹24,60,000',
      totalRevenue: '₹36,90,000',
      status: 'confirmed',
      isHeader: false
    },
    {
      month: 'Oct',
      leads: 320,
      roomNights: 2000,
      arr: '₹18,500',
      roomRevenue: '₹37,00,000',
      totalRevenue: '₹55,50,000',
      status: 'future',
      isHeader: true
    },
    {
      month: 'Tentative',
      leads: 180,
      roomNights: 1100,
      arr: '₹18,200',
      roomRevenue: '₹20,02,000',
      totalRevenue: '₹30,03,000',
      status: 'tentative',
      isHeader: false
    },
    {
      month: 'Confirmed',
      leads: 140,
      roomNights: 900,
      arr: '₹18,800',
      roomRevenue: '₹16,92,000',
      totalRevenue: '₹25,38,000',
      status: 'confirmed',
      isHeader: false
    },
    {
      month: 'Nov',
      leads: 220,
      roomNights: 1000,
      arr: '₹19,000',
      roomRevenue: '₹19,00,000',
      totalRevenue: '₹28,50,000',
      status: 'future',
      isHeader: true
    },
    {
      month: 'Tentative',
      leads: 125,
      roomNights: 580,
      arr: '₹18,900',
      roomRevenue: '₹10,96,200',
      totalRevenue: '₹16,44,300',
      status: 'tentative',
      isHeader: false
    },
    {
      month: 'Confirmed',
      leads: 95,
      roomNights: 420,
      arr: '₹19,100',
      roomRevenue: '₹8,02,200',
      totalRevenue: '₹12,03,300',
      status: 'confirmed',
      isHeader: false
    },
    {
      month: 'Dec',
      leads: 250,
      roomNights: 1000,
      arr: '₹18,200',
      roomRevenue: '₹18,20,000',
      totalRevenue: '₹27,30,000',
      status: 'future',
      isHeader: true
    },
    {
      month: 'Tentative',
      leads: 145,
      roomNights: 620,
      arr: '₹18,000',
      roomRevenue: '₹11,16,000',
      totalRevenue: '₹16,74,000',
      status: 'tentative',
      isHeader: false
    },
    {
      month: 'Confirmed',
      leads: 105,
      roomNights: 380,
      arr: '₹18,400',
      roomRevenue: '₹6,99,200',
      totalRevenue: '₹10,48,800',
      status: 'confirmed',
      isHeader: false
    },
    {
      month: 'Jan',
      leads: 220,
      roomNights: 1000,
      arr: '₹19,500',
      roomRevenue: '₹19,50,000',
      totalRevenue: '₹29,25,000',
      status: 'future',
      isHeader: true
    },
    {
      month: 'Tentative',
      leads: 135,
      roomNights: 650,
      arr: '₹19,300',
      roomRevenue: '₹12,54,500',
      totalRevenue: '₹18,81,750',
      status: 'tentative',
      isHeader: false
    },
    {
      month: 'Confirmed',
      leads: 85,
      roomNights: 350,
      arr: '₹19,700',
      roomRevenue: '₹6,89,500',
      totalRevenue: '₹10,34,250',
      status: 'confirmed',
      isHeader: false
    }
  ];

  const exportToExcel = () => {
    const exportData = leadsData.map(row => ({
      'Status': row.category || row.status,
      'Count': row.count,
      'Room Nights': row.roomNights,
      'ARR': row.arr,
      'Room Revenue': row.roomRevenue,
      'Total Revenue': row.totalRevenue
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Management Report');
    XLSX.writeFile(wb, `management-report-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-gradient-subtle p-6 space-y-8">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-primary bg-clip-text text-transparent">
            Management Dashboard
          </h1>
          <p className="text-muted-foreground text-lg">
            Welcome back, <span className="font-semibold text-foreground">{userName}</span>. Here's your comprehensive business overview.
          </p>
        </div>
        <Button
          onClick={exportToExcel}
          className="bg-gradient-primary hover:opacity-90 transition-all duration-300 shadow-elegant hover:shadow-lg transform hover:scale-105"
          size="lg"
        >
          <Download className="h-5 w-5 mr-2" />
          Export to Excel
        </Button>
      </div>

      {/* Filter Section */}
      <Card className="shadow-soft border-0 bg-gradient-card backdrop-blur-sm">
        <CardHeader className="pb-6">
          <CardTitle className="text-xl font-semibold text-foreground/90">Advanced Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-7 gap-6 items-end">
            {/* Date Range */}
            <div className="space-y-3">
              <label className="text-sm font-semibold text-foreground/80">Date Range</label>
              <div className="space-y-3">
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="border-muted-foreground/20 focus:border-primary transition-colors"
                />
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="border-muted-foreground/20 focus:border-primary transition-colors"
                />
              </div>
            </div>

            {/* OR Divider */}
            <div className="flex items-center justify-center">
              <div className="px-3 py-1 bg-muted rounded-full">
                <span className="text-sm font-medium text-muted-foreground">or</span>
              </div>
            </div>

            {/* Select Month */}
            <div className="space-y-3">
              <label className="text-sm font-semibold text-foreground/80">Select Month</label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="border-muted-foreground/20 focus:border-primary transition-colors">
                  <SelectValue placeholder="Choose month" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="jan2025">January 2025</SelectItem>
                  <SelectItem value="feb2025">February 2025</SelectItem>
                  <SelectItem value="mar2025">March 2025</SelectItem>
                  <SelectItem value="apr2025">April 2025</SelectItem>
                  <SelectItem value="may2025">May 2025</SelectItem>
                  <SelectItem value="jun2025">June 2025</SelectItem>
                  <SelectItem value="jul2025">July 2025</SelectItem>
                  <SelectItem value="aug2025">August 2025</SelectItem>
                  <SelectItem value="sep2025">September 2025</SelectItem>
                  <SelectItem value="oct2025">October 2025</SelectItem>
                  <SelectItem value="nov2025">November 2025</SelectItem>
                  <SelectItem value="dec2025">December 2025</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Other Filters */}
            <div className="md:col-span-4">
              <h3 className="text-sm font-semibold mb-4 text-foreground/80">Additional Filters</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Select value={selectedProperty} onValueChange={setSelectedProperty}>
                    <SelectTrigger className="border-muted-foreground/20 focus:border-primary transition-colors">
                      <SelectValue placeholder="Select Property" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="postcard-goa">Postcard Goa</SelectItem>
                      <SelectItem value="postcard-kerala">Postcard Kerala</SelectItem>
                      <SelectItem value="postcard-rajasthan">Postcard Rajasthan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                    <SelectTrigger className="border-muted-foreground/20 focus:border-primary transition-colors">
                      <SelectValue placeholder="Select Region" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="north">North India</SelectItem>
                      <SelectItem value="south">South India</SelectItem>
                      <SelectItem value="west">West India</SelectItem>
                      <SelectItem value="east">East India</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Select value={selectedTeamMember} onValueChange={setSelectedTeamMember}>
                    <SelectTrigger className="border-muted-foreground/20 focus:border-primary transition-colors">
                      <SelectValue placeholder="Select Team Member" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="team-a">Team A</SelectItem>
                      <SelectItem value="team-b">Team B</SelectItem>
                      <SelectItem value="rahul">Rahul Sharma</SelectItem>
                      <SelectItem value="priya">Priya Patel</SelectItem>
                      <SelectItem value="amit">Amit Kumar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sales Cycle Table */}
      <Card className="shadow-elegant border-0 bg-gradient-card backdrop-blur-sm overflow-hidden">
        <CardHeader className="pb-6 bg-gradient-to-r from-info/5 via-info/10 to-info/5 border-b border-border/50">
          <CardTitle className="text-center text-xl font-bold bg-gradient-to-r from-info to-info/70 bg-clip-text text-transparent">
            Sales Cycle Performance Analysis
          </CardTitle>
          <p className="text-center text-sm text-muted-foreground mt-2">
            Team-wise conversion metrics and sales cycle efficiency
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gradient-to-r from-info/8 via-info/12 to-info/8 hover:from-info/12 hover:via-info/16 hover:to-info/12 transition-all duration-300">
                  <TableHead className="h-16 px-8 text-sm font-bold text-foreground border-r border-border/30 bg-gradient-to-b from-transparent to-info/5">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-8 bg-gradient-to-b from-info to-info/70 rounded-full"></div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Users className="h-5 w-5 text-info" />
                          <span>Team</span>
                        </div>
                        <div className="text-xs text-muted-foreground font-normal mt-1">Department</div>
                      </div>
                    </div>
                  </TableHead>
                  <TableHead className="h-16 text-center text-sm font-bold text-foreground border-r border-border/30 bg-gradient-to-b from-transparent to-info/5">
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-info" />
                        <span>Number of Leads</span>
                      </div>
                      <div className="text-xs text-muted-foreground font-normal">Total Received</div>
                    </div>
                  </TableHead>
                  <TableHead className="h-16 text-center text-sm font-bold text-foreground border-r border-border/30 bg-gradient-to-b from-transparent to-info/5">
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-center gap-2">
                        <Target className="h-5 w-5 text-info" />
                        <span>Total Converted</span>
                      </div>
                      <div className="text-xs text-muted-foreground font-normal">Successful Closes</div>
                    </div>
                  </TableHead>
                  <TableHead className="h-16 text-center text-sm font-bold text-foreground border-r border-border/30 bg-gradient-to-b from-transparent to-info/5">
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-info" />
                        <span>Conversion Rate</span>
                      </div>
                      <div className="text-xs text-muted-foreground font-normal">Success %</div>
                    </div>
                  </TableHead>
                  <TableHead className="h-16 text-center text-sm font-bold text-foreground border-r border-border/30 bg-gradient-to-b from-transparent to-info/5">
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-info" />
                        <span>Sales Cycle (Days)</span>
                      </div>
                      <div className="text-xs text-muted-foreground font-normal">Avg Duration</div>
                    </div>
                  </TableHead>
                  <TableHead className="h-16 text-center text-sm font-bold text-foreground border-r border-border/30 bg-gradient-to-b from-transparent to-info/5">
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-info" />
                        <span>ARR</span>
                      </div>
                      <div className="text-xs text-muted-foreground font-normal">Average Rate</div>
                    </div>
                  </TableHead>
                  <TableHead className="h-16 text-center text-sm font-bold text-foreground border-r border-border/30 bg-gradient-to-b from-transparent to-info/5">
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-info" />
                        <span>Revenue</span>
                      </div>
                      <div className="text-xs text-muted-foreground font-normal">Total Sales</div>
                    </div>
                  </TableHead>
                  <TableHead className="h-16 text-center text-sm font-bold text-foreground bg-gradient-to-b from-transparent to-info/5">
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-info" />
                        <span>Room Nights</span>
                      </div>
                      <div className="text-xs text-muted-foreground font-normal">Total Nights</div>
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salesCycleData.map((row, index) => (
                  <TableRow
                    key={index}
                    className="hover:bg-gradient-to-r hover:from-info/10 hover:via-info/15 hover:to-info/10 transition-all duration-300 h-14 border-b border-border/20"
                  >
                    <TableCell className="font-semibold px-8 border-r border-border/20">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-gradient-to-br from-info to-info/70"></div>
                        <span className="text-base">{row.team}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-semibold border-r border-border/20 text-lg">
                      {row.leads.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center font-semibold border-r border-border/20 text-lg">
                      {row.converted}
                    </TableCell>
                    <TableCell className="text-center font-semibold border-r border-border/20">
                      <Badge className="bg-gradient-to-r from-success/20 to-success/30 text-success-foreground border border-success/30 font-bold text-sm">
                        {row.conversionRate}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center font-semibold border-r border-border/20 text-lg">
                      {row.salesCycle} days
                    </TableCell>
                    <TableCell className="text-center font-semibold border-r border-border/20 text-lg">
                      {row.arr}
                    </TableCell>
                    <TableCell className="text-center font-semibold border-r border-border/20 text-lg">
                      {row.revenue}
                    </TableCell>
                    <TableCell className="text-center font-semibold text-lg">
                      {row.roomNights.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Target vs Achieved Table */}
      <Card className="shadow-elegant border-0 bg-gradient-card backdrop-blur-sm overflow-hidden">
        <CardHeader className="pb-6 bg-gradient-to-r from-warning/5 via-warning/10 to-warning/5 border-b border-border/50">
          <CardTitle className="text-center text-xl font-bold bg-gradient-to-r from-warning to-warning/70 bg-clip-text text-transparent">
            Target vs Achieved Performance
          </CardTitle>
          <p className="text-center text-sm text-muted-foreground mt-2">
            Individual and team performance against set targets
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gradient-to-r from-warning/8 via-warning/12 to-warning/8 hover:from-warning/12 hover:via-warning/16 hover:to-warning/12 transition-all duration-300">
                  <TableHead className="h-16 px-8 text-sm font-bold text-foreground border-r border-border/30 bg-gradient-to-b from-transparent to-warning/5">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-8 bg-gradient-to-b from-warning to-warning/70 rounded-full"></div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Users className="h-5 w-5 text-warning" />
                          <span>Team / Individual</span>
                        </div>
                        <div className="text-xs text-muted-foreground font-normal mt-1">Resource</div>
                      </div>
                    </div>
                  </TableHead>
                  <TableHead className="h-16 text-center text-sm font-bold text-foreground border-r border-border/30 bg-gradient-to-b from-transparent to-warning/5">
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-center gap-2">
                        <Target className="h-5 w-5 text-warning" />
                        <span>Target</span>
                      </div>
                      <div className="text-xs text-muted-foreground font-normal">Goal Set</div>
                    </div>
                  </TableHead>
                  <TableHead className="h-16 text-center text-sm font-bold text-foreground border-r border-border/30 bg-gradient-to-b from-transparent to-warning/5">
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-warning" />
                        <span>Delivered</span>
                      </div>
                      <div className="text-xs text-muted-foreground font-normal">Achieved</div>
                    </div>
                  </TableHead>
                  <TableHead className="h-16 text-center text-sm font-bold text-foreground border-r border-border/30 bg-gradient-to-b from-transparent to-warning/5">
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-warning" />
                        <span>Room Nights</span>
                      </div>
                      <div className="text-xs text-muted-foreground font-normal">Total Nights</div>
                    </div>
                  </TableHead>
                  <TableHead className="h-16 text-center text-sm font-bold text-foreground border-r border-border/30 bg-gradient-to-b from-transparent to-warning/5">
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-warning" />
                        <span>Sales Cycle Days</span>
                      </div>
                      <div className="text-xs text-muted-foreground font-normal">Avg Duration</div>
                    </div>
                  </TableHead>
                  <TableHead className="h-16 text-center text-sm font-bold text-foreground bg-gradient-to-b from-transparent to-warning/5">
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-warning" />
                        <span>ARR</span>
                      </div>
                      <div className="text-xs text-muted-foreground font-normal">Average Rate</div>
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {targetAchievedData.map((row, index) => {
                  const achievementPercentage = ((row.delivered / row.target) * 100).toFixed(1);
                  const isOverAchieved = row.delivered > row.target;
                  const isUnderAchieved = row.delivered < row.target * 0.9;

                  return (
                    <TableRow
                      key={index}
                      className={`${row.isHeader
                        ? 'bg-gradient-to-r from-warning/15 via-warning/20 to-warning/15 border-l-4 border-l-warning hover:from-warning/20 hover:via-warning/25 hover:to-warning/20'
                        : 'hover:bg-gradient-to-r hover:from-warning/10 hover:via-warning/15 hover:to-warning/10'
                        } transition-all duration-300 ${row.isHeader ? 'h-14' : 'h-12'} border-b border-border/20`}
                    >
                      <TableCell className="font-semibold px-8 border-r border-border/20">
                        {row.isHeader ? (
                          <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full bg-gradient-to-br from-warning to-warning/70"></div>
                            <span className="text-base font-bold">{row.category}</span>
                          </div>
                        ) : (
                          <div className="ml-8 text-sm">{row.category}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-semibold border-r border-border/20 text-lg">
                        {row.target.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center border-r border-border/20">
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-semibold text-lg">{row.delivered.toLocaleString()}</span>
                          <Badge className={`text-xs font-bold ${isOverAchieved
                            ? 'bg-gradient-to-r from-success/20 to-success/30 text-success-foreground border border-success/30'
                            : isUnderAchieved
                              ? 'bg-gradient-to-r from-destructive/20 to-destructive/30 text-destructive-foreground border border-destructive/30'
                              : 'bg-gradient-to-r from-info/20 to-info/30 text-info-foreground border border-info/30'
                            }`}>
                            {achievementPercentage}%
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-semibold border-r border-border/20 text-lg">
                        {row.roomNights.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center border-r border-border/20">
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-semibold text-lg">{row.salesCycleDays} days</span>
                          <Badge className={`text-xs font-bold ${row.salesCycleDays <= 10
                            ? 'bg-gradient-to-r from-success/20 to-success/30 text-success-foreground border border-success/30'
                            : row.salesCycleDays <= 15
                              ? 'bg-gradient-to-r from-warning/20 to-warning/30 text-warning-foreground border border-warning/30'
                              : 'bg-gradient-to-r from-destructive/20 to-destructive/30 text-destructive-foreground border border-destructive/30'
                            }`}>
                            {row.salesCycleDays <= 10 ? 'Fast' : row.salesCycleDays <= 15 ? 'Average' : 'Slow'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-semibold text-lg">
                        {row.arr}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pipeline Data by Stay Date */}
      <Card className="shadow-elegant border-0 bg-gradient-card backdrop-blur-sm overflow-hidden">
        <CardHeader className="pb-6 bg-gradient-to-r from-success/5 via-success/10 to-success/5 border-b border-border/50">
          <CardTitle className="text-center text-xl font-bold bg-gradient-to-r from-success to-success/70 bg-clip-text text-transparent">
            Leads Pipeline Data as per Stay Date
          </CardTitle>
          <p className="text-center text-sm text-muted-foreground mt-2">
            Monthly pipeline analysis with revenue projections by stay date
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gradient-to-r from-success/8 via-success/12 to-success/8 hover:from-success/12 hover:via-success/16 hover:to-success/12 transition-all duration-300">
                  <TableHead className="h-16 px-8 text-sm font-bold text-foreground border-r border-border/30 bg-gradient-to-b from-transparent to-success/5">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-8 bg-gradient-to-b from-success to-success/70 rounded-full"></div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-5 w-5 text-success" />
                          <span>Month / Status</span>
                        </div>
                        <div className="text-xs text-muted-foreground font-normal mt-1">Time Period</div>
                      </div>
                    </div>
                  </TableHead>
                  <TableHead className="h-16 text-center text-sm font-bold text-foreground border-r border-border/30 bg-gradient-to-b from-transparent to-success/5">
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-success" />
                        <span>Leads Count</span>
                      </div>
                      <div className="text-xs text-muted-foreground font-normal">Total Leads</div>
                    </div>
                  </TableHead>
                  <TableHead className="h-16 text-center text-sm font-bold text-foreground border-r border-border/30 bg-gradient-to-b from-transparent to-success/5">
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-success" />
                        <span>Room Nights</span>
                      </div>
                      <div className="text-xs text-muted-foreground font-normal">Total Nights</div>
                    </div>
                  </TableHead>
                  <TableHead className="h-16 text-center text-sm font-bold text-foreground border-r border-border/30 bg-gradient-to-b from-transparent to-success/5">
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-success" />
                        <span>ARR</span>
                      </div>
                      <div className="text-xs text-muted-foreground font-normal">Average Rate</div>
                    </div>
                  </TableHead>
                  <TableHead className="h-16 text-center text-sm font-bold text-foreground border-r border-border/30 bg-gradient-to-b from-transparent to-success/5">
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-success" />
                        <span>Room Revenue</span>
                      </div>
                      <div className="text-xs text-muted-foreground font-normal">Room Sales</div>
                    </div>
                  </TableHead>
                  <TableHead className="h-16 text-center text-sm font-bold text-foreground bg-gradient-to-b from-transparent to-success/5">
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-success" />
                        <span>Total Revenue</span>
                      </div>
                      <div className="text-xs text-muted-foreground font-normal">Complete Revenue</div>
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pipelineData.map((row, index) => {
                  const getStatusBadge = (status: string) => {
                    if (status === 'tentative') {
                      return <Badge className="bg-gradient-to-r from-warning/20 to-warning/30 text-warning-foreground border border-warning/30 font-semibold">Tentative</Badge>;
                    }
                    if (status === 'confirmed') {
                      return <Badge className="bg-gradient-to-r from-success/20 to-success/30 text-success-foreground border border-success/30 font-semibold">Confirmed</Badge>;
                    }
                    return null;
                  };

                  return (
                    <TableRow
                      key={index}
                      className={`${row.isHeader
                        ? 'bg-gradient-to-r from-success/15 via-success/20 to-success/15 border-l-4 border-l-success hover:from-success/20 hover:via-success/25 hover:to-success/20'
                        : 'hover:bg-gradient-to-r hover:from-success/10 hover:via-success/15 hover:to-success/10'
                        } transition-all duration-300 ${row.isHeader ? 'h-14' : 'h-12'} border-b border-border/20`}
                    >
                      <TableCell className="font-semibold px-8 border-r border-border/20">
                        {row.isHeader ? (
                          <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full bg-gradient-to-br from-success to-success/70"></div>
                            <span className="text-base font-bold">{row.month}</span>
                          </div>
                        ) : (
                          <div className="ml-8 text-sm flex items-center gap-3">
                            {getStatusBadge(row.status) || <span>{row.month}</span>}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-semibold border-r border-border/20 text-lg">
                        {row.leads ? (typeof row.leads === 'number' ? row.leads.toLocaleString() : row.leads) : '-'}
                      </TableCell>
                      <TableCell className="text-center font-semibold border-r border-border/20 text-lg">
                        {row.roomNights ? (typeof row.roomNights === 'number' ? row.roomNights.toLocaleString() : row.roomNights) : '-'}
                      </TableCell>
                      <TableCell className="text-center font-semibold border-r border-border/20 text-lg">
                        {row.arr || '-'}
                      </TableCell>
                      <TableCell className="text-center font-semibold border-r border-border/20 text-lg">
                        {row.roomRevenue || '-'}
                      </TableCell>
                      <TableCell className="text-center font-semibold text-lg">
                        {row.totalRevenue || '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Main Table */}
      <Card className="shadow-elegant border-0 bg-gradient-card backdrop-blur-sm overflow-hidden">
        <CardHeader className="pb-6 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border-b border-border/50">
          <CardTitle className="text-center text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Lead Performance Analysis - Monthly Overview
          </CardTitle>
          <p className="text-center text-sm text-muted-foreground mt-2">
            Comprehensive view of leads received within the month as per lead received date
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gradient-to-r from-primary/8 via-primary/12 to-primary/8 hover:from-primary/12 hover:via-primary/16 hover:to-primary/12 transition-all duration-300">
                  <TableHead className="h-16 px-8 text-sm font-bold text-foreground border-r border-border/30 bg-gradient-to-b from-transparent to-primary/5">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-8 bg-gradient-primary rounded-full"></div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Users className="h-5 w-5 text-primary" />
                          <span>Lead Status</span>
                        </div>
                        <div className="text-xs text-muted-foreground font-normal mt-1">Category & Status</div>
                      </div>
                    </div>
                  </TableHead>
                  <TableHead className="h-16 text-center text-sm font-bold text-foreground border-r border-border/30 bg-gradient-to-b from-transparent to-primary/5">
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-primary" />
                        <span>Count</span>
                      </div>
                      <div className="text-xs text-muted-foreground font-normal">Total Leads</div>
                    </div>
                  </TableHead>
                  <TableHead className="h-16 text-center text-sm font-bold text-foreground border-r border-border/30 bg-gradient-to-b from-transparent to-primary/5">
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        <span>Room Nights</span>
                      </div>
                      <div className="text-xs text-muted-foreground font-normal">Total Nights</div>
                    </div>
                  </TableHead>
                  <TableHead className="h-16 text-center text-sm font-bold text-foreground border-r border-border/30 bg-gradient-to-b from-transparent to-primary/5">
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-primary" />
                        <span>ARR</span>
                      </div>
                      <div className="text-xs text-muted-foreground font-normal">Average Rate</div>
                    </div>
                  </TableHead>
                  <TableHead className="h-16 text-center text-sm font-bold text-foreground border-r border-border/30 bg-gradient-to-b from-transparent to-primary/5">
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-primary" />
                        <span>Room Revenue</span>
                      </div>
                      <div className="text-xs text-muted-foreground font-normal">Room Sales</div>
                    </div>
                  </TableHead>
                  <TableHead className="h-16 text-center text-sm font-bold text-foreground bg-gradient-to-b from-transparent to-primary/5">
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-primary" />
                        <span>Total Revenue</span>
                      </div>
                      <div className="text-xs text-muted-foreground font-normal">Complete Revenue</div>
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leadsData.map((row, index) => {
                  const getRowStyles = (variant: string, isHeader: boolean) => {
                    if (isHeader) {
                      switch (variant) {
                        case 'primary':
                          return 'bg-gradient-to-r from-success/15 via-success/20 to-success/15 border-l-4 border-l-success hover:from-success/20 hover:via-success/25 hover:to-success/20';
                        case 'secondary':
                          return 'bg-gradient-to-r from-info/15 via-info/20 to-info/15 border-l-4 border-l-info hover:from-info/20 hover:via-info/25 hover:to-info/20';
                        case 'accent':
                          return 'bg-gradient-to-r from-warning/15 via-warning/20 to-warning/15 border-l-4 border-l-warning hover:from-warning/20 hover:via-warning/25 hover:to-warning/20';
                        default:
                          return 'bg-gradient-to-r from-muted/30 via-muted/50 to-muted/30 hover:from-muted/40 hover:via-muted/60 hover:to-muted/40';
                      }
                    }
                    return 'hover:bg-gradient-to-r hover:from-muted/20 hover:via-muted/30 hover:to-muted/20 transition-all duration-300';
                  };

                  const getStatusBadge = (status: string, variant: string) => {
                    if (status === 'Total') return null;

                    const badgeStyles = {
                      confirmed: "bg-gradient-to-r from-success/20 to-success/30 text-success-foreground border border-success/30 shadow-sm",
                      tentative: "bg-gradient-to-r from-warning/20 to-warning/30 text-warning-foreground border border-warning/30 shadow-sm",
                      cancelled: "bg-gradient-to-r from-destructive/20 to-destructive/30 text-destructive-foreground border border-destructive/30 shadow-sm"
                    };

                    return (
                      <Badge
                        className={`${badgeStyles[variant as keyof typeof badgeStyles]} font-semibold px-3 py-1 hover:scale-105 transition-transform duration-200`}
                      >
                        {status}
                      </Badge>
                    );
                  };

                  return (
                    <TableRow
                      key={index}
                      className={`${getRowStyles(row.variant, row.isHeader)} border-b border-border/20 ${row.isHeader ? 'h-14' : 'h-12'} transition-all duration-300`}
                    >
                      <TableCell className="font-medium px-8 border-r border-border/20">
                        {row.category && (
                          <div className="font-bold text-base text-foreground flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full bg-gradient-primary"></div>
                            {row.category}
                          </div>
                        )}
                        {!row.category && row.status !== 'Total' && (
                          <div className="ml-8 text-sm flex items-center gap-3">
                            {getStatusBadge(row.status, row.variant)}
                          </div>
                        )}
                        {row.category && row.status === 'Total' && (
                          <div className="text-sm font-bold text-primary ml-4 flex items-center gap-2">
                            <TrendingUp className="h-4 w-4" />
                            {row.status}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-semibold border-r border-border/20">
                        <div className={`text-lg ${row.isHeader ? 'font-bold text-primary' : 'text-foreground'} transition-colors duration-200`}>
                          {typeof row.count === 'number' ? row.count.toLocaleString() : row.count}
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-semibold border-r border-border/20">
                        <div className={`text-lg ${row.isHeader ? 'font-bold text-primary' : 'text-foreground'} transition-colors duration-200`}>
                          {typeof row.roomNights === 'number' ? row.roomNights.toLocaleString() : row.roomNights}
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-semibold border-r border-border/20">
                        <div className={`text-lg ${row.isHeader ? 'font-bold text-primary' : 'text-foreground'} transition-colors duration-200`}>
                          {row.arr}
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-semibold border-r border-border/20">
                        <div className={`text-lg ${row.isHeader ? 'font-bold text-primary' : 'text-foreground'} transition-colors duration-200`}>
                          {row.roomRevenue}
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-semibold">
                        <div className={`text-lg ${row.isHeader ? 'font-bold text-primary' : 'text-foreground'} transition-colors duration-200`}>
                          {row.totalRevenue}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

    </div>
  );
};

export default ManagementDashboard;
