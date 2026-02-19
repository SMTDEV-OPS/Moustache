import { useEffect, useState } from "react";
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
import Landing from "@/components/Landing";
import DetailedDashboard from "@/components/DetailedDashboard";
import TicketingSystem from "@/components/TicketingSystem";
import PropertyManagerDashboard from "@/components/PropertyManagerDashboard";
import SalesRevenueDashboard from "@/components/SalesRevenueDashboard";
import CCManagerDashboard from "@/components/CCManagerDashboard";
import SalesExecutiveDashboard from "@/components/SalesExecutiveDashboard";
import KnowledgeBase from "@/components/KnowledgeBase";
import { backendLogout } from "@/services/auth";

const Index = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [incomingCall, setIncomingCall] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [userRole, setUserRole] = useState("");
  const [userName, setUserName] = useState("");
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [backendUserId, setBackendUserId] = useState<string | null>(null);

  // Restore session on initial load
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("gcSession");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as {
          role: string;
          name: string;
          isAdmin?: boolean;
          permissions?: string[];
          backendUserId?: string;
        };
        if (parsed.role && parsed.name) {
          setUserRole(parsed.role);
          setUserName(parsed.name);
          setIsAdminUser(!!parsed.isAdmin);
          setUserPermissions(parsed.permissions ?? []);
          setBackendUserId(parsed.backendUserId ?? null);
          setIsLoggedIn(true);
          setShowLogin(false);
          setActiveTab("dashboard");
        }
      } catch {
        // ignore parse errors
      }
    }
  }, []);

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

  const handleLogin = (session: { role: string; name: string; isAdmin?: boolean; permissions?: string[]; backendUserId?: string }) => {
    const { role, name, isAdmin, permissions, backendUserId } = session;
    setUserRole(role);
    setUserName(name);
    setIsAdminUser(!!isAdmin);
    setUserPermissions(permissions ?? []);
    setBackendUserId(backendUserId ?? null);
    setIsLoggedIn(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("gcSession", JSON.stringify(session));
    }
    // Set appropriate default tab based on role
    switch(role) {
      case 'management':
        setActiveTab('dashboard');
        break;
      case 'callcenter':
        setActiveTab('calls');
        break;
      case 'ccmanager':
        setActiveTab('cc-dashboard');
        break;
      case 'saleshead':
        setActiveTab('sales');
        break;
      case 'salesexecutive':
        setActiveTab('sales-exec');
        break;
      case 'propertymanager1':
        setActiveTab('tickets');
        break;
      default:
        setActiveTab('dashboard');
    }
  };

  const handleLogout = async () => {
    try {
      // Call backend logout to set user offline and clean up server-side state
      // This will also clear authToken and localStorage
      await backendLogout();
    } catch (err) {
      // Even if backend logout fails, we still want to clear local state
      console.error("Logout error:", err);
    } finally {
      // Clear all local React state
      setIsLoggedIn(false);
      setShowLogin(false);
      setUserRole("");
      setUserName("");
      setIsAdminUser(false);
      setUserPermissions([]);
      setBackendUserId(null);
      setActiveTab("dashboard");
      
      // Note: backendLogout() already clears localStorage, but we ensure it's cleared here too
      // This is a safety measure in case backendLogout() wasn't called or failed
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("gcSession");
        window.localStorage.removeItem("authToken");
      }
    }
  };

  const handleGetStarted = () => {
    setShowLogin(true);
  };

  // Define which tabs each role can access
  const rolePermissions = {
    management: ['dashboard', 'knowledge-base'],
    callcenter: ['calls', 'tickets', 'knowledge-base'],
    ccmanager: ['cc-dashboard', 'knowledge-base'],
    saleshead: ['sales', 'leads', 'knowledge-base'],
    salesexecutive: ['sales-exec', 'knowledge-base'],
    propertymanager1: ['tickets', 'knowledge-base']
  };

  const availableTabs = rolePermissions[userRole as keyof typeof rolePermissions] || [];

  if (!isLoggedIn) {
    if (showLogin) {
      return <Login onLogin={handleLogin} />;
    }
    return <Landing onGetStarted={handleGetStarted} />;
  }

  // Use Professional CRM for all users now
  return (
    <ProfessionalCRM
      userRole={userRole}
      userName={userName}
      onLogout={handleLogout}
      isAdmin={isAdminUser}
      permissions={userPermissions}
      backendUserId={backendUserId ?? undefined}
    />
  );
};

export default Index;
