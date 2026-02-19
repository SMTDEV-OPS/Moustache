import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { backendLogin, backendLogout, BackendLoginResult } from "../services/auth";
import { setAuthToken, getAuthToken } from "../services/api";
import { useToast } from "@/components/ui/use-toast";

interface User {
    id: string;
    name: string;
    email: string;
    teamType: string;
    roleId?: string;
    isAdmin?: boolean;
    permissions?: string[];
    reportsTo?: string;
    hierarchyPath?: string;
    pfp?: string;
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
                    const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:4000"}/auth/me`, {
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
                    console.error("Failed to hydrate auth:", error);
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
     * Check permissions.
     * Format: resource:action:scope
     * Logic matches backend AccessControlService
     */
    const can = (resource: string, action: string, scope?: string, dataContext?: any): boolean => {
        if (!user) return false;
        if (user.isAdmin) return true;
        if (user.permissions?.includes("*:*:*")) return true;

        // Filter relevant permissions
        const permissions = user.permissions || [];
        const relevant = permissions.filter(p => {
            const parts = p.split(":");
            // parts[0] is resource, parts[1] is action
            return parts[0] === resource && (parts[1] === action || parts[1] === "*");
        });

        if (relevant.length === 0) return false;

        // Check scopes
        for (const perm of relevant) {
            const parts = perm.split(":");
            const permScope = parts[2] || "global";

            // precise match if scope arg is provided (e.g. checking if user has "team" access)
            // OR if typical dataContext check is needed.
            // Frontend "can" usually checks "Do I have ANY permission to view leads?" 
            // OR "Can I view THIS lead?"

            if (scope) {
                // Strict check: User must have specific scope
                if (permScope === scope || permScope === "global") return true;
            } else if (dataContext) {
                // Data context check
                if (permScope === "global") return true;

                if (permScope === "region") {
                    // Check if dataContext.regionId is in user.regions (need to have regions in user object)
                    // For now, simplistically:
                    return true; // We might need to strictly validate, but frontend validation is soft.
                    // Backend enforces hard validation.
                }
                if (permScope === "team") {
                    if (dataContext.teamType && user.teamType === dataContext.teamType) return true;
                }
                if (permScope === "own") {
                    if (dataContext.ownerId === user.id) return true;
                    // Check subordinates (if we have usage)
                }
            } else {
                // No scope/context requested -> "Does user have access generally?"
                // If user has any permission (even 'own'), return true
                return true;
            }
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
