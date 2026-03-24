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
import { createProfile, getProfiles as listProfiles, updateProfile, deleteProfile, IProfile as Profile, IModulePermission, ISetupPermission } from "@/services/profiles";

// Derived from backend constants
const ALL_MODULES = [
  'leads','users','roles','reports','accounts','contacts',
  'properties','tasks','tickets','guests','reservations',
  'communications','quotations','payment-links','workflows',
  'templates','knowledge-base','pms','regions','groups',
  'assignment-rules','notifications','email','buddies'
];

// Must match backend constants/permissions.ts setup-level keys
const ALL_SETUP_KEYS = [
  "settings.manage", "users.manage", "roles.manage", "reports.manage",
  "groups.manage", "regions.manage", "assignment-rules.manage",
  "workflows.manage", "templates.manage", "knowledge-base.manage",
  "pms.manage", "notifications.manage", "buddies.manage",
  "conglomerates.manage", "account-potentials.manage", "hotel-brands.manage",
];

export const ProfileBuilder = () => {
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [profileName, setProfileName] = useState("");
  const [profileDescription, setProfileDescription] = useState("");
  
  // State for permissions
  const [modulePermissions, setModulePermissions] = useState<IModulePermission[]>([]);
  const [setupPermissions, setSetupPermissions] = useState<ISetupPermission[]>([]);
  
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
        modulePermissions: profile.modulePermissions || [],
        setupPermissions: profile.setupPermissions || [],
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
      
      const existingPerms = profile.modulePermissions || [];
      const mergedModules = ALL_MODULES.map(module => {
        const existing = existingPerms.find(p => p.module === module);
        return existing || { 
          module, view: false, create: false, 
          edit: false, delete: false 
        };
      });
      setModulePermissions(mergedModules);

      const existingSetup = profile.setupPermissions || [];
      const mergedSetup = ALL_SETUP_KEYS.map(key => {
        const existing = existingSetup.find(p => p.key === key);
        return existing || { key, enabled: false };
      });
      setSetupPermissions(mergedSetup);
    } else {
      setEditingProfile(null);
      setProfileName("");
      setProfileDescription("");
      
      // Initialize empty permissions
      setModulePermissions(ALL_MODULES.map(m => ({
        module: m,
        view: false,
        create: false,
        edit: false,
        delete: false
      })));
      
      setSetupPermissions(ALL_SETUP_KEYS.map(k => ({
        key: k,
        enabled: false
      })));
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingProfile(null);
    setProfileName("");
    setProfileDescription("");
    setModulePermissions([]);
    setSetupPermissions([]);
  };

  const handleModulePermChange = (modName: string, field: keyof Omit<IModulePermission, 'module'>, value: boolean) => {
    setModulePermissions(prev => prev.map(m => {
      if (m.module === modName) {
        return { ...m, [field]: value };
      }
      return m;
    }));
  };

  const handleSetupPermChange = (key: string, enabled: boolean) => {
    setSetupPermissions(prev => prev.map(s => {
      if (s.key === key) {
        return { ...s, enabled };
      }
      return s;
    }));
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

    const payload = {
      name: profileName.trim(),
      description: profileDescription.trim() || undefined,
      modulePermissions: modulePermissions.map((mp) => ({
        module: mp.module,
        view: !!mp.view,
        create: !!mp.create,
        edit: !!mp.edit,
        delete: !!mp.delete,
      })),
      setupPermissions: setupPermissions.map((sp) => ({
        key: sp.key,
        enabled: !!sp.enabled,
      })),
    };

    try {
      setIsSubmitting(true);

      if (editingProfile) {
        await updateProfile(editingProfile._id, payload);
        toast({
          title: "Success",
          description: "Profile updated successfully",
        });
      } else {
        await createProfile(payload);
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
          <p>Loading profiles...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-1 items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Error Loading Profiles</CardTitle>
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
          <h2 className="text-xl font-semibold">Profile Definition</h2>
          <p className="text-sm text-muted-foreground">
            Create and manage global profiles for the CRM. Profiles define feature-level permissions like create, edit, or delete actions for specific modules.
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Create Profile
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
                    <CardTitle className="flex items-center gap-2">
                        {profile.name}
                        {profile.isSystemProfile && <Badge variant="secondary">System</Badge>}
                    </CardTitle>
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
                    {!profile.isSystemProfile && (
                       <Button
                         variant="outline"
                         size="sm"
                         onClick={() => handleDelete(profile._id)}
                       >
                         <Trash2 className="h-4 w-4" />
                       </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingProfile ? "Edit Profile" : "Create Profile"}</DialogTitle>
            <DialogDescription>
              {editingProfile
                ? "Update the profile information and feature permissions."
                : "Define a new profile with feature-level module permissions."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 overflow-y-auto flex-1 pr-2 pb-4">
            
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="profile-name">Profile Name *</Label>
                  <Input
                    id="profile-name"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder="e.g. Sales Representative"
                    disabled={editingProfile?.isSystemProfile}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="profile-description">Description</Label>
                  <Textarea
                    id="profile-description"
                    value={profileDescription}
                    onChange={(e) => setProfileDescription(e.target.value)}
                    placeholder="Describe what this profile grants access to"
                    rows={2}
                    disabled={editingProfile?.isSystemProfile}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Module Permissions</h3>
              <p className="text-sm text-muted-foreground">Select the actions allowed for each module.</p>
              
              <div className="border rounded-md divide-y overflow-hidden max-h-[400px] overflow-y-auto">
                <div className="flex bg-muted/50 p-3 sticky top-0 font-medium text-sm">
                  <div className="flex-1">Module</div>
                  <div className="w-20 text-center">View</div>
                  <div className="w-20 text-center">Create</div>
                  <div className="w-20 text-center">Edit</div>
                  <div className="w-20 text-center">Delete</div>
                </div>
                {modulePermissions.map((modPerm) => (
                  <div key={modPerm.module} className="flex p-3 items-center hover:bg-muted/30">
                    <div className="flex-1 capitalize font-medium text-[14px] text-[#111827]">
                      {modPerm.module.replace("-", " ")}
                    </div>
                    <div className="w-20 flex justify-center">
                      <Checkbox 
                        checked={modPerm.view} 
                        disabled={editingProfile?.isSystemProfile}
                        onCheckedChange={(c) => handleModulePermChange(modPerm.module, 'view', !!c)} 
                      />
                    </div>
                    <div className="w-20 flex justify-center">
                      <Checkbox 
                        checked={modPerm.create} 
                        disabled={editingProfile?.isSystemProfile}
                        onCheckedChange={(c) => handleModulePermChange(modPerm.module, 'create', !!c)} 
                      />
                    </div>
                    <div className="w-20 flex justify-center">
                      <Checkbox 
                        checked={modPerm.edit} 
                        disabled={editingProfile?.isSystemProfile}
                        onCheckedChange={(c) => handleModulePermChange(modPerm.module, 'edit', !!c)} 
                      />
                    </div>
                    <div className="w-20 flex justify-center">
                      <Checkbox 
                        checked={modPerm.delete} 
                        disabled={editingProfile?.isSystemProfile}
                        onCheckedChange={(c) => handleModulePermChange(modPerm.module, 'delete', !!c)} 
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4 pt-4">
              <h3 className="text-lg font-semibold border-b pb-2">Setup & Admin Permissions</h3>
              <p className="text-sm text-muted-foreground">Check to grant management access to system settings.</p>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 border rounded-md p-4">
                {setupPermissions.map((setup) => (
                  <div key={setup.key} className="flex items-center space-x-2">
                    <Checkbox
                      id={`setup-${setup.key}`}
                      checked={setup.enabled}
                      disabled={editingProfile?.isSystemProfile}
                      onCheckedChange={(checked) => handleSetupPermChange(setup.key, !!checked)}
                    />
                    <label
                      htmlFor={`setup-${setup.key}`}
                      className="text-[13px] text-[#374151] font-medium leading-none cursor-pointer select-none"
                    >
                      {setup.key}
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
            {!editingProfile?.isSystemProfile && (
                <Button onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : editingProfile ? "Update Profile" : "Create Profile"}
                </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
