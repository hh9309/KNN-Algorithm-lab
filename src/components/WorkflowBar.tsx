import React from 'react';
import { MousePointerClick, Compass, Sliders, LineChart, ChevronRight } from 'lucide-react';

interface WorkflowBarProps {
  currentStep: number;
  setCurrentStep: (step: number) => void;
  onNavigateTab: (tabId: string) => void;
}

export const WorkflowBar: React.FC<WorkflowBarProps> = ({
  currentStep,
  setCurrentStep,
  onNavigateTab,
}) => {
  const steps = [
    {
      id: 1,
      title: '样本采集与载入',
      desc: '在画布点击或载入基准案例',
      icon: MousePointerClick,
      targetTab: 'workspace',
    },
    {
      id: 2,
      title: '度量选择与范数球',
      desc: '定义 Minkowski 空间距离测度',
      icon: Compass,
      targetTab: 'metric',
    },
    {
      id: 3,
      title: 'K值调优与交叉验证',
      desc: '寻找最优邻域与权重平衡点',
      icon: Sliders,
      targetTab: 'kcurve',
    },
    {
      id: 4,
      title: '边界演播与评估导出',
      desc: '决策边界多边形与实验报告',
      icon: LineChart,
      targetTab: 'export',
    },
  ];

  return (
    <div className="bg-white border-b border-slate-200 py-2.5 px-4 sm:px-6 w-full text-center">
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-3 overflow-x-auto py-0.5">
        <div className="flex items-center justify-center mx-auto gap-1 sm:gap-2 flex-nowrap">
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wider shrink-0 mr-1">
            全流程实验管道：
          </span>
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isCurrent = currentStep === step.id;
            const isCompleted = currentStep > step.id;

            return (
              <React.Fragment key={step.id}>
                <button
                  onClick={() => {
                    setCurrentStep(step.id);
                    onNavigateTab(step.targetTab);
                  }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all text-left group whitespace-nowrap ${
                    isCurrent
                      ? 'bg-sky-50 text-sky-900 border border-sky-200 shadow-xs'
                      : isCompleted
                      ? 'text-slate-700 hover:bg-slate-100'
                      : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-semibold ${
                      isCurrent
                        ? 'bg-sky-600 text-white'
                        : isCompleted
                        ? 'bg-slate-200 text-slate-700'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {step.id}
                  </span>
                  <div>
                    <span className="block font-semibold leading-tight">{step.title}</span>
                    <span className="text-[10px] text-slate-500 hidden xl:block">{step.desc}</span>
                  </div>
                </button>
                {idx < steps.length - 1 && (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};
