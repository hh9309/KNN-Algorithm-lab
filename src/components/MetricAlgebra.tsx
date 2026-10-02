import React, { useRef, useEffect, useState } from 'react';
import { MetricType } from '../types/knn';
import { HelpCircle, Check, ArrowRight } from 'lucide-react';

interface MetricAlgebraProps {
  currentMetric: MetricType;
  currentP: number;
  onSelectMetric: (metric: MetricType, p?: number) => void;
  onApplyToCanvas?: () => void;
}

export const MetricAlgebra: React.FC<MetricAlgebraProps> = ({
  currentMetric,
  currentP,
  onSelectMetric,
  onApplyToCanvas,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [sliderP, setSliderP] = useState<number>(currentP);
  const [activeTab, setActiveTab] = useState<'visualizer' | 'derivations'>('visualizer');

  // Sync internal slider if currentP changes
  useEffect(() => {
    setSliderP(currentP);
  }, [currentP]);

  // Render 2D Norm Ball on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const scale = (width / 2) * 0.72; // Radius of unit ball in pixels

    ctx.clearRect(0, 0, width, height);

    // Subtle background grid
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    const gridSize = scale / 2;
    for (let x = centerX % gridSize; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = centerY % gridSize; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Coordinate Axes
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(16, centerY);
    ctx.lineTo(width - 16, centerY);
    ctx.moveTo(centerX, 16);
    ctx.lineTo(centerX, height - 16);
    ctx.stroke();

    // Axis tick marks & labels
    ctx.fillStyle = '#64748b';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('x₁', width - 10, centerY + 14);
    ctx.fillText('x₂', centerX + 12, 16);

    ctx.fillText('-1', centerX - scale, centerY + 14);
    ctx.fillText('+1', centerX + scale, centerY + 14);
    ctx.fillText('+1', centerX - 14, centerY - scale + 4);
    ctx.fillText('-1', centerX - 14, centerY + scale + 4);

    // Draw Reference Silhouettes
    // Reference 1: L1 Diamond (dashed light amber)
    ctx.strokeStyle = 'rgba(217, 119, 6, 0.3)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(centerX + scale, centerY);
    ctx.lineTo(centerX, centerY - scale);
    ctx.lineTo(centerX - scale, centerY);
    ctx.lineTo(centerX, centerY + scale);
    ctx.closePath();
    ctx.stroke();

    // Reference 2: L2 Circle (dashed light blue)
    ctx.strokeStyle = 'rgba(2, 132, 199, 0.3)';
    ctx.beginPath();
    ctx.arc(centerX, centerY, scale, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw Main Unit Norm Ball { (x, y) | ||(x, y)||_p = 1 }
    ctx.save();
    ctx.beginPath();

    const p = currentMetric === 'chebyshev' ? 999 : sliderP;

    if (p >= 100) {
      // Chebyshev Box
      ctx.rect(centerX - scale, centerY - scale, scale * 2, scale * 2);
    } else {
      // Minkowski curve parameterization: |x|^p + |y|^p = 1
      const numSteps = 360;
      for (let i = 0; i <= numSteps; i++) {
        const theta = (i / numSteps) * 2 * Math.PI;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);
        const absCos = Math.abs(cosT);
        const absSin = Math.abs(sinT);

        // r(theta) = ( |cos|^p + |sin|^p )^(-1/p)
        const denominator = Math.pow(Math.pow(absCos, p) + Math.pow(absSin, p), 1 / p);
        const r = denominator > 0 ? 1 / denominator : 1;

        const px = centerX + scale * r * cosT;
        const py = centerY - scale * r * sinT; // invert Y for canvas
        if (i === 0) {
          ctx.moveTo(px, py);
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.closePath();
    }

    // Fill with soft gradient
    ctx.fillStyle = 'rgba(14, 165, 233, 0.12)';
    ctx.fill();
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Key vertices highlight
    const keyPoints = [
      { x: centerX + scale, y: centerY },
      { x: centerX - scale, y: centerY },
      { x: centerX, y: centerY - scale },
      { x: centerX, y: centerY + scale },
    ];
    ctx.fillStyle = '#0369a1';
    for (const pt of keyPoints) {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4, 0, 2 * Math.PI);
      ctx.fill();
    }

    ctx.restore();
  }, [sliderP, currentMetric]);

  const handleSliderChange = (newP: number) => {
    setSliderP(newP);
    if (Math.abs(newP - 1) < 0.05) {
      onSelectMetric('manhattan', 1);
    } else if (Math.abs(newP - 2) < 0.05) {
      onSelectMetric('euclidean', 2);
    } else {
      onSelectMetric('minkowski', newP);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
      {/* Header Bar */}
      <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            01. 距离代数与闵可夫斯基度量 (Minkowski Metric & Norm Ball)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            探究 $L_1$ 曼哈顿、 $L_2$ 欧几里得与 $L_\infty$ 切比雪夫度量对几何等距线的拓扑形态约束
          </p>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('visualizer')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'visualizer' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            单位范数球演播
          </button>
          <button
            onClick={() => setActiveTab('derivations')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'derivations' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            代数推导与形式化
          </button>
        </div>
      </div>

      <div className="p-6">
        {activeTab === 'visualizer' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left: Interactive Canvas */}
            <div className="lg:col-span-5 flex flex-col items-center">
              <div className="relative p-2 bg-slate-50 rounded-xl border border-slate-200/70 shadow-inner">
                <canvas
                  ref={canvasRef}
                  width={340}
                  height={340}
                  className="rounded-lg bg-white shadow-xs"
                />
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-[11px] text-slate-500 bg-white/90 backdrop-blur-xs px-2.5 py-1.5 rounded-md border border-slate-200">
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-0.5 bg-amber-500 inline-block"></span> L₁ 菱形
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-0.5 bg-sky-500 inline-block"></span> L₂ 圆形
                  </span>
                  <span className="font-semibold text-slate-800">
                    当前 p = {currentMetric === 'chebyshev' ? '∞' : sliderP.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="w-full max-w-[340px] mt-4">
                <div className="flex items-center justify-between text-xs text-slate-600 mb-1.5 font-medium">
                  <span>Minkowski 参数 p：</span>
                  <span className="font-mono text-sky-700 bg-sky-50 px-2 py-0.5 rounded">
                    {currentMetric === 'chebyshev' ? 'p = ∞ (Chebyshev)' : `p = ${sliderP.toFixed(2)}`}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="6"
                  step="0.1"
                  value={currentMetric === 'chebyshev' ? 6 : sliderP}
                  onChange={e => handleSliderChange(parseFloat(e.target.value))}
                  className="w-full accent-sky-600 h-2 bg-slate-200 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>p=0.5 (凹星形线)</span>
                  <span>p=1 (曼哈顿)</span>
                  <span>p=2 (欧氏)</span>
                  <span>p=6+ (趋向切比雪夫)</span>
                </div>
              </div>
            </div>

            {/* Right: Metric Selection & Mathematical Meaning */}
            <div className="lg:col-span-7 space-y-4">
              <div className="text-xs text-slate-500 flex items-center gap-2 mb-2">
                <span>快速度量预设与几何拓扑：</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Euclidean card */}
                <button
                  onClick={() => onSelectMetric('euclidean', 2)}
                  className={`p-3.5 rounded-lg border text-left transition-all ${
                    currentMetric === 'euclidean'
                      ? 'border-sky-500 bg-sky-50/60 shadow-xs ring-1 ring-sky-500'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-slate-900">欧几里得距离 (L₂)</span>
                    {currentMetric === 'euclidean' && <Check className="w-4 h-4 text-sky-600" />}
                  </div>
                  <div className="font-mono text-xs text-slate-600 mt-1.5 bg-white/70 p-1 rounded border border-slate-100">
                    p = 2 · √(Δx² + Δy²)
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    单位范数球为标准超球面，旋转不变，各向同性，最符合物理欧几里得几何直觉。
                  </p>
                </button>

                {/* Manhattan card */}
                <button
                  onClick={() => onSelectMetric('manhattan', 1)}
                  className={`p-3.5 rounded-lg border text-left transition-all ${
                    currentMetric === 'manhattan'
                      ? 'border-sky-500 bg-sky-50/60 shadow-xs ring-1 ring-sky-500'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-slate-900">曼哈顿距离 (L₁)</span>
                    {currentMetric === 'manhattan' && <Check className="w-4 h-4 text-sky-600" />}
                  </div>
                  <div className="font-mono text-xs text-slate-600 mt-1.5 bg-white/70 p-1 rounded border border-slate-100">
                    p = 1 · |Δx| + |Δy|
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    单位范数球为正菱形，沿网格轴线累加，在高维稀疏或轴向独立特征中抗干扰力强。
                  </p>
                </button>

                {/* Chebyshev card */}
                <button
                  onClick={() => onSelectMetric('chebyshev', 999)}
                  className={`p-3.5 rounded-lg border text-left transition-all ${
                    currentMetric === 'chebyshev'
                      ? 'border-sky-500 bg-sky-50/60 shadow-xs ring-1 ring-sky-500'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-slate-900">切比雪夫距离 (L∞)</span>
                    {currentMetric === 'chebyshev' && <Check className="w-4 h-4 text-sky-600" />}
                  </div>
                  <div className="font-mono text-xs text-slate-600 mt-1.5 bg-white/70 p-1 rounded border border-slate-100">
                    p = ∞ · max(|Δx|, |Δy|)
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    单位球为正方形，由单轴最大偏差决定。对应棋盘国王一步移动或多轴协同极值耗时。
                  </p>
                </button>
              </div>

              {/* Geometric Insight Box */}
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200/80 text-xs text-slate-700 space-y-2">
                <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                  <HelpCircle className="w-4 h-4 text-sky-600" />
                  <span>几何范数球 (Norm Ball) 与决策边界的关系</span>
                </div>
                <p className="leading-relaxed">
                  KNN 的决策边界本质上是训练集各点以所选度量为准的“邻域等距影响球”在连续空间中的交叠争夺线（即加权 Voronoi 镶嵌）。
                  当度量为 <strong className="text-slate-900">L₂</strong> 时，等距线为圆弧；为 <strong className="text-slate-900">L₁</strong> 时，等距线为 45° 倾斜折线段；为 <strong className="text-slate-900">L∞</strong> 时，等距线退化为水平与垂直相交的直角方块网格。
                </p>
                {onApplyToCanvas && (
                  <div className="pt-1 flex items-center justify-end">
                    <button
                      onClick={onApplyToCanvas}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:text-sky-800"
                    >
                      前往决策画布查看边界变化 <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Mathematical Derivations View */
          <div className="space-y-6 text-sm text-slate-800">
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50">
              <h3 className="font-semibold text-slate-900 mb-2">1. 闵可夫斯基距离通式 (Minkowski Metric)</h3>
              <div className="bg-white p-3 rounded border border-slate-200 font-mono text-center text-sm sm:text-base text-slate-900 my-2">
                D(x, y) = ( ∑ |x_i - y_i|^p )^(1/p)
              </div>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                其中 x, y ∈ ℝ^d 为特征空间中的任意两点，p ≥ 1 为范数指数阶数。
                当 p ≥ 1 时，该度量满足距离的四条严格数学公理：非负性、同一性、对称性及<strong>三角不等式 (D(x,z) ≤ D(x,y) + D(y,z))</strong>。当 0 &lt; p &lt; 1 时，三角不等式失效，空间不再构成严格赋范向量空间。
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="border border-slate-200 rounded-lg p-4 bg-white">
                <h4 className="font-semibold text-slate-900 text-xs text-sky-700 mb-1">推导分支 A · p = 2</h4>
                <div className="font-mono text-xs bg-slate-50 p-2 rounded border border-slate-200 my-2 text-slate-900">
                  D₂(x, y) = √(∑ (x_i - y_i)²)
                </div>
                <p className="text-xs text-slate-600">
                  欧几里得距离。由勾股定理在多维空间的自然推广。具备正交变换下的旋转不变性。但在维度 d → ∞ 时易产生距离集中效应。
                </p>
              </div>

              <div className="border border-slate-200 rounded-lg p-4 bg-white">
                <h4 className="font-semibold text-slate-900 text-xs text-amber-700 mb-1">推导分支 B · p = 1</h4>
                <div className="font-mono text-xs bg-slate-50 p-2 rounded border border-slate-200 my-2 text-slate-900">
                  D₁(x, y) = ∑ |x_i - y_i|
                </div>
                <p className="text-xs text-slate-600">
                  曼哈顿/城市街区距离 (City Block)。沿各坐标轴绝对差值累加。对各个轴向上的单一极端离群值相比平方放大更具鲁棒性。
                </p>
              </div>

              <div className="border border-slate-200 rounded-lg p-4 bg-white">
                <h4 className="font-semibold text-slate-900 text-xs text-indigo-700 mb-1">推导分支 C · p → ∞</h4>
                <div className="font-mono text-xs bg-slate-50 p-2 rounded border border-slate-200 my-2 text-slate-900">
                  D_∞(x, y) = lim_(p → ∞) (∑ |x_i - y_i|^p)^(1/p) = max_i |x_i - y_i|
                </div>
                <p className="text-xs text-slate-600">
                  切比雪夫极限。当 p → ∞ 时，具有最大单轴差值的项主导了整个求和，其余较小分量的 p 次方在开 p 次方后衰减至 0。
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
