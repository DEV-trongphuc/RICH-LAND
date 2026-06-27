<?php
// SearchController — Global search across contacts, companies, deals, notes
class SearchController {
    private PDO $db;
    public function __construct(PDO $db) { $this->db = $db; }    public function global(array $auth): void {
        $q   = trim($_GET['q'] ?? '');
        if (strlen($q) < 2) respond(200, ['results' => []]);

        $tid  = $auth['tenant_id'];
        $like = "%{$q}%";
        $results = [];

        // Contacts
        $sqlC = "SELECT id, CONCAT(first_name,' ',last_name) as label, email as sublabel, 'contact' as type, status FROM contacts WHERE tenant_id=? AND deleted_at IS NULL AND (CONCAT(first_name,' ',last_name) LIKE ? OR email LIKE ? OR phone LIKE ?)";
        $pC = [$tid, $like, $like, $like];
        if ($auth['role'] === 'sales') { $sqlC .= " AND owner_id=?"; $pC[] = $auth['user_id']; }
        $s = $this->db->prepare($sqlC . " LIMIT 10");
        $s->execute($pC);
        foreach ($s->fetchAll() as $r) $results[] = $r;

        // Companies
        $sqlComp = "SELECT id, name as label, city as sublabel, 'company' as type, status FROM companies WHERE tenant_id=? AND deleted_at IS NULL AND (name LIKE ? OR email LIKE ?)";
        $pComp = [$tid, $like, $like];
        if ($auth['role'] === 'sales') { $sqlComp .= " AND owner_id=?"; $pComp[] = $auth['user_id']; }
        $s = $this->db->prepare($sqlComp . " LIMIT 10");
        $s->execute($pComp);
        foreach ($s->fetchAll() as $r) $results[] = $r;

        // Notes (filtered by entity access for sales)
        $sqlN = "SELECT n.id, SUBSTRING(n.body,1,80) as label, n.entity_type as sublabel, 'note' as type, 'note' as status 
                 FROM notes n 
                 WHERE n.tenant_id=? AND n.body LIKE ?";
        $pN = [$tid, $like];
        if ($auth['role'] === 'sales') {
            // Only search notes on entities owned by the salesperson OR created by them
            $sqlN .= " AND (n.user_id=? OR EXISTS (
                SELECT 1 FROM contacts c WHERE c.id=n.entity_id AND n.entity_type='contact' AND c.owner_id=?
                UNION ALL
                SELECT 1 FROM companies co WHERE co.id=n.entity_id AND n.entity_type='company' AND co.owner_id=?
                UNION ALL
                SELECT 1 FROM deals d WHERE d.id=n.entity_id AND n.entity_type='deal' AND d.owner_id=?
            ))";
            $pN[] = $auth['user_id'];
            $pN[] = $auth['user_id'];
            $pN[] = $auth['user_id'];
            $pN[] = $auth['user_id'];
        }
        $s = $this->db->prepare($sqlN . " LIMIT 5");
        $s->execute($pN);
        foreach ($s->fetchAll() as $r) $results[] = $r;

        respond(200, ['results' => $results, 'query' => $q]);
    }

    public function smartFilter(array $auth): void {
        $q  = strtolower(trim($_GET['q'] ?? ''));
        $tid = $auth['tenant_id'];

        // Parse smart queries
        $results = ['type' => 'contacts', 'items' => []];

        if (str_contains($q, 'chưa gọi')) {
            // Contacts with no call activity in N days
            preg_match('/(\d+)\s*ngày/', $q, $m);
            $days = isset($m[1]) ? (int)$m[1] : 3;
            
            $saleFilter = "";
            $params = [$tid, $tid, $days];
            if ($auth['role'] === 'sales') {
                $saleFilter = " AND c.owner_id = ?";
                $params[] = $auth['user_id'];
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
            if ($auth['role'] === 'sales') {
                $saleFilter = " AND c.owner_id = ?";
                $params[] = $auth['user_id'];
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
