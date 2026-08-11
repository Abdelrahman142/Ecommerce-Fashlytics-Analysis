# Business Questions

Phase 2 deliverable. Business questions answerable **strictly** from the
dataset's fields (`category`, `sub_category`, `brand`, `seller`, `actual_price`,
`selling_price`, `discount`, `average_rating`, `out_of_stock`, `images`,
`product_details` — 127 raw attribute keys), and `crawled_at`). Each is now
implemented as SQL in `sql/02_analytics_queries.sql` and/or exposed through the
analytics views in `sql/03_views.sql`.

### 1. Catalog & Assortment
- Which brands have the largest product catalog? (`brand`)
- Which categories / sub-categories contain the most products? (`category`, `sub_category`)
- What is the distribution of products across the 4 categories and 24 sub-categories (share %)? 
- Which brands dominate each category — what is each brand's share of a category? (category × brand)
- Is the catalog a long tail or head-heavy — what share of products do the top N brands hold?
- Which sellers carry the largest catalogs, and how concentrated is supply? (`seller`)
- How complete is content per product — share with a description, with images, with a rating, with full attributes?

### 2. Pricing & Discounting
- What is the average / median MRP and selling price overall and by category, sub-category, and brand?
- Which brands have the highest / lowest average selling price (price positioning)?
- Which categories have the largest / smallest price ranges? (`actual_price` min–max per category)
- What share of products are discounted (had a discount), and what is the typical discount depth by category/brand?
- What is the *effective* discount (1 − selling/MRP) vs the claimed "% off" per category?
- How are products distributed across price bands (e.g. budget <₹500, mid ₹500–1500, premium >₹1500)?
- Which are the deepest-discounted products / categories?
- What is the price gap between footwear vs clothing vs accessories? (`category`)

### 3. Ratings & Product Quality
- What is the average rating by category, sub-category, and brand?
- Which products have the highest ratings? (`average_rating` top-N)
- What share of products are unrated (empty rating) — overall and by category?
- Do higher-priced products carry higher ratings (correlate price band vs avg rating)?
- Do deeply discounted products rate differently than lightly discounted ones? (`discount` × rating)

### 4. Availability & Stock
- What share of products are out of stock — overall, and by category, brand, and seller?
- Which brands/categories have the highest stock-out rates?
- Do discounted products get marked out of stock more often? (discount × `out_of_stock`)

### 5. Product Attributes (via `product_details`)
- What are the most common fabrics, patterns, fits, colors, sizes, sleeve/neck types?
- Which categories use which attribute sets (e.g. footwear has `Sole Material`, apparel has `Fabric Care`)?
- What is the most common occasion (`Occasion`), and how does occasion map to categories?
- Where are products manufactured — distribution of `Country of Origin`?
- What is the typical pack size (`Pack of`), and how does pack size affect price?
- How many product attributes does the typical listing carry, and which categories are richest?

### 6. Gender Segmentation (derived)
- How are products distributed by gender (`Ideal For` + title keywords)? What share is Men vs Women vs Mixed vs Unknown?
- Which categories are men-only vs mixed (`Men's Footwear` is 100% men)?
- What is the average price by gender segment?
- Do ratings differ by gender segment?

### 7. Seller & Supply Chain
- Which sellers dominate each brand's distribution (how many sellers per brand)?
- Do multiple sellers offer the same brand, and how do their prices compare (competitiveness)?
- Which sellers have the worst stock availability (`out_of_stock` by seller)?

### Not answerable (do not fabricate)
Sales/revenue/units sold, review counts & sentiment, stock quantity, price
history/trends, seller ratings — none exist in this snapshot (see
[data_profile.md](data_profile.md) §12).