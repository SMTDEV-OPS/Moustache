import { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";

interface PermissionGuardProps {
    children: ReactNode;
    resource: string;
    action: string;
    scope?: string;
    dataContext?: any;
    fallback?: ReactNode;
}

export const PermissionGuard = ({
    children,
    resource,
    action,
    scope,
    dataContext,
    fallback = null
}: PermissionGuardProps) => {
    const { can } = useAuth();

    if (can(resource, action, scope, dataContext)) {
        return <>{children}</>;
    }

    return <>{fallback}</>;
};
