import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import ModuleBuilder from "./pages/settings/ModuleBuilder";
import PropertiesPage from "./pages/Properties";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "@/hooks/use-toast";
import { FieldBuilder } from "@/pages/setup/FieldBuilder";
import PropertyGuidePublic from "@/pages/PropertyGuidePublic";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" storageKey="postcard-theme" enableSystem={false}>
      <ToastProvider>
        <AuthProvider>
          <TooltipProvider>
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/dashboard" element={<Index />} />
                <Route path="/calls" element={<Index />} />
                <Route path="/leads" element={<Index />} />
                <Route path="/leads/:leadId" element={<Index />} />
                <Route path="/follow-ups" element={<Index />} />
                <Route path="/calendar" element={<Index />} />
                <Route path="/week-planner" element={<Index />} />
                <Route path="/accounts" element={<Index />} />
                <Route path="/accounts/dashboard" element={<Index />} />
                <Route path="/tickets" element={<Index />} />
                <Route path="/reports" element={<Index />} />
                <Route path="/buddy" element={<Index />} />
                <Route path="/knowledge/*" element={<Index />} />
                <Route path="/email" element={<Index />} />
                <Route path="/email/settings" element={<Index />} />
                <Route path="/email/health" element={<Index />} />
                <Route path="/notifications" element={<Index />} />
                <Route path="/settings" element={<Index />} />
                <Route path="/setup/*" element={<Index />} />
                <Route path="/security/*" element={<Index />} />
                <Route path="/users" element={<Index />} />
                <Route path="/properties" element={<PropertiesPage />} />
                <Route path="/settings/module-builder" element={<ModuleBuilder />} />
                <Route path="/setup/fields" element={<FieldBuilder />} />
                <Route path="/share/knowledge/:token" element={<PropertyGuidePublic />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
