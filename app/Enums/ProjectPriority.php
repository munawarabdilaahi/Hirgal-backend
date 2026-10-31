<?php

namespace App\Enums;

enum ProjectPriority: string
{
    case Urgent = 'urgent';
    case High = 'high';
    case Medium = 'medium';
    case Low = 'low';
}
