import React, { useState, useMemo } from 'react';
import { Point2D, MetricType, WeightMode, CVCurvePoint, DatasetPreset } from '../types/knn';
import { getPresetDatasets, computeCVCurve, predictKNN } from '../utils/knnMath';
import {
  FileText,
  Download,
  Printer,
  Check,
  Table as TableIcon,
  FileSpreadsheet,
  Database,
  Eye,
  Code,
  Layers,
  Sparkles,
  ShieldAlert,
  ChevronRight,
} from 'lucide-react';

interface ExportEngineProps {
  points: Point2D[];
  k: number;
  metric: MetricType;
  p: number;
  weightMode: WeightMode;
  cvAccuracy: number;
  bestK: number;
  cvCurve: CVCurvePoint[];
  datasetName?: string;
}

export const ExportEngine: React.FC<ExportEngineProps> = ({
  points,
  k,
  metric,
  p,
  weightMode,
  cvAccuracy,
  bestK,
  cvCurve,
  datasetName,
}) => {
  const presets = useMemo(() => getPresetDatasets(), []);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  // Selected report subject: 'current' or one of the 4 presets
  const [selectedCaseId, setSelectedCaseId] = useState<string>('current');
  const [previewTab, setPreviewTab] = useState<'formatted' | 'raw'>('formatted');

  // Helper trigger download
  const triggerDownload = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    setDownloadSuccess(filename);
    setTimeout(() => setDownloadSuccess(null), 2500);
  };

  // Convert points array to CSV
  const convertPointsToCSV = (pts: Point2D[], title: string) => {
    let csv = `id,x,y,class_label,class_name,dataset\n`;
    pts.forEach(pt => {
      const className = pt.label === 0 ? 'Class_0' : pt.label === 1 ? 'Class_1' : 'Class_2';
      csv += `${pt.id},${pt.x.toFixed(3)},${pt.y.toFixed(3)},${pt.label},${className},${title}\n`;
    });
    return csv;
  };

  // Download raw dataset for a specific preset
  const handleDownloadPresetCSV = (preset: DatasetPreset) => {
    const csv = convertPointsToCSV(preset.points, preset.name);
    triggerDownload(csv, `${preset.id}_raw_dataset.csv`, 'text/csv;charset=utf-8');
  };

  // Download current points CSV
  const handleDownloadCurrentPoints = () => {
    const csv = convertPointsToCSV(points, datasetName || 'Custom_Canvas');
    triggerDownload(csv, `knn_current_canvas_dataset_${Date.now()}.csv`, 'text/csv;charset=utf-8');
  };

  // Download CV Curve CSV
  const handleDownloadCVCurve = () => {
    let csv = 'k,accuracy,error_rate\n';
    cvCurve.forEach(pt => {
      csv += `${pt.k},${pt.accuracy.toFixed(4)},${pt.errorRate.toFixed(4)}\n`;
    });
    triggerDownload(csv, `knn_loocv_curve_${Date.now()}.csv`, 'text/csv;charset=utf-8');
  };

  // Determine active dataset for report generation
  const activeReportData = useMemo(() => {
    if (selectedCaseId === 'current') {
      return {
        name: datasetName || '当前画布自定义点集',
        description: '由用户在 2D 特征空间自由绘制或操作的实时样本集合。',
        category: '用户交互实验',
        points: points,
        k: k,
        metric: metric,
        p: p,
        weightMode: weightMode,
        cvAccuracy: cvAccuracy,
        bestK: bestK,
        cvCurve: cvCurve,
      };
    }

    const preset = presets.find(p => p.id === selectedCaseId) || presets[0];
    const { curve: pCurve, bestK: pBestK, bestAccuracy: pBestAcc } = computeCVCurve(
      preset.points,
      preset.recommendedMetric,
      preset.recommendedP,
      'uniform',
      25
    );

    return {
      name: preset.name,
      description: preset.description,
      category: preset.category,
      points: preset.points,
      k: preset.recommendedK,
      metric: preset.recommendedMetric,
      p: preset.recommendedP,
      weightMode: 'uniform' as WeightMode,
      cvAccuracy: pBestAcc,
      bestK: pBestK,
      cvCurve: pCurve,
    };
  }, [selectedCaseId, points, k, metric, p, weightMode, cvAccuracy, bestK, cvCurve, presets, datasetName]);

  // Compute stats & confusion matrix for active report
  const reportStats = useMemo(() => {
    const pts = activeReportData.points;
    const n = pts.length;
    const counts = pts.reduce((acc, p) => {
      acc[p.label] = (acc[p.label] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    // Confusion matrix on leave-one-out
    const confMat = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];

    let correct = 0;
    pts.forEach(pt => {
      const pred = predictKNN(
        pt,
        pts,
        activeReportData.k,
        activeReportData.metric,
        activeReportData.p,
        activeReportData.weightMode,
        pt.id
      );
      confMat[pt.label][pred.predictedLabel]++;
      if (pt.label === pred.predictedLabel) correct++;
    });

    const loocvAcc = n > 0 ? correct / n : 1.0;

    const classMetrics = ([0, 1, 2] as const).map(lbl => {
      const tp = confMat[lbl][lbl];
      const fp = confMat[0][lbl] + confMat[1][lbl] + confMat[2][lbl] - tp;
      const fn = confMat[lbl][0] + confMat[lbl][1] + confMat[lbl][2] - tp;
      const support = counts[lbl] || 0;
      const prec = tp + fp > 0 ? tp / (tp + fp) : 0;
      const rec = tp + fn > 0 ? tp / (tp + fn) : 0;
      const f1 = prec + rec > 0 ? (2 * prec * rec) / (prec + rec) : 0;
      return { label: lbl, name: `类别 ${lbl} (Class ${lbl})`, precision: prec, recall: rec, f1, support };
    });

    const activeClassCount = Math.max(1, classMetrics.filter(c => c.support > 0).length);
    const macroF1 = classMetrics.filter(c => c.support > 0).reduce((s, c) => s + c.f1, 0) / activeClassCount;

    return {
      n,
      counts,
      confMat,
      loocvAcc,
      classMetrics,
      activeClassCount,
      macroF1,
    };
  }, [activeReportData]);

  // Generate 7-Part Comprehensive Markdown Report (Strictly aligned with Workflow Pipeline)
  const generateStructuredMarkdown = () => {
    const dateStr = new Date().toLocaleString('zh-CN');
    const { name, category, points: pts, k: rk, metric: rm, p: rp, weightMode: rw, bestK: rbk } = activeReportData;
    const { n, counts, confMat, loocvAcc, classMetrics, activeClassCount, macroF1 } = reportStats;

    const metricTitle =
      rm === 'euclidean'
        ? '欧几里得距离 (L2, p=2.0)'
        : rm === 'manhattan'
        ? '曼哈顿距离 (L1, p=1.0)'
        : rm === 'chebyshev'
        ? '切比雪夫距离 (L_inf, p=∞)'
        : `Minkowski 距离 (p=${rp.toFixed(2)})`;

    return `# K-近邻算法 (KNN) 深度实验诊断与综合评估报告

**实验课题**：${name}  
**生成时间**：${dateStr}  
**运行环境**：K-近邻算法 WebApp 交互实验室（10大核心功能模块）  
**工程流水线规范**：依据“样本采集与载入 → 度量选择与范数球 → K值调优与交叉验证 → 边界演播与评估导出”标准实验管道全流程系统化推导生成  

---

## 第一部分：实验背景与场景流形几何定义 (Problem & Manifold Definition)

1. **场景定位与流形拓扑性质**：
   本实验聚焦于 **${category}** 场景下的 **${name}** 任务。在模式识别理论中，数据并非以均匀测度充斥于整个高维仿射子空间，而是以低维紧致流形（Compact Riemannian Manifold）的形式嵌入其中。本案例的几何流形特征包含局部连续聚集度与曲率变化，这为非参数局部距离推断提供了典型试验场。

2. **算法哲学与非参数统计机制**：
   K-近邻算法（Cover & Hart, 1967）作为经典的**非参数 (Non-parametric)**、**基于实例（Memory/Instance-based）的惰性学习（Lazy Learning）** 模型，其最大特征在于训练阶段不显式求解任何具有固定维度的参数化概率密度模型（如高斯分布的均值与协方差），而将全部归纳偏置（Inductive Bias）延迟至在线推断阶段。模型的分类判决边界完全由邻近局部几何结构、样本拓扑密度梯度以及所选距离测度动态诱导生成。

3. **渐近贝叶斯风险上界定理 (Cover-Hart Theorem)**：
   统计学习理论证明，在样本量 $N \\to \\infty$ 且特征空间局部连续的光滑先验假设下，最近邻法则（$1$-NN）的泛化错误率 $R_{1\\text{-NN}}$ 满足严谨的渐近界限：
   $$R^* \\le R_{1\\text{-NN}} \\le 2R^*(1 - R^*) \\le 2R^*$$
   其中 $R^*$ 为贝叶斯最优分类器（Bayes Optimal Classifier）的最小不可约理论错误率。该定理确立了 KNN 的理论基石：即便是最朴素的单近邻规则，其大样本渐近错误率也不会超过理论最优贝叶斯误差的两倍；而当 $K \\to \\infty$ 且满足 $\\lim_{N \\to \\infty} \\frac{K}{N} = 0$ 时，KNN 分类器将收敛于贝叶斯最优判决极限。

4. **实验核心课题目标**：
   探究广义闵可夫斯基度量参数 $p$ 对局部测度球几何形态的重构作用，剖析超参数 $K$ 对模型有效容量（Effective Degrees of Freedom）与偏置-方差困境（Bias-Variance Dilemma）的动态牵引，并结合反距离加权评估边界拓扑正则化效应。

---

## 第二部分：样本数据采集与特征空间分布 (Sample Acquisition & Space Distribution)

1. **特征空间几何边界与测度基底**：
   本实验定义在标准二维紧致正交坐标域 $\\mathcal{X} = [0, 100] \\times [0, 100] \\subset \\mathbb{R}^2$ 中，拥有均一的标量度量基底。空间总有效观测样本容量为 **$N = ${n}$** 个带标签离散点。

2. **多类样本拓扑密度与类别先验分布**：
   当前数据集在各类别上的离散频数与经验先验概率分布统计如下：
   - **类别 0 (Class 0 / 蓝)**：${counts[0] || 0} 个样本，经验先验占比为 **${n > 0 ? (((counts[0] || 0) / n) * 100).toFixed(2) : 0}%**
   - **类别 1 (Class 1 / 红)**：${counts[1] || 0} 个样本，经验先验占比为 **${n > 0 ? (((counts[1] || 0) / n) * 100).toFixed(2) : 0}%**
   - **类别 2 (Class 2 / 绿)**：${counts[2] || 0} 个样本，经验先验占比为 **${n > 0 ? (((counts[2] || 0) / n) * 100).toFixed(2) : 0}%**

3. **样本不平衡度 (Imbalance Ratio) 与先验偏置威胁**：
   当前数据集的最大类别与最小类别样本量之比为 **${(Math.max(...Object.values(counts), 1) / Math.min(...Object.values(counts), 1)).toFixed(2)} : 1**。
   - 理论分析指出：当局部样本不平衡度升高时，等权多数表决机制（Majority Voting）会天然倾向于大类先验，导致稀疏少数类的邻域易被多数类外围样本包裹，出现严重的“小类吞噬”与边界向小类内部收缩退化现象。

4. **贝叶斯不可分重叠区与内在测量噪声**：
   在流形交界处，类条件概率密度 $p(x|y=c)$ 存在不可避免的空间重叠。该交叠区域由内在随机扰动诱发，构成了分类系统在该数据分布下的理论误差下界，也是模型决策边界必须实现泛化平滑而非机械死记的核心原因。

---

## 第三部分：距离度量测度与几何范数球选取 (Distance Metric & Norm Ball Geometry)

1. **广义闵可夫斯基度量族 (Minkowski Metric Family) 代数形式化**：
   两观测向量 $x, y \\in \\mathbb{R}^d$ 在 $L_p$ 范数诱导下的空间测度严格形式化为：
   $$D_p(x, y) = \\|x - y\\|_p = \\left( \\sum_{i=1}^d |x_i - y_i|^p \\right)^{\\frac{1}{p}}$$
   当前实验选定度量：**${metricTitle}**。

2. **单位等距范数球 $\\mathcal{B}_p = \\{z \\in \\mathbb{R}^d \\mid \\|z\\|_p \\le 1\\}$ 几何对称性与拓扑特性深度对比**：
   - **欧几里得距离 ($p=2, L_2$ 范数)**：
     单位球为旋转对称的各向同性超圆。满足正交变换不变性（Rotational Invariance），在空间所有方向上测度均一。诱导出的决策界面呈现二阶圆滑曲线与连通光滑弧线，对方向性特征旋转最为稳健。
   - **曼哈顿街区距离 ($p=1, L_1$ 范数)**：
     单位球退化为对角线倾斜 $45^\\circ$ 的正交菱形交叉八面体。度量值等于各坐标轴投影绝对距离的标量线性累加。对于具备主轴方向性排布的数据或存在单维度极端离群噪点（Outliers）的场景，曼哈顿度量能避免欧氏平方项的极端误差放大，表现出优越的 $L_1$ 中位数鲁棒性。
   - **切比雪夫度量 ($p \\to \\infty, L_\\infty$ 范数)**：
     代数极限定理表明 $\\lim_{p \\to \\infty} D_p(x, y) = \\max_{i=1,\\dots,d} |x_i - y_i|$。单位球形态为平行于坐标轴的正交直角超立方体，距离完全取决于单特征轴上的最大绝对偏差点，这导致决策边界退化为水平与垂直相交的网格方块状折线。
   - **拟范数非凸空间 ($0 < p < 1$)**：
     单位等距面内凹，此时三角不等式 $\|x - y\| \\le \|x - z\| + \|z - y\|$ 失效，空间失去赋范向量空间结构，但在超高维极端稀疏特征挖掘中常被用作克服距离集中效应的超参数探索。

3. **局部马氏度量 (Mahalanobis Distance) 泛化展望**：
   广义欧氏距离隐含了各特征轴相互独立且方差相等的强假设。当特征之间存在显著协方差相关性时，应当引入样本协方差矩阵逆矩阵 $\\Sigma^{-1}$ 构建马氏度量 $D_M(x, y) = \\sqrt{(x-y)^T \\Sigma^{-1} (x-y)}$ 进行空间旋转与方差解耦白化。

---

## 第四部分：K 值超参数调优与交叉验证评估 (Hyperparameter Tuning & LOOCV)

1. **当前超参数配置与最优点搜索结果**：
   - 当前交互选定近邻数：**$K = ${rk}**
   - 留一交叉验证 (LOOCV) 全局搜索所得最优超参数：**$K^* = ${rbk}**
   - 当前参数下模型留一交叉验证泛化准确率：**${(loocvAcc * 100).toFixed(2)}%**

2. **偏置-方差困境 (Bias-Variance Dilemma) 的数学推导与边界行为**：
   KNN 预测函数在均方误差意义下的期望泛化误差可严格正交分解为：
   $$\\mathbb{E}\\left[ (y - \\hat{f}_K(x))^2 \\right] = \\text{Bias}^2\\left(\\hat{f}_K(x)\\right) + \\text{Var}\\left(\\hat{f}_K(x)\\right) + \\sigma_{\\varepsilon}^2$$
   - **方差项分析**：$\\text{Var}\\left(\\hat{f}_K(x)\\right) \\approx \\frac{\\sigma^2}{K}$。当 $K$ 极小时，方差急剧飙升；
   - **偏差项分析**：$\\text{Bias}^2\\left(\\hat{f}_K(x)\\right) \\approx O\\left( K^{4/d} \\cdot \\|\\nabla^2 f(x)\\|^2 \\right)$。当 $K$ 增大时，邻域半径扩张囊括远端相异类样本，导致模型系统性偏差剧增。

3. **双极端状态与当前状态严谨定性**：
   ${rk <= 2 ? `- **极端高方差 / 严重过拟合状态 ($K=${rk})**：模型的有效自由度接近样本容量 $N$，每一个孤立样本甚至离群噪声均能在局部独断诱导出一块 Voronoi 闭包。决策边界呈现高度细碎的孤岛、毛刺与锯齿状突起，训练集经验误差为 0 但测试泛化方差剧烈震荡。` : rk >= Math.max(15, Math.floor(n * 0.4)) ? `- **极端高偏差 / 严重欠拟合状态 ($K=${rk})**：近邻超球半径过大，强行把流形曲率深处的样本与背景大类混淆求和。决策边界发生过度平滑与退化塌陷，真实复杂流形的几何分界被全局先验众数抹平，模型丧失了对局部关键特征差异的分辨能力。` : `- **全局最优权衡平衡态 ($K=${rk})**：当前 $K$ 值成功处在偏置-方差曲线的谷底平衡区间，既利用了邻域内多个邻居的表决平滑滤除了孤立高斯噪声，又精准紧扣了真实流形轮廓的拓扑曲率分界。`}

4. **留一交叉验证 (LOOCV) 统计优势与平局规避**：
   - 留一交叉验证在每一轮仅留出一个观测样本作为验证集，其余 $N-1$ 个点全部用于近邻索引构建，是泛化误差的几乎无偏估计量（Nearly Unbiased Estimator）；
   - **偶数平局死锁机制**：多分类问题中若采用偶数 $K$（如 $K=2, 4$），在交界处极易出现 $1:1$ 或同票死锁。工程落地中应首选奇数 $K$ 或引入倒数距离加权打破平局。

---

## 第五部分：权重表决机制与决策边界拓扑分析 (Weighting Policy & Boundary Topology)

1. **表决机制的形式化机理对比**：
   - **等权多数表决 (Uniform Majority Voting)**：
     $$\\hat{y}(x) = \\arg\\max_{c \\in \\mathcal{C}} \\sum_{i=1}^K \\mathbb{I}(y_{(i)} = c)$$
     平等看待距离查询点最近与最远的近邻，违背了地理学第一定律（Tobler's First Law）“距离相近的事物更具关联性”的空间直觉。
   - **反距离加权策略 (Inverse Distance Weighting, IDW)**：
     $$w_i = \\frac{1}{(D(x, x_{(i)}) + \\varepsilon)^\\alpha}, \\quad \\hat{y}(x) = \\arg\\max_{c \\in \\mathcal{C}} \\sum_{i=1}^K w_i \\cdot \\mathbb{I}(y_{(i)} = c)$$
     当前实验设定中采用反距离加权（$\\alpha=1, \\varepsilon=10^{-5}$），距离趋近于 0 的核心样本享有主导表决权。

2. **Voronoi 镶嵌胞元演变与空间连续性**：
   - 几何学上，当 $K=1$ 时，整个特征平面被严格划分为凸多面体构成的 Voronoi 镶嵌拓扑（Voronoi Tessellation）；
   - 在等权表决下，边界呈阶梯多边形跳变，在异类样本过渡区存在突兀的台阶边界；
   - 引入反距离加权后，近邻点的影响力呈现平滑核密度衰减，将硬阶梯决策面转化为连续软概率平原，显著压制边缘噪点突变，并在非平衡数据分布中为边缘稀疏小类构筑起可靠的保护屏障。

---

## 第六部分：分类评估检验与混淆矩阵性能分析 (Classification Metrics & Matrix Deep-Dive)

1. **全样本留一交叉验证 (LOOCV) 综合分类指标**：

| 评估类别编码与名称 | 精确率 (Precision) | 召回率 (Recall) | F1-Score 调和平均 | 样本真实支持度 (Support) |
| :--- | :--- | :--- | :--- | :--- |
${classMetrics.map(cm => `| **${cm.name}** | ${(cm.precision * 100).toFixed(1)}% | ${(cm.recall * 100).toFixed(1)}% | ${cm.f1.toFixed(3)} | ${cm.support} 观测点 |`).join('\n')}
| **整体留一验证准确率 (Accuracy)** | **${(loocvAcc * 100).toFixed(2)}%** | **宏平均 F1: ${macroF1.toFixed(3)}** | **类别总数: ${activeClassCount}** | **总计样本量: $N = ${n}$** |

2. **多类别全局混淆矩阵 (Confusion Matrix) 空间交叉验证统计**：

| 真实样本类别 \\ 预测输出类别 | 预测判断为 Class 0 | 预测判断为 Class 1 | 预测判断为 Class 2 |
| :--- | :--- | :--- | :--- |
| **真实观测 Class 0** | **${confMat[0][0]}** (True Positive) | ${confMat[0][1]} (误判为 C1) | ${confMat[0][2]} (误判为 C2) |
| **真实观测 Class 1** | ${confMat[1][0]} (误判为 C0) | **${confMat[1][1]}** (True Positive) | ${confMat[1][2]} (误判为 C2) |
| **真实观测 Class 2** | ${confMat[2][0]} (误判为 C0) | ${confMat[2][1]} (误判为 C1) | **${confMat[2][2]}** (True Positive) |

3. **宏平均 (Macro-Average) 与微平均的统计学意义**：
   当样本类别之间存在容量不平衡时，常规准确率（Accuracy）极易被多数类主导，造成“假性高分”。宏平均 F1（Macro F1 = ${macroF1.toFixed(3)}）不赋予大样本类更高权重，而是对各类别 F1 指标一视同仁求算术平均，能够敏锐捕捉分类器是否在某一稀疏关键类别上发生系统性塌陷。

---

## 第七部分：理论反思与三大工业工程陷阱规避 (Theoretical Synthesis & Engineering Pitfalls)

1. **工程陷阱一：特征量纲差异与距离失真灾难 (Scale & Variance Distortion)**：
   KNN 算法纯粹建立在几何空间欧氏距离范数之上。若原始特征未经过无量纲化处理，方差尺度大的物理特征（如以万元计的年收入）将以二次方量级完全主导距离计算，导致小尺度关键特征（如以年计的工龄）被数学性彻底湮没。
   - **强制规避规范**：在任何近邻检索管道前置模块中，必须强制实施标准正态 Z-score 标准化：
     $$z_j = \\frac{x_j - \\mu_j}{\\sigma_j} \\quad \\text{或} \\quad z_j = \\frac{x_j - x_{\\min}}{x_{\\max} - x_{\\min}}$$

2. **工程陷阱二：高维维度灾难与 Beyer 距离集中定理 (Curse of Dimensionality & Beyer's Theorem)**：
   随着特征空间维度 $d$ 攀升至高维，超球体积占外切超立方体体积的比例将指数级归零：
   $$\\lim_{d \\to \\infty} \\frac{\\text{Vol}(\\mathcal{B}^d(r))}{\\text{Vol}(\\mathcal{C}^d(2r))} = \\lim_{d \\to \\infty} \\frac{\\frac{\\pi^{d/2}}{\\Gamma(d/2 + 1)} r^d}{(2r)^d} = 0$$
   由此诱发的 Beyer 距离集中效应（Beyer et al., 1999）证明：在独立同分布高维空间中，任意查询点到数据集中最远点与最近点的距离之差与最近点距离的比值趋近于 0：
   $$\\lim_{d \\to \\infty} \\frac{D_{\\max}(x) - D_{\\min}(x)}{D_{\\min}(x)} = 0$$
   这意味着所有样本点到查询点的距离几乎趋同，近邻与远邻的相对辨析力丧失殆尽。同时，KD-Tree 的二叉空间切分超平面将被查询超球全面穿透，剪枝机制失效，算法时间复杂度退化为 $O(N)$ 暴力扫描。
   - **高维优化方案**：当 $d > 20$ 时，必须配合主成分分析 (PCA) 或 UMAP 进行前置低维流形嵌入投影，或改用 Ball-Tree、分层可导航小世界图（HNSW）等现代近似最近邻（ANN）检索结构。

3. **工程陷阱三：惰性推断延迟与海量数据压缩剪枝 (Inference Latency & Condensation)**：
   KNN 无显式训练耗时，却将 $O(N \\cdot d)$ 的计算重担全额转嫁给预测阶段，在高并发低延迟推断场景中面临严重的吞吐瓶颈与内存占位。
   - **生产架构优化对策**：
     - **凝聚近邻算法 (Condensed Nearest Neighbor, CNN)**：迭代剔除位于类内深处的多余冗余核心样本，仅保留支撑决策边界的关键支撑样本点；
     - **编辑近邻算法 (Edited Nearest Neighbor, ENN)**：针对训练集实施近邻投票清洗，剔除位于相异类腹地的离散误标噪点，平滑决策曲面；
     - **向量量化与分桶索引**：结合乘积量化（Product Quantization, PQ）与倒排文件（IVF），实现千万级向量库的毫秒级近似最近邻响应。

---
*本报告由 K-近邻算法 (KNN) 交互实验室标准化生成 · 遵循完整机器学习管道规范与学术研究导引*
`;
  };

  const handleExportMarkdown = () => {
    const md = generateStructuredMarkdown();
    triggerDownload(md, `knn_pipeline_report_${selectedCaseId}_${Date.now()}.md`, 'text/markdown;charset=utf-8');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
      {/* Top Header */}
      <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            09. 数据集下载与全流程分类报告导出引擎
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            提供四大案例基准流形原始数据下载 · 按照全流程导引标准生成 7 大部分深度学术实验报告
          </p>
        </div>

        {downloadSuccess && (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-md border border-emerald-200 animate-in fade-in">
            <Check className="w-3.5 h-3.5" /> 已成功导出: {downloadSuccess}
          </span>
        )}
      </div>

      <div className="p-6 space-y-8">
        {/* Section 1: 四大基准案例原始数据下载卡片库 */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-sky-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                四大基准案例切片原始数据集下载专区
              </h3>
            </div>
            <span className="text-[11px] text-slate-500">
              包含完整坐标坐标点、类别编码与元数据 CSV
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {presets.map((preset, idx) => (
              <div
                key={preset.id}
                className="p-4 rounded-xl border border-slate-200/90 bg-slate-50/70 hover:bg-white hover:border-slate-300 hover:shadow-xs transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-mono font-semibold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded">
                      案例 0{idx + 1}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      N = {preset.points.length}
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-slate-900 leading-snug">
                    {preset.name}
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                    {preset.subtitle}
                  </p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-200/70 flex items-center justify-between">
                  <button
                    onClick={() => {
                      setSelectedCaseId(preset.id);
                      setPreviewTab('formatted');
                    }}
                    className="text-[11px] text-sky-700 hover:text-sky-800 font-medium"
                    title="在下方预览本案例生成的全流程报告"
                  >
                    生成此案例报告 →
                  </button>

                  <button
                    onClick={() => handleDownloadPresetCSV(preset)}
                    className="flex items-center gap-1 px-2 py-1 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-md text-[11px] font-medium shadow-xs transition-colors"
                    title="下载原始点集 CSV"
                  >
                    <Download className="w-3 h-3" />
                    <span>CSV</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 2: 当前画布交互数据快速导出 */}
        <div className="bg-slate-50/90 rounded-xl p-4 border border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-sky-600 text-white flex items-center justify-center font-bold text-xs">
              05
            </div>
            <div>
              <span className="font-bold text-slate-900 block leading-tight">
                当前画布交互绘制数据集 ({datasetName || '自定义点集'})
              </span>
              <span className="text-[11px] text-slate-500">
                当前包含 {points.length} 个训练点 · 已计算 K={k} 与度量 {metric.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedCaseId('current')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                selectedCaseId === 'current'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              选中生成当前画布报告
            </button>

            <button
              onClick={handleDownloadCurrentPoints}
              disabled={points.length === 0}
              className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-50 text-slate-700 rounded-lg text-xs font-medium shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>下载点集 CSV</span>
            </button>

            <button
              onClick={handleDownloadCVCurve}
              disabled={cvCurve.length === 0}
              className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-50 text-slate-700 rounded-lg text-xs font-medium shadow-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>下载 CV 曲线 CSV</span>
            </button>
          </div>
        </div>

        {/* Section 3: 全流程导引报告预览与导出 (7大规范部分) */}
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          {/* Report Preview Header */}
          <div className="bg-slate-100/80 px-5 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-sky-700" />
              <div>
                <span className="text-xs font-bold text-slate-900">
                  全流程实验评估学术报告预览 (7大规范部分)
                </span>
                <span className="text-[11px] text-slate-500 ml-2">
                  当前载入：
                  <strong className="text-slate-800 font-semibold">
                    {activeReportData.name}
                  </strong>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Report view mode toggle */}
              <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200">
                <button
                  onClick={() => setPreviewTab('formatted')}
                  className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded transition-colors ${
                    previewTab === 'formatted'
                      ? 'bg-slate-900 text-white font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Eye className="w-3 h-3" />
                  <span>格式化出版级报告</span>
                </button>
                <button
                  onClick={() => setPreviewTab('raw')}
                  className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded transition-colors ${
                    previewTab === 'raw'
                      ? 'bg-slate-900 text-white font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Code className="w-3 h-3" />
                  <span>Markdown 源码</span>
                </button>
              </div>

              <button
                onClick={handleExportMarkdown}
                className="flex items-center gap-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>导出 .md 报告</span>
              </button>

              <button
                onClick={handlePrint}
                className="flex items-center justify-center p-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-xs shadow-xs"
                title="调用浏览器打印为 PDF"
              >
                <Printer className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Report Body View */}
          {previewTab === 'formatted' ? (
            <div className="p-6 md:p-8 bg-white max-h-[600px] overflow-y-auto space-y-7 text-xs text-slate-800 leading-relaxed font-sans">
              {/* Report Header Meta */}
              <div className="border-b border-slate-200 pb-5">
                <span className="text-[10px] uppercase font-bold text-sky-700 tracking-wider">
                  K-Nearest Neighbors Comprehensive Academic Lab Report
                </span>
                <h1 className="text-xl font-bold text-slate-900 mt-1">
                  K-近邻算法深度实验诊断与综合评估报告 · {activeReportData.name}
                </h1>
                <div className="flex flex-wrap gap-4 text-[11px] text-slate-500 mt-2.5">
                  <span>生成时间: {new Date().toLocaleDateString('zh-CN')}</span>
                  <span>·</span>
                  <span>样本容量: {reportStats.n} 观测点</span>
                  <span>·</span>
                  <span>
                    留一验证准确率: {(reportStats.loocvAcc * 100).toFixed(2)}%
                  </span>
                  <span>·</span>
                  <span>
                    宏平均 F1: {reportStats.macroF1.toFixed(3)}
                  </span>
                  <span>·</span>
                  <span>
                    推荐最优 K*: {activeReportData.bestK}
                  </span>
                </div>
              </div>

              {/* Part 1 */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-800 flex items-center justify-center text-[10px] font-bold">
                    1
                  </span>
                  <span className="text-sm">第一部分：实验背景与场景流形几何定义 (Problem & Manifold Definition)</span>
                </h3>
                <div className="pl-6 space-y-2 text-[11px] text-slate-600">
                  <p>
                    本实验围绕 <strong>{activeReportData.category}</strong> 场景下的 <strong>{activeReportData.name}</strong> 展开。现代统计学习理论指出，高维数据点通常并不均匀散布于整个几何向量空间，而是以低维紧致连续流形（Compact Riemannian Manifold）的形式局域嵌入其中。针对该流形结构，本实验旨在探究基于局部距离度量与近邻表决对分类决策界拓扑连续性及泛化性能的作用机理。
                  </p>
                  <p>
                    <strong>算法哲学与非参数统计机制</strong>：KNN 算法（Cover & Hart, 1967）作为典型的非参数（Non-parametric）基于实例（Memory-based）学习器，在训练阶段不求解任何固定形式的参数化概率模型，而是将推断计算全额后延至预测阶段。分类决策面直接由局部几何测度场在连续空间中诱导生成。
                  </p>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="font-semibold text-slate-800 block mb-1">渐近贝叶斯风险上界定理 (Cover-Hart Theorem)：</span>
                    <p className="font-mono text-xs text-sky-900 mb-1">
                      R* ≤ R_(1-NN) ≤ 2R*(1 - R*) ≤ 2R*
                    </p>
                    <p className="text-[10px] text-slate-500">
                      当样本容量 N → ∞ 且局部密度连续可微时，即便是最朴素的 1-NN 分类器，其渐近泛化错误率也不会超过理论最小贝叶斯错误率 R* 的两倍。当近邻数 K 满足 K → ∞ 且 K/N → 0 时，KNN 分类误差严格收敛至贝叶斯最优下界。
                    </p>
                  </div>
                </div>
              </div>

              {/* Part 2 */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-800 flex items-center justify-center text-[10px] font-bold">
                    2
                  </span>
                  <span className="text-sm">第二部分：样本数据采集与特征空间分布 (Sample Acquisition & Distribution)</span>
                </h3>
                <div className="pl-6 text-[11px] text-slate-600 space-y-2">
                  <p>
                    实验特征空间限定在紧致正交域 [0, 100] × [0, 100] 仿射空间内，共计 {reportStats.n} 个标准观测点。各类别经验先验分布如下：
                  </p>
                  <div className="grid grid-cols-3 gap-2.5 my-2">
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <span className="text-slate-500 block text-[10px]">类别 0 (天青蓝)</span>
                      <span className="font-bold text-slate-900 text-sm">{reportStats.counts[0] || 0} 样本</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        占比: {reportStats.n > 0 ? (((reportStats.counts[0] || 0) / reportStats.n) * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <span className="text-slate-500 block text-[10px]">类别 1 (珊瑚红)</span>
                      <span className="font-bold text-slate-900 text-sm">{reportStats.counts[1] || 0} 样本</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        占比: {reportStats.n > 0 ? (((reportStats.counts[1] || 0) / reportStats.n) * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <span className="text-slate-500 block text-[10px]">类别 2 (薄荷绿)</span>
                      <span className="font-bold text-slate-900 text-sm">{reportStats.counts[2] || 0} 样本</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        占比: {reportStats.n > 0 ? (((reportStats.counts[2] || 0) / reportStats.n) * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                  </div>
                  <p>
                    <strong>样本不平衡度分析</strong>：最大与最小类别样本量之比约为 {(Math.max(...Object.values(reportStats.counts), 1) / Math.min(...Object.values(reportStats.counts), 1)).toFixed(2)}:1。若不平衡度较高，等权投票将使多数类先验占优，造成稀疏边缘类被多数类包围侵蚀。而在类间交叠处，存在由于测量随机性导致的贝叶斯不可约误差区。
                  </p>
                </div>
              </div>

              {/* Part 3 */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-800 flex items-center justify-center text-[10px] font-bold">
                    3
                  </span>
                  <span className="text-sm">第三部分：距离度量测度与几何范数球选取 (Distance Metric & Norm Ball)</span>
                </h3>
                <div className="pl-6 text-[11px] text-slate-600 space-y-2">
                  <p>
                    采用广义闵可夫斯基度量族：<span className="font-mono text-slate-900">D_p(x, y) = (∑ |x_i - y_i|^p)^(1/p)</span>。当前实验参数为 <strong>{activeReportData.metric.toUpperCase()} (p={activeReportData.p.toFixed(2)})</strong>。
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[10px] my-2">
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                      <span className="font-bold text-slate-900 block mb-1">欧几里得距离 (L2, p=2)</span>
                      <span className="text-slate-600">
                        单位球呈严格各向同性超圆球，具备旋转不变性，诱导出光滑的二次连续曲面，适宜于无方向先验的连续自然流形。
                      </span>
                    </div>
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                      <span className="font-bold text-slate-900 block mb-1">曼哈顿距离 (L1, p=1)</span>
                      <span className="text-slate-600">
                        单位球为 45° 倾斜的菱形十字凸包，沿网格轴线线性累加差值，避免极端误差二次放大，对单维度离群点具有天然鲁棒性。
                      </span>
                    </div>
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                      <span className="font-bold text-slate-900 block mb-1">切比雪夫距离 (L_inf, p=∞)</span>
                      <span className="text-slate-600">
                        单位球为正交直角超立方体，由单维度最大极端差决定，决策边界在几何上退化为垂直水平相交的方块阶梯。
                      </span>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    <strong>度量拓展</strong>：若特征间存在显著协方差相关性，欧氏假设各轴独立的先验失效，需采用马氏度量 D_M(x, y) = √((x-y)^T Σ^(-1) (x-y)) 消除轴间耦合。
                  </p>
                </div>
              </div>

              {/* Part 4 */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-800 flex items-center justify-center text-[10px] font-bold">
                    4
                  </span>
                  <span className="text-sm">第四部分：K 值超参数调优与交叉验证评估 (Hyperparameter Tuning & LOOCV)</span>
                </h3>
                <div className="pl-6 text-[11px] text-slate-600 space-y-2">
                  <p>
                    当前超参数设定为 <strong>K = {activeReportData.k}</strong>，留一交叉验证 (LOOCV) 全局搜索的最优近邻数为{' '}
                    <strong className="text-emerald-700 font-mono text-sm">K* = {activeReportData.bestK}</strong>，此时峰值留一泛化准确率达 <strong>{(reportStats.loocvAcc * 100).toFixed(2)}%</strong>。
                  </p>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                    <span className="font-semibold text-slate-800 block">偏置-方差困境 (Bias-Variance Dilemma) 严格解析：</span>
                    <p className="font-mono text-xs text-sky-900">
                      E[(y - f_K(x))^2] = Bias^2(f_K(x)) + Var(f_K(x)) + σ^2,  其中 Var ∝ σ^2 / K, Bias^2 ∝ O(K^(4/d))
                    </p>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      {activeReportData.k <= 2
                        ? '处于高方差/严重过拟合状态：K值过小，模型自由度逼近样本容量，孤立噪声点在局部独占 Voronoi 闭包，决策边界产生破碎锯齿与孤岛，泛化方差剧烈。'
                        : activeReportData.k >= 15
                        ? '处于高偏差/严重欠拟合状态：K值偏大，超球半径卷入远端异类样本，抹平了流形细部的真实几何分界，退化为全局众数判定。'
                        : '处于最优权衡区间：兼顾了邻域表决对测量噪声的平滑滤除与对真实流形拓扑边界的清晰保真解析。'}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      <strong>平局规避机制</strong>：在二分类或多类别相持时，偶数 K 易造成等票死锁，工程中首选奇数 K 或配合反距离加权打破平衡。
                    </p>
                  </div>
                </div>
              </div>

              {/* Part 5 */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-800 flex items-center justify-center text-[10px] font-bold">
                    5
                  </span>
                  <span className="text-sm">第五部分：权重表决机制与决策边界拓扑分析 (Weighting Policy & Boundary)</span>
                </h3>
                <div className="pl-6 text-[11px] text-slate-600 space-y-2">
                  <p>
                    当前采用{' '}
                    <strong>
                      {activeReportData.weightMode === 'inverse'
                        ? '反距离加权策略 (Inverse Distance: w_i = 1 / (d_i + ε))'
                        : '等权多数表决策略 (Uniform 1.0)'}
                    </strong>
                    。
                  </p>
                  <p>
                    <strong>Voronoi 连续加权演化机理</strong>：等权多数表决将所有近邻等量齐观，在交界过渡区诱导出阶梯状不连续多边形边界；而反距离加权引入核衰减因子，越靠近查询点的样本权重呈反比剧增，将硬性离散判决面软化为平滑概率场。不仅显著降低了远端异常点对局部的干扰，更在类别分布不平衡时，有效保护了稀疏少数类边缘不被多数类大流吞噬。
                  </p>
                </div>
              </div>

              {/* Part 6 */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-800 flex items-center justify-center text-[10px] font-bold">
                    6
                  </span>
                  <span className="text-sm">第六部分：分类评估检验与混淆矩阵性能分析 (Classification Metrics & Matrix)</span>
                </h3>
                <div className="pl-6 space-y-3">
                  <table className="w-full text-[11px] border border-slate-200 rounded-lg overflow-hidden">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2 text-left">评估类别名称</th>
                        <th className="px-3 py-2 text-left">精确率 (Precision)</th>
                        <th className="px-3 py-2 text-left">召回率 (Recall)</th>
                        <th className="px-3 py-2 text-left">F1-Score 调和平均</th>
                        <th className="px-3 py-2 text-left">真实支持度 (Support)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {reportStats.classMetrics.map(cm => (
                        <tr key={cm.label}>
                          <td className="px-3 py-2 font-sans font-semibold text-slate-800">
                            {cm.name}
                          </td>
                          <td className="px-3 py-2">{(cm.precision * 100).toFixed(1)}%</td>
                          <td className="px-3 py-2">{(cm.recall * 100).toFixed(1)}%</td>
                          <td className="px-3 py-2 text-sky-800 font-bold">{cm.f1.toFixed(3)}</td>
                          <td className="px-3 py-2 text-slate-500">{cm.support} 观测点</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-[11px] space-y-1.5">
                    <span className="font-semibold text-slate-800 block">
                      留一交叉验证混淆矩阵 (Confusion Matrix)：
                    </span>
                    <div className="font-mono text-slate-700 space-y-0.5 text-xs">
                      <div>True C0: [ C0:{reportStats.confMat[0][0]}, C1:{reportStats.confMat[0][1]}, C2:{reportStats.confMat[0][2]} ]</div>
                      <div>True C1: [ C0:{reportStats.confMat[1][0]}, C1:{reportStats.confMat[1][1]}, C2:{reportStats.confMat[1][2]} ]</div>
                      <div>True C2: [ C0:{reportStats.confMat[2][0]}, C1:{reportStats.confMat[2][1]}, C2:{reportStats.confMat[2][2]} ]</div>
                    </div>
                    <p className="text-[10px] text-slate-500 pt-1">
                      <strong>宏平均 F1 的判决价值</strong>：宏平均 F1 为 {reportStats.macroF1.toFixed(3)}。在存在类别容量差异的数据集中，宏平均 F1 对所有类别等权平均，杜绝了整体准确率被多数类虚抬的假象，如实衡量稀疏小类的分类稳定性。
                    </p>
                  </div>
                </div>
              </div>

              {/* Part 7 */}
              <div className="space-y-2 border-t border-slate-200 pt-4">
                <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-800 flex items-center justify-center text-[10px] font-bold">
                    7
                  </span>
                  <span className="text-sm">第七部分：理论反思与三大工业工程陷阱规避 (Theoretical Synthesis & Pitfalls)</span>
                </h3>
                <div className="pl-6 space-y-2.5 text-[11px] text-slate-600">
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <strong className="text-slate-900 block mb-0.5">1. 特征量纲差异与距离失真 (Distance Distortion)：</strong>
                    <span>
                      KNN 纯粹依赖距离测度。若特征未标准化，方差大的轴向将在欧氏公式中占据绝对二次方支配地位，淹没关键小尺度特征。生产级管道前置必须强制执行标准正态 Z-score 标准化 (z = (x - μ) / σ)。
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <strong className="text-slate-900 block mb-0.5">2. 维度灾难与 Beyer 距离集中定理 (Curse of Dimensionality & Beyer's Theorem)：</strong>
                    <span>
                      随特征维度 d 升高，超球体积占超立方体比例趋近于 0，Beyer 定理证明 lim_(d→∞) (D_max - D_min) / D_min = 0，所有点间距离趋同，近邻辨别力丧失，KD-Tree 退化为 O(N) 暴力扫描。当 d &gt; 20 时，必须前置配合 PCA/UMAP 降维或改用 Ball-Tree / HNSW 现代 ANN 索引。
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <strong className="text-slate-900 block mb-0.5">3. 惰性计算推断延时与数据剪枝 (Inference Latency & Condensation)：</strong>
                    <span>
                      KNN 推断复杂度为 O(N·d)，在大规模高并发业务中延迟显著。工程落地可通过凝聚近邻（CNN）剔除类内深层冗余样本，通过编辑近邻（ENN）清洗边界误标噪点，或通过乘积量化（PQ）实现极速检索。
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Raw Markdown View */
            <div className="p-4 bg-slate-950 text-slate-200 font-mono text-[11px] whitespace-pre-wrap leading-relaxed max-h-[580px] overflow-y-auto">
              {generateStructuredMarkdown()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
