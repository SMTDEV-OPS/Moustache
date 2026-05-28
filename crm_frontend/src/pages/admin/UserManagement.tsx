import { useState, useEffect, useMemo } from "react";
import { API_BASE_URL, withAuthHeaders } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import {
    Search,
    UserPlus,
    X,
    ChevronDown,
    MoreVertical,
    Mail,
    Phone,
    Shield,
    Users,
    Edit2,
    PowerOff,
    Power,
    Loader2,
    AlertCircle,
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ─── Types ────────────────────────────────────────────────────────────────────

interface User {
    _id: string;
    name: string;
    email: string;
    phone?: string;
    roleId?: string;
    reportsTo?: string;
    hierarchyPath?: string;
    status: "ACTIVE" | "INACTIVE";
}

interface Role {
    _id: string;
    name: string;
}



// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string) {
    return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
}

// Deterministic color from name
const AVATAR_COLORS = [
    "bg-blue-500",
    "bg-violet-500",
    "bg-emerald-500",
    "bg-amber-500",
    "bg-pink-500",
    "bg-cyan-500",
    "bg-rose-500",
    "bg-indigo-500",
];
function avatarColor(name: string) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ─── Avatar Component ─────────────────────────────────────────────────────────

function UserAvatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
    const sizeClass = size === "sm" ? "h-8 w-8 text-xs" : size === "lg" ? "h-12 w-12 text-base" : "h-10 w-10 text-sm";
    return (
        <div
            className={`${sizeClass} ${avatarColor(name)} rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0`}
        >
            {getInitials(name)}
        </div>
    );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: "ACTIVE" | "INACTIVE" }) {
    return status === "ACTIVE" ? (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Active
        </span>
    ) : (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200 dark:bg-gray-800/50 dark:text-gray-400 dark:border-gray-700">
            <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
            Inactive
        </span>
    );
}

// ─── Skeleton Row ─────────────────────────────────────────────────────────────

function SkeletonRow() {
    return (
        <tr className="border-b border-border/50 animate-pulse">
            <td className="py-4 px-4">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-muted" />
                    <div className="space-y-1.5">
                        <div className="h-3.5 w-28 rounded bg-muted" />
                        <div className="h-3 w-36 rounded bg-muted" />
                    </div>
                </div>
            </td>
            {[1, 2, 3, 4].map((i) => (
                <td key={i} className="py-4 px-4">
                    <div className="h-3.5 w-20 rounded bg-muted" />
                </td>
            ))}
            <td className="py-4 px-4">
                <div className="h-6 w-16 rounded-full bg-muted" />
            </td>
            <td className="py-4 px-4">
                <div className="h-8 w-8 rounded bg-muted" />
            </td>
        </tr>
    );
}

// ─── Drawer Form ──────────────────────────────────────────────────────────────

interface DrawerProps {
    open: boolean;
    onClose: () => void;
    editingUser: User | null;
    users: User[];
    roles: Role[];
    onSaved: () => void;
}

function UserDrawer({ open, onClose, editingUser, users, roles, onSaved }: DrawerProps) {
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const [form, setForm] = useState({
        name: "",
        email: "",
        phone: "",
        password: "",
        roleId: "",
        reportsTo: "none",
    });

    // Populate form when editing
    useEffect(() => {
        if (editingUser) {
            setForm({
                name: editingUser.name,
                email: editingUser.email,
                phone: editingUser.phone || "",
                password: "",
                roleId: editingUser.roleId || "",
                reportsTo: editingUser.reportsTo || "none",
            });
        } else {
            setForm({ name: "", email: "", phone: "", password: "", roleId: "", reportsTo: "none" });
        }
        setErrors({});
    }, [editingUser, open]);

    const set = (field: string, value: string) => {
        setForm((prev) => ({ ...prev, [field]: value }));
        if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
    };

    const validate = () => {
        const errs: Record<string, string> = {};
        if (!form.name.trim()) errs.name = "Name is required";
        if (!form.email.trim()) errs.email = "Email is required";
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = "Invalid email address";
        if (!editingUser && !form.password) errs.password = "Password is required";
        if (!editingUser && form.password && form.password.length < 6) errs.password = "Password must be at least 6 characters";
        if (editingUser && form.password && form.password.length < 6) errs.password = "Password must be at least 6 characters";
        return errs;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const errs = validate();
        if (Object.keys(errs).length > 0) { setErrors(errs); return; }

        setIsSaving(true);
        try {
            const method = editingUser ? "PATCH" : "POST";
            const url = editingUser ? `${API_BASE_URL}/users/${editingUser._id}` : `${API_BASE_URL}/users`;

            const payload: Record<string, unknown> = {
                name: form.name.trim(),
                email: form.email.trim(),
                phone: form.phone.trim() || undefined,

                reportsTo: form.reportsTo === "none" ? null : form.reportsTo,
            };
            if (form.roleId) payload.roleId = form.roleId;
            if (form.password) payload.password = form.password;

            const res = await fetch(url, {
                method,
                headers: withAuthHeaders({ "Content-Type": "application/json" }) as HeadersInit,
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.message || "Failed to save user");
            }

            toast({
                title: editingUser ? "User updated" : "User created",
                description: editingUser
                    ? `${form.name} has been updated successfully.`
                    : `${form.name} has been added to the CRM.`,
            });
            onSaved();
            onClose();
        } catch (err: unknown) {
            toast({
                title: "Error",
                description: err instanceof Error ? err.message : "Failed to save user",
                variant: "destructive",
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                onClick={onClose}
            />

            {/* Drawer Panel */}
            <div
                className={`fixed right-0 top-0 h-full z-50 w-full max-w-[480px] bg-surface border-l border-border shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${open ? "translate-x-0" : "translate-x-full"}`}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-muted/30">
                    <div>
                        <h2 className="text-lg font-semibold">{editingUser ? "Edit User" : "Add New User"}</h2>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {editingUser ? `Editing ${editingUser.name}` : "Fill in the details to create a new CRM user"}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                    {/* Personal Info Section */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-1">
                            <div className="h-px flex-1 bg-border" />
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">Personal Info</span>
                            <div className="h-px flex-1 bg-border" />
                        </div>

                        {/* Preview Avatar */}
                        {form.name && (
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border border-border/50">
                                <UserAvatar name={form.name} size="lg" />
                                <div>
                                    <p className="font-medium text-sm">{form.name}</p>
                                    <p className="text-xs text-muted-foreground">{form.email || "No email yet"}</p>
                                </div>
                            </div>
                        )}

                        <div className="grid gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="um-name" className="text-sm font-medium">
                                    Full Name <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="um-name"
                                    placeholder="e.g. Priya Sharma"
                                    value={form.name}
                                    onChange={(e) => set("name", e.target.value)}
                                    className={errors.name ? "border-destructive" : ""}
                                />
                                {errors.name && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.name}</p>}
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="um-email" className="text-sm font-medium">
                                    Email Address <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="um-email"
                                    type="email"
                                    placeholder="priya@postcard.in"
                                    value={form.email}
                                    onChange={(e) => set("email", e.target.value)}
                                    disabled={!!editingUser}
                                    className={errors.email ? "border-destructive" : ""}
                                />
                                {errors.email && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.email}</p>}
                                {editingUser && <p className="text-xs text-muted-foreground">Email cannot be changed after creation.</p>}
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="um-phone" className="text-sm font-medium">Phone Number</Label>
                                <Input
                                    id="um-phone"
                                    type="tel"
                                    placeholder="+91 98765 43210"
                                    value={form.phone}
                                    onChange={(e) => set("phone", e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Password Section */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-1">
                            <div className="h-px flex-1 bg-border" />
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">
                                {editingUser ? "Change Password" : "Set Password"}
                            </span>
                            <div className="h-px flex-1 bg-border" />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="um-password" className="text-sm font-medium">
                                Password {!editingUser && <span className="text-destructive">*</span>}
                                {editingUser && <span className="text-muted-foreground font-normal text-xs ml-1">(leave blank to keep current)</span>}
                            </Label>
                            <Input
                                id="um-password"
                                type="password"
                                autoComplete="new-password"
                                placeholder={editingUser ? "Enter new password..." : "Minimum 6 characters"}
                                value={form.password}
                                onChange={(e) => set("password", e.target.value)}
                                className={errors.password ? "border-destructive" : ""}
                            />
                            {errors.password && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.password}</p>}
                        </div>
                    </div>

                    {/* Organization Section */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-1">
                            <div className="h-px flex-1 bg-border" />
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">Organization</span>
                            <div className="h-px flex-1 bg-border" />
                        </div>



                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium">Role</Label>
                            <Select
                                value={form.roleId || "none"}
                                onValueChange={(v) => set("roleId", v === "none" ? "" : v)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="No role assigned" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">No role</SelectItem>
                                    {roles.map((r) => (
                                        <SelectItem key={r._id} value={r._id}>
                                            {r.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">Defines this user's position in the org hierarchy.</p>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium">Reports To</Label>
                            <Select value={form.reportsTo} onValueChange={(v) => set("reportsTo", v)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="No manager" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">No manager (top-level)</SelectItem>
                                    {users
                                        .filter((u) => u._id !== editingUser?._id && u.status === "ACTIVE")
                                        .map((u) => (
                                            <SelectItem key={u._id} value={u._id}>
                                                {u.name}
                                                <span className="text-muted-foreground ml-1 text-xs">

                                                </span>
                                            </SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">Sets the reporting chain and data visibility hierarchy.</p>
                        </div>
                    </div>
                </form>

                {/* Footer */}
                <div className="flex gap-3 px-6 py-4 border-t border-border bg-muted/20">
                    <Button type="button" variant="outline" onClick={onClose} className="flex-1" disabled={isSaving}>
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        className="flex-1"
                        disabled={isSaving}
                        onClick={handleSubmit}
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving...
                            </>
                        ) : editingUser ? (
                            "Save Changes"
                        ) : (
                            "Create User"
                        )}
                    </Button>
                </div>
            </div>
        </>
    );
}

// ─── View Details Component ───────────────────────────────────────────────────

function UserDetailPanel({
    user,
    roles,
    users,
    onClose,
    onEdit
}: {
    user: User | null;
    roles: Role[];
    users: User[];
    onClose: () => void;
    onEdit: () => void;
}) {
    if (!user) return null;

    const roleName = roles.find(r => r._id === user.roleId)?.name || "No role Assigned";
    const managerName = users.find(u => u._id === user.reportsTo)?.name || "Top-level";

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 transition-all duration-300 ease-in-out"
                onClick={onClose}
            />
            {/* Slide-in Panel */}
            <div
                className="fixed inset-y-0 right-0 z-50 w-full sm:w-[450px] bg-surface border-l border-border shadow-2xl flex flex-col transition-transform duration-300 ease-in-out sm:rounded-l-2xl"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
                    <h2 className="text-lg font-semibold tracking-tight">User Details</h2>
                    <div className="flex gap-2">
                        <Button variant="outline" size="icon" onClick={onEdit} title="Edit User">
                            <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={onClose}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    {/* Header profile area */}
                    <div className="flex items-start gap-4">
                        <UserAvatar name={user.name} size="lg" />
                        <div>
                            <h3 className="text-xl font-bold">{user.name}</h3>
                            <div className="flex items-center gap-2 mt-1">
                                <StatusBadge status={user.status} />
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-6">
                        {/* Contact info */}
                        <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Contact Information</h4>
                            <div className="grid gap-3 p-4 rounded-xl border border-border bg-card/50">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                                        <Mail className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs text-muted-foreground">Email</p>
                                        <p className="text-sm font-medium truncate">{user.email}</p>
                                    </div>
                                </div>
                                {user.phone && (
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                                            <Phone className="h-4 w-4 text-muted-foreground" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">Phone</p>
                                            <p className="text-sm font-medium">{user.phone}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Organization info */}
                        <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Organization</h4>
                            <div className="grid gap-3 p-4 rounded-xl border border-border bg-card/50">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                                        <Shield className="h-4 w-4 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Role</p>
                                        <p className="text-sm font-medium">{roleName}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0">
                                        {user.reportsTo ? <UserAvatar name={managerName} size="sm" /> : <Users className="h-4 w-4 text-muted-foreground" />}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs text-muted-foreground">Reports To</p>
                                        <p className="text-sm font-medium truncate">{managerName}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const UserManagement = () => {
    const { toast } = useToast();

    const [users, setUsers] = useState<User[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState<string | null>(null);

    // Drawer state
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);

    // Detail panel state
    const [viewingUser, setViewingUser] = useState<User | null>(null);

    // Filter state
    const [search, setSearch] = useState("");
    const [filterStatus, setFilterStatus] = useState("ALL");

    // ── Data fetching ──────────────────────────────────────────────────────────

    const fetchUsers = async () => {
        const res = await fetch(`${API_BASE_URL}/users`, {
            headers: withAuthHeaders() as HeadersInit,
        });
        if (!res.ok) throw new Error("Failed to fetch users");
        return res.json() as Promise<User[]>;
    };

    const fetchRoles = async () => {
        const res = await fetch(`${API_BASE_URL}/roles`, {
            headers: withAuthHeaders() as HeadersInit,
        });
        if (!res.ok) throw new Error("Failed to fetch roles");
        return res.json() as Promise<Role[]>;
    };

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [u, r] = await Promise.all([fetchUsers(), fetchRoles()]);
            setUsers(u);
            setRoles(r);
        } catch (err) {
            toast({ title: "Error", description: "Failed to load user data", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { void loadData(); }, []);

    // ── Toggle status ──────────────────────────────────────────────────────────

    const toggleStatus = async (user: User) => {
        const newStatus = user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
        setIsUpdating(user._id);
        try {
            const res = await fetch(`${API_BASE_URL}/users/${user._id}`, {
                method: "PATCH",
                headers: withAuthHeaders({ "Content-Type": "application/json" }) as HeadersInit,
                body: JSON.stringify({ status: newStatus }),
            });
            if (!res.ok) throw new Error("Failed to update status");
            setUsers((prev) =>
                prev.map((u) => (u._id === user._id ? { ...u, status: newStatus } : u))
            );
            toast({
                title: `User ${newStatus === "ACTIVE" ? "activated" : "deactivated"}`,
                description: `${user.name} is now ${newStatus.toLowerCase()}.`,
            });
        } catch {
            toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
        } finally {
            setIsUpdating(null);
        }
    };

    // ── Filtered users ──────────────────────────────────────────────────────────

    const filteredUsers = useMemo(() => {
        return users.filter((u) => {
            const q = search.toLowerCase();
            const matchesSearch = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
            const matchesStatus = filterStatus === "ALL" || u.status === filterStatus;
            return matchesSearch && matchesStatus;
        });
    }, [users, search, filterStatus]);

    // ── Stats ──────────────────────────────────────────────────────────────────

    const totalActive = users.filter((u) => u.status === "ACTIVE").length;
    const totalInactive = users.filter((u) => u.status === "INACTIVE").length;

    // ── Handlers ───────────────────────────────────────────────────────────────

    const openCreate = () => { setEditingUser(null); setDrawerOpen(true); };
    const openEdit = (user: User) => { setEditingUser(user); setDrawerOpen(true); };
    const closeDrawer = () => { setDrawerOpen(false); setTimeout(() => setEditingUser(null), 300); };

    // ── Lookup helpers ─────────────────────────────────────────────────────────

    const getRoleName = (id?: string) => roles.find((r) => r._id === id)?.name ?? "—";
    const getManagerName = (id?: string) => users.find((u) => u._id === id)?.name ?? "—";

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <div className="min-h-full space-y-6">

            {/* ── Page Header ────────────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Users</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Manage your organization's CRM users, roles, and reporting structure.
                    </p>
                </div>
                <Button onClick={openCreate} className="flex items-center gap-2 self-start sm:self-auto">
                    <UserPlus className="h-4 w-4" />
                    New User
                </Button>
            </div>

            {/* ── Stat Cards ─────────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold">{users.length}</p>
                        <p className="text-xs text-muted-foreground">Total Users</p>
                    </div>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                        <Power className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold">{totalActive}</p>
                        <p className="text-xs text-muted-foreground">Active</p>
                    </div>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3 col-span-2 sm:col-span-1">
                    <div className="h-10 w-10 rounded-lg bg-gray-500/10 flex items-center justify-center flex-shrink-0">
                        <PowerOff className="h-5 w-5 text-gray-500" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold">{totalInactive}</p>
                        <p className="text-xs text-muted-foreground">Inactive</p>
                    </div>
                </div>
            </div>

            {/* ── Filters ────────────────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by name or email..."
                        className="pl-9 bg-background"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    {search && (
                        <button
                            onClick={() => setSearch("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>



                <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-full sm:w-36 bg-background">
                        <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">All Status</SelectItem>
                        <SelectItem value="ACTIVE">Active</SelectItem>
                        <SelectItem value="INACTIVE">Inactive</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* ── Table ──────────────────────────────────────────────────────── */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
                                <th className="text-left py-3 px-4 font-semibold">User</th>
                                <th className="text-left py-3 px-4 font-semibold">Role</th>
                                <th className="text-left py-3 px-4 font-semibold hidden sm:table-cell">Team</th>
                                <th className="text-left py-3 px-4 font-semibold hidden md:table-cell">Reports To</th>
                                <th className="text-left py-3 px-4 font-semibold">Status</th>
                                <th className="text-right py-3 px-4 font-semibold">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                            ) : filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-16 text-center">
                                        <div className="flex flex-col items-center gap-3 text-muted-foreground">
                                            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                                                <Users className="h-7 w-7" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-foreground">
                                                    {search || filterStatus !== "ALL"
                                                        ? "No users match your filters"
                                                        : "No users yet"}
                                                </p>
                                                <p className="text-sm mt-0.5">
                                                    {search || filterStatus !== "ALL"
                                                        ? "Try adjusting your search or filters"
                                                        : "Click \"New User\" to add the first user"}
                                                </p>
                                            </div>
                                            {(search || filterStatus !== "ALL") && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => { setSearch(""); setFilterStatus("ALL"); }}
                                                >
                                                    Clear filters
                                                </Button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map((user) => (
                                    <tr
                                        key={user._id}
                                        className={`border-b border-border/50 hover:bg-muted/30 transition-colors group cursor-pointer ${viewingUser?._id === user._id ? "bg-muted/30" : ""}`}
                                        onClick={() => setViewingUser(user)}
                                    >
                                        {/* User column */}
                                        <td className="py-3.5 px-4">
                                            <div className="flex items-center gap-3">
                                                <UserAvatar name={user.name} />
                                                <div className="min-w-0">
                                                    <p className="font-medium text-foreground truncate">{user.name}</p>
                                                    <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                                                        <Mail className="h-3 w-3 flex-shrink-0" />
                                                        {user.email}
                                                    </p>
                                                    {user.phone && (
                                                        <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                                                            <Phone className="h-3 w-3 flex-shrink-0" />
                                                            {user.phone}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </td>

                                        {/* Role */}
                                        <td className="py-3.5 px-4">
                                            {user.roleId ? (
                                                <span className="flex items-center gap-1.5 text-sm">
                                                    <Shield className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                                    {getRoleName(user.roleId)}
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground text-xs">No role</span>
                                            )}
                                        </td>

                                        {/* Team */}
                                        <td className="py-3.5 px-4 text-sm hidden sm:table-cell">
                                            <span className="text-muted-foreground">—</span>
                                        </td>

                                        {/* Reports To */}
                                        <td className="py-3.5 px-4 text-sm hidden md:table-cell">
                                            {user.reportsTo ? (
                                                <div className="flex items-center gap-2">
                                                    <UserAvatar name={getManagerName(user.reportsTo)} size="sm" />
                                                    <span className="truncate max-w-[120px]">{getManagerName(user.reportsTo)}</span>
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground text-xs">Top-level</span>
                                            )}
                                        </td>

                                        {/* Status */}
                                        <td className="py-3.5 px-4">
                                            <StatusBadge status={user.status} />
                                        </td>

                                        {/* Actions */}
                                        <td className="py-3.5 px-4 text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        disabled={isUpdating === user._id}
                                                    >
                                                        {isUpdating === user._id ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <MoreVertical className="h-4 w-4" />
                                                        )}
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => openEdit(user)}>
                                                        <Edit2 className="mr-2 h-4 w-4" />
                                                        Edit User
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        onClick={() => toggleStatus(user)}
                                                        className={user.status === "ACTIVE" ? "text-destructive focus:text-destructive" : "text-emerald-600 focus:text-emerald-600"}
                                                    >
                                                        {user.status === "ACTIVE" ? (
                                                            <><PowerOff className="mr-2 h-4 w-4" />Deactivate</>
                                                        ) : (
                                                            <><Power className="mr-2 h-4 w-4" />Activate</>
                                                        )}
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer row */}
                {!isLoading && filteredUsers.length > 0 && (
                    <div className="px-4 py-3 bg-muted/20 border-t border-border/50 text-xs text-muted-foreground">
                        Showing {filteredUsers.length} of {users.length} users
                    </div>
                )}
            </div>

            {/* ── Drawers ────────────────────────────────────────────────────── */}
            <UserDrawer
                open={drawerOpen}
                onClose={closeDrawer}
                editingUser={editingUser}
                users={users}
                roles={roles}
                onSaved={loadData}
            />

            <UserDetailPanel
                user={viewingUser}
                roles={roles}
                users={users}
                onClose={() => setViewingUser(null)}
                onEdit={() => {
                    setViewingUser(null);
                    openEdit(viewingUser!);
                }}
            />
        </div>
    );
};
