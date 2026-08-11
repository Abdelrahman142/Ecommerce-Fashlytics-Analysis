-- ===========================================================================
-- 01_indexes.sql — indexes for the fashion star schema
--
-- PKs (product_id, brand_id, ...) are auto-indexed by PostgreSQL. These
-- additional indexes target the FK join patterns and the Phase 2 business
-- queries (price bands, ratings, availability, category/brand filters).
-- ===========================================================================

-- Fact FK join indexes (every foreign key column used as a filter/dimension key)
CREATE INDEX idx_fact_brand_id      ON fashion.fact_products (brand_id);
CREATE INDEX idx_fact_category_id   ON fashion.fact_products (category_id);
CREATE INDEX idx_fact_gender_id     ON fashion.fact_products (gender_id);
CREATE INDEX idx_fact_seller_id     ON fashion.fact_products (seller_id);

-- Fact query-pattern indexes
CREATE INDEX idx_fact_snapshot_date ON fashion.fact_products (snapshot_date);
CREATE INDEX idx_fact_price_band    ON fashion.fact_products (price_band);
CREATE INDEX idx_fact_rating_bucket ON fashion.fact_products (rating_bucket);
CREATE INDEX idx_fact_out_of_stock  ON fashion.fact_products (is_out_of_stock);
CREATE INDEX idx_fact_selling_price ON fashion.fact_products (selling_price);
CREATE INDEX idx_fact_avg_rating    ON fashion.fact_products (avg_rating);

-- Product dimension conformed-dim joins + attribute filters
CREATE INDEX idx_product_brand_id    ON fashion.dim_product (brand_id);
CREATE INDEX idx_product_category_id ON fashion.dim_product (category_id);
CREATE INDEX idx_product_gender_id   ON fashion.dim_product (gender_id);
CREATE INDEX idx_product_seller_id   ON fashion.dim_product (seller_id);
CREATE INDEX idx_product_listing_ids ON fashion.dim_product USING GIN (listing_ids);

-- Auxiliary attribute table
CREATE INDEX idx_attr_key ON fashion.product_attributes (attr_key);
