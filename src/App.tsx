import React, { useState, useMemo } from 'react';
import { Header } from './components/Header';
import { WorkflowBar } from './components/WorkflowBar';
import { MetricAlgebra } from './components/MetricAlgebra';
import { BoundaryCanvas } from './components/BoundaryCanvas';
import { KSliderSlice } from './components/KSliderSlice';
import { KDTreeVisualizer } from './components/KDTreeVisualizer';
import { PresetCaseStudies } from './components/PresetCaseStudies';
import { CodeEngine } from './components/CodeEngine';
import { ExportEngine } from './components/ExportEngine';
import { KnowledgeSlices } from './components/KnowledgeSlices';
import { AIDiagnosisModal } from './components/AIDiagnosisModal';
import { Point2D, MetricType, WeightMode, DatasetPreset } from './types/knn';
import { getPresetDatasets, computeCVCurve } from './utils/knnMath';
import { Sparkles, Layers, Sliders, LineChart, BookOpen, Database } from 'lucide-react';

export default function App() {
  const presets = useMemo(() => getPresetDatasets(), []);

  // Main experiment state
  const [points, setPoints] = useState<Point2D[]>(() => presets[0].points);
  const [currentPresetId, setCurrentPresetId] = useState<string>('clusters');
  const [datasetName, setDatasetName] = useState<string>(presets[0].name);

  // Hyperparameters
  const [k, setK] = useState<number>(5);
  const [metric, setMetric] = useState<MetricType>('euclidean');
  const [p, setP] = useState<number>(2);
  const [weightMode, setWeightMode] = useState<WeightMode>('uniform');

  // Navigation & Workflow state
  const [activeTab, setActiveTab] = useState<string>('workspace');
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isAIDiagnoseOpen, setIsAIDiagnoseOpen] = useState<boolean>(false);

  // Cross-Validation curve calculation
  const { curve: cvCurve, bestK, bestAccuracy } = useMemo(() => {
    return computeCVCurve(points, metric, p, weightMode, 25);
  }, [points, metric, p, weightMode]);

  // Load a preset dataset
  const handleLoadPreset = (preset: DatasetPreset) => {
    setPoints(preset.points);
    setCurrentPresetId(preset.id);
    setDatasetName(preset.name);
    setK(preset.recommendedK);
    setMetric(preset.recommendedMetric);
    setP(preset.recommendedP);
  };

  // Reset to default
  const handleReset = () => {
    handleLoadPreset(presets[0]);
    setCurrentStep(1);
  };

  // Change metric
  const handleSelectMetric = (newMetric: MetricType, newP?: number) => {
    setMetric(newMetric);
    if (newP !== undefined) {
      setP(newP);
    } else if (newMetric === 'euclidean') {
      setP(2);
    } else if (newMetric === 'manhattan') {
      setP(1);
    } else if (newMetric === 'chebyshev') {
      setP(999);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      {/* Module Navigation & Brand Top Bar */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onReset={handleReset}
        onOpenAIDiagnose={() => setIsAIDiagnoseOpen(true)}
        pointCount={points.length}
      />

      {/* Module 8: 全流程管道导引 */}
      <WorkflowBar
        currentStep={currentStep}
        setCurrentStep={setCurrentStep}
        onNavigateTab={tabId => setActiveTab(tabId)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Workspace Tab: Core interactive laboratory */}
        {activeTab === 'workspace' && (
          <div className="space-y-6">
            {/* Module 2: Decision Boundary Real-time Canvas */}
            <BoundaryCanvas
              points={points}
              setPoints={setPoints}
              k={k}
              metric={metric}
              p={p}
              weightMode={weightMode}
            />

            {/* Quick Navigation Cards below workspace */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
              <button
                onClick={() => setActiveTab('metric')}
                className="p-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50/80 transition-all text-left flex items-start justify-between group shadow-xs"
              >
                <div>
                  <span className="text-xs font-bold text-amber-700 block mb-1">
                    01. 代数与度量
                  </span>
                  <span className="text-sm font-semibold text-slate-900 block">
                    单位范数球演播
                  </span>
                  <p className="text-xs text-slate-500 mt-1">
                    实时调节 p 值观察 L₁、L₂、L∞ 几何形态从菱形至圆形与方块的演化
                  </p>
                </div>
                <div className="p-2 bg-amber-50 rounded-lg text-amber-600 group-hover:bg-amber-100 transition-colors">
                  <Layers className="w-4 h-4" />
                </div>
              </button>

              <button
                onClick={() => setActiveTab('kcurve')}
                className="p-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50/80 transition-all text-left flex items-start justify-between group shadow-xs"
              >
                <div>
                  <span className="text-xs font-bold text-sky-700 block mb-1">
                    02. K值与验证曲线
                  </span>
                  <span className="text-sm font-semibold text-slate-900 block">
                    LOOCV 与最优 K*
                  </span>
                  <p className="text-xs text-slate-500 mt-1">
                    实时全自动留一验证误差折线，智能捕获最优拐点平衡方差与偏差
                  </p>
                </div>
                <div className="p-2 bg-sky-50 rounded-lg text-sky-600 group-hover:bg-sky-100 transition-colors">
                  <Sliders className="w-4 h-4" />
                </div>
              </button>

              <button
                onClick={() => setActiveTab('kdtree')}
                className="p-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50/80 transition-all text-left flex items-start justify-between group shadow-xs"
              >
                <div>
                  <span className="text-xs font-bold text-emerald-700 block mb-1">
                    04. KD-Tree 演播
                  </span>
                  <span className="text-sm font-semibold text-slate-900 block">
                    空间分割与单步回溯
                  </span>
                  <p className="text-xs text-slate-500 mt-1">
                    演播查询点在空间轴交替分割下的下沉与剪枝 (Pruning) 物理过程
                  </p>
                </div>
                <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600 group-hover:bg-emerald-100 transition-colors">
                  <LineChart className="w-4 h-4" />
                </div>
              </button>

              <button
                onClick={() => setActiveTab('cases')}
                className="p-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50/80 transition-all text-left flex items-start justify-between group shadow-xs"
              >
                <div>
                  <span className="text-xs font-bold text-indigo-700 block mb-1">
                    05. 四大案例库
                  </span>
                  <span className="text-sm font-semibold text-slate-900 block">
                    双螺旋与 MNIST 投影
                  </span>
                  <p className="text-xs text-slate-500 mt-1">
                    一键载入非线性拓扑流形、真实数字投影与密度离群点异常检测
                  </p>
                </div>
                <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600 group-hover:bg-indigo-100 transition-colors">
                  <Database className="w-4 h-4" />
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Module 2: K-Value Dynamics & LOOCV Curve Dedicated View */}
        {activeTab === 'kcurve' && (
          <div className="space-y-6">
            <KSliderSlice
              k={k}
              setK={setK}
              weightMode={weightMode}
              setWeightMode={setWeightMode}
              points={points}
              metric={metric}
              p={p}
              onNavigateToCanvas={() => setActiveTab('workspace')}
            />
          </div>
        )}

        {/* Module 1: Metric Algebra & Norm Ball */}
        {activeTab === 'metric' && (
          <div className="space-y-6">
            <MetricAlgebra
              currentMetric={metric}
              currentP={p}
              onSelectMetric={handleSelectMetric}
              onApplyToCanvas={() => setActiveTab('workspace')}
            />
          </div>
        )}

        {/* Module 4: KD-Tree Structure & Backtracking */}
        {activeTab === 'kdtree' && (
          <div className="space-y-6">
            <KDTreeVisualizer points={points} />
          </div>
        )}

        {/* Module 5: Four Benchmark Case Studies */}
        {activeTab === 'cases' && (
          <div className="space-y-6">
            <PresetCaseStudies
              onLoadPreset={handleLoadPreset}
              currentPresetId={currentPresetId}
              onNavigateToCanvas={() => setActiveTab('workspace')}
            />
          </div>
        )}

        {/* Module 6: Python Code Engine */}
        {activeTab === 'code' && (
          <div className="space-y-6">
            <CodeEngine k={k} metric={metric} p={p} weightMode={weightMode} points={points} />
          </div>
        )}

        {/* Module 10: Knowledge Slices */}
        {activeTab === 'knowledge' && (
          <div className="space-y-6">
            <KnowledgeSlices />
          </div>
        )}

        {/* Module 9: Export Engine & Report */}
        {activeTab === 'export' && (
          <div className="space-y-6">
            <ExportEngine
              points={points}
              k={k}
              metric={metric}
              p={p}
              weightMode={weightMode}
              cvAccuracy={cvCurve.find(c => c.k === k)?.accuracy || bestAccuracy}
              bestK={bestK}
              cvCurve={cvCurve}
              datasetName={datasetName}
            />
          </div>
        )}
      </main>

      {/* Module 7: AI Diagnosis & Q&A Modal */}
      <AIDiagnosisModal
        isOpen={isAIDiagnoseOpen}
        onClose={() => setIsAIDiagnoseOpen(false)}
        points={points}
        k={k}
        metric={metric}
        p={p}
        weightMode={weightMode}
        cvAccuracy={cvCurve.find(c => c.k === k)?.accuracy || bestAccuracy}
        bestK={bestK}
        datasetName={datasetName}
      />

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-12 py-6 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <div>
            <span className="font-semibold text-slate-800">K-近邻算法 (KNN) 交互实验室</span>
            <span className="mx-2">·</span>
            <span>非参数统计学习与度量空间仿真教学系统</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveTab('knowledge')}
              className="hover:text-slate-900 transition-colors"
            >
              理论切片导引
            </button>
            <span>·</span>
            <button
              onClick={() => setActiveTab('code')}
              className="hover:text-slate-900 transition-colors"
            >
              Python 源码引擎
            </button>
            <span>·</span>
            <button
              onClick={() => setIsAIDiagnoseOpen(true)}
              className="hover:text-sky-700 font-medium transition-colors"
            >
              AI 专家随诊
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
