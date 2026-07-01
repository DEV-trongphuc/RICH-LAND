# ERD v0.1 — TỪ ĐIỂN DỮ LIỆU

> Đi kèm: `10-ERD-v0.1.mermaid` (sơ đồ) · Trạng thái: 🟡 v0.1 — Sếp + dev review
> Mỗi thực thể neo về số luật trong file luồng — dev truy ngược được "bảng này sinh từ quyết định nào".

---

## NGUYÊN TẮC THIẾT KẾ (đúc từ 7 luồng)

1. **3 thực thể danh tính tách rời**: LEAD (sự kiện, bất biến) → PERSON (con người, gom SĐT) → KHTN (Person × Chiến dịch × Owner). Không bao giờ gộp.
2. **Lịch sử là bảng, không phải cột**: trạng thái, quyền truy cập, vòng chia, mốc thanh toán — đều là event log. Hết cảnh 6 cột `*_time` nén trong 1 bảng như AppSheet cũ.
3. **Thứ hay đổi là config có hiệu lực theo thời gian**: bảo mật kho, decay, lịch thanh toán, HĐ môi giới, lịch làm việc.
4. **Số tổng hợp tính từ data gốc** — cấm lưu thành cột tĩnh (luật 7.11).
5. **FK thật + Row-Level Security** — hết nhân bản bảng theo vai, hết quan hệ "niềm tin".

---

## TỪ ĐIỂN THỰC THỂ (28 bảng nghiệp vụ)

### Nhóm Danh tính & Lead vào (Luồng 1)

| Bảng | Vai trò | Luật neo | Migrate từ |
|---|---|---|---|
| `PERSON` | Con người duy nhất theo SĐT. Giữ cờ `la_khach` (đã phát sinh doanh thu), opt-out, tag lý do đóng (tệp broadcast) | 1.4, 6.16, từ điển | Gom từ LEADS theo phone (8.428 số) |
| `LEAD` | 1 lần đăng ký — bất biến, đầy đủ attribution (ad_id, campaign), nguồn enum có ràng buộc | 1.1-1.5, 1.14 | LEADS (8.7k) — sửa nhãn kenh sai |
| `BROADCAST_DOT` | 1 đợt bắn: tệp rule, thông điệp, kênh | 1.11-1.13 | Mới |
| `BROADCAST_GUI` | Danh sách đã gửi từng đợt — mẫu số đo response | 1.12 | Mới |

### Nhóm Tổ chức & Chiến dịch

| Bảng | Vai trò | Luật neo | Migrate từ |
|---|---|---|---|
| `NHAN_VIEN` | Người dùng — password hash (hết plaintext) | audit 01 | NHAN_VIEN (54) |
| `VAI` + `NHAN_VIEN_VAI` | Vai theo 3 nhóm chức năng, 1 người n vai | file 09 | MENU/phan_quyen cũ — bỏ, làm lại |
| `CHIEN_DICH` / `DU_AN` | Chiến dịch kinh doanh / dự án | — | CAMPAIGN (4), DU_AN (37) |
| `ROSTER` | Danh sách sale tham gia chiến dịch — GĐKD DA quản | 2.2-2.3 | Mới (thay duan_phutrach của TEAM) |
| `CONFIG_CHIEN_DICH` | Mọi núm vặn theo chiến dịch, có hiệu lực theo thời gian | 2.17, 3.6, 5.2 | Mới |

### Nhóm KHTN & Chăm sóc (Luồng 3-4)

| Bảng | Vai trò | Luật neo | Migrate từ |
|---|---|---|---|
| `KHTN` | Person × Chiến dịch × Owner — đơn vị làm việc của sale | 4.1, từ điển | KHTN (9.4k) |
| `LICH_SU_TRANG_THAI` | Event log chuyển trạng thái + bằng chứng — nguồn tính funnel, đồng hồ kho, CAPI | 3.13, 5.2 | Tách từ 6 cột *_time của KHTN cũ |
| `QUYEN_TRUY_CAP` | Owner/hỗ trợ, mời/thu hồi — lịch sử vĩnh viễn; nguồn sinh phiếu hợp tác | 4.2-4.5 | Mới |
| `GHI_CHU` | Ghi chú cấu trúc: kênh-Nồi, loại, thời lượng, tag vướng, 2 giá trị nhiệt, cờ di sản | 3.1-3.7, 2.27 | LS_CSKH (30.7k) — 24% thiếu khtn_id phải vá |
| `FORM_TTL1` | Form 5 nhóm + độ đầy (gate) | 3.11-3.12 | Đào từ text `chan_dung` cũ (best-effort) |

### Nhóm Chia lead (Luồng 2)

| Bảng | Vai trò | Luật neo | Migrate từ |
|---|---|---|---|
| `LOG_CHIA` | Mỗi nhịp offer: ai, lúc nào, kết quả, ca — nguồn đo sẵn sàng | 2.5-2.11 | Mới (hệ cũ không log) |
| `DIEU_KIEN_NGAY` | Check-in, sẵn sàng, đăng ký đêm/cuối tuần, xin-duyệt — trạng thái tổng hợp/ngày | 2.4, 2.12-2.18 | Mới |

### Nhóm Kho (Luồng 5)

| Bảng | Vai trò | Luật neo | Migrate từ |
|---|---|---|---|
| `KHO_DATA` | Person ra kho (1 lần) — lý do, rút khi Đặt Cọc | 5.3, 5.5 | LEADS_KHOCHUNG (12.8k) |
| `KHO_NHAN` | Lượt sale nhận từ kho → sinh KHTN nguồn databank | 5.4, 5.9 | Suy từ KHTN phan_loai databank |

### Nhóm Tiền (Luồng 6)

| Bảng | Vai trò | Luật neo | Migrate từ |
|---|---|---|---|
| `GIO_HANG_CAN` | Danh mục sản phẩm sống: mã căn, giá, CSBH, PTTT | 6.18-6.19 | Mới |
| `GIAO_DICH` | Deal = căn × KHTN; trạng thái gồm bể cọc/đổi căn; cho mã căn tự do khi chưa có giỏ | 6.6-6.7, 6.15-6.16, 6.20 | LS_GIAODICH (76) |
| `PHIEU_COC` | Quy trình 4 bước Sale ↔ Admin dự án | 6.1-6.2 | Mới |
| `MOC_THANH_TOAN` | Hành trình KH–CĐT: mốc, hạn, UNC, xác nhận | 6.3-6.5 | LS_THANHTOAN (169) |
| `PHIEU_HOP_TAC` + `DONG_PHIEU_HT` | Phiếu chia % + chữ ký từng người + GĐKD duyệt + khóa | 4.5-4.15 | HOA_HONG (285) — map 1 phần |
| `LICH_TT_DU_AN` | Config lịch thanh toán từng dự án | 6.3 | Mới |
| `HD_MOI_GIOI` + `DOT_PHI` | Config hợp đồng môi giới: % phí, đợt trả, mốc đủ điều kiện | 6.8 | Mới |
| `DOI_CHIEU_PHI` | 3 trạng thái: đủ ĐK → đã gửi hồ sơ → tiền về. Đầu ra cho kế toán | 6.9-6.14 | Mới |

### Nhóm Dữ liệu ngược (Luồng 7)

| Bảng | Vai trò | Luật neo | Migrate từ |
|---|---|---|---|
| `MOC_LEAD` | Mốc funnel đầu tiên theo từng Lead — chốt chặn forward-only *(đổi từ Person → Lead theo góp ý dev: đúng cơ chế Conversion Leads)* | 7.2 | Suy từ state history khi migrate |
| `CAPI_LOG` | Hàng đợi + nhật ký bắn event theo lead (kèm client_context fbp/fbc), cảnh báo stale | 7.3-7.6 | Kế thừa pipeline hiện chạy — bỏ Sheet trung gian |
| `CHI_PHI_ADS` | Chi phí **ngày × ad** (level thấp nhất, roll-up lên adset/campaign) → CPL/CAC tới từng creative | 7.10 | Kế thừa pipeline insight Meta hiện có |

### Hạ tầng (không vẽ trong ERD cho gọn — dev mặc định)

| Bảng | Vai trò |
|---|---|
| `DINH_KEM` | Đa hình (entity_type, entity_id): UNC, ảnh check-in, CCCD, bằng chứng trạng thái |
| `THONG_BAO` | Hàng đợi thông báo — chờ tài liệu Trung tâm thông báo |
| `AUDIT_LOG` | Mọi hành động quan trọng: ai, gì, trước/sau, lúc nào (BRD 2.13) |

---

## BẢNG CŨ KHÔNG MANG SANG

`Term_TACVUKHAC` (13k rác kỹ thuật) · `MENU`, `DASHBOARD`, `TAI_LIEU`, `THONG_TIN_CTY` (UI AppSheet) · `KHTN_GDSAN`, `LEADS_GDSAN` (view giả lập phân quyền — thay bằng RLS) · `LICH`, `LOC` (thay bằng CONFIG + ROSTER) · `BOTCALL` (thử nghiệm — quyết sau) · `DUYET_NOTLEAD` (gộp vào LICH_SU_TRANG_THAI + hàng đợi duyệt) · `CHANDUNG_KHACHHANG` (thiết kế tốt nhưng 2 dòng — tái sinh thành FORM_TTL1).

---

## NHẬT KÝ RÀ SOÁT

**06/06 — rà chéo ERD với 80+ luật, vá 3 lỗ:** thêm `CAU_HINH_TRANG_THAI` (state machine + bằng chứng + mapping CAPI dạng config — luật 3.13, 7.8, chỗ chèn "Thiện chí" sau này); thêm `PHIEU_HOP_TAC.dieu_chinh_tu_id` (phiếu điều chỉnh — luật 4.12); `CONFIG_CHIEN_DICH.chien_dich_id` cho phép NULL = config toàn sàn (lịch làm việc, giờ vàng — luật 2.17).

**06/06 — sửa theo góp ý dev:** `MOC_PERSON` → `MOC_LEAD` (bắn CAPI theo lead), `CAPI_LOG` thêm client_context, `CHI_PHI_ADS` xuống level ngày × ad.

## CÒN MỞ CHO v0.2

1. Vòng đời chiến dịch chưa thảo luận → nhóm CONFIG có thể nở thêm (checklist mở chiến dịch, phase Kickoff/Mở Bán).
2. ~~2 câu CAPI~~ ✅ chốt cùng dev 06/06: match chính = lead_id Meta cấp, Person thuần nội bộ; `client_context` = hộp nhận diện theo nguồn thuộc LEAD (FB: fbp/fbc · Google: nhận diện từ LP) — đã chuyển thành cột của LEAD trong ERD. Phase 3 chỉ cần xác minh độ phủ gclid trên data thật.
3. Trung tâm thông báo → bảng THONG_BAO chi tiết sau khi chốt kênh (in-app / Zalo).
4. Quy trình admin từ chối phiếu cọc (Luồng 6 M1) → có thể thêm trạng thái cho PHIEU_COC.
5. Dev review: kiểu dữ liệu chi tiết, index, partition (GHI_CHU 30k+/năm sẽ lớn).
