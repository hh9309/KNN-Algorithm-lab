import { Point2D, MetricType, WeightMode, PredictionResult, ClassLabel, CVCurvePoint, KDNode, KDStep, DatasetPreset } from '../types/knn';

export function calculateDistance(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  metric: MetricType,
  p: number = 2
): number {
  const dx = Math.abs(p1.x - p2.x);
  const dy = Math.abs(p1.y - p2.y);

  if (metric === 'manhattan' || (metric === 'minkowski' && Math.abs(p - 1) < 0.01)) {
    return dx + dy;
  }
  if (metric === 'chebyshev') {
    return Math.max(dx, dy);
  }
  if (metric === 'euclidean' || (metric === 'minkowski' && Math.abs(p - 2) < 0.01)) {
    return Math.sqrt(dx * dx + dy * dy);
  }
  // Minkowski with arbitrary p
  const safeP = Math.max(0.2, p);
  return Math.pow(Math.pow(dx, safeP) + Math.pow(dy, safeP), 1 / safeP);
}

export function predictKNN(
  query: { x: number; y: number },
  points: Point2D[],
  k: number,
  metric: MetricType,
  p: number = 2,
  weightMode: WeightMode = 'uniform',
  excludeId?: string
): PredictionResult {
  const validPoints = excludeId ? points.filter(pt => pt.id !== excludeId) : points;
  if (validPoints.length === 0) {
    return {
      predictedLabel: 0,
      probabilities: [1, 0, 0],
      neighbors: [],
      confidence: 1,
    };
  }

  const effectiveK = Math.min(k, validPoints.length);

  // Compute all distances
  const distances = validPoints.map(point => ({
    point,
    distance: calculateDistance(query, point, metric, p),
  }));

  // Sort ascending by distance
  distances.sort((a, b) => a.distance - b.distance);
  const topK = distances.slice(0, effectiveK);

  const epsilon = 1e-4;
  const neighbors = topK.map(item => {
    let weight = 1.0;
    if (weightMode === 'inverse') {
      weight = 1.0 / (item.distance + epsilon);
    }
    return {
      point: item.point,
      distance: item.distance,
      weight,
    };
  });

  // Tally weighted votes
  const votes: [number, number, number] = [0, 0, 0];
  let totalWeight = 0;
  for (const n of neighbors) {
    votes[n.point.label] += n.weight;
    totalWeight += n.weight;
  }

  let predictedLabel: ClassLabel = 0;
  let maxVote = -1;
  for (let i = 0; i < 3; i++) {
    if (votes[i] > maxVote) {
      maxVote = votes[i];
      predictedLabel = i as ClassLabel;
    }
  }

  const probabilities: [number, number, number] = totalWeight > 0
    ? [votes[0] / totalWeight, votes[1] / totalWeight, votes[2] / totalWeight]
    : [0.333, 0.333, 0.334];

  const confidence = probabilities[predictedLabel];

  return {
    predictedLabel,
    probabilities,
    neighbors,
    confidence,
  };
}

// Compute pairwise distance matrix once for ultra-fast LOOCV
export function computeCVCurve(
  points: Point2D[],
  metric: MetricType,
  p: number = 2,
  weightMode: WeightMode = 'uniform',
  maxK: number = 25
): { curve: CVCurvePoint[]; bestK: number; bestAccuracy: number } {
  const n = points.length;
  if (n < 2) {
    return { curve: [], bestK: 1, bestAccuracy: 1 };
  }

  const limitK = Math.min(maxK, n - 1);
  const distMatrix: { index: number; dist: number; label: ClassLabel }[][] = [];

  for (let i = 0; i < n; i++) {
    const row: { index: number; dist: number; label: ClassLabel }[] = [];
    for (let j = 0; j < n; j++) {
      if (i !== j) {
        row.push({
          index: j,
          dist: calculateDistance(points[i], points[j], metric, p),
          label: points[j].label,
        });
      }
    }
    row.sort((a, b) => a.dist - b.dist);
    distMatrix.push(row);
  }

  const curve: CVCurvePoint[] = [];
  let bestK = 1;
  let bestAccuracy = -1;
  const epsilon = 1e-4;

  for (let k = 1; k <= limitK; k++) {
    let correct = 0;
    for (let i = 0; i < n; i++) {
      const topNeighbors = distMatrix[i].slice(0, k);
      const votes: [number, number, number] = [0, 0, 0];
      for (const item of topNeighbors) {
        const weight = weightMode === 'inverse' ? 1.0 / (item.dist + epsilon) : 1.0;
        votes[item.label] += weight;
      }
      let pred: ClassLabel = 0;
      let maxVote = -1;
      for (let c = 0; c < 3; c++) {
        if (votes[c] > maxVote) {
          maxVote = votes[c];
          pred = c as ClassLabel;
        }
      }
      if (pred === points[i].label) {
        correct++;
      }
    }

    const accuracy = correct / n;
    const errorRate = 1 - accuracy;
    curve.push({ k, accuracy, errorRate });

    // Pick best K (prefer smaller odd K if tie)
    if (accuracy > bestAccuracy || (Math.abs(accuracy - bestAccuracy) < 1e-5 && k % 2 === 1 && bestK % 2 === 0)) {
      bestAccuracy = accuracy;
      bestK = k;
    }
  }

  return { curve, bestK, bestAccuracy };
}

// Fast Decision Boundary Grid Computation for Canvas
export function computeBoundaryGrid(
  points: Point2D[],
  k: number,
  metric: MetricType,
  p: number = 2,
  weightMode: WeightMode = 'uniform',
  resolution: number = 100
): { gridLabels: Uint8Array; confidences: Float32Array; width: number; height: number } {
  const width = resolution;
  const height = resolution;
  const total = width * height;
  const gridLabels = new Uint8Array(total);
  const confidences = new Float32Array(total);

  if (points.length === 0) {
    return { gridLabels, confidences, width, height };
  }

  const n = points.length;
  const effectiveK = Math.min(k, n);
  const epsilon = 1e-4;

  // Pre-allocate buffer for point distances
  const distBuffer = new Float32Array(n);
  const idxBuffer = new Int32Array(n);

  for (let gy = 0; gy < height; gy++) {
    const py = (gy / (height - 1)) * 100;
    const yRowOffset = gy * width;

    for (let gx = 0; gx < width; gx++) {
      const px = (gx / (width - 1)) * 100;

      // Compute distances
      for (let i = 0; i < n; i++) {
        idxBuffer[i] = i;
        const dx = Math.abs(px - points[i].x);
        const dy = Math.abs(py - points[i].y);
        if (metric === 'manhattan' || (metric === 'minkowski' && Math.abs(p - 1) < 0.01)) {
          distBuffer[i] = dx + dy;
        } else if (metric === 'chebyshev') {
          distBuffer[i] = Math.max(dx, dy);
        } else if (metric === 'euclidean' || (metric === 'minkowski' && Math.abs(p - 2) < 0.01)) {
          distBuffer[i] = Math.sqrt(dx * dx + dy * dy);
        } else {
          distBuffer[i] = Math.pow(Math.pow(dx, p) + Math.pow(dy, p), 1 / p);
        }
      }

      // Partial selection sort for top K
      for (let i = 0; i < effectiveK; i++) {
        let minIdx = i;
        let minDist = distBuffer[i];
        for (let j = i + 1; j < n; j++) {
          if (distBuffer[j] < minDist) {
            minDist = distBuffer[j];
            minIdx = j;
          }
        }
        if (minIdx !== i) {
          const tempDist = distBuffer[i];
          distBuffer[i] = distBuffer[minIdx];
          distBuffer[minIdx] = tempDist;

          const tempIndex = idxBuffer[i];
          idxBuffer[i] = idxBuffer[minIdx];
          idxBuffer[minIdx] = tempIndex;
        }
      }

      // Weighted votes
      let v0 = 0;
      let v1 = 0;
      let v2 = 0;
      let sumW = 0;

      for (let i = 0; i < effectiveK; i++) {
        const ptIdx = idxBuffer[i];
        const dist = distBuffer[i];
        const w = weightMode === 'inverse' ? 1.0 / (dist + epsilon) : 1.0;
        const lbl = points[ptIdx].label;
        if (lbl === 0) v0 += w;
        else if (lbl === 1) v1 += w;
        else v2 += w;
        sumW += w;
      }

      let chosenLabel: ClassLabel = 0;
      let maxVote = v0;
      if (v1 > maxVote) {
        maxVote = v1;
        chosenLabel = 1;
      }
      if (v2 > maxVote) {
        maxVote = v2;
        chosenLabel = 2;
      }

      const pixelIdx = yRowOffset + gx;
      gridLabels[pixelIdx] = chosenLabel;
      confidences[pixelIdx] = sumW > 0 ? maxVote / sumW : 1.0;
    }
  }

  return { gridLabels, confidences, width, height };
}

// KD-Tree Construction & Simulation
export function buildKDTree(
  points: Point2D[],
  depth: number = 0,
  box: [number, number, number, number] = [0, 100, 0, 100]
): KDNode | null {
  if (points.length === 0) return null;

  const axis = (depth % 2) as 0 | 1;
  const sorted = [...points].sort((a, b) => (axis === 0 ? a.x - b.x : a.y - b.y));
  const medianIdx = Math.floor(sorted.length / 2);
  const medianPoint = sorted[medianIdx];
  const splitValue = axis === 0 ? medianPoint.x : medianPoint.y;

  const leftPoints = sorted.slice(0, medianIdx);
  const rightPoints = sorted.slice(medianIdx + 1);

  const leftBox: [number, number, number, number] =
    axis === 0
      ? [box[0], splitValue, box[2], box[3]]
      : [box[0], box[1], box[2], splitValue];

  const rightBox: [number, number, number, number] =
    axis === 0
      ? [splitValue, box[1], box[2], box[3]]
      : [box[0], box[1], splitValue, box[3]];

  return {
    id: `kd-${depth}-${medianPoint.id}`,
    point: medianPoint,
    axis,
    splitValue,
    depth,
    box,
    left: buildKDTree(leftPoints, depth + 1, leftBox),
    right: buildKDTree(rightPoints, depth + 1, rightBox),
  };
}

export function simulateKDTreeNearestNeighbor(
  root: KDNode | null,
  query: { x: number; y: number },
  metric: MetricType = 'euclidean'
): KDStep[] {
  const steps: KDStep[] = [];
  if (!root) return steps;

  let bestPointSoFar: Point2D | null = null;
  let bestDistSoFar = Infinity;

  function search(node: KDNode | null) {
    if (!node) return;

    // Visit node
    const curDist = calculateDistance(query, node.point, metric, 2);
    if (curDist < bestDistSoFar) {
      bestDistSoFar = curDist;
      bestPointSoFar = node.point;
      steps.push({
        stepIndex: steps.length + 1,
        action: 'candidate_updated',
        nodeId: node.id,
        axis: node.axis,
        currentNode: node.point,
        description: `访问节点 (${node.point.x.toFixed(1)}, ${node.point.y.toFixed(1)})，当前测得更近距离 d = ${curDist.toFixed(2)}，更新最优候选点`,
        bestDistSoFar,
        bestPointSoFar,
      });
    } else {
      steps.push({
        stepIndex: steps.length + 1,
        action: 'visit',
        nodeId: node.id,
        axis: node.axis,
        currentNode: node.point,
        description: `遍历节点 (${node.point.x.toFixed(1)}, ${node.point.y.toFixed(1)})，距查询点 d = ${curDist.toFixed(2)} (未打破当前最小距离 ${bestDistSoFar.toFixed(2)})`,
        bestDistSoFar,
        bestPointSoFar,
      });
    }

    const queryVal = node.axis === 0 ? query.x : query.y;
    const splitVal = node.splitValue;
    const goLeftFirst = queryVal < splitVal;

    const nearChild = goLeftFirst ? node.left : node.right;
    const farChild = goLeftFirst ? node.right : node.left;

    // First search the half that contains the query point
    if (nearChild) {
      search(nearChild);
    } else {
      steps.push({
        stepIndex: steps.length + 1,
        action: 'leaf_found',
        nodeId: node.id,
        axis: node.axis,
        currentNode: node.point,
        description: `下沉至空间局部叶子区域，准备开始自底向上回溯剪枝 (Backtracking)`,
        bestDistSoFar,
        bestPointSoFar,
      });
    }

    // Check if the other child space needs to be visited
    // Hyperplane distance is perpendicular coordinate difference
    const planeDist = Math.abs(queryVal - splitVal);

    steps.push({
      stepIndex: steps.length + 1,
      action: 'check_hyperplane',
      nodeId: node.id,
      axis: node.axis,
      currentNode: node.point,
      description: `回溯检验分割轴 (${node.axis === 0 ? 'X轴' : 'Y轴'} = ${splitVal.toFixed(1)})：轴向垂距 |${queryVal.toFixed(1)} - ${splitVal.toFixed(1)}| = ${planeDist.toFixed(2)}，与当前超球半径 r = ${bestDistSoFar.toFixed(2)} 进行比较`,
      bestDistSoFar,
      bestPointSoFar,
    });

    if (planeDist < bestDistSoFar) {
      if (farChild) {
        steps.push({
          stepIndex: steps.length + 1,
          action: 'cross_subspace',
          nodeId: farChild.id,
          axis: node.axis,
          currentNode: farChild.point,
          description: `⚠️ 超球面跨越了分割线 (${planeDist.toFixed(2)} < ${bestDistSoFar.toFixed(2)})！另一侧子空间可能存在更近邻样本，不可剪枝，深入对侧分支探索`,
          bestDistSoFar,
          bestPointSoFar,
        });
        search(farChild);
      }
    } else {
      steps.push({
        stepIndex: steps.length + 1,
        action: 'branch_pruned',
        nodeId: node.id,
        axis: node.axis,
        currentNode: node.point,
        description: `✂️ 剪枝触发！轴向垂距 (${planeDist.toFixed(2)}) ≥ 当前最小半径 (${bestDistSoFar.toFixed(2)})，另一侧整个空间绝不可能存在更优解，跳过整棵对侧子树搜索`,
        bestDistSoFar,
        bestPointSoFar,
      });
    }
  }

  search(root);
  return steps;
}

// 4 Classic Datasets Generation
export function getPresetDatasets(): DatasetPreset[] {
  // Case 1: Multi-modal Gaussian Clusters
  const clusterPoints: Point2D[] = [];
  const makeGaussian = (cx: number, cy: number, std: number, count: number, label: ClassLabel, prefix: string) => {
    for (let i = 0; i < count; i++) {
      const u1 = Math.random();
      const u2 = Math.random();
      const z0 = Math.sqrt(-2.0 * Math.log(u1 || 0.001)) * Math.cos(2.0 * Math.PI * u2);
      const z1 = Math.sqrt(-2.0 * Math.log(u1 || 0.001)) * Math.sin(2.0 * Math.PI * u2);
      const x = Math.min(95, Math.max(5, cx + z0 * std));
      const y = Math.min(95, Math.max(5, cy + z1 * std));
      clusterPoints.push({ id: `${prefix}-${i}`, x, y, label });
    }
  };
  makeGaussian(30, 35, 7, 24, 0, 'c0');
  makeGaussian(70, 40, 8, 24, 1, 'c1');
  makeGaussian(48, 75, 7, 24, 2, 'c2');

  // Case 2: Intertwined Spirals
  const spiralPoints: Point2D[] = [];
  const nPerSpiral = 42;
  for (let i = 0; i < nPerSpiral; i++) {
    const t = (i / nPerSpiral) * 3.4 * Math.PI;
    const r = 5 + (i / nPerSpiral) * 36;
    const noiseX = (Math.random() - 0.5) * 2.5;
    const noiseY = (Math.random() - 0.5) * 2.5;

    // Spiral 1 (Label 0)
    const x1 = 50 + r * Math.cos(t) + noiseX;
    const y1 = 50 + r * Math.sin(t) + noiseY;
    spiralPoints.push({
      id: `sp0-${i}`,
      x: Math.min(96, Math.max(4, x1)),
      y: Math.min(96, Math.max(4, y1)),
      label: 0,
    });

    // Spiral 2 (Label 1) - phase shifted by PI
    const x2 = 50 + r * Math.cos(t + Math.PI) + noiseX;
    const y2 = 50 + r * Math.sin(t + Math.PI) + noiseY;
    spiralPoints.push({
      id: `sp1-${i}`,
      x: Math.min(96, Math.max(4, x2)),
      y: Math.min(96, Math.max(4, y2)),
      label: 1,
    });
  }

  // Case 3: MNIST UMAP 2D Manifold Projection
  // Simulates realistic digit manifold clusters of '0', '1', '7'
  const mnistPoints: Point2D[] = [];
  // Digit '0' (Round, label 0, around center-left)
  for (let i = 0; i < 28; i++) {
    const angle = (i / 28) * 2 * Math.PI;
    const r = 12 + (Math.random() - 0.5) * 4;
    mnistPoints.push({
      id: `mnist0-${i}`,
      x: 32 + r * Math.cos(angle) + (Math.random() - 0.5) * 2,
      y: 48 + (r * 1.3) * Math.sin(angle) + (Math.random() - 0.5) * 2,
      label: 0,
    });
  }
  // Digit '1' (Vertical sharp cluster, label 1, around right)
  for (let i = 0; i < 28; i++) {
    const ratio = i / 28;
    mnistPoints.push({
      id: `mnist1-${i}`,
      x: 75 + (ratio * 4 - 2) + (Math.random() - 0.5) * 3,
      y: 20 + ratio * 58 + (Math.random() - 0.5) * 2,
      label: 1,
    });
  }
  // Digit '7' (Top bar + diagonal tail, label 2, center-top)
  for (let i = 0; i < 28; i++) {
    const isBar = i < 12;
    if (isBar) {
      mnistPoints.push({
        id: `mnist7-${i}`,
        x: 44 + (i / 12) * 22 + (Math.random() - 0.5) * 2,
        y: 80 + (Math.random() - 0.5) * 2,
        label: 2,
      });
    } else {
      const tailRatio = (i - 12) / 16;
      mnistPoints.push({
        id: `mnist7-${i}`,
        x: 64 - tailRatio * 16 + (Math.random() - 0.5) * 3,
        y: 78 - tailRatio * 38 + (Math.random() - 0.5) * 3,
        label: 2,
      });
    }
  }

  // Case 4: Outliers & Density Anomaly Detection
  const anomalyPoints: Point2D[] = [];
  // Dense core of Class 0
  for (let i = 0; i < 35; i++) {
    anomalyPoints.push({
      id: `core0-${i}`,
      x: 35 + (Math.random() - 0.5) * 20,
      y: 40 + (Math.random() - 0.5) * 20,
      label: 0,
    });
  }
  // Dense core of Class 1
  for (let i = 0; i < 35; i++) {
    anomalyPoints.push({
      id: `core1-${i}`,
      x: 68 + (Math.random() - 0.5) * 22,
      y: 65 + (Math.random() - 0.5) * 22,
      label: 1,
    });
  }
  // Noisy Outliers deep inside other class territory (Demonstrating K=1 noise capture vs Large K smoothing)
  anomalyPoints.push(
    { id: 'outlier-0-in-1', x: 67, y: 64, label: 0 },
    { id: 'outlier-1-in-0', x: 36, y: 39, label: 1 },
    { id: 'outlier-2-corner', x: 88, y: 15, label: 2 },
    { id: 'outlier-2-edge', x: 12, y: 88, label: 2 },
    { id: 'outlier-2-center', x: 52, y: 52, label: 2 }
  );

  return [
    {
      id: 'clusters',
      name: '2D 自由绘制与几何多簇',
      subtitle: '高斯三元分布，验证欧氏度量与几何圆弧边界',
      description: '经典的三个各向同性团簇，测试基础分类边界的平滑性与近邻感受野。',
      category: 'geometry',
      points: clusterPoints,
      recommendedK: 5,
      recommendedMetric: 'euclidean',
      recommendedP: 2,
    },
    {
      id: 'spirals',
      name: '双螺旋交叉流行数据',
      subtitle: '高度非线性拓扑，检验局部感受野与小K值解析力',
      description: '双螺旋是线性不可分的终极基准。KNN 凭借无参数局部近邻特性能够优雅包裹复杂卷曲流形。',
      category: 'manifold',
      points: spiralPoints,
      recommendedK: 3,
      recommendedMetric: 'euclidean',
      recommendedP: 2,
    },
    {
      id: 'mnist_umap',
      name: '手写数字低维投影 (MNIST UMAP)',
      subtitle: '手写数字 0、1、7 真实流形在二维平面的拓扑表征',
      description: '模拟高维图像降维后的几何分布：包含闭合环状(0)、竖线紧凑流形(1)及折角交叉结构(7)。',
      category: 'real_world',
      points: mnistPoints,
      recommendedK: 7,
      recommendedMetric: 'manhattan',
      recommendedP: 1,
    },
    {
      id: 'anomalies',
      name: '离群点与密度异常检测',
      subtitle: '噪声孤立点嵌入，直观展示 K=1 局部过拟合与平滑平原',
      description: '两主密集核心中嵌入了异类噪点。调节 K 值可鲜明观察到噪点从强行分割形成孤岛到被群体抹平的物理过程。',
      category: 'anomaly',
      points: anomalyPoints,
      recommendedK: 7,
      recommendedMetric: 'euclidean',
      recommendedP: 2,
    },
  ];
}
