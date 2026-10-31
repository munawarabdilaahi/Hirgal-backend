<?php

namespace App\Enums;

enum UserRole: string
{
    case SystemAdmin = 'system-admin';
    case ProjectManager = 'project-manager';
    case TeamLeader = 'team-leader';
    case Member = 'member';

    public function label(): string
    {
        return match ($this) {
            self::SystemAdmin => 'System Admin',
            self::ProjectManager => 'Project Manager',
            self::TeamLeader => 'Team Leader',
            self::Member => 'Member',
        };
    }
}
