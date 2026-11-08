<?php

namespace App\Http\Controllers\Api\V1\Habits;

use App\Actions\Habits\CreateHabitAction;
use App\Actions\Habits\UpdateHabitAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Habits\DailyOverviewRequest;
use App\Http\Requests\Api\V1\Habits\ListHabitsRequest;
use App\Http\Requests\Api\V1\Habits\StoreHabitRequest;
use App\Http\Requests\Api\V1\Habits\UpdateHabitRequest;
use App\Http\Resources\Api\V1\HabitLogResource;
use App\Http\Resources\Api\V1\HabitResource;
use App\Models\Habit;
use App\Services\Habit\HabitService;
use App\Services\Habit\HabitStreakService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class HabitController extends Controller
{
    public function __construct(
        protected HabitService $habitService,
        protected HabitStreakService $streakService,
        protected CreateHabitAction $createAction,
        protected UpdateHabitAction $updateAction,
    ) {}

    /**
     * List user habits with pagination, filters, and streak summaries.
     */
    public function index(ListHabitsRequest $request): JsonResponse
    {
        $paginator = $this->habitService->list($request->user(), $request->validated());
        $userTz = $request->user()->timezone ?: 'UTC';

        $items = collect($paginator->items())->map(function (Habit $habit) use ($userTz): HabitResource {
            $stats = $this->streakService->calculateStats($habit, null, $userTz);

            return (new HabitResource($habit))->withStats($stats);
        });

        return ApiResponse::success(
            data: $items,
            message: 'Habits retrieved successfully.',
            meta: [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ]
        );
    }

    /**
     * Create a new habit.
     */
    public function store(StoreHabitRequest $request): JsonResponse
    {
        $habit = $this->createAction->execute($request->user(), $request->validated());
        $stats = $this->streakService->calculateStats($habit, null, $request->user()->timezone);

        return ApiResponse::success(
            data: (new HabitResource($habit))->withStats($stats),
            message: 'Habit created successfully.',
            status: Response::HTTP_CREATED
        );
    }

    /**
     * Show a habit with full streak statistics.
     */
    public function show(Request $request, string $uuid): JsonResponse
    {
        $habit = $this->habitService->resolveHabit($request->user(), $uuid);
        $habit->load(['logs' => fn ($q) => $q->latest('logged_date')->limit(30)]);
        $stats = $this->streakService->calculateStats($habit, null, $request->user()->timezone);

        return ApiResponse::success(
            data: (new HabitResource($habit))->withStats($stats),
            message: 'Habit retrieved successfully.'
        );
    }

    /**
     * Update an existing habit.
     */
    public function update(UpdateHabitRequest $request, string $uuid): JsonResponse
    {
        $habit = $this->habitService->resolveHabit($request->user(), $uuid);
        $updated = $this->updateAction->execute($habit, $request->validated());
        $stats = $this->streakService->calculateStats($updated, null, $request->user()->timezone);

        return ApiResponse::success(
            data: (new HabitResource($updated))->withStats($stats),
            message: 'Habit updated successfully.'
        );
    }

    /**
     * Archive a habit.
     */
    public function archive(Request $request, string $uuid): JsonResponse
    {
        $habit = $this->habitService->resolveHabit($request->user(), $uuid);
        $archived = $this->habitService->archive($request->user(), $habit);

        return ApiResponse::success(
            data: new HabitResource($archived),
            message: 'Habit archived successfully.'
        );
    }

    /**
     * Restore an archived habit.
     */
    public function restore(Request $request, string $uuid): JsonResponse
    {
        $habit = $this->habitService->resolveHabit($request->user(), $uuid);
        $restored = $this->habitService->restore($request->user(), $habit);

        return ApiResponse::success(
            data: new HabitResource($restored),
            message: 'Habit restored successfully.'
        );
    }

    /**
     * Soft-delete a habit.
     */
    public function destroy(Request $request, string $uuid): JsonResponse
    {
        $habit = $this->habitService->resolveHabit($request->user(), $uuid);
        $this->habitService->delete($request->user(), $habit);

        return ApiResponse::success(
            data: null,
            message: 'Habit deleted successfully.'
        );
    }

    /**
     * Get the daily check-in overview matrix for all active habits on a target date.
     */
    public function dailyOverview(DailyOverviewRequest $request): JsonResponse
    {
        $overview = $this->habitService->dailyOverview($request->user(), $request->validated('date'));

        $formatted = [
            'date' => $overview['date'],
            'timezone' => $overview['timezone'],
            'habits' => array_map(function (array $item): array {
                return [
                    'habit' => (new HabitResource($item['habit']))->withStats([
                        'current_streak' => $item['current_streak'],
                        'longest_streak' => $item['longest_streak'],
                    ]),
                    'is_scheduled' => $item['is_scheduled'],
                    'log' => $item['log'] ? new HabitLogResource($item['log']) : null,
                ];
            }, $overview['habits']),
        ];

        return ApiResponse::success(
            data: $formatted,
            message: 'Daily overview retrieved successfully.'
        );
    }
}
