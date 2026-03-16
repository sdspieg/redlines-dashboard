#!/usr/bin/env python3
"""Export Literal Red Lines (LRLS) data from lrls_match table to static JSON."""

import json
import os
from pathlib import Path
import psycopg2
import psycopg2.extras

_HOST = os.environ["DB_HOST"]
_PORT = int(os.environ.get("DB_PORT", "5432"))
_USER = os.environ.get("DB_USER", "postgres")
_PASS = os.environ["DB_PASSWORD"]

DB = dict(host=_HOST, port=_PORT, dbname="redlines", user=_USER, password=_PASS)

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

    # ── 1. Summary stats ──────────────────────────────────────────────────
    print("\n[1] LRLS stats")
    stats = qone(conn, """
        SELECT
            (SELECT COUNT(*) FROM lrls_match WHERE is_semantic_match IS TRUE) AS total_matches,
            (SELECT COUNT(DISTINCT chunk_id) FROM lrls_match WHERE is_semantic_match IS TRUE) AS unique_chunks,
            (SELECT COUNT(*) FROM lrls_match WHERE is_semantic_match IS TRUE AND lang = 'ru') AS ru_matches,
            (SELECT COUNT(*) FROM lrls_match WHERE is_semantic_match IS TRUE AND lang = 'en') AS en_matches,
            (SELECT COUNT(DISTINCT chunk_id) FROM lrls_match WHERE is_semantic_match IS TRUE AND lang = 'ru') AS ru_chunks,
            (SELECT COUNT(DISTINCT chunk_id) FROM lrls_match WHERE is_semantic_match IS TRUE AND lang = 'en') AS en_chunks
    """)
    save(stats, "lrls_stats.json")

    # ── 2. Matches by language ─────────────────────────────────────────────
    print("[2] LRLS by language")
    by_lang = q(conn, """
        SELECT lang,
               COUNT(*) AS matches,
               COUNT(DISTINCT chunk_id) AS chunks
        FROM lrls_match
        WHERE is_semantic_match IS TRUE
        GROUP BY lang
        ORDER BY matches DESC
    """)
    save(by_lang, "lrls_by_lang.json")

    # ── 3. Monthly trend ──────────────────────────────────────────────────
    print("[3] LRLS monthly")
    monthly = q(conn, """
        SELECT TO_CHAR(DATE_TRUNC('month', d.date), 'YYYY-MM') AS month,
               m.lang,
               COUNT(*) AS count
        FROM lrls_match m
        JOIN document_chunk dc ON dc.id = m.chunk_id
        JOIN document d ON d.id = dc.document_id
        WHERE m.is_semantic_match IS TRUE
          AND d.date IS NOT NULL
        GROUP BY DATE_TRUNC('month', d.date), m.lang
        ORDER BY month
    """)
    save(monthly, "lrls_monthly.json")

    # ── 4. By source ──────────────────────────────────────────────────────
    print("[4] LRLS by source")
    by_source = q(conn, """
        SELECT d.source, d."database" AS db,
               COUNT(*) AS count,
               COUNT(*) FILTER (WHERE m.lang = 'ru') AS ru_count,
               COUNT(*) FILTER (WHERE m.lang = 'en') AS en_count,
               COUNT(DISTINCT m.chunk_id) AS unique_chunks
        FROM lrls_match m
        JOIN document_chunk dc ON dc.id = m.chunk_id
        JOIN document d ON d.id = dc.document_id
        WHERE m.is_semantic_match IS TRUE
        GROUP BY d.source, d."database"
        ORDER BY count DESC
    """)
    save(by_source, "lrls_by_source.json")

    # ── 5. Top matched phrases ─────────────────────────────────────────────
    print("[5] LRLS top phrases")
    top_phrases = q(conn, """
        SELECT matched_phrase, lang, COUNT(*) AS count
        FROM lrls_match
        WHERE is_semantic_match IS TRUE
        GROUP BY matched_phrase, lang
        ORDER BY count DESC
        LIMIT 40
    """)
    save(top_phrases, "lrls_top_phrases.json")

    # ── 6. Full match records (for browser) ────────────────────────────────
    print("[6] LRLS matches (full)")
    matches = q(conn, """
        SELECT m.chunk_id, m.lang, m.matched_phrase,
               m.sentence, m.paragraph,
               d.source, d."database" AS db,
               TO_CHAR(d.date, 'YYYY-MM-DD') AS date
        FROM lrls_match m
        JOIN document_chunk dc ON dc.id = m.chunk_id
        JOIN document d ON d.id = dc.document_id
        WHERE m.is_semantic_match IS TRUE
        ORDER BY d.date DESC, m.chunk_id
    """)
    save(matches, "lrls_matches.json")

    conn.close()
    print("\nDone.")


if __name__ == "__main__":
    export_all()
