import type { BreakInfo, MeasureInfo, PageInfo, ScoreNote, Track, VolumeLayout } from './types'

/** 每小节音符数 */
export const NOTES_PER_MEASURE = 4
/** 分谱册每页容量（拍） */
export const PART_PAGE_BEATS = 10
/** 总谱册每页容量（拍），总谱多声部并行，每页小节更少 */
export const SCORE_PAGE_BEATS = 5
/** 总谱册的卷 key */
export const SCORE_VOLUME = 'SCORE'

const BEATS: Record<ScoreNote['duration'], number> = { h: 2, q: 1, '8': 0.5 }

export function noteBeats(note: ScoreNote): number {
  return BEATS[note.duration]
}

export function measureBeats(notes: ScoreNote[]): number {
  return notes.reduce((sum, note) => sum + noteBeats(note), 0)
}

/** 按当前音符切分小节并计算每小节长度 */
export function splitMeasures(notes: ScoreNote[]): MeasureInfo[] {
  const measures: MeasureInfo[] = []
  for (let start = 0; start < notes.length; start += NOTES_PER_MEASURE) {
    const slice = notes.slice(start, start + NOTES_PER_MEASURE)
    measures.push({ index: start / NOTES_PER_MEASURE + 1, notes: slice, beats: measureBeats(slice) })
  }
  return measures
}

/** 小节内是否带同声部提示音 */
export function hasSameVoiceCue(measure: MeasureInfo): boolean {
  return measure.notes.some((note) => note.cue)
}

/** 按当前小节长度把小节装入页面，容量不足即换页 */
export function reflowPages(measures: MeasureInfo[], pageBeats: number): PageInfo[] {
  const pages: PageInfo[] = []
  let start = 1
  let beats = 0
  for (const measure of measures) {
    if (beats > 0 && beats + measure.beats > pageBeats) {
      pages.push({ page: pages.length + 1, startMeasure: start, endMeasure: measure.index - 1, beats })
      start = measure.index
      beats = 0
    }
    beats += measure.beats
  }
  if (measures.length) pages.push({ page: pages.length + 1, startMeasure: start, endMeasure: measures[measures.length - 1]!.index, beats })
  return pages
}

/** 由页边界推出换页点，并核对换页前一小节是否有同声部提示 */
export function findBreaks(pages: PageInfo[], measures: MeasureInfo[]): BreakInfo[] {
  return pages.slice(0, -1).map((page) => {
    const lastMeasure = measures.find((item) => item.index === page.endMeasure)
    return { page: page.page, afterMeasure: page.endMeasure, hasCue: lastMeasure ? hasSameVoiceCue(lastMeasure) : false }
  })
}

/**
 * 共用重排流程：总谱册、分谱册、出版基线册都走这里。
 * 每次按当前小节长度重算页边界，绝不沿用旧换页提示。
 */
export function reflowVolume(volumeKey: string, measures: MeasureInfo[], pageBeats: number): VolumeLayout {
  const pages = reflowPages(measures, pageBeats)
  const breaks = findBreaks(pages, measures)
  return { volumeKey, pageBeats, measureCount: measures.length, pages, breaks, missingCues: breaks.filter((item) => !item.hasCue) }
}

/** 分谱册重排 */
export function reflowPart(track: Track): VolumeLayout {
  return reflowVolume(track.id, splitMeasures(track.notes), PART_PAGE_BEATS)
}

/** 总谱册重排：小节长度取各声部最长 */
export function reflowScore(tracks: Track[]): VolumeLayout {
  const count = Math.max(0, ...tracks.map((track) => Math.ceil(track.notes.length / NOTES_PER_MEASURE)))
  const measures: MeasureInfo[] = []
  for (let index = 1; index <= count; index += 1) {
    const beats = Math.max(0, ...tracks.map((track) => {
      const measure = splitMeasures(track.notes).find((item) => item.index === index)
      return measure ? measure.beats : 0
    }))
    measures.push({ index, notes: [], beats })
  }
  return reflowVolume(SCORE_VOLUME, measures, SCORE_PAGE_BEATS)
}

/** 换页点缺失提示的位置描述，用于挡住锁定时指出位置 */
export function describeBreak(volumeLabel: string, item: BreakInfo): string {
  return `${volumeLabel} 第 ${item.page} 页末（第 ${item.afterMeasure} 小节后换页）`
}
