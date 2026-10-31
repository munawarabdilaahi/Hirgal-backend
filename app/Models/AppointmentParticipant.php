<?php

namespace App\Models;

use App\Enums\ParticipantStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AppointmentParticipant extends Model
{
    use HasFactory;

    protected $fillable = [
        'appointment_id',
        'user_id',
        'status',
        'response_notes',
        'responded_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => ParticipantStatus::class,
            'responded_at' => 'datetime',
        ];
    }

    public function appointment(): BelongsTo
    {
        return $this->belongsTo(Appointment::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
