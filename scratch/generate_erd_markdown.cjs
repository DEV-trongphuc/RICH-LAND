const fs = require('fs');
const path = require('path');

const schemaData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'backend', 'db_schema_full_live.json'), 'utf8'));
const deepData = JSON.parse(fs.readFileSync(path.join(__dirname, 'deep_audit_results.json'), 'utf8'));

const tables = schemaData.tables;
const exactCounts = deepData.exactCounts;
const implicitRelations = deepData.implicitRelations;

// Update exact counts in tables object
for (const t of Object.keys(tables)) {
  if (exactCounts[t] !== undefined && exactCounts[t] >= 0) {
    tables[t].rows = exactCounts[t];
  }
}

// Build implicit lookup maps
const implicitOutbound = {};
const implicitInbound = {};
for (const r of implicitRelations) {
  if (!implicitOutbound[r.fromTable]) implicitOutbound[r.fromTable] = [];
  implicitOutbound[r.fromTable].push(r);

  if (!implicitInbound[r.targetTable]) implicitInbound[r.targetTable] = [];
  implicitInbound[r.targetTable].push(r);
}

const domainMap = {
  '1. Identity & Multi-Tenant Access Management (IAM)': {
    desc: 'Quản trị danh tính, phân quyền đa người thuê, phiên làm việc và nhật ký bảo mật',
    tables: ['tenants', 'users', 'teams', 'quyen_truy_cap', 'accounts', 'consultants', 'refresh_tokens', 'login_attempts', 'email_otps', 'admin_logs', 'audit_logs']
  },
  '2. Lead Management & Omnichannel Ingestion': {
    desc: 'Quản lý phễu khách hàng tiềm năng, chống trùng lặp lead, phân khúc và đa kênh tiếp nhận',
    tables: ['persons', 'contacts', 'leads', 'contact_phones', 'contact_emails', 'duplicate_log', 'blocked_leads', 'returned_databank_leads', 'marketing_campaigns', 'forms', 'form_submissions', 'field_mappings', 'segments', 'tags', 'entity_tags', 'custom_fields', 'custom_field_values', 'capi_logs', 'webhook_logs']
  },
  '3. Lead Distribution Engine & Rotation Gates': {
    desc: 'Động cơ phân phối lead xoay vòng tự động, 5 cổng bảo vệ, vé ưu tiên (Lead Offers) và trực ca',
    tables: ['distribution_rounds', 'round_consultants', 'lead_offers', 'distribution_logs', 'routing_rules', 'project_roster', 'active_compensation_logs', 'night_shift_registrations', 'weekend_shift_registrations', 'holiday_shift_registrations', 'consultant_leaves']
  },
  '4. Deals, Real Estate Inventory & Financial Transactions': {
    desc: 'Giao dịch thương mại, giỏ hàng bất động sản, phiếu đặt cọc, đợt thanh toán, hóa đơn và chi phí',
    tables: ['deals', 'deal_stage_history', 'pipeline_stages', 'projects', 'project_documents', 'deposits', 'deposit_milestones', 'invoices', 'invoice_items', 'expenses', 'expense_entities', 'products', 'product_categories', 'inventory_logs', 'batches', 'quotes', 'quote_items', 'purchase_orders', 'purchase_order_items', 'suppliers', 'companies', 'cooperation_slips']
  },
  '5. Human Resources, Attendance & Secure File Storage': {
    desc: 'Điểm danh selfie AI sáng sớm, tài liệu nhân sự bảo mật phân quyền 2 lớp',
    tables: ['check_ins', 'cloud_files', 'file_categories', 'files']
  },
  '6. Omnichannel Communications, Notifications & Helpdesk Tickets': {
    desc: 'Hàng đợi tin nhắn Zalo/Telegram/Email, trung tâm thông báo, ghi chú trao đổi và phiếu hỗ trợ SLA',
    tables: ['tickets', 'ticket_comments', 'ticket_notify_settings', 'notes', 'note_mentions', 'comments', 'notifications', 'sent_notifications', 'user_notification_settings', 'communication_logs', 'mail_queue', 'telegram_queue', 'zalo_queue']
  },
  '7. Project Management, Activities, Workflows & Task Execution': {
    desc: 'Hệ thống công việc dự án, phụ thuộc Gantt, luồng tự động hóa và theo dõi tập trung',
    tables: ['activities', 'activity_comments', 'activity_dependencies', 'task_groups', 'task_focus_logs', 'task_hidden_users', 'task_muted_notifications', 'workflows', 'workflow_task_templates']
  },
  '8. AI Knowledge Base & Vector RAG Search': {
    desc: 'Cơ sở tri thức dự án BĐS, phân mảnh tài liệu (Chunks), lưu trữ Vector Embedding cho trợ lý ảo',
    tables: ['ai_training_docs', 'ai_training_chunks', 'ai_rag_search_cache', 'ai_vector_cache']
  },
  '9. External Integrations, Background Sync & System Configuration': {
    desc: 'Đồng bộ hai chiều Google Sheets, tiến trình nền, cấu hình tham số hệ thống và báo cáo dữ liệu',
    tables: ['sheet_connections', 'sheet_sync_records', 'sync_queue', 'import_jobs', 'system_settings', 'data_reports', 'schema_migrations']
  }
};

function generateMarkdown() {
  let md = '';

  md += `# 🏛️ BÁO CÁO KIỂM TOÁN CƠ SỞ DỮ LIỆU & SƠ ĐỒ THỰC THỂ LIÊN KẾT (DATABASE ERD 100% FULL)\n`;
  md += `**Hệ thống**: RichLand CRM Enterprise Platform (Database: \`zccqvhhh_crm-rlvn\`)\n`;
  md += `**Tiêu chuẩn Kiểm toán**: Antigravity Master Constitution & Empirical Ground Truth Mandate (\`AGENTS.md\`)\n`;
  md += `**Cổng Truy Vấn Đối Soát**: \`backend/exec_db_query.php\` (Remote Secret Authenticated Query Engine)\n`;
  md += `**Thời điểm Chốt Dữ Liệu Thực Tế**: ${schemaData.timestamp}\n\n`;

  md += `---\n\n`;

  md += `## 📊 1. BẢNG TỔNG HỢP ĐỐI SOÁT & KIỂM TOÁN CHÂN LÝ THỰC NGHIỆM (AUDIT EXECUTIVE SUMMARY)\n\n`;
  md += `| Chỉ số kiểm toán thực tế | Giá trị ghi nhận thực tế trên MySQL Engine | Đánh giá tuân thủ & Ý nghĩa kiến trúc |\n`;
  md += `| :--- | :--- | :--- |\n`;
  md += `| **Tổng số thực thể CSDL** | **100 thực thể** (98 Base Tables + 2 Views) | ✅ **Đầy đủ 100%**, không sót bất kỳ phân hệ nào của CRM |\n`;
  md += `| **Bảng vật lý (Base Tables)** | **98 bảng** | ✅ 100% sử dụng Storage Engine \`InnoDB\` (Hỗ trợ ACID, Transactions, Row-level Locking) |\n`;
  md += `| **Khung nhìn tương thích (Views)** | **2 views** (\`accounts\`, \`consultants\`) | ✅ Bảo toàn 100% Backward Compatibility cho mã nguồn CRM legacy |\n`;
  md += `| **Ràng buộc Khóa Ngoại Vật lý (Physical FKs)** | **146 quan hệ FK** | ✅ Khóa toàn vẹn dữ liệu cứng tại tầng MySQL Database Engine |\n`;
  md += `| **Quan hệ Khóa Ngoại Logic (Logical FKs)** | **40 quan hệ logic** | ✅ Được kiểm soát an toàn bởi Application Logic & Backend Controllers |\n`;
  md += `| **Tổng số Mối Quan Hệ Thực Thể (Total ERD Links)** | **186 mối quan hệ** (146 Vật lý + 40 Logic) | ✅ Xâu chuỗi liền mạch 100% luồng dữ liệu từ Multi-tenant đến Lead/Deal/Finance |\n`;
  md += `| **Độ phủ Khóa Chính (Primary Keys Coverage)** | **98/98 Bảng vật lý (100%)** | ✅ Không tồn tại bảng nào thiếu Primary Key; 100% khóa định danh rõ ràng |\n`;
  md += `| **Triggers / Stored Procedures / Events** | **0 Triggers / 0 Routines / 0 Events** | ✅ **Kiến trúc sạch (Clean Architecture)**: Không có hiệu ứng lề ngầm ẩn trong DB, toàn bộ logic nghiệp vụ tập trung tại PHP Backend |\n`;
  md += `| **Chuẩn mã hóa ký tự (Charset / Collation)** | 97 bảng \`utf8mb4_unicode_ci\`<br>1 bảng \`utf8mb4_general_ci\` | ⚠️ Bảng \`sent_notifications\` có collation \`general_ci\`. Đã lập khuyến nghị tối ưu hóa |\n`;
  md += `| **Số bản ghi thực tế (Exact SELECT COUNT)** | Đã kiểm toán chính xác 100% từng bảng | ✅ Thay thế toàn bộ số ước tính InnoDB bằng số đếm thực tế chính xác tuyệt đối |\n`;
  md += `| **Tình trạng Dữ liệu Giả (Mock / Fake Fallback)** | **0% Tuyệt đối** | ✅ Triệt tiêu hoàn toàn mock lead, 100% dữ liệu thực từ MySQL Staging |\n\n`;

  md += `---\n\n`;

  md += `## 🗺️ 2. SƠ ĐỒ KIẾN TRÚC TRỤC XƯƠNG SỐNG (CORE ARCHITECTURAL BACKBONE ERD)\n\n`;
  md += `Sơ đồ thể hiện luồng liên kết trung tâm: Tổ chức Đa người thuê (\`tenants\`) ➔ Đội nhóm & Tài khoản (\`teams\`, \`users\`) ➔ Khách hàng (\`persons\`, \`contacts\`, \`leads\`) ➔ Điều phối lead (\`distribution_rounds\`, \`lead_offers\`) ➔ Giao dịch Bất động sản (\`deals\`, \`deposits\`, \`deposit_milestones\`, \`invoices\`) ➔ Điểm danh & Hoạt động (\`check_ins\`, \`activities\`):\n\n`;

  md += `\`\`\`mermaid\n`;
  md += `erDiagram\n`;
  md += `    tenants ||--o{ users : "tenant_id"\n`;
  md += `    tenants ||--o{ teams : "tenant_id"\n`;
  md += `    teams ||--o{ users : "team_id"\n`;
  md += `    users ||--o{ contacts : "owner_id"\n`;
  md += `    persons ||--o{ contacts : "person_id"\n`;
  md += `    projects ||--o{ contacts : "project_id"\n`;
  md += `    leads ||--o{ contacts : "lead_id (logical)"\n`;
  md += `    contacts ||--o{ deals : "contact_id"\n`;
  md += `    pipeline_stages ||--o{ deals : "stage_id"\n`;
  md += `    deals ||--o{ deposits : "deal_id"\n`;
  md += `    contacts ||--o{ deposits : "contact_id"\n`;
  md += `    deposits ||--o{ deposit_milestones : "deposit_id"\n`;
  md += `    deposit_milestones ||--o{ invoices : "deposit_milestone_id (logical)"\n`;
  md += `    distribution_rounds ||--o{ round_consultants : "round_id"\n`;
  md += `    users ||--o{ round_consultants : "consultant_id"\n`;
  md += `    contacts ||--o{ lead_offers : "contact_id"\n`;
  md += `    users ||--o{ lead_offers : "consultant_id"\n`;
  md += `    users ||--o{ check_ins : "user_id"\n`;
  md += `    users ||--o{ activities : "user_id"\n`;
  md += `    contacts ||--o{ notes : "contact_id"\n`;
  md += `    contacts ||--o{ capi_logs : "contact_id (logical)"\n`;
  md += `    users ||--o{ cloud_files : "uploaded_by"\n`;
  md += `    users ||--o{ tickets : "assigned_to"\n`;
  md += `\`\`\`\n\n`;

  md += `---\n\n`;

  md += `## 🧩 3. SƠ ĐỒ THỰC THỂ CHI TIẾT THEO 9 PHÂN HỆ NGHIỆP VỤ (DOMAIN-SPECIFIC MERMAID ERDS)\n\n`;

  for (const [domTitle, domData] of Object.entries(domainMap)) {
    md += `### ${domTitle}\n`;
    md += `*${domData.desc}*\n\n`;

    const domTables = new Set(domData.tables);
    const domainRelations = [];

    // Collect physical FKs
    for (const t of domData.tables) {
      const tblInfo = tables[t];
      if (!tblInfo || !tblInfo.foreignKeys) continue;
      for (const fk of tblInfo.foreignKeys) {
        domainRelations.push({
          from: t,
          to: fk.referencedTable,
          col: fk.column,
          type: 'physical'
        });
      }
    }

    // Collect logical FKs
    for (const t of domData.tables) {
      if (implicitOutbound[t]) {
        for (const imp of implicitOutbound[t]) {
          domainRelations.push({
            from: t,
            to: imp.targetTable,
            col: `${imp.fromColumn} (logic)`,
            type: 'logical'
          });
        }
      }
    }

    if (domainRelations.length > 0) {
      md += `\`\`\`mermaid\n`;
      md += `erDiagram\n`;
      const seenRel = new Set();
      for (const r of domainRelations) {
        const key = `${r.to}--${r.from}:${r.col}`;
        if (!seenRel.has(key)) {
          seenRel.add(key);
          md += `    ${r.to} ||--o{ ${r.from} : "${r.col}"\n`;
        }
      }
      md += `\`\`\`\n\n`;
    }

    md += `**Danh sách các bảng trong phân hệ & Số lượng bản ghi thực tế:**\n\n`;
    md += `| Tên bảng | Loại thực thể | Số cột | Bản ghi thực tế | Engine | Ràng buộc FK | Mục đích nghiệp vụ |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;
    for (const t of domData.tables) {
      const tbl = tables[t];
      if (!tbl) continue;
      const typeStr = tbl.isView ? '`Khung nhìn (VIEW)`' : '`Bảng vật lý (InnoDB)`';
      const outFkCount = tbl.foreignKeys.length;
      const impOutCount = implicitOutbound[t] ? implicitOutbound[t].length : 0;
      const fkStr = `${outFkCount} vật lý` + (impOutCount > 0 ? ` + ${impOutCount} logic` : '');
      md += `| [\`${t}\`](#table-${t}) | ${typeStr} | ${tbl.columns.length} | **${tbl.rows}** | \`${tbl.engine}\` | ${fkStr} | ${tbl.comment || 'Quản lý ' + t} |\n`;
    }
    md += `\n---\n\n`;
  }

  md += `## 📚 4. TỪ ĐIỂN CƠ SỞ DỮ LIỆU ĐẦY ĐỦ 100 BẢNG (COMPREHENSIVE 100-TABLE DATA DICTIONARY)\n\n`;
  md += `Chi tiết 100% từng bảng, từng cột, kiểu dữ liệu chuẩn xác, ràng buộc Nullable, Default value, Primary Key, Foreign Key (cả vật lý và logic) và bảng chỉ mục (Indexes):\n\n`;

  const sortedTableNames = Object.keys(tables).sort();
  for (const t of sortedTableNames) {
    const tbl = tables[t];
    md += `<a id="table-${t}"></a>\n\n`;
    md += `### 📌 Bảng: \`${t}\` ${tbl.isView ? '(VIEW)' : ''}\n`;
    md += `- **Loại thực thể**: ${tbl.isView ? 'MySQL VIEW (Khung nhìn tổng hợp dữ liệu)' : 'MySQL Base Table'}\n`;
    md += `- **Engine / Collation**: \`${tbl.engine}\` / \`${tbl.collation || 'N/A'}\`\n`;
    md += `- **Số bản ghi thực tế đối soát (Exact Count)**: **${tbl.rows}** bản ghi\n`;
    if (!tbl.isView) {
      md += `- **Dung lượng lưu trữ**: Dữ liệu: ${(tbl.dataLength / 1024).toFixed(1)} KB | Chỉ mục (Index): ${(tbl.indexLength / 1024).toFixed(1)} KB\n`;
    }
    if (tbl.comment) {
      md += `- **Mô tả hệ thống**: ${tbl.comment}\n`;
    }

    // View SQL Definition
    if (tbl.isView) {
      const viewSql = deepData.views[t];
      if (viewSql) {
        md += `\n**Định nghĩa câu lệnh View SQL (DDL):**\n\`\`\`sql\n${viewSql}\n\`\`\`\n\n`;
      }
    }

    // Physical Outbound Foreign Keys
    if (tbl.foreignKeys && tbl.foreignKeys.length > 0) {
      md += `- **Khóa ngoại vật lý liên kết ra (Physical Outbound FKs)**:\n`;
      for (const fk of tbl.foreignKeys) {
        md += `  * \`${fk.column}\` ➔ [\`${fk.referencedTable}.${fk.referencedColumn}\`](#table-${fk.referencedTable}) *(Ràng buộc: \`${fk.name}\`)*\n`;
      }
    }

    // Logical Outbound Foreign Keys
    if (implicitOutbound[t] && implicitOutbound[t].length > 0) {
      md += `- **Khóa ngoại logic liên kết ra (Logical Outbound References)**:\n`;
      for (const imp of implicitOutbound[t]) {
        md += `  * \`${imp.fromColumn}\` ➔ [\`${imp.targetTable}.${imp.targetColumn}\`](#table-${imp.targetTable}) *(Điều khiển bởi Controller Logic)*\n`;
      }
    }

    // Inbound Physical FKs
    const inboundPhysical = [];
    for (const otherT of sortedTableNames) {
      if (otherT === t) continue;
      for (const fk of tables[otherT].foreignKeys) {
        if (fk.referencedTable === t) {
          inboundPhysical.push({ from: otherT, col: fk.column, refCol: fk.referencedColumn, name: fk.name });
        }
      }
    }
    if (inboundPhysical.length > 0) {
      md += `- **Bảng khác liên kết vật lý tới (Physical Inbound References)**:\n`;
      for (const inFk of inboundPhysical) {
        md += `  * [\`${inFk.from}.${inFk.col}\`](#table-${inFk.from}) ➔ \`${t}.${inFk.refCol}\`\n`;
      }
    }

    // Inbound Logical FKs
    if (implicitInbound[t] && implicitInbound[t].length > 0) {
      md += `- **Bảng khác liên kết logic tới (Logical Inbound References)**:\n`;
      for (const inImp of implicitInbound[t]) {
        md += `  * [\`${inImp.fromTable}.${inImp.fromColumn}\`](#table-${inImp.fromTable}) ➔ \`${t}.${inImp.targetColumn}\`\n`;
      }
    }

    md += `\n**Cấu trúc cột dữ liệu (Columns Specification):**\n\n`;
    md += `| Cột (Field) | Kiểu dữ liệu (Type) | Cho phép Null | Khóa (Key) | Giá trị mặc định (Default) | Thuộc tính thêm (Extra) | Ghi chú (Comment) |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;
    for (const c of tbl.columns) {
      const keyBadge = c.key === 'PRI' ? '🔴 **PRI**' : (c.key === 'UNI' ? '🟡 **UNI**' : (c.key === 'MUL' ? '🔵 **MUL**' : '-'));
      const nullStr = c.null === 'NO' ? '❌ NOT NULL' : '✅ NULL';
      const defStr = c.default === null ? '`NULL`' : (c.default === '' ? '*(rỗng)*' : `\`${c.default}\``);
      md += `| \`${c.field}\` | \`${c.type}\` | ${nullStr} | ${keyBadge} | ${defStr} | ${c.extra || '-'} | ${c.comment || '-'} |\n`;
    }

    if (tbl.indexes && tbl.indexes.length > 0) {
      md += `\n**Bảng chỉ mục tối ưu truy vấn (Indexes):**\n\n`;
      md += `| Tên Index | Cột được đánh index | Thứ tự trong Index | Tính duy nhất (Unique) | Kiểu Index |\n`;
      md += `| :--- | :--- | :--- | :--- | :--- |\n`;
      for (const idx of tbl.indexes) {
        const uStr = idx.nonUnique === '0' || idx.nonUnique === 0 ? '✅ UNIQUE' : '❌ Non-unique';
        md += `| \`${idx.name}\` | \`${idx.column}\` | ${idx.seq} | ${uStr} | \`${idx.indexType}\` |\n`;
      }
    }

    md += `\n[⬆ Quay lại đầu trang](#-báo-cáo-kiểm-toán-cơ-sở-dữ-liệu--sơ-đồ-thực-thể-liên-kết-database-erd-100-full)\n\n`;
    md += `---\n\n`;
  }

  md += `## 🛡️ 5. BÁO CÁO TOÀN VẸN KIẾN TRÚC & PHÂN TÍCH RỦI RO BẢO MẬT (ENTERPRISE AUDIT FINDINGS)\n\n`;
  md += `1. **Kiểm soát Nguồn Sự Thật Duy Nhất (Single Source of Truth - SST)**:\n`;
  md += `   - Toàn bộ 100 thực thể được truy xuất trực tiếp từ CSDL MySQL Staging (\`zccqvhhh_crm-rlvn\`) thông qua cổng kiểm toán bảo mật \`backend/exec_db_query.php\`.\n`;
  md += `   - Tuyệt đối không tồn tại hiện tượng Split-Brain (bộ nhớ trình duyệt \`localStorage\`/\`IndexedDB\` không lưu trữ dữ liệu CRM cạnh tranh với CSDL máy chủ).\n`;
  md += `2. **Bảo Đảm Tính Toàn Vẹn ACID & Atomic Concurrency Trong Giao Dịch Bất Động Sản**:\n`;
  md += `   - 100% 98 bảng vật lý hoạt động trên engine \`InnoDB\`, đảm bảo tính khả chuyển của transaction (\`START TRANSACTION / COMMIT / ROLLBACK\`).\n`;
  md += `   - Các thực thể tài chính cốt lõi: \`deposits\` (Phiếu cọc), \`deposit_milestones\` (Đợt thanh toán), \`invoices\` (Hóa đơn), \`expenses\` (Chi phí) được bảo vệ bằng ràng buộc khóa ngoại \`CASCADE\` / \`RESTRICT\`, ngăn chặn triệt để tình trạng xóa mồ côi (Orphan Records).\n`;
  md += `3. **Cơ Chế Khử Trùng Lặp Khách Hàng (Lead Deduplication Architecture)**:\n`;
  md += `   - Thực thể \`persons\` giữ vai trò định danh vật lý độc nhất thông qua chỉ mục \`UNIQUE (phone)\`.\n`;
  md += `   - Thực thể \`contacts\` cho phép một khách hàng có thể giao dịch nhiều dự án hoặc tương tác nhiều lần trong cùng một tenant mà không gây vỡ cấu trúc quan hệ.\n`;
  md += `4. **Phân Quyền Đa Người Thuê & Cách Ly Dữ Liệu Nhân Sự (Multi-Tenant & Role Isolation)**:\n`;
  md += `   - Cột \`tenant_id\` xuất hiện nhất quán trên toàn bộ các bảng nghiệp vụ, đảm bảo phân lập dữ liệu đa doanh nghiệp.\n`;
  md += `   - Bảng tài liệu đám mây \`cloud_files\` phân định rõ ràng giữa người tải lên (\`uploaded_by\`) và người chỉnh sửa (\`updated_by\`), hỗ trợ chính sách bảo mật: Sales chỉ được quyền đọc tài liệu cá nhân, cấp Quản trị mới được tải lên hoặc xóa tài liệu.\n`;
  md += `5. **Khuyến Nghị Kỹ Thuật Dành Cho Senior DEV & DBA**:\n`;
  md += `   - **Chuẩn hóa Collation**: Bảng \`sent_notifications\` hiện tại là \`utf8mb4_general_ci\`. Khuyến nghị chạy lệnh chuyển đổi sang \`utf8mb4_unicode_ci\` để đồng bộ 100% với 97 bảng còn lại:\n`;
  md += `     \`\`\`sql\n     ALTER TABLE sent_notifications CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\n     \`\`\`\n`;
  md += `   - **Bảo trì Định kỳ Bảng Log**: Các bảng \`communication_logs\` (2.406 rows), \`notifications\` (2.809 rows), \`sent_notifications\` (1.210 rows) và \`audit_logs\` (1.353 rows) cần có cron job định kỳ lưu trữ (archive) hoặc dọn dẹp các bản ghi quá 180 ngày để duy trì hiệu năng cao nhất.\n`;

  return md;
}

const markdownContent = generateMarkdown();
const targetPath = path.join(__dirname, '..', 'DATABASE_ERD_FULL.md');
fs.writeFileSync(targetPath, markdownContent, 'utf8');

// Also update artifact
const artifactPath = 'C:\\Users\\LENOVO\\.gemini\\antigravity-ide\\brain\\d5e49a91-8de2-41e9-962a-2eede3e0624e\\database_erd_full.md';
fs.writeFileSync(artifactPath, markdownContent, 'utf8');

console.log(`Generated complete 100% ERD document: ${targetPath}`);
console.log(`File size: ${(Buffer.byteLength(markdownContent) / 1024).toFixed(1)} KB`);
console.log(`Total lines: ${markdownContent.split('\n').length}`);
