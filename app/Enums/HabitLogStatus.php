<?php

namespace App\Enums;

enum HabitLogStatus: string
{
    case Completed = 'completed';
    case Skipped = 'skipped';
    case Failed = 'failed';
}
