<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/** Partial update: only the fields sent are validated and changed. */
class UpdateEventRequest extends FormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->is_admin;
    }

    public function rules(): array
    {
        return [
            'title' => ['sometimes', 'required', 'string', 'max:150'],
            'description' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'venue' => ['sometimes', 'nullable', 'string', 'max:150'],
            'event_date' => ['sometimes', 'required', 'date_format:Y-m-d', 'after_or_equal:today'],
            'start_time' => ['sometimes', 'nullable', 'date_format:H:i'],
            'max_attendees' => ['sometimes', 'required', 'integer', 'min:1', 'max:100000'],
        ];
    }
}
