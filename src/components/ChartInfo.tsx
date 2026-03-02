import { useState } from 'react';

interface Props {
  title: string;
  description: string;
}

export default function ChartInfo({ title, description }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="chart-info-btn"
        onClick={() => setOpen(true)}
        title="About this chart"
        aria-label={`Info about ${title}`}
      >
        i
      </button>
      {open && (
        <div className="chart-info-overlay" onClick={() => setOpen(false)}>
          <div className="chart-info-modal" onClick={e => e.stopPropagation()}>
            <h3>{title}</h3>
            <p>{description}</p>
            <button className="chart-info-close" onClick={() => setOpen(false)}>Close</button>
          </div>
        </div>
      )}
    </>
  );
}
