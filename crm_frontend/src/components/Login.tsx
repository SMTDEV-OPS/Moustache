import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { backendLogin } from "@/services/auth";
import { DEFAULT_ADMIN_PLACEHOLDER } from "@/config/hotel";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";



const Login = () => {
  const { login } = useAuth();
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState("");
  const [isAdminSubmitting, setIsAdminSubmitting] = useState(false);
  // Remove backendTab as it seems unused effectively or simpler to just have one login form
  // Actually, keeping the UI structure is safer.
  const [backendTab, setBackendTab] = useState<"admin" | "user">("admin");

  const handleAdminLogin = async () => {
    setAdminError("");
    if (!adminEmail || !adminPassword) {
      setAdminError("Email and password are required");
      return;
    }
    try {
      setIsAdminSubmitting(true);
      await login(adminEmail, adminPassword);
      // Login successful - AuthContext updates state, parent (Index) re-renders
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to login";
      setAdminError(message);
    } finally {
      setIsAdminSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md">
        <Card className="border-0 shadow-lg">
          <CardHeader className="space-y-1 pb-6 text-center">
            <CardTitle className="text-2xl font-bold">Login</CardTitle>
            <p className="text-sm text-muted-foreground">
              Enter your credentials to access the CRM system
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <Tabs
              value={backendTab}
              onValueChange={(v) => setBackendTab(v as "admin" | "user")}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="user">CRM User</TabsTrigger>
                <TabsTrigger value="admin">Admin</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="admin-email" className="text-sm font-medium">Email</Label>
                <Input
                  id="admin-email"
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder={DEFAULT_ADMIN_PLACEHOLDER}
                  className="h-11"
                  onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-password" className="text-sm font-medium">Password</Label>
                <Input
                  id="admin-password"
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Enter password"
                  className="h-11"
                  onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
                />
              </div>
              {adminError && (
                <Alert variant="destructive" className="py-3">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">{adminError}</AlertDescription>
                </Alert>
              )}
              <Button
                onClick={handleAdminLogin}
                className="w-full h-11 text-base font-medium"
                disabled={isAdminSubmitting}
                size="lg"
              >
                {isAdminSubmitting ? "Signing in..." : "Sign In"}
              </Button>
            </div>
          </CardContent>
        </Card>
        <p className="text-center text-xs text-muted-foreground mt-6">
          Powered by <span className="font-semibold">MAG Ventures</span>
        </p>
      </div>
    </div>
  );
};

export default Login;