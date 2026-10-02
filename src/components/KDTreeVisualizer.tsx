import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Point2D, KDNode, KDStep } from '../types/knn';
import { buildKDTree, simulateKDTreeNearestNeighbor } from '../utils/knnMath';
import {
  GitFork,
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  CheckCircle2,
  Scissors,
  HelpCircle,
} from 'lucide-react';

interface KDTreeVisualizerProps {
  points: Point2D[];
}

export const KDTreeVisualizer: React.FC<KDTreeVisualizerProps> = ({ points }) => {
  // Use a sensible subset of points if dataset is huge, so KD-tree is clean & readable
  const displayPoints = useMemo(() => {
    if (points.length <= 25) return points;
    // Stratified sample ~20 points
    const step = Math.ceil(points.length / 20);
    return points.filter((_, idx) => idx % step === 0).slice(0, 20);
  }, [points]);

  const kdTree = useMemo(() => {
    return buildKDTree(displayPoints, 0, [0, 100, 0, 100]);
  }, [displayPoints]);

  const [queryPoint, setQueryPoint] = useState<{ x: number; y: number }>({ x: 45, y: 55 });
  const [currentStepIdx, setCurrentStepIdx] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  // Generate simulation steps
  const steps: KDStep[] = useMemo(() => {
    if (!kdTree) return [];
    return simulateKDTreeNearestNeighbor(kdTree, queryPoint, 'euclidean');
  }, [kdTree, queryPoint]);

  // Reset step index if queryPoint or tree changes
  useEffect(() => {
    setCurrentStepIdx(0);
    setIsPlaying(false);
  }, [queryPoint, displayPoints]);

  // Autoplay timer
  useEffect(() => {
    if (!isPlaying) return;
    if (currentStepIdx >= steps.length - 1) {
      setIsPlaying(false);
      return;
    }
    const timer = setTimeout(() => {
      setCurrentStepIdx(prev => prev + 1);
    }, 1200);
    return () => clearTimeout(timer);
  }, [isPlaying, currentStepIdx, steps.length]);

  const currentStep = steps[currentStepIdx] || null;

  // Canvas for 2D spatial cuts
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const toX = (nx: number) => (nx / 100) * width;
    const toY = (ny: number) => height - (ny / 100) * height;

    // Draw background grid
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, width, height);

    // Recursively draw space partitioning lines
    function drawSplits(node: KDNode | null, targetCtx: CanvasRenderingContext2D) {
      if (!node) return;
      const { axis, splitValue, box, depth } = node;

      const isCurrentNode = currentStep && currentStep.currentNode.id === node.point.id;

      targetCtx.save();
      targetCtx.lineWidth = isCurrentNode ? 2.5 : Math.max(1, 2.2 - depth * 0.3);

      if (axis === 0) {
        // X split (Vertical line from box[2] to box[3])
        const x = toX(splitValue);
        const yTop = toY(box[3]);
        const yBottom = toY(box[2]);
        targetCtx.strokeStyle = isCurrentNode ? '#0284c7' : depth % 2 === 0 ? '#38bdf8' : '#60a5fa';
        targetCtx.beginPath();
        targetCtx.moveTo(x, yTop);
        targetCtx.lineTo(x, yBottom);
        targetCtx.stroke();
      } else {
        // Y split (Horizontal line from box[0] to box[1])
        const y = toY(splitValue);
        const xLeft = toX(box[0]);
        const xRight = toX(box[1]);
        targetCtx.strokeStyle = isCurrentNode ? '#f43f5e' : depth % 2 === 0 ? '#fb7185' : '#f472b6';
        targetCtx.beginPath();
        targetCtx.moveTo(xLeft, y);
        targetCtx.lineTo(xRight, y);
        targetCtx.stroke();
      }
      targetCtx.restore();

      drawSplits(node.left, targetCtx);
      drawSplits(node.right, targetCtx);
    }

    drawSplits(kdTree, ctx);

    // Draw Data Points
    for (const pt of displayPoints) {
      const px = toX(pt.x);
      const py = toY(pt.y);
      const isBest = currentStep && currentStep.bestPointSoFar?.id === pt.id;
      const isCurrent = currentStep && currentStep.currentNode.id === pt.id;

      ctx.beginPath();
      ctx.arc(px, py, isBest || isCurrent ? 6 : 4, 0, 2 * Math.PI);
      ctx.fillStyle = isBest ? '#10b981' : isCurrent ? '#0284c7' : '#64748b';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    }

    // Draw Query Point and search radius circle
    const qx = toX(queryPoint.x);
    const qy = toY(queryPoint.y);

    if (currentStep && currentStep.bestDistSoFar < Infinity) {
      const radiusPx = (currentStep.bestDistSoFar / 100) * width;
      ctx.beginPath();
      ctx.arc(qx, qy, radiusPx, 0, 2 * Math.PI);
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.7)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.fillStyle = 'rgba(16, 185, 129, 0.06)';
      ctx.fill();
      ctx.setLineDash([]);
    }

    // Query point symbol
    ctx.beginPath();
    ctx.arc(qx, qy, 7, 0, 2 * Math.PI);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    // Query inner dot
    ctx.beginPath();
    ctx.arc(qx, qy, 3, 0, 2 * Math.PI);
    ctx.fillStyle = '#38bdf8';
    ctx.fill();
  }, [kdTree, displayPoints, queryPoint, currentStep]);

  // Click on canvas to move query point
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const nx = Math.max(5, Math.min(95, (cx / canvas.width) * 100));
    const ny = Math.max(5, Math.min(95, 100 - (cy / canvas.height) * 100));
    setQueryPoint({ x: nx, y: ny });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            04. KD-Tree 空间分割与回溯演播 (Spatial Partitioning & Backtracking)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            二叉超平面交替切分空间 · 动态演播下沉寻优、超球面垂距相交检验与分支剪枝 (Pruning)
          </p>
        </div>

        {/* Step-by-step player controls */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            disabled={steps.length === 0}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-md transition-colors shadow-xs"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPlaying ? '暂停' : '演播回溯'}</span>
          </button>

          <button
            onClick={() => setCurrentStepIdx(prev => Math.min(steps.length - 1, prev + 1))}
            disabled={currentStepIdx >= steps.length - 1}
            className="p-1.5 text-slate-700 hover:bg-white rounded-md disabled:opacity-40 transition-colors"
            title="单步推进 (Step Forward)"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              setCurrentStepIdx(0);
              setIsPlaying(false);
            }}
            className="p-1.5 text-slate-700 hover:bg-white rounded-md transition-colors"
            title="重置到第一步"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: 2D Spatial Subspace Canvas */}
          <div className="lg:col-span-5 flex flex-col items-center">
            <div className="w-full flex items-center justify-between text-xs text-slate-500 mb-2">
              <span className="font-medium text-slate-700">2D 空间轴切分正交投影：</span>
              <span className="text-[11px]">点击画布可重设查询点 Q</span>
            </div>

            <div className="relative rounded-xl border border-slate-200 overflow-hidden shadow-xs cursor-pointer">
              <canvas
                ref={canvasRef}
                width={360}
                height={360}
                onClick={handleCanvasClick}
                className="block bg-slate-50"
              />
              <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded border border-slate-200 text-[10px] text-slate-600 flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-0.5 bg-sky-500"></span> X轴分割
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-0.5 bg-rose-500"></span> Y轴分割
                </span>
                <span className="flex items-center gap-1 font-semibold text-slate-900">
                  <span className="w-2 h-2 rounded-full bg-slate-900"></span> 查询点 Q
                </span>
              </div>
            </div>

            <div className="w-full max-w-[360px] mt-3 flex justify-between text-xs text-slate-500">
              <span>
                查询点坐标：
                <strong className="font-mono text-slate-800">
                  ({queryPoint.x.toFixed(1)}, {queryPoint.y.toFixed(1)})
                </strong>
              </span>
              <span>
                演播进度：
                <strong className="font-mono text-slate-800">
                  {steps.length > 0 ? currentStepIdx + 1 : 0} / {steps.length}
                </strong>
              </span>
            </div>
          </div>

          {/* Right: Step-by-Step Backtracking Log & Theoretical Explanation */}
          <div className="lg:col-span-7 space-y-4">
            {/* Step Card */}
            {currentStep ? (
              <div
                className={`p-4 rounded-xl border transition-all ${
                  currentStep.action === 'branch_pruned'
                    ? 'bg-amber-50/70 border-amber-200'
                    : currentStep.action === 'candidate_updated'
                    ? 'bg-emerald-50/70 border-emerald-200'
                    : currentStep.action === 'cross_subspace'
                    ? 'bg-rose-50/70 border-rose-200'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {currentStep.action === 'branch_pruned' && (
                      <Scissors className="w-4 h-4 text-amber-700" />
                    )}
                    {currentStep.action === 'candidate_updated' && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                    )}
                    {currentStep.action === 'cross_subspace' && (
                      <GitFork className="w-4 h-4 text-rose-700" />
                    )}
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-900">
                      步骤 #{currentStep.stepIndex} ·{' '}
                      {currentStep.action === 'branch_pruned'
                        ? '✂️ 分支剪枝 (Pruning Success)'
                        : currentStep.action === 'candidate_updated'
                        ? '🎯 发现更近候选点 (Update NN)'
                        : currentStep.action === 'cross_subspace'
                        ? '⚠️ 超球穿透分割面 (Visit Far Child)'
                        : currentStep.action === 'check_hyperplane'
                        ? '📏 轴向垂距比对 (Plane Test)'
                        : '下沉叶子空间'}
                    </span>
                  </div>

                  <span className="font-mono text-xs font-semibold text-slate-700">
                    当前最小距离 r = {currentStep.bestDistSoFar.toFixed(2)}
                  </span>
                </div>

                <p className="text-xs text-slate-800 leading-relaxed font-sans mt-1">
                  {currentStep.description}
                </p>

                {currentStep.bestPointSoFar && (
                  <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-600">
                    <span>
                      当前全局最优近邻点：
                      <span className="font-mono font-semibold text-slate-900">
                        ({currentStep.bestPointSoFar.x.toFixed(1)},{' '}
                        {currentStep.bestPointSoFar.y.toFixed(1)})
                      </span>
                    </span>
                    <span className="text-slate-500">
                      轴向：{currentStep.axis === 0 ? 'X 轴垂直切' : 'Y 轴水平切'}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-400">
                暂无回溯步骤
              </div>
            )}

            {/* KD-Tree Physical Principle Card */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 text-xs text-slate-700 space-y-3">
              <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                <HelpCircle className="w-4 h-4 text-sky-600" />
                <span>KD-Tree (K-Dimensional Tree) 核心物理回溯原理</span>
              </div>
              <p className="leading-relaxed text-[11px]">
                KD-Tree 是将 $k$ 维欧氏空间在各个维度上反复正交二分的二叉检索树：
              </p>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-600 pl-1">
                <li>
                  <strong className="text-slate-900">建树复杂度</strong>：$O(d \cdot N \log N)$，空间复杂度 $O(N)$。
                </li>
                <li>
                  <strong className="text-slate-900">检索下沉阶段</strong>：按坐标大小与分割超平面比较，以 $O(\log N)$ 时间迅速逼近包含查询点的叶子胞元。
                </li>
                <li>
                  <strong className="text-slate-900">剪枝判据定理</strong>：设当前最近邻距离为 r，若 |x_q - x_plane| ≥ r，则以 x_q 为球心、半径为 r 的超球与分割超平面<strong>绝对不相交</strong>。对侧子树内的所有样本点距 x_q 的距离必然 &gt; r，故可直接整树剪枝跳过！
                </li>
                <li>
                  <strong className="text-slate-900">维度灾难下的退化</strong>：当维度 d &gt; 20 时，超球面几乎必定穿透所有分割超平面，剪枝失效，回溯将遍历几乎全部叶节点，时间退化为 O(N) 暴力搜索。此时需转向 Ball-Tree 或近似近邻 (HNSW)。
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
