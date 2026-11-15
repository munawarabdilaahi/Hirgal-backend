import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/features/auth/auth-hooks';
import { hasPermission } from '@/features/auth/permissions';
import { HabitDetailsRoute } from './HabitDetailsRoute';
import { HabitFormDialog } from './HabitFormDialog';
import { HabitsRoute } from './HabitsRoute';

export function HabitFormRoute() {
  const { habitUuid } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const canManage = hasPermission(user, 'habits.manage');

  return (
    <>
      {canManage && (habitUuid ? <HabitDetailsRoute /> : <HabitsRoute />)}
      <HabitFormDialog
        {...(habitUuid ? { habitUuid } : {})}
        onClose={() => navigate(habitUuid ? `/habits/${habitUuid}` : '/habits', { replace: true })}
        onSaved={(uuid) => navigate(`/habits/${uuid}`, { replace: true })}
      />
    </>
  );
}
