<?php

namespace App\Enums;

enum ProjectMemberRole: string
{
    case Owner = 'owner';
    case Lead = 'lead';
    case Member = 'member';
    case Viewer = 'viewer';
}
