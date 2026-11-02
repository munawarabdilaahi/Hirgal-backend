<?php

namespace App\Http\Requests\Api\V1\Teams;

use App\Models\Team;
use App\Models\TeamMember;
use App\Policies\TeamPolicy;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class UpdateTeamMemberRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     *
     * Cross-scope access resolves as 404 before any ability check.
     */
    public function authorize(): bool
    {
        $actor = $this->user();
        $member = $this->route('member');

        if (! $actor || ! $member instanceof TeamMember) {
            return false;
        }

        $team = $member->team;

        if (! $team instanceof Team) {
            return false;
        }

        abort_unless(TeamPolicy::isWithinScope($actor, $team), 404);

        return $actor->can('update', [TeamMember::class, $member]);
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'role' => ['required', 'string', 'in:leader,member'],
        ];
    }
}
