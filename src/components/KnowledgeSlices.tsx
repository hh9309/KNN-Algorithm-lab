import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  AlertOctagon,
  Scale,
  Compass,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Cpu,
  Briefcase,
  ArrowRight,
  Layers,
  Users,
  ShieldAlert,
  Search,
  Dna,
  Zap,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Radio,
} from 'lucide-react';

// ==========================================
// 动画 1：Lp 广义范数球连续形变呼吸动效组件
// ==========================================
interface NormBallMorpherProps {
  onPChange?: (p: number) => void;
}

const NormBallMorpher: React.FC<NormBallMorpherProps> = ({ onPChange }) => {
  const [p, setP] = useState<number>(2.0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [direction, setDirection] = useState<number>(1); // 1: 增大, -1: 减小

  // 连续形变循环定时器
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setP(prev => {
        let next = prev + direction * 0.05;
        if (next >= 8.0) {
          setDirection(-1);
          return 8.0;
        }
        if (next <= 0.6) {
          setDirection(1);
          return 0.6;
        }
        return parseFloat(next.toFixed(2));
      });
    }, 45);
    return () => clearInterval(interval);
  }, [isPlaying, direction]);

  useEffect(() => {
    onPChange?.(p);
  }, [p, onPChange]);

  // 计算单位等距线 |x|^p + |y|^p = 1 在二维平面的离散闭合路径
  const { pathD, pointsCount } = useMemo(() => {
    const pts: [number, number][] = [];
    const count = 120;
    const scale = 72; // 单位半径对应像素
    const cx = 110;
    const cy = 110;

    for (let i = 0; i <= count; i++) {
      const theta = (i / count) * 2 * Math.PI;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);

      let r: number;
      if (p >= 15) {
        r = 1 / Math.max(Math.abs(cosT), Math.abs(sinT));
      } else {
        const denom = Math.pow(Math.pow(Math.abs(cosT), p) + Math.pow(Math.abs(sinT), p), 1 / p);
        r = 1 / denom;
      }

      const x = cx + r * cosT * scale;
      const y = cy - r * sinT * scale;
      pts.push([x, y]);
    }

    const d =
      pts.reduce((acc, [x, y], idx) => {
        return idx === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : `${acc} L ${x.toFixed(1)} ${y.toFixed(1)}`;
      }, '') + ' Z';

    return { pathD: d, pointsCount: pts.length };
  }, [p]);

  // 判定当前拓扑状态
  const topologyInfo = useMemo(() => {
    if (p < 0.9) {
      return {
        label: '非凸拟范数 (星形内凹)',
        desc: '三角不等式失效，四角锐利内收，空间不构成赋范向量空间',
        color: 'text-rose-600 bg-rose-50 border-rose-200',
      };
    }
    if (Math.abs(p - 1.0) < 0.25) {
      return {
        label: 'L1 曼哈顿范数 (45° 菱形八面体)',
        desc: '各维度偏差绝对值线性累加，对单维度极端噪点具有中位数抗扰鲁棒性',
        color: 'text-amber-700 bg-amber-50 border-amber-200',
      };
    }
    if (Math.abs(p - 2.0) < 0.35) {
      return {
        label: 'L2 欧氏范数 (各向同性超圆球)',
        desc: '满足旋转变换几何不变性，在全方向上等距测度均匀，形成光滑二次分界',
        color: 'text-sky-700 bg-sky-50 border-sky-200',
      };
    }
    return {
      label: 'L∞ 切比雪夫范数 (正交超立方体)',
      desc: '由单轴最大极端绝对差主导，几何边界外扩顶满，诱导网格正交方块阶梯',
      color: 'text-indigo-700 bg-indigo-50 border-indigo-200',
    };
  }, [p]);

  return (
    <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 text-white shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-bold tracking-wide uppercase text-slate-200">
            Lp 广义范数球连续形变呼吸动效 (Morphing Norm Ball)
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-sky-500/20 text-sky-300 border border-sky-500/30">
            p = {p.toFixed(2)}
          </span>
        </div>

        {/* 交互控制器 */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPlaying(v => !v)}
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-medium border border-slate-700 transition-colors"
          >
            {isPlaying ? <Pause className="w-3 h-3 text-amber-400" /> : <Play className="w-3 h-3 text-emerald-400" />}
            <span>{isPlaying ? '暂停形变' : '自动形变'}</span>
          </button>
          <button
            onClick={() => {
              setP(2.0);
              setDirection(1);
            }}
            className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors"
            title="复位至 L2 欧氏圆"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
        {/* 左侧：动态几何 SVG 视窗 */}
        <div className="md:col-span-5 flex flex-col items-center justify-center relative">
          <div className="w-[220px] h-[220px] bg-slate-950/80 rounded-xl border border-slate-800 p-1 relative flex items-center justify-center shadow-inner overflow-hidden">
            {/* 背景动态呼吸光圈 */}
            <div
              className="absolute rounded-full border border-sky-500/20 transition-all duration-300 pointer-events-none"
              style={{
                width: `${144 + Math.sin(p * 2) * 6}px`,
                height: `${144 + Math.sin(p * 2) * 6}px`,
              }}
            />

            <svg viewBox="0 0 220 220" className="w-full h-full">
              {/* 网格底纹 */}
              <defs>
                <pattern id="normGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#334155" strokeWidth="0.5" strokeOpacity="0.3" />
                </pattern>
                <linearGradient id="ballGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#0284c7" stopOpacity="0.2" />
                </linearGradient>
              </defs>
              <rect width="220" height="220" fill="url(#normGrid)" />

              {/* 坐标轴 X 与 Y */}
              <line x1="20" y1="110" x2="200" y2="110" stroke="#64748b" strokeWidth="1" strokeDasharray="2,2" />
              <line x1="110" y1="20" x2="110" y2="200" stroke="#64748b" strokeWidth="1" strokeDasharray="2,2" />

              {/* 单位刻度线点 (+1, -1) */}
              <circle cx="182" cy="110" r="2" fill="#94a3b8" />
              <circle cx="38" cy="110" r="2" fill="#94a3b8" />
              <circle cx="110" cy="38" r="2" fill="#94a3b8" />
              <circle cx="110" cy="182" r="2" fill="#94a3b8" />

              <text x="186" y="106" fill="#94a3b8" fontSize="9" fontFamily="monospace">
                +1
              </text>
              <text x="24" y="106" fill="#94a3b8" fontSize="9" fontFamily="monospace">
                -1
              </text>
              <text x="114" y="34" fill="#94a3b8" fontSize="9" fontFamily="monospace">
                +1
              </text>
              <text x="114" y="196" fill="#94a3b8" fontSize="9" fontFamily="monospace">
                -1
              </text>

              {/* 形变范数球闭合路径 */}
              <path
                d={pathD}
                fill="url(#ballGradient)"
                stroke="#38bdf8"
                strokeWidth="2.5"
                className="transition-all duration-75"
              />

              {/* 中心原点 */}
              <circle cx="110" cy="110" r="3" fill="#f8fafc" />
            </svg>
          </div>

          <span className="text-[10px] text-slate-400 mt-2 font-mono">
            等距闭合线方程: |x|^{p.toFixed(2)} + |y|^{p.toFixed(2)} = 1.0
          </span>
        </div>

        {/* 右侧：交互参数调谐面板与度量特性注解 */}
        <div className="md:col-span-7 space-y-3">
          {/* 当前几何拓扑状态徽章 */}
          <div className={`p-2.5 rounded-lg border text-xs space-y-1 ${topologyInfo.color}`}>
            <div className="font-bold flex items-center justify-between">
              <span>{topologyInfo.label}</span>
              <span className="font-mono text-[10px] opacity-80">范数球拓扑</span>
            </div>
            <p className="text-[11px] leading-relaxed opacity-90">{topologyInfo.desc}</p>
          </div>

          {/* 典型度量一键预设 */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-slate-300 block">典型几何度量快捷预设：</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              <button
                onClick={() => {
                  setP(0.5);
                  setIsPlaying(false);
                }}
                className={`px-2 py-1.5 rounded text-[11px] font-mono border transition-all text-center ${
                  Math.abs(p - 0.5) < 0.1
                    ? 'bg-rose-500 text-white border-rose-400 font-bold'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
                }`}
              >
                p=0.5 (凹星形)
              </button>

              <button
                onClick={() => {
                  setP(1.0);
                  setIsPlaying(false);
                }}
                className={`px-2 py-1.5 rounded text-[11px] font-mono border transition-all text-center ${
                  Math.abs(p - 1.0) < 0.1
                    ? 'bg-amber-500 text-white border-amber-400 font-bold'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
                }`}
              >
                p=1.0 (曼哈顿)
              </button>

              <button
                onClick={() => {
                  setP(2.0);
                  setIsPlaying(false);
                }}
                className={`px-2 py-1.5 rounded text-[11px] font-mono border transition-all text-center ${
                  Math.abs(p - 2.0) < 0.1
                    ? 'bg-sky-500 text-white border-sky-400 font-bold'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
                }`}
              >
                p=2.0 (欧几里得)
              </button>

              <button
                onClick={() => {
                  setP(8.0);
                  setIsPlaying(false);
                }}
                className={`px-2 py-1.5 rounded text-[11px] font-mono border transition-all text-center ${
                  p >= 7.5
                    ? 'bg-indigo-500 text-white border-indigo-400 font-bold'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
                }`}
              >
                p=∞ (切比雪夫)
              </button>
            </div>
          </div>

          {/* 连续滑动微调 */}
          <div className="pt-2 space-y-1">
            <div className="flex justify-between text-[11px] text-slate-400 font-mono">
              <span>连续微调范数阶数 p:</span>
              <span className="text-sky-300 font-bold">{p.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="8.0"
              step="0.05"
              value={p}
              onChange={e => {
                setP(parseFloat(e.target.value));
                setIsPlaying(false);
              }}
              className="w-full accent-sky-400 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>0.5 (非凸内凹)</span>
              <span>1.0 (菱形)</span>
              <span>2.0 (正圆)</span>
              <span>8.0+ (立方)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 动画 2：6步在线推断流水线脉冲推进与近邻雷达动效
// ==========================================
const PipelinePulseFlowchart: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isAutoPlaying, setIsAutoPlaying] = useState<boolean>(true);

  // 时序脉冲自动推进
  useEffect(() => {
    if (!isAutoPlaying) return;
    const timer = setInterval(() => {
      setCurrentStep(s => (s % 6) + 1);
    }, 2200);
    return () => clearInterval(timer);
  }, [isAutoPlaying]);

  // 模拟雷达扫描样本数据集
  const radarPoints = [
    { id: 1, x: 50, y: 35, cls: 0, d: 2.2, isNear: true, w: 0.45 },
    { id: 2, x: 65, y: 45, cls: 1, d: 1.5, isNear: true, w: 0.67 },
    { id: 3, x: 58, y: 60, cls: 1, d: 1.8, isNear: true, w: 0.55 },
    { id: 4, x: 42, y: 55, cls: 1, d: 1.9, isNear: true, w: 0.52 },
    { id: 5, x: 38, y: 40, cls: 2, d: 2.1, isNear: true, w: 0.48 },
    { id: 6, x: 75, y: 25, cls: 0, d: 4.8, isNear: false, w: 0.2 },
    { id: 7, x: 80, y: 70, cls: 1, d: 5.2, isNear: false, w: 0.18 },
    { id: 8, x: 25, y: 75, cls: 2, d: 4.5, isNear: false, w: 0.22 },
    { id: 9, x: 20, y: 30, cls: 0, d: 5.6, isNear: false, w: 0.16 },
  ];

  // 阶段步骤详情定义
  const stepsMeta = [
    {
      step: 1,
      title: '查询输入与标准化',
      badge: '01 输入端',
      tag: 'Z-score',
      desc: '输入待测样本 x_q = [52, 48]，执行 z = (x - μ) / σ 消除量纲方差差异',
      action: '待测样本就绪',
    },
    {
      step: 2,
      title: '距离矩阵广播计算',
      badge: '02 测度场',
      tag: 'Pairwise D',
      desc: '以 x_q 为中心发射测度射线，广播计算到全库 N 个样本的欧氏/闵氏距离 D_i',
      action: '全域距离测度计算中...',
    },
    {
      step: 3,
      title: 'Top-K 近邻快速筛选',
      badge: '03 邻域划分',
      tag: 'argpartition',
      desc: '对距离序列升序部分排序，锁定半径最短的 K=5 个最近邻核心样本集合',
      action: '雷达聚焦锁定 Top-5',
    },
    {
      step: 4,
      title: '邻域样本权重核分配',
      badge: '04 核函数',
      tag: 'IDW 衰减',
      desc: '分配权值 w_i = 1 / (d_i + ε)，近大远小衰减，有效防止多数类边界吞噬',
      action: '计算反距离权重连线',
    },
    {
      step: 5,
      title: '加权投票与后验估算',
      badge: '05 统计汇聚',
      tag: 'Posterior P',
      desc: '多分类加权汇聚各类别总票数：Class 0: 0.45, Class 1: 1.74, Class 2: 0.48',
      action: '动态柱状图汇聚表决',
    },
    {
      step: 6,
      title: '决策判决与平局处置',
      badge: '06 输出端',
      tag: 'Decision',
      desc: '胜出类别 Class 1（珊瑚红），置信度达 65.2%，完成推断闭环！',
      action: '✓ 分类推断决策达成',
    },
  ];

  return (
    <div className="border border-slate-200 rounded-xl p-5 bg-gradient-to-b from-slate-50/80 to-white space-y-5">
      {/* 顶部流水线控制条 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-ping" />
          <span className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
            <Cpu className="w-4 h-4 text-sky-600" />
            <span>KNN 在线推断执行全流水线流程图 (Pipeline Flowchart)</span>
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-sky-100 text-sky-800 font-bold">
            当前阶段: 步骤 0{currentStep} / 06
          </span>
        </div>

        {/* 播控按钮组 */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setCurrentStep(s => (s === 1 ? 6 : s - 1))}
            className="p-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200 shadow-xs text-xs"
            title="上一步"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setIsAutoPlaying(v => !v)}
            className="flex items-center gap-1 px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            {isAutoPlaying ? <Pause className="w-3.5 h-3.5 text-amber-400" /> : <Play className="w-3.5 h-3.5 text-emerald-400" />}
            <span>{isAutoPlaying ? '暂停推进' : '自动推进'}</span>
          </button>

          <button
            onClick={() => setCurrentStep(s => (s % 6) + 1)}
            className="p-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200 shadow-xs text-xs"
            title="下一步"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => {
              setCurrentStep(1);
              setIsAutoPlaying(true);
            }}
            className="p-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200 shadow-xs text-xs"
            title="重新开始推断"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 6 步动态卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-2.5 relative">
        {stepsMeta.map(s => {
          const isActive = currentStep === s.step;
          const isPassed = currentStep > s.step;
          return (
            <div
              key={s.step}
              onClick={() => {
                setCurrentStep(s.step);
                setIsAutoPlaying(false);
              }}
              className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden ${
                isActive
                  ? 'bg-sky-50/90 border-sky-400 ring-2 ring-sky-400/40 shadow-md scale-[1.02]'
                  : isPassed
                  ? 'bg-white/95 border-slate-200 opacity-90'
                  : 'bg-white border-slate-200 opacity-60 hover:opacity-100'
              }`}
            >
              {/* 动态脉冲发光条 */}
              {isActive && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-400 to-indigo-500 animate-pulse" />
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                      isActive
                        ? 'bg-sky-600 text-white shadow-sm ring-2 ring-sky-300 animate-pulse'
                        : isPassed
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    0{s.step}
                  </span>
                  <span className="text-[9px] font-mono text-slate-500 font-semibold">{s.tag}</span>
                </div>
                <h5 className={`text-xs font-bold ${isActive ? 'text-sky-900' : 'text-slate-800'}`}>{s.title}</h5>
                <p className="text-[10px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">{s.desc}</p>
              </div>

              <div
                className={`mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] font-medium ${
                  isActive ? 'text-sky-700 font-bold' : 'text-slate-400'
                }`}
              >
                <span>{isActive ? '正在执行' : isPassed ? '已完成' : '待处理'}</span>
                <ArrowRight
                  className={`w-3 h-3 hidden md:block ${isActive ? 'text-sky-600 animate-pulse' : 'text-slate-300'}`}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* 流程图下方：同步内置【推断时序雷达与加权投票微视窗】 */}
      <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 text-white space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span className="text-xs font-bold text-slate-200">
              实时推断微视窗 · 阶段 0{currentStep}：{stepsMeta[currentStep - 1].action}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            K = 5 · 反距离加权 w_i = 1 / (d_i + 0.01)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          {/* 左侧：2D 几何近邻雷达视窗 */}
          <div className="md:col-span-6 flex flex-col items-center">
            <div className="w-full max-w-[280px] h-[180px] bg-slate-950 rounded-lg border border-slate-800 relative flex items-center justify-center overflow-hidden">
              <svg viewBox="0 0 100 80" className="w-full h-full">
                {/* 网格线 */}
                <line x1="0" y1="40" x2="100" y2="40" stroke="#334155" strokeWidth="0.5" strokeDasharray="1,1" />
                <line x1="50" y1="0" x2="50" y2="80" stroke="#334155" strokeWidth="0.5" strokeDasharray="1,1" />

                {/* 阶段 2~3：雷达发射扫描脉冲圈 */}
                {currentStep >= 2 && (
                  <circle
                    cx="52"
                    cy="48"
                    r={currentStep === 2 ? '30' : '20'}
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="1"
                    strokeDasharray={currentStep === 3 ? '2,2' : 'none'}
                    className={currentStep === 2 ? 'animate-ping' : ''}
                    opacity={currentStep === 2 ? 0.6 : 0.8}
                  />
                )}

                {/* 阶段 4~6：近邻连线 (粗细代表权重) */}
                {currentStep >= 4 &&
                  radarPoints
                    .filter(p => p.isNear)
                    .map(p => (
                      <line
                        key={`line-${p.id}`}
                        x1="52"
                        y1="48"
                        x2={p.x}
                        y2={p.y}
                        stroke={p.cls === 1 ? '#f87171' : p.cls === 0 ? '#38bdf8' : '#4ade80'}
                        strokeWidth={p.w * 2.5}
                        strokeOpacity="0.75"
                      />
                    ))}

                {/* 背景样本点 */}
                {radarPoints.map(p => {
                  const isTopK = p.isNear;
                  return (
                    <g key={p.id}>
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={isTopK && currentStep >= 3 ? '3.2' : '2.2'}
                        fill={p.cls === 1 ? '#ef4444' : p.cls === 0 ? '#0284c7' : '#10b981'}
                        stroke={isTopK && currentStep >= 3 ? '#ffffff' : 'none'}
                        strokeWidth="1"
                      />
                      {currentStep >= 3 && isTopK && (
                        <text x={p.x + 3} y={p.y - 3} fill="#cbd5e1" fontSize="3.5" fontFamily="monospace">
                          d={p.d}
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* 查询样本点 x_q */}
                <circle cx="52" cy="48" r="4.5" fill="#f59e0b" stroke="#ffffff" strokeWidth="1.5" />
                <text x="56" y="52" fill="#fde68a" fontSize="4.5" fontWeight="bold">
                  x_q
                </text>
              </svg>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-2 font-mono">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400" /> 待测点 x_q
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-sky-500" /> 类0
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500" /> 类1
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> 类2
              </span>
            </div>
          </div>

          {/* 右侧：加权投票与后验置信度动态状态栏 */}
          <div className="md:col-span-6 space-y-2.5">
            <span className="text-[11px] font-semibold text-slate-300 block">后验表决汇聚分布 (Class Posterior Votes)：</span>

            {/* 类 1 投票柱 */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-mono">
                <span className="text-red-300 font-semibold">类别 1 (Coral Red) · 核心胜出类</span>
                <span className="text-red-400 font-bold">1.74 票 (65.2%)</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-red-500 h-full rounded-full transition-all duration-500"
                  style={{ width: currentStep >= 5 ? '65.2%' : currentStep >= 3 ? '40%' : '10%' }}
                />
              </div>
            </div>

            {/* 类 2 投票柱 */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-mono">
                <span className="text-emerald-300">类别 2 (Mint Green)</span>
                <span className="text-emerald-400 font-bold">0.48 票 (18.0%)</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: currentStep >= 5 ? '18.0%' : currentStep >= 3 ? '25%' : '10%' }}
                />
              </div>
            </div>

            {/* 类 0 投票柱 */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-mono">
                <span className="text-sky-300">类别 0 (Azure Blue)</span>
                <span className="text-sky-400 font-bold">0.45 票 (16.8%)</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-sky-500 h-full rounded-full transition-all duration-500"
                  style={{ width: currentStep >= 5 ? '16.8%' : currentStep >= 3 ? '25%' : '10%' }}
                />
              </div>
            </div>

            {/* 决策输出提示框 */}
            <div
              className={`p-2 rounded-lg border text-[11px] transition-all ${
                currentStep === 6
                  ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-200'
                  : 'bg-slate-800/60 border-slate-700 text-slate-300'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>
                  {currentStep === 6
                    ? '最终决策: 预测为 类别 1 (Class 1) · 置信度 65.2%'
                    : `正在流转流水线步骤 0${currentStep}：${stepsMeta[currentStep - 1].title}`}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {currentStep === 6
                  ? '反距离权重将离查询点最近的 Class 1 赋予了绝对主导权，有效抵抗了背景孤立噪点的误导。'
                  : '每一步均严格保持无状态纯函数计算，体现了 KNN 作为惰性推断器的轻量级计算特征。'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const KnowledgeSlices: React.FC = () => {
  const [activeSlice, setActiveSlice] = useState<number>(1);
  const [slice1P, setSlice1P] = useState<number>(2.0);

  const slices = [
    {
      id: 1,
      title: '切片一：三大距离度量几何特性差异',
      subtitle: '欧氏 vs 曼哈顿 vs 切比雪夫度量公理与范数球拓扑',
      icon: Compass,
    },
    {
      id: 2,
      title: '切片二：适用条件与空间连续表示',
      subtitle: '无参数懒惰学习机制、Voronoi 镶嵌与时间复杂度',
      icon: Scale,
    },
    {
      id: 3,
      title: '切片三：三大致命训练与工程陷阱',
      subtitle: '特征量纲失真、偶数K平局死锁与大类样本吞噬',
      icon: AlertOctagon,
    },
    {
      id: 4,
      title: '切片四：维度灾难与索引加速陷阱',
      subtitle: '高维空间距离退化集中效应与 KD-Tree 退化',
      icon: BookOpen,
    },
    {
      id: 5,
      title: '切片五：KNN 算法核心原理与推断流水线 (含流程图)',
      subtitle: '算法三要素、形式化表决与 6 步推断闭环流程图',
      icon: Cpu,
    },
    {
      id: 6,
      title: '切片六：工业级典型应用场景与工程选型边界',
      subtitle: '图像模式检索、推荐系统协同过滤、金融风控与生物医疗',
      icon: Briefcase,
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            10. KNN 机理与空间几何度量深度知识切片
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            涵盖度量公理、懒惰学习非参数性、工程避坑指南、维度灾难理论、算法流程图与工业应用场景
          </p>
        </div>

        {/* Slice navigation buttons */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg overflow-x-auto">
          {slices.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSlice(s.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                activeSlice === s.id
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              切片 {s.id}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {/* Slice 1 */}
        {activeSlice === 1 && (
          <div className="space-y-6">
            <div className="border-l-4 border-sky-600 pl-4 py-1">
              <h3 className="text-sm font-bold text-slate-900">
                切片一：三大距离度量几何特性差异与范数球
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                闵可夫斯基距离公式 D(x, y) = (∑ |x_i - y_i|^p)^(1/p) 在不同参数 p 下呈现完全相异的几何对称性。
              </p>
            </div>

            {/* 动画 1: Lp 广义范数球连续形变呼吸微视窗 */}
            <NormBallMorpher onPChange={setSlice1P} />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div
                className={`p-4 rounded-xl border transition-all duration-300 space-y-2 ${
                  Math.abs(slice1P - 2.0) < 0.35
                    ? 'border-sky-400 bg-sky-50/80 ring-2 ring-sky-300 shadow-sm scale-[1.01]'
                    : 'border-slate-200 bg-slate-50/60 opacity-90'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-sky-700 block">
                    1. 欧几里得距离 (p = 2)
                  </span>
                  {Math.abs(slice1P - 2.0) < 0.35 && (
                    <span className="px-1.5 py-0.2 rounded text-[9px] bg-sky-600 text-white font-mono font-bold animate-pulse">
                      当前形态
                    </span>
                  )}
                </div>
                <div className="font-mono text-xs bg-white p-2 rounded border border-slate-200 text-slate-900">
                  D₂(x, y) = √(∑ (x_i - y_i)²)
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  <strong>几何直觉</strong>：两点间直线位移。在旋转变换下保距（各向同性，Isotropic）。单位范数球是标准超球体。
                </p>
                <p className="text-[11px] text-slate-500">
                  <strong>适用场景</strong>：物理坐标、图像几何坐标、各特征物理量纲天然统一且密集的连续空间。
                </p>
              </div>

              <div
                className={`p-4 rounded-xl border transition-all duration-300 space-y-2 ${
                  Math.abs(slice1P - 1.0) < 0.25
                    ? 'border-amber-400 bg-amber-50/80 ring-2 ring-amber-300 shadow-sm scale-[1.01]'
                    : 'border-slate-200 bg-slate-50/60 opacity-90'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-700 block">
                    2. 曼哈顿距离 (p = 1)
                  </span>
                  {Math.abs(slice1P - 1.0) < 0.25 && (
                    <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-600 text-white font-mono font-bold animate-pulse">
                      当前形态
                    </span>
                  )}
                </div>
                <div className="font-mono text-xs bg-white p-2 rounded border border-slate-200 text-slate-900">
                  D₁(x, y) = ∑ |x_i - y_i|
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  <strong>几何直觉</strong>：沿网格正交轴线累计。单位范数球是 45° 倾斜的菱形/正八面体。不具备旋转不变性。
                </p>
                <p className="text-[11px] text-slate-500">
                  <strong>适用场景</strong>：城市街区路线、文本词频、高维稀疏特征（如 TF-IDF），对个别轴向极端离群值抗干扰力显著优于 L₂。
                </p>
              </div>

              <div
                className={`p-4 rounded-xl border transition-all duration-300 space-y-2 ${
                  slice1P >= 7.5
                    ? 'border-indigo-400 bg-indigo-50/80 ring-2 ring-indigo-300 shadow-sm scale-[1.01]'
                    : 'border-slate-200 bg-slate-50/60 opacity-90'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-700 block">
                    3. 切比雪夫距离 (p → ∞)
                  </span>
                  {slice1P >= 7.5 && (
                    <span className="px-1.5 py-0.2 rounded text-[9px] bg-indigo-600 text-white font-mono font-bold animate-pulse">
                      当前形态
                    </span>
                  )}
                </div>
                <div className="font-mono text-xs bg-white p-2 rounded border border-slate-200 text-slate-900">
                  D_∞(x, y) = max_i |x_i - y_i|
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  <strong>几何直觉</strong>：取最大轴向偏差。单位范数球是正方形/超立方体。
                </p>
                <p className="text-[11px] text-slate-500">
                  <strong>适用场景</strong>：国际象棋国王移动步数、多轴机械臂并发运移的最大耗时瓶颈测量。
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Slice 2 */}
        {activeSlice === 2 && (
          <div className="space-y-6">
            <div className="border-l-4 border-emerald-600 pl-4 py-1">
              <h3 className="text-sm font-bold text-slate-900">
                切片二：适用条件、空间连续表示与懒惰学习
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                KNN 没有显式的损失函数梯度优化阶段，它的全部计算发生在推断预测时刻。
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
                <h4 className="text-xs font-bold text-slate-900">非参数 (Non-parametric) 的本质</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  “非参数”并不意味着模型没有参数，而是指<strong>模型的自由度/复杂度随训练数据规模 N 的增长而动态增长</strong>，而不需要预先假设数据符合某种先验分布（如线性回归的超平面或高斯朴素贝叶斯的正态分布）。
                </p>
                <p className="text-xs text-slate-600 leading-relaxed">
                  当 N → ∞ 且 K → ∞, K/N → 0 时，根据 Cover-Hart 定理，KNN 的渐进泛化误差不会超过贝叶斯最优误差的两倍（E_KNN ≤ 2 E_Bayes）！
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
                <h4 className="text-xs font-bold text-slate-900">空间 Voronoi 镶嵌与时空开销</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  在 $K=1$ 时，整个特征空间被自然分割为以各个训练点为发生元的<strong>泰森多边形 (Voronoi Diagram)</strong>，每个胞元内的所有点都归属于该发生元的类别。
                </p>
                <ul className="list-disc list-inside text-xs text-slate-600 space-y-1">
                  <li><strong>空间复杂度</strong>：$O(N \cdot d)$，必须完整保存全部训练集；</li>
                  <li><strong>暴力推断耗时</strong>：$O(N \cdot d)$，在测试集庞大时预测极其缓慢；</li>
                  <li><strong>适用条件</strong>：样本量适中 (N &lt; 10^5)、维度适中 (d &lt; 20)、局部几何流形边界清晰的任务。</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Slice 3 */}
        {activeSlice === 3 && (
          <div className="space-y-6">
            <div className="border-l-4 border-rose-600 pl-4 py-1">
              <h3 className="text-sm font-bold text-slate-900">
                切片三：三大致命工程与算法陷阱
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                在真实工程应用中，以下三个疏忽往往会导致 KNN 算法性能出现断崖式下跌。
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/40 space-y-2">
                <span className="text-xs font-bold text-rose-800 block">
                  陷阱 1：特征未归一化导致量纲主导
                </span>
                <p className="text-xs text-slate-700 leading-relaxed">
                  若特征 $X_1$ 为“年薪（数万至数十万）”，特征 $X_2$ 为“年龄（20~60岁）”，欧氏距离计算中 $(\Delta X_1)^2$ 的数值将是 $(\Delta X_2)^2$ 的百万倍！
                </p>
                <div className="p-2 bg-white rounded border border-rose-200 text-[11px] text-rose-900 font-medium">
                  <strong>解法</strong>：输入 KNN 前必须施加 <strong>Z-score 标准化 (z = (x - μ) / σ)</strong> 或 Min-Max 归一化。
                </div>
              </div>

              <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 space-y-2">
                <span className="text-xs font-bold text-amber-800 block">
                  陷阱 2：K 值选取偶数引发表决平局
                </span>
                <p className="text-xs text-slate-700 leading-relaxed">
                  在二分类问题中，若取 K=2, 4, 6 等偶数，非常容易出现 1:1 或 2:2 得票完全相同的平局死锁，算法将被迫随机猜选或退化。
                </p>
                <div className="p-2 bg-white rounded border border-amber-200 text-[11px] text-amber-900 font-medium">
                  <strong>解法</strong>：二分类务必取<strong>奇数 K</strong>；或开启反距离加权让距离打破平局。
                </div>
              </div>

              <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/40 space-y-2">
                <span className="text-xs font-bold text-indigo-800 block">
                  陷阱 3：样本极度失衡导致小类被吞噬
                </span>
                <p className="text-xs text-slate-700 leading-relaxed">
                  当大类与小类样本比例达到 10:1 时，如果 K 值稍微放大（如 K=15），大类样本因其全局高密度将必然占据邻域多数票，稀疏小类直接被全盘误判。
                </p>
                <div className="p-2 bg-white rounded border border-indigo-200 text-[11px] text-indigo-900 font-medium">
                  <strong>解法</strong>：采用<strong>反距离加权 (w_i = 1 / (d_i + ε))</strong> 或 SMOTE 过采样平衡类别。
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Slice 4 */}
        {activeSlice === 4 && (
          <div className="space-y-6">
            <div className="border-l-4 border-indigo-600 pl-4 py-1">
              <h3 className="text-sm font-bold text-slate-900">
                切片四：维度灾难 (Curse of Dimensionality) 与检索加速
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                高维空间中的空旷性与距离集中效应是近邻算法最深层的理论瓶颈。
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
                <h4 className="text-xs font-bold text-slate-900">距离集中效应 (Distance Concentration)</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  在高维独立同分布假设下，当维度 d → ∞ 时，数学上存在著名的 Beyer 极限定理：
                </p>
                <div className="bg-white p-2.5 rounded border border-slate-200 text-center font-mono text-xs text-slate-900">
                  lim_(d → ∞) (D_max - D_min) / D_min = 0
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  也就是说，<strong>任意样本点与数据集中“最近的点”和“最远的点”的相对距离几乎完全相等！</strong> 距离度量失去了辨识度，“近邻”的概念在高维空间中走向瓦解。
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
                <h4 className="text-xs font-bold text-slate-900">KD-Tree 的高维失效与现代工业替代方案</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  KD-Tree 依赖超球面与分割超平面的垂直距离进行剪枝。然而在高维空间中，超球体的外接超立方体占据了大部分体积，查询球几乎一定会与所有的分割轴相交，剪枝率趋近于 0，查询时间退化为 O(N)。
                </p>
                <p className="text-xs text-slate-700 leading-relaxed font-medium">
                  <strong>现代解法</strong>：
                  1. 先用 PCA / UMAP 将维度压缩至 d &lt; 50；
                  2. 改用 <strong>Ball-Tree</strong>（以超球体划分空间，抗各向异性能力强）；
                  3. 转向近似近邻检索 (ANN)，如 <strong>HNSW (分层可导航小世界图)</strong> 或 <strong>Faiss</strong>。
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Slice 5: 算法原理与完整推断流程图 */}
        {activeSlice === 5 && (
          <div className="space-y-6">
            <div className="border-l-4 border-sky-600 pl-4 py-1">
              <h3 className="text-sm font-bold text-slate-900">
                切片五：KNN 算法核心原理与推断流水线 (含推断闭环流程图)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                K-近邻算法三要素形式化定义、加权统计表决机理与 6 步推断闭环流程图。
              </p>
            </div>

            {/* 三要素原理卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
                <div className="flex items-center gap-1.5 text-sky-700 font-bold text-xs">
                  <Compass className="w-4 h-4" />
                  <span>要素一：距离度量函数</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  度量函数 D(x, y) 决定了特征空间的几何拓扑结构。不同的距离定义（如欧氏 L2 范数各向同性、曼哈顿 L1 范数网格投影、切比雪夫 L_inf 最大偏置）直接决定了哪些样本被判定为“相近”。
                </p>
                <div className="bg-white p-2 rounded border border-slate-200 font-mono text-[11px] text-slate-800">
                  D_p(x, y) = (∑ |x_i - y_i|^p)^(1/p)
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
                <div className="flex items-center gap-1.5 text-amber-700 font-bold text-xs">
                  <Scale className="w-4 h-4" />
                  <span>要素二：K 值的选择与权衡</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  K 是调节模型容量与偏置-方差平衡的关键滑块。K 较小时模型偏置小但方差大（易过拟合孤立噪点）；K 较大时方差小但偏置大（边界模糊）。通常采用留一交叉验证 (LOOCV) 或 K-Fold 寻找最优 K*。
                </p>
                <div className="bg-white p-2 rounded border border-slate-200 font-mono text-[11px] text-slate-800">
                  K ∈ [1, √N], 优先选奇数避开平局
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
                <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-xs">
                  <Zap className="w-4 h-4" />
                  <span>要素三：分类与回归决策规则</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  分类任务采用多数表决或反距离加权投票；回归任务采用近邻标量加权平均。反距离加权 (w_i = 1 / (d_i + ε)) 赋予高相近度样本绝对优先权，能有效防御类别不平衡干扰。
                </p>
                <div className="bg-white p-2 rounded border border-slate-200 font-mono text-[11px] text-slate-800">
                  y_hat = argmax_c ∑ w_i · I(y_i = c)
                </div>
              </div>
            </div>

            {/* 动画 2: 6步在线推断流水线脉冲推进与近邻雷达动效 */}
            <PipelinePulseFlowchart />
          </div>
        )}

        {/* Slice 6: 工业级应用场景与选型边界 */}
        {activeSlice === 6 && (
          <div className="space-y-6">
            <div className="border-l-4 border-sky-600 pl-4 py-1">
              <h3 className="text-sm font-bold text-slate-900">
                切片六：工业级典型应用场景与工程选型边界
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                从计算机视觉、推荐系统到金融风控与生物医疗，全方位解析 KNN 的工程落地与决策边界。
              </p>
            </div>

            {/* 四大典型工业应用场景 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 场景 1 */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-white hover:shadow-xs transition-all space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center">
                    <Search className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">1. 计算机视觉与图像模式检索 (CV & Image Retrieval)</h4>
                    <span className="text-[10px] text-slate-500">字符识别 (OCR) · 以图搜图 · 向量嵌入比对</span>
                  </div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  在 MNIST 手写数字识别与字体分类中，KNN 是经典的基准算法。现代工业界常将深度学习卷积网络（CNN）抽取的深层稠密嵌入向量（Embedding）经降维后，利用 KNN 进行最近邻匹配，实现电商同款搜图与人脸 1:N 身份检索验证。
                </p>
                <div className="bg-white p-2 rounded border border-slate-200 text-[10px] text-slate-700 font-mono">
                  典型架构: CNN/ResNet 特征抽取 (d=512) → PCA/UMAP (d=32) → KNN/Faiss 快速匹配
                </div>
              </div>

              {/* 场景 2 */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-white hover:shadow-xs transition-all space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">2. 智能推荐系统与协同过滤 (Collaborative Filtering)</h4>
                    <span className="text-[10px] text-slate-500">基于用户的推荐 (User-based) · 基于商品的推荐 (Item-based)</span>
                  </div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  协同过滤的核心就是度量相似度。在用户偏好向量空间中，KNN 负责实时检索出历史打分行为最相似的 K 个“邻居用户”，将其喜欢的高评分项目加权推荐给目标用户；在冷启动场景下，基于物品标签的近邻检索具备即时生效优势。
                </p>
                <div className="bg-white p-2 rounded border border-slate-200 text-[10px] text-slate-700 font-mono">
                  相似度度量: 余弦相似度 (Cosine) / 皮尔逊相关系数 (Pearson Correlation)
                </div>
              </div>

              {/* 场景 3 */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-white hover:shadow-xs transition-all space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-red-100 text-red-700 flex items-center justify-center">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">3. 金融风控与异常/欺诈检测 (Anomaly & Fraud Detection)</h4>
                    <span className="text-[10px] text-slate-500">信用卡盗刷 · 洗钱交易识别 · 网络入侵检测 (IDS)</span>
                  </div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  结合局部离群因子（Local Outlier Factor, LOF）算法：正常交易通常成簇聚集于高密度流形上，而恶意套现或黑客攻击交易往往孤立分布。通过计算查询点到其 K 近邻的平均距离与局部可达密度，能秒级精准捕获游离于主流群落之外的异常交易。
                </p>
                <div className="bg-white p-2 rounded border border-slate-200 text-[10px] text-slate-700 font-mono">
                  异常判据: LOF(p) = ∑ (lrd(o)/lrd(p)) / K，数值显著 &gt; 1 判定为异常
                </div>
              </div>

              {/* 场景 4 */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-white hover:shadow-xs transition-all space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Dna className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">4. 生物信息学与临床医疗辅助诊断 (Bioinformatics & Medical AI)</h4>
                    <span className="text-[10px] text-slate-500">基因表达谱分类 · 蛋白质构象比对 · 多维病理辅助筛查</span>
                  </div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  在肿瘤亚型分类中，通过微阵列（Microarray）基因表达谱将患者投射到特征子空间，KNN 能基于相似患者的历史病理记录与治疗反馈，辅助医生推断未确诊患者的病理类型与用药敏感性。
                </p>
                <div className="bg-white p-2 rounded border border-slate-200 text-[10px] text-slate-700 font-mono">
                  高可解释性优势: 能够直接追溯给出具体是哪 K 位历史相似患者的临床依据
                </div>
              </div>
            </div>

            {/* 工程选型决策矩阵 (Decision Matrix) */}
            <div className="border border-slate-200 rounded-xl p-5 bg-slate-50/50">
              <h4 className="text-xs font-bold text-slate-900 mb-3 flex items-center gap-1.5">
                <Briefcase className="w-4 h-4 text-sky-700" />
                <span>KNN 工业选型决策矩阵：何时采用？何时禁忌？</span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1.5">
                  <span className="font-bold text-emerald-900 flex items-center gap-1 text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>推荐采用 KNN 的黄金场景 (When to Use)</span>
                  </span>
                  <ul className="list-disc list-inside text-[11px] text-emerald-800 space-y-1 pl-1">
                    <li><strong>样本量适中</strong>：训练集样本容量 N &lt; 100,000，内存能全部驻留；</li>
                    <li><strong>低中维度</strong>：特征维度 d &lt; 30，未遭遇 Beyer 距离集中效应；</li>
                    <li><strong>流形边界复杂非线性</strong>：决策边界呈弯曲、多模态或多螺旋环绕，线性模型彻底失效；</li>
                    <li><strong>冷启动即时推断</strong>：需频繁追加新增样本，无需重新触发耗时的全局模型重训练；</li>
                    <li><strong>高可解释性要求</strong>：业务需要向用户明确展示做出该决策是参考了哪几个历史案例。</li>
                  </ul>
                </div>

                <div className="p-3.5 bg-rose-50/70 border border-rose-200 rounded-xl space-y-1.5">
                  <span className="font-bold text-rose-900 flex items-center gap-1 text-xs">
                    <AlertOctagon className="w-4 h-4 text-rose-600" />
                    <span>严正禁忌采用基础 KNN 的场景 (When NOT to Use)</span>
                  </span>
                  <ul className="list-disc list-inside text-[11px] text-rose-800 space-y-1 pl-1">
                    <li><strong>超大规模海量样本</strong>：N &gt; 1,000,000，单次暴力检索导致高毫秒级或秒级不可接受的延迟；</li>
                    <li><strong>超高维稀疏特征</strong>：如百万维文本 TF-IDF、未嵌入的高维稀疏独热码，KD-Tree 完全退化；</li>
                    <li><strong>严苛低延迟高吞吐</strong>：自动驾驶、高频量化交易等要求微秒级响应的场景；</li>
                    <li><strong>样本极度失衡</strong>：大类比小类达 100:1 且未做反距离加权或重采样处理；</li>
                    <li><strong>工业替代方案</strong>：转向树模型 (XGBoost/LightGBM) 或深度向量检索库 (Faiss/HNSW/Milvus)。</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
