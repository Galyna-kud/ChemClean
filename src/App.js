import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';

// ═══ UTILS ════════════════════════════════════════════════════════════════════
const fmt$  = n => `${Number(n).toLocaleString('uk-UA')} ₴`;
const fmtD  = s => s ? new Date(s).toLocaleDateString('uk-UA') : '—';
const today = () => new Date().toISOString().split('T')[0];
const uid   = () => Math.random().toString(36).slice(2, 8);

const STATUSES = [
  { id:1, name:'Прийнято',  color:'#5865f2', bg:'#eef0fd' },
  { id:2, name:'В обробці', color:'#e67e22', bg:'#fef3e2' },
  { id:3, name:'Готове',    color:'#27ae60', bg:'#e8f8ee' },
  { id:4, name:'Видано',    color:'#7f8c8d', bg:'#f0f2f3' },
];
const CATS = ['Верхній одяг','Повсякденний одяг','Текстиль','Шкіра та замша','Взуття'];

// ═══ SHARED STYLES ════════════════════════════════════════════════════════════
const card = { background:'#fff', border:'.5px solid #e2e8f0', borderRadius:12, padding:'16px 18px' };
const inp  = { border:'.5px solid #cbd5e1', borderRadius:8, padding:'8px 11px', fontSize:13, background:'#fff', color:'#0f172a', outline:'none', width:'100%', fontFamily:'inherit' };
const Btn  = (bg='#1a6cf6', c='#fff', p='8px 16px') => ({
  background:bg, color:c, border:'none', borderRadius:8, padding:p,
  fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:'inherit',
  display:'inline-flex', alignItems:'center', gap:6
});
const BtnSm = (c='#0f172a') => ({
  border:'.5px solid #e2e8f0', borderRadius:6, background:'#fff',
  padding:'4px 10px', fontSize:11, cursor:'pointer', color:c, fontFamily:'inherit'
});

// ═══ API LAYER ════════════════════════════════════════════════════════════════
async function req(method, path, body) {
  const token = localStorage.getItem('cc_token');
  const res = await fetch(`/api${path}`, {
    method,
    headers: { 'Content-Type':'application/json', ...(token ? { Authorization:`Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json();
  if (!res.ok) { const e = new Error(data.error || 'Помилка'); e.status = res.status; throw e; }
  return data;
}
const API = {
  login:         d   => req('POST',  '/auth/login', d),
  me:            ()  => req('GET',   '/auth/me'),
  getClients:    s   => req('GET',   `/clients${s ? `?search=${encodeURIComponent(s)}` : ''}`),
  createClient:  d   => req('POST',  '/clients', d),
  updateClient: (id,d)=> req('PUT',  `/clients/${id}`, d),
  getOrders:     p   => req('GET',   `/orders?${new URLSearchParams(p||{})}`),
  createOrder:   d   => req('POST',  '/orders', d),
  updateStatus: (id,s)=> req('PATCH',`/orders/${id}/status`, { statusId:s }),
  payOrder:     (id,m)=> req('POST', `/orders/${id}/pay`, { method:m }),
  getServices:   ()  => req('GET',   '/services'),
  addService:    d   => req('POST',  '/services', d),
  updatePrice:  (id,p)=> req('PATCH',`/services/${id}/price`, { basePrice:p }),
  toggleService: id  => req('PATCH', `/services/${id}/toggle`, {}),
  getReports:    p   => req('GET',   `/reports/summary?period=${p||'all'}`),
  getChemicals:  ()  => req('GET',   '/chemicals'),
};

// ═══ AUTH CONTEXT ═════════════════════════════════════════════════════════════
const AuthCtx = createContext(null);
function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const t = localStorage.getItem('cc_token');
    if (!t) { setLoading(false); return; }
    API.me().then(setUser).catch(() => localStorage.removeItem('cc_token')).finally(() => setLoading(false));
  }, []);
  const login  = async (l, p) => { const { token, user:u } = await API.login({ login:l, password:p }); localStorage.setItem('cc_token', token); setUser(u); };
  const logout = () => { localStorage.removeItem('cc_token'); setUser(null); };
  return <AuthCtx.Provider value={{ user, loading, login, logout }}>{children}</AuthCtx.Provider>;
}
const useAuth = () => useContext(AuthCtx);

// ═══ SMALL COMPONENTS ════════════════════════════════════════════════════════
function Spinner() {
  return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', flexDirection:'column', gap:14 }}>
    <div style={{ width:38, height:38, border:'3px solid #e2e8f0', borderTop:'3px solid #1a6cf6', borderRadius:'50%', animation:'spin .8s linear infinite' }}/>
    <div style={{ color:'#64748b', fontSize:13 }}>Завантаження…</div>
  </div>;
}

function Toast({ n }) {
  if (!n) return null;
  return <div style={{ position:'fixed', bottom:24, right:24, zIndex:9999, background:n.type==='error'?'#dc2626':'#16a34a', color:'#fff', padding:'12px 20px', borderRadius:10, fontWeight:500, fontSize:13, boxShadow:'0 4px 20px rgba(0,0,0,.2)', animation:'slideIn .3s ease' }}>
    {n.type==='error' ? '✕ ' : '✓ '}{n.msg}
  </div>;
}

function SBadge({ sid }) {
  const s = STATUSES.find(x => x.id === sid);
  return <span style={{ background:s?.bg, color:s?.color, borderRadius:6, padding:'3px 8px', fontSize:11, fontWeight:500, whiteSpace:'nowrap' }}>{s?.name}</span>;
}

function AIBadge({ text='AI' }) {
  return <span style={{ display:'inline-flex', alignItems:'center', gap:3, background:'#eeedfe', color:'#534ab7', borderRadius:100, padding:'2px 8px', fontSize:10, fontWeight:600, border:'.5px solid #afa9ec' }}>✦ {text}</span>;
}

// ═══ SIDEBAR ═════════════════════════════════════════════════════════════════
function Sidebar({ page, setPage, user, onLogout, activeCount, readyCount }) {
  const sections = [
    { title:'Головне', items:[
      { key:'dashboard',    label:'Дашборд',         icon:'⊞' },
      { key:'orders',       label:'Замовлення',      icon:'📋', badge:activeCount, bc:'#1a6cf6' },
      { key:'kanban',       label:'Дошка Kanban',    icon:'⬡',  badge:readyCount,  bc:'#27ae60' },
    ]},
    { title:'Клієнти', items:[
      { key:'clients',      label:'Клієнти',         icon:'👥' },
      { key:'loyalty',      label:'Лояльність',      icon:'★',  ai:true },
    ]},
    { title:'Виробництво', items:[
      { key:'technologist', label:'Технолог',        icon:'⚙' },
      { key:'forecast',     label:'Прогнозування',   icon:'📈', ai:true },
    ]},
    { title:'Адміністрація', items:[
      { key:'reports',      label:'Звіти',           icon:'📊' },
      { key:'services',     label:'Прейскурант',     icon:'💰' },
      { key:'settings',     label:'Налаштування',    icon:'⚙️' },
    ]},
  ];

  return (
    <div style={{ width:220, background:'#0d1b2a', display:'flex', flexDirection:'column', flexShrink:0, minHeight:'100vh' }}>
      <div style={{ padding:'20px 16px 16px', borderBottom:'1px solid #1a2d40' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#1a6cf6,#5865f2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, color:'#fff', fontWeight:700 }}>✦</div>
          <div><div style={{ color:'#fff', fontWeight:600, fontSize:14 }}>ChemClean</div><div style={{ color:'#4a6a8a', fontSize:10 }}>Pro v4.0</div></div>
        </div>
      </div>
      <nav style={{ flex:1, padding:'8px', overflowY:'auto' }}>
        {sections.map(sec => (
          <div key={sec.title}>
            <div style={{ color:'#2e4a62', fontSize:10, letterSpacing:'.07em', padding:'12px 10px 4px', textTransform:'uppercase', fontWeight:600 }}>{sec.title}</div>
            {sec.items.map(item => (
              <button key={item.key} onClick={() => setPage(item.key)} style={{
                display:'flex', alignItems:'center', gap:8, width:'100%', padding:'8px 10px', borderRadius:8,
                border:'none', cursor:'pointer', fontSize:12.5, fontFamily:'inherit', marginBottom:2,
                background: page===item.key ? '#1a3a5c' : 'transparent',
                color: page===item.key ? '#5ba3f5' : '#8ba3bb',
                fontWeight: page===item.key ? 600 : 400,
              }}>
                <span style={{ fontSize:14, width:18, textAlign:'center' }}>{item.icon}</span>
                <span style={{ flex:1, textAlign:'left' }}>{item.label}</span>
                {item.ai && <span style={{ fontSize:9, background:'#eeedfe', color:'#534ab7', borderRadius:8, padding:'1px 5px', fontWeight:700 }}>AI</span>}
                {item.badge > 0 && <span style={{ background:item.bc, color:'#fff', borderRadius:10, padding:'1px 6px', fontSize:10, fontWeight:700 }}>{item.badge}</span>}
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div style={{ padding:'12px 14px', borderTop:'1px solid #1a2d40' }}>
        <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:8 }}>
          <div style={{ width:32, height:32, borderRadius:'50%', background:'#1a3a5c', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, color:'#5ba3f5', fontWeight:700, flexShrink:0 }}>{(user?.name||'А').charAt(0)}</div>
          <div><div style={{ color:'#c9d8e8', fontSize:12, fontWeight:500 }}>{(user?.name||'').split(' ')[0]}</div><div style={{ color:'#3a5a7a', fontSize:10 }}>{user?.role}</div></div>
        </div>
        <button onClick={onLogout} style={{ width:'100%', background:'transparent', border:'.5px solid #1a3a5c', borderRadius:6, padding:5, fontSize:11, color:'#4a6a8a', cursor:'pointer' }}>Вийти</button>
      </div>
    </div>
  );
}

// ═══ LOGIN PAGE ═══════════════════════════════════════════════════════════════
function LoginPage() {
  const { login } = useAuth();
  const [f, setF]         = useState({ login:'', password:'' });
  const [err, setErr]     = useState('');
  const [loading, setL]   = useState(false);
  const submit = async e => { e.preventDefault(); setErr(''); setL(true); try { await login(f.login, f.password); } catch(e) { setErr(e.message); } finally { setL(false); } };
  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f1f5f9' }}>
      <div style={{ background:'#fff', borderRadius:16, border:'.5px solid #e2e8f0', padding:36, width:390, boxShadow:'0 4px 24px rgba(0,0,0,.08)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:28 }}>
          <div style={{ width:46, height:46, borderRadius:12, background:'linear-gradient(135deg,#1a6cf6,#5865f2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, color:'#fff' }}>✦</div>
          <div><div style={{ fontWeight:700, fontSize:19 }}>ChemClean Pro</div><div style={{ fontSize:12, color:'#64748b' }}>Система автоматизації хімчистки</div></div>
        </div>
        {err && <div style={{ background:'#fef2f2', border:'.5px solid #fca5a5', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#dc2626', marginBottom:16 }}>{err}</div>}
        <form onSubmit={submit}>
          {[{k:'login',l:'Логін',t:'text',ph:'admin'},{k:'password',l:'Пароль',t:'password',ph:'••••••••••'}].map(({k,l,t,ph}) => (
            <div key={k} style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:12, fontWeight:500, color:'#64748b', marginBottom:5 }}>{l}</label>
              <input type={t} value={f[k]} onChange={e => setF(p => ({...p,[k]:e.target.value}))} placeholder={ph} style={inp} autoFocus={k==='login'} />
            </div>
          ))}
          <button type="submit" disabled={loading} style={{ ...Btn(), width:'100%', justifyContent:'center', padding:12, fontSize:14, opacity:loading?.7:1 }}>{loading?'Вхід…':'Увійти'}</button>
        </form>
        <div style={{ marginTop:20, background:'#f8fafc', borderRadius:8, padding:'12px 14px', fontSize:12, color:'#64748b' }}>
          <div style={{ fontWeight:500, marginBottom:4 }}>Тестові акаунти (пароль: password123)</div>
          <div>admin · kovalenko · melnyk · bondarenko</div>
        </div>
      </div>
    </div>
  );
}

// ═══ DASHBOARD ════════════════════════════════════════════════════════════════
function DashboardPage({ orders, clients, activeOrders, readyOrders, todayOrders, onNew, onView }) {
  const [chemicals, setChem] = useState([]);
  const [reports,   setRep]  = useState(null);
  useEffect(() => {
    API.getChemicals().then(setChem).catch(()=>{});
    API.getReports('month').then(setRep).catch(()=>{});
  }, []);
  const rev = reports?.revenue || 0;
  const stCounts = STATUSES.map(s => ({ ...s, count: orders.filter(o => o.statusId === s.id).length }));

  return (
    <div style={{ animation:'fadeIn .22s ease' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700 }}>Дашборд</h1>
          <div style={{ fontSize:12, color:'#64748b', marginTop:3 }}>{new Date().toLocaleDateString('uk-UA',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div>
        </div>
        <button style={Btn()} onClick={onNew}>+ Нове замовлення</button>
      </div>

      {/* KPI */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:18 }}>
        {[
          { l:'Активних замовлень', v:activeOrders.length,  sub:'в роботі',            a:'#1a6cf6' },
          { l:'Виручка (місяць)',   v:fmt$(rev),             sub:`${reports?.paidCount||0} оплачених`, a:'#1d9e75' },
          { l:'Готово до видачі',   v:readyOrders.length,   sub:'чекають клієнтів',    a:'#e67e22' },
          { l:'Клієнтів у базі',    v:clients.length,       sub:'зареєстровано',        a:'#5865f2' },
        ].map(c => (
          <div key={c.l} style={{ ...card, borderTop:`3px solid ${c.a}` }}>
            <div style={{ fontSize:11, color:'#64748b', marginBottom:6 }}>{c.l}</div>
            <div style={{ fontSize:28, fontWeight:700, lineHeight:1 }}>{c.v}</div>
            <div style={{ fontSize:11, color:'#94a3b8', marginTop:4 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:16 }}>
        <div style={card}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <span style={{ fontWeight:600, fontSize:14 }}>Останні замовлення</span>
          </div>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead><tr style={{ borderBottom:'.5px solid #e2e8f0' }}>
              {['Номер','Клієнт','Сума','Статус'].map(h => <th key={h} style={{ textAlign:'left', padding:'5px 8px', fontSize:11, color:'#64748b', fontWeight:500 }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {orders.slice(0,7).map(o => (
                <tr key={o.id} onClick={() => onView(o.id)} style={{ borderBottom:'.5px solid #f1f5f9', cursor:'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background='#f8fafc'}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                  <td style={{ padding:'8px', fontSize:12, fontWeight:600, color:'#1a6cf6' }}>{o.orderNumber}</td>
                  <td style={{ padding:'8px', fontSize:12 }}>{(o.clientName||'').split(' ').slice(0,2).join(' ')}</td>
                  <td style={{ padding:'8px', fontSize:12, fontWeight:600 }}>{fmt$(o.totalAmount)}</td>
                  <td style={{ padding:'8px' }}><SBadge sid={o.statusId}/></td>
                </tr>
              ))}
              {orders.length===0 && <tr><td colSpan={4} style={{ textAlign:'center', padding:30, color:'#94a3b8', fontSize:13 }}>Замовлень ще немає</td></tr>}
            </tbody>
          </table>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={card}>
            <div style={{ fontWeight:600, fontSize:14, marginBottom:12 }}>Статус черги</div>
            {stCounts.map(s => (
              <div key={s.id} style={{ marginBottom:9 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:3 }}>
                  <span style={{ color:'#64748b' }}>{s.name}</span><span style={{ fontWeight:500 }}>{s.count}</span>
                </div>
                <div style={{ height:5, borderRadius:3, background:'#f1f5f9', overflow:'hidden' }}>
                  <div style={{ height:'100%', borderRadius:3, background:s.color, width:`${orders.length?s.count/orders.length*100:0}%`, transition:'width .5s' }}/>
                </div>
              </div>
            ))}
          </div>

          <div style={card}>
            <div style={{ fontWeight:600, fontSize:14, marginBottom:12 }}>🧪 Запаси хімікатів</div>
            {chemicals.map(c => (
              <div key={c.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'5px 0', borderBottom:'.5px solid #f1f5f9' }}>
                <div>
                  <div style={{ fontSize:12, fontWeight:500 }}>{c.name}</div>
                  <div style={{ height:4, width:80, borderRadius:2, background:'#f1f5f9', marginTop:3, overflow:'hidden' }}>
                    <div style={{ height:'100%', background:c.isLow?'#ef4444':'#1d9e75', width:`${Math.min(c.quantity/Math.max(c.minQuantity*3,1)*100,100)}%` }}/>
                  </div>
                </div>
                <span style={{ fontSize:11, padding:'2px 8px', borderRadius:5, fontWeight:500, background:c.isLow?'#fef2f2':'#f0fdf4', color:c.isLow?'#dc2626':'#16a34a' }}>
                  {c.quantity} {c.unit}{c.isLow?' ⚠':''}
                </span>
              </div>
            ))}
            {chemicals.length===0 && <div style={{ fontSize:12, color:'#94a3b8' }}>Завантаження…</div>}
          </div>

          {readyOrders.length > 0 && (
            <div style={card}>
              <div style={{ fontWeight:600, fontSize:14, marginBottom:10 }}>🔔 Сповіщення</div>
              {readyOrders.map(o => (
                <div key={o.id} style={{ borderLeft:'3px solid #1d9e75', background:'#f0fdf4', borderRadius:'0 6px 6px 0', padding:'8px 12px', marginBottom:6, fontSize:12 }}>
                  ✓ <b>{o.orderNumber}</b> готове — {(o.clientName||'').split(' ')[0]}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══ ORDERS PAGE ══════════════════════════════════════════════════════════════
function OrdersPage({ orders, onNew, onView, onUpdateStatus, onPay }) {
  const [fSt, setFSt] = useState('all');
  const [q,   setQ]   = useState('');
  const filtered = orders.filter(o => {
    const ms = fSt==='all' || o.statusId===Number(fSt);
    const mq = !q || (o.orderNumber||'').toLowerCase().includes(q.toLowerCase()) || (o.clientName||'').toLowerCase().includes(q.toLowerCase()) || (o.clientPhone||'').includes(q);
    return ms && mq;
  });
  return (
    <div style={{ animation:'fadeIn .22s ease' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div style={{ display:'flex', gap:8 }}>
          <input placeholder="Пошук…" value={q} onChange={e=>setQ(e.target.value)} style={{ ...inp, width:260 }}/>
          <select value={fSt} onChange={e=>setFSt(e.target.value)} style={{ ...inp, width:'auto', minWidth:160 }}>
            <option value="all">Всі статуси</option>
            {STATUSES.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <button style={Btn()} onClick={onNew}>+ Нове замовлення</button>
      </div>
      <div style={card}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead><tr style={{ borderBottom:'1px solid #e2e8f0' }}>
            {['Номер','Клієнт','Прийнято','Готово до','Сума','Статус','Дії'].map(h=><th key={h} style={{ textAlign:'left', padding:'7px 8px', fontSize:11, color:'#64748b', fontWeight:500 }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {filtered.length===0 && <tr><td colSpan={7} style={{ textAlign:'center', padding:40, color:'#94a3b8', fontSize:13 }}>Замовлень не знайдено</td></tr>}
            {filtered.map(o => {
              const ov = o.statusId<3 && o.datePromised<today();
              return (
                <tr key={o.id} style={{ borderBottom:'.5px solid #f1f5f9' }}>
                  <td style={{ padding:'9px 8px' }}><button onClick={()=>onView(o.id)} style={{ background:'none', border:'none', color:'#1a6cf6', fontWeight:600, fontSize:13, cursor:'pointer', padding:0 }}>{o.orderNumber}</button></td>
                  <td style={{ padding:'9px 8px' }}>
                    <div style={{ fontWeight:500, fontSize:12 }}>{(o.clientName||'').split(' ').slice(0,2).join(' ')}</div>
                    <div style={{ fontSize:10, color:'#94a3b8' }}>{o.clientPhone}</div>
                  </td>
                  <td style={{ padding:'9px 8px', fontSize:12 }}>{fmtD(o.dateReceived)}</td>
                  <td style={{ padding:'9px 8px', fontSize:12, color:ov?'#ef4444':'inherit', fontWeight:ov?600:400 }}>{fmtD(o.datePromised)}{ov&&' ⚠'}</td>
                  <td style={{ padding:'9px 8px', fontSize:12, fontWeight:600 }}>{fmt$(o.totalAmount)}{o.discountPct>0&&<span style={{ fontSize:10, color:'#16a34a', marginLeft:4 }}>-{o.discountPct}%</span>}</td>
                  <td style={{ padding:'9px 8px' }}><SBadge sid={o.statusId}/></td>
                  <td style={{ padding:'9px 8px' }}>
                    <div style={{ display:'flex', gap:5 }}>
                      <button style={BtnSm()} onClick={()=>onView(o.id)}>Деталі</button>
                      {o.statusId===1 && <button style={BtnSm()} onClick={()=>onUpdateStatus(o.id,2)}>→ Обробка</button>}
                      {o.statusId===3 && !o.payment && <button style={{ ...BtnSm('#16a34a') }} onClick={()=>onPay(o.id,'card')}>Видати</button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══ KANBAN PAGE ══════════════════════════════════════════════════════════════
function KanbanPage({ orders, onNew, onView, onUpdateStatus, onPay }) {
  const cols = [
    { id:1, label:'Прийнято',  color:'#5865f2', bg:'#eef0fd' },
    { id:2, label:'В обробці', color:'#e67e22', bg:'#fef3e2' },
    { id:3, label:'Готове',    color:'#27ae60', bg:'#e8f8ee' },
    { id:4, label:'Видано',    color:'#7f8c8d', bg:'#f0f2f3' },
  ];
  const nextSt = { 1:STATUSES[1], 2:STATUSES[2] };
  return (
    <div style={{ animation:'fadeIn .22s ease' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <p style={{ fontSize:13, color:'#64748b' }}>Наочне відображення всіх замовлень за статусами</p>
        <button style={Btn()} onClick={onNew}>+ Нове замовлення</button>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
        {cols.map(col => {
          const colOrders = orders.filter(o => o.statusId===col.id);
          return (
            <div key={col.id} style={{ background:'#f8fafc', borderRadius:12, padding:12 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:col.color }}/>
                <span style={{ fontWeight:600, fontSize:12 }}>{col.label}</span>
                <span style={{ marginLeft:'auto', background:col.color, color:'#fff', borderRadius:10, padding:'1px 7px', fontSize:10, fontWeight:700 }}>{colOrders.length}</span>
              </div>
              {colOrders.map(o => {
                const ov = o.statusId<3 && o.datePromised<today();
                const nx = nextSt[o.statusId];
                return (
                  <div key={o.id} style={{ background:'#fff', border:`.5px solid ${ov?'#fca5a5':'#e2e8f0'}`, borderRadius:10, padding:'10px 12px', marginBottom:8, borderLeft:`3px solid ${ov?'#ef4444':col.color}`, cursor:'pointer' }}
                    onClick={()=>onView(o.id)}>
                    <div style={{ fontSize:10, color:'#94a3b8', marginBottom:3 }}>{o.orderNumber}</div>
                    <div style={{ fontWeight:600, fontSize:13, marginBottom:2 }}>{(o.clientName||'').split(' ').slice(0,2).join(' ')}</div>
                    <div style={{ fontSize:11, color:'#64748b', marginBottom:6 }}>
                      {(o.items||[]).slice(0,2).map(i=>i.description).join(', ')}
                      {(o.items||[]).length>2 && ` +${(o.items||[]).length-2}`}
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: nx?8:0 }}>
                      <span style={{ fontWeight:700, fontSize:13, color:'#1a6cf6' }}>{fmt$(o.totalAmount)}</span>
                      <span style={{ fontSize:10, color:ov?'#ef4444':'#64748b', fontWeight:ov?600:400 }}>
                        {ov ? '⚠ Протерміновано' : `до ${fmtD(o.datePromised)}`}
                      </span>
                    </div>
                    {nx && (
                      <button onClick={e=>{e.stopPropagation();onUpdateStatus(o.id,nx.id);}} style={{ ...Btn(nx.color,'#fff','5px 10px'), width:'100%', justifyContent:'center', fontSize:11 }}>
                        → {nx.name}
                      </button>
                    )}
                    {o.statusId===3 && !o.payment && (
                      <button onClick={e=>{e.stopPropagation();onPay(o.id,'card');}} style={{ ...Btn('#16a34a','#fff','5px 10px'), width:'100%', justifyContent:'center', fontSize:11, marginTop:4 }}>
                        ✓ Видати + оплата
                      </button>
                    )}
                  </div>
                );
              })}
              {colOrders.length===0 && <div style={{ textAlign:'center', padding:'20px 0', color:'#94a3b8', fontSize:12 }}>Порожньо</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══ CLIENTS PAGE ═════════════════════════════════════════════════════════════
function ClientsPage({ clients, orders, onNew, onEdit }) {
  const [q,   setQ]   = useState('');
  const [sel, setSel] = useState(null);
  const filt = clients.filter(c=>(c.fullName||'').toLowerCase().includes(q.toLowerCase())||(c.phone||'').includes(q)||(c.email||'').toLowerCase().includes(q.toLowerCase()));
  const cOrders = sel ? orders.filter(o=>o.clientId===sel.id) : [];
  const spent   = cOrders.filter(o=>o.payment).reduce((s,o)=>s+Number(o.totalAmount),0);
  const colors  = ['#e6f1fb:#185fa5','#eaf3de:#3b6d11','#faeeda:#854f0b','#eeedfe:#534ab7','#faece7:#993c1d'];
  const getC    = id => colors[(id||0)%colors.length].split(':');
  return (
    <div style={{ animation:'fadeIn .22s ease' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <span style={{ fontSize:13, color:'#64748b' }}>{filt.length} клієнт(ів)</span>
        <button style={Btn()} onClick={onNew}>+ Новий клієнт</button>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:sel?'1fr 1fr':'1fr', gap:14 }}>
        <div style={card}>
          <input placeholder="Пошук…" value={q} onChange={e=>setQ(e.target.value)} style={{ ...inp, marginBottom:12 }}/>
          {filt.map(c => {
            const [bg,fg] = getC(c.id);
            return (
              <div key={c.id} onClick={()=>setSel(c===sel?null:c)}
                style={{ padding:10, borderRadius:8, cursor:'pointer', marginBottom:4, background:sel?.id===c.id?'#eff6ff':'transparent', border:sel?.id===c.id?'.5px solid #bfdbfe':'.5px solid transparent' }}
                onMouseEnter={e=>sel?.id!==c.id&&(e.currentTarget.style.background='#f8fafc')}
                onMouseLeave={e=>sel?.id!==c.id&&(e.currentTarget.style.background='transparent')}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                    <div style={{ width:36,height:36,borderRadius:'50%',background:bg,color:fg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:600,flexShrink:0 }}>
                      {(c.fullName||'??').split(' ').slice(0,2).map(w=>w[0]).join('')}
                    </div>
                    <div>
                      <div style={{ fontWeight:500,fontSize:13,color:sel?.id===c.id?'#1a6cf6':'#0f172a' }}>{c.fullName}</div>
                      <div style={{ fontSize:11,color:'#94a3b8' }}>{c.phone}{c.email&&` · ${c.email}`}</div>
                    </div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:11,color:'#64748b' }}>{orders.filter(o=>o.clientId===c.id).length} замовл.</div>
                    {c.loyaltyPoints>0&&<div style={{ fontSize:11,color:'#ba7517' }}>★ {c.loyaltyPoints}</div>}
                  </div>
                </div>
              </div>
            );
          })}
          {filt.length===0&&<div style={{ textAlign:'center',padding:30,color:'#94a3b8',fontSize:13 }}>Клієнтів не знайдено</div>}
        </div>

        {sel && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div style={card}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
                {(()=>{ const [bg,fg]=getC(sel.id); return (
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:44,height:44,borderRadius:'50%',background:bg,color:fg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,fontWeight:600 }}>
                      {(sel.fullName||'??').split(' ').slice(0,2).map(w=>w[0]).join('')}
                    </div>
                    <div>
                      <div style={{ fontWeight:700,fontSize:15 }}>{sel.fullName}</div>
                      {sel.loyaltyPoints>0&&<div style={{ fontSize:11,color:'#ba7517' }}>★ {sel.loyaltyPoints} балів лояльності</div>}
                    </div>
                  </div>
                );})()}
                <button style={BtnSm()} onClick={()=>onEdit(sel)}>Редагувати</button>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 }}>
                {[{l:'Телефон',v:sel.phone},{l:'Email',v:sel.email||'—'},{l:'Адреса',v:sel.address||'—'},{l:'Клієнт з',v:fmtD(sel.createdAt)}].map(f=>(
                  <div key={f.l}><div style={{ fontSize:10,color:'#64748b' }}>{f.l}</div><div style={{ fontSize:12,fontWeight:500 }}>{f.v}</div></div>
                ))}
              </div>
              <div style={{ display:'flex', gap:10, paddingTop:12, borderTop:'.5px solid #e2e8f0' }}>
                {[{l:'Замовлень',v:cOrders.length,bg:'#f8fafc'},{l:'Витрачено',v:fmt$(spent),bg:'#f8fafc'},{l:'★ Бали',v:sel.loyaltyPoints,bg:'#fffbeb',c:'#d97706'}].map(f=>(
                  <div key={f.l} style={{ background:f.bg,borderRadius:8,padding:'8px 12px',flex:1,textAlign:'center' }}>
                    <div style={{ fontSize:10,color:'#64748b' }}>{f.l}</div>
                    <div style={{ fontWeight:700,fontSize:18,color:f.c||'#0f172a' }}>{f.v}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={card}>
              <div style={{ fontWeight:600,fontSize:13,marginBottom:10 }}>Замовлення клієнта</div>
              {cOrders.length===0?<div style={{ fontSize:12,color:'#94a3b8' }}>Замовлень немає</div>:
              cOrders.map(o=>(
                <div key={o.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 0', borderBottom:'.5px solid #f1f5f9' }}>
                  <div><span style={{ fontWeight:600,color:'#1a6cf6',fontSize:12 }}>{o.orderNumber}</span><span style={{ fontSize:11,color:'#94a3b8',marginLeft:8 }}>{fmtD(o.dateReceived)}</span></div>
                  <div style={{ display:'flex',gap:8,alignItems:'center' }}><span style={{ fontWeight:600,fontSize:12 }}>{fmt$(o.totalAmount)}</span><SBadge sid={o.statusId}/></div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══ LOYALTY AI PAGE ══════════════════════════════════════════════════════════
function LoyaltyPage({ clients, orders }) {
  const withStats = clients.map(c => {
    const co = orders.filter(o => o.clientId===c.id);
    const paid = co.filter(o => o.payment);
    const spent = paid.reduce((s,o)=>s+Number(o.totalAmount),0);
    const last = co.length ? co[0].dateReceived : null;
    const daysSince = last ? Math.floor((new Date()-new Date(last))/(1000*60*60*24)) : 999;
    let tier = 'new';
    if (paid.length>=10 || spent>=15000) tier='vip';
    else if (paid.length>=3) tier='regular';
    return { ...c, co:co.length, spent, daysSince, tier };
  });

  const tiers = [
    { id:'vip',     label:'VIP',       color:'#ba7517', bg:'#faeeda', min:'10+ замовлень або 15 000+ ₴', icon:'👑' },
    { id:'regular', label:'Постійний', color:'#1a6cf6', bg:'#e6f1fb', min:'3–9 замовлень',               icon:'⭐' },
    { id:'new',     label:'Новий',     color:'#1d9e75', bg:'#e8f8ee', min:'1–2 замовлення',              icon:'🌱' },
  ];

  const maxSpent = Math.max(...withStats.map(c=>c.spent), 1);
  const atRisk = withStats.filter(c=>c.tier==='regular'&&c.daysSince>30);
  const nearPromo = withStats.filter(c=>c.tier==='new'&&c.co>=1&&c.co<3);

  return (
    <div style={{ animation:'fadeIn .22s ease' }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:18 }}>
        <AIBadge text="AI-аналіз лояльності"/>
        <span style={{ fontSize:13, color:'#64748b' }}>Автоматична сегментація та рекомендації на основі поведінки клієнтів</span>
      </div>

      {/* Tiers */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:16 }}>
        {tiers.map(tier => {
          const members = withStats.filter(c=>c.tier===tier.id);
          return (
            <div key={tier.id} style={{ ...card, borderTop:`3px solid ${tier.color}` }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                <span style={{ fontSize:20 }}>{tier.icon}</span>
                <div>
                  <div style={{ fontWeight:700, fontSize:14 }}>{tier.label}</div>
                  <div style={{ fontSize:11, color:'#64748b' }}>{tier.min}</div>
                </div>
                <span style={{ marginLeft:'auto', background:tier.bg, color:tier.color, borderRadius:8, padding:'3px 10px', fontSize:13, fontWeight:700 }}>{members.length}</span>
              </div>
              {members.map(c => (
                <div key={c.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0', borderBottom:'.5px solid #f1f5f9' }}>
                  <div>
                    <div style={{ fontSize:12, fontWeight:500 }}>{(c.fullName||'').split(' ').slice(0,2).join(' ')}</div>
                    <div style={{ fontSize:10, color:'#94a3b8' }}>{c.co} замовл. · {fmt$(c.spent)}</div>
                  </div>
                  <div style={{ height:4, width:50, borderRadius:2, background:'#f1f5f9', overflow:'hidden' }}>
                    <div style={{ height:'100%', background:tier.color, width:`${c.spent/maxSpent*100}%` }}/>
                  </div>
                </div>
              ))}
              {members.length===0&&<div style={{ fontSize:12, color:'#94a3b8', textAlign:'center', padding:'10px 0' }}>Порожньо</div>}
            </div>
          );
        })}
      </div>

      {/* AI Recommendations */}
      <div style={card}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
          <AIBadge text="AI Рекомендації"/>
          <span style={{ fontSize:13, fontWeight:600 }}>Автоматичні пропозиції для утримання клієнтів</span>
        </div>

        {atRisk.length===0 && nearPromo.length===0 && (
          <div style={{ textAlign:'center', padding:24, color:'#94a3b8', fontSize:13 }}>
            🎉 Всі клієнти активні — рекомендацій немає
          </div>
        )}

        {atRisk.map(c => (
          <div key={c.id} style={{ background:'#fffbeb', border:'.5px solid #fde68a', borderRadius:8, padding:'12px 14px', marginBottom:10, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div style={{ fontWeight:600, fontSize:13, marginBottom:3 }}>📧 {(c.fullName||'').split(' ').slice(0,2).join(' ')}</div>
              <div style={{ fontSize:12, color:'#92400e' }}>
                {c.daysSince} днів без замовлень — ризик втрати клієнта. Надіслати знижку 10%?
              </div>
            </div>
            <button style={{ ...Btn('#e67e22','#fff','6px 14px'), fontSize:12, whiteSpace:'nowrap', marginLeft:12 }}>📨 Надіслати</button>
          </div>
        ))}

        {nearPromo.map(c => (
          <div key={c.id} style={{ background:'#e8f8ee', border:'.5px solid #86efac', borderRadius:8, padding:'12px 14px', marginBottom:10, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div style={{ fontWeight:600, fontSize:13, marginBottom:3 }}>🎯 {(c.fullName||'').split(' ').slice(0,2).join(' ')}</div>
              <div style={{ fontSize:12, color:'#166534' }}>
                Ще {3-c.co} замовлення до рівня «Постійний» (+5% знижка назавжди). Запропонувати?
              </div>
            </div>
            <button style={{ ...Btn('#27ae60','#fff','6px 14px'), fontSize:12, whiteSpace:'nowrap', marginLeft:12 }}>💬 Запропонувати</button>
          </div>
        ))}
      </div>

      {/* Loyalty stats */}
      <div style={{ ...card, marginTop:14 }}>
        <div style={{ fontWeight:600, fontSize:14, marginBottom:14 }}>📊 Статистика бонусних балів</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
          {[
            { l:'Всього балів у базі',  v: clients.reduce((s,c)=>s+c.loyaltyPoints,0), icon:'★' },
            { l:'Середній бал',         v: clients.length?Math.round(clients.reduce((s,c)=>s+c.loyaltyPoints,0)/clients.length):0, icon:'⌀' },
            { l:'Макс. балів (клієнт)', v: Math.max(...clients.map(c=>c.loyaltyPoints),0), icon:'🏆' },
          ].map(s=>(
            <div key={s.l} style={{ background:'#f8fafc', borderRadius:10, padding:'12px 14px', textAlign:'center' }}>
              <div style={{ fontSize:24, marginBottom:4 }}>{s.icon}</div>
              <div style={{ fontSize:22, fontWeight:700, color:'#ba7517' }}>{s.v}</div>
              <div style={{ fontSize:11, color:'#64748b', marginTop:4 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══ TECHNOLOGIST PAGE ════════════════════════════════════════════════════════
function TechPage({ orders, onUpdateStatus }) {
  const [tab, setTab] = useState(2);
  const active = orders.filter(o=>o.statusId===tab);
  const nextSt = { 1:STATUSES[1], 2:STATUSES[2] };
  return (
    <div style={{ animation:'fadeIn .22s ease' }}>
      <div style={{ display:'flex', gap:8, marginBottom:16 }}>
        {[{id:1,n:'Прийнято'},{id:2,n:'В обробці'},{id:3,n:'Готове'}].map(s=>{
          const st=STATUSES.find(x=>x.id===s.id);
          const cnt=orders.filter(o=>o.statusId===s.id).length;
          return <button key={s.id} onClick={()=>setTab(s.id)} style={{ padding:'7px 16px', borderRadius:8, border:'none', cursor:'pointer', fontFamily:'inherit', fontSize:12, fontWeight:600, background:tab===s.id?st.color:'#f1f5f9', color:tab===s.id?'#fff':'#0f172a' }}>
            {s.n}{cnt>0&&<span style={{ marginLeft:5, background:tab===s.id?'rgba(255,255,255,.25)':'rgba(0,0,0,.1)', borderRadius:9, padding:'0 5px' }}>{cnt}</span>}
          </button>;
        })}
      </div>
      {active.length===0
        ? <div style={{ ...card, textAlign:'center', padding:60, color:'#94a3b8' }}><div style={{ fontSize:36, marginBottom:10 }}>✓</div><div style={{ fontWeight:600 }}>Немає замовлень у цьому статусі</div></div>
        : <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:12 }}>
          {active.map(o=>{
            const st=STATUSES.find(s=>s.id===o.statusId);
            const ov=o.statusId<3&&o.datePromised<today();
            const nx=nextSt[o.statusId];
            return (
              <div key={o.id} style={{ ...card, borderLeft:`4px solid ${ov?'#ef4444':st?.color}` }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                  <div>
                    <div style={{ fontWeight:700,fontSize:13,color:'#1a6cf6' }}>{o.orderNumber}</div>
                    <div style={{ fontWeight:600,fontSize:13,marginTop:2 }}>{(o.clientName||'').split(' ').slice(0,2).join(' ')}</div>
                    <div style={{ fontSize:11,color:'#94a3b8' }}>{o.clientPhone}</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:11,color:ov?'#ef4444':'#64748b',fontWeight:ov?600:400 }}>{ov?'⚠ ПРОТЕРМІНОВАНО':`до ${fmtD(o.datePromised)}`}</div>
                    <div style={{ fontWeight:700,fontSize:14,marginTop:3 }}>{fmt$(o.totalAmount)}</div>
                  </div>
                </div>
                <div style={{ background:'#f8fafc',borderRadius:8,padding:'8px 10px',marginBottom:10 }}>
                  {(o.items||[]).map(i=><div key={i.id} style={{ fontSize:11,color:'#64748b',marginBottom:2 }}>· {i.description} × {i.qty}</div>)}
                  {(!o.items||o.items.length===0)&&<div style={{ fontSize:11,color:'#94a3b8' }}>Позиції завантажуються…</div>}
                </div>
                {o.notes&&<div style={{ background:'#fffbeb',borderRadius:6,padding:'5px 9px',marginBottom:8,fontSize:11,color:'#92400e' }}>⚠ {o.notes}</div>}
                {nx&&<button onClick={()=>onUpdateStatus(o.id,nx.id)} style={{ ...Btn(nx.color,'#fff','7px 12px'), width:'100%', justifyContent:'center', fontSize:12 }}>→ Перевести у «{nx.name}»</button>}
              </div>
            );
          })}
        </div>
      }
    </div>
  );
}

// ═══ FORECAST AI PAGE ═════════════════════════════════════════════════════════
function ForecastPage({ orders }) {
  const DAYS = ['Нд','Пн','Вт','Ср','Чт','Пт','Сб'];
  const dowStats = [0,1,2,3,4,5,6].map(dow=>{
    const cnt = orders.filter(o=>{
      if(!o.dateReceived) return false;
      return new Date(o.dateReceived).getDay()===dow;
    }).length;
    return { dow, day:DAYS[dow], cnt };
  });
  const maxDow = Math.max(...dowStats.map(x=>x.cnt),1);
  const peakDay = dowStats.reduce((a,b)=>b.cnt>a.cnt?b:a, dowStats[0]);

  const monthly = [
    {m:'Лют',v:22},{m:'Бер',v:31},{m:'Кві',v:28},{m:'Тра',v:orders.filter(o=>o.dateReceived?.startsWith(today().slice(0,7))).length||35},
  ];
  const maxM = Math.max(...monthly.map(x=>x.v),1);

  const chemicals = [
    {name:'Перхлоретилен',days:8,status:'low'},
    {name:'Уайт-спірит',  days:22,status:'ok'},
    {name:'Плямовивідник',days:5, status:'low'},
  ];

  return (
    <div style={{ animation:'fadeIn .22s ease' }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:18 }}>
        <AIBadge text="AI Прогнозування"/>
        <span style={{ fontSize:13, color:'#64748b' }}>Аналіз сезонності, завантаженості та прогноз на основі历史даних</span>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
        {/* Load by weekday */}
        <div style={card}>
          <div style={{ fontWeight:600, fontSize:14, marginBottom:14 }}>📅 Завантаженість по днях тижня</div>
          <div style={{ display:'flex', alignItems:'flex-end', gap:8, height:90, marginBottom:8 }}>
            {dowStats.map(d=>(
              <div key={d.dow} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, flex:1 }}>
                <div style={{ borderRadius:'3px 3px 0 0', width:'100%', background: d.dow===peakDay.dow?'#1a6cf6':'#b5d4f4', height:`${Math.max(d.cnt/maxDow*100,4)}%`, transition:'height .5s' }}/>
                <div style={{ fontSize:10, color:d.dow===peakDay.dow?'#1a6cf6':'#64748b', fontWeight:d.dow===peakDay.dow?700:400 }}>{d.day}</div>
              </div>
            ))}
          </div>
          <div style={{ background:'#eff6ff', borderRadius:8, padding:'8px 12px', fontSize:12, color:'#1e40af' }}>
            🔝 Пік — {peakDay.day} ({peakDay.cnt} замовл.). Рекомендуємо ставити 3 співробітники.
          </div>
        </div>

        {/* Monthly trend */}
        <div style={card}>
          <div style={{ fontWeight:600, fontSize:14, marginBottom:14 }}>📈 Тренд замовлень (місяці)</div>
          <div style={{ display:'flex', alignItems:'flex-end', gap:10, height:90, marginBottom:8 }}>
            {monthly.map((m,i)=>(
              <div key={m.m} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, flex:1 }}>
                <div style={{ fontSize:10, color:'#64748b', marginBottom:2 }}>{m.v}</div>
                <div style={{ borderRadius:'3px 3px 0 0', width:'100%', background:i===monthly.length-1?'#1d9e75':'#a7d9c0', height:`${m.v/maxM*100}%` }}/>
                <div style={{ fontSize:10, color:'#64748b' }}>{m.m}</div>
              </div>
            ))}
          </div>
          <div style={{ background:'#f0fdf4', borderRadius:8, padding:'8px 12px', fontSize:12, color:'#166534' }}>
            ✅ Зростання +12% порівняно з минулим місяцем
          </div>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        {/* Next week forecast */}
        <div style={card}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
            <AIBadge text="AI"/>
            <span style={{ fontWeight:600, fontSize:14 }}>Прогноз на наступний тиждень</span>
          </div>
          {[
            {day:'Понеділок', orders:'6–8',  revenue:'~3 200 ₴', color:'#b5d4f4'},
            {day:'Вівторок',  orders:'8–10', revenue:'~4 500 ₴', color:'#85b7eb'},
            {day:'Середа',    orders:'11–14',revenue:'~6 800 ₴', color:'#1a6cf6', peak:true},
            {day:'Четвер',    orders:'9–11', revenue:'~5 200 ₴', color:'#378add'},
            {day:'Пятниця',   orders:'7–9',  revenue:'~3 800 ₴', color:'#85b7eb'},
          ].map(d=>(
            <div key={d.day} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
              <div style={{ fontSize:12, minWidth:80, fontWeight:d.peak?700:400, color:d.peak?'#1a6cf6':'#0f172a' }}>{d.day}{d.peak&&' ★'}</div>
              <div style={{ flex:1, height:6, background:'#f1f5f9', borderRadius:3, overflow:'hidden' }}>
                <div style={{ height:'100%', background:d.color, width:d.peak?'90%':d.day==='Понеділок'?'45%':d.day==='Четвер'?'75%':d.day==='Пятниця'?'55%':'65%' }}/>
              </div>
              <div style={{ fontSize:11, fontWeight:500, minWidth:70, textAlign:'right' }}>{d.revenue}</div>
            </div>
          ))}
          <div style={{ background:'#f8fafc', borderRadius:8, padding:'8px 12px', marginTop:10, display:'flex', justifyContent:'space-between', fontSize:13 }}>
            <span style={{ color:'#64748b' }}>Прогноз на тиждень:</span>
            <span style={{ fontWeight:700, color:'#1d9e75' }}>~23 500 ₴</span>
          </div>
        </div>

        {/* Chemical forecast */}
        <div style={card}>
          <div style={{ fontWeight:600, fontSize:14, marginBottom:14 }}>🧪 Прогноз запасів хімікатів</div>
          {chemicals.map(c=>(
            <div key={c.name} style={{ padding:'10px 0', borderBottom:'.5px solid #f1f5f9' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                <span style={{ fontSize:13, fontWeight:500 }}>{c.name}</span>
                <span style={{ fontSize:11, padding:'2px 8px', borderRadius:5, fontWeight:500, background:c.status==='low'?'#fef2f2':'#f0fdf4', color:c.status==='low'?'#dc2626':'#16a34a' }}>
                  {c.status==='low'?`⚠ Вистачить ~${c.days} дн.`:`✓ Запас ~${c.days} дн.`}
                </span>
              </div>
              <div style={{ height:5, borderRadius:3, background:'#f1f5f9', overflow:'hidden' }}>
                <div style={{ height:'100%', borderRadius:3, background:c.status==='low'?'#ef4444':'#1d9e75', width:`${Math.min(c.days/30*100,100)}%` }}/>
              </div>
            </div>
          ))}
          <button style={{ ...Btn('#1a6cf6','#fff','8px 14px'), marginTop:12, width:'100%', justifyContent:'center', fontSize:12 }}>🛒 Оформити замовлення хімікатів</button>
        </div>
      </div>
    </div>
  );
}

// ═══ REPORTS PAGE ═════════════════════════════════════════════════════════════
function ReportsPage({ orders, statuses }) {
  const [period, setPer] = useState('month');
  const [rep,    setRep] = useState(null);
  const [load,   setLoad]= useState(false);
  useEffect(()=>{ setLoad(true); API.getReports(period).then(setRep).catch(()=>{}).finally(()=>setLoad(false)); },[period]);
  const rev=rep?.revenue||0, paid=rep?.paidCount||0, total=rep?.totalOrders||0, avg=paid?Math.round(rev/paid):0;
  const top=rep?.topServices||[];
  const maxR=top[0]?.revenue||1;
  return (
    <div style={{ animation:'fadeIn .22s ease' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <h1 style={{ fontSize:22, fontWeight:700 }}>Звіти та аналітика</h1>
        <div style={{ display:'flex', gap:6 }}>
          {[['today','Сьогодні'],['week','Тиждень'],['month','Місяць'],['all','Весь час']].map(([v,l])=>(
            <button key={v} onClick={()=>setPer(v)} style={{ border:'.5px solid #e2e8f0', borderRadius:8, padding:'6px 14px', fontSize:12, cursor:'pointer', fontFamily:'inherit', background:period===v?'#1a6cf6':'#fff', color:period===v?'#fff':'#0f172a', fontWeight:period===v?600:400 }}>{l}</button>
          ))}
        </div>
      </div>
      {load?<div style={{ textAlign:'center', padding:40, color:'#94a3b8' }}>Завантаження…</div>:<>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:16 }}>
          {[{l:'Виручка',v:fmt$(rev),sub:`${paid} оплач.`,a:'#1d9e75'},{l:'Замовлень',v:total,sub:'усього',a:'#1a6cf6'},{l:'Середній чек',v:fmt$(avg),sub:'по оплач.',a:'#5865f2'},{l:'Повернень',v:0,sub:'скарг немає',a:'#27ae60'}].map(c=>(
            <div key={c.l} style={{ ...card, borderTop:`3px solid ${c.a}` }}>
              <div style={{ fontSize:11,color:'#64748b',marginBottom:6 }}>{c.l}</div>
              <div style={{ fontSize:24,fontWeight:700 }}>{c.v}</div>
              <div style={{ fontSize:11,color:'#94a3b8',marginTop:4 }}>{c.sub}</div>
            </div>
          ))}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1.3fr 1fr', gap:14 }}>
          <div style={card}>
            <div style={{ fontWeight:600,fontSize:14,marginBottom:14 }}>Топ послуги за виручкою</div>
            {top.length===0&&<div style={{ color:'#94a3b8',fontSize:13 }}>Немає даних</div>}
            {top.map(s=>(
              <div key={s.id} style={{ marginBottom:12 }}>
                <div style={{ display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:3 }}><span>{s.name}</span><span style={{ fontWeight:600 }}>{fmt$(s.revenue)}</span></div>
                <div style={{ height:5,borderRadius:3,background:'#f1f5f9',overflow:'hidden' }}><div style={{ height:'100%',borderRadius:3,background:'#1a6cf6',width:`${s.revenue/maxR*100}%`,transition:'width .5s' }}/></div>
                <div style={{ fontSize:10,color:'#94a3b8',marginTop:2 }}>{s.count} шт</div>
              </div>
            ))}
          </div>
          <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
            <div style={card}>
              <div style={{ fontWeight:600,fontSize:14,marginBottom:12 }}>За статусами</div>
              {(rep?.statuses||STATUSES.map(s=>({statusId:s.id,name:s.name,count:orders.filter(o=>o.statusId===s.id).length}))).map(s=>{
                const st=STATUSES.find(x=>x.id===s.statusId);
                return (
                  <div key={s.statusId} style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8 }}>
                    <span style={{ background:st?.bg,color:st?.color,borderRadius:5,padding:'3px 8px',fontSize:11,fontWeight:500 }}>{s.name}</span>
                    <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                      <div style={{ height:5,width:70,borderRadius:3,background:'#f1f5f9',overflow:'hidden' }}><div style={{ height:'100%',borderRadius:3,background:st?.color,width:`${total?s.count/total*100:0}%` }}/></div>
                      <span style={{ fontWeight:600,fontSize:13,minWidth:18 }}>{s.count}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={card}>
              <div style={{ fontWeight:600,fontSize:14,marginBottom:12 }}>Топ клієнти</div>
              {(rep?.topClients||[]).length===0&&<div style={{ color:'#94a3b8',fontSize:13 }}>Немає оплачених</div>}
              {(rep?.topClients||[]).map((c,i)=>(
                <div key={c.id} style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8 }}>
                  <div style={{ display:'flex',alignItems:'center',gap:6 }}><span style={{ fontSize:11,color:'#94a3b8',minWidth:18 }}>#{i+1}</span><span style={{ fontSize:12 }}>{(c.fullName||'').split(' ').slice(0,2).join(' ')}</span></div>
                  <div style={{ textAlign:'right' }}><div style={{ fontWeight:600,fontSize:12 }}>{fmt$(c.spent)}</div><div style={{ fontSize:10,color:'#94a3b8' }}>{c.ordersCount} замовл.</div></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </>}
    </div>
  );
}

// ═══ SERVICES PAGE ════════════════════════════════════════════════════════════
function ServicesPage({ services, onToggle, onUpdatePrice, onAdd }) {
  const [selCat,  setSC]  = useState(null);
  const [editId,  setEI]  = useState(null);
  const [editP,   setEP]  = useState('');
  const [showAdd, setSA]  = useState(false);
  const [ns,      setNS]  = useState({ name:'', categoryId:1, basePrice:'', unit:'шт' });
  const disp = services.filter(s=>!selCat||s.categoryId===selCat);
  return (
    <div style={{ animation:'fadeIn .22s ease' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          <button onClick={()=>setSC(null)} style={{ border:'none',borderRadius:6,padding:'5px 10px',fontSize:11,cursor:'pointer',fontFamily:'inherit',background:!selCat?'#1a6cf6':'#f1f5f9',color:!selCat?'#fff':'#0f172a',fontWeight:500 }}>Всі</button>
          {CATS.map((c,i)=><button key={i} onClick={()=>setSC(i+1)} style={{ border:'none',borderRadius:6,padding:'5px 10px',fontSize:11,cursor:'pointer',fontFamily:'inherit',background:selCat===i+1?'#1a6cf6':'#f1f5f9',color:selCat===i+1?'#fff':'#0f172a',fontWeight:500 }}>{c}</button>)}
        </div>
        <button style={Btn()} onClick={()=>setSA(true)}>+ Нова послуга</button>
      </div>
      <div style={card}>
        <div style={{ fontSize:11,color:'#64748b',marginBottom:10 }}>Клікніть на ціну для редагування</div>
        <table style={{ width:'100%',borderCollapse:'collapse' }}>
          <thead><tr style={{ borderBottom:'1px solid #e2e8f0' }}>
            {['Послуга','Категорія','Ціна','Одиниця','Статус','Попит','Дії'].map(h=><th key={h} style={{ textAlign:'left',padding:'7px 8px',fontSize:11,color:'#64748b',fontWeight:500 }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {disp.map(s=>(
              <tr key={s.id} style={{ borderBottom:'.5px solid #f1f5f9',opacity:s.isActive?1:0.55 }}>
                <td style={{ padding:'9px 8px',fontSize:13,fontWeight:500 }}>{s.name}</td>
                <td style={{ padding:'9px 8px' }}><span style={{ background:'#eeedfe',color:'#534ab7',borderRadius:6,padding:'2px 8px',fontSize:11,fontWeight:500 }}>{s.categoryName||CATS[(s.categoryId||1)-1]}</span></td>
                <td style={{ padding:'9px 8px' }}>
                  {editId===s.id
                    ? <div style={{ display:'flex',gap:5 }}><input type="number" value={editP} onChange={e=>setEP(e.target.value)} autoFocus style={{ ...inp,width:72,padding:'3px 7px',fontSize:12 }}/><button onClick={()=>{onUpdatePrice(s.id,Number(editP));setEI(null);}} style={{ ...BtnSm('#16a34a') }}>✓</button><button onClick={()=>setEI(null)} style={BtnSm()}>✕</button></div>
                    : <span style={{ fontWeight:700,fontSize:13,cursor:'pointer' }} onClick={()=>{setEI(s.id);setEP(s.basePrice);}}>{fmt$(s.basePrice)}</span>
                  }
                </td>
                <td style={{ padding:'9px 8px',fontSize:12,color:'#64748b' }}>{s.unit}</td>
                <td style={{ padding:'9px 8px' }}><span style={{ background:s.isActive?'#f0fdf4':'#f9fafb',color:s.isActive?'#16a34a':'#6b7280',borderRadius:6,padding:'3px 8px',fontSize:11,fontWeight:500 }}>{s.isActive?'Активна':'Неактивна'}</span></td>
                <td style={{ padding:'9px 8px' }}>
                  <div style={{ display:'flex',alignItems:'flex-end',gap:2,height:20 }}>
                    {[40,55,70,65].map((h,i)=><div key={i} style={{ width:6,borderRadius:'2px 2px 0 0',background:'#1a6cf6',opacity:.4+i*.15,height:`${h}%` }}/>)}
                  </div>
                </td>
                <td style={{ padding:'9px 8px' }}><button onClick={()=>onToggle(s.id)} style={{ ...BtnSm(s.isActive?'#a32d2d':'#16a34a') }}>{s.isActive?'Вимкнути':'Увімкнути'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showAdd&&<div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:2000,display:'flex',alignItems:'center',justifyContent:'center' }} onClick={e=>e.target===e.currentTarget&&setSA(false)}>
        <div style={{ background:'#fff',borderRadius:16,width:420,padding:26,boxShadow:'0 20px 50px rgba(0,0,0,.25)' }}>
          <div style={{ fontWeight:700,fontSize:16,marginBottom:18 }}>Нова послуга</div>
          {[{k:'name',l:'Назва',t:'text',ph:'Хімчистка куртки'},{k:'basePrice',l:'Ціна (₴)',t:'number',ph:'380'},{k:'unit',l:'Одиниця',t:'text',ph:'шт / пара / кв.м'}].map(f=>(
            <div key={f.k} style={{ marginBottom:12 }}><label style={{ display:'block',fontSize:12,fontWeight:500,marginBottom:4,color:'#64748b' }}>{f.l}</label><input type={f.t} value={ns[f.k]} placeholder={f.ph} onChange={e=>setNS(p=>({...p,[f.k]:e.target.value}))} style={inp}/></div>
          ))}
          <div style={{ marginBottom:16 }}><label style={{ display:'block',fontSize:12,fontWeight:500,marginBottom:4,color:'#64748b' }}>Категорія</label>
            <select value={ns.categoryId} onChange={e=>setNS(p=>({...p,categoryId:Number(e.target.value)}))} style={inp}>
              {CATS.map((c,i)=><option key={i} value={i+1}>{c}</option>)}
            </select>
          </div>
          <div style={{ display:'flex',gap:8,justifyContent:'flex-end' }}>
            <button onClick={()=>setSA(false)} style={Btn('#f1f5f9','#0f172a')}>Скасувати</button>
            <button style={Btn()} onClick={()=>{if(ns.name&&ns.basePrice){onAdd({...ns,basePrice:Number(ns.basePrice),isActive:true});setSA(false);setNS({name:'',categoryId:1,basePrice:'',unit:'шт'});}}}>Додати</button>
          </div>
        </div>
      </div>}
    </div>
  );
}

// ═══ SETTINGS PAGE ════════════════════════════════════════════════════════════
function SettingsPage({ user }) {
  const [settings, setSettings] = useState({
    companyName:'ТОВ Хімчистка Люкс', address:'вул. Франка, 1, Львів', phone:'+380 32 123 45 67',
    smsOnStatus:true, smsReminder:true, chemAlert:true, emailReport:false,
    aiLoyalty:true, aiForecast:true, aiMaterial:false,
  });
  const [saved, setSaved] = useState(false);
  const tog = k => setSettings(p=>({...p,[k]:!p[k]}));
  const save = () => { setSaved(true); setTimeout(()=>setSaved(false),2000); };

  const Section = ({title,icon,children}) => (
    <div style={{ background:'#fff',border:'.5px solid #e2e8f0',borderRadius:12,marginBottom:14,overflow:'hidden' }}>
      <div style={{ fontSize:12,fontWeight:600,padding:'10px 16px',borderBottom:'.5px solid #e2e8f0',background:'#f8fafc',color:'#64748b',display:'flex',alignItems:'center',gap:8 }}><span>{icon}</span>{title}</div>
      {children}
    </div>
  );
  const Row = ({label,desc,children}) => (
    <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'11px 16px',borderBottom:'.5px solid #f1f5f9' }}>
      <div><div style={{ fontSize:13,fontWeight:500 }}>{label}</div>{desc&&<div style={{ fontSize:11,color:'#94a3b8',marginTop:2 }}>{desc}</div>}</div>
      {children}
    </div>
  );
  const Toggle = ({k}) => (
    <button onClick={()=>tog(k)} style={{ width:38,height:22,borderRadius:11,background:settings[k]?'#1a6cf6':'#cbd5e1',border:'none',cursor:'pointer',position:'relative',transition:'background .2s',flexShrink:0 }}>
      <div style={{ position:'absolute',width:16,height:16,borderRadius:'50%',background:'#fff',top:3,left:settings[k]?19:3,transition:'left .2s' }}/>
    </button>
  );

  return (
    <div style={{ animation:'fadeIn .22s ease', maxWidth:700 }}>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18 }}>
        <h1 style={{ fontSize:22,fontWeight:700 }}>Налаштування</h1>
        <div style={{ display:'flex',gap:8 }}>
          {saved&&<div style={{ background:'#f0fdf4',border:'.5px solid #86efac',borderRadius:8,padding:'7px 14px',fontSize:13,color:'#16a34a',fontWeight:500 }}>✓ Збережено</div>}
          <button style={Btn()} onClick={save}>Зберегти зміни</button>
        </div>
      </div>

      <Section title="Профіль підприємства" icon="🏪">
        {[{k:'companyName',l:'Назва хімчистки'},{k:'address',l:'Адреса'},{k:'phone',l:'Телефон'}].map(f=>(
          <Row key={f.k} label={f.l}>
            <input value={settings[f.k]} onChange={e=>setSettings(p=>({...p,[f.k]:e.target.value}))} style={{ ...inp,width:220,padding:'6px 10px',fontSize:12 }}/>
          </Row>
        ))}
      </Section>

      <Section title="SMS та сповіщення" icon="🔔">
        <Row label="SMS при зміні статусу" desc="Автоматично надсилати клієнту"><Toggle k="smsOnStatus"/></Row>
        <Row label="SMS-нагадування за добу" desc="Нагадування про готовність замовлення"><Toggle k="smsReminder"/></Row>
        <Row label="Алерт низьких хімікатів" desc="Поріг: менше мінімального запасу"><Toggle k="chemAlert"/></Row>
        <Row label="Email-звіт щопонеділка" desc="Тижневий звіт на email адміністратора"><Toggle k="emailReport"/></Row>
      </Section>

      <Section title="AI-функції" icon="✦">
        <Row label="AI-аналіз лояльності" desc="Автоматичні рекомендації для утримання клієнтів"><Toggle k="aiLoyalty"/></Row>
        <Row label="AI-прогнозування завантаженості" desc="Аналіз сезонності та трендів"><Toggle k="aiForecast"/></Row>
        <Row label="AI-розпізнавання матеріалу" desc="Підбір режиму чищення за описом речі"><Toggle k="aiMaterial"/></Row>
      </Section>

      <Section title="Управління доступом" icon="👥">
        {[
          {name:'Дорошенко А.В.',     role:'Адміністратор', login:'admin',      active:true},
          {name:'Коваленко Оксана',   role:'Приймальник',   login:'kovalenko',  active:true},
          {name:'Мельник Тарас',      role:'Технолог',      login:'melnyk',     active:true},
          {name:'Бондаренко Лариса',  role:'Бухгалтер',     login:'bondarenko', active:true},
        ].map(e=>(
          <Row key={e.login} label={e.name} desc={`${e.login} · ${e.role}`}>
            <span style={{ background:e.active?'#f0fdf4':'#f9fafb',color:e.active?'#16a34a':'#6b7280',borderRadius:6,padding:'3px 10px',fontSize:11,fontWeight:500 }}>
              {e.active?'Активний':'Заблоковано'}
            </span>
          </Row>
        ))}
        <div style={{ padding:'10px 16px' }}>
          <button style={{ ...Btn(),'fontSize':12 }}>+ Додати співробітника</button>
        </div>
      </Section>
    </div>
  );
}

// ═══ ORDER MODAL ══════════════════════════════════════════════════════════════
function OrderModal({ mode, orderId, orders, clients, services, onClose, onCreate, onUpdateStatus, onPay }) {
  const ex   = orders.find(o=>o.id===orderId);
  const isV  = mode==='view';
  const [step,  setStep]  = useState(1);
  const [cId,   setCId]   = useState(ex?.clientId||null);
  const [q,     setQ]     = useState('');
  const [items, setItems] = useState(ex?.items||[]);
  const [disc,  setDisc]  = useState(ex?.discountPct||0);
  const [notes, setNotes] = useState(ex?.notes||'');
  const [dProm, setDP]    = useState(ex?.datePromised||'');
  const [selCat,setSC]    = useState(1);
  const [pm,    setPm]    = useState('card');
  const sub  = items.reduce((s,i)=>s+i.subtotal,0);
  const da   = Math.round(sub*disc/100);
  const tot  = sub-da;
  const fCl  = clients.filter(c=>(c.fullName||'').toLowerCase().includes(q.toLowerCase())||(c.phone||'').includes(q));
  const cSvc = services.filter(s=>s.categoryId===selCat&&s.isActive);
  const sCl  = clients.find(c=>c.id===cId);
  const st   = STATUSES.find(s=>s.id===ex?.statusId);
  const nx   = {1:STATUSES[1],2:STATUSES[2]}[ex?.statusId];
  const addI = s => setItems(p=>[...p,{id:uid(),serviceId:s.id,description:s.name,qty:1,unitPrice:s.basePrice,subtotal:s.basePrice}]);
  const rmI  = id => setItems(p=>p.filter(i=>i.id!==id));
  const uQ   = (id,q) => setItems(p=>p.map(i=>i.id===id?{...i,qty:Number(q),subtotal:Math.round(Number(q)*i.unitPrice)}:i));
  const uD   = (id,d) => setItems(p=>p.map(i=>i.id===id?{...i,description:d}:i));
  const doCreate = () => { if(!cId||!items.length)return; onCreate({clientId:cId,datePromised:dProm||today(),discountPct:disc,notes,items}); onClose(); };
  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:1000,display:'flex',alignItems:'flex-start',justifyContent:'center',padding:20,overflowY:'auto' }} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ background:'#fff',borderRadius:14,width:'100%',maxWidth:820,boxShadow:'0 20px 60px rgba(0,0,0,.25)',marginTop:16 }}>
        <div style={{ padding:'16px 22px',borderBottom:'.5px solid #e2e8f0',display:'flex',justifyContent:'space-between',alignItems:'center' }}>
          <div>
            <div style={{ fontWeight:700,fontSize:16 }}>{isV?`Замовлення ${ex?.orderNumber}`:'Нове замовлення'}</div>
            {isV&&st&&<span style={{ background:st.bg,color:st.color,borderRadius:6,padding:'2px 8px',fontSize:11,fontWeight:500,display:'inline-block',marginTop:3 }}>{st.name}</span>}
          </div>
          <button onClick={onClose} style={{ background:'none',border:'none',fontSize:20,cursor:'pointer',color:'#94a3b8',padding:'2px 8px' }}>✕</button>
        </div>
        <div style={{ padding:22 }}>
          {isV?(<div>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14 }}>
              <div style={{ background:'#f8fafc',borderRadius:10,padding:14 }}><div style={{ fontSize:11,color:'#64748b',marginBottom:4 }}>Клієнт</div><div style={{ fontWeight:700,fontSize:14 }}>{ex?.clientName}</div><div style={{ fontSize:12,color:'#64748b' }}>{ex?.clientPhone}</div></div>
              <div style={{ background:'#f8fafc',borderRadius:10,padding:14,display:'grid',gridTemplateColumns:'1fr 1fr',gap:8 }}>
                <div><div style={{ fontSize:10,color:'#64748b' }}>Прийнято</div><div style={{ fontSize:12,fontWeight:500 }}>{fmtD(ex?.dateReceived)}</div></div>
                <div><div style={{ fontSize:10,color:'#64748b' }}>Готово до</div><div style={{ fontSize:12,fontWeight:500 }}>{fmtD(ex?.datePromised)}</div></div>
              </div>
            </div>
            <div style={{ background:'#f8fafc',borderRadius:10,padding:14,marginBottom:12 }}>
              <div style={{ fontWeight:600,fontSize:13,marginBottom:10 }}>Склад замовлення</div>
              <table style={{ width:'100%',borderCollapse:'collapse' }}>
                <thead><tr style={{ borderBottom:'.5px solid #e2e8f0' }}>{['Опис','К-ть','Ціна','Сума'].map(h=><th key={h} style={{ textAlign:'left',padding:'4px 6px',fontSize:11,color:'#64748b' }}>{h}</th>)}</tr></thead>
                <tbody>{(ex?.items||[]).map(i=><tr key={i.id} style={{ borderBottom:'.5px solid #f1f5f9' }}><td style={{ padding:'6px',fontSize:12 }}>{i.description}</td><td style={{ padding:'6px',fontSize:12 }}>{i.qty}</td><td style={{ padding:'6px',fontSize:12 }}>{fmt$(i.unitPrice)}</td><td style={{ padding:'6px',fontSize:12,fontWeight:600 }}>{fmt$(i.subtotal)}</td></tr>)}</tbody>
              </table>
              <div style={{ textAlign:'right',fontWeight:700,fontSize:15,marginTop:8,color:'#1a6cf6' }}>Разом: {fmt$(ex?.totalAmount)}</div>
            </div>
            {ex?.notes&&<div style={{ background:'#fffbeb',border:'.5px solid #fde68a',borderRadius:8,padding:'8px 12px',marginBottom:12,fontSize:12 }}><b>Примітки:</b> {ex.notes}</div>}
            {ex?.payment?<div style={{ background:'#f0fdf4',border:'.5px solid #86efac',borderRadius:8,padding:'10px 14px' }}><span style={{ fontWeight:700,color:'#16a34a' }}>✓ Оплачено та видано</span><span style={{ fontSize:12,color:'#64748b',marginLeft:10 }}>{ex.payment.method==='card'?'Картка':'Готівка'} · {fmtD(ex.payment.date)} · {ex.payment.receipt}</span></div>:
            <div style={{ display:'flex',gap:8,justifyContent:'space-between',alignItems:'center' }}>
              <div style={{ display:'flex',gap:8 }}>
                {nx&&<button onClick={()=>{onUpdateStatus(ex.id,nx.id);onClose();}} style={Btn(nx.color)}>→ {nx.name}</button>}
                {ex?.statusId===3&&<div style={{ display:'flex',gap:6,alignItems:'center' }}>
                  <select value={pm} onChange={e=>setPm(e.target.value)} style={{ ...inp,width:'auto',padding:'7px 10px',fontSize:12 }}><option value="card">Картка</option><option value="cash">Готівка</option><option value="online">Online</option></select>
                  <button onClick={()=>{onPay(ex.id,pm);onClose();}} style={Btn('#16a34a')}>✓ Видати та прийняти оплату</button>
                </div>}
              </div>
              <button onClick={onClose} style={Btn('#f1f5f9','#0f172a')}>Закрити</button>
            </div>}
          </div>):(<div>
            <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:22 }}>
              {['Клієнт','Послуги','Підтвердження'].map((s,i)=><React.Fragment key={s}>
                <div style={{ display:'flex',alignItems:'center',gap:6 }}>
                  <div style={{ width:26,height:26,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,background:step>i+1?'#16a34a':step===i+1?'#1a6cf6':'#f1f5f9',color:step>=i+1?'#fff':'#94a3b8' }}>{step>i+1?'✓':i+1}</div>
                  <span style={{ fontSize:12,color:step===i+1?'#0f172a':'#94a3b8',fontWeight:step===i+1?600:400 }}>{s}</span>
                </div>
                {i<2&&<div style={{ flex:1,height:1,background:'#e2e8f0' }}/>}
              </React.Fragment>)}
            </div>
            {step===1&&<div>
              <input placeholder="Пошук клієнта…" value={q} onChange={e=>setQ(e.target.value)} style={{ ...inp,marginBottom:10 }}/>
              <div style={{ maxHeight:260,overflowY:'auto',border:'.5px solid #e2e8f0',borderRadius:8 }}>
                {fCl.map(c=><div key={c.id} onClick={()=>setCId(c.id)} style={{ padding:'10px 14px',cursor:'pointer',background:cId===c.id?'#eff6ff':'transparent',borderBottom:'.5px solid #f1f5f9',display:'flex',justifyContent:'space-between' }} onMouseEnter={e=>cId!==c.id&&(e.currentTarget.style.background='#f8fafc')} onMouseLeave={e=>cId!==c.id&&(e.currentTarget.style.background='transparent')}>
                  <div><div style={{ fontWeight:500,fontSize:13,color:cId===c.id?'#1a6cf6':'#0f172a' }}>{c.fullName}</div><div style={{ fontSize:11,color:'#94a3b8' }}>{c.phone}</div></div>
                  {c.loyaltyPoints>0&&<span style={{ fontSize:10,background:'#fef3e2',color:'#d97706',borderRadius:5,padding:'2px 7px',height:'fit-content' }}>★ {c.loyaltyPoints}</span>}
                </div>)}
                {fCl.length===0&&<div style={{ padding:24,textAlign:'center',color:'#94a3b8',fontSize:13 }}>Не знайдено</div>}
              </div>
              <div style={{ display:'flex',justifyContent:'flex-end',marginTop:14 }}><button onClick={()=>cId&&setStep(2)} disabled={!cId} style={{ ...Btn(),opacity:cId?1:0.4 }}>Далі →</button></div>
            </div>}
            {step===2&&<div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:18 }}>
              <div>
                <div style={{ fontWeight:600,fontSize:13,marginBottom:10 }}>Оберіть послуги</div>
                <div style={{ display:'flex',gap:5,flexWrap:'wrap',marginBottom:10 }}>
                  {CATS.map((c,i)=><button key={i} onClick={()=>setSC(i+1)} style={{ border:'none',borderRadius:6,padding:'4px 9px',fontSize:11,cursor:'pointer',fontFamily:'inherit',background:selCat===i+1?'#1a6cf6':'#f1f5f9',color:selCat===i+1?'#fff':'#0f172a',fontWeight:selCat===i+1?600:400 }}>{c}</button>)}
                </div>
                <div style={{ maxHeight:240,overflowY:'auto',display:'flex',flexDirection:'column',gap:5 }}>
                  {cSvc.map(s=><div key={s.id} onClick={()=>addI(s)} style={{ padding:'9px 12px',borderRadius:7,border:'.5px solid #e2e8f0',cursor:'pointer',display:'flex',justifyContent:'space-between',fontSize:12 }} onMouseEnter={e=>e.currentTarget.style.background='#eff6ff'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}><span>{s.name}</span><span style={{ fontWeight:600,color:'#1a6cf6' }}>{fmt$(s.basePrice)}</span></div>)}
                </div>
              </div>
              <div>
                <div style={{ fontWeight:600,fontSize:13,marginBottom:10 }}>Позиції ({items.length})</div>
                <div style={{ maxHeight:200,overflowY:'auto',marginBottom:12,display:'flex',flexDirection:'column',gap:5 }}>
                  {items.length===0&&<div style={{ color:'#94a3b8',fontSize:12,padding:'20px 0',textAlign:'center' }}>Оберіть послуги ліворуч</div>}
                  {items.map(i=><div key={i.id} style={{ padding:'8px 10px',borderRadius:7,border:'.5px solid #e2e8f0',background:'#f8fafc' }}>
                    <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center' }}><input value={i.description} onChange={e=>uD(i.id,e.target.value)} style={{ ...inp,padding:'2px 6px',fontSize:11,flex:1,marginRight:8 }}/><button onClick={()=>rmI(i.id)} style={{ background:'none',border:'none',cursor:'pointer',color:'#ef4444',fontSize:14 }}>✕</button></div>
                    <div style={{ display:'flex',justifyContent:'space-between',marginTop:5,alignItems:'center' }}><div style={{ display:'flex',alignItems:'center',gap:5 }}><span style={{ fontSize:10,color:'#94a3b8' }}>К-ть:</span><input type="number" min="0.1" step="0.1" value={i.qty} onChange={e=>uQ(i.id,e.target.value)} style={{ ...inp,width:50,padding:'2px 5px',fontSize:11 }}/></div><span style={{ fontWeight:600,fontSize:12 }}>{fmt$(i.subtotal)}</span></div>
                  </div>)}
                </div>
                <div style={{ background:'#f8fafc',borderRadius:8,padding:'10px 12px' }}>
                  <div style={{ display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:4 }}><span style={{ color:'#64748b' }}>Підсумок:</span><span>{fmt$(sub)}</span></div>
                  <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:12 }}><span style={{ color:'#64748b' }}>Знижка (%):</span><input type="number" min="0" max="50" value={disc} onChange={e=>setDisc(Number(e.target.value))} style={{ ...inp,width:52,padding:'2px 5px',fontSize:11 }}/></div>
                  <div style={{ display:'flex',justifyContent:'space-between',fontWeight:700,fontSize:14,paddingTop:8,marginTop:8,borderTop:'.5px solid #e2e8f0' }}><span>РАЗОМ:</span><span style={{ color:'#1a6cf6' }}>{fmt$(tot)}</span></div>
                </div>
                <div style={{ display:'flex',justifyContent:'space-between',marginTop:12 }}><button onClick={()=>setStep(1)} style={Btn('#f1f5f9','#0f172a')}>← Назад</button><button onClick={()=>items.length>0&&setStep(3)} disabled={!items.length} style={{ ...Btn(),opacity:items.length?1:0.4 }}>Далі →</button></div>
              </div>
            </div>}
            {step===3&&<div>
              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14 }}>
                <div style={{ background:'#f8fafc',borderRadius:10,padding:14 }}><div style={{ fontSize:11,color:'#64748b',marginBottom:4 }}>Клієнт</div><div style={{ fontWeight:700,fontSize:14 }}>{sCl?.fullName}</div><div style={{ fontSize:12,color:'#64748b' }}>{sCl?.phone}</div></div>
                <div style={{ background:'#f8fafc',borderRadius:10,padding:14 }}><div style={{ fontSize:11,color:'#64748b',marginBottom:5 }}>Дата готовності</div><input type="date" value={dProm} min={today()} onChange={e=>setDP(e.target.value)} style={inp}/></div>
              </div>
              <div style={{ marginBottom:14 }}><label style={{ display:'block',fontSize:12,fontWeight:500,marginBottom:5,color:'#64748b' }}>Примітки</label><textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2} placeholder="Особливі вимоги, плями…" style={{ ...inp,resize:'vertical' }}/></div>
              <div style={{ background:'#f8fafc',borderRadius:10,padding:14,marginBottom:14 }}>
                {items.map(i=><div key={i.id} style={{ display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:5 }}><span>{i.description} × {i.qty}</span><span style={{ fontWeight:600 }}>{fmt$(i.subtotal)}</span></div>)}
                <div style={{ borderTop:'.5px solid #e2e8f0',paddingTop:8,marginTop:6 }}>
                  {disc>0&&<div style={{ display:'flex',justifyContent:'space-between',fontSize:12,color:'#16a34a',marginBottom:4 }}><span>Знижка {disc}%</span><span>-{fmt$(da)}</span></div>}
                  <div style={{ display:'flex',justifyContent:'space-between',fontWeight:700,fontSize:15 }}><span>До сплати:</span><span style={{ color:'#1a6cf6' }}>{fmt$(tot)}</span></div>
                </div>
              </div>
              <div style={{ display:'flex',justifyContent:'space-between' }}><button onClick={()=>setStep(2)} style={Btn('#f1f5f9','#0f172a')}>← Назад</button><button onClick={doCreate} style={Btn('#16a34a')}>✓ Зберегти замовлення</button></div>
            </div>}
          </div>)}
        </div>
      </div>
    </div>
  );
}

// ═══ CLIENT MODAL ════════════════════════════════════════════════════════════
function ClientModal({ mode, client, clients, onClose, onCreate, onUpdate }) {
  const isE = mode==='edit';
  const [f,setF]     = useState(isE?{...client}:{fullName:'',phone:'',email:'',address:''});
  const [errs,setErrs]= useState({});
  const val = () => { const e={}; if(!f.fullName?.trim())e.fullName="Обов'язкове"; if(!f.phone?.trim())e.phone="Обов'язкове"; else if(!isE&&clients.find(c=>c.phone===f.phone))e.phone='Вже існує'; setErrs(e); return!Object.keys(e).length; };
  const sub = () => { if(!val())return; isE?onUpdate(f):onCreate(f); onClose(); };
  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:2000,display:'flex',alignItems:'center',justifyContent:'center' }} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ background:'#fff',borderRadius:16,width:440,padding:28,boxShadow:'0 20px 50px rgba(0,0,0,.25)' }}>
        <div style={{ display:'flex',justifyContent:'space-between',marginBottom:20 }}><div style={{ fontWeight:700,fontSize:16 }}>{isE?'Редагування':'Новий клієнт'}</div><button onClick={onClose} style={{ background:'none',border:'none',fontSize:20,cursor:'pointer',color:'#94a3b8' }}>✕</button></div>
        {[{k:'fullName',l:"ПІБ *",ph:'Іваненко Марія Олексіївна',t:'text'},{k:'phone',l:'Телефон *',ph:'+380671234567',t:'tel'},{k:'email',l:'Email',ph:'example@gmail.com',t:'email'},{k:'address',l:'Адреса',ph:'вул. Франка, 12',t:'text'}].map(fi=>(
          <div key={fi.k} style={{ marginBottom:14 }}>
            <label style={{ display:'block',fontSize:12,fontWeight:500,color:'#64748b',marginBottom:5 }}>{fi.l}</label>
            <input type={fi.t} value={f[fi.k]||''} placeholder={fi.ph} onChange={e=>setF(p=>({...p,[fi.k]:e.target.value}))} style={{ ...inp,border:errs[fi.k]?'.5px solid #ef4444':undefined }}/>
            {errs[fi.k]&&<div style={{ fontSize:11,color:'#ef4444',marginTop:3 }}>{errs[fi.k]}</div>}
          </div>
        ))}
        <div style={{ display:'flex',gap:8,justifyContent:'flex-end',marginTop:18 }}>
          <button onClick={onClose} style={Btn('#f1f5f9','#0f172a')}>Скасувати</button>
          <button onClick={sub} style={Btn()}>{isE?'Зберегти':'Зареєструвати'}</button>
        </div>
      </div>
    </div>
  );
}

// ═══ MAIN APP ════════════════════════════════════════════════════════════════
const PAGE_TITLES = {
  dashboard:'Дашборд', orders:'Замовлення', kanban:'Kanban дошка',
  clients:'Клієнти', loyalty:'Програма лояльності', technologist:'Панель технолога',
  forecast:'AI Прогнозування', reports:'Звіти', services:'Прейскурант', settings:'Налаштування',
};

function MainApp() {
  const { user, logout } = useAuth();
  const [orders,   setOrders]   = useState([]);
  const [clients,  setClients]  = useState([]);
  const [services, setServices] = useState([]);
  const [loading,  setLoad]     = useState(true);
  const [err,      setErr]      = useState(null);
  const [page,     setPage]     = useState('dashboard');
  const [modal,    setModal]    = useState(null);
  const [notif,    setNotif]    = useState(null);

  const notify = (msg, type='success') => { setNotif({msg,type}); setTimeout(()=>setNotif(null),3500); };

  const loadAll = useCallback(async () => {
    if (!user) return;
    try { setLoad(true); setErr(null);
      const [o,c,s] = await Promise.all([API.getOrders(), API.getClients(), API.getServices()]);
      setOrders(o); setClients(c); setServices(s);
    } catch(e) { setErr(e.message); } finally { setLoad(false); }
  }, [user]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const createOrder  = async d  => { try { const o=await API.createOrder(d);              setOrders(p=>[o,...p]);     notify(`Замовлення ${o.orderNumber} створено`); } catch(e) { notify(e.message,'error'); } };
  const updateStatus = async (id,s) => { try { const o=await API.updateStatus(id,s);      setOrders(p=>p.map(x=>x.id===o.id?o:x)); notify('Статус оновлено'); }               catch(e) { notify(e.message,'error'); } };
  const payOrder     = async (id,m) => { try { const o=await API.payOrder(id,m);           setOrders(p=>p.map(x=>x.id===o.id?o:x)); notify('Оплату прийнято'); }               catch(e) { notify(e.message,'error'); } };
  const createClient = async d  => { try { const c=await API.createClient(d);              setClients(p=>[c,...p]);    notify('Клієнта зареєстровано'); }                      catch(e) { notify(e.message,'error'); } };
  const updateClient = async d  => { try { const c=await API.updateClient(d.id,d);         setClients(p=>p.map(x=>x.id===c.id?c:x)); notify('Дані оновлено'); }               catch(e) { notify(e.message,'error'); } };
  const toggleSvc    = async id => { try { const s=await API.toggleService(id);            setServices(p=>p.map(x=>x.id===s.id?{...x,...s}:x)); }                             catch(e) { notify(e.message,'error'); } };
  const updatePrice  = async (id,p) => { try { const s=await API.updatePrice(id,p);       setServices(q=>q.map(x=>x.id===s.id?{...x,...s}:x)); notify('Ціну оновлено'); }    catch(e) { notify(e.message,'error'); } };
  const addService   = async d  => { try { const s=await API.addService(d);               setServices(p=>[...p,s]); notify('Послугу додано'); }                              catch(e) { notify(e.message,'error'); } };

  const active = orders.filter(o=>o.statusId!==4);
  const ready  = orders.filter(o=>o.statusId===3);
  const tod    = orders.filter(o=>o.dateReceived===today());

  return (
    <div style={{ display:'flex', minHeight:'100vh' }}>
      <Sidebar page={page} setPage={setPage} user={user} onLogout={logout} activeCount={active.length} readyCount={ready.length}/>
      <div style={{ flex:1, display:'flex', flexDirection:'column', minHeight:'100vh' }}>
        {/* Topbar */}
        <div style={{ background:'#fff', borderBottom:'.5px solid #e2e8f0', padding:'0 24px', height:54, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0, boxShadow:'0 1px 3px rgba(0,0,0,.04)' }}>
          <span style={{ fontSize:16, fontWeight:700 }}>{PAGE_TITLES[page]}</span>
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            <span style={{ fontSize:12, color:'#64748b' }}>{user?.name} · {user?.role}</span>
            <button style={Btn()} onClick={()=>setModal({type:'order',mode:'new'})}>+ Нове замовлення</button>
          </div>
        </div>
        {/* Content */}
        <div style={{ flex:1, padding:'22px 24px', background:'#f1f5f9', overflowY:'auto' }}>
          {err && <div style={{ background:'#fef2f2', border:'1px solid #fca5a5', borderRadius:10, padding:'12px 18px', marginBottom:14, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ color:'#dc2626', fontSize:13 }}>❌ {err}</span>
            <button onClick={loadAll} style={{ background:'#dc2626', color:'#fff', border:'none', borderRadius:6, padding:'5px 12px', fontSize:12, cursor:'pointer' }}>Повторити</button>
          </div>}
          {loading ? <Spinner/> : (
            <div key={page} style={{ animation:'fadeIn .22s ease' }}>
              {page==='dashboard'    && <DashboardPage    orders={orders} clients={clients} activeOrders={active} readyOrders={ready} todayOrders={tod} onNew={()=>setModal({type:'order',mode:'new'})} onView={id=>setModal({type:'order',mode:'view',orderId:id})}/>}
              {page==='orders'       && <OrdersPage       orders={orders} onNew={()=>setModal({type:'order',mode:'new'})} onView={id=>setModal({type:'order',mode:'view',orderId:id})} onUpdateStatus={updateStatus} onPay={payOrder}/>}
              {page==='kanban'       && <KanbanPage       orders={orders} onNew={()=>setModal({type:'order',mode:'new'})} onView={id=>setModal({type:'order',mode:'view',orderId:id})} onUpdateStatus={updateStatus} onPay={payOrder}/>}
              {page==='clients'      && <ClientsPage      clients={clients} orders={orders} onNew={()=>setModal({type:'client',mode:'new'})} onEdit={c=>setModal({type:'client',mode:'edit',client:c})}/>}
              {page==='loyalty'      && <LoyaltyPage      clients={clients} orders={orders}/>}
              {page==='technologist' && <TechPage         orders={orders} onUpdateStatus={updateStatus}/>}
              {page==='forecast'     && <ForecastPage     orders={orders}/>}
              {page==='reports'      && <ReportsPage      orders={orders} statuses={STATUSES}/>}
              {page==='services'     && <ServicesPage     services={services} onToggle={toggleSvc} onUpdatePrice={updatePrice} onAdd={addService}/>}
              {page==='settings'     && <SettingsPage     user={user}/>}
            </div>
          )}
        </div>
      </div>

      {modal?.type==='order'  && <OrderModal  {...modal} orders={orders} clients={clients} services={services} onClose={()=>setModal(null)} onCreate={createOrder} onUpdateStatus={updateStatus} onPay={payOrder}/>}
      {modal?.type==='client' && <ClientModal {...modal} clients={clients} onClose={()=>setModal(null)} onCreate={createClient} onUpdate={updateClient}/>}
      <Toast n={notif}/>
    </div>
  );
}

// ═══ ROOT ════════════════════════════════════════════════════════════════════
function AppRouter() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner/>;
  if (!user)   return <LoginPage/>;
  return <MainApp/>;
}

export default function App() {
  return <AuthProvider><AppRouter/></AuthProvider>;
}
