<?php

namespace App\Console\Commands;

use App\Enums\AccountStatus;
use App\Enums\UserRole;
use App\Models\Role;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;

class BootstrapAdmin extends Command
{
    protected $signature = 'hirgal:bootstrap-admin';

    protected $description = 'Interactively create the first system administrator';

    public function handle(): int
    {
        if (! $this->input->isInteractive()) {
            $this->error('This command requires an interactive terminal.');

            return self::FAILURE;
        }

        $name = $this->ask('Administrator name');
        $email = $this->ask('Administrator email');
        $password = $this->secret('Administrator password (at least 12 characters)');
        $confirmation = $this->secret('Confirm password');

        $validator = Validator::make(compact('name', 'email', 'password'), [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255'],
            'password' => ['required', 'string', Password::min(12)],
        ]);

        if ($validator->fails() || $password !== $confirmation) {
            $this->error('Invalid details or passwords do not match. No account was created.');

            return self::FAILURE;
        }

        return DB::transaction(function () use ($name, $email, $password): int {
            $role = Role::query()->where('slug', UserRole::SystemAdmin->value)->lockForUpdate()->first();

            if ($role === null) {
                $this->error('System administrator role is missing. Seed the core roles and permissions first.');

                return self::FAILURE;
            }

            if ($role->userRoles()->exists() || User::withTrashed()->where('email', $email)->exists()) {
                $this->error('An administrator already exists or the email is already in use.');

                return self::FAILURE;
            }

            $user = User::create([
                'name' => $name,
                'email' => $email,
                'password' => $password,
                'account_status' => AccountStatus::Active,
                'timezone' => 'UTC',
            ]);
            $user->profile()->create([]);
            $user->roles()->attach($role->id);

            $this->info('Administrator created. Sign in and enable two-factor authentication.');

            return self::SUCCESS;
        }, 3);
    }
}
