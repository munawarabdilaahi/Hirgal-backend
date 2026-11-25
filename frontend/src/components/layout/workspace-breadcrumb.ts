const workspaceLabels: Record<string, string> = {
  activity: 'Activity',
  appointments: 'Appointments',
  'change-password': 'Change password',
  dashboard: 'Dashboard',
  habits: 'Habits',
  'my-work': 'My work',
  notifications: 'Follow-up inbox',
  profile: 'Profile',
  projects: 'Projects',
  tasks: 'Tasks',
  teams: 'Teams',
  users: 'People & access',
};

const recordLabels: Record<string, string> = {
  habits: 'Habit',
  projects: 'Project',
  teams: 'Team',
  users: 'User',
};

export function workspaceBreadcrumb(pathname: string): string {
  const [, section = '', record, action] = pathname.split('/');
  const entity = recordLabels[section];
  if (entity && record) {
    if (record === 'new') return `Create ${entity.toLowerCase()}`;
    if (action === 'edit') return `Edit ${entity.toLowerCase()}`;
    return `${entity} details`;
  }
  return workspaceLabels[section] ?? 'Workspace';
}
