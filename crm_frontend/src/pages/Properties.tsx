import { useAuth } from "@/context/AuthContext";
import Login from "@/components/Login";
import { PropertyManagement } from "@/components/PropertyManagement";

export default function PropertiesPage() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return <PropertyManagement />;
}

