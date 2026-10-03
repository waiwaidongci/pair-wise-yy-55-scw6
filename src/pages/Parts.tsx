import { useMemo, useState } from 'react'
import { Alert, Button, InputNumber, Select, Space, Switch, Tag } from 'antd'
import { PrinterOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootState } from '../store'
import { addPageTurnCue, fillAllCues, savePart, simulateConcurrentSave } from '../store'
import { computeMeasures } from '../relayout'

export default function Parts() {
  const dispatch = useDispatch<AppDispatch>()
  const tracks = useSelector((state: RootState) => state.score.tracks)
  const layouts = useSelector((state: RootState) => state.score.layouts)
  const cues = useSelector((state: RootState) => state.score.cues)
  const issues = useSelector((state: RootState) => state.score.layoutIssues)
  const partBaselines = useSelector((state: RootState) => state.score.partBaselines)
  const conflicts = useSelector((state: RootState) => state.score.conflicts)
  const [trackId, setTrackId] = useState(tracks[0]!.id)
  const [cueEnabled, setCueEnabled] = useState(true)
  const [simulating, setSimulating] = useState(false)

  const track = tracks.find((item) => item.id === trackId)!
  const layout = layouts.find((item) => item.partId === trackId)!
  const measures = useMemo(() => computeMeasures(track.notes), [track.notes])
  const partIssues = issues.filter((item) => item.partId === trackId)
  const baseline = partBaselines[trackId]
  const partConflicts = conflicts.filter((item) => item.partId === trackId && item.status === 'open')

  const runSimulate = () => {
    setSimulating(true)
    dispatch(simulateConcurrentSave(trackId)).finally(() => setSimulating(false))
  }

  return <main className="page">
    <div className="page-head no-print"><div><p className="eyebrow">分谱提取与出版排版</p><h1>演奏者分谱预览</h1><p>总谱、分谱与出版基线共用重排流程：按当前小节长度重排页边界，换页前必须有同声部提示音。</p></div><Button type="primary" icon={<PrinterOutlined />} onClick={() => window.print()}>打印分谱</Button></div>

    <div className="panel no-print" style={{ marginBottom: 16 }}>
      <Space wrap>
        <Select value={trackId} style={{ width: 180 }} options={tracks.map((item) => ({ value: item.id, label: `${item.name} · ${item.instrument}` }))} onChange={setTrackId} />
        <span>每页容量：</span><InputNumber min={1} max={20} defaultValue={8} disabled />
        <span>显示提示音：</span><Switch checked={cueEnabled} onChange={setCueEnabled} checkedChildren="显示" unCheckedChildren="隐藏" />
        <Tag color={track.transposition ? 'purple' : 'blue'}>{track.transposition ? `移调 ${track.transposition > 0 ? '+' : ''}${track.transposition}` : '不移调'}</Tag>
        {layout.stale && <Tag color="red">总谱已变 · 分册已失效待重排</Tag>}
      </Space>
    </div>

    {issues.length > 0 && (
      <Alert
        type="error"
        showIcon
        style={{ marginBottom: 16 }}
        message={`${issues.length} 处分谱换页缺少同声部提示音，出版锁定将被挡住`}
        description={
          <div>
            {issues.map((issue) => (
              <div key={issue.id} style={{ marginBottom: 4 }}>
                · <b>{issue.partName}</b>：第 {issue.afterMeasure + 1} 小节后换页缺少同声部提示音
                <Button size="small" type="link" onClick={() => dispatch(addPageTurnCue({ partId: issue.partId, afterMeasure: issue.afterMeasure }))}>补充提示音</Button>
              </div>
            ))}
            <Button size="small" type="primary" ghost icon={<ThunderboltOutlined />} onClick={() => dispatch(fillAllCues())}>一键补充全部提示音</Button>
          </div>
        }
      />
    )}

    <div className="part-pages">
      {layout.pages.map((page, pageIndex) => {
        const pageMeasures = measures.slice(page.startMeasure, page.endMeasure + 1)
        const turn = layout.pageTurns.find((item) => item.afterMeasure === page.endMeasure)
        const cue = turn ? cues.find((item) => item.partId === trackId && item.afterMeasure === page.endMeasure && item.confirmed) : undefined
        const issue = partIssues.find((item) => item.afterMeasure === page.endMeasure)
        return (
          <div key={page.pageIndex}>
            <article className="part-page">
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0f172a', paddingBottom: 10 }}>
                <div><h1 style={{ margin: 0, fontFamily: 'serif' }}>{track.name}</h1><small>{track.instrument} · 移调后记谱分谱</small></div>
                <div style={{ textAlign: 'right' }}><b>《潮汐线》</b><div>沈青 作品</div><div>出版稿 v12</div></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}><b>I. 潮起 · ♩ = 72</b><span>第 {pageIndex + 1} 页 / 共 {layout.pages.length} 页</span></div>
              <div className="part-measures">
                {pageMeasures.map((measure) => (
                  <div key={measure.index} className="part-measure">
                    <div className="measure-num">第 {measure.index + 1} 小节</div>
                    <div className="part-note-row">
                      {measure.notes.map((note) => (
                        <div key={note.id} className="part-note"><b>{note.key.replace('/', '')}</b><small style={{ display: 'block', color: '#64748b' }}>{note.dynamic}{note.tie ? ' ⁀' : ''}</small></div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 30, borderTop: '1px solid #94a3b8', paddingTop: 10, color: '#64748b', fontSize: 11 }}>© 2026 云谱出版社 · 仅限排练使用 · 禁止未授权复制</div>
            </article>
            {pageIndex < layout.pages.length - 1 && (
              <div className="page-turn">
                <div className="page-turn-line" />
                <div className="page-turn-body">
                  {cue && cueEnabled ? (
                    <Tag color="blue">同声部提示音 · 第 {cue.cueAtMeasure + 1} 小节起 {cue.cueMeasures} 小节 · 已确认</Tag>
                  ) : (
                    <span>
                      <Tag color="red">第 {page.endMeasure + 1} 小节后换页 · 缺少同声部提示音</Tag>
                      <Button size="small" type="link" onClick={() => dispatch(addPageTurnCue({ partId: trackId, afterMeasure: page.endMeasure }))}>补充提示音</Button>
                    </span>
                  )}
                </div>
                <div className="page-turn-line" />
              </div>
            )}
          </div>
        )
      })}
    </div>

    <div className="panel no-print" style={{ marginTop: 16 }}>
      <h3>分谱基线与并发保存</h3>
      <Space wrap align="center">
        {baseline?.baselineVersionId
          ? <Tag color="green">已成为基线 · {baseline.savedBy} 于 {baseline.savedAt}</Tag>
          : <Tag>尚未保存基线</Tag>}
        <Button onClick={() => dispatch(savePart({ partId: trackId, author: '我（当前用户）' }))}>保存本分谱为基线</Button>
        <Button loading={simulating} onClick={runSimulate}>模拟两人同时保存同一声部</Button>
      </Space>
      {partConflicts.length > 0 && (
        <Alert
          style={{ marginTop: 12 }}
          type="warning"
          showIcon
          message={`${partConflicts.length} 份晚到改动已另存为冲突（先到者成为基线）`}
          description={partConflicts.map((conflict) => (
            <div key={conflict.id}>· 先到：{conflict.firstComer}（{conflict.firstAt}）；晚到：{conflict.lateComer}（{conflict.lateAt}）· {conflict.lateChanges.length} 音</div>
          ))}
        />
      )}
    </div>
  </main>
}
