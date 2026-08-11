-- ===========================================================================
-- 02_analytics_queries.sql — Phase 2 business questions as SQL
--
-- Every query here is answerable from the actual dataset (see
-- docs/data_profile.md). Run from the fashion_bi database.
-- ===========================================================================

-- Q1. Which brands have the largest product catalog?
SELECT b.brand_name, COUNT(*) AS n_products
FROM fashion.fact_products f
JOIN fashion.dim_brand b USING (brand_id)
WHERE b.brand_id <> 0
GROUP BY b.brand_name
ORDER BY n_products DESC
LIMIT 10;

-- Q2. Which categories contain the most products?
SELECT c.category, c.sub_category, COUNT(*) AS n_products
FROM fashion.fact_products f
JOIN fashion.dim_category c USING (category_id)
GROUP BY c.category, c.sub_category
ORDER BY n_products DESC
LIMIT 10;

-- Q3. Average product price (overall + by category)
SELECT ROUND(AVG(selling_price), 2) AS avg_selling,
       ROUND(AVG(mrp), 2)           AS avg_mrp,
       ROUND(AVG(effective_discount_pct), 1) AS avg_effective_discount
FROM fashion.fact_products;

SELECT c.category, COUNT(*) AS n, ROUND(AVG(f.selling_price), 2) AS avg_selling
FROM fashion.fact_products f
JOIN fashion.dim_category c USING (category_id)
GROUP BY c.category ORDER BY avg_selling DESC;

-- Q4. Which brands have the highest average prices?
SELECT b.brand_name, COUNT(*) AS n, ROUND(AVG(f.selling_price), 2) AS avg_selling
FROM fashion.fact_products f
JOIN fashion.dim_brand b USING (brand_id)
WHERE b.brand_id <> 0
GROUP BY b.brand_name
HAVING COUNT(*) >= 10
ORDER BY avg_selling DESC
LIMIT 10;

-- Q5. Which categories have the highest average ratings?
SELECT c.category, c.sub_category,
       ROUND(AVG(f.avg_rating) FILTER (WHERE f.has_rating), 2) AS avg_rating,
       COUNT(*) FILTER (WHERE f.has_rating) AS rated_products
FROM fashion.fact_products f
JOIN fashion.dim_category c USING (category_id)
GROUP BY c.category, c.sub_category
ORDER BY avg_rating DESC NULLS LAST;

-- Q6. Which products have the highest ratings?
SELECT f.product_id, p.title, b.brand_name, f.avg_rating, f.selling_price
FROM fashion.fact_products f
JOIN fashion.dim_product p USING (product_id)
JOIN fashion.dim_brand b ON b.brand_id = f.brand_id
WHERE f.has_rating
ORDER BY f.avg_rating DESC, f.selling_price DESC
LIMIT 10;

-- Q7. Most common product attributes (from the long-form attribute table)
SELECT attr_key, COUNT(*) AS n_products
FROM fashion.product_attributes
GROUP BY attr_key
ORDER BY n_products DESC
LIMIT 10;

-- Q8. How are products distributed across categories?
SELECT c.category, COUNT(*) AS n_products,
       ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) AS pct
FROM fashion.fact_products f
JOIN fashion.dim_category c USING (category_id)
GROUP BY c.category ORDER BY n_products DESC;

-- Q9. How are products distributed by gender?
SELECT g.gender, COUNT(*) AS n_products,
       ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) AS pct
FROM fashion.fact_products f
JOIN fashion.dim_gender g USING (gender_id)
GROUP BY g.gender ORDER BY n_products DESC;

-- Q10. Which brands dominate specific categories (top brand per category)?
WITH ranked AS (
    SELECT c.category, b.brand_name, COUNT(*) AS n_products,
           ROW_NUMBER() OVER (PARTITION BY c.category ORDER BY COUNT(*) DESC) AS rn
    FROM fashion.fact_products f
    JOIN fashion.dim_category c USING (category_id)
    JOIN fashion.dim_brand b USING (brand_id)
    WHERE b.brand_id <> 0
    GROUP BY c.category, b.brand_name
)
SELECT category, brand_name, n_products
FROM ranked WHERE rn = 1 ORDER BY n_products DESC;

-- Q11. What percentage of products are discounted?
SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE discount_pct IS NOT NULL) / COUNT(*), 2) AS pct_with_discount,
       ROUND(100.0 * COUNT(*) FILTER (WHERE effective_discount_pct IS NOT NULL AND effective_discount_pct > 0) / COUNT(*), 2) AS pct_effectively_discounted
FROM fashion.fact_products;

-- Q12. Which categories have the largest price ranges?
SELECT c.category, MIN(f.selling_price) AS min_price, MAX(f.selling_price) AS max_price,
       MAX(f.selling_price) - MIN(f.selling_price) AS range_inr
FROM fashion.fact_products f
JOIN fashion.dim_category c USING (category_id)
GROUP BY c.category ORDER BY range_inr DESC;

-- Q13. Out-of-stock rate by brand (availability)
SELECT b.brand_name, COUNT(*) AS n,
       ROUND(100.0 * COUNT(*) FILTER (WHERE f.is_out_of_stock) / COUNT(*), 2) AS out_of_stock_pct
FROM fashion.fact_products f
JOIN fashion.dim_brand b USING (brand_id)
WHERE b.brand_id <> 0
GROUP BY b.brand_name
HAVING COUNT(*) >= 20
ORDER BY out_of_stock_pct DESC
LIMIT 10;

-- Q14. Seller catalog concentration (top sellers by product count)
SELECT s.seller_name, COUNT(*) AS n_products
FROM fashion.fact_products f
JOIN fashion.dim_seller s USING (seller_id)
WHERE s.seller_id <> 0
GROUP BY s.seller_name ORDER BY n_products DESC LIMIT 10;
