import { SCORE_VOLUME, reflowPart, reflowScore } from './reflow'
import type { PublishBaseline, ScoreComment, ScoreVersion, Track } from './types'

const notes = (keys: string[], cueMeasures: number[] = []) => keys.map((key, index) => ({
  id: `N-${index + 1}`,
  key,
  duration: (index % 4 === 0 ? 'h' : 'q') as 'h' | 'q',
  dynamic: (index < 2 ? 'mp' : 'mf') as 'mp' | 'mf',
  tie: index === 2,
  expression: index === 3 ? 'dolce' : '',
  // 换页前一小节末尾放置同声部提示音
  cue: cueMeasures.includes(Math.floor(index / 4) + 1) && index % 4 === 3,
}))

export const seedTracks: Track[] = [
  { id: 'TR-01', name: '长笛', instrument: 'Flute', clef: 'treble', transposition: 0, color: '#2563eb', notes: notes(['c/5','d/5','e/5','g/5','a/5','g/5','e/5','d/5','c/5','e/5','g/5','a/5']) },
  { id: 'TR-02', name: '单簧管', instrument: 'Clarinet in Bb', clef: 'treble', transposition: -2, color: '#7c3aed', notes: notes(['d/4','e/4','f/4','a/4','c/5','a/4','f/4','e/4','d/4','f/4','a/4','c/5'], [2]) },
  { id: 'TR-03', name: '圆号', instrument: 'Horn in F', clef: 'treble', transposition: -7, color: '#d97706', notes: notes(['g/3','a/3','c/4','d/4','e/4','d/4','c/4','a/3','g/3','c/4','d/4','e/4']) },
  { id: 'TR-04', name: '大提琴', instrument: 'Violoncello', clef: 'bass', transposition: 0, color: '#059669', notes: notes(['c/3','g/3','e/3','d/3','c/3','g/3','a/3','g/3','c/3','e/3','g/3','a/3']) },
]

export const seedComments: ScoreComment[] = [
  { id: 'CM-1', trackId: 'TR-03', measure: 2, author: '指挥 · 方亦', content: '圆号第 2 小节进入需再弱一级，避免覆盖大提琴主题。', resolved: false },
  { id: 'CM-2', trackId: 'TR-01', measure: 3, author: '作曲 · 沈青', content: '第 3 小节末音增加延音线，与下一小节第一拍连奏。', resolved: false },
  { id: 'CM-3', trackId: 'TR-02', measure: 6, author: '出版 · 赵晴', content: '单簧管分谱需在换页处保留 2 小节提示音。', resolved: true },
]

export const seedVersions: ScoreVersion[] = [
  { id: 'v12', author: '沈青', time: '今天 16:28', summary: '调整终段和声，补充圆号力度与连音线', trackNotes: { 'TR-03': structuredClone(seedTracks[2]!.notes) } },
  { id: 'v11', author: '方亦', time: '今天 14:10', summary: '移调单簧管分谱并调整换气标记', trackNotes: { 'TR-02': structuredClone(seedTracks[1]!.notes) } },
]

export const seedRevisions: Record<string, number> = { 'TR-01': 3, 'TR-02': 3, 'TR-03': 4, 'TR-04': 2 }

/** 旧出版基线：锁定时刻的各册重排结果，保留可查 */
export function buildSeedBaseline(): PublishBaseline {
  const layouts: PublishBaseline['layouts'] = { [SCORE_VOLUME]: reflowScore(seedTracks) }
  const trackNotes: PublishBaseline['trackNotes'] = {}
  for (const track of seedTracks) {
    layouts[track.id] = reflowPart(track)
    trackNotes[track.id] = structuredClone(track.notes)
  }
  return { id: 'PB-1', author: '出版 · 赵晴', time: '昨天 18:02', layouts, trackNotes, revisions: { ...seedRevisions } }
}
