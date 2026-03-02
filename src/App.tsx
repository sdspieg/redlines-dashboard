import { useState } from 'react';
import TabNav from './components/TabNav';
import Overview from './components/Overview';
import RRLSExplorer from './components/RRLSExplorer';
import NTSExplorer from './components/NTSExplorer';
import CRLSExplorer from './components/CRLSExplorer';
import TimeSeries from './components/TimeSeries';
import Statements from './components/Statements';
import type { TabId } from './types';

export default function App() {
  const [tab, setTab] = useState<TabId>('overview');

  return (
    <div className="app">
      <header className="app-header">
        <h1>Red Lines Dashboard</h1>
        <p className="subtitle">Russian Red Line & Nuclear Threat Statement Analysis</p>
      </header>
      <TabNav active={tab} onChange={setTab} />
      <main>
        {tab === 'overview' && <Overview />}
        {tab === 'rrls' && <RRLSExplorer />}
        {tab === 'nts' && <NTSExplorer />}
        {tab === 'crls' && <CRLSExplorer />}
        {tab === 'timeseries' && <TimeSeries />}
        {tab === 'statements' && <Statements />}
      </main>
      <footer>
        <p>Red Lines Annotation Project | Data exported {new Date().toISOString().slice(0, 10)}</p>
      </footer>
    </div>
  );
}
