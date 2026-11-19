<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreEventRequest extends FormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->is_admin;
    }

    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:150'],
            'description' => ['nullable', 'string', 'max:5000'],
            'venue' => ['nullable', 'string', 'max:150'],
            'event_date' => ['required', 'date_format:Y-m-d', 'after_or_equal:today'],
            'start_time' => ['nullable', 'date_format:H:i'],
            'max_attendees' => ['required', 'integer', 'min:1', 'max:100000'],
        ];
    }
}
