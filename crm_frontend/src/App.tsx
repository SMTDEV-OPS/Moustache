import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import ModuleBuilder from "./pages/settings/ModuleBuilder";
import PropertiesPage from "./pages/Properties";

const queryClient = new QueryClient();

import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "@/hooks/use-toast";
import { FieldBuilder } from "@/pages/setup/FieldBuilder";

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" storageKey="moustache-theme" enableSystem={false}>
      <ToastProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
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
