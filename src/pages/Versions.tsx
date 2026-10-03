import { Alert, Button, Card, Tag, Tabs, Timeline } from 'antd'
import { CheckOutlined, CloseOutlined, CommentOutlined, LockOutlined } from '@ant-design/icons'
import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootState } from '../store'
import { dismissLockError, lockBaseline, resolveComment, resolveConflict } from '../store'

export default function Versions() {
  const dispatch = useDispatch<AppDispatch>()
  const { versions, comments, baselines, conflicts, lockError, tracks } = useSelector((state: RootState) => state.score)
  const openComments = comments.filter((item) => !item.resolved)
  const openConflicts = conflicts.filter((item) => item.status === 'open')

  return <main className="page">
    <div className="page-head">
      <div><p className="eyebrow">版本、评论与出版基线</p><h1>差异比较与审阅</h1><p>总谱、分谱与出版基线共用重排流程；锁定前核对换页提示音，旧出版基线仍可查。</p></div>
      <Button type="primary" icon={<LockOutlined />} onClick={() => dispatch(lockBaseline())}>锁定出版基线</Button>
    </div>

    {lockError && (
      <Alert
        type="error"
        showIcon
        style={{ marginBottom: 16 }}
        message="锁定失败"
        description={lockError}
        closable
        onClose={() => dispatch(dismissLockError())}
      />
    )}

    <Tabs items={[
      {
        key: 'diff', label: '版本差异', children: (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 16 }}>
            {versions.slice(0, 2).map((version) => (
              <Card key={version.id} title={<span>{version.id} · {version.author} <Tag>{version.time}</Tag></span>}>
                <p>{version.summary}</p>
                {Object.entries(version.trackNotes).map(([trackId, notes]) => (
                  <div className="diff-row" key={trackId}><Tag color="red">修改</Tag><span>{trackId}：力度由 mp 调整为 p，增加第 3 拍延音线</span><b>{notes.length} 个音符</b></div>
                ))}
                <div className="diff-row"><Tag color="green">新增</Tag><span>换页处增加同声部提示音</span><b>2 小节</b></div>
              </Card>
            ))}
          </div>
        ),
      },
      {
        key: 'comments', label: `评论锚点 (${openComments.length})`, children: (
          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr .7fr', gap: 16 }}>
            <Card>
              {comments.map((comment) => (
                <div key={comment.id} style={{ display: 'grid', gridTemplateColumns: '60px 1fr auto', gap: 12, padding: '14px 0', borderBottom: '1px solid #edf0f5' }}>
                  <Tag icon={<CommentOutlined />}>第 {comment.measure} 小节</Tag>
                  <div>
                    <b>{comment.author}</b>
                    {comment.reverted && <Tag color="orange" style={{ marginLeft: 8 }}>已退回复核</Tag>}
                    <p>{comment.content}</p>
                  </div>
                  <div>{comment.resolved ? <Tag color="green">已解决</Tag> : <Button size="small" onClick={() => dispatch(resolveComment(comment.id))}>应用评论</Button>}</div>
                </div>
              ))}
            </Card>
            <Card title="待决事项">
              <Alert type="warning" showIcon message="第 2 小节力度仍未统一" description="总谱改动后关联评论已退回复核；接受评论后会更新圆号分谱，但不会覆盖原始版本。" />
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}><Button type="primary" icon={<CheckOutlined />}>接受全部</Button><Button danger icon={<CloseOutlined />}>拒绝修改</Button></div>
            </Card>
          </div>
        ),
      },
      {
        key: 'baselines', label: `出版基线 (${baselines.length})`, children: (
          <Card title="基线快照（锁定时的总谱与分册重排结果）">
            {baselines.length === 0 && <p className="muted">尚未锁定出版基线。锁定前会重排页边界并核对同声部提示音。</p>}
            {baselines.map((baseline) => (
              <div key={baseline.id} className="diff-row">
                <Tag color={baseline.status === 'locked' ? 'green' : 'default'}>{baseline.status === 'locked' ? '当前基线' : '旧基线'}</Tag>
                <span><b>{baseline.id}</b> · {baseline.lockedBy} 于 {new Date(baseline.lockedAt).toLocaleString('zh-CN')} · 版本 {baseline.versionId} · {baseline.tracks.length} 声部</span>
                <b>{baseline.layouts.reduce((sum, l) => sum + l.pages.length, 0)} 页</b>
              </div>
            ))}
            <Alert style={{ marginTop: 12 }} type="info" showIcon message="旧出版基线仍可查" description="每次锁定都会保留一份基线快照；旧基线不会被覆盖，可随时回溯查看当时的页边界与提示音。" />
          </Card>
        ),
      },
      {
        key: 'conflicts', label: `并发冲突 (${openConflicts.length})`, children: (
          <Card title="晚到改动另存为冲突（先到者成为基线）">
            {openConflicts.length === 0 && <p className="muted">暂无并发冲突。在分谱页「模拟两人同时保存同一声部」可触发。</p>}
            {conflicts.map((conflict) => (
              <div key={conflict.id} className="diff-row">
                <Tag color={conflict.status === 'open' ? 'red' : 'default'}>{conflict.status === 'open' ? '待处理' : '已处理'}</Tag>
                <span>
                  <b>{conflict.partName}</b> · 先到 {conflict.firstComer}（{conflict.firstAt}）成为基线；晚到 {conflict.lateComer}（{conflict.lateAt}）另存改动
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <b>{conflict.lateChanges.length} 音</b>
                  {conflict.status === 'open' && <Button size="small" onClick={() => dispatch(resolveConflict(conflict.id))}>标记已处理</Button>}
                </span>
              </div>
            ))}
          </Card>
        ),
      },
      {
        key: 'timeline', label: '操作历史', children: (
          <Card>
            <Timeline items={[
              { color: 'green', children: '16:28 沈青提交 v12：调整终段和声与连音线' },
              { color: 'blue', children: '15:40 方亦修改圆号力度，总谱重排后圆号分册失效、关联评论退回复核' },
              { color: 'gray', children: '14:10 发布 v11：单簧管移调分谱' },
            ]} />
          </Card>
        ),
      },
    ]} />
  </main>
}
