#!/usr/bin/env python3
"""Export causal analytics data (Granger, VAR/IRF, LP, event study) to JSON."""

import json
import os
import warnings
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import psycopg2
import psycopg2.extras
from statsmodels.tsa.api import VAR
from statsmodels.tsa.stattools import adfuller, grangercausalitytests

warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=UserWarning)

# ── DB config ────────────────────────────────────────────────────────────────

_HOST = os.environ["DB_HOST"]
_PORT = int(os.environ.get("DB_PORT", "5432"))
_USER = os.environ["DB_USER"]
_PASS = os.environ["DB_PASSWORD"]

RL_DB = dict(host=_HOST, port=_PORT, dbname="redlines", user=_USER, password=_PASS)
WAR_DB = dict(host=_HOST, port=_PORT, dbname="war_datasets", user=_USER, password=_PASS)

OUT = Path(__file__).resolve().parent.parent / "public" / "data"
OUT.mkdir(parents=True, exist_ok=True)

# ── Variable definitions ─────────────────────────────────────────────────────

RHETORIC = [
    "rrls_count",
    "rrls_intensity_mean",
    "rrls_line_intensity_mean",
    "rrls_threat_intensity_mean",
    "nts_count",
    "nts_severity_mean",
    "nts_tone_mean",
    "nts_cond_mean",
    "nts_conseq_mean",
    "nts_spec_mean",
    "crls_count",
]
ACTION = [
    "acled_events",
    "acled_fatalities",
    "acled_battles",
    "acled_explosions",
    "personnel_delta",
    "tank_delta",
    "apc_delta",
    "artillery_delta",
    "drone_delta",
    "missiles_launched",
    "missiles_destroyed",
    "aid_total_eur",
    "aid_military_eur",
    "new_sanctions_entities",
    "acled_rus_events",
    "acled_rus_fatalities",
    "acled_rus_shelling",
    "acled_ukr_events",
    "acled_ukr_fatalities",
    "acled_ukr_shelling",
]
MEDIA = [
    "gdelt_tone",
    "gdelt_nuclear_quotes",
    "gdelt_escalation_quotes",
    "gdelt_redline_quotes",
    "gdelt_threat_quotes",
    "gdelt_ultimatum_quotes",
    "gdelt_deter_quotes",
    "gdelt_media_volume",
    "gdelt_media_volume_russia",
    "gdelt_russia_share",
]

VAR_LABELS = {
    "rrls_count": "RRLS Count",
    "rrls_intensity_mean": "RRLS Intensity (combined)",
    "rrls_line_intensity_mean": "RRLS Line Intensity",
    "rrls_threat_intensity_mean": "RRLS Threat Intensity",
    "nts_count": "NTS Count",
    "nts_severity_mean": "NTS Severity (combined)",
    "nts_tone_mean": "NTS Tone",
    "nts_cond_mean": "NTS Conditionality",
    "nts_conseq_mean": "NTS Consequences",
    "nts_spec_mean": "NTS Specificity",
    "crls_count": "CRLS Count",
    "acled_events": "ACLED Events",
    "acled_fatalities": "ACLED Fatalities",
    "acled_battles": "ACLED Battles",
    "acled_explosions": "ACLED Explosions/Remote Violence",
    "personnel_delta": "Personnel Losses",
    "tank_delta": "Tank Losses",
    "apc_delta": "APC Losses",
    "artillery_delta": "Artillery Losses",
    "drone_delta": "Drone Losses",
    "missiles_launched": "Missiles Launched",
    "missiles_destroyed": "Missiles Destroyed",
    "aid_total_eur": "Total Aid (EUR)",
    "aid_military_eur": "Military Aid (EUR)",
    "new_sanctions_entities": "New Sanctions",
    "gdelt_tone": "GDELT Tone",
    "gdelt_nuclear_quotes": "GDELT Nuclear Quotes",
    "gdelt_escalation_quotes": "GDELT Escalation Quotes",
    "gdelt_redline_quotes": "GDELT Red Line Quotes",
    "gdelt_threat_quotes": "GDELT Threat Quotes",
    "gdelt_ultimatum_quotes": "GDELT Ultimatum Quotes",
    "gdelt_deter_quotes": "GDELT Deterrence Quotes",
    "gdelt_media_volume": "GDELT Media Volume",
    "gdelt_media_volume_russia": "GDELT Media Volume (Russia)",
    "gdelt_russia_share": "GDELT Russia Share",
    # ACLED actor-level
    "acled_rus_events": "ACLED Russian Mil Events",
    "acled_rus_fatalities": "ACLED Russian Mil Fatalities",
    "acled_rus_shelling": "ACLED Russian Shelling",
    "acled_ukr_events": "ACLED Ukrainian Mil Events",
    "acled_ukr_fatalities": "ACLED Ukrainian Mil Fatalities",
    "acled_ukr_shelling": "ACLED Ukrainian Shelling",
}

# Priority pairs for Local Projections — expanded
LP_PAIRS = [
    ("acled_fatalities", "rrls_count"),
    ("personnel_delta", "rrls_count"),
    ("rrls_count", "aid_military_eur"),
    ("nts_count", "gdelt_nuclear_quotes"),
    ("missiles_launched", "nts_count"),
    ("rrls_count", "acled_events"),
    ("new_sanctions_entities", "rrls_count"),
    ("nts_count", "acled_fatalities"),
    # New pairs — equipment breakdowns
    ("tank_delta", "rrls_count"),
    ("drone_delta", "nts_count"),
    ("artillery_delta", "rrls_count"),
    ("apc_delta", "rrls_count"),
    # New pairs — ACLED breakdowns
    ("acled_battles", "rrls_count"),
    ("acled_explosions", "nts_count"),
    # New pairs — aid & sanctions
    ("aid_total_eur", "rrls_count"),
    ("rrls_count", "new_sanctions_entities"),
    ("nts_count", "aid_military_eur"),
    # New pairs — media
    ("gdelt_escalation_quotes", "rrls_count"),
    ("rrls_count", "gdelt_escalation_quotes"),
    ("nts_count", "missiles_launched"),
    # New pairs — severity dimensions
    ("acled_fatalities", "nts_severity_mean"),
    ("missiles_launched", "rrls_intensity_mean"),
    ("personnel_delta", "nts_tone_mean"),
    ("missiles_destroyed", "rrls_count"),
    # ACLED actor-level
    ("acled_rus_events", "rrls_count"),
    ("acled_rus_shelling", "nts_count"),
    ("acled_ukr_events", "rrls_count"),
    ("acled_ukr_shelling", "rrls_count"),
    ("rrls_count", "acled_rus_events"),
    ("nts_count", "acled_ukr_events"),
    # GDELT bidirectional (will only compute if columns exist from backfill)
    ("gdelt_russia_to_us_events", "rrls_count"),
    ("gdelt_russia_to_ukraine_events", "nts_count"),
    ("rrls_count", "gdelt_russia_to_us_events"),
    ("nts_count", "gdelt_russia_to_ukraine_events"),
    # GDELT extra media
    ("gdelt_redline_quotes", "rrls_count"),
    ("gdelt_threat_quotes", "nts_count"),
    ("gdelt_deter_quotes", "rrls_count"),
]


def save(data: Any, name: str) -> None:
    path = OUT / name
    with open(path, "w") as f:
        json.dump(data, f, default=_json_default, separators=(",", ":"))
    size = path.stat().st_size
    print(f"  {name}: {size // 1024}KB")


def _json_default(obj: Any) -> Any:
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        v = float(obj)
        return None if np.isnan(v) or np.isinf(v) else round(v, 6)
    if isinstance(obj, np.ndarray):
        return [_json_default(x) for x in obj.tolist()]
    if isinstance(obj, (pd.Timestamp,)):
        return obj.isoformat()[:10]
    return str(obj)


def q(conn: Any, sql: str) -> list[dict[str, Any]]:
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(sql)
        return [dict(r) for r in cur.fetchall()]


# ── Actor classification ─────────────────────────────────────────────────────

# Target patterns → actor group
_TARGET_RULES = [
    ("us", ["united states", "washington", "u.s.", "usa", "american"]),
    ("ukraine", ["ukraine", "kyiv", "zelensky", "ukrainian"]),
    ("nato", ["nato"]),
    ("eu", ["european union", "eu ", "brussels"]),
    ("uk", ["united kingdom", "britain", "british", "london"]),
    ("west", ["west", "western"]),
    ("japan", ["japan", "japanese", "tokyo"]),
    ("china", ["china", "chinese", "beijing"]),
    ("poland", ["poland", "polish", "warsaw"]),
    ("germany", ["germany", "german", "berlin"]),
    ("france", ["france", "french", "paris"]),
]

# Donor name → actor group
_DONOR_RULES = [
    ("us", ["United States"]),
    (
        "eu",
        [
            "EU (Commission and Council)",
            "European Investment Bank",
            "European Bank for Reconstruction and Development",
        ],
    ),
    ("uk", ["United Kingdom"]),
    ("germany", ["Germany"]),
    ("japan", ["Japan"]),
    ("canada", ["Canada"]),
    ("france", ["France"]),
    ("denmark", ["Denmark"]),
    ("netherlands", ["Netherlands"]),
    ("sweden", ["Sweden"]),
    ("norway", ["Norway"]),
    ("poland", ["Poland"]),
]


def _classify_actor(text: str, rules: list) -> str:
    """Classify a text string into an actor group."""
    t = text.lower().strip()
    for group, patterns in rules:
        for p in patterns:
            if p.lower() in t:
                return group
    return "other"


def _classify_targets(df: pd.DataFrame, prefix: str) -> pd.DataFrame:
    """Pivot target-level rows into weekly columns per actor group."""
    if df.empty:
        return pd.DataFrame(columns=pd.Index(["week"]))
    df["week"] = pd.to_datetime(df["week"])
    df["actor"] = df["target"].apply(lambda t: _classify_actor(str(t), _TARGET_RULES))
    grouped = df.groupby(["week", "actor"])["cnt"].sum().reset_index()
    pivoted = grouped.pivot(index="week", columns="actor", values="cnt").fillna(0)
    pivoted.columns = [f"{prefix}_tgt_{c}" for c in pivoted.columns]
    return pivoted.reset_index()


def _classify_donors(df: pd.DataFrame) -> pd.DataFrame:
    """Pivot donor-level rows into weekly columns per actor group."""
    if df.empty:
        return pd.DataFrame(columns=pd.Index(["week"]))
    df["week"] = pd.to_datetime(df["week"])
    df["actor"] = df["donor"].apply(lambda d: _classify_actor(str(d), _DONOR_RULES))
    grouped = df.groupby(["week", "actor"])["value"].sum().reset_index()
    pivoted = grouped.pivot(index="week", columns="actor", values="value").fillna(0)
    pivoted.columns = [f"aid_{c}_eur" for c in pivoted.columns]
    return pivoted.reset_index()


# GDELT country code → actor group mapping
_GDELT_COUNTRY_RULES = {
    "USA": "us",
    "UKR": "ukraine",
    "GBR": "uk",
    "DEU": "germany",
    "FRA": "france",
    "POL": "poland",
    "JPN": "japan",
    "CAN": "canada",
    "NLD": "netherlands",
    "SWE": "sweden",
    "NOR": "norway",
    "EUR": "eu",
    "NATO": "nato",
    "WST": "west",
    "CHN": "china",
    "RUS": "russia",
}


def _pivot_gdelt_bidir(df: pd.DataFrame) -> pd.DataFrame:
    """Pivot GDELT bidirectional events into weekly columns per direction."""
    if df.empty:
        return pd.DataFrame(columns=pd.Index(["week"]))

    # Map country codes to groups
    df["a1"] = df["actor1"].map(_GDELT_COUNTRY_RULES).fillna("other")
    df["a2"] = df["actor2"].map(_GDELT_COUNTRY_RULES).fillna("other")

    # Create direction label: "rus_to_us", "us_to_rus", etc.
    df["direction"] = df["a1"] + "_to_" + df["a2"]

    # Only keep directions involving Russia
    df = df[(df["a1"] == "russia") | (df["a2"] == "russia")].copy()
    # Skip russia_to_russia
    df = df[df["a1"] != df["a2"]]

    if df.empty:
        return pd.DataFrame(columns=pd.Index(["week"]))

    # Aggregate by week + direction
    grouped = (
        df.groupby(["week", "direction"])
        .agg(
            events=("events", "sum"),
            goldstein=("goldstein", "mean"),
            tone=("tone", "mean"),
            mentions=("mentions", "sum"),
        )
        .reset_index()
    )

    # Pivot: one column per direction × metric
    result = pd.DataFrame({"week": df["week"].unique()}).sort_values("week")
    for direction in grouped["direction"].unique():
        sub = grouped[grouped["direction"] == direction][
            ["week", "events", "goldstein", "tone"]
        ].copy()
        sub = sub.rename(
            columns={
                "events": f"gdelt_{direction}_events",
                "goldstein": f"gdelt_{direction}_goldstein",
                "tone": f"gdelt_{direction}_tone",
            }
        )
        result = result.merge(sub, on="week", how="left")

    return result


# ── 1. Build weekly time series ──────────────────────────────────────────────


def build_weekly_panel():
    """Query both DBs and assemble an aligned weekly panel."""
    print("Connecting to redlines DB...")
    rl = psycopg2.connect(**RL_DB)

    print("  Querying RRLS weekly...")
    rrls_rows = q(
        rl,
        """
        SELECT DATE_TRUNC('week', d.date)::date AS week,
               COUNT(*) AS rrls_count,
               AVG(CASE ra.line_intensity
                   WHEN 'Low' THEN 1 WHEN 'Moderate' THEN 2
                   WHEN 'High' THEN 3 WHEN 'Very High' THEN 4 END) AS rrls_line_intensity_mean,
               AVG(CASE ra.threat_intensity
                   WHEN 'Low' THEN 1 WHEN 'Moderate' THEN 2
                   WHEN 'High' THEN 3 WHEN 'Very High' THEN 4 END) AS rrls_threat_intensity_mean
        FROM rls_annotation ra
        JOIN document_chunk dc ON ra.chunk_id = dc.id
        JOIN document d ON dc.document_id = d.id
        WHERE ra.is_relevant AND d.date IS NOT NULL AND d.date >= '2022-02-21'
        GROUP BY DATE_TRUNC('week', d.date)
        ORDER BY week
    """,
    )
    df_rrls = pd.DataFrame(rrls_rows)
    if not df_rrls.empty:
        df_rrls["week"] = pd.to_datetime(df_rrls["week"])
        for c in ["rrls_line_intensity_mean", "rrls_threat_intensity_mean"]:
            df_rrls[c] = pd.to_numeric(df_rrls[c], errors="coerce")
        df_rrls["rrls_intensity_mean"] = (
            df_rrls["rrls_line_intensity_mean"] + df_rrls["rrls_threat_intensity_mean"]
        ) / 2

    print("  Querying NTS weekly...")
    nts_rows = q(
        rl,
        """
        SELECT DATE_TRUNC('week', d.date)::date AS week,
               COUNT(*) AS nts_count,
               AVG(CASE na.tone
                   WHEN 'Firm (Level 2)' THEN 2 WHEN 'Aggressive (Level 3)' THEN 3
                   WHEN 'Belligerent (Level 4)' THEN 4 WHEN 'Apocalyptic (Level 5)' THEN 5 END) AS nts_tone_mean,
               AVG(CASE na.conditionality
                   WHEN 'Conditional (Level 1)' THEN 1 WHEN 'Situational (Level 2)' THEN 2
                   WHEN 'Implicit Condition (Level 3)' THEN 3 WHEN 'Unconditional (Level 4)' THEN 4 END) AS nts_cond_mean,
               AVG(CASE na.consequences
                   WHEN 'Significant (Level 3)' THEN 3 WHEN 'Severe (Level 4)' THEN 4
                   WHEN 'Catastrophic (Level 5)' THEN 5 END) AS nts_conseq_mean,
               AVG(CASE na.specificity
                   WHEN 'Vague (Level 1)' THEN 1 WHEN 'General (Level 2)' THEN 2
                   WHEN 'Specific (Level 3)' THEN 3 WHEN 'Detailed (Level 4)' THEN 4
                   WHEN 'Explicit (Level 5)' THEN 5 END) AS nts_spec_mean
        FROM nts_annotation na
        JOIN document_chunk dc ON na.chunk_id = dc.id
        JOIN document d ON dc.document_id = d.id
        WHERE na.is_relevant AND d.date IS NOT NULL AND d.date >= '2022-02-21'
        GROUP BY DATE_TRUNC('week', d.date)
        ORDER BY week
    """,
    )
    df_nts = pd.DataFrame(nts_rows)
    if not df_nts.empty:
        df_nts["week"] = pd.to_datetime(df_nts["week"])
        for c in ["nts_tone_mean", "nts_cond_mean", "nts_conseq_mean", "nts_spec_mean"]:
            df_nts[c] = pd.to_numeric(df_nts[c], errors="coerce")
        df_nts["nts_severity_mean"] = df_nts[
            ["nts_tone_mean", "nts_cond_mean", "nts_conseq_mean", "nts_spec_mean"]
        ].mean(axis=1)

    print("  Querying CRLS weekly...")
    crls_rows = q(
        rl,
        """
        SELECT DATE_TRUNC('week', d.date)::date AS week,
               COUNT(*) AS crls_count
        FROM rls_annotation_third_pass tp
        JOIN document_chunk dc ON tp.chunk_id = dc.id
        JOIN document d ON dc.document_id = d.id
        WHERE tp.is_relevant AND tp.civilizational_framing
              AND d.date IS NOT NULL AND d.date >= '2022-02-21'
        GROUP BY DATE_TRUNC('week', d.date)
        ORDER BY week
    """,
    )
    df_crls = pd.DataFrame(crls_rows)
    if not df_crls.empty:
        df_crls["week"] = pd.to_datetime(df_crls["week"])

    # ── Actor-level RRLS: target classification ──
    print("  Querying RRLS by target actor...")
    rrls_target_rows = q(
        rl,
        """
        SELECT DATE_TRUNC('week', d.date)::date AS week,
               ra.target,
               COUNT(*) AS cnt
        FROM rls_annotation ra
        JOIN document_chunk dc ON ra.chunk_id = dc.id
        JOIN document d ON dc.document_id = d.id
        WHERE ra.is_relevant AND d.date IS NOT NULL AND d.date >= '2022-02-21'
              AND ra.target IS NOT NULL
        GROUP BY DATE_TRUNC('week', d.date), ra.target
        ORDER BY week
    """,
    )
    df_rrls_tgt = _classify_targets(pd.DataFrame(rrls_target_rows), "rrls")

    # ── Actor-level NTS: target classification ──
    print("  Querying NTS by target actor...")
    nts_target_rows = q(
        rl,
        """
        SELECT DATE_TRUNC('week', d.date)::date AS week,
               na.target,
               COUNT(*) AS cnt
        FROM nts_annotation na
        JOIN document_chunk dc ON na.chunk_id = dc.id
        JOIN document d ON dc.document_id = d.id
        WHERE na.is_relevant AND d.date IS NOT NULL AND d.date >= '2022-02-21'
              AND na.target IS NOT NULL
        GROUP BY DATE_TRUNC('week', d.date), na.target
        ORDER BY week
    """,
    )
    df_nts_tgt = _classify_targets(pd.DataFrame(nts_target_rows), "nts")

    rl.close()

    # ── War datasets ──
    print("Connecting to war_datasets DB...")
    war = psycopg2.connect(**WAR_DB)

    print("  Querying ACLED weekly...")
    acled_rows = q(
        war,
        """
        SELECT DATE_TRUNC('week', event_date)::date AS week,
               COUNT(*) AS acled_events,
               COALESCE(SUM(fatalities), 0) AS acled_fatalities,
               COUNT(*) FILTER (WHERE event_type = 'Battles') AS acled_battles,
               COUNT(*) FILTER (WHERE event_type = 'Explosions/Remote violence') AS acled_explosions
        FROM conflict_events.acled_events
        WHERE event_date >= '2022-02-21'
        GROUP BY DATE_TRUNC('week', event_date)
        ORDER BY week
    """,
    )
    df_acled = pd.DataFrame(acled_rows)
    if not df_acled.empty:
        df_acled["week"] = pd.to_datetime(df_acled["week"])

    print("  Querying ACLED by actor (RUS vs UKR military)...")
    acled_actor_rows = q(
        war,
        """
        SELECT DATE_TRUNC('week', event_date)::date AS week,
               CASE WHEN actor1 LIKE 'Military Forces of Russia%%'
                    THEN 'rus' ELSE 'ukr' END AS side,
               COUNT(*) AS events,
               COALESCE(SUM(fatalities), 0) AS fatalities,
               COUNT(*) FILTER (WHERE sub_event_type = 'Shelling/artillery/missile attack') AS shelling
        FROM conflict_events.acled_events
        WHERE event_date >= '2022-02-21'
          AND (actor1 LIKE 'Military Forces of Russia%%'
               OR actor1 LIKE 'Military Forces of Ukraine%%')
        GROUP BY DATE_TRUNC('week', event_date),
                 CASE WHEN actor1 LIKE 'Military Forces of Russia%%'
                      THEN 'rus' ELSE 'ukr' END
        ORDER BY week
    """,
    )
    df_acled_actor = pd.DataFrame(acled_actor_rows)
    if not df_acled_actor.empty:
        df_acled_actor["week"] = pd.to_datetime(df_acled_actor["week"])
        # Pivot: one column per side × metric
        pivoted_parts = []
        for side in ["rus", "ukr"]:
            sub = df_acled_actor[df_acled_actor["side"] == side][
                ["week", "events", "fatalities", "shelling"]
            ].copy()
            sub = sub.rename(
                columns={
                    "events": f"acled_{side}_events",
                    "fatalities": f"acled_{side}_fatalities",
                    "shelling": f"acled_{side}_shelling",
                }
            )
            pivoted_parts.append(sub)
        if len(pivoted_parts) == 2:
            df_acled_actor = pivoted_parts[0].merge(
                pivoted_parts[1], on="week", how="outer"
            )
        elif len(pivoted_parts) == 1:
            df_acled_actor = pivoted_parts[0]
    else:
        df_acled_actor = pd.DataFrame(columns=pd.Index(["week"]))

    print("  Querying personnel weekly...")
    pers_rows = q(
        war,
        """
        WITH daily AS (
            SELECT date,
                   personnel - LAG(personnel) OVER (ORDER BY date) AS delta
            FROM equipment_losses.personnel_daily
            WHERE date >= '2022-02-21'
        )
        SELECT DATE_TRUNC('week', date)::date AS week,
               SUM(GREATEST(delta, 0)) AS personnel_delta
        FROM daily WHERE delta IS NOT NULL
        GROUP BY DATE_TRUNC('week', date)
        ORDER BY week
    """,
    )
    df_pers = pd.DataFrame(pers_rows)
    if not df_pers.empty:
        df_pers["week"] = pd.to_datetime(df_pers["week"])

    print("  Querying equipment weekly...")
    equip_rows = q(
        war,
        """
        WITH daily AS (
            SELECT date,
                   tank - LAG(tank) OVER (ORDER BY date) AS tank_d,
                   apc - LAG(apc) OVER (ORDER BY date) AS apc_d,
                   field_artillery - LAG(field_artillery) OVER (ORDER BY date) AS art_d,
                   drone - LAG(drone) OVER (ORDER BY date) AS drone_d
            FROM equipment_losses.equipment_daily
            WHERE date >= '2022-02-21'
        )
        SELECT DATE_TRUNC('week', date)::date AS week,
               SUM(GREATEST(tank_d, 0)) AS tank_delta,
               SUM(GREATEST(apc_d, 0)) AS apc_delta,
               SUM(GREATEST(art_d, 0)) AS artillery_delta,
               SUM(GREATEST(drone_d, 0)) AS drone_delta
        FROM daily WHERE tank_d IS NOT NULL
        GROUP BY DATE_TRUNC('week', date)
        ORDER BY week
    """,
    )
    df_equip = pd.DataFrame(equip_rows)
    if not df_equip.empty:
        df_equip["week"] = pd.to_datetime(df_equip["week"])

    print("  Querying missiles weekly...")
    missile_rows = q(
        war,
        """
        SELECT DATE_TRUNC('week', time_start::date)::date AS week,
               SUM(launched) AS missiles_launched,
               SUM(destroyed) AS missiles_destroyed
        FROM aerial_assaults.missile_attacks
        WHERE time_start >= '2022-02-21'
        GROUP BY DATE_TRUNC('week', time_start::date)
        ORDER BY week
    """,
    )
    df_missiles = pd.DataFrame(missile_rows)
    if not df_missiles.empty:
        df_missiles["week"] = pd.to_datetime(df_missiles["week"])

    print("  Querying aid weekly...")
    aid_rows = q(
        war,
        """
        SELECT DATE_TRUNC('week', announcement_date_clean)::date AS week,
               SUM(NULLIF(tot_sub_activity_value_eur, '')::numeric) AS aid_total_eur,
               SUM(NULLIF(tot_sub_activity_value_eur, '')::numeric)
                   FILTER (WHERE aid_type_general = 'Military') AS aid_military_eur
        FROM economic_data.kiel_ukraine_aid
        WHERE announcement_date_clean >= '2022-02-21'
        GROUP BY DATE_TRUNC('week', announcement_date_clean)
        ORDER BY week
    """,
    )
    df_aid = pd.DataFrame(aid_rows)
    if not df_aid.empty:
        df_aid["week"] = pd.to_datetime(df_aid["week"])

    print("  Querying sanctions weekly...")
    sanctions_rows = q(
        war,
        """
        SELECT DATE_TRUNC('week', first_seen::date)::date AS week,
               COUNT(*) AS new_sanctions_entities
        FROM economic_data.opensanctions_eu
        WHERE first_seen::date >= '2022-02-21'
        GROUP BY DATE_TRUNC('week', first_seen::date)
        ORDER BY week
    """,
    )
    df_sanctions = pd.DataFrame(sanctions_rows)
    if not df_sanctions.empty:
        df_sanctions["week"] = pd.to_datetime(df_sanctions["week"])

    print("  Querying aid by donor...")
    aid_donor_rows = q(
        war,
        """
        SELECT DATE_TRUNC('week', announcement_date_clean)::date AS week,
               donor,
               SUM(NULLIF(tot_sub_activity_value_eur, '')::numeric) AS value
        FROM economic_data.kiel_ukraine_aid
        WHERE announcement_date_clean >= '2022-02-21'
              AND NULLIF(tot_sub_activity_value_eur, '') IS NOT NULL
        GROUP BY DATE_TRUNC('week', announcement_date_clean), donor
        ORDER BY week
    """,
    )
    df_aid_donor = _classify_donors(pd.DataFrame(aid_donor_rows))

    print("  Querying GDELT weekly VARX (all columns)...")
    gdelt_rows = q(
        war,
        """
        SELECT DATE_TRUNC('week', week)::date AS gdelt_week,
               AVG(media_tone_mean) AS gdelt_tone,
               SUM(nuclear_quote_count) AS gdelt_nuclear_quotes,
               SUM(escalation_quote_count) AS gdelt_escalation_quotes,
               SUM(redline_quote_count) AS gdelt_redline_quotes,
               SUM(threat_quote_count) AS gdelt_threat_quotes,
               SUM(ultimatum_quote_count) AS gdelt_ultimatum_quotes,
               SUM(deter_quote_count) AS gdelt_deter_quotes,
               SUM(media_volume_all) AS gdelt_media_volume,
               SUM(media_volume_russia) AS gdelt_media_volume_russia,
               AVG(russia_share) AS gdelt_russia_share
        FROM global_events.gdelt_weekly_varx
        WHERE week >= '2022-02-21'
        GROUP BY DATE_TRUNC('week', week)
        ORDER BY gdelt_week
    """,
    )
    df_gdelt = pd.DataFrame(gdelt_rows)
    if not df_gdelt.empty:
        df_gdelt = df_gdelt.rename(columns={"gdelt_week": "week"})
        df_gdelt["week"] = pd.to_datetime(df_gdelt["week"])

    # ── GDELT bidirectional events (RUS→target and target→RUS) ──
    print("  Querying GDELT bidirectional events...")
    gdelt_bidir_rows = q(
        war,
        """
        SELECT DATE_TRUNC('week', to_date(sqldate::text, 'YYYYMMDD'))::date AS week,
               actor1countrycode AS actor1,
               actor2countrycode AS actor2,
               COUNT(*) AS events,
               AVG(goldsteinscale) AS goldstein,
               AVG(avgtone) AS tone,
               SUM(nummentions) AS mentions
        FROM global_events.gdelt_events
        WHERE sqldate >= 20220221
          AND actor2countrycode IS NOT NULL
          AND actor2countrycode != ''
        GROUP BY DATE_TRUNC('week', to_date(sqldate::text, 'YYYYMMDD')),
                 actor1countrycode, actor2countrycode
        ORDER BY week
    """,
    )
    df_gdelt_bidir = pd.DataFrame(gdelt_bidir_rows)
    if not df_gdelt_bidir.empty:
        df_gdelt_bidir["week"] = pd.to_datetime(df_gdelt_bidir["week"])
    else:
        df_gdelt_bidir = pd.DataFrame(columns=pd.Index(["week"]))

    war.close()

    # ── Pivot GDELT bidirectional ──
    print("  Pivoting GDELT bidirectional events...")
    df_gdelt_bidir_pivot = _pivot_gdelt_bidir(df_gdelt_bidir)

    # ── Assemble panel ──
    print("  Assembling weekly panel...")
    # Determine end date from data
    all_dates = []
    for df in [
        df_rrls,
        df_nts,
        df_crls,
        df_acled,
        df_pers,
        df_equip,
        df_missiles,
        df_aid,
        df_sanctions,
        df_gdelt,
        df_acled_actor,
        df_gdelt_bidir_pivot,
    ]:
        if not df.empty and "week" in df.columns:
            all_dates.append(df["week"].max())

    end_date = max(all_dates) if all_dates else pd.Timestamp("2026-03-03")
    weeks = pd.date_range("2022-02-21", end_date, freq="W-MON")
    panel = pd.DataFrame({"week": weeks})

    # Left-join all
    dfs = {
        "rrls": df_rrls,
        "nts": df_nts,
        "crls": df_crls,
        "acled": df_acled,
        "acled_actor": df_acled_actor,
        "pers": df_pers,
        "equip": df_equip,
        "missiles": df_missiles,
        "aid": df_aid,
        "sanctions": df_sanctions,
        "gdelt": df_gdelt,
        "gdelt_bidir": df_gdelt_bidir_pivot,
        "rrls_tgt": df_rrls_tgt,
        "nts_tgt": df_nts_tgt,
        "aid_donor": df_aid_donor,
    }
    for name, df in dfs.items():
        if not df.empty and "week" in df.columns:
            panel = panel.merge(df, on="week", how="left")

    # Fill counts with 0, intensities with forward-fill
    count_cols = [
        "rrls_count",
        "nts_count",
        "crls_count",
        "acled_events",
        "acled_fatalities",
        "acled_battles",
        "acled_explosions",
        "acled_rus_events",
        "acled_rus_fatalities",
        "acled_rus_shelling",
        "acled_ukr_events",
        "acled_ukr_fatalities",
        "acled_ukr_shelling",
        "personnel_delta",
        "tank_delta",
        "apc_delta",
        "artillery_delta",
        "drone_delta",
        "missiles_launched",
        "missiles_destroyed",
        "new_sanctions_entities",
        "gdelt_nuclear_quotes",
        "gdelt_escalation_quotes",
        "gdelt_redline_quotes",
        "gdelt_threat_quotes",
        "gdelt_ultimatum_quotes",
        "gdelt_deter_quotes",
        "gdelt_media_volume",
        "gdelt_media_volume_russia",
    ]
    # Also fill all actor-level columns with 0 (RRLS/NTS targets, aid donors, GDELT bidir)
    actor_cols = [
        c
        for c in panel.columns
        if c.startswith(("rrls_tgt_", "nts_tgt_", "aid_", "gdelt_"))
        and c not in count_cols
        and c
        not in ["aid_total_eur", "aid_military_eur", "gdelt_tone", "gdelt_russia_share"]
    ]
    # GDELT bidir event counts → fill 0
    gdelt_bidir_event_cols = [c for c in actor_cols if c.endswith("_events")]
    count_cols += gdelt_bidir_event_cols + [
        c
        for c in actor_cols
        if c not in gdelt_bidir_event_cols and not c.endswith(("_goldstein", "_tone"))
    ]

    for c in count_cols:
        if c in panel.columns:
            panel[c] = pd.to_numeric(panel[c], errors="coerce").fillna(0)

    intensity_cols = [
        "rrls_line_intensity_mean",
        "rrls_threat_intensity_mean",
        "rrls_intensity_mean",
        "nts_tone_mean",
        "nts_cond_mean",
        "nts_conseq_mean",
        "nts_spec_mean",
        "nts_severity_mean",
        "gdelt_tone",
        "gdelt_russia_share",
        "aid_total_eur",
        "aid_military_eur",
    ]
    # GDELT bidir goldstein/tone cols → forward-fill
    gdelt_bidir_rate_cols = [
        c
        for c in panel.columns
        if c.startswith("gdelt_")
        and (c.endswith("_goldstein") or c.endswith("_tone"))
        and c not in intensity_cols
        and c != "gdelt_tone"
    ]
    intensity_cols += gdelt_bidir_rate_cols
    for c in intensity_cols:
        if c in panel.columns:
            panel[c] = pd.to_numeric(panel[c], errors="coerce")
            panel[c] = panel[c].ffill()

    # Composite scores for rows where underlying counts are 0
    if "nts_severity_mean" in panel.columns and "nts_count" in panel.columns:
        panel.loc[panel["nts_count"] == 0, "nts_severity_mean"] = 0

    # ── Dynamically register actor-level variables ──
    for c in panel.columns:
        if c.startswith("rrls_tgt_") and c not in VAR_LABELS:
            actor = c.replace("rrls_tgt_", "").upper()
            VAR_LABELS[c] = f"RRLS targeting {actor}"
            if c not in RHETORIC:
                RHETORIC.append(c)
        elif c.startswith("nts_tgt_") and c not in VAR_LABELS:
            actor = c.replace("nts_tgt_", "").upper()
            VAR_LABELS[c] = f"NTS targeting {actor}"
            if c not in RHETORIC:
                RHETORIC.append(c)
        elif c.startswith("aid_") and c.endswith("_eur") and c not in VAR_LABELS:
            actor = c.replace("aid_", "").replace("_eur", "").upper()
            VAR_LABELS[c] = f"Aid from {actor} (EUR)"
            if c not in ACTION:
                ACTION.append(c)
        elif c.startswith("gdelt_") and c not in VAR_LABELS and c not in MEDIA:
            # GDELT bidirectional: gdelt_russia_to_us_events → "GDELT RUS→US Events"
            parts = c.replace("gdelt_", "").rsplit("_", 1)
            if len(parts) == 2:
                direction, metric = parts
                direction_label = (
                    direction.replace("russia_to_", "RUS→")
                    .replace("_to_russia", "→RUS")
                    .upper()
                )
                metric_label = metric.capitalize()
                VAR_LABELS[c] = f"GDELT {direction_label} {metric_label}"
                if metric in ("events", "mentions"):
                    if c not in ACTION:
                        ACTION.append(c)
                elif metric in ("goldstein", "tone"):
                    if c not in MEDIA:
                        MEDIA.append(c)

    print(f"  Panel: {len(panel)} weeks × {len(panel.columns)} columns")
    print(
        f"  Actor vars: {len([c for c in panel.columns if 'tgt_' in c or (c.startswith('aid_') and c not in ['aid_total_eur', 'aid_military_eur'])])} columns"
    )
    return panel


# ── 2. Statistical computations ─────────────────────────────────────────────


def adf_test(series: pd.Series) -> dict:
    """Augmented Dickey-Fuller test."""
    clean = series.dropna()
    if len(clean) < 20:
        return {"statistic": None, "pvalue": None, "stationary": None}
    try:
        result = adfuller(clean, autolag="AIC")
        return {
            "statistic": float(result[0]),
            "pvalue": float(result[1]),
            "stationary": bool(result[1] < 0.05),
        }
    except Exception:
        return {"statistic": None, "pvalue": None, "stationary": None}


def compute_stationarity(panel: pd.DataFrame, variables: list) -> dict:
    """Run ADF on all variables, return dict."""
    results = {}
    for var in variables:
        if var in panel.columns:
            results[var] = adf_test(panel[var])
    return results


def compute_cross_correlations(panel: pd.DataFrame, stationarity: dict) -> list:
    """Cross-correlations for all rhetoric × (action + media) pairs."""
    results = []
    rhet_vars = [v for v in RHETORIC if v in panel.columns]
    other_vars = [v for v in ACTION + MEDIA if v in panel.columns]
    n = len(panel)
    ci = 1.96 / np.sqrt(n) if n > 0 else 0

    for rv in rhet_vars:
        for av in other_vars:
            s1 = _prepare_series(panel, rv, stationarity)
            s2 = _prepare_series(panel, av, stationarity)
            if s1 is None or s2 is None:
                continue

            # Standardize
            s1 = (s1 - s1.mean()) / (s1.std() + 1e-10)
            s2 = (s2 - s2.mean()) / (s2.std() + 1e-10)

            lags_out = []
            for lag in range(-12, 13):
                if lag > 0:
                    r = (
                        s1.iloc[lag:]
                        .reset_index(drop=True)
                        .corr(s2.iloc[:-lag].reset_index(drop=True))
                    )
                elif lag < 0:
                    r = (
                        s1.iloc[:lag]
                        .reset_index(drop=True)
                        .corr(s2.iloc[-lag:].reset_index(drop=True))
                    )
                else:
                    r = s1.corr(s2)

                lags_out.append(
                    {
                        "lag": lag,
                        "r": float(r) if not np.isnan(r) else 0,
                    }
                )

            results.append(
                {
                    "rhetoric_var": rv,
                    "action_var": av,
                    "rhetoric_label": VAR_LABELS.get(rv, rv),
                    "action_label": VAR_LABELS.get(av, av),
                    "correlations": lags_out,
                    "ci_bound": float(ci),
                }
            )

    return results


def _prepare_series(panel, var, stationarity):
    """Get series, differencing if non-stationary."""
    if var not in panel.columns:
        return None
    s = panel[var].copy()
    if s.isna().all():
        return None
    s = s.fillna(0)
    st = stationarity.get(var, {})
    if st.get("stationary") is False:
        s = s.diff().dropna()
    return s


def compute_granger(panel: pd.DataFrame, stationarity: dict) -> list:
    """Granger causality tests for all directional pairs."""
    results = []
    rhet_vars = [v for v in RHETORIC if v in panel.columns]
    other_vars = [v for v in ACTION + MEDIA if v in panel.columns]
    max_lag = 8

    all_pairs = []
    for rv in rhet_vars:
        for av in other_vars:
            all_pairs.append((av, rv))  # action → rhetoric
            all_pairs.append((rv, av))  # rhetoric → action

    for cause, effect in all_pairs:
        s_cause = _prepare_series(panel, cause, stationarity)
        s_effect = _prepare_series(panel, effect, stationarity)
        if s_cause is None or s_effect is None:
            continue

        # Align lengths
        min_len = min(len(s_cause), len(s_effect))
        if min_len < max_lag + 5:
            continue
        s_cause = s_cause.iloc[-min_len:].reset_index(drop=True)
        s_effect = s_effect.iloc[-min_len:].reset_index(drop=True)

        data = pd.DataFrame({"effect": s_effect, "cause": s_cause}).dropna()
        if len(data) < max_lag + 5:
            continue

        lags_out = {}
        best_p = 1.0
        best_lag = 1

        for lag in range(1, max_lag + 1):
            try:
                test = grangercausalitytests(
                    data[["effect", "cause"]], maxlag=lag, verbose=False
                )
                p_f = test[lag][0]["ssr_ftest"][1]
                p_chi2 = test[lag][0]["ssr_chi2test"][1]
                lags_out[str(lag)] = {
                    "f_pvalue": float(p_f),
                    "chi2_pvalue": float(p_chi2),
                }
                if p_f < best_p:
                    best_p = p_f
                    best_lag = lag
            except Exception:
                lags_out[str(lag)] = {"f_pvalue": 1.0, "chi2_pvalue": 1.0}

        results.append(
            {
                "cause": cause,
                "effect": effect,
                "cause_label": VAR_LABELS.get(cause, cause),
                "effect_label": VAR_LABELS.get(effect, effect),
                "lags": lags_out,
                "best_lag": best_lag,
                "best_pvalue": float(best_p),
            }
        )

    return results


def compute_var_irfs(panel: pd.DataFrame, stationarity: dict) -> list:
    """Fit 2 pre-specified VAR models, compute IRFs with bootstrap CIs."""
    models_spec = [
        {
            "name": "Model A (Core)",
            "variables": [
                "rrls_count",
                "acled_events",
                "personnel_delta",
                "missiles_launched",
                "aid_military_eur",
            ],
        },
        {
            "name": "Model B (Nuclear)",
            "variables": [
                "nts_count",
                "acled_fatalities",
                "gdelt_nuclear_quotes",
                "drone_delta",
            ],
        },
    ]

    results = []
    for spec in models_spec:
        var_cols = [v for v in spec["variables"] if v in panel.columns]
        if len(var_cols) < 2:
            continue

        # Prepare data: difference non-stationary
        data = pd.DataFrame()
        for v in var_cols:
            s = panel[v].fillna(0).copy()
            st = stationarity.get(v, {})
            if st.get("stationary") is False:
                s = s.diff()
            data[v] = s
        data = data.dropna()

        if len(data) < 30:
            continue

        # Fit VAR with AIC-optimal lag
        try:
            model = VAR(data)
            best_lag = model.select_order(maxlags=8).aic
            if best_lag < 1:
                best_lag = 1
            fit = model.fit(best_lag)
        except Exception:
            continue

        # IRFs: orthogonalized, 21 periods
        horizons = 21
        try:
            irf = fit.irf(horizons)
        except Exception:
            continue

        # Bootstrap CIs
        try:
            irf_ci = fit.irf_errband_mc(orth=True, repl=500, steps=horizons, seed=42)
        except Exception:
            irf_ci = None

        irfs_dict = {}
        for i, imp in enumerate(var_cols):
            for j, resp in enumerate(var_cols):
                key = f"{imp} -> {resp}"
                point = irf.orth_irfs[:, j, i].tolist()
                cumul = np.cumsum(point).tolist()

                ci_lo = ci_hi = cum_lo = cum_hi = None
                if irf_ci is not None:
                    try:
                        ci_lo = irf_ci[0][:, j, i].tolist()
                        ci_hi = irf_ci[1][:, j, i].tolist()
                        cum_lo = np.cumsum(ci_lo).tolist()
                        cum_hi = np.cumsum(ci_hi).tolist()
                    except Exception:
                        pass

                irfs_dict[key] = {
                    "impulse": imp,
                    "response": resp,
                    "impulse_label": VAR_LABELS.get(imp, imp),
                    "response_label": VAR_LABELS.get(resp, resp),
                    "horizons": list(range(horizons + 1)),
                    "point": point,
                    "ci_lower": ci_lo,
                    "ci_upper": ci_hi,
                    "cumulative": cumul,
                    "cum_ci_lower": cum_lo,
                    "cum_ci_upper": cum_hi,
                }

        results.append(
            {
                "name": spec["name"],
                "variables": var_cols,
                "variable_labels": {v: VAR_LABELS.get(v, v) for v in var_cols},
                "optimal_lag": int(best_lag),
                "aic": float(fit.aic) if hasattr(fit, "aic") else None,
                "irfs": irfs_dict,
            }
        )

    return results


def compute_local_projections(panel: pd.DataFrame, stationarity: dict) -> list:
    """Local Projections (Jordà) for priority variable pairs."""
    results = []
    max_h = 20
    n_controls = 4

    for impulse, response in LP_PAIRS:
        if impulse not in panel.columns or response not in panel.columns:
            continue

        x = _prepare_series(panel, impulse, stationarity)
        y = _prepare_series(panel, response, stationarity)
        if x is None or y is None:
            continue

        min_len = min(len(x), len(y))
        x = x.iloc[-min_len:].reset_index(drop=True)
        y = y.iloc[-min_len:].reset_index(drop=True)

        horizons = []
        points = []
        ci_lo = []
        ci_hi = []

        for h in range(1, max_h + 1):
            if h + n_controls >= len(y):
                break

            # y_{t+h} = α + β·x_t + controls_{t-1..t-4} + ε
            y_fwd = y.iloc[h:].reset_index(drop=True)
            x_cur = x.iloc[:-h].reset_index(drop=True) if h > 0 else x.copy()

            # Build control matrix: lags of x and y
            controls = pd.DataFrame()
            for lag in range(1, n_controls + 1):
                if lag < len(x):
                    controls[f"x_lag{lag}"] = x.shift(lag)
                    controls[f"y_lag{lag}"] = y.shift(lag)

            controls = controls.iloc[:-h] if h > 0 else controls.copy()

            # Trim to common length
            n = min(len(y_fwd), len(x_cur), len(controls))
            if n < 15:
                break
            y_fwd = y_fwd.iloc[:n]
            x_cur = x_cur.iloc[:n]
            controls = controls.iloc[-n:]

            # Drop NaN rows
            X = pd.concat(
                [x_cur.rename("impulse"), controls.reset_index(drop=True)], axis=1
            )
            X["const"] = 1.0
            mask = X.notna().all(axis=1) & y_fwd.notna()
            X = X[mask]
            y_dep = y_fwd[mask]

            if len(y_dep) < 15:
                break

            try:
                from numpy.linalg import lstsq

                X_mat = X.values.astype(float)
                y_vec = y_dep.values.astype(float)
                coefs, _, _, _ = lstsq(X_mat, y_vec, rcond=None)
                beta = coefs[0]  # coefficient on impulse

                # SE via residuals
                resid = y_vec - X_mat @ coefs
                s2 = np.sum(resid**2) / max(len(y_vec) - X_mat.shape[1], 1)
                try:
                    var_beta = s2 * np.linalg.inv(X_mat.T @ X_mat)[0, 0]
                    se = np.sqrt(max(var_beta, 0))
                except Exception:
                    se = 0.0

                horizons.append(h)
                points.append(float(beta))
                ci_lo.append(float(beta - 1.96 * se))
                ci_hi.append(float(beta + 1.96 * se))
            except Exception:
                break

        if horizons:
            results.append(
                {
                    "impulse": impulse,
                    "response": response,
                    "impulse_label": VAR_LABELS.get(impulse, impulse),
                    "response_label": VAR_LABELS.get(response, response),
                    "horizons": horizons,
                    "point": points,
                    "ci_lower": ci_lo,
                    "ci_upper": ci_hi,
                }
            )

    return results


def compute_event_study(panel: pd.DataFrame) -> list:
    """Event study: spike weeks → abnormal responses."""
    results = []
    spike_types = [
        ("rrls_count", "RRLS Spikes"),
        ("nts_count", "NTS Spikes"),
    ]
    response_vars = [v for v in ACTION + MEDIA if v in panel.columns]
    window_pre = 4
    window_post = 8
    baseline_window = 8

    for spike_var, spike_label in spike_types:
        if spike_var not in panel.columns:
            continue

        s = panel[spike_var].fillna(0)
        threshold = s.mean() + 1.5 * s.std()
        spike_weeks = s[s > threshold].index.tolist()

        # Filter spikes that have enough room for window
        spike_weeks = [
            w
            for w in spike_weeks
            if w >= baseline_window and w + window_post < len(panel)
        ]

        if len(spike_weeks) < 3:
            continue

        responses = {}
        for rv in response_vars:
            r = panel[rv].fillna(0)
            abnormals = []
            for sw in spike_weeks:
                # Baseline: mean of weeks -baseline_window to -1
                baseline = r.iloc[sw - baseline_window : sw].mean()
                # Window: -window_pre to +window_post
                window_vals = r.iloc[sw - window_pre : sw + window_post + 1].values
                abnormal = window_vals - baseline
                if len(abnormal) == window_pre + window_post + 1:
                    abnormals.append(abnormal)

            if abnormals:
                abnormals = np.array(abnormals)
                mean_abn = np.mean(abnormals, axis=0)
                se_abn = np.std(abnormals, axis=0) / np.sqrt(len(abnormals))
                cumul = np.cumsum(mean_abn)

                responses[rv] = {
                    "variable": rv,
                    "label": VAR_LABELS.get(rv, rv),
                    "window": list(range(-window_pre, window_post + 1)),
                    "mean_abnormal": mean_abn.tolist(),
                    "se": se_abn.tolist(),
                    "cumulative": cumul.tolist(),
                }

        results.append(
            {
                "spike_variable": spike_var,
                "spike_label": spike_label,
                "threshold": float(threshold),
                "n_spikes": len(spike_weeks),
                "spike_weeks": [
                    panel["week"].iloc[w].isoformat()[:10] for w in spike_weeks
                ],
                "responses": responses,
            }
        )

    return results


# ── Main ─────────────────────────────────────────────────────────────────────


def main():
    print("=" * 60)
    print("CAUSAL ANALYTICS EXPORT")
    print("=" * 60)

    # 1. Build panel
    print("\n[1/7] Building weekly panel...")
    panel = build_weekly_panel()

    # Export timeseries
    ts_data = panel.copy()
    ts_data["week"] = ts_data["week"].dt.strftime("%Y-%m-%d")
    save(ts_data.to_dict(orient="records"), "analytics_timeseries.json")

    # 2. Stationarity
    print("\n[2/7] Stationarity tests...")
    all_vars = [v for v in RHETORIC + ACTION + MEDIA if v in panel.columns]
    stationarity = compute_stationarity(panel, all_vars)
    for var, res in stationarity.items():
        st = "stationary" if res.get("stationary") else "NON-stationary"
        p = res.get("pvalue")
        pstr = f"p={p:.4f}" if p is not None else "p=N/A"
        print(f"    {var}: {st} ({pstr})")

    # 3. Cross-correlations
    print("\n[3/7] Cross-correlations...")
    crosscorr = compute_cross_correlations(panel, stationarity)
    print(f"    {len(crosscorr)} pairs computed")
    save(crosscorr, "analytics_crosscorr.json")

    # 4. Granger causality
    print("\n[4/7] Granger causality tests...")
    granger = compute_granger(panel, stationarity)
    sig = sum(1 for g in granger if g["best_pvalue"] < 0.05)
    print(f"    {len(granger)} tests, {sig} significant at p<0.05")
    save(granger, "analytics_granger.json")

    # 5. VAR + IRFs
    print("\n[5/7] VAR models + IRFs...")
    var_results = compute_var_irfs(panel, stationarity)
    for m in var_results:
        print(
            f"    {m['name']}: lag={m['optimal_lag']}, " f"{len(m['irfs'])} IRF pairs"
        )
    save(var_results, "analytics_var.json")

    # 6. Local Projections
    print("\n[6/7] Local Projections (Jordà)...")
    lp_results = compute_local_projections(panel, stationarity)
    print(f"    {len(lp_results)} LP pairs computed")
    save(lp_results, "analytics_lp.json")

    # 7. Event study
    print("\n[7/7] Event study...")
    event_results = compute_event_study(panel)
    for es in event_results:
        print(
            f"    {es['spike_label']}: {es['n_spikes']} spike weeks, "
            f"{len(es['responses'])} response vars"
        )
    save(event_results, "analytics_event_study.json")

    # Metadata
    data_warnings: list[str] = []
    metadata = {
        "n_weeks": len(panel),
        "date_min": panel["week"].min().isoformat()[:10] if not panel.empty else None,
        "date_max": panel["week"].max().isoformat()[:10] if not panel.empty else None,
        "variables": {v: VAR_LABELS.get(v, v) for v in all_vars},
        "rhetoric_vars": [v for v in RHETORIC if v in panel.columns],
        "action_vars": [v for v in ACTION if v in panel.columns],
        "media_vars": [v for v in MEDIA if v in panel.columns],
        "stationarity": stationarity,
        "var_models": [m["name"] for m in var_results],
        "lp_pairs": [(lp["impulse"], lp["response"]) for lp in lp_results],
        "warnings": data_warnings,
    }

    # Check for truncated series
    for var in ["acled_events", "acled_fatalities"]:
        if var in panel.columns:
            last_nonzero = panel[panel[var] > 0]["week"].max()
            if last_nonzero and last_nonzero < panel["week"].max() - pd.Timedelta(
                weeks=8
            ):
                data_warnings.append(
                    f"{var}: series may be truncated (last data: {last_nonzero.strftime('%Y-%m-%d')})"
                )

    for var in ["aid_total_eur", "aid_military_eur"]:
        if var in panel.columns:
            last_nonzero = (
                panel[panel[var] > 0]["week"].max() if (panel[var] > 0).any() else None
            )
            if last_nonzero and last_nonzero < panel["week"].max() - pd.Timedelta(
                weeks=8
            ):
                data_warnings.append(
                    f"{var}: series may be truncated (last data: {last_nonzero.strftime('%Y-%m-%d')})"
                )

    save(metadata, "analytics_metadata.json")

    print("\n" + "=" * 60)
    print("DONE — 7 analytics JSON files exported")
    print("=" * 60)


if __name__ == "__main__":
    main()
