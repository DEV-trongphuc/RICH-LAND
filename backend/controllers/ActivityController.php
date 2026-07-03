<?php
class ActivityController {
    private PDO $db;
    public function __construct(PDO $db) { $this->db = $db; }

    public function index(array $auth): void {
        $tid = $auth['tenant_id'];
        $page = max(1,(int)($_GET['page']??1));
        $limit = min(100,max(10,(int)($_GET['limit']??20)));
        $offset = ($page-1)*$limit;
        $type = $_GET['type']??''; $status = $_GET['status']??''; $uid = $_GET['user_id']??'';
        $relType = $_GET['related_type']??''; $relId = $_GET['related_id']??'';
        $search = $_GET['search'] ?? '';
        $start = $_GET['start_date'] ?? '';
        $end   = $_GET['end_date'] ?? '';
        
        $sortBy = $_GET['sort']  ?? 'due_date';
        $order  = $_GET['order'] ?? 'ASC';

        // Validating sort fields to prevent SQL Injection
        $allowedSort = ['due_date', 'created_at', 'updated_at', 'status', 'priority', 'type'];
        if (!in_array($sortBy, $allowedSort)) $sortBy = 'due_date';
        if (!in_array(strtoupper($order), ['ASC', 'DESC'])) $order = 'ASC';

        $where=['a.tenant_id=?', 'a.deleted_at IS NULL']; $params=[$tid];

        if ($search) {
            $where[] = '(a.subject LIKE ? OR a.description LIKE ?)';
            $params[] = "%$search%";
            $params[] = "%$search%";
        }

        if ($start) { $where[] = 'a.due_date >= ?'; $params[] = $start; }
        if ($end)   { $where[] = 'a.due_date <= ?'; $params[] = $end; }

        // Validating sort fields
        $allowedSort = ['created_at', 'due_date', 'priority', 'status'];
        if (!in_array($sortBy, $allowedSort)) $sortBy = 'due_date';
        if (!in_array(strtoupper($order), ['ASC', 'DESC'])) $order = 'ASC';

        if (in_array($auth['role'], ['sales', 'sale'], true) && !$relType && !$relId) {
            $where[] = 'a.user_id = ?';
            $params[] = $auth['user_id'];
        }
        if ($type)     { $where[]='a.type=?';    $params[]=$type; }
        if ($status)   { $where[]='a.status=?';  $params[]=$status; }
        if ($uid)      { $where[]='a.user_id=?'; $params[]=(int)$uid; }
        if ($relType)  { $where[]='a.related_type=?'; $params[]=$relType; }
        if ($relId)    { $where[]='a.related_id=?';   $params[]=(int)$relId; }
        $w=implode(' AND ',$where);

        $cnt=$this->db->prepare("SELECT COUNT(*) FROM activities a WHERE $w");
        $cnt->execute($params); $total=(int)$cnt->fetchColumn();

        $stmt=$this->db->prepare("
            SELECT a.*, u.full_name as user_name, u.avatar_url,
                   CONCAT(ct.first_name,' ',ct.last_name) as contact_name,
                   d.title as deal_name,
                   c.name as company_name,
                   (SELECT COUNT(*) FROM activity_comments ac WHERE ac.activity_id = a.id) as comment_count,
                   (SELECT e.image_url FROM expenses e WHERE e.tenant_id = a.tenant_id AND e.title = REPLACE(a.subject, 'Ghi nhận Chi phí: ', '') AND e.image_url IS NOT NULL AND e.image_url != '' ORDER BY e.id DESC LIMIT 1) as expense_image_url
            FROM activities a 
            LEFT JOIN users u ON a.user_id=u.id
            LEFT JOIN contacts ct ON a.related_type='contact' AND a.related_id=ct.id AND ct.deleted_at IS NULL
            LEFT JOIN deals d ON a.related_type='deal' AND a.related_id=d.id AND d.deleted_at IS NULL
            LEFT JOIN companies c ON a.related_type='company' AND a.related_id=c.id AND c.deleted_at IS NULL
            WHERE $w ORDER BY a.$sortBy $order
            LIMIT $limit OFFSET $offset
        ");
        $stmt->execute($params);
        respond(200,['items'=>$stmt->fetchAll(),'total'=>$total,'page'=>$page,'limit'=>$limit]);
    }

    public function store(array $auth): void {
        if ($auth['role'] === 'viewer') respond(403, null, 'Bạn không có quyền thêm mới', false);
        $b=getBody();
        if (empty($b['subject'])||empty($b['type'])) respond(422,null,'Tiêu đề và loại là bắt buộc',false);
        
        // Verify related entity if provided
        $allowedRelTypes = ['contact', 'company', 'deal'];
        if (!empty($b['related_type']) && !empty($b['related_id'])) {
            if (in_array($b['related_type'], $allowedRelTypes)) {
                $table = $b['related_type'] === 'contact' ? 'contacts' : ($b['related_type'] === 'company' ? 'companies' : 'deals');
                $check = $this->db->prepare("SELECT id FROM $table WHERE id=? AND tenant_id=?");
                $check->execute([(int)$b['related_id'], $auth['tenant_id']]);
                if (!$check->fetch()) {
                    $b['related_type'] = null; $b['related_id'] = null; // Reset if unauthorized
                }
            } else {
                $b['related_type'] = null; $b['related_id'] = null; // Reset if type not allowed
            }
        }

        $targetUserId = $b['user_id'] ?? $auth['user_id'];
        if ($auth['role'] === 'sales' && (int)$targetUserId !== (int)$auth['user_id']) {
            $targetUserId = $auth['user_id']; // Force self for sales role
        }
        
        $due_date = empty($b['due_date']) ? null : $b['due_date'];
        $status = $b['status'] ?? 'planned';
        $done_at = null;
        if ($status === 'done') {
            $done_at = empty($b['done_at']) ? date('Y-m-d H:i:s') : $b['done_at'];
        }

        $this->db->prepare("
            INSERT INTO activities (tenant_id,user_id,type,subject,body,status,priority,due_date,done_at,related_type,related_id)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)
        ")->execute([
            $auth['tenant_id'], $targetUserId, $b['type'],
            $b['subject'], $b['body']??null, $status, $b['priority']??'medium',
            $due_date, $done_at, $b['related_type']??null, $b['related_id']??null,
        ]);
        $actId = (int)$this->db->lastInsertId();

        // If status is done, update contact's last_contact
        if ($status === 'done' && !empty($b['related_id'])) {
            if (($b['related_type'] ?? '') === 'contact') {
                $this->db->prepare("UPDATE contacts SET last_contact = CURRENT_DATE WHERE id = ? AND tenant_id = ?")
                     ->execute([(int)$b['related_id'], $auth['tenant_id']]);
            } else if (($b['related_type'] ?? '') === 'deal') {
                $sDeal = $this->db->prepare("SELECT contact_id FROM deals WHERE id = ? AND tenant_id = ?");
                $sDeal->execute([(int)$b['related_id'], $auth['tenant_id']]);
                $cid = $sDeal->fetchColumn();
                if ($cid) {
                    $this->db->prepare("UPDATE contacts SET last_contact = CURRENT_DATE WHERE id = ? AND tenant_id = ?")
                         ->execute([(int)$cid, $auth['tenant_id']]);
                }
            }
        }

        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'CREATE', 'activity', $actId, json_encode(['subject' => $b['subject'], 'type' => $b['type']]));

        $this->show($auth,$actId);
    }

    public function show(array $auth,int $id): void {
        $stmt=$this->db->prepare("SELECT a.*,u.full_name as user_name FROM activities a LEFT JOIN users u ON a.user_id=u.id WHERE a.id=? AND a.tenant_id=? AND a.deleted_at IS NULL");
        $stmt->execute([$id, $auth['tenant_id']]);
        $row=$stmt->fetch(); if(!$row) respond(404,null,'Không tìm thấy',false);

        // Access check for sales role
        if ($auth['role'] === 'sales') {
            $allowed = false;
            if ((int)$row['user_id'] === (int)$auth['user_id']) {
                $allowed = true;
            } elseif ($row['related_type'] && $row['related_id']) {
                $table = $row['related_type'] === 'contact' ? 'contacts' : ($row['related_type'] === 'company' ? 'companies' : 'deals');
                $checkOwner = $this->db->prepare("SELECT id FROM $table WHERE id=? AND tenant_id=? AND owner_id=?");
                $checkOwner->execute([(int)$row['related_id'], $auth['tenant_id'], $auth['user_id']]);
                if ($checkOwner->fetch()) {
                    $allowed = true;
                }
            }
            if (!$allowed) respond(403, null, 'Bạn không có quyền truy cập hoạt động này', false);
        }

        respond(200,$row);
    }

    public function update(array $auth,int $id): void {
        if ($auth['role'] === 'viewer') respond(403, null, 'Bạn không có quyền cập nhật', false);
        $b=getBody();
        
        // Auto set done_at if status changes to done, or clear it if changed to something else
        if (isset($b['status'])) {
            if ($b['status'] === 'done' && empty($b['done_at'])) {
                $b['done_at'] = date('Y-m-d H:i:s');
            } elseif ($b['status'] !== 'done') {
                $b['done_at'] = null;
            }
        }

        // Verify related entity if changed
        $allowedRelTypes = ['contact', 'company', 'deal'];
        if (!empty($b['related_type']) && !empty($b['related_id'])) {
            if (in_array($b['related_type'], $allowedRelTypes)) {
                $table = $b['related_type'] === 'contact' ? 'contacts' : ($b['related_type'] === 'company' ? 'companies' : 'deals');
                $check = $this->db->prepare("SELECT id FROM $table WHERE id=? AND tenant_id=?");
                $check->execute([(int)$b['related_id'], $auth['tenant_id']]);
                if (!$check->fetch()) {
                    $b['related_type'] = null; $b['related_id'] = null;
                }
            } else {
                $b['related_type'] = null; $b['related_id'] = null;
            }
        }

        $fields=['user_id','type','subject','body','status','priority','due_date','done_at','related_type','related_id'];
        $sets=[];$params=[];
        foreach($fields as $f){
            if(array_key_exists($f,$b)){
                $sets[]="$f=?";
                if (in_array($f, ['due_date', 'done_at']) && $b[$f] === '') {
                    $params[] = null;
                } else {
                    $params[]=$b[$f];
                }
            }
        }
        if(!$sets) respond(422,null,'Không có dữ liệu',false);

        // Check permission first
        $check = $this->db->prepare("SELECT id, user_id, related_type, related_id FROM activities WHERE id=? AND tenant_id=? AND deleted_at IS NULL");
        $check->execute([$id, $auth['tenant_id']]);
        $activity = $check->fetch();
        if (!$activity) respond(404, null, 'Không tìm thấy hoặc không có quyền', false);

        if ($auth['role'] === 'sales') {
            $allowed = false;
            if ((int)$activity['user_id'] === (int)$auth['user_id']) {
                $allowed = true;
            } elseif ($activity['related_type'] && $activity['related_id']) {
                $table = $activity['related_type'] === 'contact' ? 'contacts' : ($activity['related_type'] === 'company' ? 'companies' : 'deals');
                $checkOwner = $this->db->prepare("SELECT id FROM $table WHERE id=? AND tenant_id=? AND owner_id=?");
                $checkOwner->execute([(int)$activity['related_id'], $auth['tenant_id'], $auth['user_id']]);
                if ($checkOwner->fetch()) {
                    $allowed = true;
                }
            }
            if (!$allowed) respond(403, null, 'Bạn không có quyền cập nhật hoạt động này', false);
        }

        $params[]=$id;$params[]=$auth['tenant_id'];
        $stmt = $this->db->prepare("UPDATE activities SET ".implode(',',$sets)." WHERE id=? AND tenant_id=?");
        $stmt->execute($params);

        // If status changed to done, update contact's last_contact
        if (isset($b['status']) && $b['status'] === 'done') {
            $checkRel = $this->db->prepare("SELECT related_type, related_id FROM activities WHERE id=?");
            $checkRel->execute([$id]);
            $rel = $checkRel->fetch();
            if ($rel && !empty($rel['related_id'])) {
                if ($rel['related_type'] === 'contact') {
                    $this->db->prepare("UPDATE contacts SET last_contact = CURRENT_DATE WHERE id = ? AND tenant_id = ?")
                         ->execute([(int)$rel['related_id'], $auth['tenant_id']]);
                } else if ($rel['related_type'] === 'deal') {
                    $sDeal = $this->db->prepare("SELECT contact_id FROM deals WHERE id = ? AND tenant_id = ?");
                    $sDeal->execute([(int)$rel['related_id'], $auth['tenant_id']]);
                    $cid = $sDeal->fetchColumn();
                    if ($cid) {
                        $this->db->prepare("UPDATE contacts SET last_contact = CURRENT_DATE WHERE id = ? AND tenant_id = ?")
                             ->execute([(int)$cid, $auth['tenant_id']]);
                    }
                }
            }
        }

        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'UPDATE', 'activity', $id, json_encode($b));

        $this->show($auth,$id);
    }

    public function getComments(array $auth, int $id): void {
        // Verify activity belongs to tenant and user has permission
        $check = $this->db->prepare("SELECT id, user_id, related_type, related_id FROM activities WHERE id=? AND tenant_id=? AND deleted_at IS NULL");
        $check->execute([$id, $auth['tenant_id']]);
        $activity = $check->fetch();
        if (!$activity) respond(404, null, 'Không tìm thấy hoạt động hoặc không có quyền truy cập', false);

        if ($auth['role'] === 'sales') {
            $allowed = false;
            if ((int)$activity['user_id'] === (int)$auth['user_id']) {
                $allowed = true;
            } elseif ($activity['related_type'] && $activity['related_id']) {
                $table = $activity['related_type'] === 'contact' ? 'contacts' : ($activity['related_type'] === 'company' ? 'companies' : 'deals');
                $checkOwner = $this->db->prepare("SELECT id FROM $table WHERE id=? AND tenant_id=? AND owner_id=?");
                $checkOwner->execute([(int)$activity['related_id'], $auth['tenant_id'], $auth['user_id']]);
                if ($checkOwner->fetch()) {
                    $allowed = true;
                }
            }
            if (!$allowed) respond(403, null, 'Bạn không có quyền truy cập hoạt động này', false);
        }

        $stmt = $this->db->prepare("
            SELECT c.*, u.full_name as user_name, u.avatar_url 
            FROM activity_comments c 
            LEFT JOIN users u ON c.user_id = u.id 
            WHERE c.activity_id = ? AND c.tenant_id = ? 
            ORDER BY c.created_at ASC
        ");
        $stmt->execute([$id, $auth['tenant_id']]);
        
        $comments = array_map(function($row) {
            $row['attachments'] = $row['attachments'] ? json_decode($row['attachments'], true) : [];
            return $row;
        }, $stmt->fetchAll(PDO::FETCH_ASSOC));

        respond(200, $comments);
    }

    public function addComment(array $auth, int $id): void {
        if ($auth['role'] === 'viewer') respond(403, null, 'Bạn không có quyền bình luận', false);
        // Verify activity belongs to tenant and user has permission
        $check = $this->db->prepare("SELECT id, user_id, related_type, related_id FROM activities WHERE id=? AND tenant_id=? AND deleted_at IS NULL");
        $check->execute([$id, $auth['tenant_id']]);
        $activity = $check->fetch();
        if (!$activity) respond(404, null, 'Không tìm thấy hoạt động hoặc không có quyền truy cập', false);

        if ($auth['role'] === 'sales') {
            $allowed = false;
            if ((int)$activity['user_id'] === (int)$auth['user_id']) {
                $allowed = true;
            } elseif ($activity['related_type'] && $activity['related_id']) {
                $table = $activity['related_type'] === 'contact' ? 'contacts' : ($activity['related_type'] === 'company' ? 'companies' : 'deals');
                $checkOwner = $this->db->prepare("SELECT id FROM $table WHERE id=? AND tenant_id=? AND owner_id=?");
                $checkOwner->execute([(int)$activity['related_id'], $auth['tenant_id'], $auth['user_id']]);
                if ($checkOwner->fetch()) {
                    $allowed = true;
                }
            }
            if (!$allowed) respond(403, null, 'Bạn không có quyền bình luận cho hoạt động này', false);
        }

        $b = getBody();
        if (empty($b['content']) && empty($b['attachments'])) {
            respond(422, null, 'Nội dung hoặc đính kèm không được để trống', false);
        }

        $attachments = !empty($b['attachments']) && is_array($b['attachments']) ? json_encode($b['attachments']) : null;

        $stmt = $this->db->prepare("
            INSERT INTO activity_comments (tenant_id, activity_id, user_id, content, attachments)
            VALUES (?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $auth['tenant_id'],
            $id,
            $auth['user_id'],
            $b['content'] ?? null,
            $attachments
        ]);

        $commentId = $this->db->lastInsertId();
        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'ADD_COMMENT', 'activity', $id);

        respond(200, ['id' => $commentId], 'Đã thêm bình luận');
    }

    public function destroy(array $auth, int $id): void {
        if ($auth['role'] === 'viewer') respond(403, null, 'Bạn không có quyền xóa hoạt động', false);
        $sql = "UPDATE activities SET deleted_at = NOW() WHERE id=? AND tenant_id=?";
        $p = [$id, $auth['tenant_id']];
        if ($auth['role'] === 'sales') {
            $sql .= " AND user_id=?";
            $p[] = $auth['user_id'];
        }
        $stmt=$this->db->prepare($sql);
        $stmt->execute($p);
        if(!$stmt->rowCount()) respond(404,null,'Không tìm thấy hoặc không có quyền',false);
        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'DELETE', 'activity', $id);
        respond(200,null,'Đã xóa hoạt động');
    }

    public function deleteComment(array $auth, int $commentId): void {
        if ($auth['role'] === 'viewer') respond(403, null, 'Bạn không có quyền xóa bình luận', false);

        // Fetch comment to check ownership and tenant isolation
        $stmt = $this->db->prepare("SELECT * FROM activity_comments WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$commentId, $auth['tenant_id']]);
        $comment = $stmt->fetch();

        if (!$comment) {
            respond(404, null, 'Không tìm thấy bình luận', false);
        }

        // Access check: Admin/Manager can delete any comment. Sales can only delete their own.
        if (in_array($auth['role'], ['sales', 'sale'], true) && (int)$comment['user_id'] !== (int)$auth['user_id']) {
            respond(403, null, 'Bạn không có quyền xóa bình luận của người khác', false);
        }

        // Delete physical attachments from disk if they exist
        if (!empty($comment['attachments'])) {
            $files = json_decode($comment['attachments'], true);
            if (is_array($files)) {
                $uploadDirBase = defined('UPLOAD_DIR') ? UPLOAD_DIR : (__DIR__ . '/../uploads');
                foreach ($files as $fileUrl) {
                    $filename = basename($fileUrl);
                    $filePath = $uploadDirBase . "/tenant_" . $auth['tenant_id'] . "/" . $filename;
                    if (file_exists($filePath) && is_file($filePath)) {
                        @unlink($filePath);
                    }
                }
            }
        }

        // Delete DB record
        $deleteStmt = $this->db->prepare("DELETE FROM activity_comments WHERE id = ? AND tenant_id = ?");
        $deleteStmt->execute([$commentId, $auth['tenant_id']]);

        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'DELETE_COMMENT', 'activity_comment', $commentId);
        respond(200, null, 'Đã xóa bình luận thành công');
    }
}
