import React, { useMemo } from 'react';
import { WeightMode, MetricType, Point2D } from '../types/knn';
import { computeCVCurve } from '../utils/knnMath';
import {
  Sliders,
  TrendingUp,
  AlertTriangle,
  ShieldCheck,
  Zap,
  ArrowRight,
  Activity,
  CheckCircle2,
  Scale,
  BrainCircuit,
} from 'lucide-react';

interface KSliderSliceProps {
  k: number;
  setK: (k: number) => void;
  weightMode: WeightMode;
  setWeightMode: (mode: WeightMode) => void;
  points: Point2D[];
  metric: MetricType;
  p: number;
  onNavigateToCanvas?: () => void;
}

export const KSliderSlice: React.FC<KSliderSliceProps> = ({
  k,
  setK,
  weightMode,
  setWeightMode,
  points,
  metric,
  p,
  onNavigateToCanvas,
}) => {
  // Compute Cross Validation curve across K = 1 to min(25, N-1)
  const { curve, bestK, bestAccuracy } = useMemo(() => {
    return computeCVCurve(points, metric, p, weightMode, 25);
  }, [points, metric, p, weightMode]);

  const maxAllowedK = Math.max(1, Math.min(50, points.length > 1 ? points.length - 1 : 15));
  const heuristicK = Math.max(1, Math.round(Math.sqrt(points.length || 1)));

  // Bias-Variance state assessment
  const isOverfitting = k <= 2;
  const isUnderfitting = k >= Math.max(15, Math.floor(points.length * 0.45));
  const isEvenK = k % 2 === 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            02. K值动力学与留一交叉验证曲线 (K-Slider & LOOCV Curve)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            连续切片滑动 K 值 · 权衡局部方差与全局偏差 · 实时留一交叉验证 (LOOCV) 误差曲线
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Weight mode segmented toggle */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setWeightMode('uniform')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                weightMode === 'uniform'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              等权表决 (Uniform)
            </button>
            <button
              onClick={() => setWeightMode('inverse')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                weightMode === 'inverse'
                  ? 'bg-white text-sky-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              反距离加权 1/(d+ε)
            </button>
          </div>

          {onNavigateToCanvas && (
            <button
              onClick={onNavigateToCanvas}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>进入决策边界画布</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left: K Slider & Presets */}
          <div className="lg:col-span-6 space-y-5">
            {/* Slider Control */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-sky-600" />
                  <span className="text-sm font-semibold text-slate-900">超参数 K (近邻数)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-lg font-bold text-sky-700 bg-sky-50 px-3 py-0.5 rounded-lg border border-sky-100">
                    K = {k}
                  </span>
                  {isEvenK && (
                    <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200" title="偶数K在二分类中可能出现表决平局">
                      ⚠️ 偶数K
                    </span>
                  )}
                </div>
              </div>

              <input
                type="range"
                min="1"
                max={maxAllowedK}
                step="1"
                value={Math.min(k, maxAllowedK)}
                onChange={e => setK(parseInt(e.target.value, 10))}
                className="w-full accent-sky-600 h-2 bg-slate-200 rounded-lg cursor-pointer"
              />

              <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                <span>K=1 (高方差/过拟合)</span>
                <span>经验推荐 √N ≈ {heuristicK}</span>
                <span>K={maxAllowedK} (高偏差/平原)</span>
              </div>
            </div>

            {/* Quick Slices Preset buttons */}
            <div>
              <span className="text-xs font-medium text-slate-600 block mb-2">
                动态切片快速跳转：
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  onClick={() => setK(1)}
                  className={`p-2 rounded-lg border text-left text-xs transition-all ${
                    k === 1
                      ? 'border-sky-500 bg-sky-50 font-semibold text-sky-900'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <span className="font-bold block">K = 1</span>
                  <span className="text-[10px] text-slate-500">锯齿边界 (过拟合)</span>
                </button>

                <button
                  onClick={() => setK(bestK)}
                  className={`p-2 rounded-lg border text-left text-xs transition-all ${
                    k === bestK
                      ? 'border-emerald-500 bg-emerald-50 font-semibold text-emerald-900'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <span className="font-bold block text-emerald-700 flex items-center gap-1">
                    K = {bestK} <Zap className="w-3 h-3 text-emerald-600" />
                  </span>
                  <span className="text-[10px] text-slate-500">CV 验证最优解</span>
                </button>

                <button
                  onClick={() => setK(heuristicK % 2 === 0 ? heuristicK + 1 : heuristicK)}
                  className={`p-2 rounded-lg border text-left text-xs transition-all ${
                    k === (heuristicK % 2 === 0 ? heuristicK + 1 : heuristicK)
                      ? 'border-sky-500 bg-sky-50 font-semibold text-sky-900'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <span className="font-bold block">
                    K = {heuristicK % 2 === 0 ? heuristicK + 1 : heuristicK}
                  </span>
                  <span className="text-[10px] text-slate-500">统计法则 √N</span>
                </button>

                <button
                  onClick={() => setK(Math.min(21, maxAllowedK))}
                  className={`p-2 rounded-lg border text-left text-xs transition-all ${
                    k === Math.min(21, maxAllowedK)
                      ? 'border-sky-500 bg-sky-50 font-semibold text-sky-900'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <span className="font-bold block">K = {Math.min(21, maxAllowedK)}</span>
                  <span className="text-[10px] text-slate-500">平滑平原 (欠拟合)</span>
                </button>
              </div>
            </div>

            {/* Bias-Variance Assessment Banner */}
            <div
              className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
                isOverfitting
                  ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                  : isUnderfitting
                  ? 'bg-indigo-50/70 border-indigo-200 text-indigo-900'
                  : 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
              }`}
            >
              {isOverfitting ? (
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              ) : isUnderfitting ? (
                <TrendingUp className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              ) : (
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              )}
              <div className="leading-relaxed">
                <span className="font-semibold block mb-0.5">
                  {isOverfitting
                    ? '低偏差 · 高方差 (High Variance / Overfitting)'
                    : isUnderfitting
                    ? '高偏差 · 低方差 (High Bias / Underfitting)'
                    : '偏置-方差平衡状态 (Optimal Tradeoff)'}
                </span>
                <span className="text-[11px] opacity-90">
                  {isOverfitting &&
                    'K较小时模型对局部离散噪点过度敏感，易在决策边界上产生细碎的孤岛与尖锐锯齿。'}
                  {isUnderfitting &&
                    'K过大时邻域囊括过多远端异类样本，抹平了细粒度几何分界，决策区域退化为全局多数类平原。'}
                  {!isOverfitting &&
                    !isUnderfitting &&
                    '当前 K 值在滤除孤立噪声的同时，有效保留了流形拓扑几何轮廓。'}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Cross-Validation Curve Visualization */}
          <div className="lg:col-span-6 bg-slate-50 rounded-xl p-4 border border-slate-200/80">
            <div className="flex items-center justify-between mb-3 border-b border-slate-200/60 pb-2">
              <div>
                <span className="text-xs font-semibold text-slate-900 block">
                  留一交叉验证准确率曲线 (LOOCV Accuracy vs K)
                </span>
                <span className="text-[11px] text-slate-500">
                  点击曲线任意节点可即时切片至该超参数状态
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block">峰值准确率 (K={bestK})</span>
                <span className="font-mono text-xs font-bold text-emerald-600">
                  {(bestAccuracy * 100).toFixed(1)}%
                </span>
              </div>
            </div>

            {/* SVG Chart for Cross-Validation */}
            {curve.length > 0 ? (
              <div className="relative w-full h-44">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 400 140">
                  {/* Grid lines */}
                  <line x1="30" y1="10" x2="385" y2="10" stroke="#e2e8f0" strokeDasharray="3 3" />
                  <line x1="30" y1="40" x2="385" y2="40" stroke="#e2e8f0" strokeDasharray="3 3" />
                  <line x1="30" y1="70" x2="385" y2="70" stroke="#e2e8f0" strokeDasharray="3 3" />
                  <line x1="30" y1="100" x2="385" y2="100" stroke="#e2e8f0" strokeDasharray="3 3" />
                  <line x1="30" y1="130" x2="385" y2="130" stroke="#94a3b8" />
                  <line x1="30" y1="10" x2="30" y2="130" stroke="#94a3b8" />

                  {/* Y-axis labels */}
                  <text x="24" y="14" fontSize="9" fill="#94a3b8" textAnchor="end">100%</text>
                  <text x="24" y="74" fontSize="9" fill="#94a3b8" textAnchor="end">50%</text>
                  <text x="24" y="134" fontSize="9" fill="#94a3b8" textAnchor="end">0%</text>

                  {/* Curve polyline */}
                  {(() => {
                    const maxKPoints = curve.length;
                    const getX = (curK: number) =>
                      35 + ((curK - 1) / Math.max(1, maxKPoints - 1)) * 345;
                    const getY = (acc: number) => 130 - acc * 120;

                    const pointsStr = curve
                      .map(pt => `${getX(pt.k)},${getY(pt.accuracy)}`)
                      .join(' ');

                    return (
                      <>
                        {/* Shaded Area under curve */}
                        <polygon
                          points={`35,130 ${pointsStr} ${getX(curve[curve.length - 1].k)},130`}
                          fill="rgba(14, 165, 233, 0.08)"
                        />
                        {/* Line */}
                        <polyline
                          fill="none"
                          stroke="#0284c7"
                          strokeWidth="2"
                          points={pointsStr}
                        />

                        {/* Interactive Data dots */}
                        {curve.map(pt => {
                          const cx = getX(pt.k);
                          const cy = getY(pt.accuracy);
                          const isCurrent = pt.k === k;
                          const isBest = pt.k === bestK;

                          return (
                            <g
                              key={pt.k}
                              className="cursor-pointer group"
                              onClick={() => setK(pt.k)}
                            >
                              <circle
                                cx={cx}
                                cy={cy}
                                r={isCurrent ? 5.5 : isBest ? 4.5 : 3}
                                fill={isCurrent ? '#0369a1' : isBest ? '#10b981' : '#ffffff'}
                                stroke={isCurrent ? '#ffffff' : isBest ? '#047857' : '#0284c7'}
                                strokeWidth={isCurrent ? 2 : 1.5}
                              />
                              {/* Hover / Highlight tooltip */}
                              {isCurrent && (
                                <g>
                                  <line
                                    x1={cx}
                                    y1={cy}
                                    x2={cx}
                                    y2="130"
                                    stroke="#0284c7"
                                    strokeDasharray="2 2"
                                  />
                                  <rect
                                    x={Math.min(330, Math.max(30, cx - 28))}
                                    y={cy - 22}
                                    width="56"
                                    height="18"
                                    rx="3"
                                    fill="#0f172a"
                                  />
                                  <text
                                    x={Math.min(330, Math.max(30, cx - 28)) + 28}
                                    y={cy - 10}
                                    fontSize="9"
                                    fill="#ffffff"
                                    textAnchor="middle"
                                    fontFamily="monospace"
                                  >
                                    {(pt.accuracy * 100).toFixed(1)}%
                                  </text>
                                </g>
                              )}
                            </g>
                          );
                        })}
                      </>
                    );
                  })()}
                </svg>

                {/* X Axis indicator */}
                <div className="flex justify-between text-[9px] text-slate-400 px-6 mt-1">
                  <span>K=1</span>
                  <span>K=5</span>
                  <span>K=10</span>
                  <span>K=15</span>
                  <span>K=20</span>
                  <span>K={curve[curve.length - 1].k}</span>
                </div>
              </div>
            ) : (
              <div className="h-40 flex items-center justify-center text-xs text-slate-400">
                样本数量不足以执行留一交叉验证 (至少需2个样本)
              </div>
            )}

            <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-700"></span> 当前 K={k} (准确率:{' '}
                {curve.find(c => c.k === k)
                  ? `${(curve.find(c => c.k === k)!.accuracy * 100).toFixed(1)}%`
                  : '--'}
                )
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-600"></span> 全局最优峰值 K={bestK}
              </span>
            </div>
          </div>
        </div>

        {/* 拓展理论卡片三联组 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-100">
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-sky-800">
              <BrainCircuit className="w-4 h-4 text-sky-600" />
              <span>1. 留一交叉验证 (LOOCV) 数学机理</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              每次仅留出单个样本 $x_i$，用其余 $N-1$ 个样本作为已知集预测并比对真实标签。
              <strong>训练集利用率高达 $(N-1)/N$</strong>，无随机重抽样方差扰动，是非参数近邻模型最严谨的泛化精度基准。
            </p>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
              <Scale className="w-4 h-4 text-amber-600" />
              <span>2. 偏置与方差对抗演变图谱</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              <strong>$K=1$ 时</strong>：训练准确率 100%，但对空间离散噪点过度敏感，决策边界呈破碎孤岛（极高方差）；
              <strong>$K \to N$ 时</strong>：决策边界彻底平滑退化，小类全盘误判（极高偏差）。拐点即最优平衡点。
            </p>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>3. 反距离加权与平局破局</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              采用核衰减 w_i = 1 / (d_i + ε)，邻域内高相近度样本投票权重显著高于边缘样本。不仅能化解样本失衡侵蚀，在偶数 K 平局时也能通过微小的浮点测度差异自然决胜。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
