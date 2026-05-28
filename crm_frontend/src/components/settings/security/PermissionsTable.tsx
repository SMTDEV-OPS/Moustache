import { Check } from "lucide-react";

interface ModulePermission {
    module: string;
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
}

interface PermissionsTableProps {
    permissions: ModulePermission[];
    isEditable: boolean;
    onPermissionChange: (moduleName: string, action: keyof Omit<ModulePermission, "module">, value: boolean) => void;
}

export function PermissionsTable({ permissions, isEditable, onPermissionChange }: PermissionsTableProps) {

    const handleToggle = (moduleName: string, action: keyof Omit<ModulePermission, "module">, currentValue: boolean) => {
        if (!isEditable) return;
        onPermissionChange(moduleName, action, !currentValue);
    };

    const getModuleDisplayName = (moduleName: string) => {
        return moduleName.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    };

    return (
        <div className="border rounded-md overflow-hidden bg-white shadow-sm">
            <div className="grid grid-cols-5 bg-muted/30 border-b font-medium text-sm text-gray-700 py-3">
                <div className="px-4 col-span-1">Module</div>
                <div className="px-4 text-center">View</div>
                <div className="px-4 text-center">Create</div>
                <div className="px-4 text-center">Edit</div>
                <div className="px-4 text-center">Delete</div>
            </div>

            <div className="divide-y divide-gray-100">
                {permissions.map((perm, idx) => (
                    <div key={perm.module} className={`grid grid-cols-5 py-3 items-center ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/50 hover:bg-gray-50 transition-colors"}`}>
                        <div className="px-4 text-sm font-medium text-gray-900 col-span-1">
                            {getModuleDisplayName(perm.module)}
                        </div>

                        {/* View Checkbox */}
                        <div className="px-4 flex justify-center">
                            <button
                                type="button"
                                disabled={!isEditable}
                                onClick={() => handleToggle(perm.module, "view", perm.view)}
                                className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${perm.view
                                        ? "bg-primary text-primary-foreground border-transparent"
                                        : "bg-white border-2 border-gray-300 hover:border-gray-400"
                                    } ${!isEditable ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                            >
                                {perm.view && <Check className="w-4 h-4" strokeWidth={3} />}
                            </button>
                        </div>

                        {/* Create Checkbox */}
                        <div className="px-4 flex justify-center">
                            <button
                                type="button"
                                disabled={!isEditable || !perm.view} // Disable if View is off
                                onClick={() => handleToggle(perm.module, "create", perm.create)}
                                className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${!perm.view ? "bg-gray-100 border-gray-200" :
                                        perm.create
                                            ? "bg-primary text-primary-foreground border-transparent"
                                            : "bg-white border-2 border-gray-300 hover:border-gray-400"
                                    } ${(!isEditable || !perm.view) ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                            >
                                {perm.view && perm.create && <Check className="w-4 h-4" strokeWidth={3} />}
                            </button>
                        </div>

                        {/* Edit Checkbox */}
                        <div className="px-4 flex justify-center">
                            <button
                                type="button"
                                disabled={!isEditable || !perm.view} // Disable if View is off
                                onClick={() => handleToggle(perm.module, "edit", perm.edit)}
                                className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${!perm.view ? "bg-gray-100 border-gray-200" :
                                        perm.edit
                                            ? "bg-primary text-primary-foreground border-transparent"
                                            : "bg-white border-2 border-gray-300 hover:border-gray-400"
                                    } ${(!isEditable || !perm.view) ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                            >
                                {perm.view && perm.edit && <Check className="w-4 h-4" strokeWidth={3} />}
                            </button>
                        </div>

                        {/* Delete Checkbox */}
                        <div className="px-4 flex justify-center">
                            <button
                                type="button"
                                disabled={!isEditable || !perm.view} // Disable if View is off
                                onClick={() => handleToggle(perm.module, "delete", perm.delete)}
                                className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${!perm.view ? "bg-gray-100 border-gray-200" :
                                        perm.delete
                                            ? "bg-primary text-primary-foreground border-transparent"
                                            : "bg-white border-2 border-gray-300 hover:border-gray-400"
                                    } ${(!isEditable || !perm.view) ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                            >
                                {perm.view && perm.delete && <Check className="w-4 h-4" strokeWidth={3} />}
                            </button>
                        </div>

                    </div>
                ))}
            </div>
        </div>
    );
}
