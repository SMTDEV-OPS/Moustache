import { ProfileModel } from "../models/profile";

export async function ensureDefaultProfiles() {
  const count = await ProfileModel.countDocuments();
  if (count > 0) {
    console.log('Profiles already seeded.');
    return;
  }

  const allModules = [
    'leads','users','roles','reports','accounts','contacts',
    'properties','tasks','tickets','guests','reservations',
    'communications','quotations','payment-links','workflows',
    'templates','knowledge-base','pms','regions','groups',
    'assignment-rules','notifications','email','buddies'
  ];

  const setupKeys = [
    'settings.manage', 'users.manage', 'roles.manage', 'reports.manage'
  ];

  // Admin — full access
  await ProfileModel.create({
    name: 'Admin',
    description: 'Full system access',
    isSystemProfile: true,
    modulePermissions: allModules.map(m => ({
      module: m, view: true, create: true, edit: true, delete: true
    })),
    setupPermissions: setupKeys.map(k => ({ key: k, enabled: true }))
  });

  // Sales Executive — leads + tasks only
  await ProfileModel.create({
    name: 'Sales Executive',
    description: 'Access to assigned leads and tasks',
    isSystemProfile: false,
    modulePermissions: allModules.map(m => ({
      module: m,
      view: ['leads','tasks','guests','communications','templates','knowledge-base'].includes(m),
      create: ['leads','tasks','communications'].includes(m),
      edit: ['leads','tasks'].includes(m),
      delete: false
    })),
    setupPermissions: setupKeys.map(k => ({ key: k, enabled: false }))
  });

  // Team Lead — everything except user/role management
  await ProfileModel.create({
    name: 'Team Lead',
    description: 'Team visibility and task assignment',
    isSystemProfile: false,
    modulePermissions: allModules.map(m => ({
      module: m,
      view: !['roles','regions','conglomerates'].includes(m),
      create: ['leads','tasks','communications','quotations'].includes(m),
      edit: ['leads','tasks','users'].includes(m),
      delete: ['tasks'].includes(m)
    })),
    setupPermissions: setupKeys.map(k => ({ 
      key: k, 
      enabled: ['reports.manage'].includes(k) 
    }))
  });

  // Manager
  await ProfileModel.create({
    name: 'Manager',
    description: 'Full leads access, user management',
    isSystemProfile: false,
    modulePermissions: allModules.map(m => ({
      module: m,
      view: true,
      create: true,
      edit: true,
      delete: ['leads','tasks','communications'].includes(m)
    })),
    setupPermissions: setupKeys.map(k => ({ 
      key: k, 
      enabled: ['settings.manage','users.manage','reports.manage'].includes(k) 
    }))
  });

  console.log('Default profiles seeded: Admin, Sales Executive, Team Lead, Manager');
}
