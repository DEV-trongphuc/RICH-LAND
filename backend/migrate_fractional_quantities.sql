ALTER TABLE products MODIFY stock_quantity decimal(15,4) NOT NULL DEFAULT 0.0000;
ALTER TABLE batches MODIFY initial_qty decimal(15,4) NOT NULL DEFAULT 0.0000;
ALTER TABLE batches MODIFY current_qty decimal(15,4) NOT NULL DEFAULT 0.0000;
ALTER TABLE inventory_logs MODIFY qty_change decimal(15,4) NOT NULL;
ALTER TABLE purchase_order_items MODIFY quantity decimal(15,4) NOT NULL;
