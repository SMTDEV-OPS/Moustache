import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Area, AreaChart
} from 'recharts';
import {
  TrendingUp, TrendingDown, Users, Target, MapPin, Building2,
  Trophy, Calendar, Filter, Download
} from 'lucide-react';

interface SalesHeadDashboardProps {
  userName: string;
}

const SalesHeadDashboard = ({ userName }: SalesHeadDashboardProps) => {
  const [selectedPeriod, setSelectedPeriod] = useState('thisMonth');
  const [selectedRegion, setSelectedRegion] = useState('all');

  // Mock data for sales performance
  const salesPeopleData = [
    {
      id: 1,
      name: 'Rohit Verma',
      region: 'North',
      target: 150,
      achieved: 142,
      achievement: 94.7,
      revenue: 28400000,
      leads: 85,
      conversions: 23,
      conversionRate: 27.1,
      status: 'excellent'
    },
    {
      id: 2,
      name: 'Priya Singh',
      region: 'West',
      target: 120,
      achieved: 98,
      achievement: 81.7,
      revenue: 19600000,
      leads: 72,
      conversions: 18,
      conversionRate: 25.0,
      status: 'good'
    },
    {
      id: 3,
      name: 'Arjun Patel',
      region: 'South',
      target: 180,
      achieved: 165,
      achievement: 91.7,
      revenue: 33000000,
      leads: 98,
      conversions: 28,
      conversionRate: 28.6,
      status: 'excellent'
    },
    {
      id: 4,
      name: 'Anjali Sharma',
      region: 'East',
      target: 100,
      achieved: 75,
      achievement: 75.0,
      revenue: 15000000,
      leads: 58,
      conversions: 12,
      conversionRate: 20.7,
      status: 'average'
    },
    {
      id: 5,
      name: 'Vikash Kumar',
      region: 'Central',
      target: 140,
      achieved: 125,
      achievement: 89.3,
      revenue: 25000000,
      leads: 81,
      conversions: 21,
      conversionRate: 25.9,
      status: 'good'
    }
  ];

  const regionData = [
    { region: 'North', target: 450, achieved: 425, achievement: 94.4, revenue: 85000000 },
    { region: 'West', target: 360, achieved: 295, achievement: 81.9, revenue: 59000000 },
    { region: 'South', target: 540, achieved: 495, achievement: 91.7, revenue: 99000000 },
    { region: 'East', target: 300, achieved: 225, achievement: 75.0, revenue: 45000000 },
    { region: 'Central', target: 420, achieved: 375, achievement: 89.3, revenue: 75000000 }
  ];

  const propertyData = [
    { property: 'Postcard Goa', sales: 45, revenue: 90000000, target: 50, achievement: 90 },
    { property: 'Postcard Coonoor', sales: 38, revenue: 76000000, target: 42, achievement: 90.5 },
    { property: 'Postcard Shimla', sales: 42, revenue: 84000000, target: 45, achievement: 93.3 },
    { property: 'Postcard Munnar', sales: 35, revenue: 70000000, target: 40, achievement: 87.5 },
    { property: 'Postcard Udaipur', sales: 28, revenue: 56000000, target: 32, achievement: 87.5 }
  ];

  const monthlyTrendData = [
    { month: 'Jan', target: 200, achieved: 185, gap: -15 },
    { month: 'Feb', target: 220, achieved: 205, gap: -15 },
    { month: 'Mar', target: 250, achieved: 240, gap: -10 },
    { month: 'Apr', target: 280, achieved: 275, gap: -5 },
    { month: 'May', target: 300, achieved: 295, gap: -5 },
    { month: 'Jun', target: 320, achieved: 325, gap: 5 }
  ];

  const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6'];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'bg-green-100 text-green-800';
      case 'good': return 'bg-blue-100 text-blue-800';
      case 'average': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getAchievementColor = (achievement: number) => {
    if (achievement >= 90) return 'text-green-600';
    if (achievement >= 75) return 'text-blue-600';
    if (achievement >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const totalTarget = salesPeopleData.reduce((sum, person) => sum + person.target, 0);
  const totalAchieved = salesPeopleData.reduce((sum, person) => sum + person.achieved, 0);
  const totalRevenue = salesPeopleData.reduce((sum, person) => sum + person.revenue, 0);
  const totalLeads = salesPeopleData.reduce((sum, person) => sum + person.leads, 0);
  const totalConversions = salesPeopleData.reduce((sum, person) => sum + person.conversions, 0);
  const overallAchievement = (totalAchieved / totalTarget) * 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sales Performance Dashboard</h1>
          <p className="text-muted-foreground">Welcome back, {userName}! Here's your team's performance overview.</p>
        </div>
        <div className="flex gap-3">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="thisMonth">This Month</SelectItem>
              <SelectItem value="lastMonth">Last Month</SelectItem>
              <SelectItem value="thisQuarter">This Quarter</SelectItem>
              <SelectItem value="lastQuarter">Last Quarter</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Target</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTarget}</div>
            <Progress value={overallAchievement} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {totalAchieved} achieved ({overallAchievement.toFixed(1)}%)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{(totalRevenue / 10000000).toFixed(1)}Cr</div>
            <p className="text-xs text-green-600 flex items-center mt-1">
              <TrendingUp className="h-3 w-3 mr-1" />
              +12.5% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Size</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{salesPeopleData.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Active sales executives
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{((totalConversions / totalLeads) * 100).toFixed(1)}%</div>
            <p className="text-xs text-blue-600 flex items-center mt-1">
              <TrendingUp className="h-3 w-3 mr-1" />
              +2.3% from last month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Analytics Tabs */}
      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="performance">Team Performance</TabsTrigger>
          <TabsTrigger value="regions">Region Analysis</TabsTrigger>
          <TabsTrigger value="properties">Property Wise</TabsTrigger>
          <TabsTrigger value="trends">Monthly Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sales Team Performance</CardTitle>
              <CardDescription>Individual performance metrics and target achievement</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {salesPeopleData.map((person) => (
                  <div key={person.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="flex flex-col">
                        <div className="font-semibold">{person.name}</div>
                        <div className="text-sm text-muted-foreground">{person.region} Region</div>
                      </div>
                      <Badge className={getStatusColor(person.status)}>
                        {person.status.charAt(0).toUpperCase() + person.status.slice(1)}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-5 gap-6 text-center">
                      <div>
                        <div className="text-sm text-muted-foreground">Target</div>
                        <div className="font-semibold">{person.target}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Achieved</div>
                        <div className={`font-semibold ${getAchievementColor(person.achievement)}`}>
                          {person.achieved}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Achievement</div>
                        <div className={`font-semibold ${getAchievementColor(person.achievement)}`}>
                          {person.achievement}%
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Revenue</div>
                        <div className="font-semibold">₹{(person.revenue / 1000000).toFixed(1)}L</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Conv. Rate</div>
                        <div className="font-semibold">{person.conversionRate}%</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Performance Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Target vs Achievement Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={salesPeopleData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="target" fill="#e5e7eb" name="Target" />
                  <Bar dataKey="achieved" fill="#3b82f6" name="Achieved" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="regions" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Region Wise Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={regionData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="region" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="target" fill="#e5e7eb" name="Target" />
                    <Bar dataKey="achieved" fill="#10b981" name="Achieved" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Revenue Distribution by Region</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={regionData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ region, revenue }) => `${region}: ₹${(revenue / 10000000).toFixed(1)}Cr`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="revenue"
                    >
                      {regionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Regional Performance Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {regionData.map((region, index) => (
                  <div key={region.region} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className={`w-4 h-4 rounded`} style={{ backgroundColor: COLORS[index] }}></div>
                      <div>
                        <div className="font-semibold">{region.region} Region</div>
                        <div className="text-sm text-muted-foreground">
                          Target: {region.target} | Achieved: {region.achieved}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-semibold ${getAchievementColor(region.achievement)}`}>
                        {region.achievement.toFixed(1)}%
                      </div>
                      <div className="text-sm text-muted-foreground">
                        ₹{(region.revenue / 10000000).toFixed(1)}Cr
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="properties" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Property Wise Sales Performance</CardTitle>
              <CardDescription>Sales achievements across different properties</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={propertyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="property" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="target" fill="#e5e7eb" name="Target" />
                  <Bar dataKey="sales" fill="#f59e0b" name="Sales" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {propertyData.map((property) => (
              <Card key={property.property}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">{property.property}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Sales</span>
                    <span className="font-semibold">{property.sales}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Target</span>
                    <span className="font-semibold">{property.target}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Achievement</span>
                    <span className={`font-semibold ${getAchievementColor(property.achievement)}`}>
                      {property.achievement}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Revenue</span>
                    <span className="font-semibold">₹{(property.revenue / 10000000).toFixed(1)}Cr</span>
                  </div>
                  <Progress value={property.achievement} className="mt-2" />
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Sales Trends</CardTitle>
              <CardDescription>Target vs Achievement trend over the months</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={monthlyTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="target" stroke="#e5e7eb" strokeWidth={2} name="Target" />
                  <Line type="monotone" dataKey="achieved" stroke="#3b82f6" strokeWidth={2} name="Achieved" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Achievement Gap Analysis</CardTitle>
              <CardDescription>Monthly gap between target and achievement</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={monthlyTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="gap"
                    stroke="#ef4444"
                    fill="#fef2f2"
                    name="Gap"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SalesHeadDashboard;