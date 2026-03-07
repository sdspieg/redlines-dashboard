import { useState } from 'react';

export default function MethodologyModal() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="methodology-btn" onClick={() => setOpen(true)} title="About this dashboard">
        About &amp; Methodology
      </button>
      {open && (
        <div className="chart-info-overlay" onClick={() => setOpen(false)}>
          <div className="methodology-modal" onClick={e => e.stopPropagation()}>
            <h2>Red Lines Dashboard — Corpus &amp; Methodology</h2>

            <h3>Corpus</h3>
            <p>
              The corpus comprises official Russian government communications, state media transcripts,
              diplomatic statements, and public addresses spanning February 2022 to present. Sources include
              the Russian Ministry of Foreign Affairs (MID), the Kremlin website, TASS, RIA Novosti, RT,
              Interfax, and other state-affiliated outlets, as well as statements captured by the
              EUvsDisinfo database and GDELT media monitoring.
            </p>

            <h3>Annotation Pipeline</h3>
            <p>
              Documents are split into semantically coherent text chunks, then processed through a
              three-pass LLM annotation pipeline:
            </p>
            <ol>
              <li>
                <strong>First Pass (GPT-4o screening):</strong> Each chunk is screened for relevance
                as a Russian Red Line Statement (RLS) or Nuclear Threat Statement (NTS). High-recall
                binary classification with brief rationale.
              </li>
              <li>
                <strong>Second Pass (GPT-5 mini taxonomy):</strong> Confirmed RLS chunks are annotated
                across 18 taxonomy dimensions (theme, audience, escalation level, nature of threat,
                line type, threat type, specificity, immediacy, durability, etc.). NTS chunks are
                annotated across 15 dimensions (statement type, threat type, capability, tone,
                conditionality, consequences, specificity, etc.). Each annotation includes a
                confidence score (7-10).
              </li>
              <li>
                <strong>Third Pass (Civilizational framing):</strong> RRLS statements are further
                screened for civilizational red line rhetoric (CRLS) — statements invoking cultural
                identity, historical destiny, or civilizational conflict narratives. CRLS are annotated
                for framing type and territory references.
              </li>
            </ol>

            <h3>Quality Controls</h3>
            <ul>
              <li>Inter-annotator agreement validated on a 500-statement gold set</li>
              <li>Confidence scores (7-10) allow filtering for high-certainty statements</li>
              <li>Source diversity: multiple databases prevent single-source bias</li>
              <li>Ordinal severity dimensions enable continuous escalation tracking</li>
            </ul>

            <h3>Causal Analytics</h3>
            <p>
              The Analytics tab uses Granger causality, Vector Autoregression (VAR), Impulse Response
              Functions (IRF), and Local Projections to test temporal relationships between rhetoric
              and real-world events (conflict intensity, aid deliveries, sanctions, media coverage).
              All tests include ADF stationarity pre-tests and Benjamini-Hochberg FDR correction.
            </p>

            <button className="chart-info-close" onClick={() => setOpen(false)}>Close</button>
          </div>
        </div>
      )}
    </>
  );
}
