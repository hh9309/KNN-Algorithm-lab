import React, { useState, useEffect, useRef } from 'react';
import { Point2D, MetricType, WeightMode, ChatMessage } from '../types/knn';
import {
  LLMConfig,
  LLMModel,
  getStoredLLMConfig,
  saveStoredLLMConfig,
  callBrowserLLM,
} from '../utils/llmClient';
import {
  Sparkles,
  MessageSquare,
  X,
  Send,
  RotateCcw,
  Loader2,
  Bot,
  User,
  Settings,
  Key,
  Check,
  Eye,
  EyeOff,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';

interface AIDiagnosisModalProps {
  isOpen: boolean;
  onClose: () => void;
  points: Point2D[];
  k: number;
  metric: MetricType;
  p: number;
  weightMode: WeightMode;
  cvAccuracy: number;
  bestK: number;
  datasetName?: string;
}

export const AIDiagnosisModal: React.FC<AIDiagnosisModalProps> = ({
  isOpen,
  onClose,
  points,
  k,
  metric,
  p,
  weightMode,
  cvAccuracy,
  bestK,
  datasetName,
}) => {
  // LLM Config state (persisted in localStorage for GitHub Pages deployment)
  const [llmConfig, setLlmConfig] = useState<LLMConfig>(() => getStoredLLMConfig());
  const [draftKey, setDraftKey] = useState<string>(llmConfig.apiKey);
  const [draftModel, setDraftModel] = useState<LLMModel>(llmConfig.model);
  const [draftBaseUrl, setDraftBaseUrl] = useState<string>(llmConfig.customBaseUrl || '');
  const [showKey, setShowKey] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(!llmConfig.apiKey);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  // Tab & Diagnostic states
  const [activeTab, setActiveTab] = useState<'diagnosis' | 'chat'>('diagnosis');
  const [diagnosisText, setDiagnosisText] = useState<string>('');
  const [loadingDiagnosis, setLoadingDiagnosis] = useState<boolean>(false);
  const [diagnosisError, setDiagnosisError] = useState<string | null>(null);

  // Chat states
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      text: '您好！我是您的 KNN 算法随诊 AI 导师。当前支持由您自主配置并授权大模型服务（gemini 3 flash 或 deepseek-v4-pro）。请输入 API-Key 后开启随诊与问答。',
      timestamp: '刚刚',
    },
  ]);
  const [chatInput, setChatInput] = useState<string>('');
  const [loadingChat, setLoadingChat] = useState<boolean>(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Suggested prompts
  const samplePrompts = [
    '为什么特征未做 Z-score 标准化会导致距离失真？',
    '高维空间下“维度灾难”对 KNN 距离集中效应的数学解释是什么？',
    'KD-Tree 在多少特征维度以上会退化为暴力搜索？',
    '样本类别不平衡时，反距离加权如何避免小类被吞噬？',
  ];

  // Save Settings
  const handleSaveSettings = () => {
    const updated: LLMConfig = {
      model: draftModel,
      apiKey: draftKey.trim(),
      customBaseUrl: draftBaseUrl.trim(),
    };
    setLlmConfig(updated);
    saveStoredLLMConfig(updated);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      if (updated.apiKey) {
        setShowSettings(false);
      }
    }, 1200);
  };

  // Build Diagnostic Prompts
  const buildDiagnosticPrompts = () => {
    const classCounts = points.reduce((acc, pt) => {
      acc[pt.label] = (acc[pt.label] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    const systemPrompt = `你是一位严谨的资深统计学习与机器学习专家导师。
用户正在K-近邻算法(KNN)实验室中操作实验。
请依据用户当前参数、特征分布和验证结果，给出精准、学术且具有可操作性的诊断报告。
诊断应重点覆盖：
1. 【特征量纲与距离失真 (Distance Distortion)】：判断特征取值范围或坐标轴拉伸对距离度量（如欧氏、曼哈顿）的影响，指明是否需要 Z-score 或 Min-Max 标准化。
2. 【K值偏置-方差权衡 (Bias-Variance Dilemma)】：分析当前 K=${k} 是否存在局部过拟合（小K锯齿边界）或欠拟合（大K平原平滑），结合最佳K值参考。
3. 【距离度量几何适用性】：评价所选距离（${metric}${metric === 'minkowski' ? `, p=${p.toFixed(2)}` : ''}）与当前数据集拓扑形状的拟合优劣。
4. 【样本平衡与多数表决陷阱】：分析类别分布是否失衡，表决是否易被多数类吞噬，权值策略（${weightMode === 'inverse' ? '反距离加权' : '等权投票'}）的影响。
5. 【高维演化与维度灾难 (Curse of Dimensionality) 警示】及工程调优建议。

输出请使用结构清晰的中文Markdown，包含简练的要点标题、数学直觉解释与可直接执行的优化建议。`;

    const userPrompt = `当前KNN实验状态：
- 场景数据集：${datasetName || '自定义样本集'}
- 样本总数：${points.length}，类别分布：${JSON.stringify(classCounts)}
- 核心超参数：K = ${k}（经验推荐参考最佳K ≈ ${bestK || '待定'}）
- 距离度量：${metric} (Minkowski p = ${p.toFixed(2)})
- 权重策略：${weightMode === 'inverse' ? '反距离加权 1/(d+ε)' : '等权多数表决 (Uniform)'}
- 交叉验证准确率：${(cvAccuracy * 100).toFixed(1)}%
- 特征跨度估测：{ X1: '[0, 100]', X2: '[0, 100]' }

请给出深入的诊断建议与理论反思。`;

    return { systemPrompt, userPrompt };
  };

  // Trigger diagnosis
  const runDiagnosis = async () => {
    if (!llmConfig.apiKey.trim()) {
      setShowSettings(true);
      setDiagnosisError('所有大模型调用必须输入 API-Key 后才能调用！请先在上方设置大模型并输入 API-Key 确认保存。');
      return;
    }

    setLoadingDiagnosis(true);
    setDiagnosisError(null);

    try {
      const { systemPrompt, userPrompt } = buildDiagnosticPrompts();
      const result = await callBrowserLLM({
        config: llmConfig,
        systemPrompt,
        userPrompt,
      });
      setDiagnosisText(result);
    } catch (err: any) {
      setDiagnosisError(err.message || '诊断调用异常');
    } finally {
      setLoadingDiagnosis(false);
    }
  };

  // Run initial diagnosis when opened if key exists
  useEffect(() => {
    if (isOpen && !diagnosisText && !loadingDiagnosis && llmConfig.apiKey) {
      runDiagnosis();
    }
  }, [isOpen, llmConfig.apiKey]);

  // Scroll chat to bottom
  useEffect(() => {
    if (activeTab === 'chat') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

  // Handle chat submit
  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || chatInput.trim();
    if (!text || loadingChat) return;

    if (!llmConfig.apiKey.trim()) {
      setShowSettings(true);
      setMessages(prev => [
        ...prev,
        {
          id: `warn-${Date.now()}`,
          role: 'model',
          text: '⚠️ 所有大模型调用必须输入 API-Key 后才能调用！请点击标题最右侧小齿轮 ⚙️ 设置面板输入您的 API-Key 并确认大模型配置后，再向 AI 随诊专家提问。',
          timestamp: '系统提示',
        },
      ]);
      return;
    }

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setLoadingChat(true);

    try {
      const systemPrompt = `你是一位专注于度量学习、空间数据结构与非参数统计的机器学习教学专家。
请以严谨透彻、通俗易懂的中文回答关于 K-近邻算法 (KNN)、闵可夫斯基距离 ($L_1, L_2, L_\\infty$)、KD-Tree 空间分割与回溯、维度灾难、交叉验证选择K值等学术与工程问题。
请配合公式与几何直觉深入浅出地解释。`;

      const history = messages
        .filter(m => m.id !== 'welcome' && !m.id.startsWith('warn-'))
        .map(m => ({ role: m.role, text: m.text }));

      const reply = await callBrowserLLM({
        config: llmConfig,
        systemPrompt,
        userPrompt: text,
        history,
      });

      setMessages(prev => [
        ...prev,
        {
          id: `m-${Date.now()}`,
          role: 'model',
          text: reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: `m-${Date.now()}`,
          role: 'model',
          text: `调用失败: ${err.message}`,
          timestamp: '调用错误',
        },
      ]);
    } finally {
      setLoadingChat(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Top Bar */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900">
                  AI 随诊专家与学术 Q&A 对话窗口
                </h2>
                {/* Gear settings button on the rightmost of the title */}
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  title="设置大模型 (gemini 3 flash / deepseek-v4-pro) 与 API-Key"
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-semibold transition-all ${
                    showSettings
                      ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                      : !llmConfig.apiKey
                      ? 'bg-amber-100 text-amber-900 border-amber-300 animate-pulse'
                      : 'bg-white text-slate-700 border-slate-200 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Settings className="w-3.5 h-3.5 text-current" />
                  <span>设置大模型</span>
                </button>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                <span>当前模型:</span>
                <span className="font-mono font-semibold text-slate-700 bg-slate-200/70 px-1.5 py-0.2 rounded">
                  {llmConfig.model === 'gemini-3-flash' ? 'gemini 3 flash' : 'deepseek-v4-pro'}
                </span>
                <span>·</span>
                {llmConfig.apiKey ? (
                  <span className="text-emerald-700 font-medium flex items-center gap-0.5">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" /> 已配置密钥
                  </span>
                ) : (
                  <span className="text-amber-700 font-medium flex items-center gap-0.5">
                    <AlertTriangle className="w-3 h-3 text-amber-600" /> 需输入API-Key
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tab switch */}
            <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-lg">
              <button
                onClick={() => setActiveTab('diagnosis')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  activeTab === 'diagnosis'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                实验随诊报告
              </button>
              <button
                onClick={() => setActiveTab('chat')}
                className={`flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  activeTab === 'chat'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <MessageSquare className="w-3 h-3" />
                <span>Q&A 专家问答</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Big Settings Panel (Controlled by Gear Icon) */}
        {showSettings && (
          <div className="bg-sky-50/80 border-b border-sky-200/80 p-4 transition-all">
            <div className="max-w-2xl mx-auto space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Settings className="w-3.5 h-3.5 text-sky-700" />
                  <span>大模型服务与 API-Key 授权配置</span>
                </span>
                <span className="text-[10px] text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                  支持部署到 GitHub 浏览器纯前端调用 · 必须输入 API-Key 后方可调用
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* 1. 手工输入 API-Key */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    1. 手工输入 API-Key：
                  </label>
                  <div className="relative">
                    <input
                      type={showKey ? 'text' : 'password'}
                      value={draftKey}
                      onChange={e => setDraftKey(e.target.value)}
                      placeholder={
                        draftModel === 'gemini-3-flash'
                          ? '输入 Gemini API-Key (如 AIzaSy...)'
                          : '输入 DeepSeek API-Key (如 sk-...)'
                      }
                      className="w-full bg-white border border-slate-300 rounded-lg pl-8 pr-8 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                    <Key className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                    >
                      {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    密钥仅保存在您本地浏览器中，保障密钥安全
                  </span>
                </div>

                {/* 2. 选择两个大模型 */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    2. 选择大模型 (支持两个大模型)：
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setDraftModel('gemini-3-flash')}
                      className={`p-2 rounded-lg border text-left transition-all ${
                        draftModel === 'gemini-3-flash'
                          ? 'border-sky-500 bg-white ring-1 ring-sky-500 text-sky-900 shadow-xs'
                          : 'border-slate-200 bg-slate-50/80 hover:bg-white text-slate-600'
                      }`}
                    >
                      <span className="text-xs font-bold block">gemini 3 flash</span>
                      <span className="text-[10px] text-slate-500">Google Gemini API</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDraftModel('deepseek-v4-pro')}
                      className={`p-2 rounded-lg border text-left transition-all ${
                        draftModel === 'deepseek-v4-pro'
                          ? 'border-sky-500 bg-white ring-1 ring-sky-500 text-sky-900 shadow-xs'
                          : 'border-slate-200 bg-slate-50/80 hover:bg-white text-slate-600'
                      }`}
                    >
                      <span className="text-xs font-bold block">deepseek-v4-pro</span>
                      <span className="text-[10px] text-slate-500">DeepSeek API</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Optional custom base URL for DeepSeek reverse proxy */}
              {draftModel === 'deepseek-v4-pro' && (
                <div>
                  <label className="text-[11px] font-medium text-slate-600 block mb-0.5">
                    DeepSeek API 端点 (可选，默认 https://api.deepseek.com/chat/completions)：
                  </label>
                  <input
                    type="text"
                    value={draftBaseUrl}
                    onChange={e => setDraftBaseUrl(e.target.value)}
                    placeholder="https://api.deepseek.com/chat/completions"
                    className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-1 text-xs font-mono"
                  />
                </div>
              )}

              {/* 3. 确认大模型 */}
              <div className="flex items-center justify-between pt-1 border-t border-sky-200/50">
                <span className="text-[10px] text-slate-500">
                  {draftKey ? '已输入密钥，点击确认即可生效' : '⚠️ 所有大模型调用必须输入 API-Key 后方可调用'}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSettings(false)}
                    className="px-2.5 py-1 text-xs text-slate-600 hover:text-slate-900"
                  >
                    取消
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveSettings}
                    disabled={!draftKey.trim()}
                    className="flex items-center gap-1 px-4 py-1.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
                  >
                    {savedSuccess ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-white" />
                        <span>已确认保存</span>
                      </>
                    ) : (
                      <span>3. 确认大模型</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Unconfigured Key Warning Banner */}
          {!llmConfig.apiKey && (
            <div className="mb-4 p-3.5 rounded-xl border border-amber-200 bg-amber-50/80 text-xs text-amber-900 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">
                <span className="font-bold block">未配置大模型 API-Key（调用已锁定）</span>
                <span className="text-[11px] text-amber-800">
                  根据部署规范，本项目在浏览器端独立运行。所有大模型（gemini 3 flash / deepseek-v4-pro）调用必须在输入 API-Key 后方可触发。
                </span>
                <div className="mt-2">
                  <button
                    onClick={() => setShowSettings(true)}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-[11px] font-semibold shadow-xs"
                  >
                    <Key className="w-3 h-3" />
                    <span>立即设置 API-Key 与模型</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'diagnosis' ? (
            <div className="space-y-4">
              {/* Snapshot header */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-2">
                <div className="flex items-center gap-3">
                  <span>
                    模型：
                    <strong className="text-sky-700 font-mono">
                      {llmConfig.model === 'gemini-3-flash' ? 'gemini 3 flash' : 'deepseek-v4-pro'}
                    </strong>
                  </span>
                  <span>·</span>
                  <span>
                    当前 K 值：<strong className="text-slate-800 font-mono">K = {k}</strong>
                  </span>
                  <span>·</span>
                  <span>
                    度量：
                    <strong className="text-slate-800 uppercase font-mono">{metric}</strong>
                  </span>
                  <span>·</span>
                  <span>
                    CV 准确率：
                    <strong className="text-emerald-700 font-mono">
                      {(cvAccuracy * 100).toFixed(1)}%
                    </strong>
                  </span>
                </div>

                <button
                  onClick={runDiagnosis}
                  disabled={loadingDiagnosis}
                  className="flex items-center gap-1 px-3 py-1 bg-white border border-slate-200 rounded-md text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 transition-colors shadow-xs"
                >
                  {loadingDiagnosis ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-600" />
                  ) : (
                    <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                  )}
                  <span>{diagnosisText ? '重新诊断' : '开始 AI 随诊诊断'}</span>
                </button>
              </div>

              {/* Diagnosis Error */}
              {diagnosisError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center justify-between">
                  <span>⚠️ {diagnosisError}</span>
                  {!llmConfig.apiKey && (
                    <button
                      onClick={() => setShowSettings(true)}
                      className="text-xs font-bold text-rose-900 underline ml-2"
                    >
                      去设置密钥
                    </button>
                  )}
                </div>
              )}

              {/* Diagnosis Report Output */}
              {loadingDiagnosis ? (
                <div className="py-16 flex flex-col items-center justify-center text-slate-400 space-y-3">
                  <Loader2 className="w-7 h-7 animate-spin text-sky-600" />
                  <span className="text-xs">
                    正在由 {llmConfig.model === 'gemini-3-flash' ? 'Gemini 3 Flash' : 'DeepSeek V4 Pro'} 分析样本空间流形、检验距离尺度与超参数偏置...
                  </span>
                </div>
              ) : diagnosisText ? (
                <div className="prose prose-sm max-w-none text-slate-800 text-xs leading-relaxed space-y-3">
                  <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs whitespace-pre-line font-sans text-xs">
                    {diagnosisText}
                  </div>
                </div>
              ) : (
                <div className="py-16 flex flex-col items-center justify-center text-center p-6 space-y-3 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                  <div className="w-9 h-9 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">尚未生成随诊诊断</h4>
                    <p className="text-[11px] text-slate-500 mt-1 max-w-sm leading-relaxed">
                      {llmConfig.apiKey
                        ? '点击上方“开始 AI 随诊诊断”按钮，大模型将根据当前数据集拓扑、K值与距离度量生成专业诊断。'
                        : '请先点击右上角小齿轮 ⚙️ 设置您的 API-Key，方可启动大模型诊断。'}
                    </p>
                  </div>
                  <button
                    onClick={runDiagnosis}
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>立即开始 AI 随诊诊断</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Q&A Chat Tab */
            <div className="flex flex-col h-[500px]">
              {/* Message List */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                {messages.map(m => {
                  const isUser = m.role === 'user';
                  return (
                    <div
                      key={m.id}
                      className={`flex gap-3 text-xs ${isUser ? 'justify-end' : 'justify-start'}`}
                    >
                      {!isUser && (
                        <div className="w-7 h-7 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center shrink-0 mt-0.5">
                          <Bot className="w-4 h-4" />
                        </div>
                      )}
                      <div
                        className={`max-w-[85%] rounded-xl px-4 py-2.5 shadow-xs leading-relaxed ${
                          isUser
                            ? 'bg-slate-900 text-white rounded-tr-xs'
                            : 'bg-slate-50 border border-slate-200 text-slate-800 rounded-tl-xs whitespace-pre-line'
                        }`}
                      >
                        {m.text}
                        <div
                          className={`text-[9px] mt-1 text-right ${
                            isUser ? 'text-slate-400' : 'text-slate-400'
                          }`}
                        >
                          {m.timestamp}
                        </div>
                      </div>
                      {isUser && (
                        <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                          <User className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  );
                })}
                {loadingChat && (
                  <div className="flex gap-3 text-xs items-center text-slate-400 pl-2">
                    <Bot className="w-4 h-4 animate-pulse text-sky-600" />
                    <span>
                      {llmConfig.model === 'gemini-3-flash' ? 'Gemini 3 Flash' : 'DeepSeek V4 Pro'} 导师正在思考并推导几何公式...
                    </span>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Sample Prompts chips */}
              <div className="py-2 flex items-center gap-1.5 overflow-x-auto text-[11px] scrollbar-none border-t border-slate-100 mt-2">
                <span className="text-slate-400 shrink-0">快捷提问：</span>
                {samplePrompts.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(p)}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full whitespace-nowrap transition-colors"
                  >
                    {p}
                  </button>
                ))}
              </div>

              {/* Input row */}
              <form
                onSubmit={e => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="pt-2 flex items-center gap-2"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  placeholder={
                    llmConfig.apiKey
                      ? `向 ${llmConfig.model === 'gemini-3-flash' ? 'gemini 3 flash' : 'deepseek-v4-pro'} 导师提问...`
                      : '请先点击右上角小齿轮 ⚙️ 输入 API-Key...'
                  }
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 focus:bg-white"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || loadingChat}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-xs transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>发送</span>
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
