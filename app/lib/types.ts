export interface HskWord {
  id: string;
  character: string;
  pinyin: string;
  meaning: string;
  hskLevel: number;
  frequency: number;
}

export interface FrequencyBucket {
  rangeLabel: string;
  min: number;
  max: number;
  hskCount: number;
  trackedCount: number;
}

export interface FrequencyStats {
  buckets: FrequencyBucket[];
  topNTotal: number;
  topNTracked: number;
  coveragePercent: number;
}

export interface TrackedWords {
  tracked: string[];
}

export interface WordWithTracking extends HskWord {
  isTracked: boolean;
}
