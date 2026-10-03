import { Alert, Button, Card, Col, Progress, Row, Table, Tag } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import type { RootState } from '../store'
import { scoreApi } from '../store'
import { reflowPart } from '../reflow'

export default function Overview() {
  const navigate = useNavigate()
  const { tracks, comments, partStale, conflicts, lockedBaselineId } = useSelector((state: RootState) => state.score)
  const { data } = scoreApi.endpoints.getPublishingProfile.useQuery()
  // 共用重排流程：按当前小节长度实时核对各分谱换页提示
  const missingCues = tracks.flatMap((track) => reflowPart(track).missingCues.map((item) => ({ track, item })))
  const staleCount = tracks.filter((track) => partStale[track.id]).length
  const pendingConflicts = conflicts.filter((item) => item.status === 'pending').length
  return <main className="page">
    <div className="page-head"><div><p className="eyebrow">乐谱、移调与出版准备</p><h1>{data?.title ?? '总谱出版工作台'}</h1><p>统一管理多声部总谱、移调乐器分谱、换页提示、版本差异与评论锚点。</p></div><Button type="primary" onClick={() => navigate('/score')}>进入总谱编辑</Button></div>
    <Row gutter={[14,14]} className="metrics"><Col xs={24} sm={12} xl={6}><Card className="metric"><span>声部数量</span><strong>{tracks.length}</strong><small>4 个乐手分谱</small></Card></Col><Col xs={24} sm={12} xl={6}><Card className="metric"><span>失效分谱</span><strong>{staleCount}</strong><small>总谱变更后待复核</small></Card></Col><Col xs={24} sm={12} xl={6}><Card className="metric"><span>待处理评论</span><strong>{comments.filter((item) => !item.resolved).length}</strong><small>含退回复核 {pendingConflicts ? `· 冲突 ${pendingConflicts}` : ''}</small></Card></Col><Col xs={24} sm={12} xl={6}><Card className="metric"><span>出版基线</span><strong>{lockedBaselineId ?? '未锁定'}</strong><small>交付 {data?.deadline ?? '2026-10-12'}</small></Card></Col></Row>
    {(missingCues.length > 0 || staleCount > 0) && <Alert type="warning" showIcon message="轮次差异需要处理" description={`${staleCount ? `${staleCount} 册分谱因总谱变更失效；` : ''}${missingCues.length ? `${missingCues.length} 处换页前缺少同声部提示（${missingCues.map(({track,item})=>`${track.name}第${item.page}页末`).join('、')}），已挡住出版锁定。` : ''}`} action={<Button size="small" onClick={() => navigate('/versions')}>查看差异</Button>} style={{ marginBottom: 16 }} />}
    <Row gutter={[16,16]}><Col xs={24} xl={16}><Card title="声部与出版状态"><Table rowKey="id" pagination={false} dataSource={tracks} columns={[{title:'声部',dataIndex:'name'},{title:'乐器',dataIndex:'instrument'},{title:'移调',render:(_value,row)=><Tag color={row.transposition ? 'purple' : 'blue'}>{row.transposition ? `${row.transposition > 0 ? '+' : ''}${row.transposition} 半音` : '不移调'}</Tag>},{title:'小节',render:(_value,row)=>`${Math.ceil(row.notes.length / 4)} 小节 / ${row.notes.length} 音`},{title:'状态',render:(_value,row)=>partStale[row.id] ? <Tag color="orange">已失效 · 待复核</Tag> : <Tag color="green">可排版</Tag>}]} /></Card></Col><Col xs={24} xl={8}><Card title="出版检查"><div className="check-row"><span>和弦拼写校验</span><b className="success">通过</b></div><div className="check-row"><span>节奏完整性</span><b className="success">通过</b></div><div className="check-row"><span>换页与提示音</span><b className={missingCues.length ? 'danger' : 'success'}>{missingCues.length ? `${missingCues.length} 项待处理` : '通过'}</b></div><div className="check-row"><span>分谱移调</span><b className={staleCount ? 'warning' : 'success'}>{staleCount ? `${staleCount} 册待复核` : '已与总谱同步'}</b></div><Progress percent={missingCues.length || staleCount ? 82 : 100} strokeColor="#2563eb" /><p className="muted">完成全部评论处理后方可锁定出版版本。</p></Card></Col></Row>
  </main>
}
