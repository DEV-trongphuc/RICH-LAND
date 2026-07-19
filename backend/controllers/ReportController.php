<?php
class ReportController
{
    private PDO $db;
    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    public function sales(array $auth): void
    {
        if ($auth['role'] === 'viewer') respond(403, null, 'Bạn không có quyền xem báo cáo', false);
        
        $scope = $this->resolveUserScope($auth);
        $isSale = $scope['isSale'];
        $isManager = $scope['isManager'];
        $userIds = $scope['userIds'];
        $uid = $scope['uid'];
        $tid = $scope['tid'];

        $from = $_GET['from'] ?? date('Y-m-d', strtotime('-11 months'));
        $to = $_GET['to'] ?? date('Y-m-d');
        
        $saleFilterInv = "";
        $pInv = [$tid, $from, $to];
        
        if ($isSale) {
            $saleFilterInv = " AND created_by=?";
            $pInv[] = $uid;
        } else if ($isManager) {
            $placeholders = implode(',', array_fill(0, count($userIds), '?'));
            $saleFilterInv = " AND created_by IN ($placeholders)";
            $pInv = array_merge($pInv, $userIds);
        }

        // Revenue by month (from Invoices)
        $stmt = $this->db->prepare("
            SELECT DATE_FORMAT(issue_date,'%Y-%m') as month,
                   SUM(total) as revenue,
                   COUNT(*) as total_invoices
            FROM invoices
            WHERE tenant_id=? AND status='paid' AND issue_date BETWEEN ? AND ? $saleFilterInv
            GROUP BY month ORDER BY month ASC
        ");
        $stmt->execute($pInv);
        $revs = $stmt->fetchAll(PDO::FETCH_UNIQUE|PDO::FETCH_ASSOC);

        // Expenses by month
        $saleFilterExp = "";
        $pExp = [$tid, $from, $to];
        if ($isSale) {
            $saleFilterExp = " AND created_by=?";
            $pExp[] = $uid;
        } else if ($isManager) {
            $placeholders = implode(',', array_fill(0, count($userIds), '?'));
            $saleFilterExp = " AND created_by IN ($placeholders)";
            $pExp = array_merge($pExp, $userIds);
        }
        
        $stmtE = $this->db->prepare("
            SELECT DATE_FORMAT(date,'%Y-%m') as month,
                   SUM(amount) as cost
            FROM expenses
            WHERE tenant_id=? AND status='approved' AND date BETWEEN ? AND ? $saleFilterExp
            GROUP BY month
        ");
        $stmtE->execute($pExp);
        $costs = $stmtE->fetchAll(PDO::FETCH_UNIQUE|PDO::FETCH_ASSOC);

        // Merge
        $byMonth = [];
        $allMonths = array_unique(array_merge(array_keys($revs), array_keys($costs)));
        sort($allMonths);
        foreach ($allMonths as $m) {
            $byMonth[] = [
                'month' => $m,
                'revenue' => (float)($revs[$m]['revenue'] ?? 0),
                'cost' => (float)($costs[$m]['cost'] ?? 0),
                'total_invoices' => (int)($revs[$m]['total_invoices'] ?? 0)
            ];
        }

        // Performance by Owner: Split between Won Revenue and Pipeline Value
        $fromTs = $from . ' 00:00:00';
        $toTs = $to . ' 23:59:59';

        $pOwnerList = [$fromTs, $toTs, $tid];
        $ownerFilter = "";
        if ($isSale) {
            $ownerFilter = " AND u.id=?";
            $pOwnerList[] = $uid;
        } else if ($isManager) {
            $placeholders = implode(',', array_fill(0, count($userIds), '?'));
            $ownerFilter = " AND u.id IN ($placeholders)";
            $pOwnerList = array_merge($pOwnerList, $userIds);
        }

        // Performance by Owner: Split between Won Revenue and Pipeline Value (Filtered by selected range)
        $stmt2 = $this->db->prepare("
            SELECT u.id, u.full_name as name, u.avatar_url,
                   COUNT(d.id) as deals, 
                   COALESCE(SUM(CASE WHEN ps.is_won = 1 THEN d.value ELSE 0 END), 0) as revenue,
                   COALESCE(SUM(CASE WHEN ps.is_won = 0 AND ps.is_lost = 0 THEN d.value ELSE 0 END), 0) as pipeline_value
            FROM users u
            LEFT JOIN deals d ON u.id = d.owner_id AND d.tenant_id = u.tenant_id AND d.deleted_at IS NULL AND d.created_at BETWEEN ? AND ?
            LEFT JOIN pipeline_stages ps ON d.stage_id = ps.id
            WHERE u.tenant_id = ? $ownerFilter
            GROUP BY u.id
            ORDER BY revenue DESC, name ASC, u.id ASC
        ");
        $stmt2->execute($pOwnerList);

        $dealFilterSimple = "";
        $dealFilterAlias = "";
        $dealParams = [];
        if ($isSale) {
            $dealFilterSimple = " AND owner_id=?";
            $dealFilterAlias = " AND d.owner_id=?";
            $dealParams[] = $uid;
        } else if ($isManager) {
            $placeholders = implode(',', array_fill(0, count($userIds), '?'));
            $dealFilterSimple = " AND owner_id IN ($placeholders)";
            $dealFilterAlias = " AND d.owner_id IN ($placeholders)";
            $dealParams = $userIds;
        }

        // Retrieve dynamic settings
        $resOpp = $this->db->prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'deal_opportunity_status' LIMIT 1");
        $resOpp->execute();
        $oppStatus = $resOpp->fetchColumn() ?: 'booking';

        $resWon = $this->db->prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'deal_won_status' LIMIT 1");
        $resWon->execute();
        $wonStatus = $resWon->fetchColumn() ?: 'dong_deal';

        $resHier = $this->db->prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'pipeline_status_hierarchy' LIMIT 1");
        $resHier->execute();
        $hierJson = $resHier->fetchColumn();
        $hierarchy = $hierJson ? json_decode($hierJson, true) : ['chua_xac_dinh', 'quan_tam', 'dong_y_gap', 'da_gap', 'booking', 'dat_coc', 'dong_deal'];
        if (!is_array($hierarchy)) {
            $hierarchy = ['chua_xac_dinh', 'quan_tam', 'dong_y_gap', 'da_gap', 'booking', 'dat_coc', 'dong_deal'];
        }

        // Find opportunity stages from $oppStatus onwards in hierarchy
        $oppIdx = array_search($oppStatus, $hierarchy);
        if ($oppIdx === false) {
            $oppIdx = array_search('booking', $hierarchy);
            if ($oppIdx === false) {
                $oppIdx = 0;
            }
        }
        $oppStages = array_slice($hierarchy, $oppIdx);

        $dealStats = ['total_deals' => 0, 'total_revenue' => 0.0];

        if (!empty($oppStages)) {
            $placeholders = implode(',', array_fill(0, count($oppStages), '?'));
            $sDeals = $this->db->prepare("
                SELECT COUNT(*) as total_deals,
                       COALESCE(SUM(expected_revenue),0) as total_revenue
                FROM contacts
                WHERE tenant_id=? AND deleted_at IS NULL AND created_at BETWEEN ? AND ? AND pipeline_status IN ($placeholders) $dealFilterSimple
            ");
            $sDeals->execute(array_merge([$tid, $fromTs, $toTs], $oppStages, $dealParams));
            $rowStats = $sDeals->fetch(PDO::FETCH_ASSOC);
            if ($rowStats) {
                $dealStats['total_deals'] = (int)($rowStats['total_deals'] ?? 0);
                $dealStats['total_revenue'] = (float)($rowStats['total_revenue'] ?? 0);
            }
        }

        // Count won deals (configured won status)
        $sWon = $this->db->prepare("
            SELECT COUNT(*) 
            FROM contacts 
            WHERE tenant_id=? AND deleted_at IS NULL AND created_at BETWEEN ? AND ? AND pipeline_status = ? $dealFilterSimple
        ");
        $sWon->execute(array_merge([$tid, $fromTs, $toTs, $wonStatus], $dealParams));
        $wonCount = (int)$sWon->fetchColumn();

        $sContacts = $this->db->prepare("SELECT COUNT(*) FROM contacts WHERE tenant_id=? AND deleted_at IS NULL AND created_at BETWEEN ? AND ? $dealFilterSimple");
        $sContacts->execute(array_merge([$tid, $fromTs, $toTs], $dealParams));

        // 1. Calculate Inventory Loss Value (EXPORT_INTERNAL)
        $stmtLoss = $this->db->prepare("
            SELECT SUM(ABS(l.qty_change) * b.import_price) as loss_value
            FROM inventory_logs l
            JOIN batches b ON l.batch_id = b.id
            WHERE l.tenant_id = ? AND l.action_type = 'EXPORT_INTERNAL' AND l.created_at BETWEEN ? AND ?
        ");
        $stmtLoss->execute([$tid, $from . ' 00:00:00', $to . ' 23:59:59']);
        $lossValue = (float)$stmtLoss->fetchColumn();

        // 2. Calculate Gross Profit (Revenue - Cost of Goods Sold)
        // Note: Minth CRM needs to track cost_per_unit in order_items for this to be accurate.
        // For now, we'll estimate based on current batch prices if available, or 0.
        // (Assuming we've added cost_per_unit to invoices or use a different table for POS/Orders)
        
        // Let's refine the summary
        $totalRev = array_reduce($byMonth, fn($acc, $m) => $acc + $m['revenue'], 0);
        $totalExp = array_reduce($byMonth, fn($acc, $m) => $acc + $m['cost'], 0);
        $netProfit = $totalRev - $totalExp - $lossValue;

        respond(200, [
            'by_month' => $byMonth,
            'by_owner' => $stmt2->fetchAll() ?: [],
            'summary' => [
                'deals' => (int)$dealStats['total_deals'],
                'expected_revenue' => (float)$dealStats['total_revenue'],
                'total_revenue' => $totalRev,
                'total_expenses' => $totalExp,
                'inventory_loss' => $lossValue,
                'net_profit' => $netProfit,
                'win_rate' => $dealStats['total_deals'] > 0 ? round(($wonCount / $dealStats['total_deals']) * 100, 1) : 0,
                'contacts' => (int)$sContacts->fetchColumn()
            ]
        ]);
    }

    public function pipeline(array $auth): void
    {
        if ($auth['role'] === 'viewer') respond(403, null, 'Bạn không có quyền xem báo cáo', false);
        $scope = $this->resolveUserScope($auth);
        $isSale = $scope['isSale'];
        $isManager = $scope['isManager'];
        $userIds = $scope['userIds'];
        $uid = $scope['uid'];
        $tid = $scope['tid'];

        $from = ($_GET['from'] ?? date('Y-m-01')) . ' 00:00:00';
        $to = ($_GET['to'] ?? date('Y-m-t')) . ' 23:59:59';

        // Fetch the first pipeline stage ID to default empty stages
        $sFirst = $this->db->prepare("SELECT id FROM pipeline_stages WHERE tenant_id = ? ORDER BY order_index LIMIT 1");
        $sFirst->execute([$tid]);
        $firstStageId = (int)$sFirst->fetchColumn();

        $dealFilter = ""; $dealParams = [];
        if ($isSale) {
            $dealFilter = " AND d.owner_id = ?";
            $dealParams[] = $uid;
        } else if ($isManager) {
            $placeholders = implode(',', array_fill(0, count($userIds), '?'));
            $dealFilter = " AND d.owner_id IN ($placeholders)";
            $dealParams = $userIds;
        }

        $contactFilter = ""; $contactParams = [];
        if ($isSale) {
            $contactFilter = " AND c.owner_id = ?";
            $contactParams[] = $uid;
        } else if ($isManager) {
            $placeholders = implode(',', array_fill(0, count($userIds), '?'));
            $contactFilter = " AND c.owner_id IN ($placeholders)";
            $contactParams = $userIds;
        }

        $companyFilter = ""; $companyParams = [];
        if ($isSale) {
            $companyFilter = " AND cp.owner_id = ?";
            $companyParams[] = $uid;
        }

        $stmt = $this->db->prepare("
            SELECT ps.name as stage, ps.color, 
                   (
                      (SELECT COUNT(*) FROM deals d WHERE (d.stage_id = ps.id OR (d.stage_id IS NULL OR d.stage_id = 0 OR d.stage_id = '0') AND ps.id = ?) AND d.deleted_at IS NULL AND d.tenant_id = ? AND d.created_at BETWEEN ? AND ? $dealFilter) +
                      (SELECT COUNT(*) FROM contacts c WHERE (c.stage_id = ps.id OR (c.stage_id IS NULL OR c.stage_id = 0 OR c.stage_id = '0') AND ps.id = ?) AND c.deleted_at IS NULL AND c.tenant_id = ? AND c.created_at BETWEEN ? AND ? $contactFilter) +
                      (SELECT COUNT(*) FROM companies cp WHERE (cp.stage_id = ps.id OR (cp.stage_id IS NULL OR cp.stage_id = 0 OR cp.stage_id = '0') AND ps.id = ?) AND cp.deleted_at IS NULL AND cp.tenant_id = ? AND cp.created_at BETWEEN ? AND ? $companyFilter)
                   ) as count,
                   (
                      (SELECT COALESCE(SUM(value),0) FROM deals d WHERE (d.stage_id = ps.id OR (d.stage_id IS NULL OR d.stage_id = 0 OR d.stage_id = '0') AND ps.id = ?) AND d.deleted_at IS NULL AND d.tenant_id = ? AND d.created_at BETWEEN ? AND ? $dealFilter) +
                      (SELECT COALESCE(SUM(expected_revenue),0) FROM contacts c WHERE (c.stage_id = ps.id OR (c.stage_id IS NULL OR c.stage_id = 0 OR c.stage_id = '0') AND ps.id = ?) AND c.deleted_at IS NULL AND c.tenant_id = ? AND c.created_at BETWEEN ? AND ? $contactFilter) +
                      (SELECT COALESCE(SUM(expected_revenue),0) FROM companies cp WHERE (cp.stage_id = ps.id OR (cp.stage_id IS NULL OR cp.stage_id = 0 OR cp.stage_id = '0') AND ps.id = ?) AND cp.deleted_at IS NULL AND cp.tenant_id = ? AND cp.created_at BETWEEN ? AND ? $companyFilter)
                   ) as total_value
            FROM pipeline_stages ps 
            WHERE ps.tenant_id = ?
            GROUP BY ps.id ORDER BY ps.order_index
        ");

        $p = array_merge(
            [$firstStageId, $tid, $from, $to], $dealParams,
            [$firstStageId, $tid, $from, $to], $contactParams,
            [$firstStageId, $tid, $from, $to], $companyParams,
            [$firstStageId, $tid, $from, $to], $dealParams,
            [$firstStageId, $tid, $from, $to], $contactParams,
            [$firstStageId, $tid, $from, $to], $companyParams,
            [$tid]
        );

        $stmt->execute($p);
        respond(200, $stmt->fetchAll());
    }

    public function customers(array $auth): void
    {
        $scope = $this->resolveUserScope($auth);
        $isSale = $scope['isSale'];
        $isManager = $scope['isManager'];
        $userIds = $scope['userIds'];
        $uid = $scope['uid'];
        $tid = $scope['tid'];

        $from = $_GET['from'] ?? date('Y-m-d', strtotime('-30 days'));
        $to = $_GET['to'] ?? date('Y-m-d');
        
        $saleFilter = "";
        $params = [$tid];
        if ($isSale) {
            $saleFilter = " AND owner_id=?";
            $params[] = $uid;
        } else if ($isManager) {
            $placeholders = implode(',', array_fill(0, count($userIds), '?'));
            $saleFilter = " AND owner_id IN ($placeholders)";
            $params = array_merge($params, $userIds);
        }

        // By Source
        $s1 = $this->db->prepare("SELECT source, COUNT(*) as count FROM contacts WHERE tenant_id=? AND deleted_at IS NULL $saleFilter GROUP BY source");
        $s1->execute($params);
        $bySource = $s1->fetchAll();

        // By Status
        $s2 = $this->db->prepare("SELECT status, COUNT(*) as count FROM contacts WHERE tenant_id=? AND deleted_at IS NULL $saleFilter GROUP BY status");
        $s2->execute($params);
        $byStatus = $s2->fetchAll();

        // Growth trend
        $pTrend = array_merge([$tid], [$from . ' 00:00:00', $to . ' 23:59:59'], array_slice($params, 1));
        
        $s3 = $this->db->prepare("
            SELECT DATE_FORMAT(created_at, '%Y-%m-%d') as date, COUNT(*) as count 
            FROM contacts 
            WHERE tenant_id=? AND deleted_at IS NULL AND created_at BETWEEN ? AND ? $saleFilter
            GROUP BY date ORDER BY date ASC
        ");
        $s3->execute($pTrend);

        // Lead score distribution
        $s4 = $this->db->prepare("
            SELECT 
                CASE 
                    WHEN lead_score < 20 THEN '0-20'
                    WHEN lead_score < 50 THEN '21-50'
                    WHEN lead_score < 80 THEN '51-80'
                    ELSE '81-100'
                END as bucket,
                COUNT(*) as count
            FROM contacts
            WHERE tenant_id=? AND deleted_at IS NULL $saleFilter
            GROUP BY bucket
        ");
        $s4->execute($params);

        respond(200, [
            'by_source' => $bySource,
            'by_status' => $byStatus,
            'trend'     => $s3->fetchAll(),
            'by_score'  => $s4->fetchAll()
        ]);
    }

    public function companies(array $auth): void
    {
        $scope = $this->resolveUserScope($auth);
        $isSale = $scope['isSale'];
        $isManager = $scope['isManager'];
        $userIds = $scope['userIds'];
        $uid = $scope['uid'];
        $tid = $scope['tid'];

        $saleFilter = "";
        $params = [$tid];
        if ($isSale) {
            $saleFilter = " AND owner_id=?";
            $params[] = $uid;
        } else if ($isManager) {
            $placeholders = implode(',', array_fill(0, count($userIds), '?'));
            $saleFilter = " AND owner_id IN ($placeholders)";
            $params = array_merge($params, $userIds);
        }

        // By Industry
        $s1 = $this->db->prepare("SELECT industry, COUNT(*) as count FROM companies WHERE tenant_id=? AND deleted_at IS NULL $saleFilter GROUP BY industry ORDER BY count DESC");
        $s1->execute($params);

        // By City
        $s2 = $this->db->prepare("SELECT city, COUNT(*) as count FROM companies WHERE tenant_id=? AND deleted_at IS NULL $saleFilter GROUP BY city ORDER BY count DESC LIMIT 10");
        $s2->execute($params);

        // By Size
        $s3 = $this->db->prepare("SELECT size, COUNT(*) as count FROM companies WHERE tenant_id=? AND deleted_at IS NULL $saleFilter GROUP BY size ORDER BY count DESC");
        $s3->execute($params);

        respond(200, [
            'by_industry' => $s1->fetchAll(),
            'by_city' => $s2->fetchAll(),
            'by_size' => $s3->fetchAll()
        ]);
    }

    public function expenses(array $auth): void
    {
        $scope = $this->resolveUserScope($auth);
        $isSale = $scope['isSale'];
        $isManager = $scope['isManager'];
        $userIds = $scope['userIds'];
        $uid = $scope['uid'];
        $tid = $scope['tid'];

        $from = $_GET['from'] ?? date('Y-m-01');
        $to = $_GET['to'] ?? date('Y-m-t');

        $saleFilter = "";
        $params = [$tid, $from, $to];
        if ($isSale) {
            $saleFilter = " AND created_by=?";
            $params[] = $uid;
        } else if ($isManager) {
            $placeholders = implode(',', array_fill(0, count($userIds), '?'));
            $saleFilter = " AND created_by IN ($placeholders)";
            $params = array_merge($params, $userIds);
        }

        // By Category
        $s1 = $this->db->prepare("SELECT COALESCE(NULLIF(category,''), 'Khác') as category, SUM(amount) as total FROM expenses WHERE tenant_id=? AND status='approved' AND date BETWEEN ? AND ? $saleFilter GROUP BY category");
        $s1->execute($params);

        // Daily trend
        $s2 = $this->db->prepare("
            SELECT date, SUM(amount) as total 
            FROM expenses 
            WHERE tenant_id=? AND status='approved' AND date BETWEEN ? AND ? $saleFilter
            GROUP BY date ORDER BY date ASC
        ");
        $s2->execute($params);

        respond(200, [
            'by_category' => $s1->fetchAll(),
            'trend' => $s2->fetchAll()
        ]);
    }

    public function activities(array $auth): void
    {
        $scope = $this->resolveUserScope($auth);
        $isSale = $scope['isSale'];
        $isManager = $scope['isManager'];
        $userIds = $scope['userIds'];
        $uid = $scope['uid'];
        $tid = $scope['tid'];

        $from = $_GET['from'] ?? date('Y-m-01');
        $to = $_GET['to'] ?? date('Y-m-t');

        // Activities by User and Type (as expected by frontend table)
        $sql = "
            SELECT u.full_name as user_name, a.type, COUNT(*) as total
            FROM activities a
            JOIN users u ON a.user_id = u.id
            WHERE a.tenant_id=? AND a.created_at BETWEEN ? AND ?
        ";
        $params = [$tid, $from . ' 00:00:00', $to . ' 23:59:59'];
        if ($isSale) {
            $sql .= " AND a.user_id=?";
            $params[] = $uid;
        } else if ($isManager) {
            $placeholders = implode(',', array_fill(0, count($userIds), '?'));
            $sql .= " AND a.user_id IN ($placeholders)";
            $params = array_merge($params, $userIds);
        }
        $sql .= " GROUP BY u.id, a.type ORDER BY user_name ASC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $byUserType = $stmt->fetchAll();

        // Global type breakdown
        $sql2 = "SELECT type, COUNT(*) as total FROM activities WHERE tenant_id=? AND created_at BETWEEN ? AND ?";
        $p2 = [$tid, $from . ' 00:00:00', $to . ' 23:59:59'];
        if ($isSale) {
            $sql2 .= " AND user_id=?";
            $p2[] = $uid;
        } else if ($isManager) {
            $placeholders = implode(',', array_fill(0, count($userIds), '?'));
            $sql2 .= " AND user_id IN ($placeholders)";
            $p2 = array_merge($p2, $userIds);
        }
        $sql2 .= " GROUP BY type";
        $stmt2 = $this->db->prepare($sql2);
        $stmt2->execute($p2);
        $byType = $stmt2->fetchAll();

        respond(200, [
            'by_user_type' => $byUserType,
            'by_type' => $byType
        ]);
    }

    public function inventory(array $auth): void
    {
        if ($auth['role'] === 'viewer') respond(403, null, 'Bạn không có quyền xem báo cáo', false);
        $tid = $auth['tenant_id'];
        
        // 1. Total Inventory Value
        $stmtVal = $this->db->prepare("SELECT SUM(current_qty * import_price) FROM batches WHERE tenant_id = ? AND status = 'active'");
        $stmtVal->execute([$tid]);
        $totalValue = (float)$stmtVal->fetchColumn();

        // 2. Batch Status Counts (Using product-specific min_stock_level)
        $stmtStats = $this->db->prepare("
            SELECT 
                COUNT(*) as total_batches,
                SUM(CASE WHEN b.current_qty <= 0 THEN 1 ELSE 0 END) as out_of_stock,
                SUM(CASE WHEN b.current_qty > 0 AND b.current_qty <= p.min_stock_level THEN 1 ELSE 0 END) as low_stock,
                SUM(CASE WHEN b.expiry_date IS NOT NULL AND b.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) as expiring_soon
            FROM batches b
            JOIN products p ON b.product_id = p.id
            WHERE b.tenant_id = ? AND b.status = 'active'
        ");
        $stmtStats->execute([$tid]);
        $batchStats = $stmtStats->fetch();

        // 3. Loss by Reason
        $stmtLoss = $this->db->prepare("
            SELECT reason, SUM(ABS(l.qty_change) * b.import_price) as value
            FROM inventory_logs l
            JOIN batches b ON l.batch_id = b.id
            WHERE l.tenant_id = ? AND l.action_type = 'EXPORT_INTERNAL'
            GROUP BY reason
        ");
        $stmtLoss->execute([$tid]);
        $lossByReason = $stmtLoss->fetchAll();

        respond(200, [
            'total_value' => $totalValue,
            'stats' => $batchStats,
            'loss_by_reason' => $lossByReason
        ]);
    }

    private function resolveUserScope(array $auth): array {
        $role = $auth['role'] ?? '';
        $uid = (int)($auth['user_id'] ?? 0);
        $tid = (int)($auth['tenant_id'] ?? 0);
        
        $isSale = $role === 'sales' || $role === 'sale';
        $isManager = $role === 'manager';
        
        $userIds = [$uid];
        if ($isManager) {
            $stmtTeam = $this->db->prepare("SELECT id FROM users WHERE team_id IN (SELECT id FROM teams WHERE leader_id = ?)");
            $stmtTeam->execute([$uid]);
            $teamMemberIds = $stmtTeam->fetchAll(PDO::FETCH_COLUMN) ?: [];
            $userIds = array_merge($userIds, array_map('intval', $teamMemberIds));
        }
        
        return [
            'isSale' => $isSale,
            'isManager' => $isManager,
            'userIds' => $userIds,
            'uid' => $uid,
            'tid' => $tid
        ];
    }
}
