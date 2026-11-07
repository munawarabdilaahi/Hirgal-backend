<?php

namespace App\Http\Controllers\Api\V1\Appointments;

use App\Enums\ParticipantStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Appointments\AdminViewAppointmentRequest;
use App\Http\Requests\Api\V1\Appointments\ListAppointmentsRequest;
use App\Http\Requests\Api\V1\Appointments\RespondToAppointmentRequest;
use App\Http\Requests\Api\V1\Appointments\StoreAppointmentParticipantRequest;
use App\Http\Requests\Api\V1\Appointments\StoreAppointmentRequest;
use App\Http\Requests\Api\V1\Appointments\UpdateAppointmentRequest;
use App\Http\Resources\Api\V1\AppointmentParticipantResource;
use App\Http\Resources\Api\V1\AppointmentResource;
use App\Models\Appointment;
use App\Models\AppointmentParticipant;
use App\Models\User;
use App\Services\Appointment\AppointmentService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AppointmentController extends Controller
{
    public function __construct(private readonly AppointmentService $appointments) {}

    public function index(ListAppointmentsRequest $request): JsonResponse
    {
        return $this->listResponse($request, false);
    }

    public function calendar(ListAppointmentsRequest $request): JsonResponse
    {
        return $this->listResponse($request, true);
    }

    private function listResponse(ListAppointmentsRequest $request, bool $calendar): JsonResponse
    {
        $paginator = $this->appointments->list($request->user(), $request->validated(), $calendar);

        return ApiResponse::success(
            data: AppointmentResource::collection($paginator->items()),
            message: 'Appointments retrieved successfully.',
            meta: ['current_page' => $paginator->currentPage(), 'last_page' => $paginator->lastPage(), 'per_page' => $paginator->perPage(), 'total' => $paginator->total()]
        );
    }

    public function store(StoreAppointmentRequest $request): JsonResponse
    {
        $result = $this->appointments->create($request->user(), $request->validated());

        return ApiResponse::success(
            data: ['appointment' => new AppointmentResource($result['appointment']), 'conflicts' => $result['conflicts']],
            message: 'Appointment created successfully.',
            status: Response::HTTP_CREATED
        );
    }

    public function show(Request $request, Appointment $appointment): JsonResponse
    {
        $appointment = $this->appointments->resolveVisible($appointment->uuid, $request->user());

        return ApiResponse::success(new AppointmentResource($appointment), 'Appointment retrieved successfully.');
    }

    public function update(UpdateAppointmentRequest $request, Appointment $appointment): JsonResponse
    {
        $result = $this->appointments->update($request->user(), $appointment, $request->validated());

        return ApiResponse::success(['appointment' => new AppointmentResource($result['appointment']), 'conflicts' => $result['conflicts']], 'Appointment updated successfully.');
    }

    public function cancel(Request $request, Appointment $appointment): JsonResponse
    {
        $appointment = $this->appointments->cancel($request->user(), $appointment);

        return ApiResponse::success(new AppointmentResource($appointment), 'Appointment cancelled successfully.');
    }

    public function destroy(Request $request, Appointment $appointment): JsonResponse
    {
        $this->appointments->delete($request->user(), $appointment);

        return ApiResponse::success(null, 'Appointment deleted successfully.');
    }

    public function participants(Request $request, Appointment $appointment): JsonResponse
    {
        $appointment = $this->appointments->resolveVisible($appointment->uuid, $request->user());
        $participants = AppointmentParticipant::query()->with('user')->where('appointment_id', $appointment->id)->whereNull('removed_at')->paginate(15);

        return ApiResponse::success(AppointmentParticipantResource::collection($participants->items()), 'Participants retrieved successfully.', meta: [
            'current_page' => $participants->currentPage(), 'last_page' => $participants->lastPage(), 'per_page' => $participants->perPage(), 'total' => $participants->total(),
        ]);
    }

    public function addParticipant(StoreAppointmentParticipantRequest $request, Appointment $appointment): JsonResponse
    {
        $invitee = User::query()->findOrFail($request->integer('user_id'));
        $result = $this->appointments->addParticipant($request->user(), $appointment, $invitee);

        return ApiResponse::success(['participant' => new AppointmentParticipantResource($result['participant']), 'conflicts' => $result['conflicts']], 'Participant invited successfully.', Response::HTTP_CREATED);
    }

    public function removeParticipant(Request $request, Appointment $appointment, string $user): JsonResponse
    {
        $invitee = User::query()->findOrFail(ctype_digit($user) ? (int) $user : 0);
        $this->appointments->removeParticipant($request->user(), $appointment, $invitee);

        return ApiResponse::success(null, 'Participant removed successfully.');
    }

    public function respond(RespondToAppointmentRequest $request, Appointment $appointment): JsonResponse
    {
        $result = $this->appointments->respond($request->user(), $appointment, ParticipantStatus::from($request->validated('status'))->value);

        return ApiResponse::success(['participant' => new AppointmentParticipantResource($result['participant']), 'conflicts' => $result['conflicts']], 'Response recorded successfully.');
    }

    public function adminShow(AdminViewAppointmentRequest $request, string $uuid): JsonResponse
    {
        // Authorize before resolving the UUID so unauthorized callers cannot probe appointment existence.
        $appointment = Appointment::query()->where('uuid', $uuid)->firstOrFail();
        $appointment = $this->appointments->auditedAdminView($request->user(), $appointment, $request->validated('reason'));

        return ApiResponse::success(new AppointmentResource($appointment), 'Audited administrative appointment view recorded.');
    }
}
