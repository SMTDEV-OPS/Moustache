import React from "react";
import { useAuth } from "@/context/AuthContext";

type PermissionGuardProps = {
    required: string | string[];
    children: React.ReactNode;
    fallback?: React.ReactNode;
};

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
    required,
    children,
    fallback = null,
}) => {
    const { user } = useAuth();

    if (!user) {
        return <>{fallback}</>;
    }

    if (user.isAdmin) {
        return <>{children}</>;
    }

    const requiredPerms = Array.isArray(required) ? required : [required];
    const userPerms = user.permissions || [];

    // Check if user has ALL required permissions (strict)
    // Or should it be ANY? Usually strictly required for a specific action.
    // Let's assume ANY for now if it's a list, or maybe we need a prop for valid strategy.
    // But for simple "view module", usually just one perm.
    // Let's implement HAS_ANY logic for the array to be flexible.

    const hasPermission = requiredPerms.some((perm) => {
        // 1. Direct match
        if (userPerms.includes(perm)) return true;

        // 2. Wildcard resource match (e.g. leads.manage -> leads.read)
        const [resource] = perm.split(".");
        if (resource && userPerms.includes(`${resource}.manage`)) {
            return true;
        }

        return false;
    });

    if (hasPermission) {
        return <>{children}</>;
    }

    return <>{fallback}</>;
};

export const usePermission = (required: string | string[]) => {
    const { user } = useAuth();

    if (!user) return false;
    if (user.isAdmin) return true;

    const requiredPerms = Array.isArray(required) ? required : [required];
    const userPerms = user.permissions || [];

    return requiredPerms.some((perm) => {
        if (userPerms.includes(perm)) return true;
        const [resource] = perm.split(".");
        return resource && userPerms.includes(`${resource}.manage`);
    });
};
