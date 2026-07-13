<?php
// SearchController — Global search across contacts, companies, deals, notes
class SearchController {
    private PDO $db;
    public function __construct(PDO $db) { $this->db = $db; }    
    public function global(array $auth): void {
        $q   = trim($_GET['q'] ?? '');
        if (strlen($q) < 2) respond(200, ['results' => []]);

        $role = $auth['role'] ?? '';
        $uid = (int)($auth['user_id'] ?? 0);
        $tid = (int)($auth['tenant_id'] ?? 0);
        
        $isSale = $role === 'sales' || $role === 'sale';
        $isManager = $role === 'manager';

        $like = "%{$q}%";
        $results = [];

        // Contacts
        $sqlC = "SELECT id, CONCAT(first_name,' ',last_name) as label, email as sublabel, 'contact' as type, status FROM contacts WHERE tenant_id=? AND deleted_at IS NULL AND (CONCAT(first_name,' ',last_name) LIKE ? OR email LIKE ? OR phone LIKE ?)";
        $pC = [$tid, $like, $like, $like];
        if ($isSale) { 
            $sqlC .= " AND (owner_id=? OR id IN (
                SELECT contact_id FROM cooperation_slips 
                WHERE JSON_CONTAINS(JSON_KEYS(CASE WHEN (shares_json IS NOT NULL AND JSON_VALID(shares_json)) THEN shares_json ELSE '{}' END), JSON_QUOTE(CAST(? AS CHAR)))
            ))"; 
            $pC[] = $uid; 
            $pC[] = $uid; 
        } else if ($isManager) {
            $sqlC .= " AND (owner_id = ? OR owner_id IN (SELECT id FROM users WHERE team_id IN (SELECT id FROM teams WHERE leader_id = ?)))";
            $pC[] = $uid;
            $pC[] = $uid;
        }
        $s = $this->db->prepare($sqlC . " LIMIT 10");
        $s->execute($pC);
        foreach ($s->fetchAll() as $r) $results[] = $r;

        // Companies
        $sqlComp = "SELECT id, name as label, city as sublabel, 'company' as type, status FROM companies WHERE tenant_id=? AND deleted_at IS NULL AND (name LIKE ? OR email LIKE ?)";
        $pComp = [$tid, $like, $like];
        if ($isSale) { 
            $sqlComp .= " AND owner_id=?"; 
            $pComp[] = $uid; 
        }
        $s = $this->db->prepare($sqlComp . " LIMIT 10");
        $s->execute($pComp);
        foreach ($s->fetchAll() as $r) $results[] = $r;

        // Notes (filtered by entity access)
        $sqlN = "SELECT n.id, SUBSTRING(n.body,1,80) as label, n.entity_type as sublabel, 'note' as type, 'note' as status 
                 FROM notes n 
                 WHERE n.tenant_id=? AND n.body LIKE ?";
        $pN = [$tid, $like];
        if ($isSale) {
            $sqlN .= " AND (n.user_id=? OR EXISTS (
                SELECT 1 FROM contacts c WHERE c.id=n.entity_id AND n.entity_type='contact' AND (c.owner_id=? OR c.id IN (
                    SELECT contact_id FROM cooperation_slips 
                    WHERE JSON_CONTAINS(JSON_KEYS(CASE WHEN (shares_json IS NOT NULL AND JSON_VALID(shares_json)) THEN shares_json ELSE '{}' END), JSON_QUOTE(CAST(? AS CHAR)))
                ))
                UNION ALL
                SELECT 1 FROM companies co WHERE co.id=n.entity_id AND n.entity_type='company' AND co.owner_id=?
                UNION ALL
                SELECT 1 FROM deals d WHERE d.id=n.entity_id AND n.entity_type='deal' AND (d.owner_id=? OR d.contact_id IN (
                    SELECT contact_id FROM cooperation_slips 
                    WHERE JSON_CONTAINS(JSON_KEYS(CASE WHEN (shares_json IS NOT NULL AND JSON_VALID(shares_json)) THEN shares_json ELSE '{}' END), JSON_QUOTE(CAST(? AS CHAR)))
                ))
            ))";
            $pN[] = $uid;
            $pN[] = $uid;
            $pN[] = $uid;
            $pN[] = $uid;
            $pN[] = $uid;
            $pN[] = $uid;
        } else if ($isManager) {
            $sqlN .= " AND (n.user_id=? OR EXISTS (
                SELECT 1 FROM contacts c WHERE c.id=n.entity_id AND n.entity_type='contact' AND (c.owner_id=? OR c.owner_id IN (SELECT id FROM users WHERE team_id IN (SELECT id FROM teams WHERE leader_id = ?)))
                UNION ALL
                SELECT 1 FROM companies co WHERE co.id=n.entity_id AND n.entity_type='company'
                UNION ALL
                SELECT 1 FROM deals d WHERE d.id=n.entity_id AND n.entity_type='deal' AND (d.owner_id=? OR d.owner_id IN (SELECT id FROM users WHERE team_id IN (SELECT id FROM teams WHERE leader_id = ?)))
            ))";
            $pN[] = $uid;
            $pN[] = $uid;
            $pN[] = $uid;
            $pN[] = $uid;
            $pN[] = $uid;
        }
        $s = $this->db->prepare($sqlN . " LIMIT 5");
        $s->execute($pN);
        foreach ($s->fetchAll() as $r) $results[] = $r;

        respond(200, ['results' => $results, 'query' => $q]);
    }

    public function smartFilter(array $auth): void {
        $q  = strtolower(trim($_GET['q'] ?? ''));
        $tid = $auth['tenant_id'];

        $role = $auth['role'] ?? '';
        $uid = (int)($auth['user_id'] ?? 0);
        
        $isSale = $role === 'sales' || $role === 'sale';
        $isManager = $role === 'manager';

        // Parse smart queries
        $results = ['type' => 'contacts', 'items' => []];

        if (str_contains($q, 'chưa gọi')) {
            // Contacts with no call activity in N days
            preg_match('/(\d+)\s*ngày/', $q, $m);
            $days = isset($m[1]) ? (int)$m[1] : 3;
            
            $saleFilter = "";
            $params = [$tid, $tid, $days];
            if ($isSale) {
                $saleFilter = " AND (c.owner_id = ? OR c.id IN (
                    SELECT contact_id FROM cooperation_slips 
                    WHERE JSON_CONTAINS(JSON_KEYS(CASE WHEN (shares_json IS NOT NULL AND JSON_VALID(shares_json)) THEN shares_json ELSE '{}' END), JSON_QUOTE(CAST(? AS CHAR)))
                ))";
                $params[] = $uid;
                $params[] = $uid;
            } else if ($isManager) {
                $saleFilter = " AND (c.owner_id = ? OR c.owner_id IN (SELECT id FROM users WHERE team_id IN (SELECT id FROM teams WHERE leader_id = ?)))";
                $params[] = $uid;
                $params[] = $uid;
            }

            $s = $this->db->prepare("
                SELECT c.id, CONCAT(c.first_name,' ',c.last_name) as name, c.phone, c.status
                FROM contacts c
                WHERE c.tenant_id=? AND c.deleted_at IS NULL AND c.id NOT IN (
                    SELECT related_id FROM activities
                    WHERE tenant_id=? AND type='call' AND related_type='contact'
                    AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
                ) $saleFilter
                ORDER BY c.updated_at ASC LIMIT 20
            ");
            $s->execute($params);
            $results['items'] = $s->fetchAll();
            $results['description'] = "Khách chưa được gọi trong {$days} ngày qua";
        }
        elseif (str_contains($q, 'tiềm năng') || (str_contains($q, 'doanh thu') && str_contains($q, 'tr'))) {
            // High revenue potential contacts
            preg_match('/([\d.]+)\s*tr/', $q, $m);
            $val = isset($m[1]) ? (float)$m[1] * 1000000 : 50000000;

            $saleFilter = "";
            $params = [$tid, $val];
            if ($isSale) {
                $saleFilter = " AND (c.owner_id = ? OR c.id IN (
                    SELECT contact_id FROM cooperation_slips 
                    WHERE JSON_CONTAINS(JSON_KEYS(CASE WHEN (shares_json IS NOT NULL AND JSON_VALID(shares_json)) THEN shares_json ELSE '{}' END), JSON_QUOTE(CAST(? AS CHAR)))
                ))";
                $params[] = $uid;
                $params[] = $uid;
            } else if ($isManager) {
                $saleFilter = " AND (c.owner_id = ? OR c.owner_id IN (SELECT id FROM users WHERE team_id IN (SELECT id FROM teams WHERE leader_id = ?)))";
                $params[] = $uid;
                $params[] = $uid;
            }

            $s = $this->db->prepare("
                SELECT c.id, CONCAT(c.first_name,' ',c.last_name) as name, c.expected_revenue, ps.name as stage
                FROM contacts c LEFT JOIN pipeline_stages ps ON c.stage_id=ps.id
                WHERE c.tenant_id=? AND c.deleted_at IS NULL AND c.expected_revenue >= ? $saleFilter
                ORDER BY c.expected_revenue DESC LIMIT 20
            ");
            $s->execute($params);
            $results['type'] = 'contacts';
            $results['items'] = $s->fetchAll();
            $results['description'] = "Khách hàng có doanh thu dự kiến trên " . number_format($val/1e6, 0) . "tr";
        }
        else {
            // Fall back to global search
            $this->global($auth);
            return;
        }

        respond(200, $results);
    }
}
