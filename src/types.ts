export interface ScoreNote {
  id: string
  key: string
  duration: 'q' | 'h' | '8'
  accidental?: '#' | 'b' | 'n'
  dynamic: 'pp' | 'p' | 'mp' | 'mf' | 'f' | 'ff'
  tie: boolean
  expression: string
  /** 换页前同声部提示音标记 */
  cue?: boolean
}

export interface Track {
  id: string
  name: string
  instrument: string
  clef: 'treble' | 'bass' | 'alto'
  transposition: number
  color: string
  notes: ScoreNote[]
}

export interface ScoreComment {
  id: string
  trackId: string
  measure: number
  author: string
  content: string
  resolved: boolean
}

export interface ScoreVersion {
  id: string
  author: string
  time: string
  summary: string
  trackNotes: Record<string, ScoreNote[]>
}

/** 重排后的小节信息 */
export interface MeasureInfo {
  /** 小节号，从 1 开始 */
  index: number
  notes: ScoreNote[]
  /** 小节长度（拍） */
  beats: number
}

/** 重排后的页信息 */
export interface PageInfo {
  page: number
  startMeasure: number
  endMeasure: number
  beats: number
}

/** 换页点：afterMeasure 小节后翻页 */
export interface BreakInfo {
  page: number
  afterMeasure: number
  hasCue: boolean
}

/** 一册（总谱册 / 分谱册 / 基线册）的重排结果 */
export interface VolumeLayout {
  volumeKey: string
  pageBeats: number
  measureCount: number
  pages: PageInfo[]
  breaks: BreakInfo[]
  missingCues: BreakInfo[]
}

/** 晚到改动另存的冲突 */
export interface SaveConflict {
  id: string
  trackId: string
  author: string
  time: string
  baseRevision: number
  currentRevision: number
  winnerVersionId: string
  notes: ScoreNote[]
  status: 'pending' | 'accepted' | 'discarded'
}

/** 出版基线：锁定时刻各册重排结果与音符快照，旧基线保留可查 */
export interface PublishBaseline {
  id: string
  author: string
  time: string
  layouts: Record<string, VolumeLayout>
  trackNotes: Record<string, ScoreNote[]>
  revisions: Record<string, number>
}
