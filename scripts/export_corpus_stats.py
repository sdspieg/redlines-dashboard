#!/usr/bin/env python3
"""Export document and chunk statistics by source and month."""

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

def export_corpus_stats():
    print("Connecting to redlines DB...")
    conn = psycopg2.connect(**DB)

    # Documents by month and source
    print("[1] Documents monthly by source")
    docs_monthly = q(conn, """
        SELECT
            TO_CHAR(DATE_TRUNC('month', date), 'YYYY-MM') AS month,
            CASE
                WHEN source = 'kremlin.ru' THEN 'kremlin'
                WHEN source = 'duma.gov.ru' THEN 'duma'
                WHEN source = 'council.gov.ru' THEN 'federation'
                WHEN database = 'telegram_official' THEN 'telegram'
                ELSE 'other'
            END AS source_category,
            COUNT(*) AS count
        FROM document
        WHERE date IS NOT NULL
        GROUP BY month, source_category
        ORDER BY month, source_category
    """)
    save(docs_monthly, "documents_monthly_by_source.json")

    # Total documents by month
    print("[2] Documents monthly total")
    docs_total = q(conn, """
        SELECT
            TO_CHAR(DATE_TRUNC('month', date), 'YYYY-MM') AS month,
            COUNT(*) AS count
        FROM document
        WHERE date IS NOT NULL
        GROUP BY month
        ORDER BY month
    """)
    save(docs_total, "documents_monthly.json")

    # Chunks by month and source
    print("[3] Chunks monthly by source")
    chunks_monthly = q(conn, """
        SELECT
            TO_CHAR(DATE_TRUNC('month', d.date), 'YYYY-MM') AS month,
            CASE
                WHEN d.source = 'kremlin.ru' THEN 'kremlin'
                WHEN d.source = 'duma.gov.ru' THEN 'duma'
                WHEN d.source = 'council.gov.ru' THEN 'federation'
                WHEN d.database = 'telegram_official' THEN 'telegram'
                ELSE 'other'
            END AS source_category,
            COUNT(*) AS count
        FROM document_chunk dc
        JOIN document d ON d.id = dc.document_id
        WHERE d.date IS NOT NULL
        GROUP BY month, source_category
        ORDER BY month, source_category
    """)
    save(chunks_monthly, "chunks_monthly_by_source.json")

    conn.close()
    print("Done.")

if __name__ == "__main__":
    export_corpus_stats()