<?php

namespace App\Services\Appointment;

use DateTimeImmutable;
use DateTimeZone;
use Illuminate\Validation\ValidationException;

class AppointmentTime
{
    /**
     * Parse an offset-bearing RFC3339 value and confirm its offset belongs to the supplied IANA zone.
     */
    public function parse(string $value, string $timezone, string $field): DateTimeImmutable
    {
        if (! in_array($timezone, DateTimeZone::listIdentifiers(DateTimeZone::ALL_WITH_BC), true)) {
            throw ValidationException::withMessages(['timezone' => ['A valid IANA timezone is required.']]);
        }

        $normalizedValue = str_ends_with($value, 'Z') ? substr($value, 0, -1).'+00:00' : $value;
        $dateTime = DateTimeImmutable::createFromFormat('!Y-m-d\TH:i:sP', $normalizedValue);
        $errors = DateTimeImmutable::getLastErrors();

        if ($dateTime === false || ($errors !== false && ($errors['warning_count'] > 0 || $errors['error_count'] > 0))) {
            throw ValidationException::withMessages([$field => ['Use an RFC3339 timestamp with seconds and an explicit UTC offset.']]);
        }

        $zone = new DateTimeZone($timezone);
        $expectedOffset = $zone->getOffset($dateTime);

        if ($dateTime->getOffset() !== $expectedOffset) {
            throw ValidationException::withMessages([$field => ['The timestamp offset does not match the supplied timezone.']]);
        }

        return $dateTime->setTimezone(new DateTimeZone('UTC'));
    }

    /**
     * Parse and validate both appointment endpoints.
     *
     * @return array{start_time: DateTimeImmutable, end_time: DateTimeImmutable}
     */
    public function parseRange(string $start, string $end, string $timezone): array
    {
        $startTime = $this->parse($start, $timezone, 'start_time');
        $endTime = $this->parse($end, $timezone, 'end_time');

        if ($endTime <= $startTime) {
            throw ValidationException::withMessages(['end_time' => ['The end time must be later than the start time.']]);
        }

        return ['start_time' => $startTime, 'end_time' => $endTime];
    }
}
