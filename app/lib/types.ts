export interface HskWord {
  id: string;
  character: string;
  pinyin: string;
  meaning: string;
  hskLevel: number;
}

export interface TrackedWords {
  tracked: string[];
}

export interface WordWithTracking extends HskWord {
  isTracked: boolean;
}
