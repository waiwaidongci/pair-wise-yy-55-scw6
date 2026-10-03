import { configureStore, createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react'
import type { ConflictRecord, LayoutIssue, PageTurnCue, PartBaselineState, PartLayout, PublishingBaseline, ScoreComment, ScoreNote, ScoreVersion, Track } from './types'
import { seedComments, seedTracks, seedVersions } from './mock'
import { relayoutAll } from './relayout'

const DRAFT_KEY = 'yy55-score-draft'

interface ScoreState {
  tracks: Track[]
  selectedTrackId: string
  selectedNoteIndex: number
  history: string[]
  future: string[]
  comments: ScoreComment[]
  versions: ScoreVersion[]
  dirty: boolean
  // 共用重排流程的产物
  layouts: PartLayout[]
  cues: PageTurnCue[]
  layoutIssues: LayoutIssue[]
  // 出版基线（锁定快照，旧基线仍可查）
  baselines: PublishingBaseline[]
  // 并发保存冲突
  conflicts: ConflictRecord[]
  partBaselines: Record<string, PartBaselineState>
  // 草稿恢复
  draft: { savedAt: string; complete: boolean } | null
  recoveredDraft: boolean
  lockError: string | null
}

function nowTime() {
  return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function isoNow() {
  return new Date().toISOString()
}

function buildSeedState(): ScoreState {
  const seed = structuredClone({ tracks: seedTracks, comments: seedComments, versions: seedVersions })
  const { layouts, cues, issues } = relayoutAll(seed.tracks, [])
  return {
    tracks: seed.tracks,
    selectedTrackId: 'TR-01',
    selectedNoteIndex: 2,
    history: [],
    future: [],
    comments: seed.comments,
    versions: seed.versions,
    dirty: false,
    layouts,
    cues,
    layoutIssues: issues,
    baselines: [],
    conflicts: [],
    partBaselines: {},
    draft: null,
    recoveredDraft: false,
    lockError: null,
  }
}

function loadInitialState(): ScoreState {
  const base = buildSeedState()
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return base
    const d = JSON.parse(raw)
    base.tracks = d.tracks ?? base.tracks
    base.comments = d.comments ?? base.comments
    base.layouts = d.layouts ?? base.layouts
    base.cues = d.cues ?? base.cues
    base.layoutIssues = d.layoutIssues ?? base.layoutIssues
    base.baselines = d.baselines ?? []
    base.conflicts = d.conflicts ?? []
    base.partBaselines = d.partBaselines ?? {}
    base.draft = { savedAt: d.savedAt ?? isoNow(), complete: true }
    base.recoveredDraft = true
    base.dirty = d.dirty ?? true
    return base
  } catch {
    return base
  }
}

function snapshot(state: ScoreState) {
  state.history.push(JSON.stringify(state.tracks))
  if (state.history.length > 40) state.history.shift()
  state.future = []
  state.dirty = true
}

function saveDraft(state: ScoreState) {
  state.draft = { savedAt: isoNow(), complete: true }
  localStorage.setItem(DRAFT_KEY, JSON.stringify({
    tracks: state.tracks,
    comments: state.comments,
    layouts: state.layouts,
    cues: state.cues,
    layoutIssues: state.layoutIssues,
    baselines: state.baselines,
    conflicts: state.conflicts,
    partBaselines: state.partBaselines,
    dirty: state.dirty,
    savedAt: state.draft.savedAt,
  }))
}

function relayoutInto(state: ScoreState) {
  const { layouts, cues, issues } = relayoutAll(state.tracks, state.cues)
  state.layouts = layouts
  state.cues = cues
  state.layoutIssues = issues
}

/** 总谱改动后：共用重排流程重算所有分册页边界；仅受影响分册失效；关联评论退回复核。 */
function afterTrackChange(state: ScoreState, changedTrackId: string) {
  relayoutInto(state)
  state.layouts.forEach((l) => { if (l.partId === changedTrackId) l.stale = true })
  state.comments.forEach((c) => { if (c.partId === changedTrackId) { c.resolved = false; c.reverted = true } })
  state.dirty = true
  state.lockError = null
  saveDraft(state)
}

function transposeKey(key: string, semitones: number) {
  const chromatic = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b']
  const [pitch, octaveText] = key.split('/')
  let index = chromatic.indexOf(pitch!.replace('b', '')) + semitones
  let octave = Number(octaveText)
  while (index < 0) { index += 12; octave -= 1 }
  while (index >= 12) { index -= 12; octave += 1 }
  return `${chromatic[index]}/${octave}`
}

const scoreSlice = createSlice({
  name: 'score',
  initialState: loadInitialState(),
  reducers: {
    selectTrack(state, action: PayloadAction<string>) { state.selectedTrackId = action.payload; state.selectedNoteIndex = 0 },
    selectNote(state, action: PayloadAction<number>) { state.selectedNoteIndex = action.payload },
    addNote(state) {
      snapshot(state)
      const track = state.tracks.find((item) => item.id === state.selectedTrackId)!
      const template = track.notes[Math.min(track.notes.length - 1, state.selectedNoteIndex)]
      track.notes.splice(state.selectedNoteIndex + 1, 0, { id: `N-${Date.now()}`, key: template?.key ?? 'c/4', duration: 'q', dynamic: template?.dynamic ?? 'mf', tie: false, expression: '' })
      state.selectedNoteIndex += 1
      afterTrackChange(state, track.id)
    },
    removeNote(state) {
      snapshot(state)
      const track = state.tracks.find((item) => item.id === state.selectedTrackId)!
      if (track.notes.length > 1) track.notes.splice(state.selectedNoteIndex, 1)
      state.selectedNoteIndex = Math.max(0, state.selectedNoteIndex - 1)
      afterTrackChange(state, track.id)
    },
    updateNote(state, action: PayloadAction<Partial<ScoreNote>>) {
      snapshot(state)
      const track = state.tracks.find((item) => item.id === state.selectedTrackId)!
      Object.assign(track.notes[state.selectedNoteIndex]!, action.payload)
      afterTrackChange(state, track.id)
    },
    transposeTrack(state, action: PayloadAction<number>) {
      snapshot(state)
      const track = state.tracks.find((item) => item.id === state.selectedTrackId)!
      track.notes.forEach((note) => { note.key = transposeKey(note.key, action.payload) })
      track.transposition += action.payload
      afterTrackChange(state, track.id)
    },
    undo(state) {
      const previous = state.history.pop()
      if (!previous) return
      state.future.push(JSON.stringify(state.tracks))
      state.tracks = JSON.parse(previous)
      relayoutInto(state)
      state.dirty = true
      saveDraft(state)
    },
    redo(state) {
      const next = state.future.pop()
      if (!next) return
      state.history.push(JSON.stringify(state.tracks))
      state.tracks = JSON.parse(next)
      relayoutInto(state)
      state.dirty = true
      saveDraft(state)
    },
    resolveComment(state, action: PayloadAction<string>) {
      const comment = state.comments.find((item) => item.id === action.payload)
      if (comment) { comment.resolved = true; comment.reverted = false }
      state.dirty = true
      saveDraft(state)
    },
    saveVersion(state) {
      state.versions.unshift({ id: `v${state.versions.length + 13}`, author: '当前用户', time: nowTime(), summary: '保存当前总谱与分谱调整', trackNotes: Object.fromEntries(state.tracks.map((track) => [track.id, structuredClone(track.notes)])) })
      state.dirty = false
      saveDraft(state)
    },
    addPageTurnCue(state, action: PayloadAction<{ partId: string; afterMeasure: number }>) {
      const { partId, afterMeasure } = action.payload
      const existing = state.cues.find((c) => c.partId === partId && c.afterMeasure === afterMeasure)
      if (existing) {
        existing.confirmed = true
      } else {
        state.cues.push({
          id: `CUE-${partId}-${afterMeasure}-${Date.now()}`,
          partId,
          afterMeasure,
          cueAtMeasure: afterMeasure,
          cueMeasures: 2,
          cueSourcePartId: partId, // 同声部提示
          confirmed: true,
        })
      }
      relayoutInto(state)
      saveDraft(state)
    },
    fillAllCues(state) {
      for (const layout of state.layouts) {
        for (const turn of layout.pageTurns) {
          const existing = state.cues.find((c) => c.partId === layout.partId && c.afterMeasure === turn.afterMeasure)
          if (existing) {
            existing.confirmed = true
          } else {
            state.cues.push({
              id: `CUE-${layout.partId}-${turn.afterMeasure}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              partId: layout.partId,
              afterMeasure: turn.afterMeasure,
              cueAtMeasure: turn.afterMeasure,
              cueMeasures: 2,
              cueSourcePartId: layout.partId,
              confirmed: true,
            })
          }
        }
      }
      relayoutInto(state)
      saveDraft(state)
    },
    /** 锁定出版基线：重排后若有换页缺提示音则挡住并指出位置；否则生成基线快照。 */
    lockBaseline(state) {
      const { layouts, cues, issues } = relayoutAll(state.tracks, state.cues)
      state.layouts = layouts
      state.cues = cues
      state.layoutIssues = issues
      if (issues.length > 0) {
        state.lockError = `锁定失败：${issues.length} 处分谱换页缺少同声部提示音（${issues.map((i) => `${i.partName} 第 ${i.afterMeasure + 1} 小节后`).join('；')}）。请补充提示音后重试。`
        saveDraft(state) // 锁定失败也保留最近完整草稿
        return
      }
      state.lockError = null
      const baseline: PublishingBaseline = {
        id: `BL-${Date.now()}`,
        lockedAt: isoNow(),
        lockedBy: '当前用户',
        tracks: structuredClone(state.tracks),
        layouts: structuredClone(layouts),
        versionId: state.versions[0]?.id ?? 'v12',
        status: 'locked',
      }
      state.baselines = [baseline, ...state.baselines.map((b) => ({ ...b, status: 'superseded' as const }))]
      state.layouts.forEach((l) => { l.stale = false })
      state.dirty = false
      saveDraft(state) // 保留草稿与基线，旧出版基线仍可查
    },
    /** 分声部保存：先到者成为基线，晚到改动另存冲突。 */
    savePart(state, action: PayloadAction<{ partId: string; author: string }>) {
      const { partId, author } = action.payload
      const part = state.tracks.find((t) => t.id === partId)!
      const existing = state.partBaselines[partId]
      if (!existing || !existing.baselineVersionId) {
        state.partBaselines[partId] = { baselineVersionId: state.versions[0]?.id ?? 'v12', savedBy: author, savedAt: nowTime() }
      } else {
        const conflict: ConflictRecord = {
          id: `CF-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          partId,
          partName: part.name,
          firstComer: existing.savedBy,
          lateComer: author,
          firstAt: existing.savedAt,
          lateAt: nowTime(),
          lateChanges: structuredClone(part.notes),
          baselineVersionId: existing.baselineVersionId,
          status: 'open',
        }
        state.conflicts.unshift(conflict)
      }
      saveDraft(state)
    },
    clearPartBaseline(state, action: PayloadAction<string>) {
      delete state.partBaselines[action.payload]
      saveDraft(state)
    },
    resolveConflict(state, action: PayloadAction<string>) {
      const conflict = state.conflicts.find((c) => c.id === action.payload)
      if (conflict) conflict.status = 'resolved'
      saveDraft(state)
    },
    restoreDraft(state) {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (!raw) return
      const d = JSON.parse(raw)
      state.tracks = d.tracks ?? state.tracks
      state.comments = d.comments ?? state.comments
      state.layouts = d.layouts ?? []
      state.cues = d.cues ?? []
      state.layoutIssues = d.layoutIssues ?? []
      state.baselines = d.baselines ?? []
      state.conflicts = d.conflicts ?? []
      state.partBaselines = d.partBaselines ?? {}
      state.draft = { savedAt: d.savedAt ?? isoNow(), complete: true }
      state.recoveredDraft = true
      state.dirty = true
    },
    discardDraft() {
      localStorage.removeItem(DRAFT_KEY)
      return buildSeedState()
    },
    dismissLockError(state) {
      state.lockError = null
    },
  },
})

/** 模拟两人同时保存同一声部：先到者成为基线，晚到改动另存冲突。 */
export const simulateConcurrentSave = createAsyncThunk(
  'score/simulateConcurrentSave',
  async (partId: string, { dispatch }) => {
    dispatch(clearPartBaseline(partId))
    const authors = ['我（当前用户）', '另一作者 · 林岚']
    const order = Math.random() < 0.5 ? authors : [...authors].reverse()
    for (const author of order) {
      dispatch(savePart({ partId, author }))
      await new Promise((resolve) => setTimeout(resolve, 20 + Math.random() * 60))
    }
  },
)

export const scoreApi = createApi({
  reducerPath: 'scoreApi',
  baseQuery: fakeBaseQuery(),
  endpoints: (builder) => ({
    getPublishingProfile: builder.query<{ title: string; publisher: string; pages: number; deadline: string }, void>({ queryFn: async () => ({ data: { title: '《潮汐线》室内交响作品', publisher: '云谱出版社', pages: 46, deadline: '2026-10-12' } }) }),
  }),
})

export const {
  selectTrack, selectNote, addNote, removeNote, updateNote, transposeTrack, undo, redo, resolveComment,
  saveVersion, addPageTurnCue, fillAllCues, lockBaseline, savePart, clearPartBaseline, resolveConflict,
  restoreDraft, discardDraft, dismissLockError,
} = scoreSlice.actions

export const store = configureStore({
  reducer: { score: scoreSlice.reducer, [scoreApi.reducerPath]: scoreApi.reducer },
  middleware: (getDefault) => getDefault().concat(scoreApi.middleware),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
