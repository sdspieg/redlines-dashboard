# Causal Analytics Tab — Technical Documentation

## Table of Contents

1. [Overview](#1-overview)
2. [Research Questions](#2-research-questions)
3. [Architecture](#3-architecture)
4. [Data Sources & Variables](#4-data-sources--variables)
5. [Weekly Panel Construction](#5-weekly-panel-construction)
6. [Actor-Level Breakdowns](#6-actor-level-breakdowns)
7. [Statistical Methods](#7-statistical-methods)
8. [Dashboard Visualizations](#8-dashboard-visualizations)
9. [JSON Data Files](#9-json-data-files)
10. [CI/CD Pipeline](#10-cicd-pipeline)
11. [Interpretation Guide](#11-interpretation-guide)
12. [Limitations & Caveats](#12-limitations--caveats)
13. [File Inventory](#13-file-inventory)

---

## 1. Overview

The **Causal Analytics** tab provides interactive time-series econometric analysis of the relationship between Russian rhetoric (Red Line Statements, Nuclear Threat Statements, Civilizational Red Line Statements) and real-world conflict, military, economic, and media variables.

The system consists of two components:

- **Python analysis backend** (`scripts/export_analytics_data.py`): Runs daily in GitHub Actions. Queries both the `redlines` and `war_datasets` PostgreSQL databases, constructs an aligned weekly panel dataset (~210 weeks, ~63 variables), runs five statistical methods, and exports 7 pre-computed JSON files.

- **React dashboard tab** (`src/components/Analytics.tsx`): Loads the 7 JSON files and renders interactive Plotly charts with grouped variable selectors, direction toggles, Granger heatmap group filters, and lag controls.

**Current scale** (as of March 2026):
- ~211 weeks of data (Feb 21, 2022 – present)
- **151 variables** across 3 groups:
  - 33 rhetoric (core RRLS/NTS/CRLS + target breakdowns)
  - 57 action (ACLED overall + actor-level, equipment, missiles, aid aggregate + by donor, sanctions, GDELT bidirectional threat events)
  - 61 media (GDELT core media metrics + bidirectional tone/Goldstein scores)
- **3,894 cross-correlation pairs**
- **7,788 Granger causality tests**
- 2 VAR models with bootstrapped IRFs
- **37 Local Projection pairs**
- 2 event study spike types

---

## 2. Research Questions

The tab tests two directional hypotheses:

### Question A: Do Western/Ukrainian actions trigger Russian RLS/NTS?
**Direction: Action → Rhetoric**

Does battlefield intensity (ACLED events, fatalities), equipment losses (tanks, drones, artillery), missile campaigns, Western military aid commitments, or new sanctions predict subsequent increases in Russian red-line or nuclear threat rhetoric?

### Question B: Do Russian RLS/NTS affect Western/Ukrainian behavior? (Reflexive Control)
**Direction: Rhetoric → Action**

Does Russian rhetoric function as a tool of reflexive control — i.e., do spikes in RLS/NTS rhetoric predict decreases in Western military aid, changes in conflict intensity, or shifts in media coverage?

### Actor-Level Refinement
- Which specific targets (US, NATO, EU, Ukraine, etc.) are associated with which rhetoric patterns?
- Does aid from specific donors (US, EU, Germany, Japan, etc.) trigger different rhetoric responses?

---

## 3. Architecture

```
┌──────────────────────────────────────────────┐     ┌──────────────────────────────────┐
│  Python Script (GitHub Actions, daily)        │     │  React Dashboard Tab             │
│                                              │     │                                  │
│  1. Query redlines DB                        │     │  Load 7 JSON files               │
│     - RRLS weekly counts + intensity         │     │  ┌──────────────────────────┐    │
│     - NTS weekly counts + severity dims      │     │  │ Controls: rhetoric var,  │    │
│     - CRLS weekly counts                     │     │  │ action var, direction,   │    │
│     - RRLS targets by actor                  │     │  │ model, lag              │    │
│     - NTS targets by actor                   │     │  └──────────────────────────┘    │
│                                              │     │                                  │
│  2. Query war_datasets DB                    │     │  Section 1: Time Series Overview  │
│     - ACLED events/fatalities/battles        │     │  Section 2: Cross-Correlation     │
│     - Personnel losses (Oryx/UA MOD)         │     │  Section 3: Granger Heatmap       │
│     - Equipment losses (tank/APC/art/drone)  │     │  Section 4: VAR IRFs              │
│     - Missile attacks                        │     │  Section 5: LP IRFs (Jordà)       │
│     - Kiel aid by type + by donor            │     │  Section 6: Event Study           │
│     - OpenSanctions new entities             │     │  Section 7: Diagnostics           │
│     - GDELT media (10 VARX + bidir events)   │     │                                  │
│     - ACLED actor breakdowns (RUS/UKR)       │     │  Grouped dropdowns + Granger     │
│                                              │     │  heatmap group filters           │
│                                              │     └──────────────────────────────────┘
│  3. Assemble weekly panel (211 × 152)        │
│  4. ADF stationarity tests (151 vars)        │
│  5. Cross-correlations (3,894 pairs)         │──→ 7 JSON files in data/
│  6. Granger causality (7,788 tests)          │
│  7. VAR + bootstrapped IRFs (2 models)       │
│  8. Local Projections (37 pairs)             │
│  9. Event study (2 spike types)              │
│  10. Export 7 JSON files                     │
└──────────────────────────────────────────────┘
```

---

## 4. Data Sources & Variables

### 4.1 Rhetoric Variables (from `redlines` database)

| Variable | Label | Source Table | SQL Aggregation | Scale |
|----------|-------|-------------|-----------------|-------|
| `rrls_count` | RRLS Count | `rls_annotation` | `COUNT(*)` per week where `is_relevant` | Count (0–50+/week) |
| `rrls_line_intensity_mean` | RRLS Line Intensity | `rls_annotation` | `AVG(CASE line_intensity WHEN 'Low' THEN 1 ... 'Very High' THEN 4)` | 1–4 ordinal |
| `rrls_threat_intensity_mean` | RRLS Threat Intensity | `rls_annotation` | Same pattern for `threat_intensity` | 1–4 ordinal |
| `rrls_intensity_mean` | RRLS Intensity (combined) | Computed | `(line_intensity + threat_intensity) / 2` | 1–4 ordinal |
| `nts_count` | NTS Count | `nts_annotation` | `COUNT(*)` per week where `is_relevant` | Count (0–15+/week) |
| `nts_tone_mean` | NTS Tone | `nts_annotation` | `AVG(CASE tone WHEN 'Firm' THEN 2 ... 'Apocalyptic' THEN 5)` | 2–5 ordinal |
| `nts_cond_mean` | NTS Conditionality | `nts_annotation` | `AVG(CASE conditionality ...)` | 1–4 ordinal |
| `nts_conseq_mean` | NTS Consequences | `nts_annotation` | `AVG(CASE consequences ...)` | 3–5 ordinal |
| `nts_spec_mean` | NTS Specificity | `nts_annotation` | `AVG(CASE specificity ...)` | 1–5 ordinal |
| `nts_severity_mean` | NTS Severity (combined) | Computed | `mean(tone, cond, conseq, spec)` — set to 0 when `nts_count=0` | 0–5 composite |
| `crls_count` | CRLS Count | `rls_annotation_third_pass` | `COUNT(*)` where `civilizational_framing` | Count (0–10+/week) |

**Data density:**
- RRLS: ~1,500+ statements post-2022, mean ~7.5/week — excellent density for all methods
- NTS: ~356 total, ~51% zero weeks — moderate density, bivariate tests OK, large VARs risky
- CRLS: ~362 total, similar sparsity — same as NTS

### 4.2 Action Variables (from `war_datasets` database)

| Variable | Label | Source Table | SQL Approach | Notes |
|----------|-------|-------------|-------------|-------|
| `acled_events` | ACLED Events | `conflict_events.acled_events` | `COUNT(*)` per week | All event types, all countries in dataset |
| `acled_fatalities` | ACLED Fatalities | Same | `SUM(fatalities)` per week | Reported fatalities |
| `acled_battles` | ACLED Battles | Same | `COUNT(*) FILTER (WHERE event_type = 'Battles')` | Direct engagements |
| `acled_explosions` | ACLED Explosions/Remote Violence | Same | `COUNT(*) FILTER (WHERE event_type = 'Explosions/Remote violence')` | Shelling, airstrikes, IEDs |
| `personnel_delta` | Personnel Losses | `equipment_losses.personnel_daily` | `LAG()` to get daily delta, `SUM(GREATEST(delta,0))` per week | Russian losses (UA MOD estimates) |
| `tank_delta` | Tank Losses | `equipment_losses.equipment_daily` | Same LAG+SUM pattern per column | Russian losses |
| `apc_delta` | APC Losses | Same | Same | Russian losses |
| `artillery_delta` | Artillery Losses | Same | Same (column: `field_artillery`) | Russian losses |
| `drone_delta` | Drone Losses | Same | Same | Russian losses |
| `missiles_launched` | Missiles Launched | `aerial_assaults.missile_attacks` | `SUM(launched)` per week (key: `time_start::date`) | Russian missile campaigns |
| `missiles_destroyed` | Missiles Destroyed | Same | `SUM(destroyed)` per week | Ukrainian air defense |
| `aid_total_eur` | Total Aid (EUR) | `economic_data.kiel_ukraine_aid` | `SUM(NULLIF(tot_sub_activity_value_eur,'')::numeric)` per week | All aid types (Kiel Institute) |
| `aid_military_eur` | Military Aid (EUR) | Same | Same `FILTER (WHERE aid_type_general = 'Military')` | Military aid only |
| `new_sanctions_entities` | New Sanctions | `economic_data.opensanctions_eu` | `COUNT(*)` by `first_seen` per week | EU sanctions entities |

### 4.3 Media Variables (from `war_datasets` database)

| Variable | Label | Source Table | SQL Approach | Notes |
|----------|-------|-------------|-------------|-------|
| `gdelt_tone` | GDELT Tone | `global_events.gdelt_weekly_varx` | `AVG(media_tone_mean)` per week | Global media tone (GKG) |
| `gdelt_nuclear_quotes` | GDELT Nuclear Quotes | Same | `SUM(nuclear_quote_count)` per week | Keyword-matched quotes |
| `gdelt_escalation_quotes` | GDELT Escalation Quotes | Same | `SUM(escalation_quote_count)` per week | Keyword-matched quotes |
| `gdelt_redline_quotes` | GDELT Red Line Quotes | Same | `SUM(redline_quote_count)` per week | "Red line" keyword matches |
| `gdelt_threat_quotes` | GDELT Threat Quotes | Same | `SUM(threat_quote_count)` per week | Threat keyword matches |
| `gdelt_ultimatum_quotes` | GDELT Ultimatum Quotes | Same | `SUM(ultimatum_quote_count)` per week | Ultimatum keyword matches |
| `gdelt_deter_quotes` | GDELT Deterrence Quotes | Same | `SUM(deter_quote_count)` per week | Deterrence keyword matches |
| `gdelt_media_volume` | GDELT Media Volume | Same | `SUM(media_volume_all)` per week | Total GKG records |
| `gdelt_media_volume_russia` | GDELT Russia Media Volume | Same | `SUM(media_volume_russia)` per week | Russia-specific GKG records |
| `gdelt_russia_share` | GDELT Russia Share | Same | `AVG(russia_share)` per week | Russia's share of overall media |

### 4.4 ACLED Data — What Exactly Is Pulled

**Source:** ACLED (Armed Conflict Location & Event Data) via REST API.
**Database table:** `conflict_events.acled_events` — 33 columns.
**Date range:** 2018-01-01 to 2025-03-01 (~224,197 events).
**Countries in dataset:** Ukraine (219,512 events, 97.9%) and Russia (4,685 events, 2.1%).

**What is aggregated for analytics:**

**Overall aggregation (4 variables):**
- `acled_events` — All event types, all countries, all actors
- `acled_fatalities` — All fatalities
- `acled_battles` — Events where `event_type = 'Battles'`
- `acled_explosions` — Events where `event_type = 'Explosions/Remote violence'`

**Actor-level breakdown (6 variables):**
- `acled_rus_events` — Events where `actor1 LIKE 'Military Forces of Russia%'`
- `acled_rus_fatalities` — Fatalities from Russian military actions
- `acled_rus_shelling` — Russian `sub_event_type = 'Shelling/artillery/missile attack'`
- `acled_ukr_events` — Events where `actor1 LIKE 'Military Forces of Ukraine%'`
- `acled_ukr_fatalities` — Fatalities from Ukrainian military actions
- `acled_ukr_shelling` — Ukrainian shelling/artillery/missile attacks

**Still available but NOT currently used:**
- `country` — Country-level breakdown (currently aggregated)
- `admin1/2/3`, `latitude/longitude` — Sub-national geolocations
- `civilian_targeting` — Whether civilians were targeted
- Other `sub_event_type` values beyond shelling
- `notes` — Free-text descriptions

### 4.5 GDELT Data — What Exactly Is Pulled

**Source:** Two data sources within GDELT:

#### 4.5.1 GDELT Weekly VARX (GKG-based, global media metrics)

**Database table:** `global_events.gdelt_weekly_varx` — 16 columns, pre-aggregated weekly.
**Date range:** 2021-12-27 to 2026-02-23 (216 weekly records).
**Source:** BigQuery GKG aggregation.

**All 11 columns now used in analytics:**
- `media_tone_mean` → `gdelt_tone` — Average tone of Russia/Ukraine-related GKG records
- `nuclear_quote_count` → `gdelt_nuclear_quotes` — Nuclear keyword matches
- `escalation_quote_count` → `gdelt_escalation_quotes` — Escalation keyword matches
- `redline_quote_count` → `gdelt_redline_quotes` — "Red line" keyword matches
- `threat_quote_count` → `gdelt_threat_quotes` — Threat keyword matches
- `ultimatum_quote_count` → `gdelt_ultimatum_quotes` — Ultimatum keyword matches
- `deter_quote_count` → `gdelt_deter_quotes` — Deterrence keyword matches
- `media_volume_all` → `gdelt_media_volume` — Total GKG records
- `media_volume_russia` → `gdelt_media_volume_russia` — Russia-specific GKG records
- `russia_share` → `gdelt_russia_share` — Russia's share of overall media volume

**Still available but NOT used:** `media_tone_std`, `media_negativity_mean`, `media_negativity_std` (low analytical value).

#### 4.5.2 GDELT Events (Bidirectional Threat Events)

**Database table:** `global_events.gdelt_events` — event-level records.
**Date range:** Feb 2022 – present (~293,000+ events, growing with backfill).
**Source:** GDELT 15-minute free file downloads, filtered on import.

**Import filter (applied in VPS script `update_gdelt.py`):**
```
EventRootCode = 13 (THREATEN) AND (
  Actor1CountryCode = 'RUS'  →  any target     (Russia threatening others)
  OR
  Actor1CountryCode IN (USA, UKR, GBR, DEU, FRA, POL, JPN, CAN, NLD, SWE, NOR, EUR, NATO)
  AND Actor2CountryCode = 'RUS'                  (Western/Ukrainian actors threatening Russia)
)
```

**Bidirectional pivot variables generated (per country pair):**
- `gdelt_russia_to_{country}_events` — Count of Russian threats toward that country per week
- `gdelt_russia_to_{country}_goldstein` — Average Goldstein scale (conflict intensity) per week
- `gdelt_russia_to_{country}_tone` — Average media tone per week
- `gdelt_{country}_to_russia_events` — Count of threats from that country toward Russia per week
- `gdelt_{country}_to_russia_goldstein` — Average Goldstein scale
- `gdelt_{country}_to_russia_tone` — Average media tone

**Country groups mapped:**
| GDELT Code | Variable Slug | Description |
|------------|---------------|-------------|
| USA | `us` | United States |
| UKR | `ukraine` | Ukraine |
| GBR | `uk` | United Kingdom |
| DEU | `germany` | Germany |
| FRA | `france` | France |
| POL | `poland` | Poland |
| JPN | `japan` | Japan |
| CAN | `canada` | Canada |
| NLD | `netherlands` | Netherlands |
| SWE | `sweden` | Sweden |
| NOR | `norway` | Norway |
| EUR | `eu` | European Union |
| NATO | `nato` | NATO |
| WST | `west` | West (generic) |
| CHN | `china` | China (target of Russian threats only) |

This generates ~45+ action variables (`*_events`) and ~90+ media variables (`*_goldstein`, `*_tone`).

---

## 5. Weekly Panel Construction

### 5.1 Time Alignment

All data sources use different native frequencies and date conventions:
- RRLS/NTS/CRLS: Daily documents → weekly via `DATE_TRUNC('week', date)`
- ACLED: Event-level dates → weekly via `DATE_TRUNC('week', event_date)`
- Personnel/Equipment: Daily cumulative totals → daily deltas via `LAG()` → weekly sums
- Missile attacks: Event timestamps (`time_start`) → weekly via `DATE_TRUNC('week', time_start::date)`
- Kiel aid: Announcement dates → weekly via `DATE_TRUNC('week', announcement_date_clean)`
- OpenSanctions: First-seen dates → weekly via `DATE_TRUNC('week', first_seen::date)`
- GDELT: Already weekly (column `week`)

### 5.2 Panel Assembly

1. Create a master date range of Mondays: `pd.date_range("2022-02-21", end_date, freq="W-MON")`
2. Left-join all 15 source DataFrames on the `week` column (base rhetoric, RRLS targets, NTS targets, ACLED overall, ACLED actors, equipment, missiles, aid aggregate, aid by donor, sanctions, GDELT VARX, GDELT bidirectional events)
3. Fill missing values:
   - **Count variables** (events, fatalities, losses, sanctions, actor-level counts): Fill NaN with `0` (absence = zero occurrences)
   - **Intensity/rate variables** (line intensity, tone, severity, aid EUR, GDELT tone): Forward-fill (carry last known value; absence = no new data, not a change)
   - **Special case:** `nts_severity_mean` is set to `0` for weeks where `nts_count = 0` (no NTS statements means zero severity, not a missing value)

### 5.3 Missing Data Handling

| Source | Missing Pattern | Treatment |
|--------|----------------|-----------|
| RRLS | Weeks with no relevant statements | Count → 0, intensity → NaN → ffill |
| NTS | ~51% of weeks have zero NTS | Count → 0, severity → explicitly set to 0 |
| ACLED | Very few gaps pre-Mar 2025 | Count → 0 |
| ACLED | **Ends Mar 2025** — trailing zeros | Flagged in metadata warnings |
| Kiel Aid | **Ends Oct 2025** — trailing zeros | Flagged in metadata warnings |
| GDELT | Weekly, no gaps | Direct join |
| Equipment | Occasional reporting gaps | LAG delta → GREATEST(0) to avoid negative corrections |

---

## 6. Actor-Level Breakdowns

### 6.1 RRLS Target Classification

Each RLS statement has a `target` field (free text). Targets are classified into 12 groups using pattern matching:

| Group | Pattern Keywords |
|-------|-----------------|
| `us` | "united states", "washington", "u.s.", "usa", "american" |
| `ukraine` | "ukraine", "kyiv", "zelensky", "ukrainian" |
| `nato` | "nato" |
| `eu` | "european union", "eu ", "brussels" |
| `uk` | "united kingdom", "britain", "british", "london" |
| `west` | "west", "western" |
| `japan` | "japan", "japanese", "tokyo" |
| `china` | "china", "chinese", "beijing" |
| `poland` | "poland", "polish", "warsaw" |
| `germany` | "germany", "german", "berlin" |
| `france` | "france", "french", "paris" |
| `other` | Everything that doesn't match above |

**Result:** Variables like `rrls_tgt_us`, `rrls_tgt_nato`, `rrls_tgt_ukraine`, etc. — weekly counts of RRLS targeting each group.

### 6.2 NTS Target Classification

Same classification applied to NTS `target` field. Produces `nts_tgt_us`, `nts_tgt_nato`, etc.

### 6.3 Aid Donor Classification

Each Kiel aid record has a `donor` field. Donors are classified into 13 groups:

| Group | Donor Names |
|-------|------------|
| `us` | "United States" |
| `eu` | "EU (Commission and Council)", "European Investment Bank", "European Bank for Reconstruction and Development" |
| `uk` | "United Kingdom" |
| `germany` | "Germany" |
| `japan` | "Japan" |
| `canada` | "Canada" |
| `france` | "France" |
| `denmark` | "Denmark" |
| `netherlands` | "Netherlands" |
| `sweden` | "Sweden" |
| `norway` | "Norway" |
| `poland` | "Poland" |
| `other` | All remaining donors |

**Result:** Variables like `aid_us_eur`, `aid_eu_eur`, `aid_germany_eur`, etc. — weekly aid in EUR from each donor group.

### 6.4 ACLED Actor-Level Breakdowns

The `actor1` field is classified into Russian vs Ukrainian military:
- **Russian military:** `actor1 LIKE 'Military Forces of Russia%'`
- **Ukrainian military:** `actor1 LIKE 'Military Forces of Ukraine%'`

Each side gets 3 variables: `*_events` (all event types), `*_fatalities` (sum of fatalities), `*_shelling` (sub_event_type = 'Shelling/artillery/missile attack').

### 6.5 GDELT Bidirectional Threat Events

The GDELT events table contains threat events (EventRootCode=13) with actor country codes. These are pivoted into weekly columns per country pair direction.

The `_GDELT_COUNTRY_RULES` mapping translates GDELT country codes (e.g., `USA`, `GBR`, `EUR`) to human-readable slugs (e.g., `us`, `uk`, `eu`). The `_pivot_gdelt_bidir()` function then creates columns like:
- `gdelt_russia_to_us_events`, `gdelt_russia_to_us_goldstein`, `gdelt_russia_to_us_tone`
- `gdelt_us_to_russia_events`, `gdelt_us_to_russia_goldstein`, `gdelt_us_to_russia_tone`

Event count columns are classified as ACTION variables; goldstein and tone columns as MEDIA variables.

### 6.6 Dynamic Variable Registration

Actor-level variables are discovered dynamically from the assembled panel columns:
- `rrls_tgt_*` → RHETORIC group
- `nts_tgt_*` → RHETORIC group
- `aid_*_eur` (excluding `aid_total_eur` and `aid_military_eur`) → ACTION group
- `gdelt_*_to_*_events` → ACTION group
- `gdelt_*_to_*_goldstein`, `gdelt_*_to_*_tone` → MEDIA group

All get human-readable labels auto-generated (e.g., `gdelt_russia_to_us_events` → "GDELT Threats RUS→US"). This means Granger tests, cross-correlations, and heatmaps automatically include all actor-level pairs without hardcoding.

---

## 7. Statistical Methods

### 7.1 Stationarity Testing (ADF)

**Method:** Augmented Dickey-Fuller test with automatic lag selection (AIC).
**Purpose:** Determine whether each time series has a unit root (non-stationary). Non-stationary series require differencing before Granger causality and VAR estimation to avoid spurious results.
**Threshold:** p < 0.05 → stationary; p ≥ 0.05 → non-stationary → first-differenced for subsequent tests.
**Applied to:** All rhetoric, action, and media variables.

### 7.2 Cross-Correlations

**Method:** Pearson correlation between standardized series at lags -12 to +12 weeks.
**Pre-processing:** Non-stationary series are first-differenced per ADF results. Both series are z-score standardized.
**Interpretation:**
- Positive lag = rhetoric variable leads the action variable by N weeks
- Negative lag = action variable leads the rhetoric variable by N weeks
- **CI bounds:** ±1.96/√N (approximately ±0.135 for N=210)
- Bars exceeding CI bounds indicate statistically significant correlation at that lag

**Pairs:** All RHETORIC × (ACTION + MEDIA) combinations (~3,894 pairs with actor-level + bidirectional variables).

### 7.3 Granger Causality

**Method:** Granger causality test (F-test and chi-squared variants) via `statsmodels.tsa.stattools.grangercausalitytests`.
**Concept:** Tests whether past values of variable X contain information that helps predict variable Y beyond Y's own past values. This is predictive causality, not structural causality.
**Parameters:**
- Lags tested: 1 through 8 weeks
- Both directions tested for every rhetoric × (action + media) pair
- Best lag selected by lowest F-test p-value
- Significance levels: * p<0.05, ** p<0.01, *** p<0.001

**Pre-processing:** Non-stationary series first-differenced. Minimum sample size: max_lag + 5 observations.

**Total tests:** ~7,788 directional tests (with actor-level + GDELT bidirectional variables).

**Heatmap visualization:** Shows -log10(p-value) — brighter = more significant. Stars for significance levels.

### 7.4 Vector Autoregression (VAR) + Impulse Response Functions (IRFs)

**Method:** VAR model fitted via `statsmodels.tsa.api.VAR`. Orthogonalized IRFs (Cholesky decomposition). Bootstrapped 95% confidence intervals (500 Monte Carlo replications).

**Two pre-specified models:**

| Model | Variables | Rationale |
|-------|-----------|-----------|
| **Model A (Core)** | `rrls_count`, `acled_events`, `personnel_delta`, `missiles_launched`, `aid_military_eur` | Core conflict + rhetoric + Western response |
| **Model B (Nuclear)** | `nts_count`, `acled_fatalities`, `gdelt_nuclear_quotes`, `drone_delta` | Nuclear rhetoric + conflict intensity + media amplification |

**Parameters:**
- Optimal lag order: Selected by AIC (max 8)
- IRF horizon: 0–20 weeks
- Bootstrap: 500 replications, seed=42 for reproducibility

**IRF interpretation:** Shows the dynamic response of one variable to a one-standard-deviation shock to another variable, traced out over 20 weeks. The 95% CI band indicates statistical significance — if the band excludes zero, the response is significant at that horizon.

**Cholesky ordering matters:** The first variable in the model ordering is assumed to be the most exogenous (least affected by contemporaneous shocks from other variables). The current ordering implies actions are somewhat more exogenous than rhetoric in Model A, and NTS rhetoric is most exogenous in Model B.

### 7.5 Local Projections (Jordà, 2005)

**Method:** For each horizon h = 1, ..., 20:
```
y_{t+h} = α + β_h · x_t + Σ_{j=1}^{4} (γ_j · x_{t-j} + δ_j · y_{t-j}) + ε_{t+h}
```

**Advantages over VAR IRFs:**
- Each horizon estimated independently — no compounding of misspecification
- More robust to model misspecification
- Can handle non-linearities better

**Disadvantages:**
- Noisier estimates (wider confidence intervals)
- No cross-equation restrictions (less efficient)

**Pre-specified pairs (37 total):**

**Core pairs (24):**
| Impulse | Response | Research Question |
|---------|----------|-------------------|
| `acled_fatalities` | `rrls_count` | Battlefield losses trigger rhetoric? |
| `personnel_delta` | `rrls_count` | Russian losses trigger rhetoric? |
| `rrls_count` | `aid_military_eur` | Rhetoric deters Western aid? |
| `nts_count` | `gdelt_nuclear_quotes` | Nuclear threats amplified by media? |
| `missiles_launched` | `nts_count` | Escalation triggers nuclear rhetoric? |
| `rrls_count` | `acled_events` | Rhetoric precedes conflict changes? |
| `new_sanctions_entities` | `rrls_count` | Sanctions trigger rhetoric? |
| `nts_count` | `acled_fatalities` | Nuclear threats change conflict intensity? |
| `tank_delta` | `rrls_count` | Tank losses trigger rhetoric? |
| `drone_delta` | `nts_count` | Drone losses trigger nuclear rhetoric? |
| `artillery_delta` | `rrls_count` | Artillery losses trigger rhetoric? |
| `apc_delta` | `rrls_count` | APC losses trigger rhetoric? |
| `acled_battles` | `rrls_count` | Battles trigger rhetoric? |
| `acled_explosions` | `nts_count` | Shelling triggers nuclear rhetoric? |
| `aid_total_eur` | `rrls_count` | Any aid triggers rhetoric? |
| `rrls_count` | `new_sanctions_entities` | Rhetoric triggers more sanctions? |
| `nts_count` | `aid_military_eur` | Nuclear threats deter military aid? |
| `gdelt_escalation_quotes` | `rrls_count` | Media escalation triggers rhetoric? |
| `rrls_count` | `gdelt_escalation_quotes` | Rhetoric amplified by media? |
| `nts_count` | `missiles_launched` | Nuclear threats deter missile launches? |
| `acled_fatalities` | `nts_severity_mean` | Fatalities increase NTS severity? |
| `missiles_launched` | `rrls_intensity_mean` | Missiles increase RRLS intensity? |
| `personnel_delta` | `nts_tone_mean` | Personnel losses increase NTS tone? |
| `missiles_destroyed` | `rrls_count` | Missile defense triggers rhetoric? |

**ACLED actor-level pairs (4):**
| Impulse | Response | Research Question |
|---------|----------|-------------------|
| `acled_rus_shelling` | `rrls_count` | Russian shelling triggers own rhetoric? |
| `acled_ukr_shelling` | `rrls_count` | Ukrainian shelling triggers Russian rhetoric? |
| `acled_rus_fatalities` | `nts_count` | Russian-caused fatalities trigger nuclear rhetoric? |
| `acled_ukr_events` | `rrls_count` | Ukrainian operations trigger Russian rhetoric? |

**GDELT bidirectional pairs (5):**
| Impulse | Response | Research Question |
|---------|----------|-------------------|
| `gdelt_russia_to_us_events` | `rrls_tgt_us` | Russian threats toward US predict RLS targeting US? |
| `rrls_count` | `gdelt_russia_to_ukraine_events` | RLS rhetoric → escalation in GDELT threats? |
| `gdelt_us_to_russia_events` | `rrls_count` | US threats toward Russia trigger rhetoric? |
| `gdelt_uk_to_russia_events` | `rrls_tgt_uk` | UK threats toward Russia trigger UK-targeted RLS? |
| `gdelt_ukraine_to_russia_events` | `nts_count` | Ukrainian threats trigger nuclear rhetoric? |

**GDELT extra media pairs (4):**
| Impulse | Response | Research Question |
|---------|----------|-------------------|
| `gdelt_redline_quotes` | `rrls_count` | Red line media coverage predicts actual RLS? |
| `gdelt_threat_quotes` | `nts_count` | Threat coverage predicts NTS? |
| `gdelt_media_volume_russia` | `rrls_count` | Russia media volume predicts rhetoric? |
| `rrls_count` | `gdelt_russia_share` | Rhetoric drives Russia's media share? |

**Confidence intervals:** OLS-based 95% CI using Newey-West-like residual-based standard errors.

### 7.6 Event Study

**Method:** Abnormal response analysis around rhetoric spike weeks.

**Spike detection:** Weeks where `rrls_count` or `nts_count` > mean + 1.5σ. Typically identifies ~10-15 RRLS spike weeks and ~5-8 NTS spike weeks.

**Procedure:**
1. Identify spike weeks (must have ≥8 weeks before and ≥8 weeks after)
2. For each spike week, compute baseline: mean of response variable in weeks -8 to -1
3. Compute abnormal response: actual value minus baseline, for window -4 to +8 weeks
4. Average across all spike episodes
5. Report mean abnormal response ± 1 SE

**Interpretation:** Positive abnormal response at t=0 or shortly after means the action/media variable increases above its baseline during/after rhetoric spikes. The vertical dashed red line at t=0 marks the spike week.

---

## 8. Dashboard Visualizations

### Section 1: Time Series Overview
- **Chart type:** Dual-axis line chart
- **Content:** Selected rhetoric variable (left y-axis, red) and action/media variable (right y-axis, blue) over time
- **Controls:** Rhetoric dropdown, Action/Media dropdown
- **Purpose:** Visual context for what the statistical tests are measuring

### Section 2: Cross-Correlation
- **Chart type:** Bar chart, lags -12 to +12
- **Content:** Cross-correlation coefficients per lag
- **Visual cues:** Significant bars (|r| > CI bound) colored solid blue; non-significant bars are transparent. Dashed orange horizontal lines show ±95% CI bounds
- **Controls:** Same rhetoric + action dropdowns as Section 1

### Section 3: Granger Causality Heatmap
- **Chart type:** Plotly heatmap
- **Content:** -log10(p-value) for each cause→effect pair. Stars for significance (* p<0.05, ** p<0.01, *** p<0.001)
- **Color scale:** Dark blue (non-significant) → light blue/white (highly significant)
- **Controls:** Direction toggle, Lag selector (1-8), **Cause group filter**, **Effect group filter**
- **Axes:** Cause variables on X-axis, Effect variables on Y-axis
- **Group filters:** With 151 variables, the full heatmap (33×118) is too large. Users must select a variable group (e.g., "RRLS (Core)", "ACLED (Russian Actor)", "GDELT Threats RUS→X") for each axis to render a readable subset
- **Auto-sizing:** Heatmap height scales dynamically based on number of effect variables

### Section 4: VAR Impulse Response Functions
- **Chart type:** Line chart with shaded 95% CI band
- **Content:** Response over 20 weeks to a 1-SD shock
- **Controls:** Model selector (Core/Nuclear), IRF pair selector, Cumulative toggle
- **Visual cues:** CI band in light blue; dashed horizontal line at y=0; model metadata shown below chart

### Section 5: Local Projection IRFs (Jordà)
- **Chart type:** Line chart with shaded 95% CI band
- **Content:** LP coefficient β_h at each horizon h = 1...20
- **Color:** Green (distinct from VAR's blue)
- **Controls:** LP pair selector dropdown

### Section 6: Event Study
- **Chart type:** Line chart with ±1 SE shaded band
- **Content:** Abnormal response around spike weeks, window -4 to +8
- **Visual cues:** Vertical dashed red line at t=0 (spike week); horizontal dotted line at y=0; orange color scheme
- **Controls:** Spike type (RRLS/NTS), Response variable dropdown
- **Below chart:** Number of spikes identified and threshold value

### Section 7: Diagnostics & Metadata
- **Content:** Data range, variable counts, warnings (truncated series), expandable tables
- **Expandable: Stationarity Tests** — Full ADF results table (variable, ADF statistic, p-value, stationary Y/N)
- **Expandable: Significant Granger Pairs** — Sorted table of all pairs with p<0.05 (cause, effect, best lag, p-value)

---

## 9. JSON Data Files

All files are exported to `public/data/` (development) and `data/` (gh-pages branch).

| File | Size | Content |
|------|------|---------|
| `analytics_timeseries.json` | ~1.1MB | 211 rows × 152 columns — the full weekly panel |
| `analytics_crosscorr.json` | ~4.0MB | 3,894 pairs × 25 lags — all rhetoric × action/media cross-correlations |
| `analytics_granger.json` | ~5.4MB | 7,788 directional tests × 8 lag levels — F-test + chi² p-values |
| `analytics_var.json` | ~120KB | 2 VAR models: optimal lag, AIC, all IRF pairs (21 horizons + CIs) |
| `analytics_lp.json` | ~55KB | 37 LP pairs × 20 horizons + CIs |
| `analytics_event_study.json` | ~180KB | 2 spike types × 57+ response vars × 13-point windows |
| `analytics_metadata.json` | ~29KB | 151 variable labels, rhetoric/action/media lists, stationarity results, warnings |

---

## 10. CI/CD Pipeline

### GitHub Actions Workflow: `update-data.yml`

```yaml
# Triggers:
# 1. repository_dispatch (from VPS pipeline after annotation completes)
# 2. schedule: daily at 04:30 UTC (safety net)
# 3. workflow_dispatch (manual)

Steps:
1. Checkout gh-pages branch
2. Setup Python 3.12
3. Install: psycopg2-binary numpy pandas statsmodels scipy
4. Sparse-checkout scripts from master branch
5. Run export_redlines_data.py → copies *.json to data/
6. Run export_analytics_data.py → copies analytics_*.json to data/
7. Git commit + push if data changed
```

**VPS trigger chain:**
```
Cron 03:00 UTC → run_pipeline.sh (annotation)
              → curl POST repository_dispatch
              → GitHub Actions update-data.yml
              → export scripts run
              → data/ updated on gh-pages
              → Dashboard shows fresh data
```

---

## 11. Interpretation Guide

### Reading the Cross-Correlation Chart

- **Positive lag (e.g., lag = +3):** The rhetoric variable at time t is correlated with the action variable at time t+3. This means rhetoric leads (predicts) the action variable by 3 weeks.
- **Negative lag (e.g., lag = -2):** The action variable at time t is correlated with the rhetoric variable at time t+2. This means the action variable leads rhetoric by 2 weeks.
- **Significance:** Bars that extend beyond the dashed CI lines are statistically significant at the 95% level.

### Reading the Granger Heatmap

- **Bright cells:** Strong statistical evidence that the "cause" variable Granger-causes the "effect" variable at the selected lag.
- **Stars:** *** means extremely strong evidence (p<0.001), ** strong (p<0.01), * moderate (p<0.05).
- **Toggle direction** to switch between "What actions trigger rhetoric?" and "Does rhetoric change actions?"
- **Change lag** to see how the pattern varies with different lag assumptions (1 week vs 8 weeks).

### Reading IRF Charts (VAR and LP)

- **Above zero line:** A positive shock to the impulse variable causes the response variable to increase.
- **Below zero line:** A positive shock causes the response variable to decrease.
- **CI band excludes zero:** The response is statistically significant at that horizon.
- **Cumulative IRF (VAR only):** Shows the total accumulated effect over time, not just the marginal response at each week.

### Reading the Event Study

- **t = 0 (red line):** The week when the rhetoric spike occurred.
- **Positive abnormal response:** The action variable was above its baseline during/after the spike.
- **Negative abnormal response:** The action variable was below its baseline.
- **Pre-spike pattern (t = -4 to -1):** If non-zero, suggests the action variable was already changing before the rhetoric spike (potential reverse causality or common driver).

### Causal Interpretation Caveats

**Granger causality ≠ structural causality.** A significant Granger test means X has predictive power for Y beyond Y's own history. It does NOT prove X causes Y. Common drivers (e.g., a major battlefield event simultaneously triggers rhetoric AND media coverage) can create Granger-significant relationships without direct causation.

**Omitted variable bias.** The bivariate Granger tests and LPs don't control for all confounders. The VAR models include multiple variables but may still omit important drivers.

**Multiple testing.** With ~7,788 Granger tests, we expect ~389 false positives at p<0.05 by chance alone. Results should be interpreted in the context of effect size, consistency across methods, and theoretical plausibility — not just p-values.

---

## 12. Limitations & Caveats

### Data Limitations

1. **ACLED ends March 2025** — Trailing zeros in acled_events/fatalities/battles/explosions from April 2025 onward. These zeros are real missing data, not actual zero conflict. Flagged in metadata warnings.

2. **Kiel aid data ends October 2025** — Kiel Institute's Ukraine Support Tracker has periodic update cycles. Aid variables show zeros after the last update.

3. **ACLED overall variables are NOT country-disaggregated** — Events from both Ukraine (97.9%) and Russia (2.1%) are aggregated in the `acled_events`/`acled_fatalities` variables. However, **actor-level breakdowns ARE available** (`acled_rus_*`, `acled_ukr_*`) which partially addresses this.

4. **GDELT weekly VARX is GLOBAL** — Media metrics (tone, quote counts, volume) cover worldwide English-language news, not country-specific coverage. However, **GDELT bidirectional events ARE country-specific** (`gdelt_russia_to_us_events`, etc.).

5. **GDELT bidirectional events cover THREATEN (EventRootCode=13) only** — Other event types (demand, protest, cooperate, etc.) are not captured. The import filter is intentionally narrow to focus on coercive signaling.

6. **Equipment/personnel losses are Ukrainian MOD estimates of Russian losses** — subject to inflation/propaganda bias.

7. **NTS sparsity** — With ~51% zero-weeks for NTS, large multivariate models involving NTS are underpowered. The VAR Model B (Nuclear) with 4 variables is at the feasibility limit.

8. **Forward-fill bias** — Intensity/severity variables are forward-filled during zero-count weeks. This assumes the "last known intensity" persists, which may not reflect reality.

### Methodological Limitations

9. **Cholesky ordering sensitivity** — VAR IRFs depend on variable ordering. The current ordering places the first variable as most exogenous. Different orderings would give different contemporaneous responses (though long-run effects are less sensitive).

10. **Stationarity-differencing trade-off** — First-differencing removes unit roots but also destroys level information. Some series may be better modeled in levels with trend controls.

11. **No structural identification** — None of the methods identify structural causal effects. An ideal approach would use instrumental variables or natural experiments, but these are scarce in this context.

12. **Weekly aggregation smoothing** — Aggregating to weekly frequency smooths out within-week dynamics. Daily analysis might reveal faster-moving relationships but would increase noise and missing-data problems.

---

## 13. File Inventory

| File | Action | Lines | Purpose |
|------|--------|-------|---------|
| `scripts/export_analytics_data.py` | NEW | ~1,200 | Python analysis pipeline (151 vars, 7 statistical methods) |
| `src/components/Analytics.tsx` | NEW | ~580 | React dashboard tab with grouped dropdowns + Granger filters |
| `src/types.ts` | MODIFIED | +88 lines | TypeScript interfaces for analytics data |
| `src/components/TabNav.tsx` | MODIFIED | +1 line | Tab navigation entry |
| `src/App.tsx` | MODIFIED | +2 lines | Import + conditional render |
| `.github/workflows/update-data.yml` | MODIFIED | +12 lines | Analytics export step |
| `docs/CAUSAL_ANALYTICS.md` | NEW | This file | Documentation |

### Dependencies Added

**Python (GitHub Actions):**
- `numpy` — Array operations, bootstrap
- `pandas` — DataFrame manipulation, panel assembly
- `statsmodels` — VAR, Granger causality, ADF tests
- `scipy` — Statistical distributions for CI computation
- `psycopg2-binary` — PostgreSQL connectivity (was already present)

**JavaScript (already present):**
- `react-plotly.js` / `plotly.js` — All chart rendering
- React 19 — Component framework
