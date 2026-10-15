<?php
// backend/sync_appsheet_batch.php
// Script đồng bộ dữ liệu AppSheet vào bảng leads và contacts trên MySQL CRM

header('Content-Type: application/json; charset=utf-8');
set_time_limit(300);
ini_set('memory_limit', '512M');

require_once __DIR__ . '/db_connect.php';

$key = $_REQUEST['key'] ?? '';
if ($key !== 'richland2026') {
    http_response_code(403);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

if (!function_exists('str_starts_with')) {
    function str_starts_with($haystack, $needle) {
        return (string)$needle === '' || strpos($haystack, $needle) === 0;
    }
}

$rawInput = file_get_contents('php://input');
$input = json_decode($rawInput, true);
$items = $input['items'] ?? [];

if (empty($items)) {
    echo json_encode(['success' => true, 'updated_leads' => 0, 'updated_contacts' => 0]);
    exit;
}

$updatedLeads = 0;
$updatedContacts = 0;

$conn->begin_transaction();

try {
    // Statement UPDATE LEADS
    $stmtLead = $conn->prepare("
        UPDATE leads SET
            appsheet_id     = COALESCE(NULLIF(?, ''), appsheet_id),
            loai_lead       = COALESCE(NULLIF(?, ''), loai_lead),
            lead_phan_loai  = COALESCE(NULLIF(?, ''), lead_phan_loai),
            donvi_chay      = COALESCE(NULLIF(?, ''), donvi_chay),
            facebook_link   = COALESCE(NULLIF(?, ''), facebook_link),
            form_name       = COALESCE(NULLIF(?, ''), form_name),
            ad_id           = COALESCE(NULLIF(?, ''), ad_id),
            ad_name         = COALESCE(NULLIF(?, ''), ad_name),
            campaign_id     = COALESCE(NULLIF(?, ''), campaign_id),
            campaign_name   = COALESCE(NULLIF(?, ''), campaign_name),
            platform        = COALESCE(NULLIF(?, ''), platform),
            kenh            = COALESCE(NULLIF(?, ''), kenh),
            loai_hinh       = COALESCE(NULLIF(?, ''), loai_hinh),
            hinh_thuc_tt    = COALESCE(NULLIF(?, ''), hinh_thuc_tt),
            time_lienhe     = COALESCE(NULLIF(?, ''), time_lienhe),
            app_lienhe      = COALESCE(NULLIF(?, ''), app_lienhe),
            nhu_cau         = COALESCE(NULLIF(?, ''), nhu_cau),
            demand_type     = COALESCE(NULLIF(?, ''), demand_type),
            tieu_chi        = COALESCE(NULLIF(?, ''), tieu_chi),
            san_pham        = COALESCE(NULLIF(?, ''), san_pham),
            city            = COALESCE(NULLIF(?, ''), city),
            country         = COALESCE(NULLIF(?, ''), country),
            birthday        = COALESCE(NULLIF(?, ''), birthday),
            inbox_url       = COALESCE(NULLIF(?, ''), inbox_url),
            client_context  = COALESCE(NULLIF(?, ''), client_context),
            mkt_chiateam    = COALESCE(NULLIF(?, ''), mkt_chiateam),
            kho_lead        = COALESCE(NULLIF(?, ''), kho_lead),
            lead_tindung    = COALESCE(NULLIF(?, ''), lead_tindung),
            time_databank   = COALESCE(NULLIF(?, ''), time_databank)
        WHERE 
            (appsheet_id IS NOT NULL AND appsheet_id = ?)
            OR (raw_payload IS NOT NULL AND raw_payload LIKE ?)
            OR (phone IS NOT NULL AND phone != '' AND (phone = ? OR phone = ? OR phone = ?))
    ");

    // Statement UPDATE CONTACTS
    $stmtContact = $conn->prepare("
        UPDATE contacts SET
            appsheet_id     = COALESCE(NULLIF(?, ''), appsheet_id),
            loai_lead       = COALESCE(NULLIF(?, ''), loai_lead),
            lead_phan_loai  = COALESCE(NULLIF(?, ''), lead_phan_loai),
            donvi_chay      = COALESCE(NULLIF(?, ''), donvi_chay),
            fb_link         = COALESCE(NULLIF(?, ''), fb_link),
            facebook_link   = COALESCE(NULLIF(?, ''), facebook_link),
            form_name       = COALESCE(NULLIF(?, ''), form_name),
            ad_id           = COALESCE(NULLIF(?, ''), ad_id),
            ad_name         = COALESCE(NULLIF(?, ''), ad_name),
            utm_campaign    = COALESCE(NULLIF(?, ''), utm_campaign),
            platform        = COALESCE(NULLIF(?, ''), platform),
            loai_hinh       = COALESCE(NULLIF(?, ''), loai_hinh),
            hinh_thuc_tt    = COALESCE(NULLIF(?, ''), hinh_thuc_tt),
            time_lienhe     = COALESCE(NULLIF(?, ''), time_lienhe),
            app_lienhe      = COALESCE(NULLIF(?, ''), app_lienhe),
            nhu_cau         = COALESCE(NULLIF(?, ''), nhu_cau),
            demand_type     = COALESCE(NULLIF(?, ''), demand_type),
            tieu_chi        = COALESCE(NULLIF(?, ''), tieu_chi),
            san_pham        = COALESCE(NULLIF(?, ''), san_pham),
            city            = COALESCE(NULLIF(?, ''), city),
            inbox_url       = COALESCE(NULLIF(?, ''), inbox_url),
            client_context  = COALESCE(NULLIF(?, ''), client_context),
            csdh_time       = COALESCE(NULLIF(?, ''), csdh_time),
            quantam_time    = COALESCE(NULLIF(?, ''), quantam_time),
            dongygap_time   = COALESCE(NULLIF(?, ''), dongygap_time),
            dagap_time      = COALESCE(NULLIF(?, ''), dagap_time),
            booking_time    = COALESCE(NULLIF(?, ''), booking_time),
            datcoc_time     = COALESCE(NULLIF(?, ''), datcoc_time),
            sl_booking      = COALESCE(?, sl_booking),
            chan_dung       = COALESCE(NULLIF(?, ''), chan_dung),
            image_dongygap  = COALESCE(NULLIF(?, ''), image_dongygap),
            image_dagap     = COALESCE(NULLIF(?, ''), image_dagap),
            image_UNC       = COALESCE(NULLIF(?, ''), image_UNC),
            thongtin_kh_origin = COALESCE(NULLIF(?, ''), thongtin_kh_origin)
        WHERE 
            (appsheet_id IS NOT NULL AND appsheet_id = ?)
            OR (phone IS NOT NULL AND phone != '' AND (phone = ? OR phone = ? OR phone = ?))
            OR (legacy_khtn_id IS NOT NULL AND legacy_khtn_id = ?)
    ");

    foreach ($items as $item) {
        $appsheetId   = trim($item['id'] ?? '');
        $loaiLead     = trim($item['loai_lead'] ?? '');
        $leadPhanLoai = trim($item['lead_phan_loai'] ?? '');
        $donviChay    = trim($item['donvi_chay'] ?? '');
        $linkFb       = trim($item['link_fb'] ?? '');
        $formName     = trim($item['form_dangky'] ?? '');
        $adId         = trim($item['ad_id'] ?? '');
        $adName       = trim($item['ad_name'] ?? '');
        $campaignId   = trim($item['campaign'] ?? '');
        $platform     = trim($item['kenh'] ?? '');
        $loaiHinh     = trim($item['loai_hinh'] ?? '');
        $hinhThucTt   = trim($item['hinh_thuc_tt'] ?? '');
        $timeLienhe   = trim($item['time_lienhe'] ?? '');
        $appLienhe    = trim($item['app_lienhe'] ?? '');
        $nhuCau       = trim($item['nhu_cau'] ?? '');
        $tieuChi      = trim($item['tieu_chi'] ?? '');
        $sanPham      = trim($item['san_pham'] ?? '');
        $city         = trim($item['city'] ?? '');
        $country      = trim($item['country'] ?? '');
        $birthday     = trim($item['birthday'] ?? '');
        $inboxUrl     = trim($item['inbox_url'] ?? '');
        $clientCtx    = trim($item['client_context'] ?? '');
        $mktChiateam  = trim($item['mkt_chiateam'] ?? '');
        $khoLead      = trim($item['kho_lead'] ?? '');
        $leadTindung  = trim($item['lead_tindung'] ?? '');
        $timeDatabank = trim($item['time_databank'] ?? '');

        // KHTN fields
        $khtnId       = trim($item['khtn_id'] ?? '');
        $csdhTime     = trim($item['csdh_time'] ?? '');
        $quantamTime  = trim($item['quantam_time'] ?? '');
        $dongygapTime = trim($item['dongygap_time'] ?? '');
        $dagapTime    = trim($item['dagap_time'] ?? '');
        $bookingTime  = trim($item['booking_time'] ?? '');
        $datcocTime   = trim($item['datcoc_time'] ?? '');
        $slBooking    = isset($item['sl_booking']) && is_numeric($item['sl_booking']) ? (int)$item['sl_booking'] : null;
        $chanDung     = trim($item['chan_dung'] ?? '');
        $imgDongy     = trim($item['image_dongygap'] ?? '');
        $imgDagap     = trim($item['image_dagap'] ?? '');
        $imgUNC       = trim($item['image_UNC'] ?? '');
        $originInfo   = trim($item['thongtin_kh_origin'] ?? '');

        // Phone variations for robust matching
        $rawPhone = trim($item['phone'] ?? '');
        $digits = preg_replace('/\D/', '', $rawPhone);
        $phonePlus84 = '';
        $phoneZero = '';
        $phonePlain = '';
        if (!empty($digits)) {
            if (substr($digits, 0, 2) === '84' && strlen($digits) >= 11) {
                $base = substr($digits, 2);
                $phonePlus84 = '+84' . $base;
                $phoneZero = '0' . $base;
                $phonePlain = $base;
            } elseif (substr($digits, 0, 1) === '0') {
                $base = substr($digits, 1);
                $phonePlus84 = '+84' . $base;
                $phoneZero = '0' . $base;
                $phonePlain = $base;
            } else {
                $phonePlus84 = '+84' . $digits;
                $phoneZero = '0' . $digits;
                $phonePlain = $digits;
            }
        }
        $rawPayloadSearch = '%"appsheet_id":"' . $appsheetId . '"%';

        // Execute Leads update
        $stmtLead->bind_param(
            "sssssssssssssssssssssssssssssssssss",
            $appsheetId, $loaiLead, $leadPhanLoai, $donviChay, $linkFb,
            $formName, $adId, $adName, $campaignId, $campaignId,
            $platform, $platform, $loaiHinh, $hinhThucTt, $timeLienhe,
            $appLienhe, $nhuCau, $nhuCau, $tieuChi, $sanPham,
            $city, $country, $birthday, $inboxUrl, $clientCtx,
            $mktChiateam, $khoLead, $leadTindung, $timeDatabank,
            $appsheetId, $rawPayloadSearch, $rawPhone, $phonePlus84, $phoneZero
        );
        $stmtLead->execute();
        if ($stmtLead->affected_rows > 0) {
            $updatedLeads += $stmtLead->affected_rows;
        }

        // Execute Contacts update
        $stmtContact->bind_param(
            "ssssssssssssssssssssssssisssssssssssss",
            $appsheetId, $loaiLead, $leadPhanLoai, $donviChay, $linkFb,
            $linkFb, $formName, $adId, $adName, $campaignId,
            $platform, $loaiHinh, $hinhThucTt, $timeLienhe, $appLienhe,
            $nhuCau, $nhuCau, $tieuChi, $sanPham, $city,
            $inboxUrl, $clientCtx, $csdhTime, $quantamTime, $dongygapTime,
            $dagapTime, $bookingTime, $datcocTime, $slBooking, $chanDung,
            $imgDongy, $imgDagap, $imgUNC, $originInfo,
            $appsheetId, $rawPhone, $phonePlus84, $phoneZero, $khtnId
        );
        $stmtContact->execute();
        if ($stmtContact->affected_rows > 0) {
            $updatedContacts += $stmtContact->affected_rows;
        }
    }

    $stmtLead->close();
    $stmtContact->close();

    $conn->commit();

    echo json_encode([
        'success' => true,
        'batch_count' => count($items),
        'updated_leads' => $updatedLeads,
        'updated_contacts' => $updatedContacts
    ]);
} catch (Throwable $e) {
    $conn->rollback();
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
