/**
 * Smart Dynamic Approval Permissions Helper for Enterprise ERP
 * Solves Route Guards, Sidebar Visibility, and Approval Authority for Managers & Team Leaders
 */

export interface UserContext {
  id?: number | string;
  role?: string;
  is_team_leader?: boolean;
  team_id?: number | null;
  [key: string]: any;
}

/**
 * Checks whether a user has approval authority or access rights for a specific ERP module.
 * Used for dynamic sidebar unlocking, route protection, and approval action enablement.
 */
export function hasModuleApprovalAccess(
  user: UserContext | null | undefined,
  moduleKey: string,
  matrixConfig?: Record<string, any>
): boolean {
  if (!user) return false;

  const role = (user.role || '').toLowerCase().trim();

  // Admin, Super Admin, and Director always have approval authority & full navigation access
  if (['admin', 'superadmin', 'super_admin', 'director'].includes(role)) {
    return true;
  }

  // Parse approval matrix config from parameter or localStorage
  let config: Record<string, any> = matrixConfig || {};
  if (!matrixConfig || Object.keys(matrixConfig).length === 0) {
    try {
      const stored = localStorage.getItem('approval_matrix_config');
      if (stored) {
        config = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to parse approval_matrix_config from localStorage', e);
    }
  }

  const modCfg = config[moduleKey] || {};

  // Level 1: Check Team Leader authority when enabled
  if (modCfg.enable_team_leader) {
    // If user is marked as team leader or has leader role
    if (user.is_team_leader || role === 'manager') {
      return true;
    }
  }

  // Level 2: Check Designated Roles & User IDs
  const designatedApprovers: string[] = modCfg.designated_approvers || [];
  const designatedRoles: string[] = modCfg.designated_roles || [];
  const designatedUserIds: (number | string)[] = modCfg.designated_user_ids || [];

  // Match specific user ID
  if (designatedUserIds.some(uid => String(uid) === String(user.id))) {
    return true;
  }
  if (designatedApprovers.includes(`user_${user.id}`)) {
    return true;
  }

  // Match role
  if (designatedRoles.some(r => r.toLowerCase() === role)) {
    return true;
  }
  if (designatedApprovers.includes(`role_${role}`)) {
    return true;
  }

  // Check Expense Money Tiers (if module is expense)
  if (moduleKey === 'expense' && Array.isArray(modCfg.money_tiers)) {
    for (const tier of modCfg.money_tiers) {
      const tierApprovers: string[] = tier.approvers || [];
      const tierRoles: string[] = tier.roles || [];
      const tierUserIds: (number | string)[] = tier.user_ids || [];

      if (tierApprovers.includes('team_leader') && (user.is_team_leader || role === 'manager')) {
        return true;
      }
      if (tierUserIds.some(uid => String(uid) === String(user.id)) || tierApprovers.includes(`user_${user.id}`)) {
        return true;
      }
      if (tierRoles.some(r => r.toLowerCase() === role) || tierApprovers.includes(`role_${role}`)) {
        return true;
      }
    }
  }

  // Managers still get view access to managerial modules unless explicitly restricted
  if (role === 'manager') {
    return true;
  }

  return false;
}
