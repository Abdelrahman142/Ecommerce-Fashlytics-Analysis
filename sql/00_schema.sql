-- ===========================================================================
-- 00_schema.sql — Fashion Product Intelligence star schema
--
-- Idempotent: safe to re-run (drops and recreates the schema).
-- Applied by: scripts/db_init.sh  (docker exec ... psql -f sql/00_schema.sql)
-- Design rationale: docs/data_model.md
-- ===========================================================================

DROP SCHEMA IF EXISTS fashion CASCADE;
CREATE SCHEMA fashion;

-- ---------------------------------------------------------------------------
-- Lookup / dimension tables
-- ---------------------------------------------------------------------------

-- Unknown rows (id 0) guarantee referential integrity for products with no
-- brand / seller in the source. gender already contains a real 'Unknown' value.
CREATE TABLE fashion.dim_brand (
    brand_id        SMALLINT PRIMARY KEY,
    brand_name      TEXT NOT NULL UNIQUE,
    brand_raw       TEXT,
    is_canonicalized BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT dim_brand_unknown CHECK (brand_id <> 0 OR brand_name = 'Unknown')
);

CREATE TABLE fashion.dim_category (
    category_id     SMALLINT PRIMARY KEY,
    category        TEXT NOT NULL,
    sub_category    TEXT NOT NULL,
    CONSTRAINT dim_category_unknown CHECK (category_id <> 0 OR sub_category = 'Unknown'),
    CONSTRAINT uq_dim_category UNIQUE (category, sub_category)
);

CREATE TABLE fashion.dim_gender (
    gender_id       SMALLINT PRIMARY KEY,
    gender          TEXT NOT NULL UNIQUE
);

CREATE TABLE fashion.dim_seller (
    seller_id       SMALLINT PRIMARY KEY,
    seller_name     TEXT NOT NULL UNIQUE,
    CONSTRAINT dim_seller_unknown CHECK (seller_id <> 0 OR seller_name = 'Unknown')
);

-- ---------------------------------------------------------------------------
-- Product dimension (grain: product_id — the deduped Flipkart product)
-- ---------------------------------------------------------------------------

CREATE TABLE fashion.dim_product (
    product_id          TEXT PRIMARY KEY,
    title               TEXT NOT NULL,
    description         TEXT,
    brand_id            SMALLINT NOT NULL REFERENCES fashion.dim_brand (brand_id),
    category_id         SMALLINT NOT NULL REFERENCES fashion.dim_category (category_id),
    gender_id           SMALLINT NOT NULL REFERENCES fashion.dim_gender (gender_id),
    seller_id           SMALLINT NOT NULL REFERENCES fashion.dim_seller (seller_id),
    channel             TEXT,
    listing_ids         TEXT[] NOT NULL,
    crawled_at          TIMESTAMP NOT NULL,
    n_listings          INTEGER NOT NULL CHECK (n_listings >= 1),
    n_attributes        INTEGER NOT NULL DEFAULT 0 CHECK (n_attributes >= 0),
    image_count         INTEGER NOT NULL DEFAULT 0 CHECK (image_count >= 0),
    pack_of             INTEGER CHECK (pack_of >= 1),
    primary_image       TEXT,
    is_category_anomaly BOOLEAN NOT NULL DEFAULT FALSE,
    -- 40 pivoted product attributes (from the Phase 3 wide table)
    attr_fabric TEXT, attr_pattern TEXT, attr_fit TEXT, attr_color TEXT,
    attr_size TEXT, attr_sleeve TEXT, attr_sleeve_type TEXT, attr_neck_type TEXT,
    attr_ideal_for TEXT, attr_suitable_for TEXT, attr_occasion TEXT,
    attr_pack_of TEXT, attr_country_of_origin TEXT, attr_closure TEXT,
    attr_reversible TEXT, attr_hooded TEXT, attr_fabric_care TEXT,
    attr_style_code TEXT, attr_brand_color TEXT, attr_type TEXT,
    attr_sales_package TEXT, attr_model_name TEXT, attr_other_details TEXT,
    attr_pockets TEXT, attr_rise TEXT, attr_collar TEXT, attr_generic_name TEXT,
    attr_hem TEXT, attr_sole_material TEXT, attr_fly TEXT, attr_length_type TEXT,
    attr_waistband TEXT, attr_pocket_type TEXT, attr_distressed TEXT,
    attr_faded TEXT, attr_model_number TEXT, attr_other_features TEXT,
    attr_inseam_length TEXT, attr_stretchable TEXT, attr_character TEXT
);

-- ---------------------------------------------------------------------------
-- Fact table (grain: product x snapshot; single snapshot -> 28,080 rows)
-- ---------------------------------------------------------------------------

CREATE TABLE fashion.fact_products (
    product_id           TEXT PRIMARY KEY
                         REFERENCES fashion.dim_product (product_id),
    brand_id             SMALLINT NOT NULL REFERENCES fashion.dim_brand (brand_id),
    category_id          SMALLINT NOT NULL REFERENCES fashion.dim_category (category_id),
    gender_id            SMALLINT NOT NULL REFERENCES fashion.dim_gender (gender_id),
    seller_id            SMALLINT NOT NULL REFERENCES fashion.dim_seller (seller_id),
    snapshot_date        DATE NOT NULL,
    mrp                  NUMERIC(10,2) CHECK (mrp > 0),
    selling_price        NUMERIC(10,2) CHECK (selling_price > 0),
    discount_pct         SMALLINT CHECK (discount_pct BETWEEN 0 AND 100),
    effective_discount_pct SMALLINT CHECK (effective_discount_pct BETWEEN 0 AND 100),
    avg_rating           NUMERIC(3,2) CHECK (avg_rating BETWEEN 0 AND 5),
    rating_bucket        TEXT CHECK (rating_bucket IN ('low', 'mid', 'high')),
    price_band           TEXT CHECK (price_band IN ('budget', 'mid', 'premium', 'luxury')),
    is_out_of_stock      BOOLEAN NOT NULL DEFAULT FALSE,
    any_out_of_stock     BOOLEAN NOT NULL DEFAULT FALSE,
    has_rating           BOOLEAN NOT NULL DEFAULT FALSE,
    image_count          INTEGER NOT NULL DEFAULT 0 CHECK (image_count >= 0),
    n_attributes         INTEGER NOT NULL DEFAULT 0 CHECK (n_attributes >= 0),
    n_listings           INTEGER NOT NULL DEFAULT 1 CHECK (n_listings >= 1),
    min_selling_price    NUMERIC(10,2),
    max_selling_price    NUMERIC(10,2),
    -- business sanity: the selling price never exceeds the MRP
    CONSTRAINT chk_selling_le_mrp CHECK (mrp IS NULL OR selling_price IS NULL OR selling_price <= mrp),
    CONSTRAINT chk_price_range CHECK (
        min_selling_price IS NULL OR max_selling_price IS NULL OR min_selling_price <= max_selling_price
    )
);

-- ---------------------------------------------------------------------------
-- Auxiliary long-form attribute table (EAV)
--
-- Not part of the star core: it keeps every product attribute (120 canonical
-- keys) in long form for attribute-level analytics (e.g. 'most common
-- fabrics'). Grain: product x attribute key x value (deduplicated).
-- ---------------------------------------------------------------------------

CREATE TABLE fashion.product_attributes (
    product_id   TEXT NOT NULL REFERENCES fashion.dim_product (product_id),
    attr_key     TEXT NOT NULL,
    attr_value   TEXT,
    PRIMARY KEY (product_id, attr_key, attr_value)
);

-- Seed the Unknown reference rows (id 0). gender 'Unknown' is loaded from data.
INSERT INTO fashion.dim_brand    (brand_id, brand_name)  VALUES (0, 'Unknown');
INSERT INTO fashion.dim_seller   (seller_id, seller_name) VALUES (0, 'Unknown');
INSERT INTO fashion.dim_category (category_id, category, sub_category)
    VALUES (0, 'Unknown', 'Unknown');
INSERT INTO fashion.dim_gender   (gender_id, gender) VALUES (0, 'Unknown');
