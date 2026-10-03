import { Layout, Menu, Button, Tag, Space, Alert } from 'antd'
import { AudioOutlined, FileTextOutlined, HistoryOutlined, SaveOutlined } from '@ant-design/icons'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootState } from './store'
import { discardDraft, saveVersion } from './store'
import Overview from './pages/Overview'
import ScoreEditor from './pages/ScoreEditor'
import Parts from './pages/Parts'
import Versions from './pages/Versions'

export default function App() {
  const location = useLocation()
  const dispatch = useDispatch<AppDispatch>()
  const dirty = useSelector((state: RootState) => state.score.dirty)
  const recoveredDraft = useSelector((state: RootState) => state.score.recoveredDraft)
  const draft = useSelector((state: RootState) => state.score.draft)
  const baselines = useSelector((state: RootState) => state.score.baselines)
  const currentBaseline = baselines.find((b) => b.status === 'locked')
  const items = [
    { key: '/', icon: <AudioOutlined />, label: <Link to="/">作品总览</Link> },
    { key: '/score', icon: <FileTextOutlined />, label: <Link to="/score">总谱编辑</Link> },
    { key: '/parts', icon: <FileTextOutlined />, label: <Link to="/parts">分谱出版</Link> },
    { key: '/versions', icon: <HistoryOutlined />, label: <Link to="/versions">版本与评论</Link> },
  ]
  return (
    <Layout className="app-shell">
      <Layout.Sider width={224} style={{ background: '#0f172a', color: '#fff', minHeight: '100vh' }}>
        <div className="brand"><span className="brand-mark">谱</span><div><b>总谱出版台</b><small>SCORE PUBLISHING</small></div></div>
        <Menu theme="dark" mode="inline" selectedKeys={[location.pathname]} items={items} style={{ background: 'transparent', border: 0 }} />
        <div className="side-status"><b>《潮汐线》</b><small>总谱 12 小节 · 分谱 4 册</small></div>
      </Layout.Sider>
      <Layout>
        <Layout.Header className="top-header"><div><b>沈青 · 室内交响作品</b><Tag style={{ marginLeft: 10 }} color={dirty ? 'orange' : 'green'}>{dirty ? '未保存修改' : currentBaseline ? `已锁定基线 ${currentBaseline.id}` : '版本 v12 已保存'}</Tag></div><Space><Button>打印预览</Button><Button type="primary" icon={<SaveOutlined />} onClick={() => dispatch(saveVersion())}>形成版本</Button></Space></Layout.Header>
        {recoveredDraft && (
          <Alert
            type="info"
            banner
            showIcon
            style={{ margin: '12px 22px 0' }}
            message={dirty ? `已恢复最近完整草稿（${draft ? new Date(draft.savedAt).toLocaleString('zh-CN') : ''}）` : `已恢复上次保存的工作状态（${draft ? new Date(draft.savedAt).toLocaleString('zh-CN') : ''}）`}
            description={dirty ? '检测到锁定失败或页面崩溃后的未完成编辑，已从本地草稿恢复完整工作状态。旧出版基线仍可在「版本与评论」中查看。' : '已从本地草稿恢复上次锁定/保存的完整状态，出版基线与分册重排结果均保留。'}
            action={<Button size="small" onClick={() => dispatch(discardDraft())}>丢弃草稿</Button>}
          />
        )}
        <Layout.Content><Routes><Route path="/" element={<Overview />} /><Route path="/score" element={<ScoreEditor />} /><Route path="/parts" element={<Parts />} /><Route path="/versions" element={<Versions />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes></Layout.Content>
      </Layout>
    </Layout>
  )
}
