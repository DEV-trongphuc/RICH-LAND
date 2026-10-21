<?php
// f:\CRM\backend\controllers\ContactController.php

class ContactController {
    private PDO $db;
    public function __construct(PDO $db) { 
        $this->db = $db; 
    }

    public function index(array $auth): void {
        $tid    = $auth['tenant_id'];
        $page   = max(1, (int)($_GET['page']   ?? 1));
        $limit  = min(2000, max(10, (int)($_GET['limit']  ?? 20)));
        $offset = ($page - 1) * $limit;
        $search  = $_GET['search'] ?? '';
        $status  = $_GET['status'] ?? '';
        $segment = $_GET['segment'] ?? 'all';
        if ($status === 'not_contacted') {
            $segment = 'not_contacted';
            $status = '';
        }
        $source  = $_GET['source'] ?? '';
        $owner   = $_GET['owner_id'] ?? '';
        $stage   = $_GET['stage_id'] ?? '';
        $pipelineStatus = $_GET['pipeline_status'] ?? '';
        $companyId = $_GET['company_id'] ?? '';
        $projectId = $_GET['project_id'] ?? '';
        $campaignId = $_GET['campaign_id'] ?? '';
        $tag     = $_GET['tag'] ?? '';
        $from    = $_GET['from'] ?? '';
        $to      = $_GET['to'] ?? '';
        $dataType = $_GET['data_type'] ?? '';
        $ownership = $_GET['ownership'] ?? '';
        $budgetRange = $_GET['budget_range'] ?? '';
        $dateField = $_GET['date_field'] ?? 'created_at';
        $sortBy  = $_GET['sort'] ?? 'created_at';
        $order   = $_GET['order'] ?? 'DESC';

        $isReclaimedView = ($pipelineStatus === 'reclaimed' || $status === 'reclaimed') && !in_array($auth['role'] ?? '', ['sale', 'sales', 'consultant', 'viewer'], true);
        if ($isReclaimedView) {
            $pipelineStatus = 'reclaimed';
            if ($status === 'reclaimed') $status = '';
            $where  = [
                'c.tenant_id = ?',
                'c.deleted_at IS NOT NULL',
                'NOT EXISTS (SELECT 1 FROM persons p_del WHERE p_del.id = c.person_id AND COALESCE(p_del.deleted_from_databank, 0) = 1)'
            ];
            $params = [$tid];
        } else {
            $where  = ['c.tenant_id = ?', 'c.deleted_at IS NULL', 'c.owner_id IS NOT NULL'];
            $params = [$tid];
        }

        // Validating sort fields
        $allowedSort = ['created_at', 'updated_at', 'first_name', 'lead_score', 'last_contact', 'deleted_at'];
        if (!in_array($sortBy, $allowedSort)) $sortBy = $isReclaimedView ? 'deleted_at' : 'created_at';
        if ($isReclaimedView && !isset($_GET['sort'])) $sortBy = 'deleted_at';
        if (!in_array(strtoupper($order), ['ASC', 'DESC'])) $order = 'DESC';

        $scope = $this->getScope($auth, 'leads', 'read');
        if ($scope === 'all') {
            // No filters
        } else if ($scope === 'team' || $scope === 'own') {
            $teamMemberIds = [$auth['user_id']];
            if ($scope === 'team') {
                $stmtTeam = $this->db->prepare("
                    SELECT id FROM users 
                    WHERE team_id IN (
                        SELECT id FROM teams 
                        WHERE FIND_IN_SET(?, CONCAT(leader_id, CHAR(44), COALESCE(co_leader_ids, leader_id)))
                    ) OR team_id = (SELECT team_id FROM users WHERE id = ?)
                ");
                $stmtTeam->execute([$auth['user_id'], $auth['user_id']]);
                $fetchedIds = $stmtTeam->fetchAll(PDO::FETCH_COLUMN);
                if ($fetchedIds) {
                    foreach ($fetchedIds as $fid) {
                        $teamMemberIds[] = (int)$fid;
                    }
                }
                $teamMemberIds = array_unique($teamMemberIds);
            }

            $idsClause = implode(',', $teamMemberIds);
            
            $collabChecks = [];
            foreach ($teamMemberIds as $id) {
                $collabChecks[] = "FIND_IN_SET(" . (int)$id . ", c.collaborator_ids)";
            }
            $collabClause = implode(' OR ', $collabChecks);
            
            $coopChecks = [];
            foreach ($teamMemberIds as $id) {
                $coopChecks[] = "JSON_CONTAINS(JSON_KEYS(CASE WHEN (shares_json IS NOT NULL AND JSON_VALID(shares_json)) THEN shares_json ELSE '{}' END), JSON_QUOTE(CAST(" . (int)$id . " AS CHAR)))";
            }
            $coopClause = implode(' OR ', $coopChecks);

            $where[] = "(c.owner_id IN ($idsClause) OR c.created_by IN ($idsClause) OR ($collabClause) OR c.id IN (
                SELECT contact_id FROM quyen_truy_cap WHERE user_id IN ($idsClause)
            ) OR c.id IN (
                SELECT contact_id FROM cooperation_slips WHERE $coopClause
            ))";
        } else {
            $where[] = '1=0';
        }

        // Bước 3: MKT không ghi nhận và không xem khách cá nhân — chỉ Sale nhập, tự xem, tự tương tác
        if (in_array(strtolower($auth['role'] ?? ''), ['mkt', 'marketing'], true)) {
            $where[] = "LOWER(COALESCE(c.source, '')) NOT IN ('ca_nhan', 'cá nhân', 'gioi_thieu', 'giới thiệu', 'personal', 'referral', 'manual', 'self')";
            $where[] = "LOWER(COALESCE(c.lead_phan_loai, '')) NOT IN ('ca_nhan', 'cá nhân', 'gioi_thieu', 'giới thiệu', 'personal', 'referral', 'manual', 'self')";
            $where[] = "LOWER(COALESCE(c.loai_lead, '')) NOT IN ('ca_nhan', 'cá nhân', 'gioi_thieu', 'giới thiệu', 'personal', 'referral', 'manual', 'self')";
        }

        if (!empty($search)) {
            $this->applySmartSearch((string)$search, $where, $params);
        }
        $knownPipelineStatuses = [
            'chua_xac_dinh', 'cham_soc_dai_han', 'quan_tam', 'dong_y_gap', 'thien_chi',
            'da_gap', 'booking', 'dat_coc', 'da_coc', 'dong_deal', 'thanh_cong', 'not_lead', 'reclaimed'
        ];
        if ($status && in_array($status, $knownPipelineStatuses, true)) {
            if (empty($pipelineStatus)) {
                $pipelineStatus = $status;
            }
            $status = '';
        }
        if ($status) { $where[] = 'c.status = ?'; $params[] = $status; }
        if ($source) { $where[] = 'c.source = ?'; $params[] = $source; }
        if ($owner)  { $where[] = 'c.owner_id = ?'; $params[] = (int)$owner; }
        if ($companyId) { $where[] = 'c.company_id = ?'; $params[] = (int)$companyId; }
        if ($projectId !== '') { $where[] = 'c.project_id = ?'; $params[] = (int)$projectId; }
        if ($campaignId !== '') { $where[] = 'c.campaign_id = ?'; $params[] = (string)$campaignId; }
        if ($tag !== '') {
            $where[] = '(c.tags LIKE ? OR c.tags LIKE ?)';
            $params[] = '%"' . $tag . '"%';
            $params[] = '%' . $tag . '%';
        }
        
        $isMinimal = isset($_GET['minimal']) && (string)$_GET['minimal'] === '1';

        $isSaleRole = in_array(strtolower((string)($auth['role'] ?? '')), ['sale', 'sales', 'consultant'], true);
        $errorCond = "(
            EXISTS (
                SELECT 1 FROM leads l2 
                JOIN distribution_logs dl2 ON dl2.lead_id = l2.id 
                WHERE (l2.id = c.lead_id OR (l2.person_id = c.person_id AND c.person_id > 0))
                  AND dl2.assigned_to = c.owner_id
                  AND dl2.status IN ('duplicate', 'error', 'blacklisted')
            )
            OR EXISTS (
                SELECT 1 FROM data_reports dr
                LEFT JOIN leads l3 ON dr.lead_id = l3.id
                WHERE (dr.lead_id = c.lead_id OR (l3.person_id = c.person_id AND c.person_id > 0))
                  AND (dr.consultant_id = c.owner_id OR c.owner_id IS NULL)
                  AND dr.status IN ('pending', 'approved', 'approved_no_comp')
            )
        )";

        if ($dataType !== '') {
            if ($dataType === 'error_ticket' && !$isSaleRole) {
                $where[] = $errorCond;
            } else {
                $where[] = "NOT $errorCond";
                if ($dataType === 'distributed') {
                    $where[] = "(
                        (c.collaborator_ids IS NOT NULL AND c.collaborator_ids != '')
                        OR
                        (EXISTS (
                            SELECT 1 FROM distribution_logs dl
                            INNER JOIN leads l ON dl.lead_id = l.id
                            WHERE l.person_id = c.person_id AND dl.status IN ('assigned', 'grabbed', 'compensation', 'rule_6_month', 'pending_work_hours', 'fallback', 'success', 'reminder')
                        ) AND c.source != 'databank' AND (c.collaborator_ids IS NULL OR c.collaborator_ids = ''))
                    )";
                } else if ($dataType === 'personal') {
                    $where[] = "(
                        (c.source = 'databank' OR EXISTS (
                            SELECT 1 FROM distribution_logs dl
                            INNER JOIN leads l ON dl.lead_id = l.id
                            WHERE l.person_id = c.person_id AND dl.status = 'databank_claim'
                        ))
                        OR
                        (NOT EXISTS (
                            SELECT 1 FROM distribution_logs dl
                            INNER JOIN leads l ON dl.lead_id = l.id
                            WHERE l.person_id = c.person_id AND dl.status != 'databank_claim'
                        ) AND c.source != 'databank' AND (c.collaborator_ids IS NULL OR c.collaborator_ids = ''))
                    )";
                }
            }
        } else if ($isSaleRole && !$isMinimal) {
            $where[] = "NOT $errorCond";
        }

        // Rule: Not Lead is completely hidden from Sales (both pending proposal and approved/not approved)
        if ($isSaleRole) {
            $where[] = "(COALESCE(c.pipeline_status, '') != 'not_lead' AND COALESCE(c.status, '') != 'not_lead' AND COALESCE(c.not_lead_proposed, 0) = 0)";
        }
        
        if ($from !== '') {
            $whereField = in_array($dateField, ['created_at', 'updated_at', 'last_contact']) ? $dateField : 'created_at';
            $where[] = "c.{$whereField} >= ?";
            $params[] = $from . ' 00:00:00';
        }
        if ($to !== '') {
            $whereField = in_array($dateField, ['created_at', 'updated_at', 'last_contact']) ? $dateField : 'created_at';
            $where[] = "c.{$whereField} <= ?";
            $params[] = $to . ' 23:59:59';
        }

        switch ($segment) {
            case 'hot':        $where[] = 'c.lead_score >= 80'; break;
            case 'customer':   $where[] = "c.status = 'customer'"; break;
            case 'has_deal':   $where[] = "EXISTS (SELECT 1 FROM deals d WHERE d.contact_id = c.id AND d.deleted_at IS NULL)"; break;
            case 'no_contact': $where[] = "c.last_contact < DATE_SUB(NOW(), INTERVAL 30 DAY)"; break;
            case 'not_contacted': $where[] = "NOT EXISTS (SELECT 1 FROM activities WHERE related_type = 'contact' AND related_id = c.id) AND NOT EXISTS (SELECT 1 FROM notes WHERE entity_type = 'contact' AND entity_id = c.id)"; break;
            case 'new_week':   $where[] = "c.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)"; break;
        }

        if ($ownership === 'mine') {
            $currentUserId = $owner ? (int)$owner : (int)($auth['user_id'] ?? 0);
            if ($currentUserId > 0) {
                $where[] = "(c.owner_id = ? AND (c.collaborator_ids IS NULL OR c.collaborator_ids = '' OR c.collaborator_ids = '0'))";
                $params[] = $currentUserId;
            } else {
                $where[] = "(c.collaborator_ids IS NULL OR c.collaborator_ids = '' OR c.collaborator_ids = '0')";
            }
        } else if ($ownership === 'cooperation') {
            $currentUserId = $owner ? (int)$owner : (int)($auth['user_id'] ?? 0);
            if ($currentUserId > 0) {
                $where[] = "((FIND_IN_SET(?, c.collaborator_ids) OR (c.owner_id = ? AND c.collaborator_ids IS NOT NULL AND c.collaborator_ids != '' AND c.collaborator_ids != '0')) OR EXISTS (SELECT 1 FROM cooperation_slips cs WHERE cs.contact_id = c.id AND (cs.created_by = ? OR JSON_CONTAINS(JSON_KEYS(CASE WHEN (cs.shares_json IS NOT NULL AND JSON_VALID(cs.shares_json)) THEN cs.shares_json ELSE '{}' END), JSON_QUOTE(CAST(? AS CHAR))))))";
                $params[] = $currentUserId;
                $params[] = $currentUserId;
                $params[] = $currentUserId;
                $params[] = $currentUserId;
            } else {
                $where[] = "((c.collaborator_ids IS NOT NULL AND c.collaborator_ids != '' AND c.collaborator_ids != '0') OR EXISTS (SELECT 1 FROM cooperation_slips cs WHERE cs.contact_id = c.id))";
            }
        }

        if ($budgetRange === 'under_2b') {
            $where[] = "((c.budget > 0 AND c.budget < 2000000000) OR c.budget_range LIKE '%< 2%' OR c.budget_range LIKE '%duoi 2%' OR c.budget_range LIKE '%dưới 2%')";
        } else if ($budgetRange === '2b_5b') {
            $where[] = "((c.budget >= 2000000000 AND c.budget <= 5000000000) OR c.budget_range LIKE '%2 - 5%' OR c.budget_range LIKE '%2-5%')";
        } else if ($budgetRange === '5b_10b') {
            $where[] = "((c.budget > 5000000000 AND c.budget <= 10000000000) OR c.budget_range LIKE '%5 - 10%' OR c.budget_range LIKE '%5-10%')";
        } else if ($budgetRange === 'over_10b') {
            $where[] = "((c.budget > 10000000000) OR c.budget_range LIKE '%> 10%' OR c.budget_range LIKE '%tren 10%' OR c.budget_range LIKE '%trên 10%')";
        }

        // Snapshot base WHERE and params for computing stage counts across all tabs
        $stageCountWhere = $where;
        $stageCountParams = $params;

        // Apply stage filter or pipeline_status filter to the specific query
        if ($pipelineStatus !== '' && !$isReclaimedView) {
            if ($pipelineStatus === 'dong_y_gap' || $pipelineStatus === 'thien_chi') {
                $where[] = "(c.pipeline_status IN ('dong_y_gap', 'thien_chi'))";
            } else if ($pipelineStatus === 'dat_coc' || $pipelineStatus === 'da_coc') {
                $where[] = "(c.pipeline_status IN ('dat_coc', 'da_coc'))";
            } else if ($pipelineStatus === 'dong_deal' || $pipelineStatus === 'thanh_cong') {
                $where[] = "(c.pipeline_status IN ('dong_deal', 'thanh_cong'))";
            } else {
                $where[] = 'c.pipeline_status = ?';
                $params[] = $pipelineStatus;
            }
        }
        if ($stage)  { $where[] = 'c.stage_id = ?'; $params[] = (int)$stage; }

        $whereStr = implode(' AND ', $where);

        $orderSql = "c.$sortBy $order";
        if (!empty($search)) {
            $cleanSearch = trim($search);
            $cleanSearchQuoted = $this->db->quote($cleanSearch);
            $cleanSearchPrefix = $this->db->quote($cleanSearch . '%');
            $orderSql = "
                CASE 
                    WHEN c.phone = $cleanSearchQuoted THEN 1
                    WHEN CONCAT(COALESCE(c.last_name, ''), ' ', COALESCE(c.first_name, '')) = $cleanSearchQuoted THEN 2
                    WHEN CONCAT(COALESCE(c.first_name, ''), ' ', COALESCE(c.last_name, '')) = $cleanSearchQuoted THEN 3
                    WHEN CONCAT(COALESCE(c.last_name, ''), ' ', COALESCE(c.first_name, '')) LIKE $cleanSearchPrefix THEN 4
                    WHEN CONCAT(COALESCE(c.first_name, ''), ' ', COALESCE(c.last_name, '')) LIKE $cleanSearchPrefix THEN 5
                    ELSE 6
                END ASC, c.$sortBy $order";
        }

        // Fast-path lightweight mode (minimal=1) for modal/selector dropdowns (CheckIn, Cooperation, Deposit, Ticket, Finance)
        if ($isMinimal) {
            $stmtMin = $this->db->prepare("
                SELECT c.id, c.first_name, c.last_name, c.phone, c.email, c.avatar_url,
                       c.expected_revenue, c.project_id, c.owner_id, c.status,
                       c.pipeline_status, c.collaborator_ids
                FROM contacts c
                WHERE $whereStr
                ORDER BY $orderSql
                LIMIT $limit OFFSET $offset
            ");
            $stmtMin->execute($params);
            $minData = $stmtMin->fetchAll(PDO::FETCH_ASSOC);
            $minCount = count($minData);
            if ($page === 1 && $minCount < $limit) {
                $totalMin = $minCount;
            } else {
                $countMin = $this->db->prepare("SELECT COUNT(*) FROM contacts c WHERE $whereStr");
                $countMin->execute($params);
                $totalMin = (int)$countMin->fetchColumn();
            }
            respond(200, [
                'items' => $minData,
                'total' => $totalMin,
                'page' => $page,
                'limit' => $limit,
                'total_pages' => ceil($totalMin / $limit),
                'stage_counts' => []
            ]);
            return;
        }

        $count = $this->db->prepare("SELECT COUNT(*) FROM contacts c WHERE $whereStr");
        $count->execute($params);
        $total = (int)$count->fetchColumn();

        // Calculate counts per pipeline stage for quick status tabs
        $stageCounts = [];
        try {
            $activeScWhere = $stageCountWhere;
            if ($isReclaimedView) {
                $activeScWhere = ['c.tenant_id = ?', 'c.deleted_at IS NULL', 'c.owner_id IS NOT NULL'];
                foreach (array_slice($stageCountWhere, 3) as $cond) {
                    $activeScWhere[] = $cond;
                }
            }
            $scWhereStr = implode(' AND ', $activeScWhere);
            $scStmt = $this->db->prepare("SELECT c.pipeline_status, COUNT(*) as cnt FROM contacts c WHERE $scWhereStr GROUP BY c.pipeline_status");
            $scStmt->execute($stageCountParams);
            $stageCounts = $scStmt->fetchAll(PDO::FETCH_KEY_PAIR) ?: [];

            // Also compute reclaimed count for Admin / Manager / Director
            if (!in_array($auth['role'] ?? '', ['sale', 'sales', 'consultant', 'viewer'], true)) {
                if ($isReclaimedView) {
                    $stageCounts['reclaimed'] = $total;
                } else {
                    $reclaimedWhere = [
                        'c.tenant_id = ?',
                        'c.deleted_at IS NOT NULL',
                        'NOT EXISTS (SELECT 1 FROM persons p_del WHERE p_del.id = c.person_id AND COALESCE(p_del.deleted_from_databank, 0) = 1)'
                    ];
                    foreach (array_slice($stageCountWhere, 3) as $cond) {
                        $reclaimedWhere[] = $cond;
                    }
                    $rcWhereStr = implode(' AND ', $reclaimedWhere);
                    $rcStmt = $this->db->prepare("SELECT COUNT(*) FROM contacts c WHERE $rcWhereStr");
                    $rcStmt->execute($stageCountParams);
                    $stageCounts['reclaimed'] = (int)$rcStmt->fetchColumn();
                }
            }
        } catch (\Exception $e) {
            $stageCounts = [];
        }

        $stmt = $this->db->prepare("
            SELECT c.*, 
                   CASE 
                       WHEN comp.deleted_at IS NOT NULL THEN CONCAT(comp.name, ' (Đã xóa)')
                       ELSE comp.name 
                   END as company_name,
                   u.full_name as owner_name,
                   u.avatar_url as owner_avatar,
                   ps.name as stage_name, ps.color as stage_color,
                   dl.received_at as distributed_at,
                   dl.status as dl_status,
                   CASE 
                       WHEN c.source = 'databank' 
                            OR c.lead_phan_loai = 'databank' 
                            OR dl.status = 'databank_claim'
                       THEN 1 
                       ELSE 0 
                   END as from_databank,
                   dl.round_id as dl_round_id,
                   r.round_name,
                   dl.id as log_id,
                   l.id as lead_id,
                   l.note as lead_note,
                   l.type as lead_type,
                   l.source as lead_source,
                   COALESCE(NULLIF(c.lead_phan_loai, ''), NULLIF(l.lead_phan_loai, ''), c.source) as lead_phan_loai,
                   COALESCE(NULLIF(c.loai_lead, ''), NULLIF(l.loai_lead, ''), c.customer_type) as loai_lead,
                   l.lead_phan_loai as lead_lead_phan_loai,
                   l.loai_lead as lead_loai_lead,
                   l.platform as lead_platform,
                   l.donvi_chay as lead_donvi_chay,
                   l.ad_name as lead_ad_name,
                   l.form_name as lead_form_name,
                   l.link_video_ads as lead_link_video_ads,
                   l.preferred_location as lead_preferred_location,
                   l.bedroom_count as lead_bedroom_count,
                   l.property_type as lead_property_type,
                   l.demand_type as lead_demand_type,
                   l.budget as lead_budget,
                   dr.status as report_status,
                   dr.id as report_id,
                   dr.reason as report_reason
            FROM contacts c
            LEFT JOIN companies comp ON c.company_id = comp.id
            LEFT JOIN users u ON c.owner_id = u.id
            LEFT JOIN pipeline_stages ps ON c.stage_id = ps.id
            LEFT JOIN leads l ON l.id = COALESCE(c.lead_id, (
                SELECT MAX(id) FROM leads WHERE person_id = c.person_id
            ))
            LEFT JOIN distribution_logs dl ON dl.id = (
                SELECT MAX(id) FROM distribution_logs 
                WHERE lead_id = l.id AND assigned_to = c.owner_id
            )
            LEFT JOIN distribution_rounds r ON COALESCE(dl.round_id, l.target_round_id) = r.id
            LEFT JOIN data_reports dr ON dr.id = (
                SELECT MAX(id) FROM data_reports 
                WHERE lead_id = l.id AND consultant_id = c.owner_id
            )
            WHERE $whereStr
            ORDER BY $orderSql
            LIMIT $limit OFFSET $offset
        ");
        $stmt->execute($params);
        $data = $stmt->fetchAll();
        // Parse JSON tags & enrich collaborator_ids from active cooperation slips if not already synced
        $contactIds = array_column($data, 'id');
        if (!empty($contactIds)) {
            $inContacts = implode(',', array_fill(0, count($contactIds), '?'));
            $stmtCslips = $this->db->prepare("SELECT contact_id, shares_json FROM cooperation_slips WHERE contact_id IN ($inContacts) AND status IN ('approved', 'pending_signatures', 'pending_manager_approval', 'approved_pending_signatures')");
            $stmtCslips->execute($contactIds);
            $cSlips = $stmtCslips->fetchAll(PDO::FETCH_ASSOC);

            $slipCollabsMap = [];
            foreach ($cSlips as $cs) {
                $shares = json_decode($cs['shares_json'] ?? '[]', true) ?: [];
                $cid = (int)$cs['contact_id'];
                foreach (array_keys($shares) as $uid) {
                    $uInt = (int)$uid;
                    if ($uInt > 0) {
                        $slipCollabsMap[$cid][$uInt] = true;
                    }
                }
            }

            foreach ($data as &$row) {
                $row['tags'] = json_decode($row['tags'] ?? '[]');
                $cid = (int)$row['id'];
                $ownerId = (int)($row['owner_id'] ?? 0);
                $existingCollabs = array_filter(array_map('intval', explode(',', $row['collaborator_ids'] ?? '')));
                if (isset($slipCollabsMap[$cid])) {
                    $coopUids = array_keys($slipCollabsMap[$cid]);
                    $nonOwnerCoop = array_filter($coopUids, function($uid) use ($ownerId) { return $uid !== $ownerId; });
                    $merged = array_values(array_unique(array_merge($existingCollabs, $nonOwnerCoop)));
                    if (!empty($merged)) {
                        $row['collaborator_ids'] = implode(',', $merged);
                    }
                }
            }
        } else {
            foreach ($data as &$row) $row['tags'] = json_decode($row['tags'] ?? '[]');
        }

        respond(200, [
            'items' => $data, 'total' => $total,
            'page' => $page, 'limit' => $limit,
            'total_pages' => ceil($total / $limit),
            'stage_counts' => $stageCounts
        ]);
    }

    private function applySmartSearch(string $search, array &$where, array &$params): void {
        $search = trim($search);
        if ($search === '') return;

        $conds = [];
        $searchParams = [];

        // 1. Direct ID or Person ID if numeric
        if (ctype_digit($search)) {
            $conds[] = "c.id = ?";
            $searchParams[] = (int)$search;
            $conds[] = "c.person_id = ?";
            $searchParams[] = (int)$search;
        }

        // 2. Clean digits for phone numbers (strip spaces, dots, dashes, parentheses, +84)
        $cleanDigits = preg_replace('/[^\d]/', '', $search);
        if (strlen($cleanDigits) >= 3) {
            $conds[] = "c.phone LIKE ?";
            $searchParams[] = "%{$cleanDigits}%";
            $conds[] = "c.mobile LIKE ?";
            $searchParams[] = "%{$cleanDigits}%";

            // If 9 or more digits, match last 9 digits (handles 09xx vs +849xx vs 849xx)
            if (strlen($cleanDigits) >= 9) {
                $last9 = substr($cleanDigits, -9);
                $conds[] = "c.phone LIKE ?";
                $searchParams[] = "%{$last9}%";
                $conds[] = "c.mobile LIKE ?";
                $searchParams[] = "%{$last9}%";
            }
        }

        // 3. Search variants (handling Vietnamese 'd' <-> 'đ')
        $variants = [$search];
        if (mb_stripos($search, 'd') !== false) {
            $variants[] = str_ireplace('d', 'đ', $search);
        }
        if (mb_stripos($search, 'đ') !== false) {
            $variants[] = str_ireplace(['đ', 'Đ'], ['d', 'D'], $search);
        }
        $variants = array_unique($variants);

        foreach ($variants as $sv) {
            // Forward name (first_name + last_name)
            $conds[] = "CONCAT(COALESCE(c.first_name, ''), ' ', COALESCE(c.last_name, '')) LIKE ?";
            $searchParams[] = "%{$sv}%";

            // Reverse name (last_name + first_name, standard Vietnamese display)
            $conds[] = "CONCAT(COALESCE(c.last_name, ''), ' ', COALESCE(c.first_name, '')) LIKE ?";
            $searchParams[] = "%{$sv}%";

            // Individual fields
            $conds[] = "c.first_name LIKE ?";
            $searchParams[] = "%{$sv}%";
            $conds[] = "c.last_name LIKE ?";
            $searchParams[] = "%{$sv}%";
            $conds[] = "c.phone LIKE ?";
            $searchParams[] = "%{$sv}%";
            $conds[] = "c.mobile LIKE ?";
            $searchParams[] = "%{$sv}%";
            $conds[] = "c.email LIKE ?";
            $searchParams[] = "%{$sv}%";

            // Persons full_name and phone
            $conds[] = "EXISTS (SELECT 1 FROM persons p WHERE p.id = c.person_id AND (p.full_name LIKE ? OR p.phone LIKE ?))";
            $searchParams[] = "%{$sv}%";
            $searchParams[] = "%{$sv}%";

            // Multi-word permutation & wildcarding
            $words = array_values(array_filter(preg_split('/\s+/u', $sv)));
            if (count($words) >= 2) {
                // Inverted phrase e.g. "Thanh Anh" <-> "Anh Thanh"
                $reversedPhrase = implode(' ', array_reverse($words));
                $conds[] = "CONCAT(COALESCE(c.first_name, ''), ' ', COALESCE(c.last_name, '')) LIKE ?";
                $searchParams[] = "%{$reversedPhrase}%";
                $conds[] = "CONCAT(COALESCE(c.last_name, ''), ' ', COALESCE(c.first_name, '')) LIKE ?";
                $searchParams[] = "%{$reversedPhrase}%";

                // Wildcard permutations across name combinations
                $fwdWildcard = '%' . implode('%', $words) . '%';
                $conds[] = "CONCAT(COALESCE(c.first_name, ''), ' ', COALESCE(c.last_name, '')) LIKE ?";
                $searchParams[] = $fwdWildcard;
                $conds[] = "CONCAT(COALESCE(c.last_name, ''), ' ', COALESCE(c.first_name, '')) LIKE ?";
                $searchParams[] = $fwdWildcard;

                $revWildcard = '%' . implode('%', array_reverse($words)) . '%';
                $conds[] = "CONCAT(COALESCE(c.first_name, ''), ' ', COALESCE(c.last_name, '')) LIKE ?";
                $searchParams[] = $revWildcard;
                $conds[] = "CONCAT(COALESCE(c.last_name, ''), ' ', COALESCE(c.first_name, '')) LIKE ?";
                $searchParams[] = $revWildcard;
            }
        }

        if (!empty($conds)) {
            $where[] = '(' . implode(' OR ', $conds) . ')';
            $params = array_merge($params, $searchParams);
        }
    }

    private function resolveCompanyId(array $auth, array $b): ?int {
        $name = isset($b['company_name']) ? trim($b['company_name']) : '';
        if ($name !== '') {
            $stmt = $this->db->prepare("SELECT id FROM companies WHERE tenant_id=? AND name=?");
            $stmt->execute([$auth['tenant_id'], $name]);
            $id = $stmt->fetchColumn();
            if ($id) return (int)$id;
            
            $stmt = $this->db->prepare("INSERT INTO companies (tenant_id, name, owner_id, created_by) VALUES (?, ?, ?, ?)");
            $stmt->execute([$auth['tenant_id'], $name, $auth['user_id'], $auth['user_id']]);
            return (int)$this->db->lastInsertId();
        }
        if (!empty($b['company_id'])) return (int)$b['company_id'];
        return null;
    }

    public function store(array $auth): void {
        if ($auth['role'] === 'viewer') respond(403, null, 'Bạn không có quyền thêm mới', false);
        $b = getBody();
        $required = ['first_name'];
        foreach ($required as $f) {
            if (empty($b[$f])) respond(422, null, "Trường '$f' là bắt buộc", false);
        }
        
        $company_id = $this->resolveCompanyId($auth, $b);
        $tags = json_encode($b['tags'] ?? []);
        
        // Blocked Lead Check
        $phone = $b['phone'] ?? $b['mobile'] ?? null;
        $email = $b['email'] ?? null;
        if ($phone || $email) {
            require_once __DIR__ . '/../webhook_logic.php';
            if (isLeadBlocked($this->db, $phone, $email)) {
                respond(422, null, "Liên hệ này đã bị chặn vĩnh viễn trong hệ thống (Blocked).", false);
            }
        }

        // Duplicate Phone Check
        $duplicateFlag = 0;
        $duplicateWithId = null;
        if ($phone) {
            require_once __DIR__ . '/../webhook_logic.php';
            $phone = normalizePhone($phone);
            
            $check = $this->db->prepare("SELECT id, source, created_at, pipeline_status FROM contacts WHERE tenant_id=? AND (phone=? OR mobile=?) AND deleted_at IS NULL ORDER BY id DESC LIMIT 1");
            $check->execute([$auth['tenant_id'], $phone, $phone]);
            $existing = $check->fetch();
            if (!$existing) {
                $checkL = $this->db->prepare("SELECT id, source, created_at, status as pipeline_status FROM leads WHERE phone=? ORDER BY id DESC LIMIT 1");
                $checkL->execute([$phone]);
                $existing = $checkL->fetch();
            }
            if ($existing) {
                $newSource = $b['source'] ?? 'other';
                $isPersonal = in_array($newSource, ['ca_nhan', 'gioi_thieu'], true);
                
                $washingDays = 30; // default 30 days
                $existingCreatedTime = strtotime($existing['created_at']);
                $isActiveAndRecent = ($existing['pipeline_status'] !== 'rejected' && (time() - $existingCreatedTime) <= ($washingDays * 24 * 3600));

                $existingSource = strtolower($existing['source'] ?? '');
                $isOldSourceMkt = !in_array($existingSource, ['ca_nhan', 'gioi_thieu', 'databank', 'kho_data'], true);

                if ($isPersonal && $isActiveAndRecent) {
                    $duplicateFlag = 1;
                    $duplicateWithId = (int)$existing['id'];
                    $oldMktSource = $existing['source'] ?? 'Marketing';
                    $isRuaNguonMkt = $isOldSourceMkt;
                } else {
                    respond(422, null, "Số điện thoại '$phone' đã tồn tại trong hệ thống. Vui lòng kiểm tra lại.", false);
                }
            }
        }
        
        // Duplicate Email Check
        $email = $b['email'] ?? null;
        if ($email) {
            $checkEmail = $this->db->prepare("SELECT id FROM contacts WHERE tenant_id=? AND email=? AND deleted_at IS NULL LIMIT 1");
            $checkEmail->execute([$auth['tenant_id'], $email]);
            if ($checkEmail->fetch()) {
                respond(422, null, "Email '$email' đã tồn tại trong hệ thống.", false);
            }
        }

        $stageId = $b['stage_id'] ?? null;
        if (!$stageId) {
            $s = $this->db->prepare("SELECT id FROM pipeline_stages WHERE tenant_id=? ORDER BY order_index LIMIT 1");
            $s->execute([$auth['tenant_id']]); $stageId = $s->fetchColumn();
        }

        // Resolve person_id (Master Identity Link)
        $personId = null;
        if ($phone) {
            require_once __DIR__ . '/../webhook_logic.php';
            $phoneClean = normalizePhone($phone);
            if ($phoneClean) {
                $fullName = trim($b['first_name'] . ' ' . ($b['last_name'] ?? ''));
                $stmtPerson = $this->db->prepare("
                    INSERT INTO persons (phone, email, full_name, is_public) 
                    VALUES (?, ?, ?, 0) 
                    ON DUPLICATE KEY UPDATE 
                        email = IF(email IS NULL OR email = '', VALUES(email), email),
                        full_name = IF(full_name IS NULL OR full_name = '', VALUES(full_name), full_name)
                ");
                $stmtPerson->execute([$phoneClean, $email, $fullName]);

                $stmtGetP = $this->db->prepare("SELECT id FROM persons WHERE phone = ? LIMIT 1");
                $stmtGetP->execute([$phoneClean]);
                $personId = $stmtGetP->fetchColumn();
            }
        }

        $birthday = empty($b['birthday']) ? null : $b['birthday'];
        $last_contact = empty($b['last_contact']) ? null : $b['last_contact'];

        $projectId = !empty($b['project_id']) ? (int)$b['project_id'] : null;
        $campaignId = (!empty($b['campaign_id']) && $b['campaign_id'] !== '0' && $b['campaign_id'] !== 0) ? trim((string)$b['campaign_id']) : null;
        if ($campaignId && ctype_digit($campaignId) && !$projectId) {
            $stmtCampProj = $this->db->prepare("SELECT project_id FROM marketing_campaigns WHERE id = ?");
            $stmtCampProj->execute([(int)$campaignId]);
            $campProjId = $stmtCampProj->fetchColumn();
            if ($campProjId) {
                $projectId = (int)$campProjId;
            }
        }

        $rawSource = trim((string)($b['source'] ?? 'other'));
        $rawPhanLoai = trim((string)($b['lead_phan_loai'] ?? ''));
        $isPersonalCreate = in_array(mb_strtolower($rawSource), ['ca_nhan', 'cá nhân', 'gioi_thieu', 'giới thiệu', 'personal', 'referral', 'manual', 'self'], true)
            || in_array(mb_strtolower($rawPhanLoai), ['ca_nhan', 'cá nhân', 'gioi_thieu', 'giới thiệu', 'personal', 'referral', 'manual', 'self'], true);

        if ($isPersonalCreate && in_array(strtolower($auth['role'] ?? ''), ['mkt', 'marketing'], true)) {
            respond(403, null, 'Bộ phận Marketing không ghi nhận khách hàng cá nhân. Chỉ Sale tự nhập và tương tác khách hàng cá nhân.', false);
        }
        if ($isPersonalCreate && $rawPhanLoai === '') {
            $rawPhanLoai = in_array(mb_strtolower($rawSource), ['gioi_thieu', 'giới thiệu', 'referral'], true) ? 'giới thiệu' : 'ca_nhan';
        }

        $stmt = $this->db->prepare("
            INSERT INTO contacts (tenant_id,company_id,owner_id,created_by,first_name,last_name,
                email,phone,mobile,job_title,department,source,lead_phan_loai,status,tags,notes,stage_id,
                birthday,address,city,ward,expected_revenue,win_probability,last_contact,lead_score,person_id,collaborator_ids,nguoi_gioi_thieu_id,project_id,campaign_id,security_expires_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL)
        ");
        $stmt->execute([
            $auth['tenant_id'],
            $company_id, (in_array($auth['role'], ['sale', 'sales'], true)) ? $auth['user_id'] : (!empty($b['owner_id']) ? (int)$b['owner_id'] : $auth['user_id']),
            $auth['user_id'], $b['first_name'], $b['last_name'] ?? '',
            $email, $phone, $phone,
            $b['job_title'] ?? null, $b['department'] ?? null,
            $rawSource, $rawPhanLoai !== '' ? $rawPhanLoai : null, $b['status'] ?? 'lead',
            $tags, $b['notes'] ?? null, $stageId,
            $birthday, $b['address'] ?? null, $b['city'] ?? null, $b['ward'] ?? null,
            $b['expected_revenue'] ?? 0, $b['win_probability'] ?? 50,
            $last_contact, $b['lead_score'] ?? 0,
            $personId,
            $b['collaborator_ids'] ?? null,
            !empty($b['nguoi_gioi_thieu_id']) ? (int)$b['nguoi_gioi_thieu_id'] : null,
            $projectId,
            $campaignId
        ]);
        $id = (int)$this->db->lastInsertId();
        if ($isPersonalCreate && $personId) {
            $this->db->prepare("UPDATE persons SET is_public = 0, released_to_kho_at = NULL WHERE id = ?")->execute([$personId]);
        }
        if ($duplicateFlag) {
            $upd = $this->db->prepare("UPDATE contacts SET duplicate_flag = 1, duplicate_with_id = ? WHERE id = ?");
            $upd->execute([$duplicateWithId, $id]);

            logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'DUPLICATE_FLAG', 'contact', $id, json_encode(['duplicate_with' => $duplicateWithId, 'phone' => $phone]));

            // Send notification to managers, admins & marketing (Chống rửa nguồn - Mục 14)
            $stmtAdmins = $this->db->prepare("
                SELECT id FROM users 
                WHERE tenant_id = ? AND role IN ('admin', 'superadmin', 'super_admin', 'manager', 'director', 'mkt', 'marketing')
            ");
            $stmtAdmins->execute([$auth['tenant_id']]);
            $admins = $stmtAdmins->fetchAll(PDO::FETCH_COLUMN);

            if (!empty($admins)) {
                $isMktWarn = !empty($isRuaNguonMkt);
                $title = $isMktWarn ? "Cảnh báo rửa nguồn data Marketing" : "Cảnh báo trùng số khách hàng";
                $srcText = !empty($oldMktSource) ? $oldMktSource : 'Marketing';
                $body = "Sale " . ($auth['full_name'] ?? 'Nhân viên') . " đã nhập tay khách hàng trùng SĐT ($phone) trước đó là nguồn " . ($isMktWarn ? "Marketing ($srcText)" : $srcText) . " trong vòng 30 ngày.";
                $type = "warning";
                $link = "/contacts?id=" . $id;

                $insertNotif = $this->db->prepare("
                    INSERT INTO notifications (user_id, tenant_id, title, body, type, link)
                    VALUES (?, ?, ?, ?, ?, ?)
                ");
                foreach ($admins as $adminId) {
                    if ((int)$adminId !== (int)$auth['user_id']) {
                        $insertNotif->execute([$adminId, $auth['tenant_id'], $title, $body, $type, $link]);
                    }
                }
            }
        }

        // Send co-care invitation notification to collaborators added during creation
        if (!empty($b['collaborator_ids'])) {
            $newCollabs = array_filter(array_map('trim', explode(',', $b['collaborator_ids'] ?? '')));
            if (!empty($newCollabs)) {
                $fullName = trim($b['first_name'] . ' ' . ($b['last_name'] ?? ''));
                require_once __DIR__ . '/../NotificationService.php';
                foreach ($newCollabs as $collabRawId) {
                    $collabRawId = (int)$collabRawId;
                    if ($collabRawId > 0) {
                        $targetUserId = $collabRawId;
                        $stmtMap = $this->db->prepare("
                            SELECT u.id FROM users u 
                            LEFT JOIN consultants c ON (u.email = c.email OR u.id = c.id) 
                            WHERE c.id = ? OR u.id = ? 
                            LIMIT 1
                        ");
                        $stmtMap->execute([$collabRawId, $collabRawId]);
                        if ($mappedUId = $stmtMap->fetchColumn()) {
                            $targetUserId = (int)$mappedUId;
                        }

                        if ($targetUserId > 0 && $targetUserId !== (int)$auth['user_id']) {
                            NotificationService::send($this->db, $auth['tenant_id'], 'COOP_INVITATION', [
                                'user_id' => $targetUserId,
                                'customer_name' => $fullName,
                                'inviter_name' => $auth['full_name'] ?? 'đồng nghiệp',
                                'contact_id' => $id
                            ]);
                        }
                    }
                }
            }
        }

        if (isset($b['custom_fields']) && is_array($b['custom_fields'])) {
            saveCustomFields($this->db, $auth['tenant_id'], $id, 'contact', $b['custom_fields']);
        }
        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'CREATE', 'contact', $id, json_encode(['first_name' => $b['first_name'], 'last_name' => $b['last_name'] ?? '']));
        logInteraction($this->db, $auth['tenant_id'], $auth['user_id'], 'note', 'Tạo Khách hàng mới', "Khách hàng \"{$b['first_name']} " . ($b['last_name'] ?? '') . "\" đã được thêm vào hệ thống.", 'contact', $id);
        $this->show($auth, $id);
    }

    public function show(array $auth, int $id): void {
        $sql = "SELECT c.*, 
                    CASE 
                        WHEN comp.deleted_at IS NOT NULL THEN CONCAT(comp.name, ' (Đã xóa)')
                        ELSE comp.name 
                    END as company_name, 
                    u.full_name as owner_name, u.avatar_url as owner_avatar, ps.name as stage_name, ps.color as stage_color,
                    (SELECT COALESCE(SUM(total),0) FROM invoices WHERE contact_id=c.id AND status='paid' AND deleted_at IS NULL) as actual_revenue,
                    (SELECT COUNT(*) FROM invoices WHERE contact_id=c.id AND status='paid' AND deleted_at IS NULL) as paid_invoice_count,
                    (SELECT COALESCE(SUM(ee.amount),0) FROM expense_entities ee JOIN expenses e ON ee.expense_id = e.id WHERE ee.entity_type = 'contact' AND ee.entity_id = c.id AND e.status = 'approved' AND e.deleted_at IS NULL) as total_spent,
                    (SELECT COUNT(*) FROM expense_entities ee JOIN expenses e ON ee.expense_id = e.id WHERE ee.entity_type = 'contact' AND ee.entity_id = c.id AND e.status = 'approved' AND e.deleted_at IS NULL) as expense_count,
                    NULLIF(GREATEST(
                        COALESCE((SELECT MAX(paid_at) FROM invoices WHERE contact_id = c.id AND status = 'paid' AND deleted_at IS NULL), '1970-01-01 00:00:00'),
                        COALESCE((SELECT MAX(e.approved_at) FROM expense_entities ee JOIN expenses e ON ee.expense_id = e.id WHERE ee.entity_type = 'contact' AND ee.entity_id = c.id AND e.status = 'approved' AND e.deleted_at IS NULL), '1970-01-01 00:00:00')
                    ), '1970-01-01 00:00:00') as last_order_at,
                    l.id as lead_id,
                    l.project_id as lead_project_id,
                    (SELECT name FROM projects WHERE id = l.project_id LIMIT 1) as lead_project_name,
                    l.campaign_id as lead_campaign_id,
                    l.campaign_name as lead_campaign_name,
                    l.note as lead_note,
                    l.type as lead_type,
                    l.source as lead_source,
                    COALESCE(NULLIF(c.lead_phan_loai, ''), NULLIF(l.lead_phan_loai, ''), c.source) as lead_phan_loai,
                    COALESCE(NULLIF(c.loai_lead, ''), NULLIF(l.loai_lead, ''), c.customer_type) as loai_lead,
                    l.lead_phan_loai as lead_lead_phan_loai,
                    l.loai_lead as lead_loai_lead,
                    l.platform as lead_platform,
                    l.donvi_chay as lead_donvi_chay,
                    l.ad_name as lead_ad_name,
                    l.form_name as lead_form_name,
                    l.link_video_ads as lead_link_video_ads,
                    l.preferred_location as lead_preferred_location,
                    l.bedroom_count as lead_bedroom_count,
                    l.property_type as lead_property_type,
                    l.demand_type as lead_demand_type,
                    l.budget as lead_budget,
                    COALESCE(l.form_name, c.form_name) as form_name,
                    COALESCE(l.ad_name, c.ad_name) as ad_name,
                    COALESCE(l.ad_id, c.ad_id) as ad_id,
                    COALESCE(l.birthday, c.birthday) as birthday,
                    COALESCE(l.country, c.country) as country,
                    COALESCE(l.city, c.city) as city,
                    COALESCE(l.loai_hinh, l.property_type, c.loai_hinh, c.property_type) as loai_hinh,
                    COALESCE(l.property_type, l.loai_hinh, c.property_type, c.loai_hinh) as property_type,
                    COALESCE(l.hinh_thuc_tt, c.hinh_thuc_tt) as hinh_thuc_tt,
                    COALESCE(l.time_lienhe, c.time_lienhe) as time_lienhe,
                    COALESCE(l.app_lienhe, c.app_lienhe) as app_lienhe,
                    COALESCE(l.nhu_cau, l.demand_type, c.nhu_cau, c.demand_type) as nhu_cau,
                    COALESCE(l.demand_type, l.nhu_cau, c.demand_type, c.nhu_cau) as demand_type,
                    COALESCE(l.tieu_chi, c.tieu_chi) as tieu_chi,
                    COALESCE(l.san_pham, c.san_pham) as san_pham,
                    COALESCE(l.tinh_trang, c.tinh_trang) as tinh_trang,
                    COALESCE(l.client_context, c.client_context) as client_context,
                    COALESCE(l.inbox_url, c.inbox_url) as inbox_url,
                    dl.round_id as dl_round_id,
                    dl.status as dl_status,
                    CASE 
                        WHEN c.source = 'databank' 
                             OR c.lead_phan_loai = 'databank' 
                             OR dl.status = 'databank_claim'
                             OR EXISTS (
                                 SELECT 1 FROM distribution_logs dl_dbk 
                                 WHERE dl_dbk.lead_id = l.id AND dl_dbk.assigned_to = c.owner_id AND dl_dbk.status = 'databank_claim'
                             )
                        THEN 1 
                        ELSE 0 
                    END as from_databank,
                    r.round_name,
                    dr.status as ticket_status,
                    dr.reason as ticket_reason
            FROM contacts c
            LEFT JOIN companies comp ON c.company_id = comp.id
            LEFT JOIN users u ON c.owner_id = u.id
            LEFT JOIN pipeline_stages ps ON c.stage_id = ps.id
            LEFT JOIN leads l ON l.id = COALESCE(
                NULLIF(c.lead_id, 0),
                (SELECT MAX(id) FROM leads WHERE appsheet_id IS NOT NULL AND appsheet_id != '' AND appsheet_id = c.appsheet_id),
                (SELECT MAX(id) FROM leads WHERE person_id = c.person_id AND (c.appsheet_id IS NULL OR c.appsheet_id = '' OR appsheet_id = c.appsheet_id))
            )
            LEFT JOIN distribution_logs dl ON dl.id = (
                SELECT MAX(id) FROM distribution_logs 
                WHERE lead_id = l.id AND assigned_to = c.owner_id
            )
            LEFT JOIN distribution_rounds r ON COALESCE(dl.round_id, l.target_round_id) = r.id
            LEFT JOIN data_reports dr ON dr.id = (
                SELECT MAX(id) FROM data_reports
                WHERE lead_id = l.id AND consultant_id = c.owner_id
            )
            WHERE c.id=? AND c.tenant_id=?";
        
        $p = [$id, $auth['tenant_id']];
        if (in_array(strtolower($auth['role'] ?? ''), ['mkt', 'marketing'], true)) {
            $sql .= " AND COALESCE(LOWER(c.source), '') NOT IN ('ca_nhan', 'cá nhân', 'gioi_thieu', 'giới thiệu', 'personal', 'referral', 'manual', 'self')
                      AND COALESCE(LOWER(c.lead_phan_loai), '') NOT IN ('ca_nhan', 'cá nhân', 'gioi_thieu', 'giới thiệu', 'personal', 'referral', 'manual', 'self')
                      AND COALESCE(LOWER(c.loai_lead), '') NOT IN ('ca_nhan', 'cá nhân', 'gioi_thieu', 'giới thiệu', 'personal', 'referral', 'manual', 'self')
                      AND NOT ((c.lead_id IS NULL OR c.lead_id = 0) AND COALESCE(LOWER(c.source), '') != 'databank')";
        }
        $scope = $this->getScope($auth, 'leads', 'read');
        if ($scope === 'all') {
            // No filters
        } else if ($scope === 'team') {
            $sql .= " AND (c.owner_id=? OR c.owner_id IN (
                SELECT id FROM users WHERE team_id IN (
                    SELECT id FROM teams WHERE FIND_IN_SET(?, CONCAT(leader_id, CHAR(44), COALESCE(co_leader_ids, leader_id)))
                )
            ) OR FIND_IN_SET(?, c.collaborator_ids) OR c.id IN (
                SELECT contact_id FROM cooperation_slips 
                WHERE JSON_CONTAINS(JSON_KEYS(CASE WHEN (shares_json IS NOT NULL AND JSON_VALID(shares_json)) THEN shares_json ELSE \"{}\" END), JSON_QUOTE(CAST(? AS CHAR)))
            ))";
            $p[] = $auth['user_id'];
            $p[] = $auth['user_id'];
            $p[] = $auth['user_id'];
            $p[] = $auth['user_id'];
        } else if ($scope === 'own') {
            $sql .= " AND (c.owner_id=? OR FIND_IN_SET(?, c.collaborator_ids) OR c.id IN (
                SELECT contact_id FROM cooperation_slips 
                WHERE JSON_CONTAINS(JSON_KEYS(CASE WHEN (shares_json IS NOT NULL AND JSON_VALID(shares_json)) THEN shares_json ELSE '{}' END), JSON_QUOTE(CAST(? AS CHAR)))
            ))";
            $p[] = $auth['user_id'];
            $p[] = $auth['user_id'];
            $p[] = $auth['user_id'];
        } else {
            $sql .= ' AND 1=0';
        }
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute($p);
        $row = $stmt->fetch();
        if (!$row) respond(404, null, 'Không tìm thấy liên hệ', false);
        $row['tags'] = json_decode($row['tags'] ?? '[]');
        $row['custom_fields'] = getCustomFields($this->db, $auth['tenant_id'], $id, 'contact');
        respond(200, $row);
    }

    public function update(array $auth, int $id): void {
        if ($auth['role'] === 'viewer') respond(403, null, 'Bạn không có quyền cập nhật', false);
        $b = getBody();
        // 1. Pre-fetch current contact state for lifecycle validation
        $stmtCurr = $this->db->prepare("SELECT pipeline_status, ttl1_completed, owner_id, first_name, last_name, person_id, lead_id, lead_phan_loai, email, phone, mobile, collaborator_ids, source, ttl1_data, address, job_title, notes, budget, budget_range FROM contacts WHERE id = ? AND tenant_id = ?");
        $stmtCurr->execute([$id, $auth['tenant_id']]);
        $currentContact = $stmtCurr->fetch();
        if (!$currentContact) respond(404, null, 'Không tìm thấy liên hệ', false);

        $currStatus = $currentContact['pipeline_status'] ?? 'chua_xac_dinh';
        $currTtl1 = (int)($currentContact['ttl1_completed'] ?? 0);

        // Fetch pipeline status hierarchy dynamically from system_settings
        $stmtHierarchy = $this->db->prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'pipeline_status_hierarchy'");
        $stmtHierarchy->execute();
        $hierarchySetting = $stmtHierarchy->fetchColumn();

        $hierarchyList = [];
        if ($hierarchySetting) {
            $hierarchyList = json_decode($hierarchySetting, true) ?: [];
        }

        if (empty($hierarchyList)) {
            $hierarchyList = ['chua_xac_dinh', 'quan_tam', 'dong_y_gap', 'da_gap', 'booking', 'dat_coc', 'dong_deal'];
        }

        $statusHierarchy = [];
        foreach ($hierarchyList as $idxVal => $statusName) {
            $statusHierarchy[trim($statusName)] = $idxVal;
        }

        // Symmetrical alias for 'dong_y_gap' and 'thien_chi' (Thiện Chí / Đồng ý gặp)
        if (isset($statusHierarchy['dong_y_gap']) && !isset($statusHierarchy['thien_chi'])) {
            $statusHierarchy['thien_chi'] = $statusHierarchy['dong_y_gap'];
        }
        if (isset($statusHierarchy['thien_chi']) && !isset($statusHierarchy['dong_y_gap'])) {
            $statusHierarchy['dong_y_gap'] = $statusHierarchy['thien_chi'];
        }

        // Synchronize stage_id and pipeline_status if only one is updated
        $reqStageId = array_key_exists('stage_id', $b) ? (int)$b['stage_id'] : null;
        $reqStatus = array_key_exists('pipeline_status', $b) ? $b['pipeline_status'] : null;

        if ($reqStageId !== null && $reqStatus === null) {
            $computedStatus = $this->getSlugFromStageId($reqStageId, $auth['tenant_id']);
            $b['pipeline_status'] = $computedStatus;
        } else if ($reqStatus !== null && $reqStageId === null) {
            $computedStageId = $this->getStageIdFromSlug($reqStatus, $auth['tenant_id']);
            if ($computedStageId > 0) {
                $b['stage_id'] = $computedStageId;
            }
        }

        $newStatus = $b['pipeline_status'] ?? null;

        if ($newStatus === 'not_lead') {
            $isFromDatabank = (strtolower(trim((string)($currentContact['source'] ?? ''))) === 'databank' || strtolower(trim((string)($currentContact['lead_phan_loai'] ?? ''))) === 'databank');
            if ($isFromDatabank) {
                respond(400, null, 'Khách hàng nhận từ Kho Databank không được phép chuyển sang Not Lead. Vui lòng sử dụng tính năng "Trả về Databank"!', false);
            }
            if (in_array(strtolower((string)$auth['role']), ['sale', 'sales', 'consultant'], true)) {
                $reasonText = trim((string)($b['not_lead_reason'] ?? 'Đề xuất chuyển trạng thái Not Lead'));
                $stmtProp = $this->db->prepare("
                    UPDATE contacts 
                    SET pipeline_status = 'not_lead',
                        not_lead_proposed = 1, 
                        not_lead_proposed_by = ?, 
                        not_lead_proposed_at = NOW(),
                        not_lead_reason = ?
                    WHERE id = ? AND tenant_id = ?
                ");
                $stmtProp->execute([$auth['user_id'], $reasonText, $id, $auth['tenant_id']]);

                $this->ensurePendingNotLeadTicket($id, $currentContact, (int)$auth['user_id'], $reasonText);
                
                $reasonMsg = !empty($b['not_lead_reason']) ? (" Lý do: " . trim($b['not_lead_reason'])) : '';
                logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'PROPOSE_NOT_LEAD', 'contact', $id, "Báo cáo Not Lead cho khách hàng ID: $id.$reasonMsg");
                respond(200, null, 'Báo cáo Not Lead đã được gửi đến Quản lý để phê duyệt.');
            } else {
                // Manager/Admin can directly approve or transition to Not Lead -> BAN on all fronts
                $b['not_lead_proposed'] = 0;
                $stmtBanP = $this->db->prepare("
                    UPDATE persons 
                    SET is_blocked = 1, is_public = 0, deleted_from_databank = 1, released_to_kho_at = NULL 
                    WHERE id = (SELECT person_id FROM contacts WHERE id = ? LIMIT 1)
                ");
                $stmtBanP->execute([$id]);

                $cPhone = $currentContact['phone'] ?? null;
                $cEmail = $currentContact['email'] ?? null;
                if ($cPhone || $cEmail) {
                    $stmtInsBlk = $this->db->prepare("
                        INSERT INTO blocked_leads (phone, email, reason, created_by, created_at)
                        VALUES (?, ?, 'Admin direct Not Lead approval', ?, NOW())
                    ");
                    $stmtInsBlk->execute([$cPhone, $cEmail, $auth['user_id']]);
                }
            }
        }

        if ($newStatus && $newStatus !== $currStatus) {
            // Exceptions: not_lead or cham_soc_dai_han can be transitioned without linear restrictions (ngoài luồng)
            $isOutsideFlow = ($newStatus === 'cham_soc_dai_han' || $currStatus === 'cham_soc_dai_han' || $newStatus === 'not_lead');

            if (!$isOutsideFlow) {
                $currIdx = $statusHierarchy[$currStatus] ?? 0;
                $newIdx = $statusHierarchy[$newStatus] ?? 0;

                $allowBackward = (int)$this->getSetting('allow_pipeline_backward', '0') === 1;
                $allowSkip = (int)$this->getSetting('allow_pipeline_skip', '0') === 1;

                $stmtWonSetting = $this->db->query("SELECT setting_value FROM system_settings WHERE setting_key = 'deal_won_status' LIMIT 1");
                $dealWonSetting = $stmtWonSetting ? $stmtWonSetting->fetchColumn() : 'dat_coc';
                if (empty($dealWonSetting)) $dealWonSetting = 'dat_coc';

                $isFromDeposit = strpos(strtolower($currStatus), 'coc') !== false || strpos(strtolower($currStatus), 'deposit') !== false || $currStatus === 'dat_coc' || $currStatus === $dealWonSetting;
                $isToSuccess = strpos(strtolower($newStatus), 'success') !== false || strpos(strtolower($newStatus), 'thanh_cong') !== false || $newStatus === 'dong_deal' || $newStatus === 'thanh_cong';
                $isCancellation = $isFromDeposit && !$isToSuccess;

                // Enforce forward-only
                if ($newIdx < $currIdx) {
                    if (!$isCancellation && !$allowBackward) {
                        respond(400, null, "Không được phép chuyển lùi trạng thái từ '$currStatus' về '$newStatus'", false);
                    }
                }
                // Enforce no skipping stages
                if ($newIdx > $currIdx + 1 && !$allowSkip) {
                    respond(400, null, "Không được phép nhảy cóc trạng thái từ '$currStatus' sang '$newStatus' (Phải đi tuần tự)", false);
                }

                // Check TTL1 completion before moving to dong_y_gap / thien_chi or later
                if ($newIdx >= 2) {
                    $src = strtolower($currentContact['source'] ?? '');
                    $isPersonalOrDatabank = in_array($src, ['ca_nhan', 'cá nhân', 'manual', 'self', 'databank', 'kho_data'], true);
                    if (!$isPersonalOrDatabank) {
                        $reqTtl1 = isset($b['ttl1_completed']) ? (int)$b['ttl1_completed'] : $currTtl1;
                        if ($reqTtl1 !== 1) {
                            $tData = isset($b['ttl1_data']) ? (is_array($b['ttl1_data']) ? $b['ttl1_data'] : json_decode($b['ttl1_data'], true)) : (is_array($currentContact['ttl1_data'] ?? null) ? $currentContact['ttl1_data'] : json_decode($currentContact['ttl1_data'] ?? '{}', true));
                            $tCount = 0;
                            if (!empty(trim($b['address'] ?? $currentContact['address'] ?? ''))) $tCount++;
                            if (!empty(trim($b['job_title'] ?? $currentContact['job_title'] ?? ''))) $tCount++;
                            if (!empty(trim($tData['gia_dinh'] ?? ''))) $tCount++;
                            if (!empty(trim($tData['hien_trang'] ?? ''))) $tCount++;
                            if (!empty(trim($tData['nhu_cau'] ?? ''))) $tCount++;
                            if (!empty(trim($tData['rao_can'] ?? ''))) $tCount++;
                            if (!empty(trim($tData['giai_phap'] ?? $b['notes'] ?? $currentContact['notes'] ?? ''))) $tCount++;
                            if ((float)($b['budget'] ?? $currentContact['budget'] ?? 0) > 0 || !empty(trim($b['budget_range'] ?? $currentContact['budget_range'] ?? ''))) $tCount++;
                            if ($tCount < 5) {
                                respond(400, null, "Khách được chia cần điền tối thiểu 5/8 trường thông tin Tương tác lần 1 (TTL1) trước khi chuyển lên Đồng ý gặp! (Hiện tại: $tCount/8)", false);
                            }
                        }
                    }
                }
            }
        }

        // Check interaction gate before closing as 'dong_deal' or 'churned'
        if ($newStatus === 'dong_deal' || (isset($b['status']) && $b['status'] === 'churned')) {
            $stmtCheckAct = $this->db->prepare("SELECT COUNT(*) FROM activities WHERE related_type = 'contact' AND related_id = ?");
            $stmtCheckAct->execute([$id]);
            $actCount = (int)$stmtCheckAct->fetchColumn();
            if ($actCount === 0) {
                respond(400, null, 'Chặn đóng deal: Khách hàng chưa từng có tương tác nào! Vui lòng tạo ghi chú cuộc gọi, email hoặc hoạt động trước.', false);
            }
        }

        // Resolve project_id from campaign_id if project_id is empty/0 but campaign_id is set
        $reqProjectId = array_key_exists('project_id', $b) ? (int)$b['project_id'] : null;
        $reqCampaignId = array_key_exists('campaign_id', $b) ? trim((string)$b['campaign_id']) : null;
        if ($reqCampaignId && ctype_digit($reqCampaignId) && (int)$reqCampaignId > 0 && (!$reqProjectId || $reqProjectId === 0)) {
            $stmtCampProj = $this->db->prepare("SELECT project_id FROM marketing_campaigns WHERE id = ?");
            $stmtCampProj->execute([(int)$reqCampaignId]);
            $campProjId = $stmtCampProj->fetchColumn();
            if ($campProjId) {
                $b['project_id'] = (int)$campProjId;
            }
        }

        $fields = [
            'company_id','project_id','owner_id','first_name','last_name','email','phone',
            'mobile','job_title','department','source','status','notes',
            'birthday','address','city','ward','avatar_url','created_at',
            'expected_revenue','win_probability','last_contact','stage_id',
            'pipeline_status', 'ttl1_completed', 'ttl1_data',
            'gender', 'zalo_link', 'fb_link', 'customer_type', 'industry', 'budget_range',
            'temperature', 'suggested_temperature', 'campaign_id', 'collaborator_ids',
            'phone2', 'dob', 'citizen_id', 'district', 'company', 'tax_code', 'budget',
            'demand_type', 'property_type', 'bedroom_count', 'preferred_location',
            'utm_campaign', 'utm_medium', 'utm_content', 'utm_term', 'platform',
            'form_name', 'zalo_phone', 'facebook_link', 'nguoi_gioi_thieu_id',
            'ad_name', 'link_video_ads', 'loai_lead', 'lead_phan_loai',
            'loai_hinh', 'app_lienhe', 'donvi_chay'
        ];
        $sets = []; $params = [];
        
        if ($newStatus === 'not_lead') {
            $sets[] = "not_lead_proposed = 0";
            $sets[] = "not_lead_proposed_by = NULL";
            $sets[] = "not_lead_proposed_at = NULL";
        }
        
        // Handle company_id specially to allow clearing and name resolution
        if (array_key_exists('company_name', $b)) {
            $name = trim((string)($b['company_name'] ?? ''));
            if ($name === '') {
                $sets[] = "company_id=NULL";
            } else {
                $cid = $this->resolveCompanyId($auth, $b);
                if ($cid) {
                    $sets[] = "company_id=?";
                    $params[] = $cid;
                }
            }
        } elseif (array_key_exists('company_id', $b)) {
            $sets[] = "company_id=?";
            $params[] = $b['company_id'] ? (int)$b['company_id'] : null;
        }

        $isSaleRole = in_array($auth['role'] ?? '', ['sale', 'sales', 'consultant'], true);
        if ($isSaleRole) {
            unset($b['owner_id']); // Sales cannot arbitrarily reassign ownership, but can set project_id and campaign_id
            unset($b['created_at']); // Only Admin/Manager/Director can modify created_at
        }

        foreach ($fields as $f) {
            if ($f === 'company_id') continue;
            if (array_key_exists($f, $b)) { 
                $sets[] = "$f=?"; 
                // Fix date string & numeric strict mode crashes
                if (in_array($f, ['birthday', 'dob', 'last_contact', 'leave_start', 'leave_end']) && ($b[$f] === '' || $b[$f] === null || $b[$f] === 'null')) {
                    $params[] = null;
                } else if (in_array($f, ['stage_id', 'project_id', 'owner_id', 'company_id', 'nguoi_gioi_thieu_id']) && (empty($b[$f]) || $b[$f] === 0 || $b[$f] === '0' || $b[$f] === 'null')) {
                    $params[] = null;
                } else if ($f === 'campaign_id') {
                    $valCamp = trim((string)($b[$f] ?? ''));
                    $params[] = ($valCamp === '' || $valCamp === '0' || $valCamp === 'null') ? null : $valCamp;
                } else if (in_array($f, ['budget', 'expected_revenue', 'win_probability']) && ($b[$f] === '' || $b[$f] === null || $b[$f] === 'null')) {
                    $params[] = 0;
                } else if ($f === 'ttl1_data' && is_array($b[$f])) {
                    $params[] = json_encode($b[$f]);
                } else {
                    $params[] = $b[$f];
                }
            }
        }
        if (isset($b['tags'])) { $sets[] = 'tags=?'; $params[] = json_encode($b['tags']); }
        // Duplicate Phone Check (excluding self and other parallel contacts for the same physical Person)
        $phone = $b['phone'] ?? $b['mobile'] ?? null;
        if ($phone) {
            require_once __DIR__ . '/../webhook_logic.php';
            $phone = normalizePhone($phone);
            $currPhone = normalizePhone($currentContact['phone'] ?? $currentContact['mobile'] ?? '');
            if ($phone !== $currPhone) {
                $personId = $currentContact['person_id'] ?? null;
                if ($personId) {
                    $check = $this->db->prepare("SELECT id FROM contacts WHERE tenant_id=? AND (phone=? OR mobile=?) AND id!=? AND (person_id IS NULL OR person_id != ?) AND deleted_at IS NULL LIMIT 1");
                    $check->execute([$auth['tenant_id'], $phone, $phone, $id, $personId]);
                } else {
                    $check = $this->db->prepare("SELECT id FROM contacts WHERE tenant_id=? AND (phone=? OR mobile=?) AND id!=? AND deleted_at IS NULL LIMIT 1");
                    $check->execute([$auth['tenant_id'], $phone, $phone, $id]);
                }
                if ($check->fetch()) {
                    respond(422, null, "Số điện thoại '$phone' đã tồn tại ở một khách hàng khác.", false);
                }
            }
        }
        // Duplicate Email Check (excluding self and other parallel contacts for the same physical Person)
        $email = $b['email'] ?? null;
        if ($email) {
            $email = trim(strtolower($email));
            $currEmail = trim(strtolower($currentContact['email'] ?? ''));
            if ($email !== $currEmail) {
                $personId = $currentContact['person_id'] ?? null;
                if ($personId) {
                    $checkEmail = $this->db->prepare("SELECT id FROM contacts WHERE tenant_id=? AND email=? AND id!=? AND (person_id IS NULL OR person_id != ?) AND deleted_at IS NULL LIMIT 1");
                    $checkEmail->execute([$auth['tenant_id'], $email, $id, $personId]);
                } else {
                    $checkEmail = $this->db->prepare("SELECT id FROM contacts WHERE tenant_id=? AND email=? AND id!=? AND deleted_at IS NULL LIMIT 1");
                    $checkEmail->execute([$auth['tenant_id'], $email, $id]);
                }
                if ($checkEmail->fetch()) {
                    respond(422, null, "Email '$email' đã tồn tại ở một khách hàng khác.", false);
                }
            }
        }

        if (!$sets && !isset($b['custom_fields'])) respond(422, null, 'Không có dữ liệu để cập nhật', false);

        if (array_key_exists('stage_id', $b) && !empty($b['stage_id']) && (int)$b['stage_id'] > 0) {
            $sStage = $this->db->prepare("SELECT id FROM pipeline_stages WHERE id=? AND tenant_id=?");
            $sStage->execute([(int)$b['stage_id'], $auth['tenant_id']]);
            if (!$sStage->fetch()) respond(404, null, 'Giai đoạn không hợp lệ', false);
        }

        // Check permission first
        $permissionSql = "SELECT id FROM contacts WHERE id=? AND tenant_id=?";
        $cp = [$id, $auth['tenant_id']];
        $scope = $this->getScope($auth, 'leads', 'write');
        if ($scope === 'all') {
            // No extra filters
        } else if ($scope === 'team') {
            $permissionSql .= " AND (owner_id=? OR owner_id IN (
                SELECT id FROM users WHERE team_id IN (
                    SELECT id FROM teams WHERE FIND_IN_SET(?, CONCAT(leader_id, CHAR(44), COALESCE(co_leader_ids, leader_id)))
                )
            ) OR FIND_IN_SET(?, collaborator_ids) OR id IN (
                SELECT contact_id FROM cooperation_slips 
                WHERE JSON_CONTAINS(JSON_KEYS(CASE WHEN (shares_json IS NOT NULL AND JSON_VALID(shares_json)) THEN shares_json ELSE \"{}\" END), JSON_QUOTE(CAST(? AS CHAR)))
            ))";
            $cp[] = $auth['user_id'];
            $cp[] = $auth['user_id'];
            $cp[] = $auth['user_id'];
            $cp[] = $auth['user_id'];
        } else if ($scope === 'own') {
            $permissionSql .= ' AND (owner_id=? OR FIND_IN_SET(?, collaborator_ids) OR id IN (
                SELECT contact_id FROM cooperation_slips 
                WHERE JSON_CONTAINS(JSON_KEYS(CASE WHEN (shares_json IS NOT NULL AND JSON_VALID(shares_json)) THEN shares_json ELSE "{}" END), JSON_QUOTE(CAST(? AS CHAR)))
            ))';
            $cp[] = $auth['user_id'];
            $cp[] = $auth['user_id'];
            $cp[] = $auth['user_id'];
        } else {
            $permissionSql .= ' AND 1=0';
        }
        $check = $this->db->prepare($permissionSql);
        $check->execute($cp);
        if (!$check->fetch()) respond(404, null, 'Không tìm thấy hoặc không có quyền', false);

        if ($sets) {
            $params[] = $id; $params[] = $auth['tenant_id'];
            $sql = "UPDATE contacts SET ".implode(',',$sets)." WHERE id=? AND tenant_id=?";
            $stmt = $this->db->prepare($sql);
            $stmt->execute($params);

            // Sync owner_id (assigned_to) to linked leads record (DO NOT overwrite leads.project_id or leads.campaign_id to preserve MKT original indicators)
            if (array_key_exists('owner_id', $b)) {
                $personId = $currentContact['person_id'] ?? null;
                $linkedLeadId = !empty($currentContact['lead_id']) ? (int)$currentContact['lead_id'] : null;
                $cPhone = !empty($currentContact['phone']) ? $currentContact['phone'] : ($currentContact['mobile'] ?? null);
                try {
                    $newOwnerUid = !empty($b['owner_id']) ? (int)$b['owner_id'] : null;
                    $newAssignedCid = $newOwnerUid;
                    if ($newOwnerUid) {
                        $stmtCid = $this->db->prepare("SELECT c.id FROM consultants c JOIN users u ON u.email = c.email WHERE u.id = ? LIMIT 1");
                        $stmtCid->execute([$newOwnerUid]);
                        $resolvedCid = $stmtCid->fetchColumn();
                        if ($resolvedCid) {
                            $newAssignedCid = (int)$resolvedCid;
                        }
                    }
                    $leadSyncSets = ["assigned_to = ?"];
                    $syncParams = [$newAssignedCid];

                    if ($linkedLeadId) {
                        $syncParams[] = $linkedLeadId;
                        $stmtSyncLead = $this->db->prepare("UPDATE leads SET " . implode(', ', $leadSyncSets) . " WHERE id = ?");
                        $stmtSyncLead->execute($syncParams);
                    } elseif ($personId || $cPhone) {
                        $whereSync = [];
                        if ($personId) {
                            $whereSync[] = "person_id = ?";
                            $syncParams[] = $personId;
                        }
                        if ($cPhone) {
                            $whereSync[] = "phone = ?";
                            $syncParams[] = $cPhone;
                        }
                        $leadSyncSql = "UPDATE leads SET " . implode(', ', $leadSyncSets) . " WHERE (" . implode(' OR ', $whereSync) . ") ORDER BY id DESC LIMIT 1";
                        $stmtSyncLead = $this->db->prepare($leadSyncSql);
                        $stmtSyncLead->execute($syncParams);
                    }
                } catch (\Throwable $e) {}
            }

            // SEND SYSTEM NOTIFICATION TO NEWLY ADDED CO-CARE SALES
            if (array_key_exists('collaborator_ids', $b)) {
                $oldCollabs = array_values(array_unique(array_filter(array_map('trim', explode(',', $currentContact['collaborator_ids'] ?? '')))));
                $newCollabs = array_values(array_unique(array_filter(array_map('trim', explode(',', $b['collaborator_ids'] ?? '')))));
                $addedCollabs = array_diff($newCollabs, $oldCollabs);

                if (!empty($addedCollabs)) {
                    $fullName = trim($currentContact['first_name'] . ' ' . ($currentContact['last_name'] ?? ''));
                    $title = "Bạn được thêm làm nhân sự chăm sóc phụ (Co-care)";
                    $body = "Bạn đã được sale " . ($auth['full_name'] ?? 'đồng nghiệp') . " thêm làm nhân sự chăm sóc phụ cho khách hàng: " . $fullName;
                    $type = "info";
                    $link = "/contacts?id=" . $id;

                    require_once __DIR__ . '/../NotificationService.php';
                    foreach ($addedCollabs as $collabRawId) {
                        $collabRawId = (int)$collabRawId;
                        if ($collabRawId > 0) {
                            $targetUserId = $collabRawId;
                            $stmtMap = $this->db->prepare("
                                SELECT u.id FROM users u 
                                LEFT JOIN consultants c ON (u.email = c.email OR u.id = c.id) 
                                WHERE c.id = ? OR u.id = ? 
                                LIMIT 1
                            ");
                            $stmtMap->execute([$collabRawId, $collabRawId]);
                            if ($mappedUId = $stmtMap->fetchColumn()) {
                                $targetUserId = (int)$mappedUId;
                            }

                            if ($targetUserId > 0 && $targetUserId !== (int)$auth['user_id']) {
                                NotificationService::send($this->db, $auth['tenant_id'], 'COOP_INVITATION', [
                                    'user_id' => $targetUserId,
                                    'customer_name' => $fullName,
                                    'inviter_name' => $auth['full_name'] ?? 'đồng nghiệp',
                                    'contact_id' => $id
                                ]);
                            }
                        }
                    }
                }
            }

            // AUTO TRIGGER META CAPI EVENTS ON STATE TRANSITION AND UPDATE SECURITY TIMERS / DATABANK STATUS
            if ($newStatus && $newStatus !== $currStatus) {
                require_once __DIR__ . '/../config/CapiHelper.php';
                
                // Load CAPI triggers mapping from settings dynamically
                $capiTriggersRaw = $this->getSetting('capi_event_triggers', '');
                $capiMap = [];
                if (!empty($capiTriggersRaw)) {
                    $capiMap = json_decode($capiTriggersRaw, true) ?: [];
                }
                    if (isset($capiMap[$newStatus]) && $capiMap[$newStatus] !== 'Skip' && $capiMap[$newStatus] !== 'None' && $capiMap[$newStatus] !== 'BAD') {
                    $evtName = $capiMap[$newStatus];
                    register_shutdown_function(function() use ($id, $evtName) {
                        try {
                            require_once __DIR__ . '/../config/CapiHelper.php';
                            CapiHelper::sendEvent(null, $id, $evtName);
                        } catch (\Throwable $ex) {}
                    });
                }

                // Fire automated outbound webhook triggers
                require_once __DIR__ . '/../config/TriggerHelper.php';
                TriggerHelper::dispatch($this->db, 'pipeline_status', $currStatus, $newStatus, $id);

                // Update security_expires_at for higher status (never set timer on personal/self-entered contacts)
                $isPersContact = $this->isPersonalOrSelfContact((int)$id);
                $securityExpires = $isPersContact ? null : $this->getSecurityExpiration($newStatus);
                $stmtTimer = $this->db->prepare("UPDATE contacts SET security_expires_at = ? WHERE id = ?");
                $stmtTimer->execute([$securityExpires, $id]);

                // Nếu đã đẩy ra kho mà sale chuyển lên trạng thái cao hơn:
                // 1. Ẩn Person khỏi kho Databank ngay lập tức (is_public = 0)
                // 2. Ghi nhận thời gian gia hạn của trạng thái cao hơn đó, đồng bộ cho Person
                if ($newStatus !== 'chua_xac_dinh' && $newStatus !== 'not_lead') {
                    $stmtGetPid = $this->db->prepare("SELECT person_id FROM contacts WHERE id = ? LIMIT 1");
                    $stmtGetPid->execute([$id]);
                    $targetPersonId = (int)$stmtGetPid->fetchColumn();
                    if ($targetPersonId > 0) {
                        // Ẩn Person hoàn toàn khỏi Kho Databank
                        $stmtHidePerson = $this->db->prepare("UPDATE persons SET is_public = 0 WHERE id = ?");
                        $stmtHidePerson->execute([$targetPersonId]);

                        if (!$isPersContact && $securityExpires !== null) {
                            // Ghi thời gian gia hạn của trạng thái cao hơn đó cho các contact active (không phải cá nhân) của Person
                            $stmtSyncTimer = $this->db->prepare("
                                UPDATE contacts
                                SET security_expires_at = ?
                                WHERE person_id = ?
                                  AND deleted_at IS NULL
                                  AND LOWER(COALESCE(source, '')) NOT IN ('ca_nhan', 'cá nhân', 'gioi_thieu', 'giới thiệu', 'personal', 'referral', 'manual', 'self')
                                  AND LOWER(COALESCE(lead_phan_loai, '')) NOT IN ('ca_nhan', 'cá nhân', 'gioi_thieu', 'giới thiệu', 'personal', 'referral', 'manual', 'self')
                                  AND LOWER(COALESCE(loai_lead, '')) NOT IN ('ca_nhan', 'cá nhân', 'gioi_thieu', 'giới thiệu', 'personal', 'referral', 'manual', 'self')
                                  AND (security_expires_at IS NULL OR security_expires_at < ?)
                            ");
                            $stmtSyncTimer->execute([$securityExpires, $targetPersonId, $securityExpires]);
                        }

                        // Cập nhật trạng thái bản ghi gốc MKT (leads)
                        $stmtUpdLead = $this->db->prepare("UPDATE leads SET status = ?, last_interaction_date = NOW() WHERE person_id = ? AND status NOT IN ('dat_coc', 'dong_deal', 'not_lead')");
                        $stmtUpdLead->execute([$newStatus, $targetPersonId]);
                    }
                }

                // Auto spawn workflow tasks if stage changes
                $targetStageId = isset($b['stage_id']) ? (int)$b['stage_id'] : null;
                if ($targetStageId === null) {
                    $stmtGetStage = $this->db->prepare("SELECT stage_id FROM contacts WHERE id = ?");
                    $stmtGetStage->execute([$id]);
                    $targetStageId = (int)$stmtGetStage->fetchColumn();
                }
                if ($targetStageId > 0) {
                    require_once __DIR__ . '/../config/WorkflowHelper.php';
                    WorkflowHelper::triggerTasks($this->db, $auth['tenant_id'], $id, $targetStageId, $auth['user_id']);
                }

                // Withdraw from databank and terminate other parallel contacts if deal won status is reached
                $stmtWon = $this->db->query("SELECT setting_value FROM system_settings WHERE setting_key = 'deal_won_status' LIMIT 1");
                $dealWonStatus = $stmtWon ? $stmtWon->fetchColumn() : 'dat_coc';
                if (empty($dealWonStatus)) $dealWonStatus = 'dat_coc';

                if ($newStatus === $dealWonStatus || in_array($newStatus, ['dat_coc', 'da_coc', 'dong_deal'])) {
                    require_once __DIR__ . '/../config/ParallelHelper.php';
                    ParallelHelper::lockPersonForWinningContact($this->db, (int)$id);
                }
            }
        }
        
        $newTtl1 = isset($b['ttl1_completed']) ? (int)$b['ttl1_completed'] : null;
        if ($newTtl1 !== null && $newTtl1 !== $currTtl1) {
            $ttl1Msg = $newTtl1 === 1 ? "Khách hàng đã được xác minh đạt đủ điều kiện gặp (TTL1)." : "Khách hàng bị hủy xác minh điều kiện gặp (TTL1).";
            logInteraction($this->db, $auth['tenant_id'], $auth['user_id'], 'note', 'Xác minh TTL1', $ttl1Msg, 'contact', $id);
            logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'UPDATE_TTL1', 'contact', $id, json_encode(['ttl1_completed' => $newTtl1]));
        }

        if (isset($b['custom_fields']) && is_array($b['custom_fields'])) {
            saveCustomFields($this->db, $auth['tenant_id'], $id, 'contact', $b['custom_fields']);
        }

        // Notify the owner asynchronously if modified by another user
        // CUSTOMER_UPDATE notification disabled per user request
        
        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'UPDATE', 'contact', $id, json_encode(['first_name' => $currentContact['first_name'], 'last_name' => $currentContact['last_name'] ?? '']));
        $sql = "SELECT c.*, 
                    CASE 
                        WHEN comp.deleted_at IS NOT NULL THEN CONCAT(comp.name, ' (Đã xóa)')
                        ELSE comp.name 
                    END as company_name, 
                    u.full_name as owner_name, u.avatar_url as owner_avatar, ps.name as stage_name, ps.color as stage_color,
                    (SELECT COALESCE(SUM(total),0) FROM invoices WHERE contact_id=c.id AND status='paid' AND deleted_at IS NULL) as actual_revenue,
                    (SELECT COUNT(*) FROM invoices WHERE contact_id=c.id AND status='paid' AND deleted_at IS NULL) as paid_invoice_count,
                    (SELECT COALESCE(SUM(ee.amount),0) FROM expense_entities ee JOIN expenses e ON ee.expense_id = e.id WHERE ee.entity_type = 'contact' AND ee.entity_id = c.id AND e.status = 'approved' AND e.deleted_at IS NULL) as total_spent,
                    (SELECT COUNT(*) FROM expense_entities ee JOIN expenses e ON ee.expense_id = e.id WHERE ee.entity_type = 'contact' AND ee.entity_id = c.id AND e.status = 'approved' AND e.deleted_at IS NULL) as expense_count,
                    NULLIF(GREATEST(
                        COALESCE((SELECT MAX(paid_at) FROM invoices WHERE contact_id = c.id AND status = 'paid' AND deleted_at IS NULL), '1970-01-01 00:00:00'),
                        COALESCE((SELECT MAX(e.approved_at) FROM expense_entities ee JOIN expenses e ON ee.expense_id = e.id WHERE ee.entity_type = 'contact' AND ee.entity_id = c.id AND e.status = 'approved' AND e.deleted_at IS NULL), '1970-01-01 00:00:00')
                    ), '1970-01-01 00:00:00') as last_order_at
            FROM contacts c
            LEFT JOIN companies comp ON c.company_id = comp.id
            LEFT JOIN users u ON c.owner_id = u.id
            LEFT JOIN pipeline_stages ps ON c.stage_id = ps.id
            WHERE c.id=? AND c.tenant_id=? AND c.deleted_at IS NULL";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$id, $auth['tenant_id']]);
        $row = $stmt->fetch();
        if ($row) {
            $row['tags'] = json_decode($row['tags'] ?? '[]');
            $row['custom_fields'] = getCustomFields($this->db, $auth['tenant_id'], $id, 'contact');
            respond(200, $row);
        } else {
            respond(404, null, 'Không tìm thấy liên hệ', false);
        }
    }

    public function moveStage(array $auth, int $id): void {
        $b = getBody();
        if (empty($b['stage_id'])) respond(422, null, 'stage_id là bắt buộc', false);
        
        $sStage = $this->db->prepare("SELECT id FROM pipeline_stages WHERE id=? AND tenant_id=?");
        $sStage->execute([(int)$b['stage_id'], $auth['tenant_id']]);
        if (!$sStage->fetch()) respond(404, null, 'Giai đoạn không hợp lệ', false);

        $stageId = (int)$b['stage_id'];
        $newStatus = $this->getSlugFromStageId($stageId, $auth['tenant_id']);

        // Check current status for CAPI/Timer trigger
        $stmtC = $this->db->prepare("SELECT pipeline_status, owner_id, first_name, last_name, person_id, lead_id, lead_phan_loai, phone, email, ttl1_completed, source FROM contacts WHERE id = ? AND tenant_id = ?");
        $stmtC->execute([$id, $auth['tenant_id']]);
        $currentContact = $stmtC->fetch();
        if (!$currentContact) respond(404, null, 'Không tìm thấy liên hệ', false);
        $currStatus = $currentContact['pipeline_status'] ?? 'chua_xac_dinh';
        $currTtl1 = (int)($currentContact['ttl1_completed'] ?? 0);

        if ($newStatus === 'not_lead') {
            $isFromDatabank = (strtolower(trim((string)($currentContact['source'] ?? ''))) === 'databank' || strtolower(trim((string)($currentContact['lead_phan_loai'] ?? ''))) === 'databank');
            if ($isFromDatabank) {
                respond(400, null, 'Khách hàng nhận từ Kho Databank không được phép chuyển sang Not Lead. Vui lòng sử dụng tính năng "Trả về Databank"!', false);
            }
            if (in_array(strtolower((string)$auth['role']), ['sale', 'sales', 'consultant'], true)) {
                $reasonText = trim((string)($b['not_lead_reason'] ?? 'Đề xuất chuyển trạng thái Not Lead'));
                $stmtProp = $this->db->prepare("
                    UPDATE contacts 
                    SET pipeline_status = 'not_lead',
                        not_lead_proposed = 1, 
                        not_lead_proposed_by = ?, 
                        not_lead_proposed_at = NOW(),
                        not_lead_reason = ?
                    WHERE id = ? AND tenant_id = ?
                ");
                $stmtProp->execute([$auth['user_id'], $reasonText, $id, $auth['tenant_id']]);

                $this->ensurePendingNotLeadTicket($id, $currentContact, (int)$auth['user_id'], $reasonText);

                logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'PROPOSE_NOT_LEAD', 'contact', $id, "Báo cáo Not Lead cho khách hàng ID: $id.");
                respond(200, null, 'Báo cáo Not Lead đã được gửi đến Quản lý để phê duyệt.');
            }
        }

        // Fetch pipeline status hierarchy dynamically from system_settings
        $stmtHierarchy = $this->db->prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'pipeline_status_hierarchy'");
        $stmtHierarchy->execute();
        $hierarchySetting = $stmtHierarchy->fetchColumn();

        $hierarchyList = [];
        if ($hierarchySetting) {
            $hierarchyList = json_decode($hierarchySetting, true) ?: [];
        }

        if (empty($hierarchyList)) {
            $hierarchyList = ['chua_xac_dinh', 'quan_tam', 'dong_y_gap', 'da_gap', 'booking', 'dat_coc', 'dong_deal'];
        }

        $statusHierarchy = [];
        foreach ($hierarchyList as $idxVal => $statusName) {
            $statusHierarchy[trim($statusName)] = $idxVal;
        }

        // Symmetrical alias for 'dong_y_gap' and 'thien_chi' (Thiện Chí / Đồng ý gặp)
        if (isset($statusHierarchy['dong_y_gap']) && !isset($statusHierarchy['thien_chi'])) {
            $statusHierarchy['thien_chi'] = $statusHierarchy['dong_y_gap'];
        }
        if (isset($statusHierarchy['thien_chi']) && !isset($statusHierarchy['dong_y_gap'])) {
            $statusHierarchy['dong_y_gap'] = $statusHierarchy['thien_chi'];
        }

        $isOutsideFlow = ($newStatus === 'cham_soc_dai_han' || $currStatus === 'cham_soc_dai_han' || $newStatus === 'not_lead');
        if (!$isOutsideFlow) {
            $currIdx = $statusHierarchy[$currStatus] ?? 0;
            $newIdx = $statusHierarchy[$newStatus] ?? 0;

            $allowBackward = (int)$this->getSetting('allow_pipeline_backward', '0') === 1;
            $allowSkip = (int)$this->getSetting('allow_pipeline_skip', '0') === 1;

            $stmtWonSetting = $this->db->query("SELECT setting_value FROM system_settings WHERE setting_key = 'deal_won_status' LIMIT 1");
            $dealWonSetting = $stmtWonSetting ? $stmtWonSetting->fetchColumn() : 'dat_coc';
            if (empty($dealWonSetting)) $dealWonSetting = 'dat_coc';

            $isFromDeposit = strpos(strtolower($currStatus), 'coc') !== false || strpos(strtolower($currStatus), 'deposit') !== false || $currStatus === 'dat_coc' || $currStatus === $dealWonSetting;
            $isToSuccess = strpos(strtolower($newStatus), 'success') !== false || strpos(strtolower($newStatus), 'thanh_cong') !== false || $newStatus === 'dong_deal' || $newStatus === 'thanh_cong';
            $isCancellation = $isFromDeposit && !$isToSuccess;

            // Enforce forward-only
            if ($newIdx < $currIdx) {
                if (!$isCancellation && !$allowBackward) {
                    respond(400, null, "Không được phép chuyển lùi trạng thái từ '$currStatus' về '$newStatus'", false);
                }
            }
            // Enforce no skipping stages
            if ($newIdx > $currIdx + 1 && !$allowSkip) {
                respond(400, null, "Không được phép nhảy cóc trạng thái từ '$currStatus' sang '$newStatus' (Phải đi tuần tự)", false);
            }

            // Check TTL1 completion before moving to dong_y_gap / thien_chi or later
            if ($newIdx >= 2) {
                $src = strtolower($currentContact['source'] ?? '');
                $isPersonalOrDatabank = in_array($src, ['ca_nhan', 'cá nhân', 'manual', 'self', 'databank', 'kho_data'], true);
                if (!$isPersonalOrDatabank && $currTtl1 !== 1) {
                    respond(400, null, 'Khách được chia cần điền tối thiểu 5/8 trường thông tin Tương tác lần 1 (TTL1) trước khi chuyển lên Đồng ý gặp!', false);
                }
            }
        }

        $sql = "UPDATE contacts SET stage_id=?, pipeline_status=? WHERE id=? AND tenant_id=?";
        $p = [$stageId, $newStatus, $id, $auth['tenant_id']];
        if ($auth['role'] === 'sales' || $auth['role'] === 'sale') {
            $sql .= ' AND (owner_id=? OR id IN (
                SELECT contact_id FROM cooperation_slips 
                WHERE JSON_CONTAINS(JSON_KEYS(CASE WHEN (shares_json IS NOT NULL AND JSON_VALID(shares_json)) THEN shares_json ELSE "{}" END), JSON_QUOTE(CAST(? AS CHAR)))
            ))';
            $p[] = $auth['user_id'];
            $p[] = $auth['user_id'];
        }
        $stmt = $this->db->prepare($sql);
        $stmt->execute($p);
        if (!$stmt->rowCount()) respond(403, null, 'Bạn không có quyền di chuyển liên hệ này', false);

        // CUSTOMER_UPDATE notification disabled per user request

        // Trigger CAPI / Security timer updates on status change
        if ($newStatus !== $currStatus) {
            require_once __DIR__ . '/../config/CapiHelper.php';
            
            // Load CAPI triggers mapping from settings dynamically
            $capiTriggersRaw = $this->getSetting('capi_event_triggers', '');
            $capiMap = [];
            if (!empty($capiTriggersRaw)) {
                $capiMap = json_decode($capiTriggersRaw, true) ?: [];
            }
            
            // Fallback mapping if not configured in settings
            if (empty($capiMap)) {
                $capiMap = [
                    'dong_y_gap' => 'Schedule',
                    'da_gap' => 'Schedule',
                    'not_lead' => 'BAD',
                    'dat_coc' => 'Purchase'
                ];
            }
            
            if (isset($capiMap[$newStatus]) && $capiMap[$newStatus] !== 'Skip' && $capiMap[$newStatus] !== 'None' && $capiMap[$newStatus] !== 'BAD') {
                CapiHelper::sendEvent($this->db, $id, $capiMap[$newStatus]);
            }

            // Fire automated outbound webhook triggers
            require_once __DIR__ . '/../config/TriggerHelper.php';
            TriggerHelper::dispatch($this->db, 'pipeline_status', $currStatus, $newStatus, $id);

            // Update security timer for higher status (never set timer on personal/self-entered contacts)
            $isPersContact = $this->isPersonalOrSelfContact((int)$id);
            $securityExpires = $isPersContact ? null : $this->getSecurityExpiration($newStatus);
            $stmtTimer = $this->db->prepare("UPDATE contacts SET security_expires_at = ? WHERE id = ?");
            $stmtTimer->execute([$securityExpires, $id]);

            // Nếu đã đẩy ra kho mà sale chuyển lên trạng thái cao hơn:
            // 1. Ẩn Person khỏi kho Databank ngay lập tức (is_public = 0)
            // 2. Ghi nhận thời gian gia hạn của trạng thái cao hơn đó, đồng bộ cho Person
            if ($newStatus !== 'chua_xac_dinh' && $newStatus !== 'not_lead') {
                $stmtGetPid = $this->db->prepare("SELECT person_id FROM contacts WHERE id = ? LIMIT 1");
                $stmtGetPid->execute([$id]);
                $targetPersonId = (int)$stmtGetPid->fetchColumn();
                if ($targetPersonId > 0) {
                    // Ẩn Person hoàn toàn khỏi Kho Databank
                    $stmtHidePerson = $this->db->prepare("UPDATE persons SET is_public = 0 WHERE id = ?");
                    $stmtHidePerson->execute([$targetPersonId]);

                    if (!$isPersContact && $securityExpires !== null) {
                        // Ghi thời gian gia hạn của trạng thái cao hơn đó cho các contact active (không phải cá nhân) của Person
                        $stmtSyncTimer = $this->db->prepare("
                            UPDATE contacts
                            SET security_expires_at = ?
                            WHERE person_id = ?
                              AND deleted_at IS NULL
                              AND LOWER(COALESCE(source, '')) NOT IN ('ca_nhan', 'cá nhân', 'gioi_thieu', 'giới thiệu', 'personal', 'referral', 'manual', 'self')
                              AND LOWER(COALESCE(lead_phan_loai, '')) NOT IN ('ca_nhan', 'cá nhân', 'gioi_thieu', 'giới thiệu', 'personal', 'referral', 'manual', 'self')
                              AND LOWER(COALESCE(loai_lead, '')) NOT IN ('ca_nhan', 'cá nhân', 'gioi_thieu', 'giới thiệu', 'personal', 'referral', 'manual', 'self')
                              AND (security_expires_at IS NULL OR security_expires_at < ?)
                        ");
                        $stmtSyncTimer->execute([$securityExpires, $targetPersonId, $securityExpires]);
                    }

                    // Cập nhật trạng thái bản ghi gốc MKT (leads)
                    $stmtUpdLead = $this->db->prepare("UPDATE leads SET status = ?, last_interaction_date = NOW() WHERE person_id = ? AND status NOT IN ('dat_coc', 'dong_deal', 'not_lead')");
                    $stmtUpdLead->execute([$newStatus, $targetPersonId]);
                }
            }

            // Auto spawn workflow tasks
            require_once __DIR__ . '/../config/WorkflowHelper.php';
            WorkflowHelper::triggerTasks($this->db, $auth['tenant_id'], $id, $stageId, $auth['user_id']);

            // Withdraw from databank and terminate other parallel contacts if deal won status is reached
            $stmtWon = $this->db->query("SELECT setting_value FROM system_settings WHERE setting_key = 'deal_won_status' LIMIT 1");
            $dealWonStatus = $stmtWon ? $stmtWon->fetchColumn() : 'dat_coc';
            if (empty($dealWonStatus)) $dealWonStatus = 'dat_coc';

            if ($newStatus === $dealWonStatus) {
                require_once __DIR__ . '/../config/ParallelHelper.php';
                ParallelHelper::lockPersonForWinningContact($this->db, (int)$id);
            }
        }

        $note = $b['note'] ?? "Khách hàng đã được chuyển trạng thái.";
        logInteraction($this->db, $auth['tenant_id'], $auth['user_id'], 'note', 'Cập nhật Pipeline', $note, 'contact', $id);
        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'MOVE_STAGE', 'contact', $id, json_encode(['stage_id' => $stageId, 'pipeline_status' => $newStatus, 'note' => $note]));
        respond(200, null, 'Đã cập nhật stage thành công');
    }



    public function destroy(array $auth, int $id): void {
        $stmtChk = $this->db->prepare("SELECT source, owner_id, created_by FROM contacts WHERE id=? AND tenant_id=? AND deleted_at IS NULL LIMIT 1");
        $stmtChk->execute([$id, $auth['tenant_id']]);
        $cRow = $stmtChk->fetch(PDO::FETCH_ASSOC);
        if (!$cRow) respond(404, null, 'Không tìm thấy liên hệ', false);

        $isSelfCreatedByMe = ($cRow['source'] === 'manual' || $cRow['source'] === 'self') && 
            ((int)$cRow['owner_id'] === (int)$auth['user_id'] || (int)$cRow['created_by'] === (int)$auth['user_id']);

        $scope = $this->getScope($auth, 'leads', 'delete');
        if ($scope === 'none' && !$isSelfCreatedByMe) {
            respond(403, null, 'Bạn không có quyền xóa liên hệ', false);
        }
        
        $sql = "UPDATE contacts SET deleted_at=NOW() WHERE id=? AND tenant_id=?";
        $p = [$id, $auth['tenant_id']];
        if (!$isSelfCreatedByMe) {
            if ($scope === 'team') {
                $sql .= " AND (owner_id=? OR owner_id IN (
                    SELECT id FROM users WHERE team_id IN (
                        SELECT id FROM teams WHERE FIND_IN_SET(?, CONCAT(leader_id, CHAR(44), COALESCE(co_leader_ids, leader_id)))
                    )
                ))";
                $p[] = $auth['user_id'];
                $p[] = $auth['user_id'];
            } else if ($scope === 'own') {
                $sql .= " AND owner_id=?";
                $p[] = $auth['user_id'];
            }
        }
        $stmt = $this->db->prepare($sql);
        $stmt->execute($p);
        if (!$stmt->rowCount()) respond(404, null, 'Không tìm thấy liên hệ hoặc không có quyền xóa', false);
        
        $this->restorePersonPublicStatus($id, $auth['tenant_id']);

        if (in_array($auth['role'], ['admin', 'superadmin', 'super_admin'])) {
            $this->cleanupLeadsForContactId((int)$id, $auth['tenant_id']);
        }
        
        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'DELETE', 'contact', $id, json_encode(['id' => $id]));
        logInteraction($this->db, $auth['tenant_id'], $auth['user_id'], 'note', 'Xóa Liên hệ', "Một liên hệ đã bị đưa vào thùng rác.", 'contact', $id);
        respond(200, null, 'Đã xóa liên hệ (vào thùng rác)');
    }

    public function bulkDelete(array $auth): void {
        $scope = $this->getScope($auth, 'leads', 'delete');
        if ($scope === 'none') {
            respond(403, null, 'Bạn không có quyền xóa liên hệ', false);
        }
        $b = getBody();
        $ids = $b['ids'] ?? [];
        if (empty($ids)) respond(400, null, 'Danh sách ID không hợp lệ', false);
        
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $where = "tenant_id=? AND id IN ($placeholders)";
        $params = array_merge([$auth['tenant_id']], $ids);
        
        if ($scope === 'team') {
            $where .= " AND (owner_id=? OR owner_id IN (
                SELECT id FROM users WHERE team_id IN (
                    SELECT id FROM teams WHERE FIND_IN_SET(?, CONCAT(leader_id, CHAR(44), COALESCE(co_leader_ids, leader_id)))
                )
            ))";
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
        } else if ($scope === 'own') {
            $where .= " AND owner_id=?";
            $params[] = $auth['user_id'];
        }
        
        $sql = "UPDATE contacts SET deleted_at=NOW() WHERE $where";
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        
        foreach ($ids as $cid) {
            $this->restorePersonPublicStatus((int)$cid, $auth['tenant_id']);
            if ($auth['role'] === 'admin' || $auth['role'] === 'superadmin') {
                $this->cleanupLeadsForContactId((int)$cid, $auth['tenant_id']);
            }
        }
        
        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'BULK_DELETE', 'contact', null, json_encode(['ids' => $ids]));
        respond(200, null, "Đã xóa " . $stmt->rowCount() . " liên hệ");
    }

    private function cleanupLeadsForContactId(int $contactId, int $tenantId): void {
        try {
            $stmtC = $this->db->prepare("SELECT person_id, phone FROM contacts WHERE id = ? LIMIT 1");
            $stmtC->execute([$contactId]);
            $cRow = $stmtC->fetch(PDO::FETCH_ASSOC);
            if (!$cRow) return;

            $personId = (int)($cRow['person_id'] ?? 0);
            $phone = $cRow['phone'] ?? '';

            $leadIds = [];
            if ($personId > 0) {
                $stmtL = $this->db->prepare("SELECT id FROM leads WHERE person_id = ?");
                $stmtL->execute([$personId]);
                $leadIds = array_merge($leadIds, $stmtL->fetchAll(PDO::FETCH_COLUMN));
            }
            if (!empty($phone)) {
                $cleanPhone = preg_replace('/[^\d]/', '', $phone);
                if (strlen($cleanPhone) >= 9) {
                    $likePhone = '%' . substr($cleanPhone, -9);
                    $stmtL = $this->db->prepare("SELECT id FROM leads WHERE phone = ? OR phone LIKE ?");
                    $stmtL->execute([$phone, $likePhone]);
                    $leadIds = array_merge($leadIds, $stmtL->fetchAll(PDO::FETCH_COLUMN));
                }
            }
            $leadIds = array_unique(array_filter(array_map('intval', $leadIds)));

            foreach ($leadIds as $lid) {
                $this->db->exec("DELETE FROM lead_offers WHERE lead_id = $lid");
                $this->db->exec("DELETE FROM data_reports WHERE lead_id = $lid");
                $this->db->exec("DELETE FROM communication_logs WHERE lead_id = $lid");
                $this->db->exec("DELETE FROM distribution_logs WHERE lead_id = $lid");
                $this->db->exec("DELETE FROM telegram_queue WHERE lead_id = $lid");
                $this->db->exec("DELETE FROM zalo_queue WHERE lead_id = $lid");
                $this->db->exec("DELETE FROM mail_queue WHERE lead_id = $lid");
                $this->db->exec("DELETE FROM sync_queue WHERE lead_id = $lid");
                $this->db->exec("DELETE FROM leads WHERE id = $lid");
            }
        } catch (\Throwable $e) {
            error_log("Error in cleanupLeadsForContactId: " . $e->getMessage());
        }
    }

    private function getSetting(string $key, string $default): string {
        $stmt = $this->db->prepare("SELECT setting_value FROM system_settings WHERE setting_key = ?");
        $stmt->execute([$key]);
        $val = $stmt->fetchColumn();
        return $val !== false ? $val : $default;
    }

    private function isPersonalOrSelfContact(int $contactId): bool {
        if ($contactId <= 0) return false;
        $stmt = $this->db->prepare("SELECT source, lead_phan_loai, loai_lead, lead_id FROM contacts WHERE id = ? LIMIT 1");
        $stmt->execute([$contactId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) return false;
        $personalTags = ['ca_nhan', 'cá nhân', 'gioi_thieu', 'giới thiệu', 'personal', 'referral', 'manual', 'self'];
        $src = mb_strtolower(trim((string)($row['source'] ?? '')));
        $pl = mb_strtolower(trim((string)($row['lead_phan_loai'] ?? '')));
        $ll = mb_strtolower(trim((string)($row['loai_lead'] ?? '')));
        if (in_array($src, $personalTags, true) || in_array($pl, $personalTags, true) || in_array($ll, $personalTags, true)) {
            return true;
        }
        return (empty($row['lead_id']) && $src !== 'databank');
    }

    private function getSecurityExpiration(string $status): ?string {
        if (in_array($status, ['dat_coc', 'da_coc', 'dong_deal', 'thanh_cong', 'not_lead'], true)) {
            return null;
        }
        $defaultDurations = [
            'chua_xac_dinh' => '+3 hours',
            'quan_tam' => '+1 day',
            'thien_chi' => '+4 days',
            'dong_y_gap' => '+4 days',
            'da_gap' => '+5 days',
            'booking' => '+3 months',
            'cham_soc_dai_han' => '+30 days'
        ];
        $default = $defaultDurations[$status] ?? '+4 days';
        if ($status === 'dong_y_gap' || $status === 'thien_chi') {
            $dongYGapVal = $this->getSetting('security_timer_dong_y_gap', '');
            $thienChiVal = $this->getSetting('security_timer_thien_chi', '');
            $duration = $dongYGapVal !== '' ? $dongYGapVal : ($thienChiVal !== '' ? $thienChiVal : $default);
        } else {
            $duration = $this->getSetting('security_timer_' . $status, '');
            if ($duration === '') {
                $triggerStatus = $this->getSetting('parallel_assignment_trigger_status', 'chua_xac_dinh');
                if ($status === $triggerStatus) {
                    $shareHours = (int)$this->getSetting('uncontacted_lead_share_hours', '3');
                    if ($shareHours > 0) {
                        $duration = "+$shareHours hours";
                    }
                }
            }
            if ($duration === '') {
                $duration = $default;
            }
        }
        if (in_array(strtolower(trim((string)$duration)), ['forever', 'permanent', 'null', 'none', '0'], true)) {
            return null;
        }
        
        return date('Y-m-d H:i:s', strtotime($duration));
    }

    private function getSlugFromStageId(int $stageId, int $tenantId): string {
        $stmt = $this->db->prepare("SELECT system_slug FROM pipeline_stages WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$stageId, $tenantId]);
        $slug = $stmt->fetchColumn();
        return $slug ?: 'chua_xac_dinh';
    }

    private function getStageIdFromSlug(string $slug, int $tenantId): int {
        $searchSlug = ($slug === 'thien_chi') ? 'dong_y_gap' : (($slug === 'dong_y_gap') ? 'thien_chi' : $slug);
        $stmt = $this->db->prepare("SELECT id FROM pipeline_stages WHERE (system_slug = ? OR system_slug = ?) AND tenant_id = ? LIMIT 1");
        $stmt->execute([$slug, $searchSlug, $tenantId]);
        return (int)($stmt->fetchColumn() ?: 0);
    }

    public function releaseDatabank(array $auth, int $id): void {
        if ($auth['role'] === 'viewer') respond(403, null, 'Bạn không có quyền thực hiện thao tác này', false);
        $tid = $auth['tenant_id'];

        // 1. Fetch contact
        $stmt = $this->db->prepare("SELECT id, person_id, owner_id, first_name, last_name, source, lead_phan_loai, loai_lead FROM contacts WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL");
        $stmt->execute([$id, $tid]);
        $contact = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$contact) respond(404, null, 'Không tìm thấy liên hệ', false);

        if (in_array($auth['role'], ['sale', 'sales', 'consultant'], true) && (int)$contact['owner_id'] !== (int)$auth['user_id']) {
            respond(403, null, 'Bạn chỉ có quyền trả về Databank đối với khách hàng do chính bạn phụ trách!', false);
        }

        if ($this->isPersonalOrSelfContact((int)$id)) {
            respond(400, null, 'Khách hàng cá nhân / tự nhập là bảo mật vĩnh viễn và TUYỆT ĐỐI KHÔNG được phép đưa ra kho Databank!', false);
        }

        $personId = $contact['person_id'];

        // Prevent releasing active/deposit clients or coop-eligible clients to Databank
        $stmtStatus = $this->db->prepare("SELECT pipeline_status FROM contacts WHERE id = ?");
        $stmtStatus->execute([$id]);
        $currStatus = $stmtStatus->fetchColumn();

        $coopSettingStmt = $this->db->query("SELECT setting_value FROM system_settings WHERE setting_key = 'coop_eligible_statuses' LIMIT 1");
        $coopSettingVal = $coopSettingStmt ? $coopSettingStmt->fetchColumn() : '';
        if (!empty($coopSettingVal)) {
            $coopStatuses = array_map('trim', explode(',', $coopSettingVal));
        } else {
            $coopStatuses = ['dat_coc', 'da_coc', 'dong_deal', 'thanh_cong'];
        }

        if (in_array($currStatus, $coopStatuses, true)) {
            respond(400, null, 'Không thể giải phóng khách hàng đang ở trạng thái quy định (' . implode(', ', $coopStatuses) . ')!', false);
        }

        // Prevent releasing clients with active cooperation slips to Databank
        $stmtCoop = $this->db->prepare("
            SELECT id FROM cooperation_slips 
            WHERE contact_id IN (SELECT id FROM contacts WHERE person_id = ? AND deleted_at IS NULL) 
              AND status != 'rejected' LIMIT 1
        ");
        $stmtCoop->execute([$personId]);
        if ($stmtCoop->fetch()) {
            respond(400, null, 'Không thể giải phóng khách hàng đang có phiếu hợp tác hoa hồng!', false);
        }

        // Get current consultant ID
        $stmtC = $this->db->prepare("SELECT id FROM consultants WHERE email = ? LIMIT 1");
        $stmtC->execute([$auth['email'] ?? '']);
        $consultantId = $stmtC->fetchColumn();

        // Get latest lead ID for this person
        $stmtLead = $this->db->prepare("SELECT id FROM leads WHERE person_id = ? ORDER BY id DESC LIMIT 1");
        $stmtLead->execute([$personId]);
        $leadId = $stmtLead->fetchColumn();
        $leadId = $leadId ? (int)$leadId : null;

        // 2. Count active contacts for this Person
        $stmtCount = $this->db->prepare("SELECT COUNT(*) FROM contacts WHERE person_id = ? AND tenant_id = ? AND owner_id IS NOT NULL AND deleted_at IS NULL");
        $stmtCount->execute([$personId, $tid]);
        $activeCount = (int)$stmtCount->fetchColumn();

        $this->db->beginTransaction();
        try {
            if ($activeCount <= 1) {
                // Only this sale owns this Person. Release to Databank (keep owner_id on soft-deleted record for Admin rollback history)!
                $defaultStageId = $this->getStageIdFromSlug('chua_xac_dinh', $tid);
                
                $stmtRelease = $this->db->prepare("
                    UPDATE contacts 
                    SET pipeline_status = 'chua_xac_dinh', 
                        stage_id = ?, 
                        status = 'lead',
                        security_expires_at = NULL,
                        parallel_assigned = 0,
                        deleted_at = NOW()
                    WHERE id = ? AND tenant_id = ?
                ");
                $stmtRelease->execute([$defaultStageId, $id, $tid]);

                // Also update persons to be public (preserve first released timestamp)
                $stmtPerson = $this->db->prepare("UPDATE persons SET is_public = 1, released_to_kho_at = IFNULL(released_to_kho_at, NOW()), deleted_from_databank = 0 WHERE id = ?");
                $stmtPerson->execute([$personId]);

                // Record active returner to hide it from this user in Databank
                $stmtRecordReturn = $this->db->prepare("INSERT IGNORE INTO returned_databank_leads (person_id, user_id) VALUES (?, ?)");
                $stmtRecordReturn->execute([$personId, $auth['user_id']]);

                // Also update leads to set assigned_to = NULL
                if ($personId) {
                    $stmtLeadUpdate = $this->db->prepare("UPDATE leads SET assigned_to = NULL, last_assigned_at = NULL WHERE person_id = ?");
                    $stmtLeadUpdate->execute([$personId]);

                    // Xóa toàn bộ thông tin công việc (activities) và ghi chú (notes) khi trả về Databank
                    $stmtDelNotes = $this->db->prepare("DELETE FROM notes WHERE entity_type = 'contact' AND entity_id IN (SELECT id FROM contacts WHERE person_id = ?)");
                    $stmtDelNotes->execute([$personId]);

                    $stmtDelActs = $this->db->prepare("DELETE FROM activities WHERE related_type = 'contact' AND related_id IN (SELECT id FROM contacts WHERE person_id = ?)");
                    $stmtDelActs->execute([$personId]);

                    $stmtClearNotes = $this->db->prepare("UPDATE contacts SET notes = NULL WHERE person_id = ?");
                    $stmtClearNotes->execute([$personId]);

                    // Log distribution log for releasing to databank
                    $stmtLog = $this->db->prepare("INSERT INTO distribution_logs (lead_id, assigned_to, round_id, status, message) VALUES (?, ?, ?, ?, ?)");
                    $stmtLog->execute([$leadId, null, null, 'released_to_kho', 'Tư vấn viên chủ động trả về Databank chung (do chỉ có 1 Sale chăm sóc)']);
                }

                // Log activity & interaction
                logActivity($this->db, $tid, $auth['user_id'], 'RELEASE_TO_DATABANK', 'contact', $id, "Trả khách hàng về Databank chung (do chỉ có 1 Sale chăm sóc)");
                logInteraction($this->db, $tid, $auth['user_id'], 'system', 'Đã trả khách hàng về Databank chung', null, 'contact', $id);

                $this->db->commit();
                respond(200, ['action' => 'released'], 'Đã trả khách hàng về Databank chung thành công!');
            } else {
                // 2 or more sales own this Person in parallel.
                $stmtDelete = $this->db->prepare("UPDATE contacts SET deleted_at = NOW(), notes = NULL WHERE id = ? AND tenant_id = ?");
                $stmtDelete->execute([$id, $tid]);
                
                $this->restorePersonPublicStatus($id, $tid);

                // Record active returner to hide it from this user in Databank
                $stmtRecordReturn = $this->db->prepare("INSERT IGNORE INTO returned_databank_leads (person_id, user_id) VALUES (?, ?)");
                $stmtRecordReturn->execute([$personId, $auth['user_id']]);

                // Xóa thông tin công việc (activities) và ghi chú (notes) liên quan đến contact bị xóa này
                $stmtDelNotes = $this->db->prepare("DELETE FROM notes WHERE entity_type = 'contact' AND entity_id = ?");
                $stmtDelNotes->execute([$id]);

                $stmtDelActs = $this->db->prepare("DELETE FROM activities WHERE related_type = 'contact' AND related_id = ?");
                $stmtDelActs->execute([$id]);

                // Log distribution log for removing parallel contact
                if ($leadId && $consultantId) {
                    $stmtLog = $this->db->prepare("INSERT INTO distribution_logs (lead_id, assigned_to, round_id, status, message) VALUES (?, ?, ?, ?, ?)");
                    $stmtLog->execute([$leadId, $consultantId, null, 'released_to_kho', 'Tư vấn viên xóa khỏi danh sách cá nhân (trả về Databank song song)']);
                }

                // Log activity & interaction
                logActivity($this->db, $tid, $auth['user_id'], 'REMOVE_PARALLEL_CONTACT', 'contact', $id, "Xóa liên hệ khỏi danh sách cá nhân (do trả về Databank song song)");
                
                $this->db->commit();
                respond(200, ['action' => 'deleted'], 'Đã xóa khách hàng khỏi danh sách chăm sóc của bạn thành công!');
            }
        } catch (\Throwable $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            respond(500, null, 'Lỗi trả khách hàng về Databank: ' . $e->getMessage(), false);
        }
    }

    public function reportNotLead(array $auth, int $id): void {
        if ($auth['role'] === 'viewer') respond(403, null, 'Bạn không có quyền thực hiện thao tác này', false);
        $tid = $auth['tenant_id'];

        $input = json_decode(file_get_contents('php://input'), true);
        $reason = trim($input['reason'] ?? 'Không phải khách hàng tiềm năng');

        // 1. Fetch contact
        $stmt = $this->db->prepare("SELECT id, person_id, owner_id, first_name, last_name, phone, email, source, lead_phan_loai, pipeline_status FROM contacts WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL");
        $stmt->execute([$id, $tid]);
        $contact = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$contact) respond(404, null, 'Không tìm thấy liên hệ', false);

        if (in_array($auth['role'], ['sale', 'sales', 'consultant'], true) && (int)$contact['owner_id'] !== (int)$auth['user_id']) {
            respond(403, null, 'Bạn chỉ có quyền báo Not Lead đối với khách hàng do chính bạn phụ trách!', false);
        }

        // Check if contact is from databank
        $isFromDatabank = false;
        $srcLower = strtolower($contact['source'] ?? '');
        $phanLoaiLower = strtolower($contact['lead_phan_loai'] ?? '');
        if (strpos($srcLower, 'databank') !== false || strpos($srcLower, 'kho data') !== false || strpos($srcLower, 'kho_data') !== false || strpos($phanLoaiLower, 'databank') !== false) {
            $isFromDatabank = true;
        }

        $personId = $contact['person_id'];

        // Check if distribution_logs has databank_claim for this contact's person and owner
        if (!$isFromDatabank && $personId) {
            $chkDl = $this->db->prepare("
                SELECT dl.id 
                FROM distribution_logs dl
                JOIN leads l ON dl.lead_id = l.id
                WHERE l.person_id = ? AND dl.assigned_to = ? AND dl.status = 'databank_claim'
                LIMIT 1
            ");
            $chkDl->execute([$personId, $auth['user_id']]);
            if ($chkDl->fetch()) {
                $isFromDatabank = true;
            }
        }

        if ($isFromDatabank) {
            respond(400, null, 'Khách hàng nhận từ Kho Databank không được phép báo cáo Not Lead hoặc gửi ticket báo lỗi. Vui lòng sử dụng tính năng "Trả về Databank"!', false);
        }

        // Prevent reporting not lead if deposit or coop active
        $currStatus = $contact['pipeline_status'];
        if (in_array($currStatus, ['dat_coc', 'da_coc', 'dong_deal', 'thanh_cong'], true)) {
            respond(400, null, 'Không thể báo Not Lead đối với khách hàng đã phát sinh đặt cọc hoặc đóng deal!', false);
        }

        // 2. Ensure a single pending ticket exists in data_reports for Admin / Manager review
        $this->ensurePendingNotLeadTicket($id, $contact, (int)$auth['user_id'], $reason);

        // 3. Update contact: mark pipeline_status = 'not_lead' and not_lead_proposed = 1 (immediately hidden from sale)
        $stmtUpContact = $this->db->prepare("
            UPDATE contacts 
            SET pipeline_status = 'not_lead',
                not_lead_proposed = 1,
                not_lead_proposed_by = ?,
                not_lead_proposed_at = NOW(),
                not_lead_reason = ?
            WHERE id = ? AND tenant_id = ?
        ");
        $stmtUpContact->execute([$auth['user_id'], $reason, $id, $tid]);

        logActivity($this->db, $tid, $auth['user_id'], 'REPORT_NOT_LEAD', 'contact', $id, "Đã gửi đề xuất báo Not Lead lên ban quản trị. Lý do: $reason");

        respond(200, ['success' => true], 'Đã gửi đề xuất Not Lead thành công. Yêu cầu đang chờ Ban quản trị duyệt.');
    }

    private function ensurePendingNotLeadTicket(int $contactId, array $contact, int $userId, string $reason): void {
        $personId = !empty($contact['person_id']) ? (int)$contact['person_id'] : null;
        $leadId = !empty($contact['lead_id']) ? (int)$contact['lead_id'] : null;
        $roundId = null;

        if ($personId) {
            $stL = $this->db->prepare("SELECT id, target_round_id FROM leads WHERE person_id = ? ORDER BY id DESC LIMIT 1");
            $stL->execute([$personId]);
            $lRow = $stL->fetch(PDO::FETCH_ASSOC);
            if ($lRow) {
                $leadId = (int)$lRow['id'];
                $roundId = !empty($lRow['target_round_id']) ? (int)$lRow['target_round_id'] : null;
            }
        }
        if (!$roundId && $leadId) {
            $stDl = $this->db->prepare("SELECT round_id FROM distribution_logs WHERE lead_id = ? ORDER BY id DESC LIMIT 1");
            $stDl->execute([$leadId]);
            $dlRow = $stDl->fetch(PDO::FETCH_ASSOC);
            if ($dlRow && !empty($dlRow['round_id'])) {
                $roundId = (int)$dlRow['round_id'];
            }
        }

        // Resolve consultant_id from user_id (fallback to userId)
        $consultantId = $userId;
        $stCons = $this->db->prepare("SELECT c.id FROM consultants c JOIN users u ON c.email = u.email WHERE u.id = ? LIMIT 1");
        $stCons->execute([$userId]);
        $cIdRow = $stCons->fetchColumn();
        if ($cIdRow) {
            $consultantId = (int)$cIdRow;
        }

        if (!$leadId) {
            $leadName = trim(($contact['last_name'] ?? '') . ' ' . ($contact['first_name'] ?? ''));
            if (empty($leadName)) $leadName = 'Khách hàng #' . $contactId;
            $stInsLead = $this->db->prepare("INSERT INTO leads (person_id, name, phone, email, source, status, assigned_to, created_at) VALUES (?, ?, ?, ?, ?, 'lead', ?, NOW())");
            $stInsLead->execute([$personId, $leadName, $contact['phone'] ?? null, $contact['email'] ?? null, $contact['source'] ?? 'crm', $consultantId]);
            $leadId = (int)$this->db->lastInsertId();
            if ($leadId > 0) {
                $this->db->prepare("UPDATE contacts SET lead_id = ? WHERE id = ?")->execute([$leadId, $contactId]);
            }
        }

        // Prevent duplicate pending tickets in data_reports for the same lead_id
        $stmtChkPending = $this->db->prepare("SELECT id FROM data_reports WHERE lead_id = ? AND status = 'pending' ORDER BY id DESC LIMIT 1");
        $stmtChkPending->execute([$leadId]);
        $existingPendingId = $stmtChkPending->fetchColumn();

        if ($existingPendingId) {
            $stmtUpdRep = $this->db->prepare("UPDATE data_reports SET reason = ?, consultant_id = ?, round_id = COALESCE(?, round_id) WHERE id = ?");
            $stmtUpdRep->execute([$reason, $consultantId, $roundId, (int)$existingPendingId]);
        } else {
            $stmtInsReport = $this->db->prepare("
                INSERT INTO data_reports (lead_id, consultant_id, round_id, reason, status, created_at)
                VALUES (?, ?, ?, ?, 'pending', NOW())
            ");
            $stmtInsReport->execute([$leadId, $consultantId, $roundId, $reason]);
        }
    }

    private function getScope(array $auth, string $module, string $action): string {
        if (in_array($auth['role'], ['admin', 'superadmin', 'super_admin'], true)) {
            return 'all';
        }

        if (in_array($auth['role'], ['sale', 'sales'], true) && ($module === 'deals' || $module === 'leads' || $module === 'contacts' || $module === 'customers')) {
            return $action === 'delete' ? 'none' : 'own';
        }

        $permissionsJson = null;
        if (isset($auth['permissions']) && is_array($auth['permissions'])) {
            $permissionsJson = $auth['permissions'];
        } else {
            $stmtQ = $this->db->prepare("SELECT permissions_json FROM users WHERE id = ? LIMIT 1");
            $stmtQ->execute([$auth['user_id']]);
            $resQ = $stmtQ->fetch(PDO::FETCH_ASSOC);
            if ($resQ && !empty($resQ['permissions_json'])) {
                $permissionsJson = json_decode($resQ['permissions_json'], true);
            }
        }

        if ($permissionsJson && isset($permissionsJson[$module][$action])) {
            $val = $permissionsJson[$module][$action];
            if (in_array($val, ['all', 'team', 'own', 'none'], true)) {
                if ($action !== 'delete' && $val === 'none' && in_array($auth['role'], ['sale', 'sales', 'manager', 'director', 'assistant'], true)) {
                    return 'own';
                }
                return $val;
            }
        }

        // Default fallbacks
        $role = $auth['role'];
        if ($role === 'director') {
            if ($module === 'settings') {
                return 'none';
            }
            return 'all';
        }
        if ($role === 'assistant') {
            return $action === 'delete' ? 'none' : 'all';
        }
        if ($role === 'manager') {
            return $action === 'delete' ? 'none' : 'team';
        }
        if (in_array($role, ['sale', 'sales'], true)) {
            if ($module === 'projects') {
                return $action === 'read' ? 'all' : 'none';
            }
            return $action === 'delete' ? 'none' : 'own';
        }
        if ($role === 'viewer') {
            return $action === 'read' ? 'all' : 'none';
        }

        return 'none';
    }

    private function restorePersonPublicStatus(int $contactId, int $tenantId): void {
        if ($this->isPersonalOrSelfContact($contactId)) {
            return;
        }
        $stmt = $this->db->prepare("SELECT person_id FROM contacts WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$contactId, $tenantId]);
        $personId = $stmt->fetchColumn();
        if ($personId) {
            $stmtCount = $this->db->prepare("SELECT COUNT(*) FROM contacts WHERE person_id = ? AND tenant_id = ? AND owner_id IS NOT NULL AND deleted_at IS NULL");
            $stmtCount->execute([$personId, $tenantId]);
            $activeClaims = (int)$stmtCount->fetchColumn();

            $stmtProtected = $this->db->prepare("
                SELECT COUNT(*) FROM contacts 
                WHERE person_id = ? AND tenant_id = ? AND deleted_at IS NULL 
                  AND (
                      pipeline_status IN ((SELECT setting_value FROM system_settings WHERE setting_key = 'deal_won_status' LIMIT 1), 'dat_coc', 'da_coc', 'dong_deal', 'thanh_cong', 'not_lead')
                      OR security_expires_at > NOW()
                      OR COALESCE(LOWER(source), '') IN ('ca_nhan', 'cá nhân', 'gioi_thieu', 'giới thiệu', 'personal', 'referral', 'manual', 'self')
                      OR COALESCE(LOWER(lead_phan_loai), '') IN ('ca_nhan', 'cá nhân', 'gioi_thieu', 'giới thiệu', 'personal', 'referral', 'manual', 'self')
                      OR COALESCE(LOWER(loai_lead), '') IN ('ca_nhan', 'cá nhân', 'gioi_thieu', 'giới thiệu', 'personal', 'referral', 'manual', 'self')
                      OR ((lead_id IS NULL OR lead_id = 0) AND COALESCE(LOWER(source), '') != 'databank')
                  )
            ");
            $stmtProtected->execute([$personId, $tenantId]);
            $hasProtectedStatus = ((int)$stmtProtected->fetchColumn() > 0);

            $maxParallelClaims = 2;
            $stmtSetting = $this->db->prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'max_parallel_sales_per_client' LIMIT 1");
            $stmtSetting->execute();
            $sVal = $stmtSetting->fetchColumn();
            if ($sVal !== false) {
                $maxParallelClaims = (int)$sVal;
            }

            if ($activeClaims < $maxParallelClaims && !$hasProtectedStatus) {
                $stmtUp = $this->db->prepare("UPDATE persons SET is_public = 1 WHERE id = ? AND is_blocked = 0");
                $stmtUp->execute([$personId]);
            }
        }
    }

    public function getCollaborators(array $auth, int $contactId): void {
        // Verify contact exists
        $stmtCheck = $this->db->prepare("SELECT owner_id, tenant_id FROM contacts WHERE id = ? AND deleted_at IS NULL");
        $stmtCheck->execute([$contactId]);
        $contact = $stmtCheck->fetch(PDO::FETCH_ASSOC);
        if (!$contact || (int)$contact['tenant_id'] !== (int)$auth['tenant_id']) {
            respond(404, null, 'Không tìm thấy khách hàng', false);
        }

        $ownerId = (int)$contact['owner_id'];

        $helperUserIds = [];

        // 1. From quyen_truy_cap (kể cả nhân sự từng được cấp quyền)
        $stmtQ = $this->db->prepare("SELECT DISTINCT user_id FROM quyen_truy_cap WHERE contact_id = ?");
        $stmtQ->execute([$contactId]);
        foreach ($stmtQ->fetchAll(PDO::FETCH_COLUMN) as $uid) {
            $uInt = (int)$uid;
            if ($uInt > 0 && $uInt !== $ownerId) {
                $helperUserIds[$uInt] = true;
            }
        }

        // 2. From contacts.collaborator_ids
        $stmtCollab = $this->db->prepare("SELECT collaborator_ids FROM contacts WHERE id = ?");
        $stmtCollab->execute([$contactId]);
        $collabRow = $stmtCollab->fetch(PDO::FETCH_ASSOC);
        if (!empty($collabRow['collaborator_ids'])) {
            $cIds = array_filter(array_map('intval', explode(',', $collabRow['collaborator_ids'])));
            foreach ($cIds as $cid) {
                if ($cid > 0 && $cid !== $ownerId) {
                    $helperUserIds[$cid] = true;
                }
            }
        }

        // 3. From cooperation_slips (Người từng có tên trong phiếu hợp tác / bị thu hồi quyền nhưng vẫn có công)
        $stmtSlips = $this->db->prepare("SELECT shares_json FROM cooperation_slips WHERE contact_id = ?");
        $stmtSlips->execute([$contactId]);
        while ($slipRow = $stmtSlips->fetch(PDO::FETCH_ASSOC)) {
            if (!empty($slipRow['shares_json'])) {
                $decodedShares = json_decode($slipRow['shares_json'], true);
                if (is_array($decodedShares)) {
                    foreach (array_keys($decodedShares) as $sUid) {
                        $sUidInt = (int)$sUid;
                        if ($sUidInt > 0 && $sUidInt !== $ownerId) {
                            $helperUserIds[$sUidInt] = true;
                        }
                    }
                }
            }
        }

        // Enforce Role Matrix access check for Sales
        if (in_array($auth['role'], ['sale', 'sales', 'consultant'], true)) {
            $curUid = (int)$auth['user_id'];
            if ($curUid !== $ownerId && !isset($helperUserIds[$curUid])) {
                respond(403, null, 'Bạn không có quyền truy cập danh sách người hỗ trợ của khách hàng này', false);
            }
        }

        $helpers = [];
        if (!empty($helperUserIds)) {
            $inClause = implode(',', array_map('intval', array_keys($helperUserIds)));
            $stmtUsers = $this->db->query("SELECT id as user_id, full_name, username, role, avatar_url as avatar FROM users WHERE id IN ($inClause)");
            $helpers = $stmtUsers->fetchAll(PDO::FETCH_ASSOC) ?: [];
        }

        // Always include the owner at the top of the collaborators list
        $stmtOwner = $this->db->prepare("SELECT id, full_name, username, role, avatar_url as avatar FROM users WHERE id = ?");
        $stmtOwner->execute([$ownerId]);
        $owner = $stmtOwner->fetch(PDO::FETCH_ASSOC);

        $result = [
            'owner' => $owner,
            'helpers' => $helpers
        ];

        respond(200, $result, 'Lấy danh sách người hỗ trợ thành công');
    }

    /**
     * POST /contacts/bulk-collaborators
     * Bulk add / replace / remove co-care collaborators (Người cùng chăm sóc)
     * Accessible to Sales (for their own contacts), Managers (for team), and Admins (for all).
     */
    public function bulkUpdateCollaborators(array $auth): void {
        if (($auth['role'] ?? '') === 'viewer') {
            respond(403, null, 'Bạn không có quyền thực hiện thao tác này', false);
        }
        $tid = (int)($auth['tenant_id'] ?? 1);
        $currentUserId = (int)($auth['user_id'] ?? 0);
        $b = getBody();

        $rawContactIds = $b['contact_ids'] ?? $b['ids'] ?? [];
        if (is_string($rawContactIds)) {
            $rawContactIds = explode(',', $rawContactIds);
        }
        $contactIds = array_values(array_unique(array_filter(array_map('intval', (array)$rawContactIds))));
        if (empty($contactIds)) {
            respond(422, null, 'Vui lòng chọn ít nhất 1 khách hàng', false);
        }
        if (count($contactIds) > 500) {
            respond(422, null, 'Chỉ hỗ trợ thao tác tối đa 500 khách hàng mỗi lần', false);
        }

        $rawMode = $b['mode'] ?? 'add';
        if ($rawMode === 'set') {
            $rawMode = 'replace';
        }
        $mode = in_array($rawMode, ['add', 'replace', 'remove'], true) ? $rawMode : 'add';
        $rawCollabIds = $b['collaborator_ids'] ?? [];
        if (is_string($rawCollabIds)) {
            $rawCollabIds = explode(',', $rawCollabIds);
        }
        $inputCollabIds = array_values(array_unique(array_filter(array_map('intval', (array)$rawCollabIds))));
        if ($mode !== 'replace' && empty($inputCollabIds)) {
            respond(422, null, 'Vui lòng chọn ít nhất 1 nhân sự chăm sóc', false);
        }

        // Map any consultant IDs to user IDs if needed
        $resolvedCollabIds = [];
        if (!empty($inputCollabIds)) {
            $inCollab = implode(',', array_fill(0, count($inputCollabIds), '?'));
            $stmtMap = $this->db->prepare("
                SELECT DISTINCT u.id
                FROM users u
                LEFT JOIN consultants c ON (u.email = c.email OR u.id = c.id)
                WHERE u.id IN ($inCollab) OR c.id IN ($inCollab)
            ");
            $stmtMap->execute(array_merge($inputCollabIds, $inputCollabIds));
            $mapped = $stmtMap->fetchAll(PDO::FETCH_COLUMN);
            foreach ($mapped as $muid) {
                if ((int)$muid > 0) $resolvedCollabIds[] = (int)$muid;
            }
            if (empty($resolvedCollabIds)) {
                $resolvedCollabIds = $inputCollabIds;
            }
            $resolvedCollabIds = array_values(array_unique($resolvedCollabIds));
        }

        // Role Matrix Isolation check
        $scope = $this->getScope($auth, 'leads', 'write');
        $inClause = implode(',', array_fill(0, count($contactIds), '?'));
        $sqlFetch = "SELECT id, first_name, last_name, owner_id, created_by, collaborator_ids FROM contacts WHERE tenant_id = ? AND deleted_at IS NULL AND id IN ($inClause)";
        $fetchParams = array_merge([$tid], $contactIds);

        if ($scope === 'own') {
            $sqlFetch .= " AND (owner_id = ? OR created_by = ? OR FIND_IN_SET(?, collaborator_ids))";
            $fetchParams[] = $currentUserId;
            $fetchParams[] = $currentUserId;
            $fetchParams[] = $currentUserId;
        } else if ($scope === 'team') {
            $stmtTeam = $this->db->prepare("
                SELECT id FROM users 
                WHERE team_id IN (
                    SELECT id FROM teams 
                    WHERE FIND_IN_SET(?, CONCAT(leader_id, CHAR(44), COALESCE(co_leader_ids, leader_id)))
                ) OR team_id = (SELECT team_id FROM users WHERE id = ?)
            ");
            $stmtTeam->execute([$currentUserId, $currentUserId]);
            $teamIds = array_unique(array_merge([$currentUserId], array_map('intval', $stmtTeam->fetchAll(PDO::FETCH_COLUMN) ?: [])));
            $teamClause = implode(',', $teamIds);
            $sqlFetch .= " AND (owner_id IN ($teamClause) OR created_by IN ($teamClause))";
        } else if ($scope !== 'all') {
            respond(403, null, 'Bạn không có quyền cập nhật khách hàng', false);
        }

        $stmtContacts = $this->db->prepare($sqlFetch);
        $stmtContacts->execute($fetchParams);
        $rows = $stmtContacts->fetchAll(PDO::FETCH_ASSOC);

        if (empty($rows)) {
            respond(403, null, 'Không tìm thấy khách hàng hợp lệ hoặc bạn không phải người phụ trách các khách hàng đã chọn', false);
        }

        $updatedIds = [];
        $updatedContactsMap = [];
        $newlyAddedByUser = [];
        $batchAccessInserts = [];
        $batchAccessDeletes = [];

        $this->db->beginTransaction();
        try {
            $stmtUpdate = $this->db->prepare("UPDATE contacts SET collaborator_ids = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?");

            foreach ($rows as $row) {
                $cid = (int)$row['id'];
                $ownerId = (int)($row['owner_id'] ?? 0);
                $oldCollabs = array_values(array_unique(array_filter(array_map('intval', explode(',', $row['collaborator_ids'] ?? '')))));

                if ($mode === 'add') {
                    $newCollabs = array_values(array_unique(array_merge($oldCollabs, $resolvedCollabIds)));
                } else if ($mode === 'remove') {
                    $newCollabs = array_values(array_diff($oldCollabs, $resolvedCollabIds));
                } else {
                    $newCollabs = $resolvedCollabIds;
                }

                // Never include main owner_id inside collaborator_ids
                $newCollabs = array_values(array_filter($newCollabs, function($uid) use ($ownerId) {
                    return $uid > 0 && $uid !== $ownerId;
                }));

                $newCollabStr = !empty($newCollabs) ? implode(',', $newCollabs) : null;
                $stmtUpdate->execute([$newCollabStr, $cid, $tid]);
                $updatedIds[] = $cid;
                $updatedContactsMap[$cid] = $newCollabStr ?? '';

                $added = array_diff($newCollabs, $oldCollabs);
                $removed = array_diff($oldCollabs, $newCollabs);

                foreach ($added as $auid) {
                    $batchAccessInserts[] = [$cid, (int)$auid];
                    if ($auid !== $currentUserId) {
                        $newlyAddedByUser[$auid][] = trim(($row['last_name'] ?? '') . ' ' . ($row['first_name'] ?? ''));
                    }
                }
                foreach ($removed as $ruid) {
                    $batchAccessDeletes[] = [$cid, (int)$ruid];
                }
            }

            if (!empty($batchAccessInserts)) {
                $placeholders = implode(',', array_fill(0, count($batchAccessInserts), '(?, ?)'));
                $flatIns = [];
                foreach ($batchAccessInserts as $pair) {
                    $flatIns[] = $pair[0];
                    $flatIns[] = $pair[1];
                }
                try {
                    $stmtBatchIns = $this->db->prepare("INSERT IGNORE INTO quyen_truy_cap (contact_id, user_id) VALUES $placeholders");
                    $stmtBatchIns->execute($flatIns);
                } catch (\Throwable $e) {}
            }

            if (!empty($batchAccessDeletes)) {
                $stmtDelAccess = $this->db->prepare("DELETE FROM quyen_truy_cap WHERE contact_id = ? AND user_id = ?");
                foreach ($batchAccessDeletes as $pair) {
                    try { $stmtDelAccess->execute([$pair[0], $pair[1]]); } catch (\Throwable $e) {}
                }
            }

            $this->db->commit();
        } catch (\Throwable $e) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            respond(500, null, 'Lỗi cập nhật người chăm sóc hàng loạt: ' . $e->getMessage(), false);
        }

        // Send concise grouped notification per newly added collaborator (no external spam!)
        if (!empty($newlyAddedByUser)) {
            require_once __DIR__ . '/../NotificationService.php';
            $inviterName = $auth['full_name'] ?? 'Đồng nghiệp';
            foreach ($newlyAddedByUser as $targetUid => $custNames) {
                $countCust = count($custNames);
                $sampleNames = implode(', ', array_slice($custNames, 0, 3)) . ($countCust > 3 ? " và " . ($countCust - 3) . " khách khác" : "");
                try {
                    NotificationService::send($this->db, $tid, 'COOP_INVITATION', [
                        'user_id' => (int)$targetUid,
                        'customer_name' => $sampleNames,
                        'inviter_name' => $inviterName,
                        'contact_id' => $updatedIds[0] ?? 0
                    ]);
                } catch (\Throwable $e) {}
            }
        }

        logActivity($this->db, $tid, $currentUserId, 'BULK_UPDATE_COLLABORATORS', 'contact', $updatedIds[0] ?? 0, json_encode([
            'mode' => $mode,
            'collaborator_ids' => $resolvedCollabIds,
            'updated_count' => count($updatedIds),
            'contact_ids' => $updatedIds
        ]));

        $updatedCount = count($updatedIds);
        respond(200, [
            'updated_count' => $updatedCount,
            'contact_ids' => $updatedIds,
            'collaborator_ids' => $resolvedCollabIds,
            'updated_contacts' => $updatedContactsMap
        ], "Đã cập nhật người cùng chăm sóc cho {$updatedCount} khách hàng thành công!");
    }

    /**
     * POST /contacts/bulk-assign
     * Bulk change main owner_id for selected contacts (Admin / Manager / Director)
     */
    public function bulkAssignOwner(array $auth): void {
        if (in_array($auth['role'] ?? '', ['sale', 'sales', 'consultant', 'viewer'], true)) {
            respond(403, null, 'Chỉ Quản trị viên hoặc Trưởng nhóm mới có quyền chuyển người phụ trách chính hàng loạt', false);
        }
        $tid = (int)($auth['tenant_id'] ?? 1);
        $currentUserId = (int)($auth['user_id'] ?? 0);
        $b = getBody();

        $rawContactIds = $b['contact_ids'] ?? $b['ids'] ?? [];
        if (is_string($rawContactIds)) {
            $rawContactIds = explode(',', $rawContactIds);
        }
        $contactIds = array_values(array_unique(array_filter(array_map('intval', (array)$rawContactIds))));
        $targetOwnerId = (int)($b['owner_id'] ?? 0);
        $keepOldAsCollab = !empty($b['keep_old_owner_as_collaborator']);

        if (empty($contactIds) || $targetOwnerId <= 0) {
            respond(422, null, 'Vui lòng chọn danh sách khách hàng và nhân viên phụ trách mới', false);
        }

        // Resolve targetOwnerId to users.id (with fallback from consultants.id)
        $stmtUser = $this->db->prepare("SELECT id, full_name, avatar_url FROM users WHERE id = ? LIMIT 1");
        $stmtUser->execute([$targetOwnerId]);
        $targetUser = $stmtUser->fetch(PDO::FETCH_ASSOC);
        if (!$targetUser) {
            $stmtFromCons = $this->db->prepare("SELECT u.id, u.full_name, u.avatar_url FROM consultants c JOIN users u ON u.email = c.email WHERE c.id = ? LIMIT 1");
            $stmtFromCons->execute([$targetOwnerId]);
            $targetUser = $stmtFromCons->fetch(PDO::FETCH_ASSOC);
            if ($targetUser) {
                $targetOwnerId = (int)$targetUser['id'];
            }
        }
        if (!$targetUser) {
            respond(404, null, 'Không tìm thấy nhân viên phụ trách mới', false);
        }

        $inClause = implode(',', array_fill(0, count($contactIds), '?'));
        $stmtContacts = $this->db->prepare("SELECT id, owner_id, collaborator_ids, pipeline_status, lead_id, person_id FROM contacts WHERE tenant_id = ? AND id IN ($inClause)");
        $stmtContacts->execute(array_merge([$tid], $contactIds));
        $rows = $stmtContacts->fetchAll(PDO::FETCH_ASSOC);

        if (empty($rows)) {
            respond(404, null, 'Không tìm thấy khách hàng để chuyển phụ trách', false);
        }

        $targetConsultantId = $targetOwnerId;
        $stmtCid = $this->db->prepare("SELECT c.id FROM consultants c JOIN users u ON u.email = c.email WHERE u.id = ? LIMIT 1");
        $stmtCid->execute([$targetOwnerId]);
        $resolvedCid = $stmtCid->fetchColumn();
        if ($resolvedCid) {
            $targetConsultantId = (int)$resolvedCid;
        }

        $updatedIds = [];
        $updatedContactsMap = [];
        $batchAccessInserts = [];
        $leadIdsToSync = [];
        $personIdsToSync = [];

        $this->db->beginTransaction();
        try {
            $stmtUp = $this->db->prepare("UPDATE contacts SET owner_id = ?, collaborator_ids = ?, deleted_at = NULL, updated_at = NOW() WHERE id = ? AND tenant_id = ?");
            foreach ($rows as $row) {
                $cid = (int)$row['id'];
                $oldOwner = (int)($row['owner_id'] ?? 0);
                if (!empty($row['lead_id'])) {
                    $leadIdsToSync[] = (int)$row['lead_id'];
                } elseif (!empty($row['person_id'])) {
                    $personIdsToSync[] = (int)$row['person_id'];
                }
                $collabs = array_values(array_unique(array_filter(array_map('intval', explode(',', $row['collaborator_ids'] ?? '')))));
                if ($keepOldAsCollab && $oldOwner > 0 && $oldOwner !== $targetOwnerId) {
                    $collabs[] = $oldOwner;
                    $batchAccessInserts[] = [$cid, $oldOwner];
                }
                $collabs = array_values(array_unique(array_filter($collabs, function($uid) use ($targetOwnerId) {
                    return $uid > 0 && $uid !== $targetOwnerId;
                })));
                $collabStr = !empty($collabs) ? implode(',', $collabs) : null;
                $stmtUp->execute([$targetOwnerId, $collabStr, $cid, $tid]);
                $updatedIds[] = $cid;
                $updatedContactsMap[$cid] = [
                    'owner_id' => $targetOwnerId,
                    'owner_name' => $targetUser['full_name'],
                    'owner_avatar' => $targetUser['avatar_url'] ?? null,
                    'collaborator_ids' => $collabStr ?? ''
                ];
            }

            $leadIdsToSync = array_values(array_unique(array_filter($leadIdsToSync)));
            if (!empty($leadIdsToSync)) {
                $inLeads = implode(',', array_fill(0, count($leadIdsToSync), '?'));
                $stmtSyncL = $this->db->prepare("UPDATE leads SET assigned_to = ? WHERE id IN ($inLeads)");
                $stmtSyncL->execute(array_merge([$targetConsultantId], $leadIdsToSync));
            }
            $personIdsToSync = array_values(array_unique(array_filter($personIdsToSync)));
            if (!empty($personIdsToSync)) {
                $inPersons = implode(',', array_fill(0, count($personIdsToSync), '?'));
                $stmtSyncP = $this->db->prepare("UPDATE leads SET assigned_to = ? WHERE person_id IN ($inPersons)");
                $stmtSyncP->execute(array_merge([$targetConsultantId], $personIdsToSync));
            }

            if (!empty($batchAccessInserts)) {
                $placeholders = implode(',', array_fill(0, count($batchAccessInserts), '(?, ?)'));
                $flatIns = [];
                foreach ($batchAccessInserts as $pair) {
                    $flatIns[] = $pair[0];
                    $flatIns[] = $pair[1];
                }
                try {
                    $stmtBatchIns = $this->db->prepare("INSERT IGNORE INTO quyen_truy_cap (contact_id, user_id) VALUES $placeholders");
                    $stmtBatchIns->execute($flatIns);
                } catch (\Throwable $e) {}
            }

            $this->db->commit();
        } catch (\Throwable $e) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            respond(500, null, 'Lỗi chuyển người phụ trách hàng loạt: ' . $e->getMessage(), false);
        }

        logActivity($this->db, $tid, $currentUserId, 'BULK_ASSIGN_OWNER', 'contact', $updatedIds[0] ?? 0, json_encode([
            'target_owner_id' => $targetOwnerId,
            'keep_old_owner_as_collaborator' => $keepOldAsCollab,
            'updated_count' => count($updatedIds),
            'contact_ids' => $updatedIds
        ]));

        $cnt = count($updatedIds);
        respond(200, [
            'updated_count' => $cnt,
            'contact_ids' => $updatedIds,
            'owner_id' => $targetOwnerId,
            'owner_name' => $targetUser['full_name'],
            'owner_avatar' => $targetUser['avatar_url'] ?? null,
            'updated_contacts' => $updatedContactsMap
        ], "Đã gán người phụ trách chính ({$targetUser['full_name']}) cho {$cnt} khách hàng thành công!");
    }

    /**
     * POST /contacts/bulk-restore-reclaimed
     * Admin / Manager restores (back lại) reclaimed/returned contacts or leads back to their previous Sale or a selected Sale.
     */
    public function bulkRestoreReclaimed(array $auth): void {
        if (in_array($auth['role'] ?? '', ['sale', 'sales', 'consultant', 'viewer'], true)) {
            respond(403, null, 'Chỉ Quản trị viên hoặc Quản lý mới có quyền khôi phục (Back lại) khách hàng đã thu hồi!', false);
        }
        $tid = (int)($auth['tenant_id'] ?? 1);
        $adminUserId = (int)($auth['user_id'] ?? 0);
        $b = getBody();

        $rawContactIds = $b['contact_ids'] ?? $b['ids'] ?? [];
        if (is_string($rawContactIds)) {
            $rawContactIds = explode(',', $rawContactIds);
        }
        $contactIds = array_values(array_unique(array_filter(array_map('intval', (array)$rawContactIds))));
        $personIds  = array_values(array_unique(array_filter(array_map('intval', (array)($b['person_ids'] ?? [])))));
        $leadIds    = array_values(array_unique(array_filter(array_map('intval', (array)($b['lead_ids'] ?? [])))));
        $targetOwnerId = isset($b['target_owner_id']) && (int)$b['target_owner_id'] > 0 ? (int)$b['target_owner_id'] : 0;
        $hideFromDatabank = !isset($b['hide_from_databank']) || (bool)$b['hide_from_databank'];

        if (empty($contactIds) && empty($personIds) && empty($leadIds)) {
            respond(422, null, 'Vui lòng chọn ít nhất 1 khách hàng cần khôi phục thu hồi', false);
        }

        // Resolve targetOwnerId if a consultant_id was passed instead of user_id
        if ($targetOwnerId > 0) {
            $stmtChkU = $this->db->prepare("SELECT id FROM users WHERE id = ? LIMIT 1");
            $stmtChkU->execute([$targetOwnerId]);
            if (!$stmtChkU->fetchColumn()) {
                $stmtFromCons = $this->db->prepare("SELECT u.id FROM consultants c JOIN users u ON u.email = c.email WHERE c.id = ? LIMIT 1");
                $stmtFromCons->execute([$targetOwnerId]);
                $mappedUid = (int)$stmtFromCons->fetchColumn();
                if ($mappedUid > 0) $targetOwnerId = $mappedUid;
            }
        }

        // If lead_ids were provided (e.g., from DataList recalled timeline), map them to person_ids & contact_ids
        if (!empty($leadIds)) {
            $inLeads = implode(',', array_fill(0, count($leadIds), '?'));
            $stmtLeads = $this->db->prepare("SELECT id, person_id, phone FROM leads WHERE id IN ($inLeads)");
            $stmtLeads->execute($leadIds);
            foreach ($stmtLeads->fetchAll(PDO::FETCH_ASSOC) as $lRow) {
                if (!empty($lRow['person_id'])) {
                    $personIds[] = (int)$lRow['person_id'];
                }
            }
            $personIds = array_values(array_unique(array_filter($personIds)));
        }

        // If person_ids were provided (e.g., from Kho Databank), find the latest soft-deleted or expired contact for each person_id
        if (!empty($personIds)) {
            $inPersons = implode(',', array_fill(0, count($personIds), '?'));
            $stmtFindContacts = $this->db->prepare("
                SELECT c.id, c.person_id, c.deleted_at
                FROM contacts c
                WHERE c.tenant_id = ? AND c.person_id IN ($inPersons)
                ORDER BY (c.deleted_at IS NOT NULL) DESC, c.id DESC
            ");
            $stmtFindContacts->execute(array_merge([$tid], $personIds));
            $seenPersons = [];
            foreach ($stmtFindContacts->fetchAll(PDO::FETCH_ASSOC) as $fc) {
                $pid = (int)$fc['person_id'];
                if (!isset($seenPersons[$pid])) {
                    $seenPersons[$pid] = true;
                    $contactIds[] = (int)$fc['id'];
                }
            }
            $contactIds = array_values(array_unique(array_filter($contactIds)));
        }

        if (empty($contactIds)) {
            respond(404, null, 'Không tìm thấy bản ghi khách hàng tương ứng để khôi phục', false);
        }

        $inContacts = implode(',', array_fill(0, count($contactIds), '?'));
        $stmtContacts = $this->db->prepare("
            SELECT c.id, c.person_id, c.lead_id, c.owner_id, c.first_name, c.last_name, c.phone, c.pipeline_status, c.source, c.deleted_at
            FROM contacts c
            WHERE c.tenant_id = ? AND c.id IN ($inContacts)
        ");
        $stmtContacts->execute(array_merge([$tid], $contactIds));
        $contacts = $stmtContacts->fetchAll(PDO::FETCH_ASSOC);

        if (empty($contacts)) {
            respond(404, null, 'Không tìm thấy hồ sơ khách hàng cần khôi phục', false);
        }

        $restoredCount = 0;
        $restoredDetails = [];

        $this->db->beginTransaction();
        try {
            $stL = $this->db->prepare("SELECT id FROM leads WHERE person_id = ? ORDER BY id DESC LIMIT 1");
            $stRdl = $this->db->prepare("SELECT user_id FROM returned_databank_leads WHERE person_id = ? ORDER BY id DESC LIMIT 1");
            $stDl = $this->db->prepare("
                SELECT assigned_to FROM distribution_logs
                WHERE lead_id = ? AND assigned_to IS NOT NULL AND assigned_to > 0
                ORDER BY FIELD(status, 'recalled_to_databank', 'recalled', 'released_to_kho', 'databank_claim', 'grabbed', 'assigned'), id DESC
                LIMIT 1
            ");
            $stMapU = $this->db->prepare("SELECT id FROM users WHERE id = ? LIMIT 1");
            $stMapC = $this->db->prepare("SELECT u.id FROM consultants c JOIN users u ON u.email = c.email WHERE c.id = ? LIMIT 1");
            $stmtRestore = $this->db->prepare("
                UPDATE contacts
                SET owner_id = ?,
                    deleted_at = NULL,
                    security_expires_at = ?,
                    created_at = CASE WHEN pipeline_status IN ('chua_xac_dinh', 'not_lead_pending') THEN NOW() ELSE created_at END,
                    updated_at = NOW()
                WHERE id = ? AND tenant_id = ?
            ");
            $stmtDelReturn = $this->db->prepare("DELETE FROM returned_databank_leads WHERE person_id = ? AND user_id = ?");
            $stmtHideKho = $this->db->prepare("UPDATE persons SET is_public = 0, released_to_kho_at = NULL WHERE id = ?");
            $stConsId = $this->db->prepare("SELECT c.id FROM users u JOIN consultants c ON u.email = c.email WHERE u.id = ? LIMIT 1");
            $stUpLead = $this->db->prepare("UPDATE leads SET assigned_to = ?, status = 'assigned', is_accepted = 1, last_assigned_at = NOW(), last_interaction_date = NOW() WHERE id = ?");
            $stLog = $this->db->prepare("INSERT INTO distribution_logs (lead_id, assigned_to, round_id, status, message) VALUES (?, ?, NULL, 'assigned', ?)");
            $stNotif = $this->db->prepare("INSERT INTO notifications (user_id, tenant_id, title, body, type, link) VALUES (?, ?, ?, ?, 'lead_assigned', ?)");

            $userToConsCache = [];
            $expiryCache = [];
            $minTomorrow = date('Y-m-d H:i:s', strtotime('+24 hours'));

            foreach ($contacts as $c) {
                $cid = (int)$c['id'];
                $pid = (int)($c['person_id'] ?? 0);
                $lid = (int)($c['lead_id'] ?? 0);
                if ($lid <= 0 && $pid > 0) {
                    $stL->execute([$pid]);
                    $lid = (int)$stL->fetchColumn();
                }

                // Determine which Sale (users.id) to restore to
                $restoreUserId = $targetOwnerId > 0 ? $targetOwnerId : (int)($c['owner_id'] ?? 0);

                // Fallback 1: check returned_databank_leads
                if ($restoreUserId <= 0 && $pid > 0) {
                    $stRdl->execute([$pid]);
                    $restoreUserId = (int)$stRdl->fetchColumn();
                }

                // Fallback 2: check distribution_logs
                if ($restoreUserId <= 0 && $lid > 0) {
                    $stDl->execute([$lid]);
                    $rawAssigned = (int)$stDl->fetchColumn();
                    if ($rawAssigned > 0) {
                        $stMapU->execute([$rawAssigned]);
                        if ($stMapU->fetchColumn()) {
                            $restoreUserId = $rawAssigned;
                        } else {
                            $stMapC->execute([$rawAssigned]);
                            $restoreUserId = (int)$stMapC->fetchColumn();
                        }
                    }
                }

                if ($restoreUserId <= 0) {
                    continue;
                }

                $statusSlug = !empty($c['pipeline_status']) && $c['pipeline_status'] !== 'not_lead' ? $c['pipeline_status'] : 'chua_xac_dinh';
                if (!isset($expiryCache[$statusSlug])) {
                    $exp = $this->getSecurityExpiration($statusSlug);
                    if (!$exp || $exp < $minTomorrow) {
                        $exp = $minTomorrow;
                    }
                    $expiryCache[$statusSlug] = $exp;
                }
                $freshExpires = $expiryCache[$statusSlug];

                $stmtRestore->execute([$restoreUserId, $freshExpires, $cid, $tid]);

                if ($pid > 0) {
                    $stmtDelReturn->execute([$pid, $restoreUserId]);
                    if ($hideFromDatabank) {
                        $stmtHideKho->execute([$pid]);
                    }
                }

                // Also sync lead table if applicable
                if ($lid > 0) {
                    if (!array_key_exists($restoreUserId, $userToConsCache)) {
                        $stConsId->execute([$restoreUserId]);
                        $userToConsCache[$restoreUserId] = (int)$stConsId->fetchColumn();
                    }
                    $consId = $userToConsCache[$restoreUserId];
                    if ($consId > 0) {
                        $stUpLead->execute([$consId, $lid]);
                    }

                    $stLog->execute([$lid, $consId > 0 ? $consId : $restoreUserId, 'Admin khôi phục (Back lại) khách hàng đã thu hồi cho Sale chăm sóc tiếp']);
                }

                $custName = trim(($c['last_name'] ?? '') . ' ' . ($c['first_name'] ?? ''));
                $notifTitle = "Khách hàng thu hồi đã được khôi phục";
                $notifBody = "Quản trị viên đã khôi phục (Back lại) khách hàng {$custName} ({$c['phone']}) về danh sách chăm sóc của bạn.";
                $stNotif->execute([$restoreUserId, $tid, $notifTitle, $notifBody, '/contacts?id=' . $cid]);

                $restoredCount++;
                $restoredDetails[] = [
                    'contact_id' => $cid,
                    'person_id' => $pid,
                    'owner_id' => $restoreUserId,
                    'security_expires_at' => $freshExpires
                ];
            }

            $this->db->commit();
        } catch (\Throwable $e) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            respond(500, null, 'Lỗi khôi phục khách hàng thu hồi: ' . $e->getMessage(), false);
        }

        if ($restoredCount === 0) {
            respond(422, null, 'Không xác định được Sale phụ trách cũ để khôi phục. Vui lòng chọn cụ thể Sale cần nhận lại!', false);
        }

        logActivity($this->db, $tid, $adminUserId, 'BULK_RESTORE_RECLAIMED', 'contact', $restoredDetails[0]['contact_id'] ?? 0, json_encode([
            'restored_count' => $restoredCount,
            'target_owner_id' => $targetOwnerId,
            'details' => $restoredDetails
        ]));

        respond(200, [
            'restored_count' => $restoredCount,
            'items' => $restoredDetails
        ], "Đã khôi phục (Back lại) thành công {$restoredCount} khách hàng về cho Sale!");
    }
}




