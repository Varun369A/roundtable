'use client'
import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '@/lib/api'

type Tab = 'today' | 'engagement' | 'calendar' | 'analytics' | 'credentials'

interface ContentItem {
  id: string
  platform: string
  contentType: string
  scheduledFor: string
  status: string
  generatedText: string
  generatedImagePrompt?: string
  approvedAt?: string
  skippedAt?: string
  skippedReason?: string
}

interface EngagementItem {
  id: string
  platform: string
  type: string
  authorName: string
  authorHandle: string
  contentText: string
  draftReply?: string
  repliedAt?: string
  postId: string
}

interface AnalyticsItem {
  id: string
  platform: string
  postId: string
  postedAt: string
  likes: number
  comments: number
  shares: number
  reach: number
  impressions: number
  engagementRate: number
}

interface CalendarItem {
  id: string
  platform: string
  contentType: string
  scheduledFor: string
  status: string
  generatedText: string
}

interface Credential {
  id: string
  platform: string
  accountHandle: string
  accountName: string
  isActive: boolean
  connectedAt: string
}

export default function MarketingDashboard() {
  const [tab, setTab] = useState<Tab>('today')
  const [todayItems, setTodayItems] = useState<ContentItem[]>([])
  const [engagementItems, setEngagementItems] = useState<EngagementItem[]>([])
  const [calendarItems, setCalendarItems] = useState<CalendarItem[]>([])
  const [analyticsItems, setAnalyticsItems] = useState<AnalyticsItem[]>([])
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [skipReason, setSkipReason] = useState<Record<string, string>>({})
  const [replyText, setReplyText] = useState<Record<string, string>>({})
  const [connectForm, setConnectForm] = useState({ platform: 'LINKEDIN', accessToken: '', refreshToken: '', accountHandle: '', accountName: '' })

  const fetchTab = useCallback(async (t: Tab) => {
    setLoading(true)
    try {
      if (t === 'today') {
        const res = await apiFetch('/api/v1/admin/marketing/today')
        if (res.success) setTodayItems((res.data as any)?.items || [])
      } else if (t === 'engagement') {
        const res = await apiFetch('/api/v1/admin/marketing/engagement')
        if (res.success) setEngagementItems((res.data as any)?.items || [])
      } else if (t === 'calendar') {
        const res = await apiFetch('/api/v1/admin/marketing/calendar')
        if (res.success) setCalendarItems((res.data as any)?.items || [])
      } else if (t === 'analytics') {
        const res = await apiFetch('/api/v1/admin/marketing/analytics')
        if (res.success) setAnalyticsItems((res.data as any)?.items || [])
      } else if (t === 'credentials') {
        const res = await apiFetch('/api/v1/admin/marketing/credentials')
        if (res.success) setCredentials((res.data as any)?.credentials || [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTab(tab) }, [tab, fetchTab])

  const approveContent = async (id: string, text?: string) => {
    const path = text
      ? `/api/v1/admin/marketing/content/${id}/edit`
      : `/api/v1/admin/marketing/content/${id}/approve`
    await apiFetch(path, { method: 'PATCH', body: JSON.stringify(text ? { editedText: text } : {}) })
    setEditingId(null)
    fetchTab('today')
  }

  const skipContent = async (id: string) => {
    await apiFetch(`/api/v1/admin/marketing/content/${id}/skip`, {
      method: 'PATCH',
      body: JSON.stringify({ reason: skipReason[id] || 'Skipped by admin' }),
    })
    fetchTab('today')
  }

  const approveAll = async () => {
    await apiFetch('/api/v1/admin/marketing/content/approve-all', { method: 'POST' })
    fetchTab('today')
  }

  const sendReply = async (id: string) => {
    await apiFetch(`/api/v1/admin/marketing/engagement/${id}/reply`, {
      method: 'PATCH',
      body: JSON.stringify({ replyText: replyText[id] }),
    })
    fetchTab('engagement')
  }

  const connectCredential = async () => {
    await apiFetch('/api/v1/admin/marketing/credentials/connect', {
      method: 'POST',
      body: JSON.stringify(connectForm),
    })
    fetchTab('credentials')
  }

  const platformColor: Record<string, string> = {
    LINKEDIN: 'bg-blue-100 text-blue-800',
    TWITTER: 'bg-sky-100 text-sky-800',
    INSTAGRAM: 'bg-pink-100 text-pink-800',
    YOUTUBE: 'bg-red-100 text-red-800',
    FACEBOOK: 'bg-indigo-100 text-indigo-800',
    WHATSAPP: 'bg-green-100 text-green-800',
  }

  const statusColor: Record<string, string> = {
    PENDING_APPROVAL: 'bg-yellow-100 text-yellow-800',
    APPROVED: 'bg-green-100 text-green-800',
    SKIPPED: 'bg-gray-100 text-gray-600',
    POSTED: 'bg-blue-100 text-blue-800',
    FAILED: 'bg-red-100 text-red-800',
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'engagement', label: 'Engagement' },
    { id: 'calendar', label: 'Calendar' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'credentials', label: 'Credentials' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Marketing Dashboard</h1>
          <p className="text-gray-500 mt-1">Manage Arivarangam's self-marketing automation</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white rounded-xl p-1 shadow-sm border border-gray-200 w-fit">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t.id ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
          </div>
        )}

        {/* TODAY TAB */}
        {!loading && tab === 'today' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Pending Approvals ({todayItems.filter(i => i.status === 'PENDING_APPROVAL').length})</h2>
              {todayItems.some(i => i.status === 'PENDING_APPROVAL') && (
                <button onClick={approveAll} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
                  Approve All
                </button>
              )}
            </div>
            {todayItems.length === 0 && <p className="text-gray-500 text-center py-12">No content scheduled for today.</p>}
            <div className="space-y-4">
              {todayItems.map(item => (
                <div key={item.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`px-2 py-1 rounded-md text-xs font-semibold ${platformColor[item.platform] || 'bg-gray-100 text-gray-700'}`}>{item.platform}</span>
                    <span className={`px-2 py-1 rounded-md text-xs font-semibold ${statusColor[item.status] || 'bg-gray-100 text-gray-700'}`}>{item.status.replace('_', ' ')}</span>
                    <span className="text-xs text-gray-400 ml-auto">{new Date(item.scheduledFor).toLocaleString()}</span>
                  </div>
                  {editingId === item.id ? (
                    <textarea
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg p-3 text-sm resize-none h-32 focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  ) : (
                    <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{item.generatedText}</p>
                  )}
                  {item.status === 'PENDING_APPROVAL' && (
                    <div className="flex flex-wrap gap-2 mt-4">
                      {editingId === item.id ? (
                        <>
                          <button onClick={() => approveContent(item.id, editText)} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">Save & Approve</button>
                          <button onClick={() => setEditingId(null)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">Cancel</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => approveContent(item.id)} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">Approve</button>
                          <button onClick={() => { setEditingId(item.id); setEditText(item.generatedText) }} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Edit & Approve</button>
                          <div className="flex gap-2 items-center">
                            <input
                              type="text"
                              placeholder="Skip reason..."
                              value={skipReason[item.id] || ''}
                              onChange={e => setSkipReason(s => ({ ...s, [item.id]: e.target.value }))}
                              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-gray-300"
                            />
                            <button onClick={() => skipContent(item.id)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300">Skip</button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ENGAGEMENT TAB */}
        {!loading && tab === 'engagement' && (
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Engagement Items ({engagementItems.filter(i => !i.repliedAt).length} pending)</h2>
            {engagementItems.length === 0 && <p className="text-gray-500 text-center py-12">No engagement items.</p>}
            <div className="space-y-4">
              {engagementItems.map(item => (
                <div key={item.id} className={`bg-white rounded-xl border shadow-sm p-5 ${item.repliedAt ? 'opacity-60' : 'border-gray-200'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-1 rounded-md text-xs font-semibold ${platformColor[item.platform] || 'bg-gray-100 text-gray-700'}`}>{item.platform}</span>
                    <span className="px-2 py-1 rounded-md text-xs font-semibold bg-purple-100 text-purple-800">{item.type}</span>
                    {item.repliedAt && <span className="px-2 py-1 rounded-md text-xs font-semibold bg-green-100 text-green-800 ml-auto">Replied</span>}
                  </div>
                  <p className="text-gray-800 font-medium text-sm">{item.authorName} <span className="text-gray-400">@{item.authorHandle}</span></p>
                  <p className="text-gray-600 text-sm mt-1 italic">"{item.contentText}"</p>
                  {item.draftReply && !item.repliedAt && (
                    <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-xs text-blue-600 font-semibold mb-1">AI Draft Reply:</p>
                      <textarea
                        value={replyText[item.id] ?? item.draftReply}
                        onChange={e => setReplyText(r => ({ ...r, [item.id]: e.target.value }))}
                        className="w-full bg-transparent text-sm text-gray-700 resize-none focus:outline-none h-20"
                      />
                      <button onClick={() => sendReply(item.id)} className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                        Send Reply
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CALENDAR TAB */}
        {!loading && tab === 'calendar' && (
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Content Calendar</h2>
            {calendarItems.length === 0 && <p className="text-gray-500 text-center py-12">No calendar items.</p>}
            <div className="overflow-x-auto">
              <table className="w-full bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Platform</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Preview</th>
                  </tr>
                </thead>
                <tbody>
                  {calendarItems.map((item, i) => (
                    <tr key={item.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-3 text-sm text-gray-600">{new Date(item.scheduledFor).toLocaleDateString()}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-1 rounded-md text-xs font-semibold ${platformColor[item.platform] || 'bg-gray-100 text-gray-700'}`}>{item.platform}</span></td>
                      <td className="px-4 py-3 text-sm text-gray-600">{item.contentType}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-1 rounded-md text-xs font-semibold ${statusColor[item.status] || 'bg-gray-100 text-gray-700'}`}>{item.status.replace('_', ' ')}</span></td>
                      <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">{item.generatedText?.slice(0, 80)}...</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ANALYTICS TAB */}
        {!loading && tab === 'analytics' && (
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Post Analytics</h2>
            {analyticsItems.length === 0 && <p className="text-gray-500 text-center py-12">No analytics data yet.</p>}
            <div className="overflow-x-auto">
              <table className="w-full bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Platform</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Posted</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Likes</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Comments</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Shares</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Reach</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Eng. Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {analyticsItems.map((item, i) => (
                    <tr key={item.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-3"><span className={`px-2 py-1 rounded-md text-xs font-semibold ${platformColor[item.platform] || 'bg-gray-100 text-gray-700'}`}>{item.platform}</span></td>
                      <td className="px-4 py-3 text-sm text-gray-600">{new Date(item.postedAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-sm text-gray-800 text-right font-medium">{item.likes.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-gray-800 text-right font-medium">{item.comments.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-gray-800 text-right font-medium">{item.shares.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-gray-800 text-right font-medium">{item.reach.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-green-700">{(item.engagementRate * 100).toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CREDENTIALS TAB */}
        {!loading && tab === 'credentials' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Connected Accounts</h2>
              {credentials.length === 0 && <p className="text-gray-500 mb-4">No accounts connected yet.</p>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {credentials.map(cred => (
                  <div key={cred.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${cred.isActive ? 'bg-green-600' : 'bg-gray-400'}`}>
                      {cred.platform[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm">{cred.accountName}</p>
                      <p className="text-xs text-gray-500">@{cred.accountHandle} · {cred.platform}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-md text-xs font-semibold ${cred.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      {cred.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h3 className="font-semibold text-gray-800 mb-4">Connect New Account</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Platform</label>
                  <select
                    value={connectForm.platform}
                    onChange={e => setConnectForm(f => ({ ...f, platform: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  >
                    {['LINKEDIN', 'TWITTER', 'INSTAGRAM', 'YOUTUBE', 'FACEBOOK'].map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Account Handle</label>
                  <input type="text" placeholder="@handle" value={connectForm.accountHandle} onChange={e => setConnectForm(f => ({ ...f, accountHandle: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Account Name</label>
                  <input type="text" placeholder="Display name" value={connectForm.accountName} onChange={e => setConnectForm(f => ({ ...f, accountName: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Access Token</label>
                  <input type="password" placeholder="OAuth access token" value={connectForm.accessToken} onChange={e => setConnectForm(f => ({ ...f, accessToken: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Refresh Token (optional)</label>
                  <input type="password" placeholder="OAuth refresh token" value={connectForm.refreshToken} onChange={e => setConnectForm(f => ({ ...f, refreshToken: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                </div>
              </div>
              <button onClick={connectCredential} className="mt-4 px-6 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700">
                Connect Account
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
