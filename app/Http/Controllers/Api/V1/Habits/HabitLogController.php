<?php

namespace App\Http\Controllers\Api\V1\Habits;

use App\Actions\Habits\LogHabitProgressAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Habits\ListHabitLogsRequest;
use App\Http\Requests\Api\V1\Habits\StoreHabitLogRequest;
use App\Http\Resources\Api\V1\HabitLogResource;
use App\Models\HabitLog;
use App\Services\Habit\HabitService;
use App\Services\Habit\HabitStreakService;
use App\Support\ApiResponse;
use Carbon\Carbon;
use Carbon\Exceptions\InvalidFormatException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class HabitLogController extends Controller
{
    public function __construct(
        protected HabitService $habitService,
        protected HabitStreakService $streakService,
        protected LogHabitProgressAction $logAction,
    ) {}

    /**
     * List paginated logs for a specific habit with optional date range and status filters.
     */
    public function index(ListHabitLogsRequest $request, string $uuid): JsonResponse
    {
        $habit = $this->habitService->resolveHabit($request->user(), $uuid);
        $filters = $request->validated();

        $query = $habit->logs()->orderBy('logged_date', 'desc');

        if (isset($filters['from'])) {
            $query->where('logged_date', '>=', $filters['from']);
        }
        if (isset($filters['to'])) {
            $query->where('logged_date', '<=', $filters['to']);
        }
        if (isset($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        $paginator = $query->paginate((int) ($filters['per_page'] ?? 15));

        return ApiResponse::success(
            data: HabitLogResource::collection($paginator->items()),
            message: 'Habit logs retrieved successfully.',
            meta: [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ]
        );
    }

    /**
     * Record or update daily check-in log for a habit.
     */
    public function store(StoreHabitLogRequest $request, string $uuid): JsonResponse
    {
        $habit = $this->habitService->resolveHabit($request->user(), $uuid);
        $log = $this->logAction->execute($request->user(), $habit, $request->validated());
        $stats = $this->streakService->calculateStats($habit, null, $request->user()->timezone);

        return ApiResponse::success(
            data: [
                'log' => new HabitLogResource($log),
                'stats' => $stats,
            ],
            message: 'Habit check-in recorded successfully.',
            status: Response::HTTP_OK
        );
    }

    /**
     * Delete a habit log for a specific date.
     */
    public function destroy(Request $request, string $uuid, string $date): JsonResponse
    {
        $habit = $this->habitService->resolveHabit($request->user(), $uuid);

        $userTz = $request->user()->timezone ?: 'UTC';

        try {
            $parsedDate = Carbon::createFromFormat('Y-m-d', $date, $userTz);
        } catch (InvalidFormatException) {
            $parsedDate = null;
        }

        if ($parsedDate === null || $parsedDate->format('Y-m-d') !== $date) {
            return ApiResponse::error(
                'Invalid date format. Expected YYYY-MM-DD.',
                Response::HTTP_UNPROCESSABLE_ENTITY,
                errorCode: 'VALIDATION_ERROR'
            );
        }

        $minAllowedDate = Carbon::now($userTz)->startOfDay()->subDays(30);

        if ($parsedDate->lt($minAllowedDate)) {
            return ApiResponse::error(
                'Cannot remove habit check-in older than 30 days.',
                Response::HTTP_UNPROCESSABLE_ENTITY,
                errorCode: 'VALIDATION_ERROR'
            );
        }

        /** @var HabitLog|null $log */
        $log = $habit->logs()->whereDate('logged_date', $parsedDate->format('Y-m-d'))->first();

        if ($log !== null) {
            $log->delete();
        }

        return ApiResponse::success(
            data: null,
            message: 'Habit check-in removed successfully.'
        );
    }
}
