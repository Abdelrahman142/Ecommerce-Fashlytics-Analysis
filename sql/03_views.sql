-- ===========================================================================
-- 03_views.sql — Analytics layer: reusable dashboard views
--
-- Backed by the Phase 5 star schema (fact_products + conformed dimensions).
-- Applied by: scripts/db_init.sh (and idempotent via CREATE OR REPLACE).
--
-- Conventions:
--   * "Unknown" reference rows (id 0) are KEPT so that counts reconcile with
--     fact_products. Dashboard queries may filter them (brand_id <> 0 etc.).
--   * Ratings are averaged only over products that carry a rating
--     (has_rating); rated_product counts are exposed alongside.
--   * A single snapshot is available (Oct/Nov 2021), so there is NO time
--     series / price-history support. All metrics are point-in-time.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Base conformed product view: one row per product, fully denormalized.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW fashion.vw_product AS
SELECT
    f.product_id,
    p.title,
    p.description,
    b.brand_id,
    b.brand_name,
    c.category_id,
    c.category,
    c.sub_category,
    g.gender_id,
    g.gender,
    s.seller_id,
    s.seller_name,
    f.snapshot_date,
    f.mrp,
    f.selling_price,
    f.discount_pct,
    f.effective_discount_pct,
    f.avg_rating,
    f.rating_bucket,
    f.price_band,
    f.is_out_of_stock,
    f.any_out_of_stock,
    f.has_rating,
    f.image_count,
    f.n_attributes,
    f.n_listings,
    f.min_selling_price,
    f.max_selling_price
FROM fashion.fact_products f
JOIN fashion.dim_product  p ON p.product_id = f.product_id
JOIN fashion.dim_brand    b ON b.brand_id  = f.brand_id
JOIN fashion.dim_category c ON c.category_id = f.category_id
JOIN fashion.dim_gender   g ON g.gender_id = f.gender_id
JOIN fashion.dim_seller   s ON s.seller_id = f.seller_id;

-- ---------------------------------------------------------------------------
-- Overall catalog KPIs (single row: total / avg / median / min / max).
-- "total_brands" and "total_sellers" exclude the id-0 Unknown bucket; the
-- count of products with no brand is reported separately.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW fashion.vw_catalog_summary AS
SELECT
    COUNT(*)                                          AS total_products,
    COUNT(DISTINCT brand_id) FILTER (WHERE brand_id <> 0) AS total_brands,
    COUNT(*) FILTER (WHERE brand_id = 0)              AS products_without_brand,
    COUNT(DISTINCT category)                          AS total_categories,
    COUNT(DISTINCT category_id)                       AS total_sub_categories,
    COUNT(DISTINCT seller_id) FILTER (WHERE seller_id <> 0) AS total_sellers,
    COUNT(DISTINCT gender)                            AS total_genders,
    COUNT(*) FILTER (WHERE has_rating)                AS rated_products,
    ROUND(AVG(selling_price), 2)                      AS avg_selling_price,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY selling_price)::numeric, 2)
                                                      AS median_selling_price,
    MIN(selling_price)                                AS min_selling_price,
    MAX(selling_price)                                AS max_selling_price,
    ROUND(AVG(mrp), 2)                                AS avg_mrp,
    ROUND(AVG(discount_pct), 1)                       AS avg_discount_pct,
    ROUND(AVG(effective_discount_pct), 1)             AS avg_effective_discount_pct,
    ROUND(AVG(avg_rating) FILTER (WHERE has_rating), 2) AS avg_rating,
    ROUND(100.0 * COUNT(*) FILTER (WHERE is_out_of_stock) / COUNT(*), 2)
                                                      AS out_of_stock_pct
FROM fashion.vw_product;

-- ---------------------------------------------------------------------------
-- Catalog composition
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW fashion.vw_products_by_category AS
SELECT category_id, category, sub_category,
       COUNT(*)                                  AS n_products,
       ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) AS pct
FROM fashion.vw_product
GROUP BY category_id, category, sub_category;

CREATE OR REPLACE VIEW fashion.vw_products_by_brand AS
SELECT brand_id, brand_name,
       COUNT(*)                                  AS n_products,
       ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) AS pct
FROM fashion.vw_product
GROUP BY brand_id, brand_name;

CREATE OR REPLACE VIEW fashion.vw_products_by_gender AS
SELECT gender_id, gender,
       COUNT(*)                                  AS n_products,
       ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) AS pct
FROM fashion.vw_product
GROUP BY gender_id, gender;

-- ---------------------------------------------------------------------------
-- Pricing
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW fashion.vw_price_by_category AS
SELECT category_id, category, sub_category,
       COUNT(*)                                              AS n_products,
       ROUND(AVG(selling_price), 2)                          AS avg_selling_price,
       ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY selling_price)::numeric, 2)
                                                             AS median_selling_price,
       MIN(selling_price)                                    AS min_price,
       MAX(selling_price)                                    AS max_price,
       ROUND(AVG(mrp), 2)                                    AS avg_mrp,
       ROUND(AVG(effective_discount_pct), 1)                 AS avg_effective_discount_pct
FROM fashion.vw_product
GROUP BY category_id, category, sub_category;

CREATE OR REPLACE VIEW fashion.vw_price_by_brand AS
SELECT brand_id, brand_name,
       COUNT(*)                                              AS n_products,
       ROUND(AVG(selling_price), 2)                          AS avg_selling_price,
       ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY selling_price)::numeric, 2)
                                                             AS median_selling_price,
       MIN(selling_price)                                    AS min_price,
       MAX(selling_price)                                    AS max_price,
       ROUND(AVG(mrp), 2)                                    AS avg_mrp,
       ROUND(AVG(effective_discount_pct), 1)                 AS avg_effective_discount_pct
FROM fashion.vw_product
GROUP BY brand_id, brand_name;

-- ---------------------------------------------------------------------------
-- Ratings (only products with a rating contribute to the average)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW fashion.vw_rating_by_category AS
SELECT category_id, category, sub_category,
       COUNT(*) FILTER (WHERE has_rating)        AS rated_products,
       ROUND(AVG(avg_rating) FILTER (WHERE has_rating), 2) AS avg_rating,
       ROUND(AVG(avg_rating), 2)                 AS avg_rating_incl_unrated
FROM fashion.vw_product
GROUP BY category_id, category, sub_category;

CREATE OR REPLACE VIEW fashion.vw_rating_by_brand AS
SELECT brand_id, brand_name,
       COUNT(*) FILTER (WHERE has_rating)        AS rated_products,
       ROUND(AVG(avg_rating) FILTER (WHERE has_rating), 2) AS avg_rating
FROM fashion.vw_product
GROUP BY brand_id, brand_name;

-- ---------------------------------------------------------------------------
-- Product ranking lists
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW fashion.vw_top_rated_products AS
SELECT product_id, title, brand_name, category, sub_category, gender,
       avg_rating, selling_price, rating_bucket
FROM fashion.vw_product
WHERE has_rating
ORDER BY avg_rating DESC, selling_price DESC;

CREATE OR REPLACE VIEW fashion.vw_most_expensive_products AS
SELECT product_id, title, brand_name, category, sub_category, gender,
       selling_price, mrp, effective_discount_pct
FROM fashion.vw_product
ORDER BY selling_price DESC NULLS LAST;

CREATE OR REPLACE VIEW fashion.vw_most_discounted_products AS
SELECT product_id, title, brand_name, category, sub_category,
       effective_discount_pct, discount_pct, selling_price, mrp
FROM fashion.vw_product
WHERE effective_discount_pct IS NOT NULL
ORDER BY effective_discount_pct DESC;

-- ---------------------------------------------------------------------------
-- Brand x category matrix (drill-down: which brand leads which category)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW fashion.vw_brand_category_matrix AS
SELECT brand_id, brand_name, category, sub_category, COUNT(*) AS n_products
FROM fashion.vw_product
WHERE brand_id <> 0
GROUP BY brand_id, brand_name, category, sub_category;

-- ---------------------------------------------------------------------------
-- Availability (supported: out-of-stock flags only; no stock quantities)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW fashion.vw_out_of_stock_by_brand AS
SELECT brand_id, brand_name,
       COUNT(*)                                                          AS n_products,
       COUNT(*) FILTER (WHERE is_out_of_stock)                           AS out_of_stock,
       ROUND(100.0 * COUNT(*) FILTER (WHERE is_out_of_stock) / COUNT(*), 2) AS out_of_stock_pct
FROM fashion.vw_product
WHERE brand_id <> 0
GROUP BY brand_id, brand_name;

CREATE OR REPLACE VIEW fashion.vw_out_of_stock_by_category AS
SELECT category_id, category, sub_category,
       COUNT(*)                                                          AS n_products,
       COUNT(*) FILTER (WHERE is_out_of_stock)                           AS out_of_stock,
       ROUND(100.0 * COUNT(*) FILTER (WHERE is_out_of_stock) / COUNT(*), 2) AS out_of_stock_pct
FROM fashion.vw_product
GROUP BY category_id, category, sub_category;
