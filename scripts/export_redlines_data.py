#!/usr/bin/env python3
"""Export redlines annotation data to static JSON for the dashboard."""

import json
import os
import datetime as dt
from pathlib import Path
import psycopg2
import psycopg2.extras

_HOST = os.environ.get("DB_HOST", "138.201.62.161")
_PORT = int(os.environ.get("DB_PORT", "5432"))
_USER = os.environ.get("DB_USER", "postgres")
_PASS = os.environ.get("DB_PASSWORD", "GoNKJWp64NkMr9UdgCnT")

DB = dict(host=_HOST, port=_PORT, dbname="redlines", user=_USER, password=_PASS)

# Also connect to war_datasets for context data
WAR_DB = dict(host=_HOST, port=_PORT, dbname="war_datasets", user=_USER, password=_PASS)

OUT = Path(__file__).resolve().parent.parent / "public" / "data"
OUT.mkdir(parents=True, exist_ok=True)


def save(data, name):
    path = OUT / name
    with open(path, "w") as f:
        json.dump(data, f, default=str, separators=(",", ":"))
    print(f"  {name}: {len(json.dumps(data, default=str)) // 1024}KB")


def q(conn, sql):
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(sql)
        return [dict(r) for r in cur.fetchall()]


def qone(conn, sql):
    rows = q(conn, sql)
    return rows[0] if rows else {}


def export_all():
    print("Connecting to redlines DB...")
    conn = psycopg2.connect(**DB)

    # ── 1. Overview stats ────────────────────────────────────────────────
    print("\n[1] Overview stats")
    stats = qone(conn, """
        SELECT
            (SELECT COUNT(DISTINCT id) FROM document) AS total_docs,
            (SELECT COUNT(DISTINCT id) FROM document_chunk) AS total_chunks,
            (SELECT COUNT(*) FROM first_pass_annotation) AS fpa_rows,
            (SELECT COUNT(DISTINCT chunk_id) FROM first_pass_annotation) AS fpa_chunks,
            (SELECT COUNT(*) FROM first_pass_annotation WHERE is_relevant AND statement_type='rls') AS fpa_rls_relevant,
            (SELECT COUNT(*) FROM first_pass_annotation WHERE is_relevant AND statement_type='nts') AS fpa_nts_relevant,
            (SELECT COUNT(*) FROM rls_annotation) AS rls2_total,
            (SELECT COUNT(*) FROM rls_annotation WHERE is_relevant) AS rls2_confirmed,
            (SELECT COUNT(*) FROM nts_annotation) AS nts2_total,
            (SELECT COUNT(*) FROM nts_annotation WHERE is_relevant) AS nts2_confirmed,
            (SELECT COUNT(*) FROM rls_annotation_third_pass) AS rls3_total,
            (SELECT COUNT(*) FROM rls_annotation_third_pass WHERE is_relevant) AS rls3_confirmed,
            (SELECT COUNT(*) FROM rls_annotation_third_pass WHERE is_relevant AND civilizational_framing) AS crls_count,
            (SELECT COUNT(DISTINCT d.source) FROM document d) AS total_sources,
            (SELECT MIN(d.date) FROM document d WHERE d.date IS NOT NULL) AS date_min,
            (SELECT MAX(d.date) FROM document d WHERE d.date IS NOT NULL) AS date_max
    """)
    save(stats, "overview_stats.json")

    # ── 2. Chunks per source (denominator) ───────────────────────────────
    print("[2] Chunks by source")
    chunks_src = q(conn, """
        SELECT d.source, d."database" AS db,
               COUNT(DISTINCT dc.id) AS total_chunks,
               COUNT(DISTINCT d.id) AS total_docs,
               MIN(d.date) AS date_min, MAX(d.date) AS date_max
        FROM document d
        JOIN document_chunk dc ON dc.document_id = d.id
        GROUP BY d.source, d."database"
        ORDER BY total_chunks DESC
    """)
    save(chunks_src, "chunks_by_source.json")

    # ── 3. RRLS by source ────────────────────────────────────────────────
    print("[3] RRLS by source")
    rrls_src = q(conn, """
        SELECT d.source, d."database" AS db,
               COUNT(*) AS count,
               COUNT(*) FILTER (WHERE ra.is_relevant) AS confirmed
        FROM rls_annotation ra
        JOIN document_chunk dc ON ra.chunk_id = dc.id
        JOIN document d ON dc.document_id = d.id
        GROUP BY d.source, d."database"
        ORDER BY confirmed DESC
    """)
    save(rrls_src, "rrls_by_source.json")

    # ── 4. NTS by source ─────────────────────────────────────────────────
    print("[4] NTS by source")
    nts_src = q(conn, """
        SELECT d.source, d."database" AS db,
               COUNT(*) AS count,
               COUNT(*) FILTER (WHERE na.is_relevant) AS confirmed
        FROM nts_annotation na
        JOIN document_chunk dc ON na.chunk_id = dc.id
        JOIN document d ON dc.document_id = d.id
        GROUP BY d.source, d."database"
        ORDER BY confirmed DESC
    """)
    save(nts_src, "nts_by_source.json")

    # ── 5. CRLS by source ────────────────────────────────────────────────
    print("[5] CRLS by source")
    crls_src = q(conn, """
        SELECT d.source, d."database" AS db,
               COUNT(*) AS count,
               COUNT(*) FILTER (WHERE tp.civilizational_framing) AS crls
        FROM rls_annotation_third_pass tp
        JOIN document_chunk dc ON tp.chunk_id = dc.id
        JOIN document d ON dc.document_id = d.id
        WHERE tp.is_relevant
        GROUP BY d.source, d."database"
        ORDER BY crls DESC
    """)
    save(crls_src, "crls_by_source.json")

    # ── 6. Monthly time series ───────────────────────────────────────────
    print("[6] Monthly time series")
    rrls_monthly = q(conn, """
        SELECT TO_CHAR(DATE_TRUNC('month', d.date), 'YYYY-MM') AS month,
               d.source,
               COUNT(*) AS count
        FROM rls_annotation ra
        JOIN document_chunk dc ON ra.chunk_id = dc.id
        JOIN document d ON dc.document_id = d.id
        WHERE ra.is_relevant AND d.date IS NOT NULL
        GROUP BY DATE_TRUNC('month', d.date), d.source
        ORDER BY month
    """)
    save(rrls_monthly, "rrls_monthly.json")

    nts_monthly = q(conn, """
        SELECT TO_CHAR(DATE_TRUNC('month', d.date), 'YYYY-MM') AS month,
               d.source,
               COUNT(*) AS count
        FROM nts_annotation na
        JOIN document_chunk dc ON na.chunk_id = dc.id
        JOIN document d ON dc.document_id = d.id
        WHERE na.is_relevant AND d.date IS NOT NULL
        GROUP BY DATE_TRUNC('month', d.date), d.source
        ORDER BY month
    """)
    save(nts_monthly, "nts_monthly.json")

    crls_monthly = q(conn, """
        SELECT TO_CHAR(DATE_TRUNC('month', d.date), 'YYYY-MM') AS month,
               d.source,
               COUNT(*) AS count
        FROM rls_annotation_third_pass tp
        JOIN document_chunk dc ON tp.chunk_id = dc.id
        JOIN document d ON dc.document_id = d.id
        WHERE tp.is_relevant AND tp.civilizational_framing AND d.date IS NOT NULL
        GROUP BY DATE_TRUNC('month', d.date), d.source
        ORDER BY month
    """)
    save(crls_monthly, "crls_monthly.json")

    # Chunks monthly (denominator for relative)
    chunks_monthly = q(conn, """
        SELECT TO_CHAR(DATE_TRUNC('month', d.date), 'YYYY-MM') AS month,
               COUNT(DISTINCT dc.id) AS total_chunks
        FROM document d
        JOIN document_chunk dc ON dc.document_id = d.id
        WHERE d.date IS NOT NULL
        GROUP BY DATE_TRUNC('month', d.date)
        ORDER BY month
    """)
    save(chunks_monthly, "chunks_monthly.json")

    # ── 7. RRLS taxonomy dimensions ──────────────────────────────────────
    print("[7] RRLS taxonomy")
    RLS_DIMS = [
        "theme", "audience", "level_of_escalation", "nature_of_threat",
        "underlying_values_or_interests", "temporal_context", "reciprocity",
        "durability", "line", "threat", "specificity",
        "geopolitical_area_of_concern", "immediacy",
        "unilateral_vs_multilateral", "rhetorical_device",
    ]
    _CIVI_VAL = "CASE WHEN tp.civilizational_framing THEN 'Civilizational' ELSE ra.theme END"
    _CIVI_JOIN = "LEFT JOIN rls_annotation_third_pass tp ON tp.chunk_id = ra.chunk_id"
    taxonomy = {}
    for dim in RLS_DIMS:
        val = _CIVI_VAL if dim == "theme" else dim
        tp_join = _CIVI_JOIN if dim == "theme" else ""
        null_ref = f"ra.{dim}" if dim == "theme" else dim
        rows = q(conn, f"""
            SELECT {val} AS value, COUNT(*) AS count,
                   d.source
            FROM rls_annotation ra
            {tp_join}
            JOIN document_chunk dc ON ra.chunk_id = dc.id
            JOIN document d ON dc.document_id = d.id
            WHERE ra.is_relevant AND {null_ref} IS NOT NULL
            GROUP BY {val}, d.source
            ORDER BY count DESC
        """)
        taxonomy[dim] = rows
    save(taxonomy, "rrls_taxonomy.json")

    # Taxonomy totals (without source breakdown, for overview)
    tax_totals = {}
    for dim in RLS_DIMS:
        val = _CIVI_VAL if dim == "theme" else dim
        tp_join = _CIVI_JOIN if dim == "theme" else ""
        null_ref = f"ra.{dim}" if dim == "theme" else dim
        rows = q(conn, f"""
            SELECT {val} AS value, COUNT(*) AS count
            FROM rls_annotation ra
            {tp_join}
            WHERE ra.is_relevant AND {null_ref} IS NOT NULL
            GROUP BY {val}
            ORDER BY count DESC
        """)
        tax_totals[dim] = rows
    save(tax_totals, "rrls_taxonomy_totals.json")

    # ── 8. NTS taxonomy dimensions ───────────────────────────────────────
    print("[8] NTS taxonomy")
    NTS_DIMS = [
        "nts_statement_type", "nts_threat_type", "capability", "delivery_system",
        "conditionality", "purpose", "tone", "context",
        "geographical_reach", "consequences", "timeline",
        "arms_control_and_testing", "audience", "specificity",
        "rhetorical_device",
    ]
    nts_taxonomy = {}
    for dim in NTS_DIMS:
        rows = q(conn, f"""
            SELECT {dim} AS value, COUNT(*) AS count
            FROM nts_annotation na
            WHERE na.is_relevant AND {dim} IS NOT NULL
            GROUP BY {dim}
            ORDER BY count DESC
        """)
        nts_taxonomy[dim] = rows
    save(nts_taxonomy, "nts_taxonomy.json")

    # ── 9. NTS severity over time ────────────────────────────────────────
    print("[9] NTS severity over time")
    nts_severity = q(conn, """
        SELECT TO_CHAR(DATE_TRUNC('month', d.date), 'YYYY-MM') AS month,
               na.tone, na.conditionality, na.consequences, na.specificity,
               COUNT(*) AS count
        FROM nts_annotation na
        JOIN document_chunk dc ON na.chunk_id = dc.id
        JOIN document d ON dc.document_id = d.id
        WHERE na.is_relevant AND d.date IS NOT NULL
        GROUP BY DATE_TRUNC('month', d.date), na.tone, na.conditionality, na.consequences, na.specificity
        ORDER BY month
    """)
    save(nts_severity, "nts_severity_monthly.json")

    # ── 10. CRLS framing types ───────────────────────────────────────────
    print("[10] CRLS framing types")
    crls_framing = q(conn, """
        SELECT unnest(civilizational_framing_type) AS framing_type, COUNT(*) AS count
        FROM rls_annotation_third_pass tp
        WHERE tp.is_relevant AND tp.civilizational_framing
        GROUP BY framing_type
        ORDER BY count DESC
    """)
    save(crls_framing, "crls_framing_types.json")

    # CRLS sphere of influence
    crls_territories = q(conn, """
        SELECT TRIM(t) AS territory, COUNT(*) AS count
        FROM rls_annotation_third_pass tp,
             unnest(string_to_array(tp.territories_or_countries_mentioned, ',')) AS t
        WHERE tp.is_relevant AND tp.sphere_of_influence_claim
              AND tp.territories_or_countries_mentioned IS NOT NULL
        GROUP BY TRIM(t)
        ORDER BY count DESC
    """)
    save(crls_territories, "crls_territories.json")

    # ── 11. RRLS cross-tabulations ───────────────────────────────────────
    print("[11] Cross-tabulations")
    cross_tabs = [
        ("theme", "audience"),
        ("theme", "nature_of_threat"),
        ("audience", "level_of_escalation"),
        ("line", "threat"),
    ]
    cross_data = {}
    for dim1, dim2 in cross_tabs:
        has_theme = "theme" in (dim1, dim2)
        tp_join = _CIVI_JOIN if has_theme else ""
        d1 = _CIVI_VAL if dim1 == "theme" else (f"ra.{dim1}" if has_theme else dim1)
        d2 = _CIVI_VAL if dim2 == "theme" else (f"ra.{dim2}" if has_theme else dim2)
        nr1 = f"ra.{dim1}" if has_theme else dim1
        nr2 = f"ra.{dim2}" if has_theme else dim2
        rows = q(conn, f"""
            SELECT {d1} AS dim1, {d2} AS dim2, COUNT(*) AS count
            FROM rls_annotation ra
            {tp_join}
            WHERE ra.is_relevant AND {nr1} IS NOT NULL AND {nr2} IS NOT NULL
            GROUP BY {d1}, {d2}
            ORDER BY count DESC
        """)
        cross_data[f"{dim1}_x_{dim2}"] = rows
    save(cross_data, "rrls_cross_tabs.json")

    # ── 12. RRLS taxonomy over time (top dims) ───────────────────────────
    print("[12] Taxonomy over time")
    tax_time = {}
    for dim in ["theme", "audience", "nature_of_threat", "level_of_escalation"]:
        val = _CIVI_VAL if dim == "theme" else dim
        tp_join = _CIVI_JOIN if dim == "theme" else ""
        null_ref = f"ra.{dim}" if dim == "theme" else dim
        rows = q(conn, f"""
            SELECT TO_CHAR(DATE_TRUNC('month', d.date), 'YYYY-MM') AS month,
                   {val} AS value, COUNT(*) AS count
            FROM rls_annotation ra
            {tp_join}
            JOIN document_chunk dc ON ra.chunk_id = dc.id
            JOIN document d ON dc.document_id = d.id
            WHERE ra.is_relevant AND d.date IS NOT NULL AND {null_ref} IS NOT NULL
            GROUP BY DATE_TRUNC('month', d.date), {val}
            ORDER BY month
        """)
        tax_time[dim] = rows
    save(tax_time, "rrls_taxonomy_time.json")

    # ── 13. Statement browser data (RRLS) ────────────────────────────────
    print("[13] RRLS statements")
    rrls_stmts = q(conn, """
        SELECT ra.chunk_id, d.date, d.source, d."database" AS db,
               ra.context_text_span, ra.source AS speaker, ra.target,
               ra.line_text_span, ra.threat_text_span,
               ra.line AS line_type, ra.threat AS threat_type,
               ra.line_intensity, ra.threat_intensity,
               CASE WHEN tp.civilizational_framing THEN 'Civilizational' ELSE ra.theme END AS theme,
               ra.audience, ra.nature_of_threat,
               ra.level_of_escalation, ra.geopolitical_area_of_concern,
               ra.immediacy, ra.durability, ra.reciprocity, ra.specificity,
               ra.temporal_context, ra.underlying_values_or_interests,
               ra.unilateral_vs_multilateral, ra.rhetorical_device,
               ra.overall_confidence
        FROM rls_annotation ra
        LEFT JOIN rls_annotation_third_pass tp ON tp.chunk_id = ra.chunk_id
        JOIN document_chunk dc ON ra.chunk_id = dc.id
        JOIN document d ON dc.document_id = d.id
        WHERE ra.is_relevant
        ORDER BY d.date DESC NULLS LAST
    """)
    save(rrls_stmts, "rrls_statements.json")

    # ── 14. Statement browser data (NTS) ─────────────────────────────────
    print("[14] NTS statements")
    nts_stmts = q(conn, """
        SELECT na.chunk_id, d.date, d.source, d."database" AS db,
               na.context_text_span, na.source AS speaker, na.target,
               na.threat_text_span,
               na.nts_statement_type, na.nts_threat_type, na.capability,
               na.delivery_system, na.conditionality, na.purpose,
               na.tone, na.context, na.geographical_reach,
               na.consequences, na.timeline, na.audience, na.specificity,
               na.rhetorical_device, na.arms_control_and_testing,
               na.overall_confidence
        FROM nts_annotation na
        JOIN document_chunk dc ON na.chunk_id = dc.id
        JOIN document d ON dc.document_id = d.id
        WHERE na.is_relevant
        ORDER BY d.date DESC NULLS LAST
    """)
    save(nts_stmts, "nts_statements.json")

    # ── 15. Comparative: by database group ───────────────────────────────
    print("[15] Comparative by database")
    comp_db = q(conn, """
        SELECT d."database" AS db,
               COUNT(DISTINCT dc.id) AS total_chunks,
               COUNT(DISTINCT CASE WHEN ra.is_relevant THEN ra.chunk_id END) AS rrls,
               COUNT(DISTINCT CASE WHEN na.is_relevant THEN na.chunk_id END) AS nts
        FROM document d
        JOIN document_chunk dc ON dc.document_id = d.id
        LEFT JOIN rls_annotation ra ON ra.chunk_id = dc.id
        LEFT JOIN nts_annotation na ON na.chunk_id = dc.id
        GROUP BY d."database"
        ORDER BY total_chunks DESC
    """)
    save(comp_db, "comparative_by_db.json")

    # ── 16. RRLS intensity / confidence distributions ────────────────────
    print("[16] Intensity distributions")
    intensity = q(conn, """
        SELECT line_intensity, threat_intensity,
               ROUND(overall_confidence::numeric, 0) AS confidence_bin,
               COUNT(*) AS count
        FROM rls_annotation ra
        WHERE ra.is_relevant
        GROUP BY line_intensity, threat_intensity, confidence_bin
        ORDER BY count DESC
    """)
    save(intensity, "rrls_intensity.json")

    conn.close()

    # ── 17. War context data from war_datasets ───────────────────────────
    print("\n[17] War context from war_datasets")
    try:
        wconn = psycopg2.connect(**WAR_DB)
        equip_monthly = q(wconn, """
            WITH daily AS (
                SELECT date,
                       personnel - LAG(personnel) OVER (ORDER BY date) AS pers_delta
                FROM equipment_losses.personnel_daily
                WHERE date >= '2022-02-24'
            )
            SELECT TO_CHAR(date, 'YYYY-MM') AS month,
                   SUM(GREATEST(pers_delta, 0)) AS personnel_losses
            FROM daily
            WHERE pers_delta IS NOT NULL
            GROUP BY TO_CHAR(date, 'YYYY-MM')
            ORDER BY month
        """)
        save(equip_monthly, "war_context_personnel.json")

        acled_monthly = q(wconn, """
            SELECT TO_CHAR(event_date, 'YYYY-MM') AS month,
                   COUNT(*) AS events,
                   SUM(fatalities) AS fatalities
            FROM conflict_events.acled_events
            WHERE event_date >= '2022-02-24'
            GROUP BY TO_CHAR(event_date, 'YYYY-MM')
            ORDER BY month
        """)
        save(acled_monthly, "war_context_acled.json")

        wconn.close()
    except Exception as e:
        print(f"  Warning: war context export failed: {e}")

    print(f"\nDone. Files in {OUT}")


if __name__ == "__main__":
    export_all()
