<?php
// f:\CRM\backend\config\JWT.php

class JWT {
    private static string $secret = JWT_SECRET;

    public static function encode(array $payload): string {
        $header  = self::base64UrlEncode(json_encode(['typ' => 'JWT', 'alg' => 'HS256']));
        $payload['exp'] = time() + JWT_EXPIRE_ACCESS;
        $payload['iat'] = time();
        $payloadEncoded = self::base64UrlEncode(json_encode($payload));
        $signature      = self::base64UrlEncode(hash_hmac('sha256', "$header.$payloadEncoded", self::$secret, true));
        return "$header.$payloadEncoded.$signature";
    }

    public static function decode(string $token): ?array {
        $parts = explode('.', $token);
        if (count($parts) !== 3) return null;

        [$header, $payload, $sig] = $parts;
        $expected = self::base64UrlEncode(hash_hmac('sha256', "$header.$payload", self::$secret, true));
        if (!hash_equals($expected, $sig)) return null;

        $data = json_decode(self::base64UrlDecode($payload), true);
        if (!$data || $data['exp'] < time()) return null;

        return $data;
    }

    private static function base64UrlEncode(string $data): string {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private static function base64UrlDecode(string $data): string {
        return base64_decode(strtr($data, '-_', '+/'));
    }
}
