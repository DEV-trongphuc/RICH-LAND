<?php
// backend/permission_matrix_helper.php

if (!function_exists('getModulePermissionScope')) {
    function getModulePermissionScope($decodedUser, $module, $action) {
        if (!isset($decodedUser) || !$decodedUser) {
            return 'none';
        }
        
        $role = $decodedUser['role'] ?? 'viewer';
        if ($role === 'superadmin' || $role === 'admin' || $role === 'super_admin') {
            return 'all';
        }
        
        if (($role === 'sale' || $role === 'sales') && $module === 'deals') {
            return $action === 'delete' ? 'none' : 'own';
        }
        
        // Check if the user has custom permissions in their decoded context or fetched live
        $permissions = $decodedUser['permissions'] ?? null;
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
            return $action === 'delete' ? 'none' : 'own';
        }
        if ($role === 'viewer') {
            return $action === 'read' ? 'all' : 'none';
        }
        
        return 'none';
    }
}

if (!function_exists('getActionModuleAndType')) {
    function getActionModuleAndType($action) {
        $writeActions = [
            'upload_avatar', 'save_settings', 'add_account', 'edit_account', 
            'delete_account', 'add_consultant', 'edit_consultant', 'delete_consultant',
            'add_round', 'edit_round', 'update_round_ratios', 'delete_round',
            'add_rule', 'edit_rule', 'delete_rule', 'reorder_rules',
            'add_connection', 'edit_connection', 'delete_connection', 'toggle_connection',
            'toggle_require_both', 'toggle_notify_admin', 'add_mapping', 'edit_mapping',
            'delete_mapping', 'approve_report', 'reject_report', 'compensate_approved_no_comp',
            'reassign_lead', 'force_sync', 'save_ticket_settings', 'unlink_zalo',
            'test_email', 'block_lead', 'rollback_admin_action', 'update_lead_fields',
            'send_lead_reminder', 'register_night_shift', 'add_consultant_leave', 'delete_consultant_leave'
        ];
        
        $actionType = in_array($action, $writeActions) ? 'write' : 'read';
        if (strpos($action, 'delete') !== false || strpos($action, 'remove') !== false) {
            $actionType = 'delete';
        }
        
        $module = 'settings';
        
        if (in_array($action, ['get_reports', 'approve_report', 'reject_report', 'get_my_activity_logs', 'compensate_approved_no_comp', 'get_active_compensation_logs', 'get_sale_portal_data'])) {
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
