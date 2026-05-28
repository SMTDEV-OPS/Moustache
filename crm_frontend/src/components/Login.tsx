import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/shared/Button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Lock, Mail, Zap } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Authentication failed. Please check your credentials.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const brand = import.meta.env.VITE_HOTEL_BRAND || "Postcard Hotels and Resorts";

  return (
    <div className="flex min-h-screen bg-bg">
      <div className="relative hidden w-[52%] lg:block">
        <img
          src="/lovable-uploads/login-side.png"
          alt=""
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1c1917]/70 via-[#1c1917]/20 to-transparent" />
        <div className="absolute bottom-12 left-12 right-12 text-white">
          <p className="font-display text-3xl font-semibold tracking-tight">{brand}</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-[400px] animate-panel-enter">
          <div className="mb-8 lg:hidden">
            <img
              src="/lovable-uploads/postcard-logo.png"
              alt={brand}
              className="h-10 w-auto"
            />
          </div>

          <h1 className="font-display text-2xl font-semibold text-text">Sign in</h1>

          <form onSubmit={handleLogin} className="mt-8 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-text">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-faint" strokeWidth={1.5} />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={import.meta.env.VITE_ADMIN_EMAIL_PLACEHOLDER || "you@hotel.com"}
                  className="h-11 border-border bg-surface pl-10"
                  autoComplete="email"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-text">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-faint" strokeWidth={1.5} />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-11 border-border bg-surface pl-10"
                  autoComplete="current-password"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {error && (
              <Alert variant="destructive" className="border-red-200 bg-red-50 text-red-800">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" variant="primary" className="w-full !h-11" loading={isSubmitting} disabled={isSubmitting}>
              {isSubmitting ? "Signing in…" : "Sign In"}
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-text-faint leading-relaxed">
            By clicking &quot;Sign In&quot;, you agree to our{" "}
            <a href="#" className="underline hover:text-text-muted">
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="#" className="underline hover:text-text-muted">
              Privacy Policy
            </a>
            .
          </p>
          <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-text-faint">
            <Zap className="h-3.5 w-3.5" strokeWidth={1.5} />
            Powered by Svayammeraki Technologies.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
