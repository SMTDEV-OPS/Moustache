import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Lock, Mail, Loader2, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";

const Login = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }

    try {
      setIsSubmitting(true);
      await login(email, password);
      // Login successful - AuthContext updates state, parent (Index) re-renders
    } catch (err) {
      const message = err instanceof Error ? err.message : "Authentication failed. Please check your credentials.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#fefcf7]">
      <div className="w-full max-w-5xl animate-in fade-in zoom-in duration-500">
        <div className="grid overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl md:grid-cols-2">
          <div className="relative hidden md:block">
            <img
              src="/lovable-uploads/login-side.png"
              alt="Scenic property view"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-black/10" />
          </div>
          <Card className="border-0 rounded-none shadow-none bg-white">
          <CardHeader className="space-y-1 pb-6 text-center">
            <div className="flex justify-center mb-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <i className="fa-solid fa-shield-halved text-primary text-lg" aria-hidden="true" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">Welcome Back</CardTitle>
            <CardDescription className="text-base">
              Sign in to your professional workspace
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="pl-10 h-11 bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-primary/20 transition-all"
                    autoComplete="email"
                    disabled={isSubmitting}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                  <a href="#" className="text-xs font-medium text-primary hover:underline hover:text-primary/80 transition-colors">
                    Forgot password?
                  </a>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-10 h-11 bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-primary/20 transition-all"
                    autoComplete="current-password"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {error && (
                <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-2 border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-900/50 text-red-800 dark:text-red-200">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription className="text-sm font-medium opacity-90">{error}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                className="w-full h-11 text-base font-medium shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300"
                disabled={isSubmitting}
                size="lg"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800/50">
            <div className="grid grid-cols-2 gap-4 w-full">
              {/* Optional: Add social login or alternative methods here if needed in future */}
            </div>
            <p className="text-center text-xs text-muted-foreground">
              By clicking "Sign In", you agree to our <a href="#" className="underline hover:text-primary">Terms of Service</a> and <a href="#" className="underline hover:text-primary">Privacy Policy</a>.
            </p>
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground/70 pt-2">
              <i className="fa-solid fa-bolt" aria-hidden="true" />
              <span>Powered by SM Technologies.</span>
            </div>
          </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Login;