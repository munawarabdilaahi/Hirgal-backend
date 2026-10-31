<?php

namespace App\Enums;

enum HabitFrequency: string
{
    case Daily = 'daily';
    case Weekly = 'weekly';
    case Custom = 'custom';
}
