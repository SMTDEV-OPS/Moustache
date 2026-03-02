import { API_BASE_URL, withAuthHeaders } from "./api";

export interface IProfile {
    _id: string;
    name: string;
    description?: string;
    permissions: string[];
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
            if (data?.message) message = data.message;
        } catch { }
        throw new Error(message);
    }

    return await response.json();
};

export const createProfile = async (data: Partial<IProfile>): Promise<IProfile> => {
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
            if (resData?.message) message = resData.message;
        } catch { }
        throw new Error(message);
    }

    return await response.json();
};

export const updateProfile = async (id: string, data: Partial<IProfile>): Promise<IProfile> => {
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
            if (resData?.message) message = resData.message;
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
            if (data?.message) message = data.message;
        } catch { }
        throw new Error(message);
    }
};
