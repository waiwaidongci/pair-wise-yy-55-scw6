import { useEffect, useState } from 'react'
import { Alert, Button, Layout, Menu, Space, Tag, message } from 'antd'
import { AudioOutlined, FileTextOutlined, HistoryOutlined, SaveOutlined } from '@ant-design/icons'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootState } from './store'
import { clearNotice, readLatestDraft, restoreDraft, saveVersion } from './store'
import Overview from './pages/Overview'
import ScoreEditor from './pages/ScoreEditor'
import Parts from './pages/Parts'
import Versions from './pages/Versions'

export default function App() {
  const location = useLocation()
  const dispatch = useDispatch<AppDispatch>()
  const { dirty, lockedBaselineId, saveNotice, conflicts } = useSelector((state: RootState) => state.score)
  const [messageApi, contextHolder] = message.useMessage()
  // 页面崩溃或锁定失败后重新进入：检测最近完整草稿
  const [draft, setDraft] = useState(() => readLatestDraft())

  useEffect(() => {
    if (saveNotice) { messageApi.info(saveNotice); dispatch(clearNotice()) }
  }, [saveNotice, messageApi, dispatch])

  const items = [
    { key: '/', icon: <AudioOutlined />, label: <Link to="/">作品总览</Link> },
    { key: '/score', icon: <FileTextOutlined />, label: <Link to="/score">总谱编辑</Link> },
    { key: '/parts', icon: <FileTextOutlined />, label: <Link to="/parts">分谱出版</Link> },
    { key: '/versions', icon: <HistoryOutlined />, label: <Link to="/versions">版本与评论</Link> },
  ]
  const pendingConflicts = conflicts.filter((item) => item.status === 'pending').length
  return (
    <Layout className="app-shell">
      {contextHolder}
      <Layout.Sider width={224} style={{ background: '#0f172a', color: '#fff', minHeight: '100vh' }}>
        <div className="brand"><span className="brand-mark">谱</span><div><b>总谱出版台</b><small>SCORE PUBLISHING</small></div></div>
        <Menu theme="dark" mode="inline" selectedKeys={[location.pathname]} items={items} style={{ background: 'transparent', border: 0 }} />
        <div className="side-status"><b>《潮汐线》</b><small>总谱 12 小节 · 分谱 4 册</small><small>基线 {lockedBaselineId ?? '未锁定'}</small></div>
      </Layout.Sider>
      <Layout>
        <Layout.Header className="top-header"><div><b>沈青 · 室内交响作品</b><Tag style={{ marginLeft: 10 }} color={dirty ? 'orange' : 'green'}>{dirty ? '未保存修改' : `基线 ${lockedBaselineId ?? ''} 已保存`}</Tag>{pendingConflicts > 0 && <Tag color="red">冲突 {pendingConflicts}</Tag>}</div><Space><Button>打印预览</Button><Button type="primary" icon={<SaveOutlined />} onClick={() => dispatch(saveVersion())}>形成版本</Button></Space></Layout.Header>
        <Layout.Content>
          {draft && <Alert
            className="no-print"
            style={{ margin: '16px 22px 0' }}
            type="warning"
            showIcon
            message="检测到最近完整草稿"
            description={`保存于 ${new Date(draft.savedAt).toLocaleString('zh-CN')}。锁定失败或页面崩溃后可从此恢复，旧出版基线不受影响。`}
            action={<Space><Button size="small" type="primary" onClick={() => { dispatch(restoreDraft()); setDraft(null) }}>恢复草稿</Button><Button size="small" onClick={() => setDraft(null)}>忽略</Button></Space>}
          />}
          <Routes><Route path="/" element={<Overview />} /><Route path="/score" element={<ScoreEditor />} /><Route path="/parts" element={<Parts />} /><Route path="/versions" element={<Versions />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes>
        </Layout.Content>
      </Layout>
    </Layout>
  )
}
