export type ClassLabel = 0 | 1 | 2;

export interface Point2D {
  id: string;
  x: number; // Normalized [0, 100]
  y: number; // Normalized [0, 100]
  label: ClassLabel;
}

export type MetricType = 'euclidean' | 'manhattan' | 'chebyshev' | 'minkowski';

export type WeightMode = 'uniform' | 'inverse';

export interface KNNNeighbor {
  point: Point2D;
  distance: number;
  weight: number;
}

export interface PredictionResult {
  predictedLabel: ClassLabel;
  probabilities: [number, number, number];
  neighbors: KNNNeighbor[];
  confidence: number;
}

export interface CVCurvePoint {
  k: number;
  accuracy: number;
  errorRate: number;
}

export interface KDNode {
  id: string;
  point: Point2D;
  axis: 0 | 1; // 0 for X, 1 for Y
  splitValue: number;
  depth: number;
  left: KDNode | null;
  right: KDNode | null;
  // Bounding box [minX, maxX, minY, maxY]
  box: [number, number, number, number];
}

export interface KDStep {
  stepIndex: number;
  action: 'visit' | 'leaf_found' | 'check_hyperplane' | 'branch_pruned' | 'cross_subspace' | 'candidate_updated';
  nodeId: string;
  axis: 0 | 1;
  currentNode: Point2D;
  description: string;
  bestDistSoFar: number;
  bestPointSoFar: Point2D | null;
}

export interface DatasetPreset {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  category: 'geometry' | 'manifold' | 'real_world' | 'anomaly';
  points: Point2D[];
  recommendedK: number;
  recommendedMetric: MetricType;
  recommendedP: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}
