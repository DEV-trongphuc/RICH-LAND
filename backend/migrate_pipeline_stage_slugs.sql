ALTER TABLE pipeline_stages ADD COLUMN system_slug VARCHAR(50) DEFAULT NULL;

UPDATE pipeline_stages SET system_slug = 'chua_xac_dinh' WHERE order_index = 0 OR name LIKE '%Chưa xác định%';
UPDATE pipeline_stages SET system_slug = 'quan_tam' WHERE order_index = 1 OR name LIKE '%Quan tâm%';
UPDATE pipeline_stages SET system_slug = 'dong_y_gap' WHERE order_index = 2 OR name LIKE '%Đồng ý gặp%';
UPDATE pipeline_stages SET system_slug = 'da_gap' WHERE order_index = 3 OR name LIKE '%Đã gặp%';
UPDATE pipeline_stages SET system_slug = 'booking' WHERE order_index = 4 OR name LIKE '%Booking%';
UPDATE pipeline_stages SET system_slug = 'dat_coc' WHERE order_index = 5 OR name LIKE '%Đặt cọc%';
UPDATE pipeline_stages SET system_slug = 'dong_deal' WHERE order_index = 6 OR name LIKE '%Đóng deal%';
