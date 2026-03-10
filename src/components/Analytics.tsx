export default function Analytics() {
  return (
    <div className="tab-content">
      <div style={{
        maxWidth: '800px',
        margin: '4rem auto',
        padding: '2rem',
        textAlign: 'center',
        color: '#e0e0e0'
      }}>
        <h2 style={{ marginBottom: '1.5rem', color: '#4fc3f7' }}>
          Causal Analysis Dashboard
        </h2>

        <p style={{
          fontSize: '1.1rem',
          lineHeight: '1.6',
          marginBottom: '2rem',
          color: '#aaa'
        }}>
          The causal analysis features have been moved to a dedicated application
          for improved performance and functionality. This includes time series analysis,
          cross-correlations, Granger causality testing, VAR models, and event studies.
        </p>

        <a
          href="https://sdspieg.github.io/russian_redlines-causal-dashboard/"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-block',
            padding: '1rem 2rem',
            background: 'linear-gradient(135deg, #4fc3f7, #2196f3)',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '8px',
            fontSize: '1.1rem',
            fontWeight: '500',
            boxShadow: '0 4px 12px rgba(79, 195, 247, 0.3)',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(79, 195, 247, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(79, 195, 247, 0.3)';
          }}
        >
          Open Causal Analysis Dashboard →
        </a>

        <div style={{
          marginTop: '3rem',
          padding: '1.5rem',
          background: 'rgba(79, 195, 247, 0.05)',
          border: '1px solid rgba(79, 195, 247, 0.2)',
          borderRadius: '8px',
          textAlign: 'left'
        }}>
          <h4 style={{ marginBottom: '1rem', color: '#4fc3f7' }}>
            Available Features:
          </h4>
          <ul style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            fontSize: '0.95rem',
            lineHeight: '1.8',
            color: '#ccc'
          }}>
            <li>✓ Time series visualization of rhetoric and action variables</li>
            <li>✓ Cross-correlation analysis with confidence bounds</li>
            <li>✓ Granger causality testing with heatmap visualization</li>
            <li>✓ Vector Autoregression (VAR) impulse response functions</li>
            <li>✓ Local projection methods (Jordà)</li>
            <li>✓ Event study analysis for rhetoric spikes</li>
            <li>✓ Comprehensive diagnostics and stationarity tests</li>
          </ul>
        </div>
      </div>
    </div>
  );
}