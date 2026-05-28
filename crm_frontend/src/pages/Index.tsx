import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Phone, Users, Calendar, TrendingUp, Clock, User, MapPin, Star, LogOut, BookOpen } from "lucide-react";
import GuestProfile from "@/components/GuestProfile";
import CallInterface from "@/components/CallInterface";
import LeadManagement from "@/components/LeadManagement";
import { ProfessionalCRM } from "@/components/ProfessionalCRM";
import Dashboard from "@/components/Dashboard";
import Login from "@/components/Login";
import DetailedDashboard from "@/components/DetailedDashboard";
import TicketingSystem from "@/components/TicketingSystem";
import PropertyManagerDashboard from "@/components/PropertyManagerDashboard";
import SalesRevenueDashboard from "@/components/SalesRevenueDashboard";
import CCManagerDashboard from "@/components/CCManagerDashboard";
import SalesExecutiveDashboard from "@/components/SalesExecutiveDashboard";
import KnowledgeBase from "@/components/KnowledgeBase";


const Index = () => {
  const { user, isAuthenticated, logout, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [incomingCall, setIncomingCall] = useState(false);

  // Effect to set initial tab based on role when user logs in
  useEffect(() => {
    if (user) {
      // Determine role string for UI logic
      // Only "admin" role is explicit in backend usually, others are roles.
      // We need to map user.roleId or permissions to these UI roles if needed.

      let role = "management";
      if (user.isAdmin) role = "management"; // Admin sees management dashboard? Or we need 'admin'?
      // Previous logic: role: backendIsAdmin ? "admin" : "management"


      // Allow overriding via explicit roleId check if needed

      // For now, just default to dashboard if logic is complex, 
      // or keep simple mapping:

      // Set appropriate default tab
      setActiveTab("dashboard");
    }
  }, [user]);

  // Mock data for demo with Indian names
  const mockGuest = {
    id: "G001",
    name: "Priya Sharma",
    phone: "+91 98765 43210",
    email: "priya.sharma@email.com",
    loyaltyStatus: "Gold",
    totalStays: 8,
    lastStay: "2024-05-15",
    preferences: ["Ocean view", "Late checkout", "Quiet room"],
    property: "Postcard Goa",
    interactionHistory: [
      { date: "2024-06-10", type: "Call", channel: "Phone", agent: "Harleen Mehta", summary: "Inquiry about booking for July" },
      { date: "2024-06-08", type: "Email", channel: "Email", agent: "Harleen Mehta", summary: "Follow-up on spa services" },
      { date: "2024-05-20", type: "Call", channel: "Phone", agent: "Harleen Mehta", summary: "Post-stay feedback call" },
      { date: "2024-05-18", type: "WhatsApp", channel: "WhatsApp", agent: "Harleen Mehta", summary: "Quick inquiry about room availability" },
      { date: "2024-05-15", type: "SMS", channel: "SMS", agent: "System", summary: "Checkout confirmation and feedback request" }
    ]
  };

  const simulateIncomingCall = () => {
    setIncomingCall(true);
    setActiveTab("calls");
  };

  const handleLogout = async () => {
    await logout();
    setActiveTab("dashboard");
  };

  if (isLoading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-bg">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-text-muted">Loading…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  // Use Professional CRM for all users now
  // Create derived props from user object
  const userRole = user?.isAdmin ? "admin" : "management";

  return (
    <ProfessionalCRM
      userRole={userRole}
      userName={user?.name || ""}
      onLogout={handleLogout}
      isAdmin={!!user?.isAdmin}
      permissions={user?.permissions || []}
      backendUserId={user?.id}
    />
  );
};

export default Index;
