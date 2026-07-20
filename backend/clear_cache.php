<?php
header('Content-Type: text/plain; charset=utf-8');

if (function_exists('opcache_reset')) {
    if (opcache_reset()) {
        echo "SUCCESS: OPCache has been successfully reset.\n";
    } else {
        echo "FAILURE: OPCache reset failed.\n";
    }
} else {
    echo "INFO: OPCache is not enabled or function opcache_reset does not exist.\n";
}

// Clear any APC / APCu cache if exists
if (function_exists('apc_clear_cache')) {
    apc_clear_cache();
    echo "SUCCESS: APC cache cleared.\n";
}
if (function_exists('apcu_clear_cache')) {
    apcu_clear_cache();
    echo "SUCCESS: APCu cache cleared.\n";
}
