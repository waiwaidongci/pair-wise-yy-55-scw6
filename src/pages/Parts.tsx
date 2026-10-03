import { useMemo, useState } from 'react'
import { Alert, Button, Select, Space, Switch, Tag } from 'antd'
import { PrinterOutlined } from '@ant-design/icons'
import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootState } from '../store'
import { toggleCue } from '../store'
import { reflowPart, splitMeasures } from '../reflow'

export default function Parts() {
  const dispatch = useDispatch<AppDispatch>()
  const { tracks, partStale, trackRevisions, lockedBaselineId } = useSelector((state: RootState) => state.score)
  const [trackId, setTrackId] = useState(tracks[0]!.id)
  const [cue, setCue] = useState(true)
  const track = tracks.find((item) => item.id === trackId)!
  // 共用重排流程：每次按当前小节长度重算页边界，总谱挪动音符或移调后立即生效
  const layout = useMemo(() => reflowPart(track), [track])
  const measures = useMemo(() => splitMeasures(track.notes), [track])
  const stale = partStale[track.id]
  return <main className="page">
    <div className="page-head no-print"><div><p className="eyebrow">分谱提取与出版排版</p><h1>演奏者分谱预览</h1><p>页边界由共用重排流程按当前小节长度实时计算；换页前缺少同声部提示会挡住出版锁定。</p></div><Button type="primary" icon={<PrinterOutlined />} onClick={() => window.print()}>打印分谱</Button></div>
    <div className="panel no-print" style={{marginBottom:16}}><Space wrap><Select value={trackId} style={{width:180}} options={tracks.map((item)=>({value:item.id,label:`${item.name} · ${item.instrument}`}))} onChange={setTrackId} /><Switch checked={cue} onChange={setCue} checkedChildren="显示提示音" unCheckedChildren="隐藏提示音" /><Tag color={track.transposition ? 'purple' : 'blue'}>{track.transposition ? `移调 ${track.transposition}` : '不移调'}</Tag><Tag>修订 r{trackRevisions[track.id] ?? 0}</Tag>{stale ? <Tag color="orange">分谱已失效 · 待复核</Tag> : <Tag color="green">与总谱同步</Tag>}{lockedBaselineId && <Tag color="geekblue">基线 {lockedBaselineId}</Tag>}</Space></div>
    {stale && <Alert className="no-print" type="warning" showIcon style={{marginBottom:16}} message="总谱已变更，本分谱已失效" description="页边界与换页提示已按最新小节长度重排，请复核后重新锁定出版基线。" />}
    {layout.missingCues.length > 0 && <Alert className="no-print" type="error" showIcon style={{marginBottom:16}} message={`${layout.missingCues.length} 处换页前缺少同声部提示，已挡住出版锁定`} description={layout.missingCues.map((item)=>`第 ${item.page} 页末（第 ${item.afterMeasure} 小节后换页）`).join('；')} />}
    <article className="part-page">
      <div style={{display:'flex',justifyContent:'space-between',borderBottom:'2px solid #0f172a',paddingBottom:10}}><div><h1 style={{margin:0,fontFamily:'serif'}}>{track.name}</h1><small>{track.instrument} · 移调后记谱分谱</small></div><div style={{textAlign:'right'}}><b>《潮汐线》</b><div>沈青 作品</div><div>出版稿 {lockedBaselineId ?? '未锁定'}</div></div></div>
      {layout.pages.map((page) => {
        const pageBreak = layout.breaks.find((item) => item.page === page.page)
        return <section key={page.page}>
          <div style={{display:'flex',justifyContent:'space-between',marginTop:10}}><b>I. 潮起 · ♩ = 72</b><span>第 {page.page} 页 · 第 {page.startMeasure}–{page.endMeasure} 小节</span></div>
          {measures.filter((measure) => measure.index >= page.startMeasure && measure.index <= page.endMeasure).map((measure) => <div key={measure.index}>
            <div className="part-measure">{measure.notes.map((note)=><div key={note.id} className="part-note"><b>{note.key.replace('/', '')}</b><small style={{display:'block',color:'#64748b'}}>{note.dynamic}{note.tie ? ' ⁀' : ''}</small>{cue && note.cue && <em className="cue-badge">同声部提示</em>}</div>)}</div>
            <div className="measure-meta">第 {measure.index} 小节 · {measure.beats} 拍</div>
          </div>)}
          {pageBreak && <div className={`page-break ${pageBreak.hasCue ? 'ok' : 'missing'}`}>
            <span>换页 → 第 {pageBreak.page + 1} 页（第 {pageBreak.afterMeasure} 小节后）</span>
            {pageBreak.hasCue
              ? <Tag color="green">换页前已加同声部提示</Tag>
              : <Space><Tag color="red">缺少同声部提示</Tag><Button className="no-print" size="small" type="primary" onClick={()=>dispatch(toggleCue({ trackId: track.id, measure: pageBreak.afterMeasure }))}>在第 {pageBreak.afterMeasure} 小节末加提示音</Button></Space>}
          </div>}
        </section>
      })}
      <div style={{marginTop:30,borderTop:'1px solid #94a3b8',paddingTop:10,color:'#64748b',fontSize:11}}>© 2026 云谱出版社 · 仅限排练使用 · 禁止未授权复制</div>
    </article>
  </main>
}
