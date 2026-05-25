export type TabId = 'DOM' | 'LAYOUT' | 'PAINT' | 'SCRIPTING' | 'GPU';

interface TopAppBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const tabs: TabId[] = ['DOM', 'LAYOUT', 'PAINT', 'SCRIPTING', 'GPU'];

export default function TopAppBar({ activeTab, onTabChange }: TopAppBarProps) {
  return (
    <header className="flex justify-between items-center w-full px-lg h-12 z-50 bg-surface border-b border-outline-variant shrink-0">
      <div className="flex items-center h-full">
        <div className="font-headline-sm text-headline-sm font-bold text-primary tracking-widest border-r border-outline-variant pr-4 mr-4 flex items-center h-full">
          OBSERVATORY // CORE_ENGINE
        </div>
        <nav className="flex items-center space-x-6 h-full font-headline-sm text-headline-sm uppercase tracking-tighter">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={`h-full flex items-center transition-colors duration-200 cursor-pointer active:opacity-70 ${
                activeTab === tab
                  ? 'text-primary border-b-2 border-primary pb-1 font-bold mt-1'
                  : 'text-on-surface-variant font-medium hover:text-primary'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>
      <div className="flex items-center space-x-4">
        <div className="flex items-center gap-sm font-code-sm text-code-sm text-primary-fixed-dim">
          <span className="material-symbols-outlined text-[16px]">speed</span>
          <span>TLM: 144Hz | PARSE: 1.2ms</span>
        </div>
        <div className="relative flex items-center border-b border-outline-variant group">
          <span className="material-symbols-outlined text-primary text-sm mr-2">search</span>
          <input
            className="bg-transparent border-none text-primary font-code-sm text-code-sm focus:ring-0 focus:outline-none p-0 w-48 placeholder:text-outline-variant"
            placeholder="QUERY_SELECTOR..."
            type="text"
          />
        </div>
        <div className="flex space-x-2 text-primary dark:text-primary-fixed-dim">
          <button className="hover:text-primary transition-colors duration-200 cursor-pointer active:opacity-70">
            <span className="material-symbols-outlined">step_into</span>
          </button>
          <button className="hover:text-primary transition-colors duration-200 cursor-pointer active:opacity-70">
            <span className="material-symbols-outlined">pause_circle</span>
          </button>
          <button className="hover:text-primary transition-colors duration-200 cursor-pointer active:opacity-70">
            <span className="material-symbols-outlined">videocam</span>
          </button>
          <button className="hover:text-primary transition-colors duration-200 cursor-pointer active:opacity-70">
            <span className="material-symbols-outlined">camera</span>
          </button>
        </div>
      </div>
    </header>
  );
}
