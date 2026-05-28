import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TrendingUp, DollarSign, Users, Target, Calendar,
  Star, Award, BarChart3, PieChart, Filter, Clock, Mail, Eye
} from "lucide-react";

const SalesRevenueDashboard = () => {
  const salesPersonName = "Priya Sharma";

  const [selectedPeriod, setSelectedPeriod] = useState("month");
  const [leadCreationFilter, setLeadCreationFilter] = useState({
    fromDate: "",
    toDate: ""
  });

  // Sales Performance Data
  const salesStats = {
    month: {
      totalRevenue: "₹45,20,000",
      leadsConverted: 23,
      conversionRate: "34.8%",
      avgDealValue: "₹1,96,522",
      target: "₹50,00,000",
      achievement: "90.4%"
    },
    quarter: {
      totalRevenue: "₹1,28,50,000",
      leadsConverted: 67,
      conversionRate: "32.1%",
      avgDealValue: "₹1,91,791",
      target: "₹1,40,00,000",
      achievement: "91.8%"
    },
    year: {
      totalRevenue: "₹4,85,60,000",
      leadsConverted: 245,
      conversionRate: "35.2%",
      avgDealValue: "₹1,98,204",
      target: "₹5,00,00,000",
      achievement: "97.1%"
    }
  };

  const currentStats = salesStats[selectedPeriod as keyof typeof salesStats];

  const revenueBreakdown = [
    {
      property: "Postcard Goa",
      revenue: "₹18,75,000",
      leads: 9,
      avgValue: "₹2,08,333",
      share: "41.5%",
      color: "bg-blue-500"
    },
    {
      property: "Postcard Kerala",
      revenue: "₹12,50,000",
      leads: 6,
      avgValue: "₹2,08,333",
      share: "27.6%",
      color: "bg-green-500"
    },
    {
      property: "Postcard Rajasthan",
      revenue: "₹9,45,000",
      leads: 5,
      avgValue: "₹1,89,000",
      share: "20.9%",
      color: "bg-purple-500"
    },
    {
      property: "Postcard Mumbai",
      revenue: "₹4,50,000",
      leads: 3,
      avgValue: "₹1,50,000",
      share: "10.0%",
      color: "bg-orange-500"
    }
  ];

  const monthlyTrend = [
    { month: "Aug", revenue: 38.5, target: 45 },
    { month: "Sep", revenue: 42.8, target: 45 },
    { month: "Oct", revenue: 47.2, target: 48 },
    { month: "Nov", revenue: 41.6, target: 48 },
    { month: "Dec", revenue: 45.2, target: 50 }
  ];

  const topDeals = [
    {
      id: "L001",
      guest: "Arjun Kumar",
      property: "Postcard Goa",
      value: "₹3,20,000",
      status: "Converted",
      date: "2024-12-10",
      nights: 7,
      rooms: 2
    },
    {
      id: "L006",
      guest: "Ravi Patel Family",
      property: "Postcard Kerala",
      value: "₹2,85,000",
      status: "Converted",
      date: "2024-12-08",
      nights: 5,
      rooms: 3
    },
    {
      id: "L012",
      guest: "Sneha Reddy",
      property: "Postcard Rajasthan",
      value: "₹2,45,000",
      status: "Proposal",
      date: "2024-12-14",
      nights: 4,
      rooms: 2
    },
    {
      id: "L018",
      guest: "Corporate Event - Tech Solutions",
      property: "Postcard Goa",
      value: "₹4,50,000",
      status: "In Progress",
      date: "2024-12-12",
      nights: 3,
      rooms: 8
    }
  ];

  const leaderboard = [
    { name: "Priya Sharma", revenue: "₹45,20,000", leads: 23, position: 1, badge: "🏆" },
    { name: "Rajesh Kumar", revenue: "₹42,80,000", leads: 21, position: 2, badge: "🥈" },
    { name: "Anjali Patel", revenue: "₹39,50,000", leads: 19, position: 3, badge: "🥉" },
    { name: "Vikram Singh", revenue: "₹35,20,000", leads: 17, position: 4, badge: "" },
    { name: "Meera Gupta", revenue: "₹32,10,000", leads: 15, position: 5, badge: "" }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Converted': return 'bg-green-100 text-green-800';
      case 'Query': return 'bg-blue-100 text-blue-800';
      case 'Proposal': return 'bg-yellow-100 text-yellow-800';
      case 'Tentative': return 'bg-orange-100 text-orange-800';
      case 'Confirmed': return 'bg-green-100 text-green-800';
      case 'Cancelled': return 'bg-red-100 text-red-800';
      case 'In Progress': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Sales Performance</h2>
          <p className="text-gray-600">Welcome back, {salesPersonName}</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 bg-gray-50 p-2 rounded-lg">
            <label className="text-sm font-medium text-gray-700">Lead Creation:</label>
            <input
              type="date"
              value={leadCreationFilter.fromDate}
              onChange={(e) => setLeadCreationFilter({ ...leadCreationFilter, fromDate: e.target.value })}
              className="text-sm px-2 py-1 border rounded"
              placeholder="From"
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              value={leadCreationFilter.toDate}
              onChange={(e) => setLeadCreationFilter({ ...leadCreationFilter, toDate: e.target.value })}
              className="text-sm px-2 py-1 border rounded"
              placeholder="To"
            />
          </div>
          <div className="flex bg-gray-100 rounded-lg p-1">
            <Button
              variant={selectedPeriod === 'month' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSelectedPeriod('month')}
            >
              Month
            </Button>
            <Button
              variant={selectedPeriod === 'quarter' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSelectedPeriod('quarter')}
            >
              Quarter
            </Button>
            <Button
              variant={selectedPeriod === 'year' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSelectedPeriod('year')}
            >
              Year
            </Button>
          </div>
        </div>
      </div>

      {/* Performance Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-border bg-surface">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Total Revenue</p>
                <p className="text-2xl font-bold text-green-900">{currentStats.totalRevenue}</p>
                <p className="text-xs text-green-600">Target: {currentStats.target}</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-surface">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Leads Converted</p>
                <p className="text-2xl font-bold text-blue-900">{currentStats.leadsConverted}</p>
                <p className="text-xs text-blue-600">Conversion: {currentStats.conversionRate}</p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-surface">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600">Avg Deal Value</p>
                <p className="text-2xl font-bold text-purple-900">{currentStats.avgDealValue}</p>
                <p className="text-xs text-purple-600">Per conversion</p>
              </div>
              <BarChart3 className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-surface">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-600">Target Achievement</p>
                <p className="text-2xl font-bold text-orange-900">{currentStats.achievement}</p>
                <p className="text-xs text-orange-600">This {selectedPeriod}</p>
              </div>
              <Target className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="revenue" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="revenue">Revenue Breakdown</TabsTrigger>
          <TabsTrigger value="deals">Top Deals</TabsTrigger>
          <TabsTrigger value="leaderboard">Team Performance</TabsTrigger>
          <TabsTrigger value="salesteam">Follow-ups</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue by Property */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <PieChart className="h-5 w-5 text-blue-600" />
                  <span>Revenue by Property</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {revenueBreakdown.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className={`h-4 w-4 rounded ${item.color}`} />
                        <div>
                          <p className="font-medium text-gray-900">{item.property}</p>
                          <p className="text-sm text-gray-600">{item.leads} leads • {item.avgValue} avg</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-green-600">{item.revenue}</p>
                        <Badge variant="secondary" className="text-xs">{item.share}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Monthly Progress */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  <span>Monthly Progress</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {monthlyTrend.map((month, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{month.month} 2024</span>
                        <span className="text-gray-600">₹{month.revenue}L / ₹{month.target}L</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${month.revenue >= month.target ? 'bg-green-500' : 'bg-blue-500'}`}
                          style={{ width: `${Math.min((month.revenue / month.target) * 100, 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>{((month.revenue / month.target) * 100).toFixed(1)}% achieved</span>
                        {month.revenue >= month.target && <span className="text-green-600">🎯 Target exceeded!</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="deals" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Top Deals This Month</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topDeals.map((deal, index) => (
                  <div key={index} className="p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <Badge variant="secondary" className="font-mono text-xs">{deal.id}</Badge>
                        <Badge className={getStatusColor(deal.status)}>{deal.status}</Badge>
                        <Badge variant="outline">{deal.property}</Badge>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-green-600">{deal.value}</p>
                        <p className="text-sm text-gray-500">{deal.date}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-gray-900">{deal.guest}</h4>
                        <p className="text-sm text-gray-600">{deal.nights} nights • {deal.rooms} rooms</p>
                      </div>
                      {deal.status === 'Converted' && (
                        <div className="flex items-center space-x-1 text-green-600">
                          <Award className="h-4 w-4" />
                          <span className="text-sm font-medium">Converted</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="salesteam" className="space-y-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Follow-ups</h3>
            <div className="flex bg-gray-100 rounded-lg p-1">
              <Button
                variant={selectedPeriod === 'month' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSelectedPeriod('month')}
              >
                Month
              </Button>
              <Button
                variant={selectedPeriod === 'quarter' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSelectedPeriod('quarter')}
              >
                Quarter
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Team Performance Overview */}
            <Card>
              <CardHeader>
                <CardTitle>Team Performance by Member</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {leaderboard.map((member, index) => (
                    <div key={index} className="p-4 border rounded-lg bg-gray-50">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className="text-lg font-semibold text-gray-600">#{member.position}</div>
                          <div>
                            <h4 className="font-medium text-gray-900">{member.name}</h4>
                            <p className="text-sm text-gray-600">Sales Executive</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-sm font-medium">
                          {member.leads} leads converted
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div className="text-center">
                          <p className="text-gray-600">Revenue</p>
                          <p className="font-semibold text-green-600">{member.revenue}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-gray-600">Nights</p>
                          <p className="font-semibold text-blue-600">{member.leads * 4}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-gray-600">Conversion</p>
                          <p className="font-semibold text-purple-600">{(member.leads * 2.3).toFixed(1)}%</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Pending Leads by Member */}
            <Card>
              <CardHeader>
                <CardTitle>Pending Leads to Action</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    {
                      id: "L001",
                      name: "Priya Sharma",
                      phone: "+91 98765 43210",
                      email: "priya.sharma@gmail.com",
                      property: "Postcard Goa",
                      checkIn: "2025-02-15",
                      checkOut: "2025-02-20",
                      budget: "₹50,000",
                      pricePerNight: 8500,
                      status: "hot",
                      priority: "high",
                      score: 85,
                      workingDays: 3,
                      workingHours: 2,
                      lastContact: "2 hours ago",
                      nextFollowUp: "Today 4:00 PM",
                      assignedTo: "Priya Sharma"
                    },
                    {
                      id: "L002",
                      name: "Rajesh Kumar",
                      phone: "+91 87654 32109",
                      email: "rajesh.kumar@yahoo.com",
                      property: "Postcard Kerala",
                      checkIn: "2025-02-20",
                      checkOut: "2025-02-25",
                      budget: "₹60,000",
                      pricePerNight: 9500,
                      status: "warm",
                      priority: "medium",
                      score: 72,
                      workingDays: 5,
                      workingHours: 4,
                      lastContact: "1 day ago",
                      nextFollowUp: "Tomorrow 10:00 AM",
                      assignedTo: "Rajesh Kumar"
                    },
                    {
                      id: "L003",
                      name: "Anjali Patel",
                      phone: "+91 76543 21098",
                      email: "anjali.patel@hotmail.com",
                      property: "Postcard Rajasthan",
                      checkIn: "2025-02-18",
                      checkOut: "2025-02-22",
                      budget: "₹45,000",
                      pricePerNight: 7500,
                      status: "qualified",
                      priority: "high",
                      score: 91,
                      workingDays: 2,
                      workingHours: 6,
                      lastContact: "4 hours ago",
                      nextFollowUp: "Today 6:00 PM",
                      assignedTo: "Anjali Patel"
                    }
                  ].map((lead, index) => (
                    <Card key={index} className="hover:shadow-md transition-shadow border-l-4 border-l-orange-500">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4">
                            {/* Lead Info */}
                            <div className="space-y-1">
                              <h3 className="font-semibold text-lg">{lead.name}</h3>
                              <p className="text-sm text-muted-foreground">{lead.phone}</p>
                              <p className="text-sm text-muted-foreground underline cursor-pointer hover:text-blue-600">
                                {lead.email}
                              </p>
                              <div className="flex items-center space-x-2 mt-2">
                                <Badge className={
                                  lead.status === 'hot' ? 'bg-red-100 text-red-800' :
                                    lead.status === 'warm' ? 'bg-orange-100 text-orange-800' :
                                      lead.status === 'qualified' ? 'bg-green-100 text-green-800' :
                                        'bg-blue-100 text-blue-800'
                                }>
                                  {lead.status}
                                </Badge>
                                <Badge className={
                                  lead.priority === 'high' ? 'bg-red-100 text-red-800' :
                                    lead.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                      'bg-green-100 text-green-800'
                                }>
                                  {lead.priority}
                                </Badge>
                              </div>
                            </div>

                            {/* Property & Dates */}
                            <div className="space-y-1">
                              <p className="font-medium">{lead.property}</p>
                              <p className="text-sm text-muted-foreground">Check-in: {lead.checkIn}</p>
                              <p className="text-sm text-muted-foreground">Check-out: {lead.checkOut}</p>
                              <p className="text-sm text-muted-foreground">Guest Budget: {lead.budget}</p>
                              <p className="text-sm text-muted-foreground">Total nights: 5</p>
                              <p className="text-sm font-medium text-green-600">
                                Total Deal Value: ₹{(lead.pricePerNight * 5).toLocaleString()}
                              </p>
                            </div>

                            {/* Progress & Timing */}
                            <div className="space-y-1">
                              <p className="text-sm">
                                <span className="font-medium">Score:</span>
                                <span className={`ml-1 font-bold ${lead.score >= 80 ? 'text-green-600' :
                                    lead.score >= 60 ? 'text-orange-600' : 'text-red-600'
                                  }`}>{lead.score}%</span>
                              </p>
                              <p className="text-sm text-muted-foreground">
                                <Clock className="h-3 w-3 inline mr-1" />
                                Working: {lead.workingDays}d {lead.workingHours}h
                              </p>
                              <p className="text-sm text-muted-foreground">Last: {lead.lastContact}</p>
                              <p className="text-sm text-orange-600 font-medium">Due: {lead.nextFollowUp}</p>
                            </div>

                            {/* Assignment */}
                            <div className="space-y-2">
                              <div className="flex items-center space-x-1 text-sm">
                                <Users className="h-3 w-3" />
                                <span className="text-muted-foreground">Assigned:</span>
                                <span className="font-medium">{lead.assignedTo}</span>
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex flex-col space-y-2 ml-4">
                            <Button size="sm" variant="outline">
                              <Mail className="h-4 w-4 mr-2" />
                              Email
                            </Button>
                            <Button size="sm" variant="outline">
                              Schedule Call back
                            </Button>
                            <Button size="sm" variant="outline">
                              <Eye className="h-4 w-4 mr-2" />
                              View
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="leaderboard" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Overall Team Performance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Star className="h-5 w-5 text-yellow-600" />
                  <span>Team Leaderboard - All Members</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {leaderboard.map((person, index) => (
                    <div key={index} className="p-4 rounded-lg border bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-2">
                            <span className="text-2xl">{person.badge || `#${person.position}`}</span>
                            <div>
                              <h4 className="font-semibold text-gray-900">{person.name}</h4>
                              <p className="text-sm text-gray-600">{person.leads} leads converted</p>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-green-600">{person.revenue}</p>
                          <Badge
                            className={`${person.position <= 3 ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}
                          >
                            Position #{person.position}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Regional Performance */}
            <Card>
              <CardHeader>
                <CardTitle>Regional Sales Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { region: "North India", members: 4, revenue: "₹1,85,20,000", leads: 78, conversion: "32.4%" },
                    { region: "West India", members: 3, revenue: "₹1,42,80,000", leads: 65, conversion: "28.9%" },
                    { region: "South India", members: 5, revenue: "₹2,15,60,000", leads: 95, conversion: "35.2%" },
                    { region: "East India", members: 2, revenue: "₹95,40,000", leads: 42, conversion: "30.1%" }
                  ].map((region, index) => (
                    <div key={index} className="p-4 border rounded-lg bg-blue-50">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h4 className="font-semibold text-gray-900">{region.region}</h4>
                          <p className="text-sm text-gray-600">{region.members} team members</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-green-600">{region.revenue}</p>
                          <p className="text-sm text-gray-600">{region.leads} leads</p>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <Badge variant="outline">{region.conversion} conversion</Badge>
                        <div className="flex items-center space-x-2">
                          <TrendingUp className="h-4 w-4 text-green-500" />
                          <span className="text-sm text-green-600">+12.3%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SalesRevenueDashboard;