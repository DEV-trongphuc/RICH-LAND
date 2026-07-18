<?php
// f:\CRM\backend\controllers\DashboardController.php

class DashboardController {
    private PDO $db;
    public function __construct(PDO $db) { $this->db = $db; }

    public function stats(array $auth): void {
        if ($auth['role'] === 'viewer') respond(403, null, 'Bạn không có quyền xem báo cáo', false);
        
        $scope = $this->resolveUserScope($auth);
        $isSale = $scope['isSale'];
        $isManager = $scope['isManager'];
        $userIds = $scope['userIds'];
        $uid = $scope['uid'];
        $tid = $scope['tid'];

        $from = $_GET['from'] ?? date('Y-m-01');
        $to   = $_GET['to']   ?? date('Y-m-t');
        
        $fromTs = $from . ' 00:00:00';
        $toTs   = $to . ' 23:59:59';

        $fetchStats = function($f, $t, $fTs, $tTs) use ($tid, $isSale, $isManager, $userIds, $uid) {
            // 1. Deals Stats
            $qDeals = "SELECT COALESCE(SUM(value),0) FROM deals WHERE tenant_id=? AND deleted_at IS NULL AND created_at BETWEEN ? AND ?";
            $pDeals = [$tid, $fTs, $tTs];
            if ($isSale) { 
                $qDeals .= " AND owner_id=?"; 
                $pDeals[] = $uid; 
            } else if ($isManager) {
                $placeholders = implode(',', array_fill(0, count($userIds), '?'));
                $qDeals .= " AND owner_id IN ($placeholders)";
                $pDeals = array_merge($pDeals, $userIds);
            }
            $totalValue = (float)$this->queryScalar($qDeals, $pDeals);

            // 2, 3, 4, 6, 8. Combined Invoices & Items Stats
            $subqueryFilter = "";
            $subqueryParams = [];
            $mainFilter = "";
            $mainParams = [];

            if ($isSale) {
                $subqueryFilter = " AND i2.created_by = ?";
                $subqueryParams[] = $uid;
                $mainFilter = " AND i.created_by = ?";
                $mainParams[] = $uid;
            } else if ($isManager) {
                $placeholders = implode(',', array_fill(0, count($userIds), '?'));
                $subqueryFilter = " AND i2.created_by IN ($placeholders)";
                $subqueryParams = $userIds;
                $mainFilter = " AND i.created_by IN ($placeholders)";
                $mainParams = $userIds;
            }

            $qInv = "
                SELECT 
                    COALESCE(SUM(i.total), 0) as revenue,
                    COALESCE(SUM(i.shipping_fee), 0) as total_shipping,
                    COALESCE(SUM(CASE WHEN i.shipping_customer_pay = 1 THEN i.shipping_fee ELSE 0 END), 0) as shipping_collected,
                    COALESCE(SUM(CASE WHEN i.shipping_customer_pay = 0 THEN i.shipping_fee ELSE 0 END), 0) as shop_paid_shipping,
                    (
                        SELECT COALESCE(SUM(ii.quantity * p.cost), 0)
                        FROM invoice_items ii 
                        JOIN products p ON ii.product_id = p.id 
                        JOIN invoices i2 ON ii.invoice_id = i2.id
                        WHERE i2.tenant_id = ? AND i2.status = 'paid' AND i2.paid_at BETWEEN ? AND ?
                        $subqueryFilter
                    ) as total_cogs
                FROM invoices i
                WHERE i.tenant_id = ? AND i.status = 'paid' AND i.paid_at BETWEEN ? AND ?
                $mainFilter
            ";
            $pInv = array_merge(
                [$tid, $fTs, $tTs],
                $subqueryParams,
                [$tid, $fTs, $tTs],
                $mainParams
            );
            
            $invRow = $this->queryRow($qInv, $pInv);

            // 5. Won Deals
            $qWon = "SELECT COUNT(*) as cnt, COALESCE(SUM(d.value),0) as val 
                     FROM deals d JOIN pipeline_stages ps ON d.stage_id=ps.id 
                     WHERE d.tenant_id=? AND d.deleted_at IS NULL AND ps.is_won=1 AND COALESCE(d.actual_close_date, d.created_at) BETWEEN ? AND ?";
            $pWon = [$tid, $fTs, $tTs];
            if ($isSale) { 
                $qWon .= " AND d.owner_id=?"; 
                $pWon[] = $uid; 
            } else if ($isManager) {
                $placeholders = implode(',', array_fill(0, count($userIds), '?'));
                $qWon .= " AND d.owner_id IN ($placeholders)";
                $pWon = array_merge($pWon, $userIds);
            }
            $wonRow = $this->queryRow($qWon, $pWon);

            // 7. Expenses
            $qExp = "SELECT COALESCE(SUM(amount),0) FROM expenses WHERE tenant_id=? AND status='approved' AND date BETWEEN ? AND ?";
            $pExp = [$tid, $f, $t];
            if ($isSale) { 
                $qExp .= " AND created_by=?"; 
                $pExp[] = $uid; 
            } else if ($isManager) {
                $placeholders = implode(',', array_fill(0, count($userIds), '?'));
                $qExp .= " AND created_by IN ($placeholders)";
                $pExp = array_merge($pExp, $userIds);
            }
            $totalExpenses = (float)$this->queryScalar($qExp, $pExp);

            // 8. New Contacts
            $qContacts = "SELECT COUNT(*) FROM contacts WHERE tenant_id=? AND deleted_at IS NULL AND created_at BETWEEN ? AND ?";
            $pContacts = [$tid, $fTs, $tTs];
            if ($isSale) { 
                $qContacts .= " AND owner_id=?"; 
                $pContacts[] = $uid; 
            } else if ($isManager) {
                $placeholders = implode(',', array_fill(0, count($userIds), '?'));
                $qContacts .= " AND owner_id IN ($placeholders)";
                $pContacts = array_merge($pContacts, $userIds);
            }
            $newContacts = (int)$this->queryScalar($qContacts, $pContacts);

            return [
                'total_value' => $totalValue,
                'revenue' => (float)$invRow['revenue'],
                'expenses' => $totalExpenses,
                'contacts' => $newContacts,
                'won_count' => (int)$wonRow['cnt'],
                'won_value' => (float)$wonRow['val'],
                'shipping_collected' => (float)$invRow['shipping_collected'],
                'cogs' => (float)$invRow['total_cogs'],
                'shop_paid_shipping' => (float)$invRow['shop_paid_shipping']
            ];
        };

        $res = $fetchStats($from, $to, $fromTs, $toTs);

        // Tasks due counts (Current period only)
        $qTasks = function($cond) use ($tid, $isSale, $isManager, $userIds, $uid) {
            $q = "SELECT COUNT(*) FROM activities WHERE tenant_id=? AND status='planned' AND $cond";
            $p = [$tid];
            if ($isSale) { 
                $q .= " AND user_id=?"; 
                $p[] = $uid; 
            } else if ($isManager) {
                $placeholders = implode(',', array_fill(0, count($userIds), '?'));
                $q .= " AND user_id IN ($placeholders)";
                $p = array_merge($p, $userIds);
            }
            return (int)$this->queryScalar($q, $p);
        };
        
        $res['tasks_due_today'] = $qTasks("due_date BETWEEN CURDATE() AND CONCAT(CURDATE(), ' 23:59:59')");
        $res['tasks_due_tomorrow'] = $qTasks("due_date BETWEEN DATE_ADD(CURDATE(), INTERVAL 1 DAY) AND CONCAT(DATE_ADD(CURDATE(), INTERVAL 1 DAY), ' 23:59:59')");
        $res['overdue_tasks'] = $qTasks("due_date < CURDATE()");

        // Previous Period
        $diff = strtotime($to) - strtotime($from);
        $prevTo = date('Y-m-d', strtotime($from) - 86400);
        $prevFrom = date('Y-m-d', strtotime($prevTo) - $diff);
        $resPrev = $fetchStats($prevFrom, $prevTo, $prevFrom . ' 00:00:00', $prevTo . ' 23:59:59');

        $calcChange = function($curr, $prev) {
            if ($prev == 0) return $curr > 0 ? '+100%' : null;
            $pct = (($curr - $prev) / abs($prev)) * 100;
            return ($pct >= 0 ? '+' : '') . round($pct, 1) . '%';
        };

        // Today's focus tasks
        $sqlToday = "SELECT id, subject, type, priority, due_date FROM activities WHERE tenant_id=? AND status='planned' AND due_date BETWEEN CURDATE() AND CONCAT(CURDATE(), ' 23:59:59')";
        $pToday = [$tid];
        if ($isSale) { 
            $sqlToday .= " AND user_id=?"; 
            $pToday[] = $uid; 
        } else if ($isManager) {
            $placeholders = implode(',', array_fill(0, count($userIds), '?'));
            $sqlToday .= " AND user_id IN ($placeholders)";
            $pToday = array_merge($pToday, $userIds);
        }
        $todayTasks = $this->queryAll($sqlToday . " LIMIT 10", $pToday);

        $currRev = $res['revenue'];
        $prevRev = $resPrev['revenue'];

        $currExp = $res['expenses'] + $res['cogs'] + $res['shop_paid_shipping'];
        $prevExp = $resPrev['expenses'] + $resPrev['cogs'] + $resPrev['shop_paid_shipping'];

        // Total contacts count
        $qTotalContacts = "SELECT COUNT(*) FROM contacts WHERE tenant_id=? AND deleted_at IS NULL";
        $pTotalContacts = [$tid];
        if ($isSale) { 
            $qTotalContacts .= " AND owner_id=?"; 
            $pTotalContacts[] = $uid; 
        } else if ($isManager) {
            $placeholders = implode(',', array_fill(0, count($userIds), '?'));
            $qTotalContacts .= " AND owner_id IN ($placeholders)";
            $pTotalContacts = array_merge($pTotalContacts, $userIds);
        }
        $totalContacts = (int)$this->queryScalar($qTotalContacts, $pTotalContacts);

        respond(200, [
            'total_value'       => $res['total_value'],
            'won_value'         => $res['won_value'],
            'won_count'         => $res['won_count'],
            'revenue'           => $currRev,
            'expenses'          => $currExp,
            'profit'            => $currRev - $currExp,
            'gross_profit'      => $currRev - $res['cogs'],
            'new_contacts'      => $res['contacts'],
            'total_contacts'    => $totalContacts,
            'tasks_due_today'   => $res['tasks_due_today'],
            'tasks_due_tomorrow'=> $res['tasks_due_tomorrow'],
            'overdue_tasks'     => $res['overdue_tasks'],
            'shipping_collected'=> $res['shipping_collected'],
            'today_tasks'       => $todayTasks,
            'cogs'              => $res['cogs'],
            'shop_paid_shipping'=> $res['shop_paid_shipping'],
            'revenue_change'    => $calcChange($currRev, $prevRev),
            'profit_change'     => $calcChange($currRev - $currExp, $prevRev - $prevExp),
            'leads_change'      => $calcChange($res['contacts'], $resPrev['contacts']),
            'expenses_change'   => $calcChange($currExp, $prevExp)
        ]);
    }

    private function queryScalar(string $sql, array $params = []) {
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchColumn();
    }

    private function queryRow(string $sql, array $params = []) {
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetch(PDO::FETCH_ASSOC) ?: [];
    }

    private function queryAll(string $sql, array $params = []) {
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    public function chartRevenue(array $auth): void {
        $months = (int)($_GET['months'] ?? 8);

        $scope = $this->resolveUserScope($auth);
        $isSale = $scope['isSale'];
        $isManager = $scope['isManager'];
        $userIds = $scope['userIds'];
        $uid = $scope['uid'];
        $tid = $scope['tid'];

        $invoiceFilter = ""; $invoiceParams = [];
        $expenseFilter = ""; $expenseParams = [];
        $invoiceSubFilter = ""; $invoiceSubParams = [];
        $invoiceShippingFilter = ""; $invoiceShippingParams = [];

        if ($isSale) {
            $invoiceFilter = " AND created_by = ?";
            $invoiceParams[] = $uid;
            
            $expenseFilter = " AND created_by = ?";
            $expenseParams[] = $uid;
            
            $invoiceSubFilter = " AND i.created_by = ?";
            $invoiceSubParams[] = $uid;
            
            $invoiceShippingFilter = " AND created_by = ?";
            $invoiceShippingParams[] = $uid;
        } else if ($isManager) {
            $placeholders = implode(',', array_fill(0, count($userIds), '?'));
            
            $invoiceFilter = " AND created_by IN ($placeholders)";
            $invoiceParams = $userIds;
            
            $expenseFilter = " AND created_by IN ($placeholders)";
            $expenseParams = $userIds;
            
            $invoiceSubFilter = " AND i.created_by IN ($placeholders)";
            $invoiceSubParams = $userIds;
            
            $invoiceShippingFilter = " AND created_by IN ($placeholders)";
            $invoiceShippingParams = $userIds;
        }

        // Tạo chuỗi các tháng gần đây
        $sql = "
            SELECT 
                DATE_FORMAT(dates.date, '%m/%Y') as month,
                (
                    SELECT COALESCE(SUM(total), 0) 
                    FROM invoices 
                    WHERE tenant_id = ? 
                      AND status = 'paid' 
                      AND paid_at BETWEEN DATE_FORMAT(dates.date, '%Y-%m-01 00:00:00') AND CONCAT(LAST_DAY(dates.date), ' 23:59:59')
                      $invoiceFilter
                ) as revenue,
                (
                    (SELECT COALESCE(SUM(amount), 0) 
                     FROM expenses 
                     WHERE tenant_id = ? 
                       AND status = 'approved' 
                       AND date BETWEEN DATE_FORMAT(dates.date, '%Y-%m-01') AND LAST_DAY(dates.date)
                       $expenseFilter
                    ) +
                    (SELECT COALESCE(SUM(ii.quantity * p.cost), 0)
                     FROM invoice_items ii 
                     JOIN products p ON ii.product_id = p.id 
                     JOIN invoices i ON ii.invoice_id = i.id
                     WHERE i.tenant_id = ?
                       AND i.status = 'paid'
                       AND i.paid_at BETWEEN DATE_FORMAT(dates.date, '%Y-%m-01 00:00:00') AND CONCAT(LAST_DAY(dates.date), ' 23:59:59')
                       $invoiceSubFilter
                    ) +
                    (SELECT COALESCE(SUM(shipping_fee), 0)
                     FROM invoices
                     WHERE tenant_id = ?
                       AND status = 'paid'
                       AND shipping_customer_pay = 0
                       AND paid_at BETWEEN DATE_FORMAT(dates.date, '%Y-%m-01 00:00:00') AND CONCAT(LAST_DAY(dates.date), ' 23:59:59')
                       $invoiceShippingFilter
                    )
                ) as cost
            FROM (
                SELECT LAST_DAY(CURRENT_DATE) - INTERVAL (a.a + (10 * b.a)) MONTH as date
                FROM (SELECT 0 as a UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) as a
                CROSS JOIN (SELECT 0 as a UNION ALL SELECT 1) as b
            ) dates
            WHERE dates.date >= DATE_SUB(LAST_DAY(CURRENT_DATE), INTERVAL ($months - 1) MONTH)
              AND dates.date <= LAST_DAY(CURRENT_DATE)
            GROUP BY month
            ORDER BY dates.date ASC
        ";
        
        $p = array_merge(
            [$tid], $invoiceParams,
            [$tid], $expenseParams,
            [$tid], $invoiceSubParams,
            [$tid], $invoiceShippingParams
        );
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute($p);
        respond(200, $stmt->fetchAll());
    }

    public function topDeals(array $auth): void {
        $scope = $this->resolveUserScope($auth);
        $isSale = $scope['isSale'];
        $isManager = $scope['isManager'];
        $userIds = $scope['userIds'];
        $uid = $scope['uid'];
        $tid = $scope['tid'];

        $sql = "SELECT d.id, d.title, d.value, ps.name as stage_name, ps.color as stage_color,
                   CONCAT(c.first_name,' ',c.last_name) as contact_name,
                   u.full_name as owner_name
            FROM deals d
            LEFT JOIN pipeline_stages ps ON d.stage_id = ps.id
            LEFT JOIN contacts c ON d.contact_id = c.id
            LEFT JOIN users u ON d.owner_id = u.id
            WHERE d.tenant_id=? AND (ps.is_won=0 OR ps.is_won IS NULL) AND (ps.is_lost=0 OR ps.is_lost IS NULL)";
        $p = [$tid];
        if ($isSale) {
            $sql .= " AND d.owner_id = ?";
            $p[] = $uid;
        } else if ($isManager) {
            $placeholders = implode(',', array_fill(0, count($userIds), '?'));
            $sql .= " AND d.owner_id IN ($placeholders)";
            $p = array_merge($p, $userIds);
        }
        $sql .= " ORDER BY d.value DESC LIMIT 5";
        $stmt = $this->db->prepare($sql);
        $stmt->execute($p);
        respond(200, $stmt->fetchAll());
    }

    public function recentActivities(array $auth): void {
        $scope = $this->resolveUserScope($auth);
        $isSale = $scope['isSale'];
        $isManager = $scope['isManager'];
        $userIds = $scope['userIds'];
        $uid = $scope['uid'];
        $tid = $scope['tid'];

        $sql = "SELECT a.*, u.full_name as user_name, u.avatar_url
            FROM activities a
            LEFT JOIN users u ON a.user_id = u.id
            WHERE a.tenant_id=?";
        $p = [$tid];
        if ($isSale) {
            $sql .= " AND a.user_id = ?";
            $p[] = $uid;
        } else if ($isManager) {
            $placeholders = implode(',', array_fill(0, count($userIds), '?'));
            $sql .= " AND a.user_id IN ($placeholders)";
            $p = array_merge($p, $userIds);
        }
        $sql .= " ORDER BY a.created_at DESC LIMIT 10";
        $stmt = $this->db->prepare($sql);
        $stmt->execute($p);
        respond(200, $stmt->fetchAll());
    }

    public function pipelineFunnel(array $auth): void {
        $scope = $this->resolveUserScope($auth);
        $isSale = $scope['isSale'];
        $isManager = $scope['isManager'];
        $userIds = $scope['userIds'];
        $uid = $scope['uid'];
        $tid = $scope['tid'];

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

        $sql = "
            SELECT ps.id, ps.name, ps.color, ps.order_index, ps.is_won, ps.is_lost,
                   (
                     (SELECT COUNT(*) FROM deals d WHERE (d.stage_id = ps.id OR (d.stage_id IS NULL OR d.stage_id = 0 OR d.stage_id = '0') AND ps.id = ?) AND d.deleted_at IS NULL AND d.tenant_id = ? $dealFilter) +
                     (SELECT COUNT(*) FROM contacts c WHERE (c.stage_id = ps.id OR (c.stage_id IS NULL OR c.stage_id = 0 OR c.stage_id = '0') AND ps.id = ?) AND c.deleted_at IS NULL AND c.tenant_id = ? $contactFilter) +
                     (SELECT COUNT(*) FROM companies cp WHERE (cp.stage_id = ps.id OR (cp.stage_id IS NULL OR cp.stage_id = 0 OR cp.stage_id = '0') AND ps.id = ?) AND cp.deleted_at IS NULL AND cp.tenant_id = ? $companyFilter)
                   ) as deal_count,
                   (
                     (SELECT COALESCE(SUM(value),0) FROM deals d WHERE (d.stage_id = ps.id OR (d.stage_id IS NULL OR d.stage_id = 0 OR d.stage_id = '0') AND ps.id = ?) AND d.deleted_at IS NULL AND d.tenant_id = ? $dealFilter) +
                     (SELECT COALESCE(SUM(expected_revenue),0) FROM contacts c WHERE (c.stage_id = ps.id OR (c.stage_id IS NULL OR c.stage_id = 0 OR c.stage_id = '0') AND ps.id = ?) AND c.deleted_at IS NULL AND c.tenant_id = ? $contactFilter) +
                     (SELECT COALESCE(SUM(expected_revenue),0) FROM companies cp WHERE (cp.stage_id = ps.id OR (cp.stage_id IS NULL OR cp.stage_id = 0 OR cp.stage_id = '0') AND ps.id = ?) AND cp.deleted_at IS NULL AND cp.tenant_id = ? $companyFilter)
                   ) as total_value
            FROM pipeline_stages ps
            WHERE ps.tenant_id = ?
            GROUP BY ps.id 
            ORDER BY ps.order_index ASC
        ";

        $p = array_merge(
            [$firstStageId, $tid], $dealParams,
            [$firstStageId, $tid], $contactParams,
            [$firstStageId, $tid], $companyParams,
            [$firstStageId, $tid], $dealParams,
            [$firstStageId, $tid], $contactParams,
            [$firstStageId, $tid], $companyParams,
            [$tid]
        );

        $stmt = $this->db->prepare($sql);
        $stmt->execute($p);
        respond(200, $stmt->fetchAll());
    }

    public function leadSources(array $auth): void {
        $scope = $this->resolveUserScope($auth);
        $isSale = $scope['isSale'];
        $isManager = $scope['isManager'];
        $userIds = $scope['userIds'];
        $uid = $scope['uid'];
        $tid = $scope['tid'];

        $from = ($_GET['from'] ?? date('Y-m-01')) . ' 00:00:00';
        $to   = ($_GET['to']   ?? date('Y-m-t')) . ' 23:59:59';
        
        $sql = "SELECT source, COUNT(*) as count FROM contacts WHERE tenant_id=? AND deleted_at IS NULL AND created_at BETWEEN ? AND ?";
        $p = [$tid, $from, $to];
        if ($isSale) {
            $sql .= " AND owner_id = ?";
            $p[] = $uid;
        } else if ($isManager) {
            $placeholders = implode(',', array_fill(0, count($userIds), '?'));
            $sql .= " AND owner_id IN ($placeholders)";
            $p = array_merge($p, $userIds);
        }
        $sql .= " GROUP BY source ORDER BY count DESC";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute($p);
        respond(200, $stmt->fetchAll());
    }

    public function salesLeaderboard(array $auth): void {
        $scope = $this->resolveUserScope($auth);
        $isSale = $scope['isSale'];
        $isManager = $scope['isManager'];
        $userIds = $scope['userIds'];
        $uid = $scope['uid'];
        $tid = $scope['tid'];

        $from = ($_GET['from'] ?? date('Y-m-01')) . ' 00:00:00';
        $to   = ($_GET['to']   ?? date('Y-m-t')) . ' 23:59:59';
        
        $where = "u.tenant_id=? AND u.is_active=1 AND u.role IN ('admin','manager','sales','sale','director','superadmin','super_admin')";
        $params = [$tid, $from, $to, $tid];
        
        if ($isSale) {
            $where .= " AND u.id=?";
            $params[] = $uid;
        } else if ($isManager) {
            $placeholders = implode(',', array_fill(0, count($userIds), '?'));
            $where .= " AND u.id IN ($placeholders)";
            $params = array_merge($params, $userIds);
        }

        $stmt = $this->db->prepare("
            SELECT u.id, u.full_name, u.avatar_url,
                   COUNT(d.id) as deal_count,
                   COALESCE(SUM(d.value),0) as pipeline_value,
                   COALESCE(SUM(CASE WHEN ps.is_won=1 THEN d.value ELSE 0 END),0) as won_value,
                   COUNT(CASE WHEN ps.is_won=1 THEN 1 END) as won_count
            FROM users u
            LEFT JOIN deals d ON d.owner_id=u.id AND d.deleted_at IS NULL AND d.tenant_id=? AND d.created_at BETWEEN ? AND ?
            LEFT JOIN pipeline_stages ps ON d.stage_id=ps.id
            WHERE $where
            GROUP BY u.id ORDER BY won_value DESC
        ");
        $stmt->execute($params);
        respond(200, $stmt->fetchAll());
    }

    public function myStats(array $auth): void {
        $tid = $auth['tenant_id'];
        $uid = $auth['user_id'];
        $from = ($_GET['from'] ?? date('Y-m-01')) . ' 00:00:00';
        $to   = ($_GET['to']   ?? date('Y-m-t')) . ' 23:59:59';

        $s1 = $this->db->prepare("SELECT COUNT(*) as total, COALESCE(SUM(value),0) as total_value FROM deals WHERE owner_id=? AND tenant_id=? AND deleted_at IS NULL");
        $s1->execute([$uid, $tid]);
        $myDeals = $s1->fetch();

        $s2 = $this->db->prepare("SELECT COUNT(*) as cnt FROM activities WHERE user_id=? AND tenant_id=? AND status='done' AND done_at BETWEEN ? AND ?");
        $s2->execute([$uid, $tid, $from, $to]);
        $doneTasks = (int)$s2->fetchColumn();

        $s3 = $this->db->prepare("SELECT COUNT(*) as cnt FROM activities WHERE user_id=? AND tenant_id=? AND status='planned' AND due_date <= CONCAT(CURDATE(), ' 23:59:59')");
        $s3->execute([$uid, $tid]);
        $overdue = (int)$s3->fetchColumn();

        $s4 = $this->db->prepare("SELECT COUNT(*) as cnt FROM contacts WHERE owner_id=? AND tenant_id=? AND deleted_at IS NULL AND created_at BETWEEN ? AND ?");
        $s4->execute([$uid, $tid, $from, $to]);
        $newLeads = (int)$s4->fetchColumn();

        respond(200, [
            'my_deals'       => (int)$myDeals['total'],
            'my_pipeline'    => (float)$myDeals['total_value'],
            'done_tasks'     => $doneTasks,
            'overdue_tasks'  => $overdue,
            'new_leads'      => $newLeads,
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
            $stmtTeam = $this->db->prepare("SELECT id FROM users WHERE team_id IN (SELECT id FROM teams WHERE FIND_IN_SET(?, CONCAT(leader_id, ',', IFNULL(co_leader_ids, ''))))");
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
