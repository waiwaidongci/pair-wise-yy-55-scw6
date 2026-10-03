import { configureStore, createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react'
import type { PublishBaseline, SaveConflict, ScoreComment, ScoreNote, ScoreVersion, Track, VolumeLayout } from './types'
import { SCORE_VOLUME, describeBreak, reflowPart, reflowScore, splitMeasures } from './reflow'
import { buildSeedBaseline, seedComments, seedRevisions, seedTracks, seedVersions } from './mock'

const DRAFT_KEY = 'yy55-score-draft'
const DRAFT_BACKUP_KEY = 'yy55-score-draft:backup'

interface DraftPayload { tracks: Track[]; comments: ScoreComment[]; editBase: Record<string, number>; savedAt: string; complete: boolean }

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T
const now = () => new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })

interface ScoreState {
  tracks: Track[]
  selectedTrackId: string
  selectedNoteIndex: number
  history: string[]
  future: string[]
  comments: ScoreComment[]
  versions: ScoreVersion[]
  dirty: boolean
  /** 每声部当前修订号：保存时先到者成为基线 */
  trackRevisions: Record<string, number>
  /** 本地编辑基于的修订号，用于发现晚到保存 */
  editBase: Record<string, number>
  /** 总谱变化后失效、待复核的分谱 */
  partStale: Record<string, boolean>
  /** 晚到改动另存的冲突 */
  conflicts: SaveConflict[]
  /** 出版基线，旧基线保留可查 */
  baselines: PublishBaseline[]
  lockedBaselineId: string | null
  /** 锁定被挡住时缺提示音的位置列表 */
  lockError: string[] | null
  saveNotice: string | null
}

const initialState: ScoreState = {
  tracks: structuredClone(seedTracks),
  selectedTrackId: 'TR-01',
  selectedNoteIndex: 2,
  history: [],
  future: [],
  comments: structuredClone(seedComments),
  versions: structuredClone(seedVersions),
  dirty: false,
  trackRevisions: { ...seedRevisions },
  editBase: {},
  partStale: Object.fromEntries(seedTracks.map((track) => [track.id, false])),
  conflicts: [],
  baselines: [buildSeedBaseline()],
  lockedBaselineId: 'PB-1',
  lockError: null,
  saveNotice: null,
}

/** 每次编辑都落一份带完整性标记的草稿，旧草稿降级为备份 */
function writeDraft(state: ScoreState) {
  const payload: DraftPayload = { tracks: clone(state.tracks), comments: clone(state.comments), editBase: clone(state.editBase), savedAt: new Date().toISOString(), complete: true }
  const previous = localStorage.getItem(DRAFT_KEY)
  if (previous) localStorage.setItem(DRAFT_BACKUP_KEY, previous)
  localStorage.setItem(DRAFT_KEY, JSON.stringify(payload))
}

function clearDrafts() { localStorage.removeItem(DRAFT_KEY); localStorage.removeItem(DRAFT_BACKUP_KEY) }

/** 读取最近一份完整草稿；主草稿损坏或缺失时回退备份 */
export function readLatestDraft(): DraftPayload | null {
  for (const key of [DRAFT_KEY, DRAFT_BACKUP_KEY]) {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) continue
      const parsed = JSON.parse(raw) as DraftPayload
      if (parsed?.complete && Array.isArray(parsed.tracks) && parsed.tracks.length > 0) return parsed
    } catch { /* 跳过损坏的草稿 */ }
  }
  return null
}

function snapshot(state: ScoreState, trackId = state.selectedTrackId) {
  state.history.push(JSON.stringify(state.tracks))
  if (state.history.length > 40) state.history.shift()
  state.future = []
  state.dirty = true
  if (!(trackId in state.editBase)) state.editBase[trackId] = state.trackRevisions[trackId] ?? 0
  writeDraft(state)
}

/** 总谱变化只让受影响分谱失效，关联评论退回复核 */
function invalidatePart(state: ScoreState, trackId: string) {
  state.partStale[trackId] = true
  state.comments.forEach((comment) => { if (comment.trackId === trackId && comment.resolved) comment.resolved = false })
}

function transposeKey(key: string, semitones: number) {
  const chromatic = ['c','c#','d','d#','e','f','f#','g','g#','a','a#','b']
  const [pitch, octaveText] = key.split('/')
  let index = chromatic.indexOf(pitch!.replace('b', '')) + semitones
  let octave = Number(octaveText)
  while (index < 0) { index += 12; octave -= 1 }
  while (index >= 12) { index -= 12; octave += 1 }
  return `${chromatic[index]}/${octave}`
}

const scoreSlice = createSlice({
  name: 'score',
  initialState,
  reducers: {
    selectTrack(state, action: PayloadAction<string>) { state.selectedTrackId = action.payload; state.selectedNoteIndex = 0 },
    selectNote(state, action: PayloadAction<number>) { state.selectedNoteIndex = action.payload },
    addNote(state) {
      snapshot(state); const track = state.tracks.find((item) => item.id === state.selectedTrackId)!; const template = track.notes[Math.min(track.notes.length - 1, state.selectedNoteIndex)]
      track.notes.splice(state.selectedNoteIndex + 1, 0, { id: `N-${Date.now()}`, key: template?.key ?? 'c/4', duration: 'q', dynamic: template?.dynamic ?? 'mf', tie: false, expression: '' }); state.selectedNoteIndex += 1
      invalidatePart(state, track.id)
    },
    removeNote(state) { snapshot(state); const track = state.tracks.find((item) => item.id === state.selectedTrackId)!; if (track.notes.length > 1) track.notes.splice(state.selectedNoteIndex, 1); state.selectedNoteIndex = Math.max(0, state.selectedNoteIndex - 1); invalidatePart(state, track.id) },
    updateNote(state, action: PayloadAction<Partial<ScoreNote>>) { snapshot(state); const track = state.tracks.find((item) => item.id === state.selectedTrackId)!; Object.assign(track.notes[state.selectedNoteIndex]!, action.payload); invalidatePart(state, track.id) },
    transposeTrack(state, action: PayloadAction<number>) { snapshot(state); const track = state.tracks.find((item) => item.id === state.selectedTrackId)!; track.notes.forEach((note) => { note.key = transposeKey(note.key, action.payload) }); track.transposition += action.payload; invalidatePart(state, track.id) },
    /** 在指定小节末尾切换同声部提示音（换页前提示） */
    toggleCue(state, action: PayloadAction<{ trackId: string; measure: number }>) {
      snapshot(state, action.payload.trackId)
      const track = state.tracks.find((item) => item.id === action.payload.trackId)!
      const measure = splitMeasures(track.notes).find((item) => item.index === action.payload.measure)
      if (!measure || !measure.notes.length) return
      const had = measure.notes.some((note) => note.cue)
      measure.notes.forEach((note) => { note.cue = false })
      if (!had) measure.notes[measure.notes.length - 1]!.cue = true
    },
    undo(state) { const previous = state.history.pop(); if (!previous) return; state.future.push(JSON.stringify(state.tracks)); state.tracks = JSON.parse(previous); state.dirty = true; writeDraft(state) },
    redo(state) { const next = state.future.pop(); if (!next) return; state.history.push(JSON.stringify(state.tracks)); state.tracks = JSON.parse(next); state.dirty = true; writeDraft(state) },
    resolveComment(state, action: PayloadAction<string>) { const comment = state.comments.find((item) => item.id === action.payload); if (comment) comment.resolved = true; state.dirty = true; writeDraft(state) },
    /** 模拟协作同事抢先保存同一声部：先到者成为基线 */
    peerSave(state, action: PayloadAction<string>) {
      const track = state.tracks.find((item) => item.id === action.payload)
      if (!track) return
      const first = track.notes[0]
      if (first) first.dynamic = first.dynamic === 'mf' ? 'mp' : 'mf'
      state.trackRevisions[track.id] = (state.trackRevisions[track.id] ?? 0) + 1
      state.partStale[track.id] = false
      state.versions.unshift({ id: `v${state.versions.length + 13}`, author: '方亦（协作）', time: now(), summary: `协作保存「${track.name}」，先到改动已成为基线`, trackNotes: { [track.id]: clone(track.notes) } })
      state.saveNotice = `同事已抢先保存「${track.name}」（修订 r${state.trackRevisions[track.id]}），你的本地改动保存时将另存为冲突`
    },
    /** 保存版本：逐声部核对修订号，先到者成为基线，晚到改动另存冲突 */
    saveVersion(state) {
      const edited = Object.entries(state.editBase)
      if (!edited.length) {
        if (!state.dirty) { state.saveNotice = '没有需要保存的修改'; return }
        state.versions.unshift({ id: `v${state.versions.length + 13}`, author: '当前用户', time: now(), summary: '处理评论与排版标记', trackNotes: {} })
        state.dirty = false; clearDrafts(); state.saveNotice = '已保存版本'
        return
      }
      const saved: string[] = []
      const conflicted: string[] = []
      const trackNotes: Record<string, ScoreNote[]> = {}
      for (const [trackId, base] of edited) {
        const track = state.tracks.find((item) => item.id === trackId)
        if (!track) continue
        const current = state.trackRevisions[trackId] ?? 0
        if (base === current) {
          state.trackRevisions[trackId] = current + 1
          trackNotes[trackId] = clone(track.notes)
          state.partStale[trackId] = false
          saved.push(track.name)
        } else {
          state.conflicts.unshift({
            id: `CF-${state.conflicts.length + 1}`,
            trackId,
            author: '当前用户',
            time: now(),
            baseRevision: base,
            currentRevision: current,
            winnerVersionId: state.versions.find((version) => version.trackNotes[trackId])?.id ?? '',
            notes: clone(track.notes),
            status: 'pending',
          })
          conflicted.push(track.name)
        }
        delete state.editBase[trackId]
      }
      if (saved.length) state.versions.unshift({ id: `v${state.versions.length + 13}`, author: '当前用户', time: now(), summary: `保存声部：${saved.join('、')}`, trackNotes })
      state.dirty = false
      clearDrafts()
      state.saveNotice = conflicted.length
        ? `${saved.length ? `已保存 ${saved.join('、')}；` : ''}${conflicted.join('、')} 已被同事抢先保存，你的改动已另存为冲突`
        : `已保存 ${saved.join('、')}，成为新基线`
    },
    /** 处理另存的冲突：接受晚到改动或丢弃回退到基线 */
    resolveConflict(state, action: PayloadAction<{ id: string; decision: 'accept' | 'discard' }>) {
      const conflict = state.conflicts.find((item) => item.id === action.payload.id)
      if (!conflict || conflict.status !== 'pending') return
      const track = state.tracks.find((item) => item.id === conflict.trackId)
      if (!track) return
      if (action.payload.decision === 'accept') {
        track.notes = clone(conflict.notes)
        state.trackRevisions[track.id] = conflict.currentRevision + 1
        state.versions.unshift({ id: `v${state.versions.length + 13}`, author: '当前用户', time: now(), summary: `合并冲突：采用晚到改动（${track.name}）`, trackNotes: { [track.id]: clone(track.notes) } })
        conflict.status = 'accepted'
        state.saveNotice = `已合并「${track.name}」的冲突改动，成为新基线`
      } else {
        const winner = state.versions.find((version) => version.id === conflict.winnerVersionId)
        if (winner?.trackNotes[track.id]) track.notes = clone(winner.trackNotes[track.id])
        conflict.status = 'discarded'
        state.saveNotice = `已丢弃「${track.name}」的冲突改动，回退到基线`
      }
      invalidatePart(state, track.id)
      state.dirty = true
      writeDraft(state)
    },
    /** 锁定出版基线：三册共用重排，换页前缺同声部提示则挡住并指出位置 */
    lockBaseline(state) {
      const tracks = clone(state.tracks) as Track[]
      const layouts: Record<string, VolumeLayout> = { [SCORE_VOLUME]: reflowScore(tracks) }
      const missing: string[] = []
      for (const track of tracks) {
        const layout = reflowPart(track)
        layouts[track.id] = layout
        layout.missingCues.forEach((item) => missing.push(describeBreak(track.name, item)))
      }
      if (missing.length) { state.lockError = missing; return }
      const baseline: PublishBaseline = {
        id: `PB-${state.baselines.length + 1}`,
        author: '当前用户',
        time: now(),
        layouts,
        trackNotes: Object.fromEntries(tracks.map((track) => [track.id, clone(track.notes)])),
        revisions: { ...state.trackRevisions },
      }
      state.baselines.unshift(baseline)
      state.lockedBaselineId = baseline.id
      state.lockError = null
      tracks.forEach((track) => { state.partStale[track.id] = false })
      state.saveNotice = `出版基线 ${baseline.id} 已锁定，各册页边界已按当前小节长度重排`
    },
    clearLockError(state) { state.lockError = null },
    clearNotice(state) { state.saveNotice = null },
    /** 锁定失败或页面崩溃后：恢复最近一份完整草稿 */
    restoreDraft(state) {
      const draft = readLatestDraft()
      if (!draft) { state.saveNotice = '没有可恢复的完整草稿'; return }
      state.tracks = draft.tracks
      state.comments = draft.comments
      state.editBase = draft.editBase ?? {}
      state.history = []
      state.future = []
      state.tracks.forEach((track) => { state.partStale[track.id] = true })
      state.dirty = true
      state.saveNotice = `已恢复最近完整草稿（保存于 ${new Date(draft.savedAt).toLocaleString('zh-CN')}），分谱请重新复核`
    },
  },
})

export const scoreApi = createApi({
  reducerPath: 'scoreApi',
  baseQuery: fakeBaseQuery(),
  endpoints: (builder) => ({
    getPublishingProfile: builder.query<{ title: string; publisher: string; pages: number; deadline: string }, void>({ queryFn: async () => ({ data: { title: '《潮汐线》室内交响作品', publisher: '云谱出版社', pages: 46, deadline: '2026-10-12' } }) }),
  }),
})

export const { selectTrack, selectNote, addNote, removeNote, updateNote, transposeTrack, toggleCue, undo, redo, resolveComment, peerSave, saveVersion, resolveConflict, lockBaseline, clearLockError, clearNotice, restoreDraft } = scoreSlice.actions
export const store = configureStore({ reducer: { score: scoreSlice.reducer, [scoreApi.reducerPath]: scoreApi.reducer }, middleware: (getDefault) => getDefault().concat(scoreApi.middleware) })
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
