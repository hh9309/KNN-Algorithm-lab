import React from 'react';
import { DatasetPreset, Point2D, MetricType } from '../types/knn';
import { getPresetDatasets } from '../utils/knnMath';
import { Database, ArrowRight, Check } from 'lucide-react';

interface PresetCaseStudiesProps {
  onLoadPreset: (preset: DatasetPreset) => void;
  currentPresetId?: string;
  onNavigateToCanvas?: () => void;
}

export const PresetCaseStudies: React.FC<PresetCaseStudiesProps> = ({
  onLoadPreset,
  currentPresetId,
  onNavigateToCanvas,
}) => {
  const presets = getPresetDatasets();

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            05. 四大几何与模式识别实战案例库 (Benchmark Datasets)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            一键载入经典非线性流形、真实高维手写体降维投影与密度噪点数据集
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Database className="w-4 h-4 text-sky-600" />
          <span>共收录 4 组经典基准测试流形</span>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {presets.map(preset => {
            const isSelected = currentPresetId === preset.id;
            const classCounts = preset.points.reduce((acc, p) => {
              acc[p.label] = (acc[p.label] || 0) + 1;
              return acc;
            }, {} as Record<number, number>);

            return (
              <div
                key={preset.id}
                className={`p-5 rounded-xl border transition-all text-left flex flex-col justify-between ${
                  isSelected
                    ? 'border-sky-500 bg-sky-50/40 shadow-xs ring-1 ring-sky-500'
                    : 'border-slate-200/90 hover:border-slate-300 bg-white hover:bg-slate-50/50'
                }`}
              >
                <div>
                  {/* Top info row */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs text-slate-500 font-medium">
                      {preset.category === 'geometry' && '经典几何分布'}
                      {preset.category === 'manifold' && '复杂拓扑流形'}
                      {preset.category === 'real_world' && '高维投影表征'}
                      {preset.category === 'anomaly' && '噪声与离群检测'}
                      <span className="mx-1.5">·</span>
                      {preset.points.length} 个样本
                    </span>
                    {isSelected && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700 bg-sky-100/80 px-2 py-0.5 rounded">
                        <Check className="w-3 h-3" /> 当前使用中
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 leading-snug">
                    {preset.name}
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                    {preset.subtitle}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100 leading-relaxed">
                    {preset.description}
                  </p>
                </div>

                {/* Bottom specs & Load Action */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="space-y-0.5 text-[11px] text-slate-500">
                    <div>
                      推荐度量：
                      <span className="font-semibold text-slate-800 uppercase">
                        {preset.recommendedMetric}
                      </span>
                    </div>
                    <div>
                      参考最优 K：
                      <span className="font-semibold text-sky-700 font-mono">
                        K = {preset.recommendedK}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      onLoadPreset(preset);
                      if (onNavigateToCanvas) onNavigateToCanvas();
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      isSelected
                        ? 'bg-sky-600 text-white hover:bg-sky-700'
                        : 'bg-slate-900 text-white hover:bg-slate-800'
                    }`}
                  >
                    <span>载入画布</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
