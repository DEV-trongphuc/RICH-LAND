<?php
// backend/utils/TOTP.php

class TOTP {
    private static string $base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

    /**
     * Generate a random Base32 secret key for TOTP (default 16 chars = 80 bits)
     */
    public static function generateSecret(int $length = 16): string {
        $secret = '';
        for ($i = 0; $i < $length; $i++) {
            $secret .= self::$base32Chars[random_int(0, 31)];
        }
        return $secret;
    }

    /**
     * Calculate 6-digit TOTP code for a given secret at a specific time step
     */
    public static function getCode(string $secret, ?int $timeStep = null): string {
        if ($timeStep === null) {
            $timeStep = (int)floor(time() / 30);
        }

        $secretBin = self::base32Decode($secret);
        
        // Pack time step into 64-bit big-endian binary string
        $timeBin = pack('N*', 0) . pack('N*', $timeStep);

        // HMAC-SHA1
        $hash = hash_hmac('sha1', $timeBin, $secretBin, true);

        // Dynamic truncation
        $offset = ord($hash[strlen($hash) - 1]) & 0x0F;
        $truncatedHash = (
            ((ord($hash[$offset]) & 0x7F) << 24) |
            ((ord($hash[$offset + 1]) & 0xFF) << 16) |
            ((ord($hash[$offset + 2]) & 0xFF) << 8) |
            (ord($hash[$offset + 3]) & 0xFF)
        );

        $code = $truncatedHash % 1000000;
        return str_pad((string)$code, 6, '0', STR_PAD_LEFT);
    }

    /**
     * Verify a 6-digit TOTP code against a secret key (allows ±1 step = 30s window drift)
     */
    public static function verifyCode(string $secret, string $code, int $discrepancy = 1): bool {
        $currentTimeStep = (int)floor(time() / 30);

        for ($i = -$discrepancy; $i <= $discrepancy; $i++) {
            $calculatedCode = self::getCode($secret, $currentTimeStep + $i);
            if (hash_equals($calculatedCode, trim($code))) {
                return true;
            }
        }

        return false;
    }

    /**
     * Get otpauth:// URL for generating QR codes
     */
    public static function getOtpAuthUrl(string $label, string $secret, string $issuer = 'RichLand'): string {
        $encodedLabel = rawurlencode($issuer . ':' . $label);
        $encodedIssuer = rawurlencode($issuer);
        return "otpauth://totp/{$encodedLabel}?secret={$secret}&issuer={$encodedIssuer}&algorithm=SHA1&digits=6&period=30";
    }

    /**
     * Decode a Base32 string to binary
     */
    private static function base32Decode(string $base32): string {
        $base32 = strtoupper($base32);
        $binary = '';
        $buffer = 0;
        $bitsLeft = 0;

        for ($i = 0; $i < strlen($base32); $i++) {
            $char = $base32[$i];
            $position = strpos(self::$base32Chars, $char);
            if ($position === false) continue;

            $buffer = ($buffer << 5) | $position;
            $bitsLeft += 5;

            if ($bitsLeft >= 8) {
                $bitsLeft -= 8;
                $binary .= chr(($buffer >> $bitsLeft) & 0xFF);
            }
        }

        return $binary;
    }
}
