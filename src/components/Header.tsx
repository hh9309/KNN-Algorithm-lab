import React from 'react';
import {
  Activity,
  Sparkles,
  BookOpen,
  Layers,
  Code,
  FileText,
  Database,
  Sliders,
  Compass,
} from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onReset?: () => void;
  onOpenAIDiagnose: () => void;
  pointCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onReset,
  onOpenAIDiagnose,
  pointCount,
}) => {
  const navTabs = [
    { id: 'metric', label: '代数与度量', icon: Compass },
    { id: 'kcurve', label: 'K值与验证曲线', icon: Sliders },
    { id: 'workspace', label: '实验工作台', icon: Activity },
    { id: 'kdtree', label: 'KD-Tree演播', icon: Layers },
    { id: 'cases', label: '四大案例库', icon: Database },
    { id: 'code', label: 'Python引擎', icon: Code },
    { id: 'knowledge', label: '知识切片', icon: BookOpen },
    { id: 'export', label: '报告导出', icon: FileText },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Single text element wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-sm tracking-wider shadow-sm">
            KNN
          </div>
          <div>
            <span className="text-base font-semibold tracking-tight text-slate-900 block leading-tight">
              K-近邻算法实验室
            </span>
            <span className="text-xs text-slate-500 font-normal">
              距离度量 · K值切片 · 边界决策 · KD-Tree
            </span>
          </div>
        </div>

        {/* Zone 2: Clean text navigation links / segmented tabs */}
        <nav className="hidden lg:flex items-center gap-1 bg-slate-100/80 p-1 rounded-lg border border-slate-200/60">
          {navTabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1-2 primary actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onOpenAIDiagnose}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 active:bg-sky-800 rounded-lg shadow-xs transition-colors whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI 随诊诊断</span>
          </button>
        </div>
      </div>

      {/* Mobile nav bar */}
      <div className="lg:hidden flex items-center gap-1 overflow-x-auto px-4 py-2 bg-slate-50 border-t border-slate-200/60 scrollbar-none">
        {navTabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap ${
                isActive ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Icon className="w-3 h-3" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
};
