<?php

namespace Tests\Feature\Appointments;

use App\Enums\ParticipantStatus;
use App\Models\ActivityLog;
use App\Models\Appointment;
use App\Models\AppointmentParticipant;
use App\Models\Permission;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\Role;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use App\Models\UserProfile;
use App\Notifications\AppointmentNotification;
<<<<<<< HEAD
use Carbon\CarbonImmutable;
=======
use Carbon\Carbon;
>>>>>>> a8d9dc0 (test(appointments): update API feature tests)
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Notifications\SendQueuedNotifications;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class AppointmentApiTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Pin the clock before the fixed 2026-11-08 fixture dates so lifecycle rules stay deterministic.
     */
    protected function setUp(): void
    {
        parent::setUp();

        $this->travelTo(CarbonImmutable::parse('2026-11-01 00:00:00', 'UTC'));
    }

    public function test_personal_appointment_stores_utc_time_and_returns_conflict_warnings_without_rejection(): void
    {
        $organizer = $this->userWithPermissions(['appointments.create', 'appointments.view', 'appointments.update']);
        $this->actingAs($organizer, 'sanctum');

        $first = $this->postJson('/api/v1/appointments', $this->payload());
        $first->assertCreated()->assertJsonPath('data.appointment.start_time', '2026-11-08T07:00:00Z');

        $second = $this->postJson('/api/v1/appointments', $this->payload([
            'start_time' => '2026-11-08T10:30:00+03:00',
            'end_time' => '2026-11-08T11:30:00+03:00',
        ]));
        $second->assertCreated()->assertJsonPath('data.conflicts.has_conflicts', true);
        $this->assertDatabaseCount('appointments', 2);
    }

    public function test_private_personal_appointment_is_not_visible_to_an_unrelated_system_admin(): void
    {
        $owner = $this->userWithPermissions(['appointments.create', 'appointments.view']);
        $appointment = Appointment::factory()->create(['organizer_id' => $owner->id]);
        $administrator = $this->userWithPermissions(['appointments.admin.view'], 'system-admin');

        $this->actingAs($administrator, 'sanctum')
            ->getJson('/api/v1/appointments/'.$appointment->uuid)
            ->assertNotFound();
    }

    public function test_project_organizer_who_loses_project_membership_cannot_update_the_event(): void
    {
        $organizer = $this->userWithPermissions(['appointments.update']);
        $owner = User::factory()->create();
        $project = Project::factory()->create(['owner_id' => $owner->id]);
        $membership = ProjectMember::factory()->create(['project_id' => $project->id, 'user_id' => $organizer->id]);
        $appointment = Appointment::factory()->create(['organizer_id' => $organizer->id, 'project_id' => $project->id]);
        $membership->delete();

        $this->actingAs($organizer, 'sanctum')
            ->putJson('/api/v1/appointments/'.$appointment->uuid, ['title' => 'Out of scope update'])
            ->assertNotFound();
    }

    public function test_system_admin_without_the_explicit_support_permission_cannot_use_admin_view(): void
    {
        $owner = User::factory()->create();
        $appointment = Appointment::factory()->create(['organizer_id' => $owner->id]);
        $administrator = $this->userWithPermissions(['appointments.view'], 'system-admin');

        $this->actingAs($administrator, 'sanctum')
            ->postJson('/api/v1/appointments/admin/'.$appointment->uuid.'/view', ['reason' => 'Support investigation'])
            ->assertForbidden();
        $this->assertDatabaseMissing('activity_logs', ['action' => 'appointment.admin.view']);
    }

    public function test_administrative_appointment_access_requires_permission_reason_and_writes_audit_record(): void
    {
        $owner = $this->userWithPermissions(['appointments.create']);
        $appointment = Appointment::factory()->create(['organizer_id' => $owner->id]);
        $administrator = $this->userWithPermissions(['appointments.admin.view'], 'system-admin');

        $this->actingAs($administrator, 'sanctum')
            ->postJson('/api/v1/appointments/admin/'.$appointment->uuid.'/view', ['reason' => 'Customer support investigation'])
            ->assertOk()
            ->assertJsonPath('data.uuid', $appointment->uuid);

        $this->assertDatabaseHas('activity_logs', [
            'user_id' => $administrator->id,
            'action' => 'appointment.admin.view',
            'subject_id' => $appointment->id,
        ]);
        $this->assertSame('read_only', ActivityLog::query()->where('user_id', $administrator->id)->firstOrFail()->properties['access_mode']);
    }

    public function test_only_the_invited_user_can_submit_their_own_rsvp(): void
    {
        $organizer = User::factory()->create();
        $invitee = $this->userWithPermissions(['appointments.view']);
        $otherUser = $this->userWithPermissions(['appointments.view']);
        $appointment = Appointment::factory()->create(['organizer_id' => $organizer->id]);
        AppointmentParticipant::factory()->create(['appointment_id' => $appointment->id, 'user_id' => $invitee->id]);

        $this->actingAs($otherUser, 'sanctum')
            ->putJson('/api/v1/appointments/'.$appointment->uuid.'/rsvp', ['status' => 'accepted'])
            ->assertNotFound();

        $this->actingAs($invitee, 'sanctum')
            ->putJson('/api/v1/appointments/'.$appointment->uuid.'/rsvp', ['status' => 'accepted'])
            ->assertOk()
            ->assertJsonPath('data.participant.status', ParticipantStatus::Accepted->value);
        $this->assertNotNull(AppointmentParticipant::query()->where('appointment_id', $appointment->id)->where('user_id', $invitee->id)->value('responded_at'));
    }

    public function test_store_rejects_two_contexts_and_timezone_offset_mismatch(): void
    {
        $organizer = $this->userWithPermissions(['appointments.create']);
        $this->actingAs($organizer, 'sanctum');

        $this->postJson('/api/v1/appointments', $this->payload(['project_uuid' => fake()->uuid(), 'team_uuid' => fake()->uuid()]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('project_uuid');

        $this->postJson('/api/v1/appointments', $this->payload(['start_time' => '2026-11-08T10:00:00+02:00']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('start_time');
    }

    public function test_project_appointment_requires_project_lead_authority_and_limits_invites_to_members(): void
    {
        $owner = $this->userWithPermissions(['appointments.create', 'appointments.view']);
        $project = Project::factory()->create(['owner_id' => $owner->id]);
        $member = User::factory()->create();
        ProjectMember::factory()->create(['project_id' => $project->id, 'user_id' => $member->id]);
        $outsider = User::factory()->create();

        $this->actingAs($owner, 'sanctum')
            ->postJson('/api/v1/appointments', $this->payload(['project_uuid' => $project->uuid, 'participants' => [$member->id]]))
            ->assertCreated()
            ->assertJsonPath('data.appointment.context.type', 'project');

        $this->postJson('/api/v1/appointments', $this->payload(['project_uuid' => $project->uuid, 'participants' => [$outsider->id]]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('participants');
    }

    public function test_project_lead_member_can_create_project_appointment_but_plain_member_cannot(): void
    {
        $project = Project::factory()->create();
        $lead = $this->userWithPermissions(['appointments.create', 'appointments.view']);
        ProjectMember::factory()->create(['project_id' => $project->id, 'user_id' => $lead->id, 'role' => 'lead']);
        $member = $this->userWithPermissions(['appointments.create', 'appointments.view']);
        ProjectMember::factory()->create(['project_id' => $project->id, 'user_id' => $member->id, 'role' => 'member']);

        $this->actingAs($lead, 'sanctum')
            ->postJson('/api/v1/appointments', $this->payload(['project_uuid' => $project->uuid]))
            ->assertCreated();

        $this->actingAs($member, 'sanctum')
            ->postJson('/api/v1/appointments', $this->payload(['project_uuid' => $project->uuid]))
            ->assertNotFound();
    }

    public function test_team_roster_leader_can_create_team_appointment_but_plain_member_cannot(): void
    {
        $team = Team::factory()->create();
        $rosterLeader = $this->userWithPermissions(['appointments.create', 'appointments.view']);
        TeamMember::factory()->create(['team_id' => $team->id, 'user_id' => $rosterLeader->id, 'role' => 'leader']);
        $member = $this->userWithPermissions(['appointments.create', 'appointments.view']);
        TeamMember::factory()->create(['team_id' => $team->id, 'user_id' => $member->id, 'role' => 'member']);

        $this->actingAs($rosterLeader, 'sanctum')
            ->postJson('/api/v1/appointments', $this->payload(['team_uuid' => $team->uuid]))
            ->assertCreated();

        $this->actingAs($member, 'sanctum')
            ->postJson('/api/v1/appointments', $this->payload(['team_uuid' => $team->uuid]))
            ->assertNotFound();
    }

    public function test_calendar_requires_a_bounded_range(): void
    {
        $user = $this->userWithPermissions(['appointments.view']);

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/v1/appointments/calendar')
            ->assertUnprocessable();
    }

    public function test_removed_participant_history_is_preserved_on_reinvitation(): void
    {
        $organizer = $this->userWithPermissions(['appointments.create', 'appointments.update']);
        $invitee = $this->userWithPermissions(['appointments.view']);
        $this->actingAs($organizer, 'sanctum')
            ->postJson('/api/v1/appointments', $this->payload(['participants' => [$invitee->id]]))
            ->assertCreated();
        $appointment = Appointment::query()->firstOrFail();

        $this->actingAs($invitee, 'sanctum')
            ->putJson('/api/v1/appointments/'.$appointment->uuid.'/rsvp', ['status' => 'accepted'])
            ->assertOk();

        $this->actingAs($organizer, 'sanctum')
            ->deleteJson('/api/v1/appointments/'.$appointment->uuid.'/participants/'.$invitee->id)
            ->assertOk();
        $this->postJson('/api/v1/appointments/'.$appointment->uuid.'/participants', ['user_id' => $invitee->id])
            ->assertCreated()
            ->assertJsonPath('data.participant.status', 'pending');

        $participant = AppointmentParticipant::query()->where('appointment_id', $appointment->id)->where('user_id', $invitee->id)->firstOrFail();
        $this->assertSame('accepted', $participant->response_history[0]['status']);
        $this->assertNotNull($participant->response_history[0]['responded_at']);
        $this->assertNull($participant->removed_at);
    }

    public function test_appointment_notifications_respect_existing_channel_preferences(): void
    {
        $organizer = User::factory()->create();
        $appointment = Appointment::factory()->create(['organizer_id' => $organizer->id]);
        $recipient = User::factory()->create();
        UserProfile::factory()->create(['user_id' => $recipient->id, 'notification_preferences' => ['email' => false, 'in_app' => true]]);
        $notification = new AppointmentNotification($appointment, 'invitation');

        $this->assertSame(['database'], $notification->via($recipient));
        $this->assertSame($appointment->uuid, $notification->toArray($recipient)['appointment_uuid']);
    }

    public function test_invitation_notifications_wait_for_outer_transaction_commit(): void
    {
        Queue::fake();
        $organizer = $this->userWithPermissions(['appointments.create']);
        $invitee = User::factory()->create();
        DB::transaction(function () use ($organizer, $invitee): void {
            $this->actingAs($organizer, 'sanctum')
                ->postJson('/api/v1/appointments', $this->payload(['participants' => [$invitee->id]]))
                ->assertCreated();
            Queue::assertNothingPushed();
        });
        Queue::assertPushed(SendQueuedNotifications::class);
    }

    public function test_invitation_notifications_are_discarded_when_the_transaction_rolls_back(): void
    {
        Queue::fake();
        $organizer = $this->userWithPermissions(['appointments.create']);
        $invitee = User::factory()->create();

        try {
            DB::transaction(function () use ($organizer, $invitee): void {
                $this->actingAs($organizer, 'sanctum')
                    ->postJson('/api/v1/appointments', $this->payload(['participants' => [$invitee->id]]))
                    ->assertCreated();
                throw new \RuntimeException('Roll back the outer transaction.');
            });
        } catch (\RuntimeException $exception) {
            $this->assertSame('Roll back the outer transaction.', $exception->getMessage());
        }

        Queue::assertNothingPushed();
    }

    public function test_explicit_offset_disambiguates_fall_back_time_and_nonexistent_dst_time_is_rejected(): void
    {
        $organizer = $this->userWithPermissions(['appointments.create']);
        $this->actingAs($organizer, 'sanctum');

        $this->postJson('/api/v1/appointments', $this->payload([
            'timezone' => 'America/New_York',
            'start_time' => '2026-11-01T01:30:00-04:00',
            'end_time' => '2026-11-01T01:30:00-05:00',
        ]))->assertCreated()->assertJsonPath('data.appointment.start_time', '2026-11-01T05:30:00Z');

        $this->postJson('/api/v1/appointments', $this->payload([
            'timezone' => 'America/New_York',
            'start_time' => '2026-03-08T02:30:00-05:00',
            'end_time' => '2026-03-08T03:30:00-04:00',
        ]))->assertUnprocessable()->assertJsonValidationErrors('start_time');
    }

    public function test_team_appointment_requires_team_leader_authority_and_limits_invites_to_members(): void
    {
        $leader = $this->userWithPermissions(['appointments.create', 'appointments.view']);
        $team = Team::factory()->create(['leader_id' => $leader->id]);
        $member = User::factory()->create();
        TeamMember::factory()->create(['team_id' => $team->id, 'user_id' => $member->id]);
        $outsider = User::factory()->create();

        $this->actingAs($leader, 'sanctum')
            ->postJson('/api/v1/appointments', $this->payload(['team_uuid' => $team->uuid, 'participants' => [$member->id]]))
            ->assertCreated()
            ->assertJsonPath('data.appointment.context.type', 'team');

        $this->postJson('/api/v1/appointments', $this->payload(['team_uuid' => $team->uuid, 'participants' => [$outsider->id]]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('participants');

        $otherUser = $this->userWithPermissions(['appointments.create', 'appointments.view']);
        $this->actingAs($otherUser, 'sanctum')
            ->postJson('/api/v1/appointments', $this->payload(['team_uuid' => $team->uuid]))
            ->assertNotFound();
    }

    public function test_appointment_cancellation_and_soft_deletion_lifecycle(): void
    {
        $organizer = $this->userWithPermissions(['appointments.create', 'appointments.update', 'appointments.delete', 'appointments.view']);
        $this->actingAs($organizer, 'sanctum');

        $created = $this->postJson('/api/v1/appointments', $this->payload())->assertCreated();
        $uuid = $created->json('data.appointment.uuid');

        $cancelResponse = $this->postJson('/api/v1/appointments/'.$uuid.'/cancel')->assertOk();
        $cancelResponse->assertJsonPath('data.status', 'cancelled');
        $this->assertNotNull($cancelResponse->json('data.cancelled_at'));

        $this->postJson('/api/v1/appointments/'.$uuid.'/cancel')->assertUnprocessable();

        $deleteResponse = $this->deleteJson('/api/v1/appointments/'.$uuid)->assertOk();
        $this->assertSoftDeleted('appointments', ['uuid' => $uuid]);

        $appointment = Appointment::withTrashed()->where('uuid', $uuid)->firstOrFail();
        $this->assertNotNull($appointment->cancelled_at);
        $this->assertSame($organizer->id, $appointment->cancelled_by);
    }

    public function test_rescheduling_updates_times_and_recalculates_conflicts(): void
    {
        // Freeze the clock before the rescheduled end time (12:30 UTC) so the
        // completion-transition rejection does not depend on the wall clock.
        Carbon::setTestNow(Carbon::parse('2026-11-08 10:00:00', 'UTC'));

        try {
            $organizer = $this->userWithPermissions(['appointments.create', 'appointments.update', 'appointments.view']);
            $this->actingAs($organizer, 'sanctum');

            $first = $this->postJson('/api/v1/appointments', $this->payload([
                'start_time' => '2026-11-08T14:00:00+03:00',
                'end_time' => '2026-11-08T15:00:00+03:00',
            ]))->assertCreated();

            $second = $this->postJson('/api/v1/appointments', $this->payload([
                'start_time' => '2026-11-08T16:00:00+03:00',
                'end_time' => '2026-11-08T17:00:00+03:00',
            ]))->assertCreated();
            $secondUuid = $second->json('data.appointment.uuid');

            $rescheduled = $this->putJson('/api/v1/appointments/'.$secondUuid, [
                'start_time' => '2026-11-08T14:30:00+03:00',
                'end_time' => '2026-11-08T15:30:00+03:00',
            ])->assertOk();

            $rescheduled->assertJsonPath('data.conflicts.has_conflicts', true);

            $this->putJson('/api/v1/appointments/'.$secondUuid, [
                'status' => 'completed',
            ])->assertUnprocessable()->assertJsonValidationErrors('status');
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_conflict_detection_nuances_half_open_and_privacy(): void
    {
        $userA = $this->userWithPermissions(['appointments.create', 'appointments.view', 'appointments.update']);
        $userB = $this->userWithPermissions(['appointments.create', 'appointments.view']);
        $userC = $this->userWithPermissions(['appointments.create', 'appointments.view']);

        $this->actingAs($userA, 'sanctum');
        $this->postJson('/api/v1/appointments', $this->payload([
            'title' => 'Secret Personal Sync',
            'start_time' => '2026-11-08T10:00:00+03:00',
            'end_time' => '2026-11-08T11:00:00+03:00',
            'participants' => [$userB->id],
        ]))->assertCreated();
        $firstAppt = Appointment::query()->firstOrFail();

        $this->actingAs($userB, 'sanctum')
            ->putJson('/api/v1/appointments/'.$firstAppt->uuid.'/rsvp', ['status' => 'accepted'])
            ->assertOk();

        // Half-open interval: [11:00, 12:00) does NOT overlap [10:00, 11:00)
        $adjacent = $this->actingAs($userA, 'sanctum')->postJson('/api/v1/appointments', $this->payload([
            'start_time' => '2026-11-08T11:00:00+03:00',
            'end_time' => '2026-11-08T12:00:00+03:00',
        ]))->assertCreated();
        $adjacent->assertJsonPath('data.conflicts.has_conflicts', false);

        // User C invites User B to overlapping slot [10:30, 11:30)
        // User C has no access to User A's private appointment: warning must be present, but title/uuid hidden
        $this->actingAs($userC, 'sanctum');
        $overlapping = $this->postJson('/api/v1/appointments', $this->payload([
            'title' => 'User C meeting',
            'start_time' => '2026-11-08T10:30:00+03:00',
            'end_time' => '2026-11-08T11:30:00+03:00',
            'participants' => [$userB->id],
        ]))->assertCreated();

        $overlapping->assertJsonPath('data.conflicts.has_conflicts', true);
        $items = $overlapping->json('data.conflicts.items');
        $this->assertNotEmpty($items);
        $this->assertSame($userB->id, $items[0]['user_id']);
        $this->assertSame('participant_overlap', $items[0]['reason']);
        $this->assertArrayNotHasKey('title', $items[0]);
        $this->assertArrayNotHasKey('appointment_uuid', $items[0]);
    }

    public function test_rsvp_supports_declined_and_tentative_responses(): void
    {
        $organizer = $this->userWithPermissions(['appointments.create']);
        $invitee = $this->userWithPermissions(['appointments.view']);
        $appointment = Appointment::factory()->create(['organizer_id' => $organizer->id]);
        AppointmentParticipant::factory()->create(['appointment_id' => $appointment->id, 'user_id' => $invitee->id]);

        $this->actingAs($invitee, 'sanctum')
            ->putJson('/api/v1/appointments/'.$appointment->uuid.'/rsvp', ['status' => 'tentative'])
            ->assertOk()
            ->assertJsonPath('data.participant.status', 'tentative');

        $this->putJson('/api/v1/appointments/'.$appointment->uuid.'/rsvp', ['status' => 'declined'])
            ->assertOk()
            ->assertJsonPath('data.participant.status', 'declined');
    }

    public function test_calendar_and_listing_filter_by_context_and_status(): void
    {
        $user = $this->userWithPermissions(['appointments.create', 'appointments.view']);
        $project = Project::factory()->create(['owner_id' => $user->id]);

        $this->actingAs($user, 'sanctum');
        $this->postJson('/api/v1/appointments', $this->payload(['title' => 'Personal 1']))->assertCreated();
        $this->postJson('/api/v1/appointments', $this->payload(['title' => 'Project 1', 'project_uuid' => $project->uuid]))->assertCreated();

        $personalList = $this->getJson('/api/v1/appointments?context=personal')->assertOk();
        $this->assertSame(1, $personalList->json('meta.total'));
        $this->assertSame('personal', $personalList->json('data.0.context.type'));

        $projectList = $this->getJson('/api/v1/appointments?context=project')->assertOk();
        $this->assertSame(1, $projectList->json('meta.total'));
        $this->assertSame('project', $projectList->json('data.0.context.type'));

        $calendar = $this->getJson('/api/v1/appointments/calendar?from=2026-11-01T00:00:00Z&to=2026-11-30T00:00:00Z')->assertOk();
        $this->assertSame(2, $calendar->json('meta.total'));
    }

    /** @param array<int, string> $permissions */
    private function userWithPermissions(array $permissions, string $roleSlug = 'appointment-test-role'): User
    {
        $user = User::factory()->create();
        $role = Role::factory()->create(['slug' => $roleSlug === 'system-admin' ? $roleSlug : $roleSlug.'-'.$user->id]);
        $permissionIds = [];
        foreach ($permissions as $slug) {
            $permissionIds[] = Permission::query()->firstOrCreate(['slug' => $slug], [
                'name' => $slug,
                'module' => 'appointments',
                'description' => $slug,
            ])->id;
        }
        $role->permissions()->sync($permissionIds);
        $user->roles()->attach($role);

        return $user;
    }

    /** @param array<string, mixed> $overrides
     * @return array<string, mixed>
     */
    private function payload(array $overrides = []): array
    {
        return array_merge([
            'title' => 'Planning session',
            'timezone' => 'Africa/Mogadishu',
            'start_time' => '2026-11-08T10:00:00+03:00',
            'end_time' => '2026-11-08T11:00:00+03:00',
        ], $overrides);
    }
}
