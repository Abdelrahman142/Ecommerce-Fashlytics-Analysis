"""Flipkart Fashion BI — interactive dashboard.

Runs against the Phase 5/6 PostgreSQL star schema (fashion.vw_product and the
analytics views from sql/03_views.sql). Every number shown is backed by the
actual dataset; metrics the data cannot support are deliberately absent.

Run:
  bash scripts/db_init.sh                       # ensure DB + views exist
  .venv/bin/streamlit run dashboard/app.py
"""

from __future__ import annotations

import os

import pandas as pd
import plotly.express as px
import psycopg
import streamlit as st

st.set_page_config(
    page_title="Flipkart Fashion BI",
    page_icon="🛍️",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ---------------------------------------------------------------------------
# Connection
# ---------------------------------------------------------------------------

CONN_KWARGS = dict(
    host=os.environ.get("PGHOST", "localhost"),
    port=os.environ.get("PGPORT", "5433"),
    dbname=os.environ.get("PGDATABASE", "fashion_bi"),
    user=os.environ.get("PGUSER", "postgres"),
    password=os.environ.get("PGPASSWORD", "postgres"),
)

BASE_COLS = [
    "product_id", "title", "brand_name", "category", "sub_category", "gender",
    "seller_name", "mrp", "selling_price", "discount_pct",
    "effective_discount_pct", "avg_rating", "rating_bucket", "price_band",
    "is_out_of_stock", "has_rating",
]

PALETTE = px.colors.qualitative.Bold + px.colors.qualitative.Set2


@st.cache_resource(show_spinner=False)
def get_conn():
    return psycopg.connect(**CONN_KWARGS)


def query_df(sql: str, params: tuple | None = None) -> pd.DataFrame:
    from decimal import Decimal

    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(sql, params)
        cols = [d[0] for d in cur.description]
        df = pd.DataFrame(cur.fetchall(), columns=cols)
    for col in df.columns:
        vals = df[col].dropna()
        if (len(vals) and not vals.map(type).isin([bool]).any()
                and all(isinstance(v, (int, float, Decimal)) for v in vals)):
            df[col] = pd.to_numeric(vals, errors="coerce")
    return df


@st.cache_data(ttl=300, show_spinner=False)
def load_options() -> dict:
    q = """
        SELECT brand_name, category, gender, MIN(selling_price) AS lo,
               MAX(selling_price) AS hi, MAX(avg_rating) AS max_rating
        FROM fashion.vw_product GROUP BY 1, 2, 3
    """
    df = query_df(q)
    brands = df["brand_name"].sort_values().tolist()
    cats = sorted(df["category"].unique())
    genders = sorted(df["gender"].unique())
    price_lo, price_hi = int(df["lo"].min()), int(df["hi"].max())
    return dict(brands=brands, categories=cats, genders=genders,
                price_lo=price_lo, price_hi=price_hi)


def filter_clauses(brands, categories, genders, price_lo, price_hi, min_rating,
                   prefix: str = "") -> tuple[list[str], list]:
    """Build (WHERE clauses, params) shared by the base and attribute queries.

    `prefix` qualifies the column names when a join alias is used.
    """
    p = prefix
    where, params = [], []
    if brands:
        where.append(f"{p}brand_name = ANY(%s)")
        params.append(list(brands))
    if categories:
        where.append(f"{p}category = ANY(%s)")
        params.append(list(categories))
    if genders:
        where.append(f"{p}gender = ANY(%s)")
        params.append(list(genders))
    where.append(f"{p}selling_price BETWEEN %s AND %s")
    params += [price_lo, price_hi]
    if min_rating > 0:
        where.append(f"{p}has_rating AND {p}avg_rating >= %s")
        params.append(min_rating)
    return where, params


@st.cache_data(ttl=300, show_spinner=False)
def load_filtered(brands, categories, genders, price_lo, price_hi, min_rating) -> pd.DataFrame:
    where, params = filter_clauses(brands, categories, genders,
                                   price_lo, price_hi, min_rating)
    sql = f"SELECT {', '.join(BASE_COLS)} FROM fashion.vw_product"
    if where:
        sql += " WHERE " + " AND ".join(where)
    return query_df(sql, tuple(params))


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def fmt_inr(v: float) -> str:
    return f"₹{v:,.0f}"


def metric_card(label: str, value: str, delta: str | None = None) -> None:
    st.metric(label, value, delta)


def bar(df: pd.DataFrame, x: str, y: str, title: str, top: int | None = None,
        orientation: str = "v", labels: dict | None = None) -> None:
    d = df.sort_values(x, ascending=(orientation == "h"))
    if top and orientation == "h":
        d = d.tail(top)
    fig = px.bar(d, x=x, y=y, orientation=orientation, title=title,
                 color=y if orientation == "v" else x,
                 color_discrete_sequence=PALETTE, template="plotly_white")
    fig.update_layout(showlegend=False, margin=dict(l=10, r=10, t=45, b=10),
                      height=340)
    if orientation == "h":
        fig.update_yaxes(categoryorder="total ascending")
    st.plotly_chart(fig, width='stretch')


# ---------------------------------------------------------------------------
# Header
# ---------------------------------------------------------------------------

st.markdown(
    """
    <style>
      .block-container { padding-top: 1.4rem; }
      #MainMenu, footer { visibility: hidden; }
      .section-title { margin-top: 1.1rem; margin-bottom: .2rem;
        font-size: 1.25rem; font-weight: 700; color: #1A2233; }
      .kpi-sub { color: #68708A; font-size: .82rem; }
    </style>
    """,
    unsafe_allow_html=True,
)

st.markdown(
    "<div style='display:flex;align-items:baseline;gap:.7rem'>"
    "<div style='font-size:1.7rem;font-weight:800;color:#1A2233'>Flipkart Fashion — Product Intelligence</div>"
    "<div class='kpi-sub'>30,000-listing snapshot · Oct/Nov 2021 · PostgreSQL star schema</div>"
    "</div>",
    unsafe_allow_html=True,
)

try:
    opts = load_options()
except psycopg.OperationalError as exc:
    st.error(
        "Cannot reach the PostgreSQL database. Start it first:\n\n"
        "    bash scripts/db_init.sh\n\n"
        f"Connection error: {exc}"
    )
    st.stop()

# ---------------------------------------------------------------------------
# Filters (sidebar)
# ---------------------------------------------------------------------------

with st.sidebar:
    st.markdown("## Filters")
    sel_brands = st.multiselect("Brand", opts["brands"])
    sel_cats = st.multiselect("Category", opts["categories"])
    sel_genders = st.multiselect("Gender", opts["genders"])
    price_range = st.slider("Price range (₹)",
                            opts["price_lo"], opts["price_hi"],
                            (opts["price_lo"], opts["price_hi"]), step=100)
    min_rating = st.slider("Minimum rating", 0.0, 5.0, 0.0, 0.1,
                           help="0 shows all products; >0 restricts to rated products")
    if st.button("Reset filters"):
        st.rerun()

df = load_filtered(sel_brands, sel_cats, sel_genders,
                   int(price_range[0]), int(price_range[1]), float(min_rating))

if df.empty:
    st.warning("No products match the current filters.")
    st.stop()

n = len(df)
rated = df[df["has_rating"]]
PRICE, RATE = "selling_price", "avg_rating"

# ---------------------------------------------------------------------------
# 1. Executive Overview
# ---------------------------------------------------------------------------

st.markdown('<div class="section-title">Executive Overview</div>',
            unsafe_allow_html=True)

n_brands = df["brand_name"].nunique()
n_cats = df["category"].nunique()
avg_price = df[PRICE].mean()
med_price = df[PRICE].median()
avg_rating = rated[RATE].mean() if len(rated) else float("nan")
oos_pct = 100 * df["is_out_of_stock"].mean()

c = st.columns(6)
with c[0]: metric_card("Total Products", f"{n:,}")
with c[1]: metric_card("Brands", f"{n_brands:,}")
with c[2]: metric_card("Categories", f"{n_cats:,}")
with c[3]: metric_card("Avg Price", fmt_inr(avg_price), f"median {fmt_inr(med_price)}")
with c[4]: metric_card("Avg Rating", f"{avg_rating:.2f}", f"{len(rated):,} rated")
with c[5]: metric_card("Out of Stock", f"{oos_pct:.1f}%")

c = st.columns(2)
with c[0]:
    share = df.groupby("category").size().sort_values(ascending=False)
    fig = px.pie(share, names=share.index, values=share.values,
                 title="Catalog share by category",
                 color_discrete_sequence=PALETTE, template="plotly_white")
    fig.update_traces(textinfo="percent+label", hole=0.42)
    fig.update_layout(margin=dict(l=10, r=10, t=45, b=10), height=330)
    st.plotly_chart(fig, width='stretch')
with c[1]:
    bands = df["price_band"].value_counts().reindex(
        ["budget", "mid", "premium", "luxury"], fill_value=0)
    fig = px.bar(x=bands.index, y=bands.values, title="Products by price band",
                 labels={"x": "Price band", "y": "Products"},
                 color=bands.index, color_discrete_sequence=PALETTE,
                 template="plotly_white")
    fig.update_layout(showlegend=False, margin=dict(l=10, r=10, t=45, b=10),
                      height=330)
    st.plotly_chart(fig, width='stretch')

# ---------------------------------------------------------------------------
# 2. Product Analysis
# ---------------------------------------------------------------------------

st.markdown('<div class="section-title">Product Analysis</div>',
            unsafe_allow_html=True)

c = st.columns(2)
with c[0]:
    by_cat = df.groupby(["category", "sub_category"]).size().reset_index(name="n")
    bar(by_cat, "n", "category", "Products by category", top=12, orientation="h",
        labels={"category": "Category"})
with c[1]:
    by_gender = df.groupby("gender").size().reset_index(name="n")
    bar(by_gender, "n", "gender", "Products by gender", orientation="v",
        labels={"gender": "Gender"})

c = st.columns(2)
with c[0]:
    by_brand = df.groupby("brand_name").size().reset_index(name="n")
    bar(by_brand, "n", "brand_name", "Products by brand (top 15)", top=15,
        orientation="h", labels={"brand_name": "Brand"})
with c[1]:
    fig = px.histogram(df, x=PRICE, nbins=40, title="Price distribution (₹)",
                       color_discrete_sequence=[PALETTE[0]],
                       template="plotly_white")
    fig.update_layout(showlegend=False, margin=dict(l=10, r=10, t=45, b=10),
                      height=340, xaxis_title="Selling price (₹)", yaxis_title="Products")
    st.plotly_chart(fig, width='stretch')

c = st.columns(2)
with c[0]:
    if len(rated):
        fig = px.histogram(rated, x=RATE, nbins=25, title="Rating distribution",
                           color_discrete_sequence=[PALETTE[1]],
                           template="plotly_white")
        fig.update_layout(showlegend=False, margin=dict(l=10, r=10, t=45, b=10),
                          height=340, xaxis_title="Average rating", yaxis_title="Products")
        st.plotly_chart(fig, width='stretch')
with c[1]:
    rband = df.groupby("rating_bucket").size().reindex(
        ["low", "mid", "high"], fill_value=0)
    fig = px.bar(x=rband.index, y=rband.values, title="Rating buckets",
                 labels={"x": "Bucket", "y": "Products"},
                 color=rband.index, color_discrete_sequence=PALETTE,
                 template="plotly_white")
    fig.update_layout(showlegend=False, margin=dict(l=10, r=10, t=45, b=10),
                      height=340)
    st.plotly_chart(fig, width='stretch')

# ---------------------------------------------------------------------------
# 3. Brand Analysis
# ---------------------------------------------------------------------------

st.markdown('<div class="section-title">Brand Analysis</div>',
            unsafe_allow_html=True)

brand_agg = df.groupby("brand_name").agg(
    n_products=(PRICE, "size"),
    avg_price=(PRICE, "mean"),
    avg_rating=(RATE, lambda s: s.mean() if s.notna().any() else None),
    rated_products=(RATE, lambda s: int(s.notna().sum())),
).reset_index()

c = st.columns(2)
with c[0]:
    bar(brand_agg, "n_products", "brand_name", "Top brands by product count (top 15)",
        top=15, orientation="h", labels={"brand_name": "Brand"})
with c[1]:
    top = brand_agg.nlargest(15, "avg_price").sort_values("avg_price")
    fig = px.bar(top, x="avg_price", y="brand_name", orientation="h",
                 title="Average price by brand (top 15)",
                 color="avg_price", color_continuous_scale="Blues",
                 template="plotly_white")
    fig.update_layout(showlegend=False, coloraxis_showscale=False,
                      margin=dict(l=10, r=10, t=45, b=10), height=340,
                      xaxis_title="Avg selling price (₹)")
    st.plotly_chart(fig, width='stretch')

c = st.columns(2)
with c[0]:
    r = brand_agg[brand_agg["rated_products"] >= 10].nlargest(15, "avg_rating")
    fig = px.bar(r.sort_values("avg_rating"), x="avg_rating", y="brand_name",
                 orientation="h", title="Average rating by brand (rated ≥ 10)",
                 color="avg_rating", color_continuous_scale="Greens",
                 template="plotly_white")
    fig.update_layout(showlegend=False, coloraxis_showscale=False,
                      margin=dict(l=10, r=10, t=45, b=10), height=340,
                      xaxis_title="Average rating")
    st.plotly_chart(fig, width='stretch')
with c[1]:
    hot = brand_agg[brand_agg["n_products"] >= 5].sort_values("avg_price").tail(15)
    hm = df[df["brand_name"].isin(hot["brand_name"])]
    pivot = pd.crosstab(hm["brand_name"], hm["category"])
    fig = px.imshow(pivot, title="Brand × category product count (top 15 brands)",
                    color_continuous_scale="Blues", aspect="auto",
                    template="plotly_white",
                    labels=dict(x="Category", y="Brand", color="Products"))
    fig.update_layout(margin=dict(l=10, r=10, t=45, b=10), height=340)
    st.plotly_chart(fig, width='stretch')

# ---------------------------------------------------------------------------
# 4. Product Insights
# ---------------------------------------------------------------------------

st.markdown('<div class="section-title">Product Insights</div>',
            unsafe_allow_html=True)

c = st.columns(3)
with c[0]:
    st.markdown("**Top rated products**")
    top_rated = rated.nlargest(10, RATE)[
        ["title", "brand_name", "category", "avg_rating", "selling_price"]]
    st.dataframe(top_rated, hide_index=True, width='stretch')
with c[1]:
    st.markdown("**Highest priced products**")
    top_price = df.nlargest(10, PRICE)[
        ["title", "brand_name", "category", "selling_price", "mrp"]]
    st.dataframe(top_price, hide_index=True, width='stretch')
with c[2]:
    st.markdown("**Most discounted products**")
    disc = df[df["effective_discount_pct"].notna()].nlargest(10, "effective_discount_pct")[
        ["title", "brand_name", "category", "effective_discount_pct", "selling_price"]]
    st.dataframe(disc, hide_index=True, width='stretch')

st.markdown("**Interesting patterns**")
c = st.columns(3)
with c[0]:
    pat = df.groupby("price_band").apply(
        lambda g: g.loc[g["has_rating"], RATE].mean(), include_groups=False
    ).reindex(["budget", "mid", "premium", "luxury"]).reset_index()
    pat.columns = ["price_band", "avg_rating"]
    fig = px.bar(pat, x="price_band", y="avg_rating",
                 title="Avg rating by price band", color="price_band",
                 color_discrete_sequence=PALETTE, template="plotly_white")
    fig.update_layout(showlegend=False, margin=dict(l=10, r=10, t=45, b=10),
                      height=300)
    st.plotly_chart(fig, width='stretch')
with c[1]:
    pat2 = df.groupby("price_band")["effective_discount_pct"].mean().reindex(
        ["budget", "mid", "premium", "luxury"]).reset_index()
    pat2.columns = ["price_band", "avg_eff_discount"]
    fig = px.bar(pat2, x="price_band", y="avg_eff_discount",
                 title="Avg effective discount by price band (%)",
                 color="price_band", color_discrete_sequence=PALETTE,
                 template="plotly_white")
    fig.update_layout(showlegend=False, margin=dict(l=10, r=10, t=45, b=10),
                      height=300, yaxis_tickformat=".0f")
    st.plotly_chart(fig, width='stretch')
with c[2]:
    pat3 = df.groupby("category")["is_out_of_stock"].mean().mul(100).reset_index()
    pat3.columns = ["category", "oos_pct"]
    fig = px.bar(pat3.sort_values("oos_pct", ascending=False), x="oos_pct",
                 y="category", orientation="h", title="Out-of-stock rate by category (%)",
                 color="oos_pct", color_continuous_scale="Oranges",
                 template="plotly_white")
    fig.update_layout(showlegend=False, coloraxis_showscale=False,
                      margin=dict(l=10, r=10, t=45, b=10), height=300)
    st.plotly_chart(fig, width='stretch')

c = st.columns(2)
with c[0]:
    sample = df[df["effective_discount_pct"].notna() & df["has_rating"]].sample(
        min(4000, len(df)), random_state=42)
    fig = px.scatter(sample, x="effective_discount_pct", y=RATE, opacity=0.35,
                     title="Effective discount vs rating (sample)",
                     color_discrete_sequence=[PALETTE[3]], template="plotly_white")
    fig.update_layout(showlegend=False, margin=dict(l=10, r=10, t=45, b=10),
                      height=330, xaxis_title="Effective discount (%)")
    st.plotly_chart(fig, width='stretch')
with c[1]:
    top_attr = None
    try:
        conn = get_conn()
        base_q = """
            SELECT pa.attr_key, COUNT(DISTINCT pa.product_id) AS n
            FROM fashion.product_attributes pa
            JOIN fashion.vw_product v USING (product_id)
        """
        where, params = filter_clauses(brands, categories, genders,
                                       price_lo, price_hi, min_rating, prefix="v.")
        if where:
            base_q += " WHERE " + " AND ".join(where)
        base_q += " GROUP BY pa.attr_key ORDER BY n DESC LIMIT 12"
        top_attr = query_df(base_q, tuple(params))
    except Exception:
        pass
    if top_attr is not None and not top_attr.empty:
        fig = px.bar(top_attr, x="n", y="attr_key", orientation="h",
                     title="Most common product attributes",
                     color="n", color_continuous_scale="Purples",
                     template="plotly_white")
        fig.update_layout(showlegend=False, coloraxis_showscale=False,
                          margin=dict(l=10, r=10, t=45, b=10), height=330)
        st.plotly_chart(fig, width='stretch')

st.markdown(
    "<div style='margin-top:1.5rem;color:#68708A;font-size:.78rem'>"
    "Source: Flipkart fashion snapshot (30,000 listings) · processed by the ETL in "
    "<code>src/</code> · loaded into PostgreSQL star schema · all metrics backed by "
    "actual data (no rating counts, reviews, stock levels, or sales volumes are available)."
    "</div>",
    unsafe_allow_html=True,
)
