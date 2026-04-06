import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import Index from "./pages/Index";
import Login from "./components/Login";
import NotFound from "./pages/NotFound";
import ModuleBuilder from "./pages/settings/ModuleBuilder";
import PropertiesPage from "./pages/Properties";

const queryClient = new QueryClient();

import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ToastProvider } from "@/hooks/use-toast";
import { FieldBuilder } from "@/pages/setup/FieldBuilder";

function LoginRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  return <Login />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" storageKey="moustache-theme" enableSystem={false}>
      <ToastProvider>
        <AuthProvider>
          <TooltipProvider>
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/login" element={<LoginRoute />} />
                <Route path="/properties" element={<PropertiesPage />} />
                <Route path="/settings/module-builder" element={<ModuleBuilder />} />
                <Route path="/setup/fields" element={<FieldBuilder />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  </QueryClientProvider >
);

export default App;
