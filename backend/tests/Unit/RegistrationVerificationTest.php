<?php

namespace Tests\Unit;

use App\Models\Registration;
use App\Models\RegistrationVerification;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/** Pure logic — no framework boot, no database. */
class RegistrationVerificationTest extends TestCase
{
    public static function emails(): array
    {
        return [
            'normal' => ['jane@example.com', 'j***@example.com'],
            'short local part' => ['ab@x.io', 'a**@x.io'],
            'single char' => ['a@x.io', 'a**@x.io'],
            'long' => ['meiling@test.com', 'm******@test.com'],
        ];
    }

    #[DataProvider('emails')]
    public function test_masked_email_hides_the_local_part(string $email, string $expected): void
    {
        $verification = new RegistrationVerification(['email' => $email]);

        $this->assertSame($expected, $verification->maskedEmail());
    }

    public function test_cancel_token_hash_is_sha256_and_not_the_token(): void
    {
        $hash = Registration::hashToken('secret-token');

        $this->assertSame(64, strlen($hash));
        $this->assertSame(hash('sha256', 'secret-token'), $hash);
        $this->assertNotSame(Registration::hashToken('other-token'), $hash);
    }
}
