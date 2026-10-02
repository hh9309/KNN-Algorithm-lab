import React, { useState } from 'react';
import { Sparkles, Bot, ChevronUp, ChevronDown, Zap, AlertTriangle, ShieldCheck, ArrowRight } from 'lucide-react';
import { MetricType } from '../types/knn';

interface AIFloatingSliceProps {
  onOpen: () => void;
  k: number;
  metric: MetricType;
  cvAccuracy: number;
  bestK: number;
  pointsCount: number;
}

export const AIFloatingSlice: React.FC<AIFloatingSliceProps> = ({
  onOpen,
  k,
  metric,
  cvAccuracy,
  bestK,
  pointsCount,
}) => {
  const [isMinimized, setIsMinimized] = useState<boolean>(false);

  // Real-time micro diagnostic state
  const isOverfitting = k <= 2;
  const isUnderfitting = k >= Math.max(15, Math.floor(pointsCount * 0.45));
  const isOptimal = k === bestK;

  return (
    <aside
      aria-label="AI 随诊诊断切片"
      className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-1.5 select-none print:hidden transition-all duration-300"
    >
      {isMinimized ? (
        /* Minimized Floating Pill */
        <button
          onClick={() => setIsMinimized(false)}
          title="展开 AI 随诊诊断切片"
          className="group flex items-center gap-2 bg-slate-900/95 hover:bg-slate-900 text-white pl-3 pr-3.5 py-2 rounded-full border border-sky-400/40 shadow-xl shadow-sky-950/20 backdrop-blur-md hover:scale-105 transition-all"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
          </span>
          <Sparkles className="w-3.5 h-3.5 text-sky-400 group-hover:rotate-12 transition-transform" />
          <span className="text-xs font-semibold tracking-wide">AI 随诊切片</span>
          <ChevronUp className="w-3.5 h-3.5 text-slate-400 group-hover:text-white" />
        </button>
      ) : (
        /* Expanded Floating Slice Card */
        <div className="relative group bg-slate-900/95 hover:bg-slate-900 text-white rounded-2xl border border-sky-400/30 shadow-2xl shadow-sky-950/30 backdrop-blur-md p-3.5 w-76 sm:w-80 transition-all duration-200">
          {/* Top header row */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
            <div
              onClick={onOpen}
              className="flex items-center gap-2 cursor-pointer flex-1"
            >
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white shadow-xs">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-100 tracking-tight">
                    AI 随诊诊断切片
                  </span>
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 block font-mono">
                  实时探针 · 连续随诊
                </span>
              </div>
            </div>

            {/* Minimize toggle */}
            <button
              onClick={e => {
                e.stopPropagation();
                setIsMinimized(true);
              }}
              title="收起为微型浮标"
              className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          {/* Clickable Card Body that triggers modal */}
          <div
            onClick={onOpen}
            className="cursor-pointer space-y-2.5 rounded-xl p-1 -m-1 hover:bg-white/5 transition-colors"
          >
            {/* Real-time State Diagnosis Badge */}
            <div className="flex items-center gap-2 text-xs">
              {isOptimal ? (
                <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-md text-[11px] font-medium">
                  <Zap className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span>已处最优峰值 (K*={bestK})</span>
                </div>
              ) : isOverfitting ? (
                <div className="flex items-center gap-1.5 text-amber-300 bg-amber-950/60 border border-amber-500/30 px-2 py-0.5 rounded-md text-[11px] font-medium">
                  <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                  <span>高方差过拟合警报 (K={k})</span>
                </div>
              ) : isUnderfitting ? (
                <div className="flex items-center gap-1.5 text-indigo-300 bg-indigo-950/60 border border-indigo-500/30 px-2 py-0.5 rounded-md text-[11px] font-medium">
                  <ShieldCheck className="w-3 h-3 text-indigo-400 shrink-0" />
                  <span>高偏差欠拟合警报 (K={k})</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-sky-300 bg-sky-950/60 border border-sky-500/30 px-2 py-0.5 rounded-md text-[11px] font-medium">
                  <ShieldCheck className="w-3 h-3 text-sky-400 shrink-0" />
                  <span>偏置-方差处于平衡态</span>
                </div>
              )}
            </div>

            {/* Current Metrics Micro-strip */}
            <div className="grid grid-cols-3 gap-1.5 text-[10px] font-mono bg-slate-950/50 p-2 rounded-lg border border-slate-800 text-slate-300">
              <div>
                <span className="text-slate-500 block">K 邻域</span>
                <span className="font-bold text-sky-400">K={k}</span>
              </div>
              <div>
                <span className="text-slate-500 block">空间测度</span>
                <span className="font-semibold text-slate-200 capitalize truncate block">
                  {metric === 'euclidean' ? '欧氏' : metric === 'manhattan' ? '曼哈顿' : metric === 'chebyshev' ? '切比雪夫' : '闵氏'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">LOOCV精度</span>
                <span className="font-bold text-emerald-400">
                  {(cvAccuracy * 100).toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between text-[11px] text-sky-400 font-medium pt-0.5 group-hover:text-sky-300">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-sky-400 animate-pulse" />
                呼出完整 AI 问诊视窗
              </span>
              <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
