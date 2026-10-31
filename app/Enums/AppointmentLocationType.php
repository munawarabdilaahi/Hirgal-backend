<?php

namespace App\Enums;

enum AppointmentLocationType: string
{
    case Virtual = 'virtual';
    case InPerson = 'in_person';
}
