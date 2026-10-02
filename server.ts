import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '5mb' }));

  // Shared Gemini client setup
  let ai: GoogleGenAI | null = null;
  if (process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }

  // Diagnostic endpoint for Module 7
  app.post('/api/knn-ai-diagnose', async (req: Request, res: Response) => {
    try {
      const {
        datasetName,
        totalPoints,
        classCounts,
        k,
        metric,
        p,
        weightMode,
        cvAccuracy,
        bestK,
        featureRanges,
      } = req.body;

      const systemPrompt = `你是一位严谨的资深统计学习与机器学习专家导师。
用户正在K-近邻算法(KNN)实验室中操作实验。
请依据用户当前参数、特征分布和验证结果，给出精准、学术且具有可操作性的诊断报告。
诊断应重点覆盖：
1. 【特征量纲与距离失真 (Distance Distortion)】：判断特征取值范围或坐标轴拉伸对距离度量（如欧氏、曼哈顿）的影响，指明是否需要 Z-score 或 Min-Max 标准化。
2. 【K值偏置-方差权衡 (Bias-Variance Dilemma)】：分析当前 K=${k} 是否存在局部过拟合（小K锯齿边界）或欠拟合（大K平原平滑），结合最佳K值参考。
3. 【距离度量几何适用性】：评价所选距离（${metric}${metric === 'minkowski' ? `, p=${p}` : ''}）与当前数据集拓扑形状的拟合优劣。
4. 【样本平衡与多数表决陷阱】：分析类别分布是否失衡，表决是否易被多数类吞噬，权值策略（${weightMode === 'inverse' ? '反距离加权' : '等权投票'}）的影响。
5. 【高维演化与维度灾难 (Curse of Dimensionality) 警示】及工程调优建议。

输出请使用结构清晰的中文Markdown，包含简练的要点标题、数学直觉解释与可直接执行的优化建议。`;

      const userContent = `当前KNN实验状态：
- 场景数据集：${datasetName || '自定义样本集'}
- 样本总数：${totalPoints}，类别分布：${JSON.stringify(classCounts)}
- 核心超参数：K = ${k}（经验推荐参考最佳K ≈ ${bestK || '待定'}）
- 距离度量：${metric} (Minkowski p = ${p})
- 权重策略：${weightMode === 'inverse' ? '反距离加权 1/(d+ε)' : '等权多数表决 (Uniform)'}
- 交叉验证准确率：${(cvAccuracy * 100).toFixed(1)}%
- 特征跨度估测：${JSON.stringify(featureRanges || { X1: '[0, 100]', X2: '[0, 100]' })}

请给出深入的诊断建议与理论反思。`;

      if (ai) {
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: userContent,
          config: {
            systemInstruction: systemPrompt,
            temperature: 0.4,
          },
        });

        return res.json({
          success: true,
          source: 'gemini',
          diagnosis: response.text || '诊断完成。',
        });
      } else {
        // Fallback robust algorithmic expert synthesis
        const isKTooSmall = k <= 2;
        const isKTooLarge = k > Math.max(15, Math.floor(totalPoints * 0.4));
        const isEvenK = k % 2 === 0;
        const classValues: number[] = Object.values(classCounts || {});
        const maxClass = Math.max(...classValues, 1);
        const minClass = Math.min(...classValues, 1);
        const isImbalanced = maxClass / minClass >= 2.0;

        let diagnosis = `### 🔬 KNN 理论与几何诊断报告\n\n`;

        diagnosis += `#### 1. 特征量纲与距离失真评估\n`;
        diagnosis += `- **几何距离敏感度**：KNN 纯粹依赖样本在特征空间中的距离代数 $D(x, y)$。当前特征跨度若存在未对齐或物理单位差异，方差较大的特征轴将呈二次方形式主导欧氏距离，造成**量纲失真 (Distance Distortion)**。\n`;
        diagnosis += `- **改进建议**：强烈建议在实际工程中实施 **Z-score 标准化** ($z = \\frac{x - \\mu}{\\sigma}$) 或 **Min-Max 归一化**至 $[0, 1]$ 区间，确保各轴几何拓扑权重对等。\n\n`;

        diagnosis += `#### 2. K值偏置与方差权衡分析 (当前 K=${k})\n`;
        if (isKTooSmall) {
          diagnosis += `- ⚠️ **高方差与过拟合风险**：$K=${k}$ 极度依赖离测试点最近的单个局部样本。易受噪声点或离群值 (Outliers) 扰动，导致决策边界呈现出破碎的“岛屿”或锯齿状边缘。\n`;
        } else if (isKTooLarge) {
          diagnosis += `- ⚠️ **高偏差与欠拟合风险**：$K=${k}$ 超过了局部几何结构的承载力，近邻中卷入了过多远端全局样本，抹平了细粒度的决策分界线，准确率受损。\n`;
        } else {
          diagnosis += `-  **参数处于良好权衡区间**：$K=${k}$ 既能平滑微小噪声，又保留了样本流形的几何连续性。\n`;
        }
        if (isEvenK) {
          diagnosis += `- ⚠️ **偶数K表决平局陷阱**：在二分类或多分类中，$K=${k}$ 为偶数时可能导致得票相同。建议优先选奇数K（如 ${k + 1} 或 ${Math.max(1, k - 1)}），或启用反距离加权。\n`;
        }
        diagnosis += `\n#### 3. 距离度量与范数球特性 (${metric.toUpperCase()})\n`;
        if (metric === 'euclidean' || p === 2) {
          diagnosis += `- **欧氏距离 ($L_2$)**：单位范数球为标准圆形，符合各向同性的物理空间假定，对整体几何团簇（如高斯分布、圆形聚类）表现最佳。\n`;
        } else if (metric === 'manhattan' || p === 1) {
          diagnosis += `- **曼哈顿距离 ($L_1$)**：单位范数球为菱形/正八面体，沿网格轴向累加。在高维或稀疏特征空间中抗噪声能力优于 $L_2$。\n`;
        } else if (metric === 'chebyshev') {
          diagnosis += `- **切比雪夫距离 ($L_\\infty$)**：单位范数球为正方形，仅由单维度最大偏差决定，适用于棋盘式或最长受限维度场景。\n`;
        } else {
          diagnosis += `- **Minkowski 度量 ($p=${p}$)**：提供了从超凸到超凹的连续范数过渡，可动态拟合非各向同性流形。\n`;
        }

        diagnosis += `\n#### 4. 样本平衡与权重策略\n`;
        if (isImbalanced) {
          diagnosis += `- ⚠️ **多数类吞噬风险**：当前样本存在不平衡比例 (最高与最低类比值约为 ${(maxClass / minClass).toFixed(1)}:1)。等权投票容易导致多数类主导大 K 邻域，建议开启 **反距离加权策略 (Inverse Distance: $w_i = 1 / (d_i + \\epsilon)$)** 保护稀疏小类的决策边界。\n`;
        } else {
          diagnosis += `-  **样本较为均衡**：各类密度相对对等，当前选择的 ${weightMode === 'inverse' ? '反距离加权' : '等权表决'} 运行平稳。\n`;
        }

        diagnosis += `\n#### 5. 维度灾难 (Curse of Dimensionality) 警示\n`;
        diagnosis += `- 当维度 $d \\to \\infty$ 时，空间中任意两点距离最大值与最小值之比将趋近于 1，欧氏几何意义近乎退化。在实际高维任务（如文本或图像）中，务必先结合 PCA 或 UMAP 进行降维，或使用 KD-Tree / HNSW 加速近邻检索。`;

        return res.json({
          success: true,
          source: 'rule-engine',
          diagnosis,
        });
      }
    } catch (err: any) {
      console.error('Diagnosis error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Chat endpoint for Module 7
  app.post('/api/knn-ai-chat', async (req: Request, res: Response) => {
    try {
      const { message, history } = req.body;
      const systemInstruction = `你是一位专注于度量学习、空间数据结构与非参数统计的机器学习教学专家。
请以严谨透彻、通俗易懂的中文回答关于 K-近邻算法 (KNN)、闵可夫斯基距离 ($L_1, L_2, L_\\infty$)、KD-Tree 空间分割与回溯、维度灾难、交叉验证选择K值等学术与工程问题。
请配合公式与几何直觉深入浅出地解释。`;

      if (ai) {
        const contents: any[] = [];
        if (Array.isArray(history)) {
          for (const item of history.slice(-6)) {
            contents.push({
              role: item.role === 'user' ? 'user' : 'model',
              parts: [{ text: item.text }],
            });
          }
        }
        contents.push({
          role: 'user',
          parts: [{ text: message }],
        });

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents,
          config: {
            systemInstruction,
            temperature: 0.6,
          },
        });

        return res.json({
          success: true,
          reply: response.text || '回答生成完毕。',
        });
      } else {
        // Helpful offline response
        let reply = `【知识库答疑】\n\n关于您提问的：“${message}”：\n\n`;
        const lower = message.toLowerCase();
        if (lower.includes('k') && (lower.includes('选择') || lower.includes('选'))) {
          reply += `**如何科学选取最佳 K 值？**\n\n1. **经验法则**：通常取 $K \\approx \\sqrt{N}$（$N$ 为样本量），且二分类推荐选奇数以避免平局。\n2. **交叉验证 (Cross-Validation)**：最经典且公认的方法是通过 $5$-折或留一交叉验证 (LOOCV)，在 $K \\in [1, 30]$ 上绘制验证误差曲线，选取验证集误差最小、且边界平滑的“肘部”K值。\n3. **偏差-方差权衡**：$K$ 太小（如 $K=1$）模型复杂度高、方差大、容易过拟合；$K$ 太大模型欠拟合，决策边界过于平缓。`;
        } else if (lower.includes('kd') || lower.includes('树') || lower.includes('tree')) {
          reply += `**KD-Tree 的构建与回溯原理：**\n\n1. **递归切分**：依次轮换空间维度（例如 $x$ 轴 $\\to y$ 轴 $\\to x$ 轴），在当前轴上找到中位数样本点作为根节点，将空间切分为两个超矩形子空间。\n2. **近邻搜索与回溯 (Backtracking)**：从根节点二分下沉定位叶子节点；向上回溯时，若当前最近距离球体与分割超平面相交，说明另一侧分支可能存在更近邻点，必须跨入另一子树搜索，否则剪枝跳过。`;
        } else if (lower.includes('维') || lower.includes('灾难')) {
          reply += `**维度灾难 (Curse of Dimensionality) 对 KNN 的致命打击：**\n\n1. **空间极度稀疏**：在高维空间中，为了捕获 $10\\%$ 的局部邻域样本，需要覆盖每个维度约 $(0.1)^{1/d}$ 的区间。当 $d=20$ 时，该区间已接近 $90\\%$，近邻不再具备“局部性”！\n2. **距离趋同 (Distance Concentration)**：数学上当 $d \\to \\infty$ 时，任意两点距离比 $\\frac{\\text{dist}_{\\max} - \\text{dist}_{\\min}}{\\text{dist}_{\\min}} \\to 0$。欧氏距离几乎失去区分度。`;
        } else {
          reply += `KNN 算法本质上是一种**无参数 (Non-parametric)**、**懒惰学习 (Lazy Learning)** 模型。在预测前没有显式的参数训练优化步骤，所有计算均推迟至测试推断时刻。\n其决策关键要素为三大支柱：\n1. **距离度量**（Minkowski 距离家族与范数球）\n2. **K 值大小**（决定模型局部感受野与复杂度）\n3. **分类决策规则**（多数表决 vs 反距离加权）。`;
        }
        return res.json({ success: true, reply });
      }
    } catch (err: any) {
      console.error('Chat error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Mount Vite or serve static files
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`KNN Lab Server started at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
