import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Edit } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createProfile, getProfiles as listProfiles, updateProfile, deleteProfile, IProfile as Profile } from "@/services/profiles";
import { listUsers, User } from "@/services/users";

const AVAILABLE_PERMISSIONS = [
  // User & admin
  "users.manage",
  "accounts.manage",
  "properties.manage",
  "regions.manage",
  "workflows.manage",
  "availability.upload",
  "reports.view",
  "callcenter.access",
  // Lead module – view scopes
  "leads.view.own",
  "leads.view.team",
  "leads.view.all",
  // Lead module – actions
  "leads.create",
  "leads.update",
  "leads.assign",
  "leads.delete",
  "leads.send.quotation",
  "leads.schedule.followup",
  "leads.send.email",
  // Lead module – full control
  "leads.manage",
  // Ticket module – view scopes
  "tickets.view.own",
  "tickets.view.team",
  "tickets.view.all",
  // Ticket module – actions
  "tickets.create",
  "tickets.update",
  "tickets.assign",
  "tickets.delete",
  "tickets.resolve",
  // Ticket module – full control
  "tickets.manage",
  // Buddy module
  "buddies.assign",
  "buddies.view.history",
  "buddies.view.reports",
] as const;

export const ProfileBuilder = () => {
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [profileName, setProfileName] = useState("");
  const [profileDescription, setProfileDescription] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const profilesData = await listProfiles();

      const normalizedProfiles = (profilesData || []).map((profile) => ({
        ...profile,
        permissions: Array.isArray(profile.permissions) ? profile.permissions : [],
      }));
      setProfiles(normalizedProfiles);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load data";
      setError(message);
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDialog = (profile?: Profile) => {
    if (profile) {
      setEditingProfile(profile);
      setProfileName(profile.name);
      setProfileDescription(profile.description || "");
      setSelectedPermissions(profile.permissions || []);
    } else {
      setEditingProfile(null);
      setProfileName("");
      setProfileDescription("");
      setSelectedPermissions([]);
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingProfile(null);
    setProfileName("");
    setProfileDescription("");
    setSelectedPermissions([]);
  };

  const handleSubmit = async () => {
    if (!profileName.trim()) {
      toast({
        title: "Error",
        description: "Profile name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);

      if (!selectedPermissions || selectedPermissions.length === 0) {
        toast({
          title: "Error",
          description: "Permissions are required",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      const permissions = selectedPermissions;

      if (editingProfile) {
        await updateProfile(editingProfile._id, {
          name: profileName.trim(),
          description: profileDescription.trim() || undefined,
          permissions,
        });
        toast({
          title: "Success",
          description: "Profile updated successfully",
        });
      } else {
        await createProfile({
          name: profileName.trim(),
          description: profileDescription.trim() || undefined,
          permissions,
        });
        toast({
          title: "Success",
          description: "Profile created successfully",
        });
      }
      handleCloseDialog();
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save profile";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (profileId: string) => {
    if (!confirm("Are you sure you want to delete this profile?")) return;
    try {
      await deleteProfile(profileId);
      toast({
        title: "Success",
        description: "Profile deleted successfully",
      });
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to delete profile";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p>Loading roles...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-1 items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Error Loading Roles</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button onClick={loadData} variant="outline">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Role Definition</h2>
          <p className="text-sm text-muted-foreground">
            Create and manage global roles for the CRM. Assign backend permissions,
            including detailed lead view and action permissions, to each role.
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Create Role
        </Button>
      </div>

      {profiles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">No profiles created yet</p>
            <Button onClick={() => handleOpenDialog()} className="mt-4">
              <Plus className="mr-2 h-4 w-4" />
              Create First Profile
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {profiles.map((profile) => (
            <Card key={profile._id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{profile.name}</CardTitle>
                    {profile.description && (
                      <CardDescription>{profile.description}</CardDescription>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenDialog(profile)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(profile._id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground mb-2 block">
                    Permissions
                  </Label>
                  {profile.permissions && profile.permissions.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {profile.permissions.map((perm) => (
                        <Badge key={perm} variant="secondary" className="text-xs">
                          {perm}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No permissions assigned</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingProfile ? "Edit Profile" : "Create Profile"}</DialogTitle>
            <DialogDescription>
              {editingProfile
                ? "Update the profile information and permissions."
                : "Define a new profile with backend permissions."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto flex-1 pr-2">
            <div className="space-y-2">
              <Label htmlFor="profile-name">Profile Name *</Label>
              <Input
                id="profile-name"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="Admin"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile-description">Description</Label>
              <Textarea
                id="profile-description"
                value={profileDescription}
                onChange={(e) => setProfileDescription(e.target.value)}
                placeholder="Describe what this profile can do"
                rows={3}
              />
            </div>

            <div className="space-y-3">
              <Label>Permissions *</Label>
              <p className="text-xs text-muted-foreground">
                These permissions will be granted to all users assigned this profile.
              </p>
              <div className="space-y-2 max-h-60 overflow-y-auto border rounded-md p-3">
                {AVAILABLE_PERMISSIONS.map((perm) => (
                  <div key={`perm-${perm}`} className="flex items-center space-x-2">
                    <Checkbox
                      id={`perm-${perm}`}
                      checked={selectedPermissions.includes(perm)}
                      onCheckedChange={(checked) => {
                        setSelectedPermissions((prev) =>
                          checked ? [...prev, perm] : prev.filter((p) => p !== perm),
                        );
                      }}
                    />
                    <label
                      htmlFor={`perm-${perm}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {perm}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : editingProfile ? "Update Profile" : "Create Profile"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};


