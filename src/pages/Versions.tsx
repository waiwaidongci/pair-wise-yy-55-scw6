import { useEffect } from 'react'
import { Alert, Button, Card, Modal, Space, Tabs, Tag, Timeline } from 'antd'
import { CheckOutlined, CloseOutlined, CommentOutlined, LockOutlined } from '@ant-design/icons'
import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootState } from '../store'
import { clearLockError, lockBaseline, resolveComment, resolveConflict } from '../store'
import { SCORE_VOLUME } from '../reflow'

export default function Versions() {
  const dispatch = useDispatch<AppDispatch>()
  const { versions, comments, tracks, conflicts, baselines, lockedBaselineId, lockError } = useSelector((state: RootState) => state.score)
  const trackName = (trackId: string) => trackId === SCORE_VOLUME ? '总谱册' : tracks.find((item) => item.id === trackId)?.name ?? trackId

  useEffect(() => {
    if (!lockError) return
    Modal.error({
      title: '已挡住出版基线锁定',
      content: <div><p>以下换页前缺少同声部提示，请先补齐：</p><ul>{lockError.map((item) => <li key={item}>{item}</li>)}</ul></div>,
      onOk: () => dispatch(clearLockError()),
      afterClose: () => dispatch(clearLockError()),
    })
  }, [lockError, dispatch])

  const pendingConflicts = conflicts.filter((item) => item.status === 'pending')
  return <main className="page">
    <div className="page-head"><div><p className="eyebrow">版本、评论与出版基线</p><h1>差异比较与审阅</h1><p>总谱、分谱与出版基线共用同一重排流程；锁定前逐册核对换页提示。</p></div><Button type="primary" icon={<LockOutlined />} onClick={() => dispatch(lockBaseline())}>锁定出版基线</Button></div>
    <Tabs items={[
      { key: 'diff', label: '版本差异', children: <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:16}}>{versions.slice(0,2).map((version)=><Card key={version.id} title={<span>{version.id} · {version.author} <Tag>{version.time}</Tag></span>}><p>{version.summary}</p>{Object.entries(version.trackNotes).map(([trackId,notes])=><div className="diff-row" key={trackId}><Tag color="red">修改</Tag><span>{trackName(trackId)} 声部更新</span><b>{notes.length} 个音符</b></div>)}</Card>)}</div> },
      { key: 'conflicts', label: `保存冲突 (${pendingConflicts.length})`, children: <Card>{conflicts.length === 0 && <Alert type="success" showIcon message="暂无冲突" description="两人同时保存同一声部时，先到者成为基线，晚到改动会另存在这里。" />}{conflicts.map((conflict)=><div className="diff-row" key={conflict.id}><Tag color={conflict.status === 'pending' ? 'orange' : conflict.status === 'accepted' ? 'green' : 'default'}>{conflict.status === 'pending' ? '待处理' : conflict.status === 'accepted' ? '已合并' : '已丢弃'}</Tag><span><b>{trackName(conflict.trackId)}</b> · {conflict.author} 基于 r{conflict.baseRevision} 保存时基线已到 r{conflict.currentRevision}（先到版本 {conflict.winnerVersionId || '—'}），晚到改动已另存 · {conflict.time}</span>{conflict.status === 'pending' ? <Space><Button size="small" type="primary" icon={<CheckOutlined />} onClick={()=>dispatch(resolveConflict({ id: conflict.id, decision: 'accept' }))}>接受合并</Button><Button size="small" danger icon={<CloseOutlined />} onClick={()=>dispatch(resolveConflict({ id: conflict.id, decision: 'discard' }))}>丢弃</Button></Space> : <b>{conflict.notes.length} 音</b>}</div>)}</Card> },
      { key: 'comments', label: `评论锚点 (${comments.filter((item)=>!item.resolved).length})`, children: <div style={{display:'grid',gridTemplateColumns:'1.3fr .7fr',gap:16}}><Card>{comments.map((comment)=><div key={comment.id} style={{display:'grid',gridTemplateColumns:'150px 1fr auto',gap:12,padding:'14px 0',borderBottom:'1px solid #edf0f5'}}><span><Tag icon={<CommentOutlined />}>{trackName(comment.trackId)}</Tag><Tag>第 {comment.measure} 小节</Tag></span><div><b>{comment.author}</b><p>{comment.content}</p></div><div>{comment.resolved ? <Tag color="green">已解决</Tag> : <Button size="small" onClick={()=>dispatch(resolveComment(comment.id))}>应用评论</Button>}</div></div>)}</Card><Card title="待决事项"><Alert type="warning" showIcon message="总谱变更会让关联评论退回复核" description="声部被修改后，该声部已解决的评论会重新打开，需再次确认后方可锁定。" /></Card></div> },
      { key: 'baselines', label: `出版基线 (${baselines.length})`, children: <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:16}}>{baselines.map((baseline)=><Card key={baseline.id} title={<span>{baseline.id} · {baseline.author} <Tag>{baseline.time}</Tag>{baseline.id === lockedBaselineId && <Tag color="geekblue">当前基线</Tag>}</span>}>{Object.values(baseline.layouts).map((layout)=><div className="diff-row" key={layout.volumeKey}><Tag color={layout.volumeKey === SCORE_VOLUME ? 'purple' : 'blue'}>{trackName(layout.volumeKey)}</Tag><span>{layout.measureCount} 小节 · {layout.pages.length} 页 · {layout.breaks.length} 处换页</span><b>{layout.missingCues.length ? `缺 ${layout.missingCues.length} 处提示` : '提示齐全'}</b></div>)}</Card>)}</div> },
      { key: 'timeline', label: '操作历史', children: <Card><Timeline items={[{color:'green',children:'16:28 沈青提交 v12：调整终段和声与连音线'},{color:'blue',children:'15:40 方亦修改圆号力度，生成本地草稿'},{color:'gray',children:'14:10 发布 v11：单簧管移调分谱'}]} /></Card> },
    ]} />
  </main>
}
