# LUỒNG 8 — HỆ THỐNG AI TRAINING & VECTOR RAG

> Trạng thái: ✅ Đã duyệt và chốt thiết kế
> Đọc kèm: `00-MUC-LUC-va-TU-DIEN.md` + `backend/utils/rag_helpers.php`

---

## LỚP 1 — ẢNH CHỤP NHANH

Luồng xử lý tri thức dự án và truy vấn ngữ nghĩa phục vụ chấm điểm, phân loại Lead thông minh (AI Screening):

```
Tài liệu dự án (PDF/Web) ──→ Trích xuất & Cắt nhỏ (Chunking) ──→ Gọi Embeddings API ──→ Lưu CSDL (ai_vector_cache)
                                                                                               │
Lead mới đổ về ──────────→ Embeddings câu hỏi/ghi chú ───────→ Cosine Similarity ◄─────────────┘
                                                                 │
                                                                 ▼
                                                    Truy xuất Tri thức & Phân loại
```

* **Vai tham gia:** Quản trị viên (nạp tri thức, quản lý tài liệu) · Hệ thống AI Sàng lọc (tự động xử lý, đối khớp ngữ nghĩa).
* **Đường đi:** Nạp tài liệu -> Chunking -> Embeddings -> Vector Search -> Trích xuất ngữ cảnh -> Phản hồi & Phân loại lead.
* **Đích cuối:** AI tự động phân loại chính xác lead rác/spam, lead thiện chí dựa trên tri thức dự án thực tế với độ trễ phản hồi <3 giây.

---

## LỚP 2 — LUẬT ĐÃ CHỐT

### [A] Cơ chế nạp & Xử lý văn bản (Chunking)

| # | Luật | TT |
|---|---|---|
| 12.1 | **Trích xuất PDF qua Gemini**: Sử dụng API `gemini-2.5-flash` để trích xuất văn bản thô từ tệp PDF dạng base64. Yêu cầu mô hình trả về dữ liệu tiếng Việt đầy đủ nhất, không tự ý bình luận hoặc tóm tắt. | ✅ |
| 12.2 | **Bóc tách nội dung Web**: Khi nạp tri thức từ URL, hệ thống tự động loại bỏ các thẻ `<script>`, `<style>`, HTML tags, và chuẩn hóa khoảng trắng để giữ lại nội dung văn bản sạch nhất. | ✅ |
| 12.3 | **Thuật toán cắt nhỏ (Sentence-Boundary Chunking)**: Tài liệu được chia nhỏ thành các đoạn (chunk) với kích thước mặc định 700 ký tự và độ gối đầu (overlap) 150 ký tự. Hệ thống tự động dò tìm dấu câu (`.`, `!`, `?`, `\n`) ở vùng overlap để cắt đoạn tự nhiên, tránh bị ngắt nửa câu. | ✅ |

### [B] Cơ chế Vector Embeddings & Caching

| # | Luật | TT |
|---|---|---|
| 12.4 | **Mô hình Embeddings**: Sử dụng `gemini-embedding-001` (endpoint v1beta) để tạo vector đặc trưng cho từng đoạn tri thức. | ✅ |
| 12.5 | **Cơ chế dự phòng (Fallback)**: Nếu mô hình chính gặp lỗi hoặc hết hạn mức, hệ thống tự động chuyển sang mô hình dự phòng `embedding-001`. | ✅ |
| 12.6 | **Bộ đệm Vector cục bộ (Vector Cache)**: Lưu trữ các vector đã tạo vào bảng `ai_vector_cache` bằng khóa MD5 hash của văn bản. Mọi lượt yêu cầu embedding tiếp theo phải tra cứu cache trước để tránh gọi API trùng lặp, tối ưu chi phí và tăng tốc độ xử lý. | ✅ |
| 12.7 | **Tính toán tương đồng (Cosine Similarity)**: Thực hiện tính toán độ tương đồng Cosine giữa vector câu hỏi/lead mới với các vector tri thức ngay trong PHP để có tốc độ truy xuất nhanh nhất mà không phụ thuộc vào cơ sở dữ liệu Vector ngoài. | ✅ |

### [C] Giao diện huấn luyện (AI Training UI)

| # | Luật | TT |
|---|---|---|
| 12.8 | **Quản trị tri thức tập trung**: Trang `<AITrainingPanel>` cung cấp bảng quản lý danh sách tài liệu, trạng thái nạp (Đang xử lý, Thành công, Lỗi), độ tự tin phân loại, và cho phép kiểm thử trực tiếp truy vấn ngữ nghĩa. | ✅ |

---

## LỚP 3 — VÌ SAO

* **Lý do tự tính Cosine Similarity trong PHP**: Với quy mô tri thức của dự án bất động sản (tầm vài nghìn chunks), việc sử dụng thuật toán Cosine trực tiếp bằng PHP giúp giảm thiểu chi phí tích hợp và vận hành một Vector Database chuyên dụng (như Pinecone/Milvus), đạt tốc độ phản hồi chớp mắt (<50ms đối khớp).
* **Lý do dùng Sentence-Boundary Chunking**: Việc cắt cứng ký tự thường làm mất ngữ cảnh ở ranh giới các đoạn. Việc dò tìm dấu câu giúp giữ nguyên ý nghĩa của các điều khoản hoặc thông tin giá bán căn hộ.

---

## LỚP 4 — CÒN MỞ

* 🔴 Tự động cập nhật lại vector khi tài liệu Google Sheets nguồn thay đổi thông tin dự án.
* 🟡 Nâng cấp lên thuật toán tìm kiếm kết hợp (Hybrid Search: BM25 + Vector Search) để tối ưu độ chính xác cho các từ khóa số phòng/mã căn.
