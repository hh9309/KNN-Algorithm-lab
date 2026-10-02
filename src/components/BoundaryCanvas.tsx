import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Point2D, MetricType, WeightMode, ClassLabel, PredictionResult } from '../types/knn';
import { computeBoundaryGrid, predictKNN } from '../utils/knnMath';
import {
  Crosshair,
  Plus,
  Trash2,
  Sparkles,
  Eye,
  Sliders,
  Maximize2,
  HelpCircle,
} from 'lucide-react';

interface BoundaryCanvasProps {
  points: Point2D[];
  setPoints: React.Dispatch<React.SetStateAction<Point2D[]>>;
  k: number;
  metric: MetricType;
  p: number;
  weightMode: WeightMode;
  onProbeUpdate?: (result: PredictionResult | null) => void;
}

const CLASS_COLORS = {
  0: {
    name: '类别 A (天青蓝)',
    dot: '#0284c7',
    border: '#0369a1',
    bg: [224, 242, 254], // #e0f2fe
    ring: 'ring-sky-500',
  },
  1: {
    name: '类别 B (珊瑚红)',
    dot: '#e11d48',
    border: '#be123c',
    bg: [255, 228, 230], // #ffe4e6
    ring: 'ring-rose-500',
  },
  2: {
    name: '类别 C (薄荷绿)',
    dot: '#059669',
    border: '#047857',
    bg: [220, 252, 231], // #dcfce7
    ring: 'ring-emerald-500',
  },
};

export const BoundaryCanvas: React.FC<BoundaryCanvasProps> = ({
  points,
  setPoints,
  k,
  metric,
  p,
  weightMode,
  onProbeUpdate,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Interaction states
  const [selectedClass, setSelectedClass] = useState<ClassLabel>(0);
  const [activeTool, setActiveTool] = useState<'add' | 'probe' | 'delete'>('add');
  const [draggingPointId, setDraggingPointId] = useState<string | null>(null);
  const [probePoint, setProbePoint] = useState<{ x: number; y: number } | null>({ x: 50, y: 50 });
  const [probeResult, setProbeResult] = useState<PredictionResult | null>(null);
  const [resolution, setResolution] = useState<number>(90); // 90x90 grid for snappy 60fps
  const [showRays, setShowRays] = useState<boolean>(true);
  const [showContours, setShowContours] = useState<boolean>(true);

  // Canvas dimensions in pixels
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number }>({ width: 560, height: 560 });

  // Update canvas size on container resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const size = Math.min(Math.floor(rect.width), 600);
        if (size > 280) {
          setCanvasSize({ width: size, height: size });
        }
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Update probe prediction
  useEffect(() => {
    if (probePoint && points.length > 0) {
      const result = predictKNN(probePoint, points, k, metric, p, weightMode);
      setProbeResult(result);
      if (onProbeUpdate) onProbeUpdate(result);
    } else {
      setProbeResult(null);
      if (onProbeUpdate) onProbeUpdate(null);
    }
  }, [probePoint, points, k, metric, p, weightMode, onProbeUpdate]);

  // Main rendering loop for boundary & points
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvasSize.width;
    const height = canvasSize.height;

    // Fast boundary grid computation
    const { gridLabels, confidences, width: gw, height: gh } = computeBoundaryGrid(
      points,
      k,
      metric,
      p,
      weightMode,
      resolution
    );

    // Create ImageData buffer for decision regions
    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    // Helper map from normalized [0, 100] to canvas pixels
    const toCanvasX = (nx: number) => (nx / 100) * width;
    const toCanvasY = (ny: number) => height - (ny / 100) * height; // Invert Y
    const fromCanvasX = (cx: number) => (cx / width) * 100;
    const fromCanvasY = (cy: number) => 100 - (cy / height) * 100;

    // Draw background boundary pixels
    if (points.length > 0) {
      const scaleX = gw / width;
      const scaleY = gh / height;

      for (let py = 0; py < height; py++) {
        // Map canvas Y to normalized Y in [0, 100]
        const normY = fromCanvasY(py);
        const gy = Math.floor((normY / 100) * (gh - 1));
        const clampedGy = Math.max(0, Math.min(gh - 1, gy));
        const gyOffset = clampedGy * gw;
        const rowOffset = py * width * 4;

        for (let px = 0; px < width; px++) {
          const normX = fromCanvasX(px);
          const gx = Math.floor((normX / 100) * (gw - 1));
          const clampedGx = Math.max(0, Math.min(gw - 1, gx));

          const gIdx = gyOffset + clampedGx;
          const label = gridLabels[gIdx] as ClassLabel;
          const conf = confidences[gIdx];

          const colorRgb = CLASS_COLORS[label].bg;
          const pIndex = rowOffset + px * 4;

          // Soft pastel shading with confidence
          const intensity = 0.55 + conf * 0.45;
          data[pIndex] = Math.round(colorRgb[0] * intensity + 255 * (1 - intensity));
          data[pIndex + 1] = Math.round(colorRgb[1] * intensity + 255 * (1 - intensity));
          data[pIndex + 2] = Math.round(colorRgb[2] * intensity + 255 * (1 - intensity));
          data[pIndex + 3] = 255;
        }
      }
      ctx.putImageData(imgData, 0, 0);

      // Optional: Draw crisp boundary edges (contour detection)
      if (showContours) {
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.22)';
        ctx.lineWidth = 1.2;
        // Horizontal and vertical border trace
        for (let gy = 0; gy < gh - 1; gy++) {
          const py = toCanvasY((gy / (gh - 1)) * 100);
          for (let gx = 0; gx < gw - 1; gx++) {
            const idx = gy * gw + gx;
            const rightIdx = idx + 1;
            const downIdx = idx + gw;
            const curL = gridLabels[idx];
            const px = toCanvasX((gx / (gw - 1)) * 100);

            if (curL !== gridLabels[rightIdx]) {
              ctx.beginPath();
              ctx.moveTo(px, py - 2);
              ctx.lineTo(px, py + 2);
              ctx.stroke();
            }
            if (curL !== gridLabels[downIdx]) {
              ctx.beginPath();
              ctx.moveTo(px - 2, py);
              ctx.lineTo(px + 2, py);
              ctx.stroke();
            }
          }
        }
      }
    } else {
      ctx.fillStyle = '#fafafa';
      ctx.fillRect(0, 0, width, height);
    }

    // Draw Subtle Grid & Axes
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.lineWidth = 1;
    for (let i = 20; i <= 80; i += 20) {
      const cx = toCanvasX(i);
      const cy = toCanvasY(i);
      ctx.beginPath();
      ctx.moveTo(cx, 0);
      ctx.lineTo(cx, height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, cy);
      ctx.lineTo(width, cy);
      ctx.stroke();
    }

    // Outer Border
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, width, height);

    // Draw Training Data Points
    for (const pt of points) {
      const cx = toCanvasX(pt.x);
      const cy = toCanvasY(pt.y);
      const cfg = CLASS_COLORS[pt.label];

      // Outer glow/ring
      ctx.beginPath();
      ctx.arc(cx, cy, 6.5, 0, 2 * Math.PI);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = cfg.border;
      ctx.stroke();

      // Inner dot
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, 2 * Math.PI);
      ctx.fillStyle = cfg.dot;
      ctx.fill();
    }

    // Draw Probe Test Point (if active)
    if (probePoint && points.length > 0 && probeResult) {
      const qx = toCanvasX(probePoint.x);
      const qy = toCanvasY(probePoint.y);

      // Draw connection rays to K nearest neighbors
      if (showRays && probeResult.neighbors.length > 0) {
        const kDist = probeResult.neighbors[probeResult.neighbors.length - 1].distance;
        const radiusPx = (kDist / 100) * width;

        // Draw Norm Ball sphere / contour of radius r_K
        ctx.save();
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);

        if (metric === 'chebyshev') {
          ctx.strokeRect(qx - radiusPx, qy - radiusPx, radiusPx * 2, radiusPx * 2);
        } else if (metric === 'manhattan') {
          ctx.beginPath();
          ctx.moveTo(qx + radiusPx, qy);
          ctx.lineTo(qx, qy - radiusPx);
          ctx.lineTo(qx - radiusPx, qy);
          ctx.lineTo(qx, qy + radiusPx);
          ctx.closePath();
          ctx.stroke();
        } else if (metric === 'euclidean') {
          ctx.beginPath();
          ctx.arc(qx, qy, radiusPx, 0, 2 * Math.PI);
          ctx.stroke();
        } else {
          // Arbitrary Minkowski
          ctx.beginPath();
          const steps = 120;
          for (let i = 0; i <= steps; i++) {
            const theta = (i / steps) * 2 * Math.PI;
            const cosT = Math.cos(theta);
            const sinT = Math.sin(theta);
            const den = Math.pow(Math.pow(Math.abs(cosT), p) + Math.pow(Math.abs(sinT), p), 1 / p);
            const r = den > 0 ? radiusPx / den : radiusPx;
            const px = qx + r * cosT;
            const py = qy - r * sinT;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.stroke();
        }
        ctx.restore();

        // Rays to each neighbor
        probeResult.neighbors.forEach((nbr, idx) => {
          const nx = toCanvasX(nbr.point.x);
          const ny = toCanvasY(nbr.point.y);
          const cfg = CLASS_COLORS[nbr.point.label];

          ctx.beginPath();
          ctx.moveTo(qx, qy);
          ctx.lineTo(nx, ny);
          ctx.strokeStyle = cfg.dot;
          ctx.lineWidth = 1.2;
          ctx.setLineDash([2, 2]);
          ctx.stroke();
          ctx.setLineDash([]);

          // Distance tag at midpoint
          const midX = (qx + nx) / 2;
          const midY = (qy + ny) / 2;
          ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
          ctx.fillRect(midX - 14, midY - 8, 28, 14);
          ctx.fillStyle = '#ffffff';
          ctx.font = '9px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`d=${nbr.distance.toFixed(1)}`, midX, midY);
        });
      }

      // Draw probe crosshair target
      ctx.beginPath();
      ctx.arc(qx, qy, 8, 0, 2 * Math.PI);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#0f172a';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(qx, qy, 4, 0, 2 * Math.PI);
      ctx.fillStyle = CLASS_COLORS[probeResult.predictedLabel].dot;
      ctx.fill();
    }
  }, [
    points,
    k,
    metric,
    p,
    weightMode,
    canvasSize,
    probePoint,
    probeResult,
    resolution,
    showRays,
    showContours,
  ]);

  // Pointer event handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    const nx = (cx / canvasSize.width) * 100;
    const ny = 100 - (cy / canvasSize.height) * 100;

    // Check if clicked close to an existing point (within 14px)
    const thresholdNorm = (14 / canvasSize.width) * 100;
    let clickedPoint: Point2D | null = null;
    for (const pt of points) {
      const d = Math.hypot(pt.x - nx, pt.y - ny);
      if (d < thresholdNorm) {
        clickedPoint = pt;
        break;
      }
    }

    if (activeTool === 'delete') {
      if (clickedPoint) {
        setPoints(prev => prev.filter(p => p.id !== clickedPoint!.id));
      }
      return;
    }

    if (clickedPoint) {
      // Start dragging point
      setDraggingPointId(clickedPoint.id);
      return;
    }

    if (activeTool === 'probe') {
      setProbePoint({ x: Math.max(0, Math.min(100, nx)), y: Math.max(0, Math.min(100, ny)) });
      return;
    }

    if (activeTool === 'add') {
      const newPt: Point2D = {
        id: `pt-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        x: Math.max(2, Math.min(98, nx)),
        y: Math.max(2, Math.min(98, ny)),
        label: selectedClass,
      };
      setPoints(prev => [...prev, newPt]);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!draggingPointId && activeTool !== 'probe') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    const nx = Math.max(2, Math.min(98, (cx / canvasSize.width) * 100));
    const ny = Math.max(2, Math.min(98, 100 - (cy / canvasSize.height) * 100));

    if (draggingPointId) {
      setPoints(prev =>
        prev.map(pt => (pt.id === draggingPointId ? { ...pt, x: nx, y: ny } : pt))
      );
    } else if (activeTool === 'probe' && e.buttons === 1) {
      setProbePoint({ x: nx, y: ny });
    }
  };

  const handlePointerUp = () => {
    setDraggingPointId(null);
  };

  const handleAddRandomCluster = () => {
    const cx = 20 + Math.random() * 60;
    const cy = 20 + Math.random() * 60;
    const newPoints: Point2D[] = [];
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * 2 * Math.PI;
      const r = Math.random() * 8;
      newPoints.push({
        id: `rnd-${Date.now()}-${i}`,
        x: Math.max(3, Math.min(97, cx + r * Math.cos(angle))),
        y: Math.max(3, Math.min(97, cy + r * Math.sin(angle))),
        label: selectedClass,
      });
    }
    setPoints(prev => [...prev, ...newPoints]);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
      {/* Top Controls Bar */}
      <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            03. 决策边界实时演播 (Decision Boundary Canvas)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            在 2D 平面实时渲染分类决策超曲面 · 观察由欧氏圆弧向曼哈顿折线与切比雪夫矩形的几何演化
          </p>
        </div>

        {/* Action Tools */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTool('add')}
            className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTool === 'add'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>点选绘图</span>
          </button>

          <button
            onClick={() => setActiveTool('probe')}
            className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTool === 'probe'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>测试探针</span>
          </button>

          <button
            onClick={() => setActiveTool('delete')}
            className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTool === 'delete'
                ? 'bg-white text-rose-700 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>点选删除</span>
          </button>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Canvas Stage */}
          <div ref={containerRef} className="lg:col-span-7 flex flex-col items-center">
            {/* Class Brush Bar */}
            <div className="w-full flex items-center justify-between pb-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-medium">当前画笔类别：</span>
                <div className="flex items-center gap-1.5">
                  {([0, 1, 2] as ClassLabel[]).map(lbl => {
                    const c = CLASS_COLORS[lbl];
                    const isSelected = selectedClass === lbl;
                    return (
                      <button
                        key={lbl}
                        onClick={() => setSelectedClass(lbl)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-all ${
                          isSelected
                            ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: c.dot }}
                        ></span>
                        <span>{lbl === 0 ? '类别 A' : lbl === 1 ? '类别 B' : '类别 C'}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={handleAddRandomCluster}
                className="text-xs text-sky-700 hover:text-sky-800 font-medium flex items-center gap-1"
                title="在随机位置生成一组当前类别的点簇"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>+ 随机簇</span>
              </button>
            </div>

            {/* Canvas Box */}
            <div className="relative touch-none select-none rounded-xl border border-slate-200/90 shadow-xs bg-slate-50 overflow-hidden">
              <canvas
                ref={canvasRef}
                width={canvasSize.width}
                height={canvasSize.height}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                className="cursor-crosshair block"
              />

              {/* Axis Label overlays */}
              <div className="absolute bottom-1 right-2 text-[10px] font-mono text-slate-500 pointer-events-none">
                X₁ ∈ [0, 100]
              </div>
              <div className="absolute top-2 left-2 text-[10px] font-mono text-slate-500 pointer-events-none">
                X₂ ∈ [0, 100]
              </div>

              {points.length === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-white/80 pointer-events-none">
                  <p className="text-sm font-semibold text-slate-700">画布当前为空</p>
                  <p className="text-xs text-slate-500 mt-1 text-center">
                    在画布上点击任意位置即可添加样本点，或在上方选择“四大案例库”一键导入标准数据集。
                  </p>
                </div>
              )}
            </div>

            {/* Bottom auxiliary toggles */}
            <div className="w-full flex items-center justify-between text-xs text-slate-500 mt-3 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showRays}
                    onChange={e => setShowRays(e.target.checked)}
                    className="accent-sky-600 rounded"
                  />
                  <span>近邻连线与超球</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showContours}
                    onChange={e => setShowContours(e.target.checked)}
                    className="accent-sky-600 rounded"
                  />
                  <span>决策轮廓高亮</span>
                </label>
              </div>

              <div className="flex items-center gap-2">
                <span>网格精度：</span>
                <button
                  onClick={() => setResolution(60)}
                  className={`px-1.5 py-0.5 rounded text-[11px] ${
                    resolution === 60 ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  极速 (60²)
                </button>
                <button
                  onClick={() => setResolution(90)}
                  className={`px-1.5 py-0.5 rounded text-[11px] ${
                    resolution === 90 ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  标准 (90²)
                </button>
                <button
                  onClick={() => setResolution(120)}
                  className={`px-1.5 py-0.5 rounded text-[11px] ${
                    resolution === 120 ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  高清 (120²)
                </button>
              </div>
            </div>
          </div>

          {/* Right Stage: Interactive Probe Telemetry & Neighborhood Inspection */}
          <div className="lg:col-span-5 space-y-4">
            {/* Current Probe HUD */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-2 mb-3">
                <div className="flex items-center gap-2">
                  <Crosshair className="w-4 h-4 text-sky-600" />
                  <span className="text-xs font-semibold text-slate-900">
                    测试探针采样点 (Query Probe)
                  </span>
                </div>
                {probePoint && (
                  <span className="font-mono text-xs text-slate-600">
                    X₁={probePoint.x.toFixed(1)}, X₂={probePoint.y.toFixed(1)}
                  </span>
                )}
              </div>

              {probeResult && probePoint ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-slate-200/70">
                    <div>
                      <span className="text-xs text-slate-500 block">KNN 分类判决结果</span>
                      <span className="text-sm font-bold text-slate-900 flex items-center gap-1.5 mt-0.5">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: CLASS_COLORS[probeResult.predictedLabel].dot }}
                        ></span>
                        {CLASS_COLORS[probeResult.predictedLabel].name}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-slate-500 block">表决置信度</span>
                      <span className="text-sm font-bold font-mono text-sky-700">
                        {(probeResult.confidence * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {/* Class Probabilities Progress bars */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-medium text-slate-600 block">
                      类别概率 / 加权得票比例：
                    </span>
                    {([0, 1, 2] as ClassLabel[]).map(lbl => {
                      const prob = probeResult.probabilities[lbl];
                      const cfg = CLASS_COLORS[lbl];
                      return (
                        <div key={lbl} className="space-y-0.5">
                          <div className="flex justify-between text-[10px] text-slate-600">
                            <span>{lbl === 0 ? '类别 A' : lbl === 1 ? '类别 B' : '类别 C'}</span>
                            <span className="font-mono">{(prob * 100).toFixed(1)}%</span>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-300"
                              style={{ width: `${prob * 100}%`, backgroundColor: cfg.dot }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* K Nearest Neighbors ranked table */}
                  <div className="pt-2">
                    <div className="flex justify-between items-center text-[11px] text-slate-600 font-medium mb-1.5">
                      <span>Top {Math.min(k, probeResult.neighbors.length)} 近邻距离分解：</span>
                      <span className="text-slate-400 font-normal">
                        权重: {weightMode === 'inverse' ? '1/(d+ε)' : '等权 1.0'}
                      </span>
                    </div>
                    <div className="max-h-36 overflow-y-auto rounded-lg border border-slate-200 bg-white divide-y divide-slate-100 text-xs">
                      {probeResult.neighbors.map((n, idx) => (
                        <div
                          key={idx}
                          className="px-2.5 py-1.5 flex items-center justify-between hover:bg-slate-50"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-slate-400 w-3">
                              #{idx + 1}
                            </span>
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: CLASS_COLORS[n.point.label].dot }}
                            ></span>
                            <span className="font-mono text-[11px] text-slate-700">
                              ({n.point.x.toFixed(1)}, {n.point.y.toFixed(1)})
                            </span>
                          </div>
                          <div className="flex items-center gap-3 font-mono text-[11px]">
                            <span className="text-slate-600">d = {n.distance.toFixed(2)}</span>
                            <span className="text-slate-400 text-[10px]">
                              w = {n.weight.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-slate-400">
                  请在画布上激活“测试探针”或载入样本点
                </div>
              )}
            </div>

            {/* Metric Shape Commentary */}
            <div className="p-3.5 bg-sky-50/60 rounded-xl border border-sky-100 text-xs text-slate-700">
              <span className="font-semibold text-sky-950 block mb-1">
                当前几何度量观察：
                {metric === 'euclidean'
                  ? '欧几里得距离 (L₂)'
                  : metric === 'manhattan'
                  ? '曼哈顿距离 (L₁)'
                  : metric === 'chebyshev'
                  ? '切比雪夫距离 (L∞)'
                  : `Minkowski (p=${p.toFixed(2)})`}
              </span>
              <p className="text-slate-600 leading-relaxed text-[11px]">
                {metric === 'euclidean' &&
                  '欧氏距离下，两样本间的等距平分线为严格垂直平分线，多个点交叠形成平滑的 Voronoi 圆弧胞元。'}
                {metric === 'manhattan' &&
                  '曼哈顿距离下，等距线呈现出 45° 倾斜的阶梯状多边形边界，对于倾斜轴线特征会产生明显的阶梯效应。'}
                {metric === 'chebyshev' &&
                  '切比雪夫度量下，等距包络为水平与垂直相交的直角方块，决策区域呈现出阶梯网格方块。'}
                {metric === 'minkowski' &&
                  `随着参数 p 从 1 变化至 ${p.toFixed(2)}，几何等距包络平滑地从菱形向圆环以至超椭圆演变。`}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
