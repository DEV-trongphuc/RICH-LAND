<?php
// f:\CRM\backend\config\JWT.php

class JWT {
    private static string $secret = JWT_SECRET;

    public static function encode(array $payload): string {
        $header  = self::base64UrlEncode(json_encode(['typ' => 'JWT', 'alg' => 'HS256']));
        if (!isset($payload['exp'])) {
            $payload['exp'] = time() + JWT_EXPIRE_ACCESS;
        }
        $payload['iat'] = time();
        $payloadEncoded = self::base64UrlEncode(json_encode($payload));
        $signature      = self::base64UrlEncode(hash_hmac('sha256', "$header.$payloadEncoded", self::$secret, true));
        return "$header.$payloadEncoded.$signature";
    }

    public static function decode(string $token): ?array {
        // Bypass for demo tokens
        if ($token === 'demo_token_12345') {
            return [
                'username' => 'admin',
                'email' => 'admin@richland.test',
                'name' => 'Admin Demo',
                'role' => 'admin',
                'user_id' => 1,
                'id' => 1,
                'tenant_id' => 1,
                'exp' => time() + 86400
            ];
        }
        if (strpos($token, 'demo_token_sale_') === 0) {
            $cId = (int)str_replace('demo_token_sale_', '', $token);
            $names = [1 => 'Hải Đăng', 2 => 'Thanh Thảo', 3 => 'Việt Dũng', 4 => 'Minh Tuấn'];
            $emails = [1 => 'haidang@richland.test', 2 => 'thanhthao@richland.test', 3 => 'vietdung@richland.test', 4 => 'minhtuan@richland.test'];
            return [
                'username' => str_replace('@richland.test', '', $emails[$cId] ?? 'sale'),
                'email' => $emails[$cId] ?? 'sale@richland.test',
                'name' => $names[$cId] ?? 'Sale Demo',
                'role' => 'sale',
                'user_id' => $cId,
                'id' => $cId,
                'consultant_id' => $cId,
                'tenant_id' => 1,
                'exp' => time() + 86400
            ];
        }

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
