-- ===========================================================================
-- 04_dashboard_metrics.sql — Phase 6 business metrics for the dashboard
--
-- Every metric below is answerable from the actual dataset. Metrics the data
-- CANNOT support are intentionally absent:
--
--   UNSUPPORTED (documented in docs/data_profile.md):
--     * rating counts / review text      (only avg_rating per product exists)
--     * stock levels / stock quantity    (only in/out-of-stock flags)
--     * seller ratings                   (no seller rating field)
--     * price history / trends           (single snapshot, Oct/Nov 2021)
--     * sales volumes / revenue          (no transaction data)
--     * "best selling" products          (requires sales data)
--
-- Run:  docker exec -i fashion-bi-postgres psql -U postgres -d fashion_bi \
--          -v ON_ERROR_STOP=1 < sql/04_dashboard_metrics.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Overall KPIs
-- ---------------------------------------------------------------------------
-- Metric: Total Products / Brands / Categories / Average+Median+Min+Max
--         Price / Average Rating / Average Discount / Out-of-stock %
SELECT *
FROM fashion.vw_catalog_summary;

-- ---------------------------------------------------------------------------
-- Catalog composition
-- ---------------------------------------------------------------------------
-- Metric: Products by Category (top-level + sub-category, with % share)
SELECT * FROM fashion.vw_products_by_category ORDER BY n_products DESC;

-- Metric: Products by Brand (includes 'Unknown' bucket for reconciliation)
SELECT * FROM fashion.vw_products_by_brand ORDER BY n_products DESC LIMIT 20;

-- Metric: Products by Gender
SELECT * FROM fashion.vw_products_by_gender ORDER BY n_products DESC;

-- ---------------------------------------------------------------------------
-- Pricing
-- ---------------------------------------------------------------------------
-- Metric: Average/Median/Min/Max Price by Category
SELECT * FROM fashion.vw_price_by_category ORDER BY avg_selling_price DESC;

-- Metric: Average/Median/Min/Max Price by Brand
SELECT * FROM fashion.vw_price_by_brand ORDER BY avg_selling_price DESC;

-- ---------------------------------------------------------------------------
-- Ratings
-- ---------------------------------------------------------------------------
-- Metric: Average Rating by Category (rated products only)
SELECT * FROM fashion.vw_rating_by_category ORDER BY avg_rating DESC NULLS LAST;

-- Metric: Average Rating by Brand (rated products only, min. 10 rated)
SELECT * FROM fashion.vw_rating_by_brand
WHERE rated_products >= 10
ORDER BY avg_rating DESC NULLS LAST;

-- ---------------------------------------------------------------------------
-- Ranking lists
-- ---------------------------------------------------------------------------
-- Metric: Top Rated Products
SELECT * FROM fashion.vw_top_rated_products LIMIT 10;

-- Metric: Most Expensive Products
SELECT * FROM fashion.vw_most_expensive_products LIMIT 10;

-- Metric: Most Discounted Products
SELECT * FROM fashion.vw_most_discounted_products LIMIT 10;

-- ---------------------------------------------------------------------------
-- Brand x Category analysis
-- ---------------------------------------------------------------------------
-- Metric: Brand x Category matrix (largest brand-category combinations)
SELECT * FROM fashion.vw_brand_category_matrix
ORDER BY n_products DESC LIMIT 20;

-- Metric: Leading brand per category (1 product minimum)
WITH ranked AS (
    SELECT category, sub_category, brand_name, n_products,
           ROW_NUMBER() OVER (PARTITION BY category, sub_category
                              ORDER BY n_products DESC) AS rn
    FROM fashion.vw_brand_category_matrix
)
SELECT category, sub_category, brand_name, n_products
FROM ranked WHERE rn = 1
ORDER BY n_products DESC;

-- ---------------------------------------------------------------------------
-- Availability
-- ---------------------------------------------------------------------------
-- Metric: Out-of-stock rate by category
SELECT * FROM fashion.vw_out_of_stock_by_category
ORDER BY out_of_stock_pct DESC;

-- Metric: Out-of-stock rate by brand (min. 20 products)
SELECT * FROM fashion.vw_out_of_stock_by_brand
WHERE n_products >= 20
ORDER BY out_of_stock_pct DESC LIMIT 10;
