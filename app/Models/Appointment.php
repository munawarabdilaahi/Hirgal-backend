<?php

namespace App\Models;

use App\Enums\AppointmentLocationType;
use App\Enums\AppointmentStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class Appointment extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'uuid',
        'organizer_id',
        'project_id',
        'team_id',
        'title',
        'description',
        'timezone',
        'start_time',
        'end_time',
        'location_type',
        'meeting_link',
        'location_address',
        'status',
        'cancelled_at',
        'cancelled_by',
    ];

    protected function casts(): array
    {
        return [
            'status' => AppointmentStatus::class,
            'location_type' => AppointmentLocationType::class,
            'start_time' => 'datetime',
            'end_time' => 'datetime',
            'cancelled_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }

    public function organizer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'organizer_id');
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    public function cancelledBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cancelled_by');
    }

    public function participants(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'appointment_participants')
            ->withPivot('status', 'response_notes', 'responded_at')
            ->withTimestamps();
    }

    public function participantRecords(): HasMany
    {
        return $this->hasMany(AppointmentParticipant::class);
    }
}
