const fs = require('fs');

let content = fs.readFileSync('backend/api.php', 'utf8');

// Normalize CRLF to search or use direct string
// 1. Add fields to SELECT in get_logs
const targetSelect = "                l.lead_phan_loai,\r\n                l.loai_lead,";
const replSelect = "                l.lead_phan_loai,\r\n                l.loai_lead,\r\n                l.donvi_chay,\r\n                l.ad_name,\r\n                l.link_video_ads,\r\n                COALESCE(proj.name, l.preferred_location) as project_name,";

if (!content.includes(targetSelect)) {
  console.error('targetSelect not found');
  process.exit(1);
}
content = content.replace(targetSelect, replSelect);

// 2. Add LEFT JOIN projects
const targetJoin = "            LEFT JOIN leads l ON dl.lead_id = l.id\r\n";
const replJoin = "            LEFT JOIN leads l ON dl.lead_id = l.id\r\n            LEFT JOIN projects proj ON (l.project_id = proj.id OR l.target_project_id = proj.id)\r\n";

if (!content.includes(targetJoin)) {
  console.error('targetJoin not found');
  process.exit(1);
}
content = content.replace(targetJoin, replJoin);

// 3. Update $tQuery in get_logs
const targetTQuery = `            $tQuery = "SELECT 
                        c.person_id, 
                        c.id as contact_id, 
                        c.lead_id,
                        c.owner_id as id, 
                        COALESCE(NULLIF(cons.name, ''), NULLIF(u.name, ''), NULLIF(u.full_name, ''), 'Tư vấn viên') as name, 
                        COALESCE(cons.avatar, u.avatar) as avatar, 
                        COALESCE(cons.phone, u.phone) as consultant_phone,
                        tm.name as team_name,`.replace(/\n/g, '\r\n');

const replTQuery = `            $tQuery = "SELECT 
                        c.person_id, 
                        c.id as contact_id, 
                        c.lead_id,
                        COALESCE(c.owner_id, (
                            SELECT dl2.assigned_to 
                            FROM distribution_logs dl2 
                            JOIN leads ld2 ON dl2.lead_id = ld2.id 
                            WHERE ld2.person_id = c.person_id 
                            ORDER BY dl2.id DESC LIMIT 1
                        ), (
                            SELECT lr2.consultant_id 
                            FROM lead_reports lr2 
                            JOIN leads ld3 ON lr2.lead_id = ld3.id 
                            WHERE ld3.person_id = c.person_id 
                            ORDER BY lr2.id DESC LIMIT 1
                        )) as id, 
                        COALESCE(NULLIF(cons.name, ''), NULLIF(u.name, ''), NULLIF(u.full_name, ''), (
                            SELECT COALESCE(NULLIF(cons3.name, ''), NULLIF(u3.name, ''), NULLIF(u3.full_name, ''))
                            FROM distribution_logs dl3
                            JOIN leads ld3 ON dl3.lead_id = ld3.id
                            LEFT JOIN users u3 ON dl3.assigned_to = u3.id
                            LEFT JOIN consultants cons3 ON (u3.email = cons3.email OR u3.id = cons3.id OR dl3.assigned_to = cons3.id)
                            WHERE ld3.person_id = c.person_id
                            ORDER BY dl3.id DESC LIMIT 1
                        ), 'Tư vấn viên') as name, 
                        COALESCE(cons.avatar, u.avatar, (
                            SELECT COALESCE(cons3.avatar, u3.avatar)
                            FROM distribution_logs dl3
                            JOIN leads ld3 ON dl3.lead_id = ld3.id
                            LEFT JOIN users u3 ON dl3.assigned_to = u3.id
                            LEFT JOIN consultants cons3 ON (u3.email = cons3.email OR u3.id = cons3.id OR dl3.assigned_to = cons3.id)
                            WHERE ld3.person_id = c.person_id
                            ORDER BY dl3.id DESC LIMIT 1
                        )) as avatar, 
                        COALESCE(cons.phone, u.phone, (
                            SELECT COALESCE(cons3.phone, u3.phone)
                            FROM distribution_logs dl3
                            JOIN leads ld3 ON dl3.lead_id = ld3.id
                            LEFT JOIN users u3 ON dl3.assigned_to = u3.id
                            LEFT JOIN consultants cons3 ON (u3.email = cons3.email OR u3.id = cons3.id OR dl3.assigned_to = cons3.id)
                            WHERE ld3.person_id = c.person_id
                            ORDER BY dl3.id DESC LIMIT 1
                        )) as consultant_phone,
                        COALESCE(tm.name, (
                            SELECT tm3.name
                            FROM distribution_logs dl3
                            JOIN leads ld3 ON dl3.lead_id = ld3.id
                            LEFT JOIN users u3 ON dl3.assigned_to = u3.id
                            LEFT JOIN consultants cons3 ON (u3.email = cons3.email OR u3.id = cons3.id OR dl3.assigned_to = cons3.id)
                            LEFT JOIN teams tm3 ON (cons3.team_id = tm3.id OR u3.team_id = tm3.id)
                            WHERE ld3.person_id = c.person_id
                            ORDER BY dl3.id DESC LIMIT 1
                        )) as team_name,`.replace(/\n/g, '\r\n');

if (!content.includes(targetTQuery)) {
  console.error('targetTQuery not found');
  process.exit(1);
}
content = content.replace(targetTQuery, replTQuery);

// 4. Update fallback consultants join
const targetFbJoin = 'LEFT JOIN consultants cons ON (u.email = cons.email OR u.id = cons.id)';
content = content.replace(targetFbJoin, 'LEFT JOIN consultants cons ON (u.email = cons.email OR u.id = cons.id OR dl.assigned_to = cons.id)');

fs.writeFileSync('backend/api.php', content, 'utf8');
console.log('Successfully updated backend/api.php');
