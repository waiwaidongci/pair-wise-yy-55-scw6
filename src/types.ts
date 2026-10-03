export interface ScoreNote {
  id: string
  key: string
  duration: 'q' | 'h' | '8'
  accidental?: '#' | 'b' | 'n'
  dynamic: 'pp' | 'p' | 'mp' | 'mf' | 'f' | 'ff'
  tie: boolean
  expression: string
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
  measure: number
  partId?: string
  author: string
  content: string
  resolved: boolean
  /** 总谱改动后关联评论退回复核 */
  reverted?: boolean
}

export interface ScoreVersion {
  id: string
  author: string
  time: string
  summary: string
  trackNotes: Record<string, ScoreNote[]>
}

/** 分册页边界（按当前小节长度重排得出） */
export interface PartPage {
  pageIndex: number
  startMeasure: number
  endMeasure: number
  startNoteIndex: number
  endNoteIndex: number
}

/** 同声部提示音：锚定到本分谱、位于换页处，换页前必须确认 */
export interface PageTurnCue {
  id: string
  partId: string
  afterMeasure: number
  cueAtMeasure: number
  cueMeasures: number
  cueSourcePartId: string
  confirmed: boolean
}

/** 分册重排结果 */
export interface PartLayout {
  partId: string
  pages: PartPage[]
  pageTurns: { afterMeasure: number; cueId: string | null }[]
  /** 总谱变化后仅受影响分册失效 */
  stale: boolean
}

/** 重排发现的问题：挡住锁定并指出位置 */
export interface LayoutIssue {
  id: string
  partId: string
  partName: string
  afterMeasure: number
  reason: string
  blocking: boolean
}

/** 出版基线（锁定快照，旧基线仍可查） */
export interface PublishingBaseline {
  id: string
  lockedAt: string
  lockedBy: string
  tracks: Track[]
  layouts: PartLayout[]
  versionId: string
  status: 'locked' | 'superseded'
}

/** 两人同时保存同一声部：先到者成为基线，晚到改动另存冲突 */
export interface ConflictRecord {
  id: string
  partId: string
  partName: string
  firstComer: string
  lateComer: string
  firstAt: string
  lateAt: string
  lateChanges: ScoreNote[]
  baselineVersionId: string
  status: 'open' | 'resolved'
}

/** 分声部保存基线（先到者得） */
export interface PartBaselineState {
  baselineVersionId: string | null
  savedBy: string
  savedAt: string
}
