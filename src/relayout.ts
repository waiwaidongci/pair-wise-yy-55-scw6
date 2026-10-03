import type { LayoutIssue, PageTurnCue, PartLayout, PartPage, ScoreNote, Track } from './types'

// 共用重排流程：总谱、分谱、出版基线都走同一套小节划分与分页逻辑。
// 每册按当前小节长度（时值总和）重排页边界，音符挪动或移调后小节长度变化，页边界随之移动。

export const BEATS_PER_MEASURE = 4 // 4/4 拍
export const BEATS_PER_PAGE = 8 // 演示用每页容量：2 小节（4/4），让换页在小样中可见

const DUR_BEATS: Record<string, number> = { h: 2, q: 1, '8': 0.5 }

export interface Measure {
  index: number
  startNoteIndex: number
  notes: ScoreNote[]
  beats: number
}

export function noteBeats(note: ScoreNote): number {
  return DUR_BEATS[note.duration] ?? 1
}

/** 按当前音符时值划分小节（4/4），替代写死的 4 音一组。 */
export function computeMeasures(notes: ScoreNote[]): Measure[] {
  const measures: Measure[] = []
  let current: Measure = { index: 0, startNoteIndex: 0, notes: [], beats: 0 }
  notes.forEach((note, i) => {
    const beats = noteBeats(note)
    if (current.beats + beats > BEATS_PER_MEASURE && current.notes.length > 0) {
      measures.push(current)
      current = { index: measures.length, startNoteIndex: i, notes: [], beats: 0 }
    }
    current.notes.push(note)
    current.beats += beats
  })
  if (current.notes.length > 0) measures.push(current)
  return measures
}

/** 按当前小节长度分页：累计时值超过一页容量即换页。 */
export function paginateMeasures(measures: Measure[], beatsPerPage: number = BEATS_PER_PAGE): PartPage[] {
  const pages: PartPage[] = []
  let pageStart = 0
  let pageBeats = 0
  measures.forEach((m, i) => {
    if (pageBeats + m.beats > beatsPerPage && i > pageStart) {
      pages.push(buildPage(pages.length, pageStart, i - 1, measures))
      pageStart = i
      pageBeats = 0
    }
    pageBeats += m.beats
  })
  if (pageStart < measures.length) pages.push(buildPage(pages.length, pageStart, measures.length - 1, measures))
  return pages
}

function buildPage(pageIndex: number, startMeasure: number, endMeasure: number, measures: Measure[]): PartPage {
  const startNoteIndex = measures[startMeasure]!.startNoteIndex
  const endNoteIndex = measures[endMeasure]!.startNoteIndex + measures[endMeasure]!.notes.length - 1
  return { pageIndex, startMeasure, endMeasure, startNoteIndex, endNoteIndex }
}

/**
 * 共用重排：对每个声部分册重新划分小节、分页、识别换页并核对同声部提示音。
 * 旧提示音只在「同一声部 + 同一换页位置」时沿用；页边界移动后旧提示音失效，记为缺少提示音。
 */
export function relayoutAll(tracks: Track[], prevCues: PageTurnCue[]): { layouts: PartLayout[]; cues: PageTurnCue[]; issues: LayoutIssue[] } {
  const layouts: PartLayout[] = []
  const cues: PageTurnCue[] = []
  const issues: LayoutIssue[] = []
  for (const track of tracks) {
    const measures = computeMeasures(track.notes)
    const pages = paginateMeasures(measures)
    const pageTurns: PartLayout['pageTurns'] = []
    for (let i = 0; i < pages.length - 1; i++) {
      const afterMeasure = pages[i]!.endMeasure
      const existing = prevCues.find((c) => c.partId === track.id && c.afterMeasure === afterMeasure && c.confirmed)
      if (existing) {
        cues.push(existing)
        pageTurns.push({ afterMeasure, cueId: existing.id })
      } else {
        pageTurns.push({ afterMeasure, cueId: null })
        issues.push({
          id: `ISS-${track.id}-${afterMeasure}`,
          partId: track.id,
          partName: track.name,
          afterMeasure,
          reason: `第 ${afterMeasure + 1} 小节后换页，但缺少同声部提示音`,
          blocking: true,
        })
      }
    }
    layouts.push({ partId: track.id, pages, pageTurns, stale: false })
  }
  return { layouts, cues, issues }
}
