import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { backendLogin, backendLogout, BackendLoginResult } from "../services/auth";
import { setAuthToken, getAuthToken, API_BASE_URL } from "../services/api";
import { useToast } from "@/hooks/use-toast";

interface User {
    id: string;
    _id?: string;
    name: string;
    email: string;
    roleId?: string;
    isAdmin?: boolean;
    permissions?: string[];
    reportsTo?: string;
    hierarchyPath?: string;
    pfp?: string;
    propertyId?: string;
    accountId?: string;
    organizationId?: string;
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    can: (resource: string, action: string, scope?: string, dataContext?: any) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    // Hydrate user on mount if token exists
    useEffect(() => {
        const initAuth = async () => {
            const token = getAuthToken();
            if (token) {
                try {
                    // Verify token and get user details
                    // We can use the /auth/me endpoint for this
                    // reusing backendLogin logic might be tricky without password
                    // So we should probably add a "fetchMe" to services/auth
                    // For now, let's assume we fetch /auth/me
                    const response = await fetch(`${API_BASE_URL}/auth/me`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });

                    if (response.ok) {
                        const data = await response.json();
                        setUser(data.user);
                    } else {
                        // Token invalid
                        setAuthToken(null);
                        setUser(null);
                    }
                } catch (error) {
                    // API not reachable during bootstrap: fall back to logged-out state without noisy console errors.
                    setAuthToken(null); // Clear invalid token
                }
            }
            setIsLoading(false);
        };

        initAuth();
    }, []);

    const login = async (email: string, password: string) => {
        try {
            const result = await backendLogin(email, password);
            // backendLogin already sets the token in api service
            setUser(result.user as User);
            toast({ title: "Login successful", description: `Welcome back, ${result.user.name}` });
        } catch (error) {
            toast({
                title: "Login failed",
                description: error instanceof Error ? error.message : "Unknown error",
                variant: "destructive"
            });
            throw error;
        }
    };

    const logout = async () => {
        try {
            await backendLogout();
            setUser(null);
            toast({ title: "Logged out" });
        } catch (error) {
            console.error("Logout error", error);
        }
    };

    /**
     * Check permissions (Zoho style: resource.action.scope)
     */
    const can = (permission: string): boolean => {
        if (!user) return false;
        if (user.isAdmin) return true;

        const userPerms = user.permissions || [];

        // 1. Direct match
        if (userPerms.includes(permission)) return true;

        // 2. Wildcard resource match (e.g. leads.manage -> leads.read)
        const [resource] = permission.split(".");
        if (resource && userPerms.includes(`${resource}.manage`)) {
            return true;
        }

        return false;
    };

    return (
        <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout, can }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};
