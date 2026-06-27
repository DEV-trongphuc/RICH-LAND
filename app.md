Đây là ứng dụng CRM: "D:\GITHUB_SPACE\CRM". Nó được xây dựng với mục đích quản lý quan hệ khách hàng. 
Còn đây là ứng dụng auto chia data: "D:\GITHUB_SPACE\DATA". Nó được xây dựng với mục đích tự động hóa việc chia sẻ dữ liệu.

__________

Ở D:\RICH_LAND_DATA_UI chúng ta sẽ phát triển 1 app CRM khác nhưng phải đầy đủ các tính năng, toàn bộ logic, CRM và chia data phải connect với nhau thật chuẩn. UI sử dụng của "D:\GITHUB_SPACE\DATA" làm mẫu Style UI. nhưng màu sắc chủ đạo ko phải tím mà là: #BD1D2D dùng hệ màu oklch.

IMPROTANT: toàn bộ thiết lập phải cho dạng UI UX setting chứ ko  phải hardcode nhé. Lấy app GITHUB_SPACE\DATA làm chuẩn UI.
Logic toàn bộ app chia data cho Bất động sản là như này. Đảm bảo cho tôi toàn bộ các tính năng back-end, database UI UX đều hoạt động chuẩn và thật sự.
- Back-end api để up các file back-end trên host php: http://open.domation.net/richland/__các file_
- dbname: User: vhvxoigh_mail_auto
Database: vhvxoigh_db_richland
- pass: Ideas@812


# CRM-RLVN System Blueprint

> **Tài liệu đặc tả BA / Product**  
> **Phạm vi:** Thiết kế luồng và logic nghiệp vụ cốt lõi cho CRM-RLVN gồm 11 module.  
> **Nguồn:** `CRM-RLVN System Blueprint.pdf` (12 trang; 1 trang bìa + 11 trang module).  
> **Lưu ý cách đọc:** Phần **"Nội dung gốc"** là bản chép lại theo từng trang. Phần **"Diễn giải triển khai"** giúp chuyển các nguyên tắc này thành yêu cầu hệ thống; đây là diễn giải, không thay thế quyết định nghiệp vụ chính thức.

---

## 1. Tổng quan kiến trúc

Blueprint mô tả một CRM quản lý lead theo nguyên tắc:

1. **Lead đi vào qua một cửa duy nhất**, được lưu bất biến để bảo toàn dữ liệu nguồn.
2. Lead được phân bổ đến **cá nhân Sales**, không phân bổ trực tiếp cho Team.
3. Mọi thao tác quan trọng phải có **log kiểm chứng**, đặc biệt là nhận/từ chối lead, lý do bỏ qua, chuyển trạng thái và thay đổi quyền.
4. **Dự án** là thực thể trung tâm liên kết nhân sự, tài liệu, chiến dịch Ads, roster và lead.
5. **Person** không bị xóa khi lead đóng, hết hạn hoặc thay đổi trạng thái; dữ liệu cũ được đưa vào kho để tái khai thác.
6. Trạng thái chăm sóc, cọc/phí, dữ liệu CAPI và quyền truy cập đều được kiểm soát bằng rào cản nghiệp vụ và Row-Level Security.

### Các khái niệm được dùng trong tài liệu

| Thuật ngữ | Ý nghĩa theo ngữ cảnh tài liệu |
|---|---|
| **Lead** | Bản ghi đầu vào phát sinh từ nguồn marketing / Facebook / Google hoặc nguồn khác. |
| **Person** | Hồ sơ khách hàng/người liên hệ dùng để nhận diện trùng lặp và lưu lịch sử. |
| **KHTN** | Viết tắt được tài liệu sử dụng xuyên suốt cho khách hàng/đối tượng đang được chăm sóc. Tài liệu gốc không mở rộng đầy đủ cụm từ này. |
| **Roster** | Danh sách Sales đủ điều kiện nhận/bán một dự án. |
| **GĐKD** | Giám đốc Kinh doanh, có quyền thiết lập/duyệt một số luồng. |
| **MKT** | Marketing. |
| **TTL1** | Form bắt buộc trước một bước chuyển trạng thái; gồm 5 nhóm dữ liệu. |
| **CAPI** | Cơ chế gửi dữ liệu ngược từ CRM sang Meta theo event tiêu chuẩn. |
| **RLS** | Row-Level Security: phân quyền ở mức dòng dữ liệu trong database. |

---

# Module 1 - Lead Vào

**Mục tiêu:** Mọi nguồn đổ vào một cửa duy nhất, từ đó tạo Lead, nối Person và bàn giao/chia lead.

## Nội dung gốc

### 1. Tiếp nhận 1 cửa
- Mọi nguồn đi qua một cửa tiếp nhận.
- Lead bất biến: **chỉ thêm, không sửa**.
- Tự động gắn: `nguồn`, `campaign`, `ad_id`.

### 2. Chống trùng lặp
- Tra SĐT.
- Nếu trùng: nối vào Person cũ.
- Nếu không trùng: tạo Person mới.
- Facebook submit nhiều lần: tạo nhiều Lead.
- Google: gộp 1 Lead/ngày.

### 3. Broadcast & Ngoại lệ
- Broadcast = tạo Lead mới nhưng giữ Person cũ.
- Nguồn **cá nhân/giới thiệu** đi thẳng cho Sales, không qua vòng chia.

### 4. Đối soát & cảnh báo
- Có job đối soát Meta/Google mỗi sáng.
- Nhập cá nhân trùng SĐT với MKT: vẫn cho nhập, nhưng gắn cờ cảnh báo cho Quản lý.

> **Guardrail:** Lead là bất biến, tuyệt đối không được phép xóa hay chỉnh sửa data gốc sau khi đã chạy vào hệ thống.

## Diễn giải triển khai

- Nên tách `Lead` và `Person` thành hai thực thể. Một Person có thể có nhiều Lead, còn một Lead chỉ tham chiếu đến một Person sau khi kiểm tra số điện thoại.
- Các trường nguồn nên được ghi ngay khi ingest và hạn chế sửa sau đó: `source`, `campaign_id/name`, `ad_id`, `submitted_at`, `raw_payload`, `phone_normalized`.
- Quy tắc Google “1 Lead/ngày” cần xác định rõ khóa gộp: tối thiểu gồm `Person/phone + ngày + nguồn Google`; có thể bổ sung campaign nếu nghiệp vụ yêu cầu.
- Không xóa hoặc ghi đè payload nguồn. Khi cần điều chỉnh nghiệp vụ, nên dùng trường/record bổ sung và audit log.
- Job đối soát nên có bảng kết quả: số record nhận từ nền tảng, số record đã tạo Lead, số trùng, số lỗi, số chưa map campaign/ad_id.

---

# Module 2 - Chia Lead

**Mục tiêu:** Lead đến tay Sales sẵn sàng nhanh nhất, công bằng và có log kiểm chứng.

## Nội dung gốc

### 1. Điều kiện xoay vòng
Chuỗi lọc:

`Thuộc Roster -> Check-in -> Sẵn sàng -> Dưới hạn mức`

- Sales nhận lead là **cá nhân**, không giao cho Team.

### 2. Van chống ôm
- Lead tính công = **Đã nhận - Not Lead**.
- Nếu số KHTN “Chưa XĐ” vượt trần: bỏ qua Sales đó cho đến khi xử lý bớt.

### 3. Timeout 2 phút
- Offer 2 phút không phản hồi: thu hồi, chuyển người kế tiếp.
- Bật tạm vắng: bỏ qua, không tính lỗi.

### 4. Ca đêm & giờ vàng
- 18h-6h: Lead vào hàng đợi chờ sáng, gửi tin nhắn giữ ấm.
- 6h sáng: bung hàng, ưu tiên người check-in sớm.

> **Guardrail:** Toàn bộ vòng chia (AI, lúc nào, nhận/từ chối, lý do bỏ qua) phải được ghi log kiểm chứng rõ ràng trên hệ thống.

## Diễn giải triển khai

- Auto-routing nên chạy theo thứ tự điều kiện có thể kiểm chứng và lưu lại snapshot của các điều kiện tại thời điểm quyết định.
- Cần có entity `lead_offer` hoặc bảng log gồm: Lead, Sales được offer, thời điểm offer, deadline 2 phút, phản hồi, lý do bỏ qua/thu hồi, thứ tự trong vòng xoay và thuật toán/version rule đã dùng.
- “Sẵn sàng”, “check-in”, “tạm vắng” và “dưới hạn mức” nên là các trạng thái/thuộc tính có thời điểm cập nhật rõ ràng.
- Hàng đợi ca đêm cần có cơ chế tránh phân lại quá mức hoặc mất thứ tự ưu tiên khi 6h sáng bung hàng.
- “Van chống ôm” yêu cầu cấu hình được ngưỡng `KHTN Chưa XĐ` tối đa theo Sales hoặc theo dự án.

---

# Module 3 - Chăm Sóc & Nhiệt Độ

**Mục tiêu:** KHTN luôn có nhiệt độ và lý do vướng “tươi”; Sales biết việc tiếp theo cần làm.

## Nội dung gốc

### 1. Ghi chú cấu trúc
Nhập:

`Kênh (Đắt/Đồng/Áp Suất) + Thời lượng + Cảm xúc KH`

- Nhiệt được gắn cho KHTN, không phải Person.

### 2. Đề xuất nhiệt & decay
- Máy đề xuất nhiệt, Sales chốt (lưu cả 2).
- Sau 5 ngày không tương tác: tự rớt 1 mức và cảnh báo người phụ trách.

### 3. Tag vướng mắc
- Sales tick 1 chạm lý do: chưa tin, chưa ưng, ...
- Hệ thống tự động hiện “Toa tính” từ sổ tay hỗ trợ xử lý.

### 4. Rào cản Form TTL1
- Trước khi sang giai đoạn **Than (Đồng ý gặp)**, bắt buộc điền riêng Form TTL1 gồm 5 nhóm dữ liệu.
- Bằng chứng được gắn vào sự kiện.

> **Guardrail:** Form TTL1 thiếu từ 2 nhóm trở lên sẽ bị chặn cứng; hệ thống báo “Chưa nên chuyển giai đoạn”.

## Diễn giải triển khai

- Nên có bảng `care_note`/`interaction` lưu từng tương tác với thời điểm, kênh, thời lượng, cảm xúc và người ghi nhận.
- “Nhiệt máy đề xuất” và “nhiệt Sales chốt” cần là hai trường riêng để sau này phân tích độ chính xác của rule/AI.
- Rule decay phải dựa trên mốc “tương tác hợp lệ gần nhất”, không chỉ dựa trên thời điểm cập nhật record.
- “Toa tính” có thể được xây như knowledge base/rule engine: mapping từ tag vướng mắc sang checklist, kịch bản xử lý và hành động tiếp theo.
- Form TTL1 nên lưu theo phiên bản form, từng nhóm câu hỏi, tệp/bằng chứng và sự kiện submit; không chỉ lưu cờ hoàn thành.

---

# Module 4 - Hợp Tác & Hoa Hồng

**Mục tiêu:** Không có deal nào phải cãi nhau về chia chắc; thỏa thuận trở thành chữ ký số.

## Nội dung gốc

### 1. Mời đọc & ghi chú
- Mỗi KHTN có 1 Owner.
- Owner mời người khác vào xem.
- Không hiện % lúc mời.
- Người được mời được ghi chú dưới tên họ.

### 2. Sinh phiếu hợp tác
- Tạo Phiếu cọc -> Phiếu Hợp Tác tự sinh.
- Kéo tất cả người từng hỗ trợ, kể cả đã bị thu hồi quyền, vào danh sách.

### 3. Ký số xác nhận
- Owner điền %.
- Hệ thống kiểm tra tổng = 100%.
- Từng người bấm xác nhận.
- Đủ chữ ký -> chuyển GĐKD duyệt.

### 4. Xử lý treo phiếu
- Quá 24h không phản hồi hoặc có người từ chối -> Phiếu treo, GĐKD phân xử.
- Sửa phiếu = tạo mới và duyệt lại.

> **Guardrail:** Luồng Phiếu Hợp Tác không chặn luồng Đặt Cọc. Hoa hồng dự kiến chỉ hiện trên Dashboard sau khi đã duyệt.

## Diễn giải triển khai

- Phiếu hợp tác nên là bản ghi phiên bản hóa. Không sửa trực tiếp phiếu đã tạo/ký; mỗi lần thay đổi sinh ra một phiên bản mới và yêu cầu ký/duyệt lại.
- Danh sách người hỗ trợ cần được dựng từ lịch sử access/collaboration của KHTN, kể cả người đã mất quyền tại thời điểm tạo phiếu.
- Cần chốt rõ ý nghĩa “ký số”: có thể là xác nhận trong hệ thống có timestamp, người ký, phiên bản phiếu, hoặc tích hợp nhà cung cấp chữ ký số tùy mức pháp lý mong muốn.
- Dashboard chỉ hiển thị hoa hồng “dự kiến” khi trạng thái phiếu đã được GĐKD duyệt.
- Luồng cọc được độc lập để tránh việc tranh chấp hoa hồng làm chậm nghiệp vụ bán hàng.

---

# Module 5 - Kho Data (Databank)

**Mục tiêu:** Không Person nào “chết” trong tay một Sales; dữ liệu cũ liên tục được tái khai thác.

## Nội dung gốc

### 1. Đồng hồ bảo mật
- Chưa XĐ: 3 giờ.
- Quan Tâm: +1 ngày.
- Đồng ý gặp: +4 ngày.
- Hết hạn -> ra kho 1 lần.
- Sales gốc giữ KHTN nhưng mất quyền ưu tiên.

### 2. Chia song song
- Chỉ áp dụng với trạng thái **Chưa Xác Định**.
- Nếu 3 giờ không tiến: chia thêm 1 Sales song song, tối đa 2 người.

### 3. Cửa đóng kho vĩnh viễn
- Bất kỳ KHTN nào đạt trạng thái **Đặt Cọc** -> Person rút khỏi kho vĩnh viễn.
- Các KHTN đang chăm khác giữ nguyên.

### 4. Điều kiện duyệt kho
- Hạn mức: **2 Sale/ngày/Person**, **300 lần/tháng**.
- Ẩn SĐT + Dự án lúc lấy.
- Lấy xong mới hiện đủ thông tin.

> **Guardrail:** Chỉ lead MKT mới vào kho. Sales lấy KHTN từ kho không thấy cờ “Người khác đang chăm”.

## Diễn giải triển khai

- Kho cần lưu quan hệ giữa `Person`, các `KHTN`/cơ hội chăm sóc, thời điểm vào/ra kho và lý do.
- “Ra kho 1 lần” cần được thể hiện bằng trạng thái hoặc event độc lập để không tái kích hoạt sai rule.
- Khi chia song song, mỗi Sales cần có phạm vi quyền và log tương tác riêng để tránh ghi đè dữ liệu của nhau.
- Cơ chế ẩn SĐT và dự án trước khi lấy nên được enforce ở API/database, không chỉ ẩn trên giao diện.
- Hạn mức kho phải được kiểm tra theo lịch sử lấy kho đã xác nhận, có chống race condition khi nhiều người thao tác đồng thời.

---

# Module 6 - Quản Lý Dự Án

**Mục tiêu:** Dự án là “rễ” của toàn bộ hệ thống; mọi luồng đều xoay quanh rễ này.

## Nội dung gốc

### 1. Thực thể rễ
- Mọi Roster nhân sự, Tài liệu dự án, Chiến dịch Ads và Lead đổ về đều phải tham chiếu tới ID của Dự án.

### 2. Roster nhân sự
- GĐKD thiết lập danh sách Sales được phép bán dự án.
- Đây là điều kiện đầu tiên để lọt vào Auto-Routing.

### 3. Kho tài liệu tập trung
- Chứa bảng giá, chính sách.
- Sales thuộc Roster Dự Án mới được phép mở/tải tài liệu của dự án đó.

### 4. Map chiến dịch Ads
- Các Campaign phải được gắn vào Dự án.
- Hệ thống dựa vào UTM để tracking Lead về đúng luồng chia.

> **Guardrail:** Tải tài liệu bị chặn quyền cứng qua Middleware. Người không thuộc dự án tuyệt đối không lấy được Document.

## Diễn giải triển khai

- `project_id` nên là foreign key bắt buộc ở roster, document, campaign mapping và lead routing context.
- Roster nên có hiệu lực theo khoảng thời gian để hệ thống biết Sales đủ điều kiện tại thời điểm lead đi vào.
- Mapping UTM cần chuẩn hóa ít nhất `utm_source`, `utm_medium`, `utm_campaign`, có fallback khi thiếu UTM.
- Download document phải kiểm tra quyền ở backend/middleware và nên có audit log tải file.
- Khi một Sales rời roster, cần xác định rõ tác động đến lead đang chăm, quyền mở tài liệu và khả năng nhận lead mới.

---

# Module 7 - Quản Lý Team

**Mục tiêu:** Tổ chức hierarchy để cấp quyền Trưởng phòng và roll-up báo cáo KPI.

## Nội dung gốc

### 1. Khởi tạo cấu trúc
- Tạo danh sách Team trực thuộc Chi nhánh.
- Gán một nhân sự làm Trưởng Phòng (Team Leader).

### 2. Map nhân sự
- Gán các cá nhân Sales vào Team.
- Một Sales chỉ trực thuộc một Team duy nhất tại một thời điểm.

### 3. Phân quyền giám sát
- Trưởng phòng có quyền read-only toàn bộ KHTN của lính mình để đôn đốc, coaching và gỡ vướng.

### 4. Roll-up báo cáo
- Cộng dồn tự động dữ liệu: tổng lead, tổng cọc, doanh thu từ cấp cá nhân lên cấp Team trên Dashboard.

> **Guardrail:** Team chỉ để roll-up báo cáo. Lead luôn chia về cá nhân. Không được dùng `Team_ID` để định tuyến Auto-Routing.

## Diễn giải triển khai

- Team là cấu trúc quản trị/báo cáo, không phải đơn vị nhận lead.
- Cần quản lý lịch sử membership để KPI và người quản lý của một thời điểm không bị thay đổi khi Sales chuyển Team.
- Quyền read-only của Team Leader nên áp dụng theo phạm vi nhân sự cấp dưới và theo `project_id` nếu có ràng buộc dự án.
- Dashboard cần cho phép drill-down từ chi nhánh -> team -> cá nhân, đồng thời tôn trọng quyền xem dữ liệu.

---

# Module 8 - Tiền (Cọc -> Phí)

**Mục tiêu:** Không cần “nào rơi tự do” giữa các mốc; doanh thu được ghi nhận đúng nhịp.

## Nội dung gốc

### 1. Phiếu cọc & giỏ hàng
- Giỏ hàng sống tự ăn căn đã bán.
- Sales tạo Phiếu -> trạng thái KHTN chuyển **Đặt Cọc** ngay tại lúc gửi Admin.

### 2. Giao tiếp CĐT & Admin
- Admin nạp QTTT.
- Sales nộp UNC từng đợt -> Admin duyệt.
- Hệ thống nhắc lịch trước khi ký TTC.

### 3. Pipeline phí môi giới
Ba trạng thái:

`Đủ Điều Kiện -> Đã Gửi Hồ Sơ -> Tiền Đã Về`

- Doanh thu = Căn cọc thành công x phí dự kiến.

### 4. Xử lý bể cọc
- Bể trước TTC: tụt 1 mức nhiệt.
- Đã phát sinh phí (>= 1 đợt tiền về): KHTN giữ nguyên trạng thái Đặt Cọc.

> **Guardrail:** CRM xuất đúng một đầu ra cho kế toán: **“Căn + Đợt = Đủ Điều Kiện”**. CAPI không bao giờ bắn lùi khi rớt trạng thái.

## Diễn giải triển khai

- Cần phân tách dữ liệu: giỏ hàng/căn, phiếu cọc, lịch thanh toán, UNC, duyệt Admin, hồ sơ phí và doanh thu.
- Việc chuyển KHTN sang “Đặt Cọc” tại thời điểm gửi Admin là rule nghiệp vụ cần được log rõ vì nó kích hoạt nhiều luồng khác (Databank, state machine, CAPI...).
- Cần xác định đầy đủ “QTTT”, “TTC”, loại UNC, điều kiện duyệt từng đợt và ai có quyền duyệt.
- Đầu ra kế toán nên là một feed/bảng chuẩn có định danh căn, đợt, trạng thái đủ điều kiện, thời điểm chốt và số tiền.
- Với bể cọc, cần lưu lý do và mốc phát sinh phí để quyết định có giữ trạng thái Đặt Cọc hay không.

---

# Module 9 - Dữ Liệu Ngược (CAPI)

**Mục tiêu:** Vòng kín - chất lượng chăm sóc hôm nay quyết định chất lượng lead ngày mai.

## Nội dung gốc

### 1. Forward-only CAPI
- Bắn dữ liệu thẳng từ CRM về Meta theo `lead_id` gốc.
- Tụt trạng thái không bắn lùi.
- Bắn rồi thì thôi.

### 2. Mapping chuẩn xác
- Lead mới = `CompleteRegistration`.
- Gặp = `Schedule`.
- Cọc = `Purchase` (kèm giá trị).
- Not Lead = `BAD`.

### 3. Cửa thoát “Đóng”
- Khách đóng/không phù hợp -> không bắn Meta, vẫn là khách thật.
- Chỉ MKT duyệt Not Lead mới bắn BAD.

### 4. Chi phí & báo cáo
- Đồng bộ chi phí Ads, join với Lead qua `ad_id` để tính CAC/ROAS.
- Giám sát pipeline: cảnh báo nếu kẹt > 24h.

> **Guardrail:** Giữ nguyên 5 tên event tiêu chuẩn. Việc đổi tên sự kiện tùy tiện sẽ làm reset learning của Meta.

## Diễn giải triển khai

- Cần duy trì immutable external identifier (`lead_id` gốc) để gửi CAPI và đối soát.
- CAPI phải có outbox/event log chống gửi trùng: event type, payload hash, thời điểm gửi, response, retry count.
- “Forward-only” nên được enforce bằng rule chỉ cho phép event tiến về phía trước theo state/event mapping đã duyệt.
- Tài liệu hiện nêu 4 mapping cụ thể nhưng guardrail nói giữ 5 event tiêu chuẩn; khi triển khai cần xác nhận event thứ năm và naming convention chính xác với đội Marketing.
- Chi phí Ads nên đồng bộ theo ngày/campaign/ad set/ad và join với lead bằng `ad_id` hoặc mapping fallback đã chuẩn hóa.

---

# Module 10 - Phân Quyền (RLS)

**Mục tiêu:** Sale chỉ thấy những gì mình được nhận và tạo ra - tuyệt đối.

## Nội dung gốc

### 1. Sale (Kinh Doanh)
- Chỉ xem/sửa KHTN của mình.
- Điền và ký phiếu hợp tác.
- Không thấy KHTN của Sales khác.

### 2. Quản lý / GĐKD
- Xem KHTN team mình.
- Xem báo cáo doanh thu.
- Duyệt phiếu hợp tác.
- Điều phối kho databank.

### 3. Marketing / Ads
- Xem toàn bộ lead trước phễu.
- Duyệt đề xuất Not Lead.
- Xem báo cáo CAC/ROAS.
- Không can thiệp KHTN Sales.

### 4. Admin / Quản trị
- Admin: sửa danh mục, duyệt cọc, config PTTT.
- Quản trị hệ thống (IT): config phân quyền và schema.

> **Guardrail:** Áp dụng Row-Level Security (RLS) truy vấn DB. Audit log chỉ dành cho Quản trị và GĐKD theo dõi thao tác.

## Diễn giải triển khai

- RLS cần được áp dụng trực tiếp tại database hoặc lớp truy vấn trung tâm để không thể lộ dữ liệu qua API lỗi hay export.
- Quyền “xem/sửa KHTN của mình” cần làm rõ Owner hiện tại, quyền được mời hợp tác, quyền song song từ kho và quyền lịch sử sau khi thu hồi.
- Permission nên theo role + scope: role (Sales/MKT/Admin...) kết hợp phạm vi team, project, record owner và trạng thái.
- Audit log cần bất biến, bao gồm actor, action, bản ghi bị tác động, giá trị trước/sau (nếu phù hợp), timestamp, IP/session và lý do khi bắt buộc.

---

# Module 11 - State Machine

**Mục tiêu:** Quản trị vòng đời 6 trạng thái cốt lõi và kiểm soát rào cản/lách luật.

## Nội dung gốc

### 1. Vòng đời chính

`Chưa Xác Định -> Quan Tâm -> Đồng Ý Gặp -> Đã Gặp -> Booking -> Đặt Cọc`

### 2. Cửa thoát: Not Lead
- Lý do: số ảo, không nghe máy.
- Trạng thái khóa chờ MKT duyệt.
- Duyệt xong thành Not Lead vĩnh viễn.

### 3. Cửa thoát: Đóng Deal
- Lý do: không đủ tài chính/đã mua.
- Hiệu lực ngay.
- Person được gắn tag để MKT đưa vào tệp Broadcast.

### 4. Rào chống lách luật
- KHTN chưa từng có tương tác nào -> nút **“Đóng - Không Phù Hợp”** bị vô hiệu hóa; bắt buộc phải xử lý.

> **Guardrail:** Cửa thoát Đóng không xóa Person. Đóng 3 lần cùng lý do trong 1 chiến dịch -> cấm ra kho tiếp.

## Diễn giải triển khai

- State machine cần có bảng transition rõ ràng: trạng thái nguồn, trạng thái đích, role được phép chuyển, điều kiện, dữ liệu bắt buộc và side effect.
- “Đồng Ý Gặp” cần liên kết với điều kiện Form TTL1 tại Module 3.
- “Not Lead” là cửa thoát có phê duyệt MKT và có tác động đến CAPI (`BAD`); “Đóng Deal” khác Not Lead, không bắn BAD theo Module 9.
- Điều kiện “đã có tương tác” nên dựa trên record tương tác hợp lệ được lưu hệ thống, không dùng ghi chú tự do không có cấu trúc.
- Rule “đóng 3 lần cùng lý do trong 1 chiến dịch” nên có khóa xác định `Person + campaign + close_reason`; khi đạt ngưỡng cần chặn tái vào kho và lưu event rõ ràng.

---

# Luồng nghiệp vụ xuyên suốt đề xuất

## 1. Luồng Lead đến Sales

1. Nguồn Meta/Google/cá nhân/giới thiệu đi vào intake chung.
2. Hệ thống lưu Lead nguồn bất biến, gắn source/campaign/ad_id.
3. Chuẩn hóa SĐT và tìm Person cũ hoặc tạo Person mới.
4. Dựa theo dự án/campaign/UTM để xác định routing context.
5. Nếu là nguồn cá nhân/giới thiệu: giao thẳng Sales theo rule ngoại lệ.
6. Nếu là lead thông thường: lọc Roster -> check-in -> sẵn sàng -> hạn mức -> chia tới cá nhân Sales.
7. Tạo log offer; nếu 2 phút không phản hồi thì thu hồi và chuyển tiếp.
8. Ngoài khung 6h-18h, đưa queue ca đêm và gửi tin giữ ấm.

## 2. Luồng chăm sóc đến cọc

1. Sales tạo tương tác có cấu trúc và cập nhật nhiệt/vướng mắc.
2. Hệ thống gợi ý nhiệt, theo dõi decay sau 5 ngày không có tương tác.
3. Khi muốn chuyển sang Đồng Ý Gặp, kiểm tra Form TTL1 và bằng chứng.
4. Lead/KHTN tiến qua state machine đến Booking và Đặt Cọc.
5. Khi gửi Phiếu cọc cho Admin, KHTN chuyển sang Đặt Cọc.
6. Person được loại khỏi kho vĩnh viễn khi có KHTN Đặt Cọc.
7. Tạo Phiếu Hợp Tác để phân chia phần trăm và ký/duyệt hoa hồng.

## 3. Luồng dữ liệu marketing ngược

1. Lead mới phát sinh event `CompleteRegistration`.
2. Khi đạt mốc gặp, gửi `Schedule`.
3. Khi cọc, gửi `Purchase` cùng giá trị.
4. Khi MKT duyệt Not Lead, gửi `BAD`.
5. Không gửi event lùi khi trạng thái giảm/đóng.
6. Join chi phí Ads với `ad_id` để tính CAC/ROAS và cảnh báo pipeline kẹt quá 24 giờ.

---

# Danh sách rule cần chốt trước khi phát triển

Các điểm dưới đây xuất hiện trong blueprint nhưng cần xác nhận chi tiết để developer có thể code không mơ hồ:

1. **KHTN là gì** và mô hình dữ liệu quan hệ giữa `Lead`, `Person`, `KHTN`, `Deal`.
2. Khóa chính xác để **gộp Google 1 Lead/ngày**.
3. Cấu hình ngưỡng **KHTN Chưa XĐ vượt trần** của Module 2.
4. Tiêu chí nào được xem là **tương tác hợp lệ**.
5. Định nghĩa 3 mức kênh trong ghi chú: **Đắt / Đồng / Áp Suất**.
6. Danh mục nhiệt, công thức đề xuất nhiệt và điều kiện rớt nhiệt.
7. Chi tiết 5 nhóm dữ liệu và bằng chứng của **Form TTL1**.
8. Quy tắc tạo/list người hỗ trợ trong **Phiếu Hợp Tác**.
9. Ý nghĩa đầy đủ của **QTTT, PTTT, TTC** và quy trình xét duyệt UNC.
10. Event tiêu chuẩn thứ năm của CAPI vì tài liệu liệt kê 4 mapping nhưng guardrail yêu cầu 5 event.
11. Chính sách retry khi Meta CAPI hoặc đồng bộ chi phí Ads lỗi.
12. Chi tiết rule “đóng 3 lần cùng lý do trong 1 chiến dịch” khi một Person có nhiều KHTN/lead.

---

# Phụ lục - Tóm tắt guardrail theo module

| Module | Nguyên tắc bắt buộc |
|---|---|
| Lead vào | Lead bất biến; không xóa/sửa dữ liệu gốc sau khi vào hệ thống. |
| Chia lead | Toàn bộ quyết định chia phải có log kiểm chứng. |
| Chăm sóc | Thiếu từ 2 nhóm TTL1 bị chặn chuyển giai đoạn. |
| Hợp tác | Phiếu hợp tác không chặn cọc; hoa hồng chỉ hiện sau duyệt. |
| Databank | Chỉ lead MKT vào kho; người lấy kho không thấy cờ người khác đang chăm. |
| Dự án | Chặn tải document bằng middleware đối với người ngoài dự án. |
| Team | Team chỉ roll-up báo cáo, không dùng Team_ID để routing. |
| Tiền | Kế toán chỉ nhận đầu ra “Căn + Đợt = Đủ Điều Kiện”; CAPI không bắn lùi. |
| CAPI | Giữ nguyên 5 tên event tiêu chuẩn; đổi tùy tiện có thể reset learning Meta. |
| RLS | Áp dụng RLS ở truy vấn DB; audit log giới hạn cho Quản trị/GĐKD. |
| State machine | Đóng không xóa Person; đóng 3 lần cùng lý do/campaign thì cấm ra kho tiếp. |
