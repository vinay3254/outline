import './styles.css';
import { MediaRail } from './components/MediaRail';
import { Transport } from './components/Transport';
import { Timeline } from './components/Timeline';
import { Preview } from './components/Preview';
import { Inspector } from './components/Inspector';
import { NoticeCenter } from './components/NoticeCenter';
import { ExportButton } from './components/ExportButton';
import { IconFilmReel } from './components/Icons';

export function App() {
  return (
    <main aria-label="Cutline editor" className="cutline-app">
      <header className="app-header">
        <div className="brand">
          <IconFilmReel className="brand-icon" aria-hidden="true" />
          <span>Cutline</span>
        </div>
        <ExportButton />
      </header>

      <NoticeCenter />

      <div className="workspace-main">
        <MediaRail />
        <div className="stage-area">
          <Preview />
        </div>
        <Inspector />
      </div>

      <Transport />
      <Timeline />
    </main>
  );
}
