import { API_BASE_URL, withAuthHeaders } from "./api";

export interface IModulePermission {
    module: string;
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
}

export interface ISetupPermission {
    key: string;
    enabled: boolean;
}

export interface ProfilePayload {
    name: string;
    description?: string;
    modulePermissions: IModulePermission[];
    setupPermissions: ISetupPermission[];
}

export interface IProfile {
    _id: string;
    name: string;
    description?: string;
    modulePermissions: IModulePermission[];
    setupPermissions: ISetupPermission[];
    isSystemProfile: boolean;
    createdAt: string;
}

export const getProfiles = async (): Promise<IProfile[]> => {
    const response = await fetch(`${API_BASE_URL}/profiles`, {
        headers: withAuthHeaders(),
    });

    if (!response.ok) {
        let message = "Unable to fetch profiles";
        try {
            const data = await response.json();
            message = data?.error?.message ?? data?.message ?? message;
        } catch { }
        throw new Error(message);
    }

    return await response.json();
};

export const createProfile = async (data: ProfilePayload): Promise<IProfile> => {
    const response = await fetch(`${API_BASE_URL}/profiles`, {
        method: "POST",
        headers: withAuthHeaders({
            "Content-Type": "application/json",
        }),
        body: JSON.stringify(data),
    });

    if (!response.ok) {
        let message = "Unable to create profile";
        try {
            const resData = await response.json();
            message = resData?.error?.message ?? resData?.message ?? message;
        } catch { }
        throw new Error(message);
    }

    return await response.json();
};

export const updateProfile = async (id: string, data: ProfilePayload): Promise<IProfile> => {
    const response = await fetch(`${API_BASE_URL}/profiles/${id}`, {
        method: "PUT",
        headers: withAuthHeaders({
            "Content-Type": "application/json",
        }),
        body: JSON.stringify(data),
    });

    if (!response.ok) {
        let message = "Unable to update profile";
        try {
            const resData = await response.json();
            message = resData?.error?.message ?? resData?.message ?? message;
        } catch { }
        throw new Error(message);
    }

    return await response.json();
};

export const deleteProfile = async (id: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/profiles/${id}`, {
        method: "DELETE",
        headers: withAuthHeaders(),
    });

    if (!response.ok) {
        let message = "Unable to delete profile";
        try {
            const data = await response.json();
            message = data?.error?.message ?? data?.message ?? message;
        } catch { }
        throw new Error(message);
    }
};
