<?php
// backend/permission_matrix_helper.php

if (!function_exists('getModulePermissionScope')) {
    function getModulePermissionScope($arg1, $arg2, $arg3, $arg4 = 'own') {
        $conn = null;
        $defaultScope = 'own';
        if (is_object($arg1) || (is_array($arg2) && is_string($arg3) && is_string($arg4))) {
            $conn = is_object($arg1) ? $arg1 : ($GLOBALS['conn'] ?? null);
            $decodedUser = $arg2;
            $module = $arg3;
            $action = $arg4;
        } else {
            $conn = $GLOBALS['conn'] ?? null;
            $decodedUser = $arg1;
            $module = $arg2;
            $action = $arg3;
            if (is_string($arg4) && $arg4 !== '') {
                $defaultScope = $arg4;
            }
        }

        if (!isset($decodedUser) || !$decodedUser || !is_array($decodedUser)) {
            return 'none';
        }
        
        $role = $decodedUser['role'] ?? 'viewer';
        if ($role === 'superadmin' || $role === 'admin' || $role === 'super_admin') {
            return 'all';
        }
        
        if (($role === 'sale' || $role === 'sales') && in_array($module, ['deals', 'leads', 'contacts', 'customers'], true)) {
            return $action === 'delete' ? 'none' : 'own';
        }
        
        // Check if the user has custom permissions in their decoded context or fetched live
        $permissions = $decodedUser['permissions'] ?? null;
        if ($permissions === null && $conn instanceof mysqli) {
            $uid = (int)($decodedUser['user_id'] ?? $decodedUser['id'] ?? 0);
            if ($uid > 0) {
                $stmt = $conn->prepare("SELECT permissions_json FROM users WHERE id = ? LIMIT 1");
                if ($stmt) {
                    $stmt->bind_param("i", $uid);
                    $stmt->execute();
                    $res = $stmt->get_result()->fetch_assoc();
                    $stmt->close();
                    if ($res && !empty($res['permissions_json'])) {
                        $permissions = json_decode($res['permissions_json'], true);
                    }
                }
            }
        }
        if (isset($permissions) && is_array($permissions)) {
            $val = $permissions[$module][$action] ?? null;
            if (in_array($val, ['all', 'team', 'own', 'none'], true)) {
                return $val;
            }
        }
        
        // Fallback based on role
        if ($role === 'director') {
            if ($module === 'settings') {
                return 'none';
            }
            return 'all';
        }
        if ($role === 'manager') {
            return $action === 'delete' ? 'none' : 'team';
        }
        if ($role === 'assistant') {
            if ($module === 'leads') return $action === 'delete' ? 'none' : 'all';
            if ($module === 'deals') return 'all';
            return $action === 'delete' ? 'none' : 'all';
        }
        if ($role === 'sale' || $role === 'sales') {
            if ($module === 'projects') return $action === 'read' ? 'all' : 'none';
            return $action === 'delete' ? 'none' : $defaultScope;
        }
        if ($role === 'viewer') {
            return $action === 'read' ? 'all' : 'none';
        }
        
        return 'none';
    }
}

if (!function_exists('getActionModuleAndType')) {
    function getActionModuleAndType($action) {
        if (in_array($action, [
            'get_consultant_leaves', 'add_consultant_leave', 'delete_consultant_leave',
            'get_night_shift_status', 'register_night_shift',
            'get_weekend_shift_status', 'register_weekend_shift',
            'get_holiday_shift_status', 'register_holiday_shift',
            'register_weekly_shifts', 'toggle_consultant_vacation'
        ], true)) {
            $isRead = in_array($action, [
                'get_consultant_leaves', 'get_night_shift_status',
                'get_weekend_shift_status', 'get_holiday_shift_status'
            ], true);
            return ['attendance', $isRead ? 'read' : 'write'];
        }

        $writeActions = [
            'upload_avatar', 'save_settings', 'add_account', 'edit_account', 
            'delete_account', 'add_consultant', 'edit_consultant', 'delete_consultant',
            'add_round', 'edit_round', 'update_round_ratios', 'delete_round',
            'add_rule', 'edit_rule', 'delete_rule', 'reorder_rules',
            'add_connection', 'edit_connection', 'delete_connection', 'toggle_connection',
            'toggle_require_both', 'toggle_notify_admin', 'add_mapping', 'edit_mapping',
            'delete_mapping', 'approve_report', 'reject_report', 'compensate_approved_no_comp',
            'reassign_lead', 'distribute_pending_lead', 'force_sync', 'save_ticket_settings', 'unlink_zalo',
            'test_email', 'block_lead', 'rollback_admin_action', 'update_lead_fields',
            'send_lead_reminder'
        ];
        
        $actionType = in_array($action, $writeActions) ? 'write' : 'read';
        if (strpos($action, 'delete') !== false || strpos($action, 'remove') !== false) {
            $actionType = 'delete';
        }
        
        $module = 'settings';
        
        if (in_array($action, [
            'get_reports', 'approve_report', 'reject_report', 'get_my_activity_logs', 
            'compensate_approved_no_comp', 'get_active_compensation_logs', 'get_sale_portal_data',
            'get_sse_updates', 'get_dashboard_stats', 'get_logs',
            'get_active_offers', 'get_all_pending_counts'
        ], true)) {
            $module = 'leads';
        } else if (strpos($action, 'lead') !== false || strpos($action, 'consultant') !== false || strpos($action, 'round') !== false || strpos($action, 'rule') !== false || strpos($action, 'night_shift') !== false) {
            $module = 'leads';
        } else if (strpos($action, 'ticket') !== false) {
            if (strpos($action, 'setting') !== false) {
                $module = 'settings';
            } else {
                $module = 'tickets';
            }
        } else if (strpos($action, 'account') !== false || strpos($action, 'zalo') !== false) {
            $module = 'settings';
        } else if (in_array($action, ['get_connections', 'add_connection', 'edit_connection', 'delete_connection', 'toggle_connection', 'toggle_require_both', 'toggle_notify_admin', 'add_mapping', 'edit_mapping', 'delete_mapping', 'force_sync', 'test_master_sync'])) {
            $module = 'settings';
        } else if (in_array($action, ['get_ticket_settings', 'save_ticket_settings', 'ai_chat'])) {
            $module = 'settings';
        }
        
        return [$module, $actionType];
    }
}
