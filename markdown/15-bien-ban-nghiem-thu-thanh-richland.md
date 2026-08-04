# BIÊN BẢN NGHIỆM THU & BÀN GIAO CHỨC NĂNG HỆ THỐNG CRM RICH LAND

- **Dự án**: Hệ thống CRM & Tự động hóa Phân phối Dữ liệu (RICH LAND CRM)
- **Đơn vị Phát triển (Bên giao - Bên A)**: Lập trình viên Thanh (Developer Thanh)
- **Đơn vị Thụ hưởng (Bên nhận - Bên B)**: Công ty Bất động sản RichLand (RichLand Real Estate)
- **Thời gian lập**: Ngày 28 tháng 07 năm 2026
- **Tài liệu tham chiếu**: Tài liệu đặc tả nghiệp vụ hệ thống CRM Rich Land từ Luồng 1 đến Luồng 7, Phân quyền hệ thống, Trợ lý ảo AI và Trung tâm điều khiển thông báo.

---

## 1. THÔNG TIN CHUNG & QUY TRÌNH NGHIỆM THU

### 1.1 Mục đích biên bản
Biên bản này được lập ra nhằm mục đích đối soát, kiểm thử nghiệm thu người dùng (UAT) và bàn giao toàn bộ các module chức năng của hệ thống CRM Rich Land giữa **Bên A (Thanh)** và **Bên B (RichLand)**. Biên bản liệt kê đầy đủ tất cả các chức năng con, kịch bản kiểm thử và kết quả mong đợi tương ứng với các luật nghiệp vụ đã được thống nhất bằng ngôn ngữ nghiệp vụ thuần túy.

### 1.2 Kết quả tự kiểm thử của hệ thống
Hệ thống đã được lập trình viên tự kiểm thử (Self-Test) toàn bộ các chức năng nội bộ. Các mục kiểm thử đã được đánh dấu cụ thể:
- **ĐẠT**: Các chức năng đã hoạt động đúng thiết kế nghiệp vụ và đã qua kiểm thử thành công.
- **CHƯA TEST**: Các chức năng liên quan đến tích hợp bên ngoài chưa có môi trường thực tế (như hệ thống Conversion API quảng cáo) hoặc cần tài liệu doanh nghiệp thực tế để kết nối (Zalo OA Doanh nghiệp).

### 1.3 Tiêu chí chấp nhận (Pass Criteria) chung
1. **Chức năng**: Đáp ứng đúng 100% mô tả nghiệp vụ và các quy tắc đặc thù (như quy tắc Bể cọc, gửi tín hiệu chuyển đổi một chiều, bảo mật phân quyền).
2. **Hiệu năng**: Các thao tác cơ bản phản hồi nhanh chóng, các trang báo cáo tổng hợp dữ liệu tải mượt mà dưới 10 giây.
3. **Bảo mật**: Cơ chế bảo mật thông tin hoạt động ổn định, tuyệt đối không lộ chéo thông tin khách hàng giữa các chuyên viên tư vấn khác nhóm hoặc không được phân quyền.

---

## 2. BẢNG NGHIỆM THU CHỨC NĂNG CHI TIẾT THEO MODULE

### MODULE 1: TIẾP NHẬN KHÁCH HÀNG MỚI (LEAD INGESTION)
*Tài liệu tham chiếu:* Luồng 1 — Tiếp nhận Lead Vào

| STT | Chức năng con / Luật nghiệp vụ | Kịch bản kiểm thử (Test Scenario) | Kết quả mong đợi (Pass Criteria) | Trạng thái | Ghi chú / Người ký |
|---|---|---|---|---|---|
| **1.1** | Tiếp nhận một cửa tập trung | Gửi thông tin đăng ký thử nghiệm từ các nguồn quảng cáo (Facebook Ads, Google LP, Công cụ quét số điện thoại). | Hệ thống tiếp nhận tập trung tại một cổng xử lý duy nhất, chuẩn hóa định dạng thông tin trước khi ghi nhận vào CRM. | **ĐẠT** | Đã test qua API mock |
| **1.2** | Ghi nhận nguồn khách hàng | Gửi thông tin khách hàng mới từ một chiến dịch quảng cáo Facebook cụ thể. | Khách hàng được tự động ghi nhận đầy đủ: tên nguồn, tên chiến dịch quảng cáo, tên dự án quan tâm và thời gian đăng ký. | **ĐẠT** | |
| **1.3** | Dữ liệu gốc bất biến | Thử gửi yêu cầu cập nhật thông tin đăng ký ban đầu của khách hàng đã lưu trên hệ thống. | Hệ thống từ chối cập nhật hoặc xóa dữ liệu đăng ký gốc. Mọi thông tin thay đổi sau này chỉ được lưu trong hồ sơ chăm sóc. | **ĐẠT** | |
| **1.4** | Nối hồ sơ theo số điện thoại | Gửi liên tiếp 2 yêu cầu đăng ký có cùng một Số điện thoại của cùng một khách hàng. | Hệ thống chỉ tạo duy nhất 1 Hồ sơ khách hàng gốc nhưng lưu nhận cả 2 yêu cầu đăng ký tương ứng dưới dạng các cơ hội chăm sóc khác nhau. | **ĐẠT** | |
| **1.5** | Gộp khách đăng ký từ Google | Gửi liên tiếp 3 đăng ký từ Google có cùng số điện thoại và cùng dự án trong cùng một ngày. | Hệ thống tự động gộp thành 1 cơ hội chăm sóc duy nhất trong ngày, lưu kèm đầy đủ thông tin các biểu mẫu đã điền. | **ĐẠT** | |
| **1.6** | Nhập bù khách hàng Marketing | Chuyên viên tư vấn thử thao tác nhập bù thông tin khách hàng từ các kênh quảng cáo của công ty. | Bị hệ thống chặn quyền. Chức năng nhập bù khách hàng Marketing chỉ dành cho bộ phận Marketing và Quản lý. | **ĐẠT** | |
| **1.7** | Khách hàng cá nhân (Khách tự kiếm) | Chuyên viên tư vấn tự nhập thông tin khách hàng do mình tự khai thác (nguồn riêng). | Hệ thống gán quyền sở hữu vĩnh viễn cho chuyên viên đó, không đưa vào vòng tự động chia lead và không tính chỉ số đánh giá chăm sóc bắt buộc. | **ĐẠT** | |
| **1.8** | Trùng số điện thoại Marketing | Chuyên viên tư vấn tự nhập khách riêng có số điện thoại trùng với một khách hàng Marketing đang được chăm sóc. | Hệ thống cho phép lưu thông tin để chuyên viên ghi chép, nhưng tự động gắn cờ cảnh báo trùng lặp gửi đến Quản lý và Marketing để phê duyệt. | **ĐẠT** | |
| **1.9** | Đối soát tự động mỗi sáng | Chạy quy trình đối soát tự động so sánh số lượng khách đăng ký báo cáo từ Facebook/Google với số lượng ghi nhận trên CRM. | Trả về kết quả khớp hoàn toàn hoặc gửi thông báo cảnh báo kèm danh sách chi tiết các khách hàng bị thiếu lệch. | **ĐẠT** | |
| **1.10** | Khách hàng từ chiến dịch gửi tin | Gửi tin nhắn hàng loạt đến khách hàng cũ và ghi nhận phản hồi quan tâm mới. | Hệ thống tạo cơ hội chăm sóc mới gắn liền với chiến dịch gửi tin mới, nối với hồ sơ khách hàng cũ và chuyển cho chuyên viên phụ trách. | **ĐẠT** | |
| **1.11** | Giới thiệu kế thừa nguồn gốc | Chuyên viên tư vấn nhập thông tin khách B được giới thiệu bởi khách A (khách A đến từ nguồn quảng cáo Marketing). | Khách B được ghi nhận nguồn "Được giới thiệu", doanh thu của khách B được tính cho bộ phận Marketing và có liên kết chỉ rõ do khách A giới thiệu. | **ĐẠT** | |

---

### MODULE 2: TỰ ĐỘNG PHÂN CHIA KHÁCH HÀNG (AUTO-ROUTING)
*Tài liệu tham chiếu:* Luồng 2 — Chia Lead

| STT | Chức năng con / Luật nghiệp vụ | Kịch bản kiểm thử (Test Scenario) | Kết quả mong đợi (Pass Criteria) | Trạng thái | Ghi chú / Người ký |
|---|---|---|---|---|---|
| **2.1** | Điều kiện xoay vòng nhận khách | Đổ khách hàng mới thuộc Dự án A vào hệ thống. | Khách hàng chỉ được chia cho chuyên viên tư vấn đáp ứng đủ: 1. Có tên trong danh sách bán Dự án A; 2. Đã điểm danh; 3. Đang sẵn sàng nhận khách; 4. Chưa vượt hạn mức nhận khách. | **ĐẠT** | |
| **2.2** | Chia khách hàng cho cá nhân | Kiểm tra kết quả phân phối tự động của hệ thống đối với một khách hàng mới. | Khách hàng được bàn giao trực tiếp cho một chuyên viên tư vấn cụ thể, tuyệt đối không bàn giao chung cho một nhóm. | **ĐẠT** | |
| **2.3** | Cơ chế chống ôm khách hàng | Cấp cho Chuyên viên A quá 5 khách hàng ở trạng thái "Chưa xác định" (chưa liên hệ). Đổ thêm khách mới vào. | Hệ thống tự động bỏ qua Chuyên viên A trong lượt chia tiếp theo cho đến khi Chuyên viên A thực hiện cập nhật tương tác cho các khách cũ. | **ĐẠT** | |
| **2.4** | Hạn mức nhận khách hàng tối đa | Hệ thống chia khách mới khi Chuyên viên B đã nhận đủ hạn mức quy định (ví dụ: tối đa 3 khách/giờ hoặc 300 khách/tháng). | Hệ thống tự động bỏ qua Chuyên viên B và chuyển lượt cho nhân sự tiếp theo. | **ĐẠT** | |
| **2.5** | Thu hồi tự động do không phản hồi | Phân phối khách hàng mới cho Chuyên viên C nhưng chuyên viên không bấm xác nhận nhận khách trong vòng 2 phút. | Hệ thống tự động thu hồi quyền chăm sóc khách hàng đó, chuyển cho chuyên viên tiếp theo và ghi nhận lịch sử quá hạn. | **ĐẠT** | |
| **2.6** | Chế độ trực đêm | Khách hàng mới đăng ký trong khung giờ từ 18h00 tối đến 06h00 sáng hôm sau. | Khách hàng được đưa vào hàng đợi chờ sáng, hệ thống tự động gửi tin nhắn chào mừng giữ ấm và tự động phân chia vào 06h00 sáng cho chuyên viên sẵn sàng sớm nhất. | **ĐẠT** | |
| **2.7** | Lịch sử phân chia khách hàng | Truy cập xem lịch sử phân phối của một khách hàng cụ thể. | Hệ thống hiển thị chi tiết mọi bước phân chia: khách hàng được đề xuất cho ai, thời gian nào, đồng ý nhận hay từ chối, lý do từ chối hoặc thu hồi. | **ĐẠT** | |

---

### MODULE 3: CHĂM SÓC KHÁCH HÀNG & PHÂN LOẠI NHIỆT ĐỘ (CARE & TEMPERATURE)
*Tài liệu tham chiếu:* Luồng 3 — Chăm Sóc & Nhiệt Độ

| STT | Chức năng con / Luật nghiệp vụ | Kịch bản kiểm thử (Test Scenario) | Kết quả mong đợi (Pass Criteria) | Trạng thái | Ghi chú / Người ký |
|---|---|---|---|---|---|
| **3.1** | Ghi chú tương tác có cấu trúc | Chuyên viên tư vấn tạo một ghi chú chăm sóc khách hàng mới. | Bắt buộc chọn đầy đủ: Kênh liên lạc (Điện thoại/Gặp trực tiếp/Nhắn tin), Thời lượng cuộc gọi, Cảm xúc của khách. Thiếu thông tin hệ thống báo lỗi không cho lưu. | **ĐẠT** | |
| **3.2** | Đề xuất nhiệt độ tương tác | Chuyên viên thực hiện cuộc gọi chất lượng dài hơn 5 phút với khách hàng. | Hệ thống tự động đề xuất mức nhiệt độ (ví dụ: Nóng) nhưng chuyên viên tư vấn được quyền tự chốt lại theo đánh giá thực tế (ví dụ: Ấm). Hệ thống lưu trữ cả hai thông tin này. | **ĐẠT** | |
| **3.3** | Tự động hạ nhiệt độ (Nguội lạnh) | Một khách hàng đang ở mức nhiệt độ Nóng nhưng không có hoạt động chăm sóc nào phát sinh trong 5 ngày tiếp theo. | Hệ thống tự động hạ nhiệt độ xuống 1 cấp (Nóng -> Ấm) và hiển thị cảnh báo cần tương tác lại. | **ĐẠT** | |
| **3.4** | Chặn chuyển trạng thái khi thiếu tiêu chuẩn chất lượng (Dưới 4/5 TTL1) | Thử chuyển trạng thái khách sang "Đồng ý gặp" (Than) khi chỉ điền dưới 4/5 nhóm tiêu chuẩn chất lượng (ví dụ: chỉ điền 1/5, 2/5 hoặc 3/5 nhóm thông tin). | Hệ thống chặn cứng thao tác chuyển đổi và hiển thị cảnh báo yêu cầu bổ sung tối thiểu 4/5 nhóm thông tin TTL1. | **ĐẠT** | Chặn cứng ở cả giao diện & API |
| **3.5** | Cho phép chuyển trạng thái khi đạt tiêu chuẩn chất lượng (Đạt từ 4/5 TTL1) | Điền đầy đủ từ 4/5 nhóm tiêu chuẩn chất lượng trở lên (ví dụ: điền 4/5 hoặc 5/5 nhóm thông tin) và thực hiện chuyển trạng thái khách sang "Đồng ý gặp". | Hệ thống chấp nhận thông tin và cho phép lưu trạng thái mới thành công. | **ĐẠT** | |
| **3.6** | Minh chứng khi đã gặp khách | Thử chuyển trạng thái khách hàng sang "Đã gặp" mà không tải lên ảnh chụp hoặc minh chứng gặp mặt thực tế. | Hệ thống chặn không cho lưu trạng thái mới. | **ĐẠT** | |
| **3.7** | Đề xuất kịch bản xử lý từ chối | Chuyên viên chọn thẻ vướng mắc của khách hàng (ví dụ: Khách chê giá cao). | Hệ thống tự động hiển thị gợi ý tài liệu, phương án so sánh giá từ sổ tay hỗ trợ bán hàng tương ứng. | **ĐẠT** | |

---

### MODULE 4: HỢP TÁC BÁN HÀNG & DUYỆT PHÍ (COLLABORATION)
*Tài liệu tham chiếu:* Luồng 4 — Hợp Tác Hoa Hồng

| STT | Chức năng con / Luật nghiệp vụ | Kịch bản kiểm thử (Test Scenario) | Kết quả mong đợi (Pass Criteria) | Trạng thái | Ghi chú / Người ký |
|---|---|---|---|---|---|
| **4.1** | Mời hỗ trợ và phân quyền bán | Chuyên viên A (chủ sở hữu khách) mời Chuyên viên B vào hỗ trợ chăm sóc một khách hàng. | Chuyên viên B xem được thông tin và được ghi chú chăm sóc, nhưng không có quyền tự chuyển đổi trạng thái giao dịch hoặc thay đổi thông tin căn hộ. | **ĐẠT** | |
| **4.2** | Tự động lập phiếu hợp tác | Tạo phiếu đặt cọc cho một khách hàng có lịch sử được hỗ trợ bởi nhiều chuyên viên tư vấn. | Hệ thống tự động lập Phiếu hợp tác, đưa tất cả chuyên viên từng tham gia hỗ trợ vào danh sách phân chia (kể cả những người đã bị thu hồi quyền xem trước đó). | **ĐẠT** | |
| **4.3** | Ràng buộc tỷ lệ chia hoa hồng | Chuyên viên A nhập tỷ lệ phân chia hoa hồng giữa các bên có tổng số khác 100% (ví dụ: 60% và 35%). | Hệ thống cảnh báo lỗi và chặn không cho lưu phiếu hợp tác. | **ĐẠT** | |
| **4.4** | Ký số xác nhận nội bộ | Các chuyên viên có tên trong danh sách tiến hành xác nhận đồng ý trên ứng dụng. | Trạng thái đồng ý hiển thị theo thời gian thực. Khi toàn bộ các chuyên viên đã bấm xác nhận, phiếu tự động chuyển lên cấp Quản lý phê duyệt. | **ĐẠT** | |
| **4.5** | Phê duyệt và khóa thông tin phí | Giám đốc Kinh doanh phê duyệt phiếu hợp tác đã ký đủ. | Phiếu chuyển sang trạng thái khóa cố định vĩnh viễn. Mọi hành động sửa đổi tỷ lệ phần trăm sau đó đều bị chặn cứng để đảm bảo tính minh bạch. | **ĐẠT** | |
| **4.6** | Xử lý trễ ký xác nhận quá 24h | Chuyên viên được mời không phản hồi hoặc bấm từ chối ký phiếu quá 24 giờ. | Phiếu tự động chuyển sang trạng thái "Bị treo" và gửi thông báo yêu cầu Giám đốc Kinh doanh trực tiếp phân xử. | **ĐẠT** | |
| **4.7** | Độc lập luồng giao dịch | Phiếu hợp tác phân chia hoa hồng đang bị treo hoặc chưa được ký duyệt. | Hệ thống không chặn luồng Đặt Cọc của khách hàng (giao dịch mua căn hộ của khách vẫn tiến triển bình thường). | **ĐẠT** | |

---

### MODULE 5: KHO DỮ LIỆU CHUNG TÁI KHAI THÁC (DATABANK)
*Tài liệu tham chiếu:* Luồng 5 — Kho Data

| STT | Chức năng con / Luật nghiệp vụ | Kịch bản kiểm thử (Test Scenario) | Kết quả mong đợi (Pass Criteria) | Trạng thái | Ghi chú / Người ký |
|---|---|---|---|---|---|
| **5.1** | Thu hồi quyền ưu tiên chăm sóc | Khách hàng được chia cho chuyên viên nhưng quá thời gian quy định không được cập nhật trạng thái (Chưa liên hệ: quá 3 giờ; Đang quan tâm: quá 1 ngày; Đã hẹn gặp: quá 4 ngày). | Hệ thống tự động thu hồi quyền ưu tiên của chuyên viên cũ và chuyển thông tin khách hàng ra Kho dữ liệu chung. | **ĐẠT** | |
| **5.2** | Rút khách hàng khỏi Kho chung | Khách hàng X tại Chuyên viên A tiến triển đạt trạng thái Đặt Cọc. | Hồ sơ khách hàng X tự động ẩn khỏi danh sách hiển thị trong Kho dữ liệu chung trên toàn hệ thống. | **ĐẠT** | |
| **5.3** | Phân chia chăm sóc song song | Khách hàng mới ở trạng thái Chưa xác định quá 3 giờ không được liên hệ. | Hệ thống chia thêm cho một chuyên viên thứ hai cùng chăm sóc song song (tối đa 2 chuyên viên) để tăng khả năng tiếp cận khách hàng. | **ĐẠT** | |
| **5.4** | Hạn mức lấy khách từ Kho chung | Chuyên viên cố gắng lấy khách hàng thứ 3 từ Kho dữ liệu chung trong cùng một ngày. | Hệ thống báo lỗi vượt hạn mức (giới hạn tối đa 2 khách/ngày hoặc 300 khách/tháng). | **ĐẠT** | |
| **5.5** | Bảo mật thông tin khi duyệt kho | Chuyên viên duyệt danh sách khách trong Kho dữ liệu chung để chọn lấy. | Số điện thoại và tên dự án gốc của khách hàng bị che mờ. Chỉ hiển thị đầy đủ sau khi chuyên viên bấm "Nhận khách" thành công. | **ĐẠT** | |
| **5.6** | Lọc nguồn khách ra Kho chung | Khách hàng nguồn cá nhân tự kiếm hoặc nguồn giới thiệu bị hết hạn tương tác chăm sóc. | Hệ thống không đẩy ra Kho dữ liệu chung. Chỉ có khách hàng từ nguồn quảng cáo Marketing của công ty mới được đẩy ra Kho chung. | **ĐẠT** | |

---

### MODULE 6: QUẢN LÝ DỰ ÁN & DANH SÁCH BANS HÀNG (PROJECTS)
*Tài liệu tham chiếu:* Luồng 6 — Quản Lý Dự Án

| STT | Chức năng con / Luật nghiệp vụ | Kịch bản kiểm thử (Test Scenario) | Kết quả mong đợi (Pass Criteria) | Trạng thái | Ghi chú / Người ký |
|---|---|---|---|---|---|
| **6.1** | Dự án là gốc thông tin | Kiểm tra mối liên kết của danh sách chuyên viên, tài liệu dự án, chiến dịch quảng cáo và khách hàng đổ về. | Mọi thông tin trên đều bắt buộc phải liên kết chính xác với một Dự án cụ thể. | **ĐẠT** | |
| **6.2** | Thiết lập danh sách bán dự án | Giám đốc Kinh doanh thêm Chuyên viên A vào danh sách được phép bán Dự án X. | Chuyên viên A đủ điều kiện lọt vào danh sách nhận phân phối khách hàng tự động của Dự án X. | **ĐẠT** | |
| **6.3** | Chặn tải tài liệu mật | Chuyên viên B không thuộc danh sách bán Dự án Y thử tải tài liệu bảng giá, chính sách của Dự án Y. | Hệ thống chặn quyền tải và thông báo không đủ thẩm quyền truy cập. | **ĐẠT** | Chặn qua Middleware kiểm tra roster |
| **6.4** | Nhận diện khách theo chiến dịch | Kiểm tra đường link quảng cáo khi khách hàng đăng ký quan tâm dự án. | Hệ thống tự động phân tích đường dẫn để ghi nhận đúng khách hàng về dự án tương ứng. | **ĐẠT** | |

---

### MODULE 7: TỔ CHỨC ĐỘI NHÓM & BÁO CÁO KPI (TEAMS)
*Tài liệu tham chiếu:* Luồng 7 — Quản Lý Team

| STT | Chức năng con / Luật nghiệp vụ | Kịch bản kiểm thử (Test Scenario) | Kết quả mong đợi (Pass Criteria) | Trạng thái | Ghi chú / Người ký |
|---|---|---|---|---|---|
| **7.1** | Khởi tạo sơ đồ tổ chức phòng ban | Cấu hình sơ đồ tổ chức gồm các chi nhánh, các phòng kinh doanh và gán Trưởng phòng phụ trách. | Sơ đồ phòng ban hiển thị chính xác theo đúng phân cấp quản lý. | **ĐẠT** | |
| **7.2** | Ràng buộc thành viên phòng ban | Thử xếp 1 chuyên viên kinh doanh trực thuộc đồng thời 2 phòng kinh doanh khác nhau. | Hệ thống chặn thao tác. Một nhân sự chỉ được thuộc về duy nhất 1 phòng ban tại một thời điểm. | **ĐẠT** | |
| **7.3** | Quyền giám sát của Trưởng phòng | Trưởng phòng truy cập xem hồ sơ khách hàng và lịch sử chăm sóc của các chuyên viên trực thuộc phòng mình. | Hệ thống hiển thị đầy đủ thông tin ở chế độ chỉ đọc để Trưởng phòng kiểm tra và đôn đốc. | **ĐẠT** | |
| **7.4** | Báo cáo cộng dồn KPI tự động | Xem biểu đồ báo cáo kết quả kinh doanh ở tài khoản Trưởng phòng và Giám đốc Kinh doanh. | Số liệu tổng số khách hàng, tổng số cọc và doanh thu được tự động cộng dồn từ cấp nhân viên lên cấp phòng và chi nhánh. | **ĐẠT** | |
| **7.5** | Độc lập việc phân chia khách hàng | Khách hàng mới đăng ký dự án do Phòng kinh doanh A đang tập trung triển khai. | Khách hàng được phân phối trực tiếp cho cá nhân chuyên viên đủ điều kiện, không phân chia cho đội nhóm. | **ĐẠT** | |

---

### MODULE 8: TIỀN CỌC & DUYỆT MINH CHỨNG GIAO DỊCH (DEPOSITS & FINANCE)
*Tài liệu tham chiếu:* Luồng 6 — Tiền (Cọc -> Phí)

| STT | Chức năng con / Luật nghiệp vụ | Kịch bản kiểm thử (Test Scenario) | Kết quả mong đợi (Pass Criteria) | Trạng thái | Ghi chú / Người ký |
|---|---|---|---|---|---|
| **8.1** | Khóa giỏ hàng tự động | Chuyên viên tạo phiếu cọc thành công cho căn hộ A trên hệ thống. | Căn hộ A chuyển sang trạng thái "Đã cọc" trên bảng hàng trực tuyến, khóa không cho chuyên viên khác tạo phiếu cọc trùng căn hộ đó. | **ĐẠT** | |
| **8.2** | Chuyển trạng thái khách đặt cọc | Chuyên viên hoàn tất gửi phiếu đặt cọc lên hệ thống chờ Quản lý phê duyệt. | Trạng thái khách hàng lập tức chuyển sang "Đặt cọc" để ghi nhận kịp thời và rút thông tin khách khỏi Kho dữ liệu chung. | **ĐẠT** | |
| **8.3** | Phê duyệt minh chứng thanh toán | Chuyên viên tải lên hình ảnh Ủy nhiệm chi (UNC) của đợt đóng tiền thứ 2. Kế toán/Admin tiến hành duyệt. | Đợt thanh toán được đánh dấu hoàn thành. Hệ thống tự động ghi nhận hóa đơn tương ứng cho đợt đóng tiền này. | **ĐẠT** | |
| **8.4** | **Hủy đặt cọc khi chưa có doanh thu** | Khách hàng hủy đặt cọc khi chưa được duyệt thanh toán bất kỳ đợt nào (mốc thực thu bằng 0). | 1. Trạng thái khách hàng hạ về mức trước đó (Đang đặt chỗ hoặc Đã gặp). <br>2. Đồng hồ bảo mật của khách hàng chạy lại. <br>3. Khách hàng được đưa lại ra Kho chung khi hết hạn. | **ĐẠT** | Revert về booking/đã gặp |
| **8.5** | **Hủy đặt cọc khi đã có doanh thu** | Khách hàng hủy đặt cọc nhưng đã đóng và được duyệt thành công đợt 1 (công ty đã thực thu phí). | Trạng thái khách hàng **được giữ nguyên là Đặt cọc** (do đã phát sinh dòng tiền thực tế, được xác nhận là Khách hàng thật sự). | **ĐẠT** | Giữ nguyên trạng thái |
| **8.6** | **Quy trình đổi căn hộ** | Khách hàng đổi sang căn hộ hoặc dự án giao dịch khác trước khi ký thỏa thuận. | 1. Đóng phiếu đặt cọc cũ (ghi nhận lý do đổi căn). <br>2. Tạo phiếu đặt cọc mới hoàn toàn cho mã căn mới. <br>3. Lưu vết liên kết mã giao dịch cũ tại phiếu cọc mới để đối soát. | **ĐẠT** | |
| **8.7** | Đầu ra đối chiếu kế toán tối giản | Xuất dữ liệu đối chiếu phí môi giới gửi bộ phận Kế toán. | Hệ thống chỉ xuất danh sách: "Căn hộ + Đợt đóng tiền = Đủ điều kiện", không hiển thị các thông tin quản trị nội bộ khác. | **ĐẠT** | |

---

### MODULE 9: TÍN HIỆU PHẢN HỒI QUẢNG CÁO (CONVERSION API)
*Tài liệu tham chiếu:* Luồng 7 — Dữ Liệu Ngược

| STT | Chức năng con / Luật nghiệp vụ | Kịch bản kiểm thử (Test Scenario) | Kết quả mong đợi (Pass Criteria) | Trạng thái | Ghi chú / Người ký |
|---|---|---|---|---|---|
| **9.1** | Gửi tín hiệu theo mã định danh gốc | Kiểm tra thông tin gửi ngược về hệ thống quảng cáo Facebook/Google khi khách chuyển trạng thái. | Sử dụng đúng mã định danh đăng ký ban đầu của khách hàng để đảm bảo tính chính xác cao nhất cho hệ thống tự học quảng cáo. | **CHƯA TEST** | Cần môi trường tài khoản Meta thật |
| **9.2** | **Gửi tín hiệu một chiều (Forward-only)** | Khách hàng hủy cọc hoặc bị hạ trạng thái chăm sóc từ Đặt cọc về Đã gặp. | Hệ thống **tuyệt đối không gửi** bất kỳ tín hiệu lùi hoặc sự kiện hoàn tiền nào về hệ thống quảng cáo để bảo toàn dữ liệu học máy. | **CHƯA TEST** | |
| **9.3** | Gửi sự kiện chuyển đổi tương ứng | Khách hàng chuyển trạng thái: Đăng ký mới -> Đã gặp -> Đặt cọc -> Báo sai số. | Hệ thống gửi các tín hiệu tương ứng: Đăng ký thành công -> Lên lịch gặp -> Mua hàng -> Khách ảo. | **CHƯA TEST** | |
| **9.4** | Bảo vệ tệp khách hàng đóng | Khách hàng bị chuyển sang trạng thái "Đóng deal" do không phù hợp tài chính. | Hệ thống không gửi tín hiệu báo xấu về Facebook (giữ nguyên chất lượng tệp học quảng cáo), chỉ gửi tín hiệu khách ảo khi Marketing duyệt. | **CHƯA TEST** | |
| **9.5** | Tính toán hiệu quả đầu tư quảng cáo | Chuyên viên xem báo cáo hiệu quả chi phí quảng cáo trên Dashboard. | Hệ thống tự động kết nối chi phí quảng cáo từ các kinh với danh sách khách hàng để tính ra chi phí trên mỗi khách hàng và hiệu quả doanh thu. | **CHƯA TEST** | |
| **9.6** | Cảnh báo nghẽn tín hiệu | Giả lập hệ thống quảng cáo Facebook bị gián đoạn kết nối quá 24 giờ. | Hệ thống gửi thông báo cảnh báo đỏ cho kỹ thuật vì tín hiệu bị tồn đọng chưa gửi đi được quá thời gian quy định. | **CHƯA TEST** | |

---

### MODULE 10: MA TRẬN BẢO MẬT & PHÂN QUYỀN TRUY CẬP
*Tài liệu tham chiếu:* Phân Quyền (Vai × Đối tượng × Hành động)

| STT | Chức năng con / Luật nghiệp vụ | Kịch bản kiểm thử (Test Scenario) | Kết quả mong đợi (Pass Criteria) | Trạng thái | Ghi chú / Người ký |
|---|---|---|---|---|---|
| **10.1** | Bảo mật thông tin khách hàng chéo | Chuyên viên A thử truy cập hoặc xem danh sách khách hàng thuộc sở hữu của Chuyên viên B. | Hệ thống chặn quyền truy cập hoặc hiển thị danh sách rỗng, không làm rò rỉ thông tin khách hàng. | **ĐẠT** | RLS chặn ở mức cơ sở dữ liệu |
| **10.2** | Quyền hạn bộ phận Marketing | Đăng nhập tài khoản Marketing để xem thông tin chăm sóc và thử thay đổi trạng thái khách. | Chỉ cho phép xem dữ liệu khách hàng để đánh giá chất lượng quảng cáo, chặn hoàn toàn quyền sửa đổi thông tin chăm sóc hoặc đổi trạng thái. | **ĐẠT** | |
| **10.3** | Quyền hạn Giám đốc Kinh doanh | Đăng nhập tài khoản Giám đốc để kiểm tra danh sách khách và duyệt phiếu hợp tác. | Xem được toàn bộ khách thuộc phòng ban/dự án mình phụ trách, thực hiện duyệt phiếu hợp tác và điều phối khách trong Kho dữ liệu chung. | **ĐẠT** | |
| **10.4** | Quyền hạn Admin dự án | Đăng nhập tài khoản Admin dự án để xem danh sách khách hàng đang được tư vấn ở bước đầu. | Hệ thống chặn quyền xem. Chỉ cho phép xem thông tin khách từ khi có giao dịch Đặt chỗ/Đặt cọc trở đi. | **ĐẠT** | |
| **10.5** | Phân tách quyền quản lý hệ thống | Người quản trị nghiệp vụ thử chỉnh sửa cấu trúc dữ liệu hoặc sửa thông tin kết nối các cổng phần mềm bên ngoài. | Bị hệ thống chặn quyền. Các thao tác can thiệp sâu vào cấu trúc phần mềm chỉ dành riêng cho tài khoản kỹ thuật hệ thống (IT). | **ĐẠT** | |
| **10.6** | Nhật ký bảo mật bất biến | Thực hiện thay đổi quyền truy cập của nhân sự hoặc xóa tài liệu hướng dẫn bán hàng. | Hệ thống tự động ghi nhật ký bảo mật: ai thực hiện, thời gian nào, hành động gì và không cho phép bất kỳ ai sửa xóa nhật ký này. | **ĐẠT** | |

---

### MODULE 11: VÒNG ĐỜI TRẠNG THÁI KHÁCH HÀNG & PHỄU CHUYỂN ĐỔI
*Tài liệu tham chiếu:* Luồng nghiệp vụ xuyên suốt đề xuất & Module 11

| STT | Chức năng con / Luật nghiệp vụ | Kịch bản kiểm thử (Test Scenario) | Kết quả mong đợi (Pass Criteria) | Trạng thái | Ghi chú / Người ký |
|---|---|---|---|---|---|
| **11.1** | Phễu trạng thái cốt lõi | Chuyển đổi trạng thái khách hàng theo hành trình tư vấn. | Khách hàng đi tuần tự qua: Chưa xác định -> Đang quan tâm -> Đồng ý gặp -> Đã gặp -> Đặt chỗ -> Đặt cọc. | **ĐẠT** | |
| **11.2** | Khách hàng ảo / Sai số | Chuyên viên chuyển khách sang trạng thái Báo sai số/không liên lạc được. | Trạng thái chuyển sang chờ duyệt. Khi bộ phận Marketing bấm duyệt, khách hàng chuyển thành khách ảo vĩnh viễn và gửi tín hiệu báo xấu về hệ thống quảng cáo. | **ĐẠT** | |
| **11.3** | Đóng hồ sơ do không phù hợp | Chuyên viên chuyển khách sang trạng thái Đóng hồ sơ (hết nhu cầu, không đủ tài chính). | Trạng thái có hiệu lực ngay lập tức. Hệ thống tự động lưu lý do đóng vào hồ sơ khách hàng để hỗ trợ các chiến dịch gửi tin tiếp cận lại sau này. | **ĐẠT** | |
| **11.4** | Chặn đóng hồ sơ nhanh | Khách hàng mới được chia, chưa có bất kỳ ghi chép cuộc gọi hoặc chăm sóc nào. Chuyên viên thử bấm Đóng hồ sơ. | Nút Đóng hồ sơ bị khóa, bắt buộc chuyên viên phải liên hệ và lưu lịch sử tương tác trước mới được phép đóng. | **ĐẠT** | |
| **11.5** | Chặn chuyển sang Đồng ý gặp khi thiếu chất lượng (Dưới 4/5 TTL1) | Khách hàng ở trạng thái Đang quan tâm, chuyên viên thử bấm chuyển sang "Đồng ý gặp" khi bộ câu hỏi chất lượng chưa điền đủ 4 trên 5 nhóm thông tin. | Hệ thống chặn cứng chuyển trạng thái, hiển thị thông báo lỗi yêu cầu hoàn thành tối thiểu 4/5 nhóm câu hỏi chất lượng. | **ĐẠT** | Tích hợp State Machine & TTL1 |
| **11.6** | Chặn tái khai thác khách hàng ảo | Một khách hàng bị đóng quá 3 lần với cùng một lý do trong cùng một dự án. | Hệ thống ghi nhận, không đưa khách hàng này ra lại Kho dữ liệu chung để tránh làm mất thời gian của các chuyên viên khác. | **ĐẠT** | |

---

### MODULE 12: TRỢ LÝ ẢO HỖ TRỢ BÁN HÀNG AI
*Tài liệu tham chiếu:* Logic AI RAG và Vector Search

| STT | Chức năng con / Luật nghiệp vụ | Kịch bản kiểm thử (Test Scenario) | Kết quả mong đợi (Pass Criteria) | Trạng thái | Ghi chú / Người ký |
|---|---|---|---|---|---|
| **12.1** | Học tài liệu bán hàng | Tải tệp tài liệu chính sách bán hàng hoặc tài liệu pháp lý của dự án mới lên màn hình Huấn luyện AI. | Trợ lý ảo AI tự động phân tích và học toàn bộ nội dung tài liệu thành công. | **ĐẠT** | |
| **12.2** | Trợ lý AI trả lời nghiệp vụ | Chuyên viên gửi câu hỏi chat hỏi về chính sách chiết khấu của dự án vừa cập nhật. | Trợ lý AI tự động trích lục thông tin từ tài liệu đã học để trả lời chính xác, nhanh chóng cho chuyên viên. | **ĐẠT** | |
| **12.3** | Tìm kiếm thông tin theo ngữ nghĩa | Gõ tìm kiếm các từ khóa liên quan đến điều kiện bàn giao nhà. | Hệ thống tự động trả về các đoạn tài liệu có nội dung liên quan mật thiết về ý nghĩa thay vì chỉ tìm khớp từ khóa thô. | **ĐẠT** | |

---

### MODULE 13: KÊNH THÔNG BÁO TỰ ĐỘNG & BOTS (COMMAND CENTER)
*Tài liệu tham chiếu:* Command Center Chatbot Webhooks

| STT | Chức năng con / Luật nghiệp vụ | Kịch bản kiểm thử (Test Scenario) | Kết quả mong đợi (Pass Criteria) | Trạng thái | Ghi chú / Người ký |
|---|---|---|---|---|---|
| **13.1** | Thông báo qua Zalo Bot | Hệ thống gửi tin nhắn thông báo riêng cho chuyên viên tư vấn khi có biến động khách hàng hoặc nhiệm vụ mới. | Tự động gửi tin nhắn trực tiếp qua Zalo Bot đến tài khoản Zalo cá nhân của chuyên viên tương ứng. | **CHƯA TEST** | Cần tài khoản Zalo doanh nghiệp để kết nối |
| **13.2** | Nhóm Zalo Group Admin | Phát sinh sự kiện báo cáo hoặc cảnh báo khẩn cấp cần gửi cho Ban quản trị. | Hệ thống tự động gửi tin nhắn báo cáo vào nhóm Zalo chung của các Quản trị viên (Admin). | **CHƯA TEST** | |
| **13.3** | Nhóm Telegram Bot | Gửi tin nhắn khẩn cấp, báo cáo doanh thu nhanh hoặc thông báo đi trễ vào nhóm Telegram. | Telegram Bot tự động gửi tin nhắn báo cáo định dạng trực quan vào nhóm Telegram chung của đội ngũ quản lý. | **ĐẠT** | Đã cấu hình và test trên group staging |
| **13.4** | Email thông báo qua Gmail | Phát sinh sự kiện duyệt yêu cầu thanh toán hoặc xác nhận đặt cọc thành công gửi cho Khách hàng và Chuyên viên. | Hệ thống tự động gửi thư điện tử thông báo chính xác đến hòm thư Gmail của khách hàng và chuyên viên tương ứng. | **ĐẠT** | |
| **13.5** | Chuông thông báo trên giao diện Web | Phát sinh sự kiện chia khách mới hoặc duyệt hồ sơ trên hệ thống. | Icon chuông thông báo ở góc màn hình Web hiển thị số đỏ thông báo mới và tự động cập nhật nội dung thời gian thực. | **ĐẠT** | |
| **13.6** | Cổng tiếp nhận Webhook hệ thống | Khách hàng phản hồi hoặc tương tác qua các kênh chatbot Zalo, Telegram. | Webhook Center tiếp nhận tín hiệu lập tức, tự động lưu thông tin phản hồi vào ghi chú chăm sóc khách hàng tương ứng. | **ĐẠT** | |

---

## 3. Ý KIẾN CỦA CÁC BÊN & KÝ XÁC NHẬN

*Biên bản này được lập thành 02 (hai) bản có giá trị pháp lý như nhau, mỗi bên giữ 01 (một) bản để làm căn cứ thực hiện các bước tiếp theo của dự án.*

### BÊN GIAO (BÊN A)
*Lập trình viên phát triển hệ thống*

*(Ký và ghi rõ họ tên)*
<br><br><br>
**Lê Văn Thanh**

<br>

### BÊN NHẬN (BÊN B)
*Đại diện Công ty Bất động sản RichLand*

*(Ký và ghi rõ họ tên)*
<br><br><br>
**Đại diện RichLand**
