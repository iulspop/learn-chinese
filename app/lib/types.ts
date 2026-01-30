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
  totalWords: number;
  totalTracked: number;
  topNTotal: number;
  topNTracked: number;
  coveragePercent: number;
  levelWords?: number;
  levelTracked?: number;
}

export interface TrackedWords {
  tracked: string[];
}

export interface WordIndexEntry {
  simplified: string;
  pinyin: string;
  meaning: string;
  partOfSpeech: string;
  audio: string;
  sentence: string;
  sentencePinyin: string;
  sentenceMeaning: string;
  sentenceAudio: string;
  sentenceImage: string;
  source: string;
}

export interface WordWithTracking extends HskWord {
  isTracked: boolean;
}
