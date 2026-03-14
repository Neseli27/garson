import { useState, useRef, useEffect, useCallback } from "react";

// ── API BASE ────────────────────────────────────────────────
// Vercel env variable olarak set edilecek
const API = import.meta.env.VITE_API_BASE || "https://testokulu.com/garson-api";

/* ══════════════════════════════════════════════════════════
   GLOBAL STYLES
══════════════════════════════════════════════════════════ */
const GS = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700&family=Crimson+Pro:ital,wght@0,300;0,400;0,600&display=swap');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    :root{
      --bg:#0b0704;--surf:#160e08;--surf2:#1f1409;
      --bord:rgba(210,160,70,0.15);--gold:#c9913a;--gsoft:#e8b86d;
      --gdim:rgba(201,145,58,0.22);--cream:#f0ddc4;--muted:#7a6448;
      --red:#c04040;--green:#3a8a5c;--blue:#3a6a9a;
      --fh:'Playfair Display',serif;--fb:'Crimson Pro',serif;
    }
    body{background:var(--bg);color:var(--cream);font-family:var(--fb)}
    input,textarea,button,select{font-family:var(--fb)}
    ::-webkit-scrollbar{width:4px}
    ::-webkit-scrollbar-thumb{background:var(--gdim);border-radius:2px}
    @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
    @keyframes fadeIn{from{opacity:0}to{opacity:1}}
    @keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(192,64,64,.6)}50%{box-shadow:0 0 0 14px rgba(192,64,64,0)}}
    @keyframes waveBar{0%,100%{transform:scaleY(.3)}50%{transform:scaleY(1)}}
    @keyframes glow{0%,100%{opacity:.4}50%{opacity:1}}
    @keyframes bounce{0%{transform:scale(.8);opacity:0}60%{transform:scale(1.05)}100%{transform:scale(1);opacity:1}}
    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes blink{0%,100%{opacity:1}50%{opacity:.4}}
    @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
    @keyframes slideIn{from{opacity:0;transform:translateX(-14px)}to{opacity:1;transform:translateX(0)}}
  `}</style>
);

/* ══════════════════════════════════════════════════════════
   API HELPERS
══════════════════════════════════════════════════════════ */
const api = {
  get:  (path)           => fetch(`${API}/${path}`).then(r => r.json()),
  post: (path, data)     => fetch(`${API}/${path}`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(data) }).then(r => r.json()),
};

/* ══════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════ */
const ts = () => new Date().toLocaleTimeString("tr-TR", { hour:"2-digit", minute:"2-digit" });

const parseOrder = t => {
  const m = t.match(/###SIPARIS###\s*([\s\S]*?)\s*###BITIS###/);
  if (!m) return null; try { return JSON.parse(m[1]); } catch { return null; }
};
const cleanText = t => t.replace(/###SIPARIS###[\s\S]*?###BITIS###/g, "").trim();

const playBeep = (freq = 880, dur = 0.35, n = 1) => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    for (let i = 0; i < n; i++) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = "sine"; o.frequency.value = freq;
      const t = ctx.currentTime + i * (dur + 0.12);
      g.gain.setValueAtTime(.45, t);
      g.gain.exponentialRampToValueAtTime(.001, t + dur);
      o.start(t); o.stop(t + dur + .01);
    }
  } catch {}
};

/* ══════════════════════════════════════════════════════════
   SMALL COMPONENTS
══════════════════════════════════════════════════════════ */
const Wave = ({ active }) => (
  <div style={{ display:"flex", gap:3, alignItems:"center", height:20 }}>
    {[0,.1,.2,.3,.4].map((d,i) => (
      <div key={i} style={{ width:3, height:"100%", background:"#fff", borderRadius:2, transformOrigin:"center",
        animation: active ? `waveBar .8s ease-in-out ${d}s infinite` : "none",
        transform: active ? undefined : "scaleY(.3)", opacity: active ? 1 : .5 }} />
    ))}
  </div>
);

const Dots = () => (
  <span style={{ display:"inline-flex", gap:4, alignItems:"center", marginLeft:4 }}>
    {[0,.2,.4].map((d,i) => (
      <span key={i} style={{ width:6, height:6, borderRadius:"50%", background:"var(--gold)", display:"block",
        animation:`glow 1s ease-in-out ${d}s infinite` }} />
    ))}
  </span>
);

const StatusBadge = ({ status }) => {
  const map = {
    bekliyor: { label:"Bekliyor", color:"#6aaae0", bg:"rgba(58,106,154,.2)" },
    aktif:    { label:"Aktif",    color:"#3aaa6a", bg:"rgba(58,138,92,.2)"  },
    askida:   { label:"Askıda",   color:"var(--gsoft)", bg:"rgba(201,145,58,.2)" },
    engelli:  { label:"Engelli",  color:"#e06060", bg:"rgba(192,64,64,.2)"  },
  };
  const s = map[status] || map.bekliyor;
  return <span style={{ fontSize:12, padding:"3px 12px", borderRadius:20, background:s.bg, color:s.color, fontWeight:600 }}>{s.label}</span>;
};

const Inp = ({ label, value, onChange, type="text", placeholder, maxLength }) => (
  <div style={{ marginBottom:14 }}>
    {label && <div style={{ fontSize:12, color:"var(--muted)", marginBottom:5, letterSpacing:.8, fontFamily:"var(--fh)" }}>{label}</div>}
    <input type={type} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} maxLength={maxLength}
      style={{ width:"100%", background:"var(--surf2)", border:"1px solid var(--bord)", borderRadius:12,
        padding:"13px 16px", color:"var(--cream)", fontSize:16, outline:"none", transition:"border-color .2s" }}
      onFocus={e => e.target.style.borderColor = "var(--gdim)"}
      onBlur={e => e.target.style.borderColor = "var(--bord)"}
    />
  </div>
);

/* ══════════════════════════════════════════════════════════
   REGISTER SCREEN
══════════════════════════════════════════════════════════ */
const RegisterScreen = ({ onRegister, blockedMsg }) => {
  const [ad, setAd]     = useState("");
  const [masa, setMasa] = useState("");
  const [tel, setTel]   = useState("");
  const [err, setErr]   = useState(blockedMsg || "");
  const [loading, setLoading] = useState(false);

  if (blockedMsg) return (
    <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background:"var(--bg)", padding:28 }}>
      <GS />
      <div style={{ fontSize:60, marginBottom:20 }}>🚫</div>
      <div style={{ fontFamily:"var(--fh)", fontSize:22, color:"#e06060", marginBottom:12, textAlign:"center" }}>Erişiminiz Kısıtlandı</div>
      <div style={{ fontSize:14, color:"var(--muted)", textAlign:"center" }}>Lütfen işletme personeline başvurun.</div>
    </div>
  );

  const submit = async () => {
    if (!ad.trim())   return setErr("Lütfen adınızı girin.");
    if (!masa.trim()) return setErr("Masa numarası gerekli.");
    if (!tel.trim() || tel.replace(/\D/g,"").length < 10) return setErr("Geçerli telefon numarası girin.");
    setErr(""); setLoading(true);
    try {
      const res = await api.post("session.php", { action:"register", ad:ad.trim(), masa:parseInt(masa), tel:tel.trim() });
      if (res.error === "engelli") return setErr("Erişiminiz kısıtlandı.");
      if (res.error) return setErr("Kayıt başarısız, tekrar deneyin.");
      // Session'ı localStorage'a kaydet
      localStorage.setItem("sg_session_id", res.session.id);
      onRegister(res.session);
    } catch { setErr("Bağlantı hatası, tekrar deneyin."); }
    setLoading(false);
  };

  return (
    <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", background:"var(--bg)" }}>
      <GS />
      <div style={{ position:"fixed", inset:0, background:"radial-gradient(ellipse 70% 55% at 50% 30%, rgba(201,145,58,.07) 0%, transparent 70%)", pointerEvents:"none" }} />
      <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"28px 24px", position:"relative", zIndex:1 }}>
        <div style={{ width:72, height:72, borderRadius:"50%", background:"linear-gradient(135deg,var(--gold) 0%,#6b3d10 100%)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:36, marginBottom:18, boxShadow:"0 0 36px rgba(201,145,58,.32)", animation:"float 4s ease-in-out infinite" }}>🍽️</div>
        <div style={{ fontFamily:"var(--fh)", fontSize:26, color:"var(--cream)", marginBottom:4, textAlign:"center" }}>Bistro 7</div>
        <div style={{ fontSize:13, color:"var(--muted)", fontStyle:"italic", marginBottom:32, textAlign:"center" }}>Hoş geldiniz — bir dakika ayırın</div>
        <div style={{ width:"100%", maxWidth:360 }}>
          <Inp label="ADINIZ SOYADINIZ" value={ad} onChange={setAd} placeholder="Ahmet Yılmaz" maxLength={50} />
          <Inp label="MASA NUMARASI" value={masa} onChange={setMasa} type="number" placeholder="7" />
          <Inp label="TELEFON NUMARASI" value={tel} onChange={setTel} type="tel" placeholder="05xx xxx xx xx" maxLength={15} />
          {err && <div style={{ padding:"10px 14px", background:"rgba(192,64,64,.15)", border:"1px solid rgba(192,64,64,.35)", borderRadius:10, fontSize:13.5, color:"#e06060", marginBottom:14, animation:"fadeIn .2s" }}>⚠️ {err}</div>}
          <button onClick={submit} disabled={loading} style={{ width:"100%", padding:"15px 20px", background:loading?"var(--surf2)":"linear-gradient(135deg,var(--gold) 0%,#8b5e2a 100%)", border:"none", borderRadius:14, color:loading?"var(--muted)":"#0b0704", cursor:loading?"not-allowed":"pointer", fontFamily:"var(--fh)", fontSize:18, fontWeight:600, boxShadow:loading?"none":"0 4px 20px rgba(201,145,58,.3)", transition:"all .3s", display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
            {loading ? <><div style={{ width:18, height:18, borderRadius:"50%", border:"2px solid var(--muted)", borderTopColor:"transparent", animation:"spin .8s linear infinite" }} /> Kaydediliyor</> : "Masama Otur →"}
          </button>
          <div style={{ marginTop:18, padding:"12px 16px", background:"var(--surf2)", border:"1px solid var(--bord)", borderRadius:12, fontSize:13, color:"var(--muted)", lineHeight:1.65 }}>
            ℹ️ Bilgileriniz yalnızca bu ziyaret süresince kullanılır.
          </div>
        </div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════
   WAITING SCREEN
══════════════════════════════════════════════════════════ */
const WaitingScreen = ({ session }) => (
  <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background:"var(--bg)", padding:28 }}>
    <GS />
    <div style={{ position:"relative", width:100, height:100, marginBottom:28 }}>
      {[0,1,2].map(i => <div key={i} style={{ position:"absolute", inset:0, borderRadius:"50%", border:"2px solid rgba(201,145,58,.4)", animation:`spin ${2+i*.5}s linear infinite`, transform:`scale(${1+i*.2})` }} />)}
      <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:38 }}>⏳</div>
    </div>
    <div style={{ fontFamily:"var(--fh)", fontSize:22, color:"var(--cream)", marginBottom:8, textAlign:"center" }}>Onay Bekleniyor</div>
    <div style={{ fontSize:15, color:"var(--muted)", fontStyle:"italic", textAlign:"center", lineHeight:1.75, marginBottom:28 }}>
      Merhaba <strong style={{ color:"var(--gsoft)" }}>{session.ad}</strong>,<br />garsonumuz sizi görecek ve<br />hesabınızı aktive edecek.
    </div>
    <div style={{ padding:"16px 24px", background:"var(--surf2)", border:"1px solid var(--bord)", borderRadius:16, display:"flex", gap:24 }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:11, color:"var(--muted)", marginBottom:4 }}>MASA</div>
        <div style={{ fontFamily:"var(--fh)", fontSize:26, color:"var(--gsoft)" }}>{session.masa}</div>
      </div>
      <div style={{ width:1, background:"var(--bord)" }} />
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:11, color:"var(--muted)", marginBottom:4 }}>DURUM</div>
        <StatusBadge status="bekliyor" />
      </div>
    </div>
    <div style={{ marginTop:24, display:"flex", alignItems:"center", gap:8, color:"var(--muted)", fontSize:13, fontStyle:"italic", animation:"blink 2s ease-in-out infinite" }}>
      <div style={{ width:7, height:7, borderRadius:"50%", background:"#6aaae0" }} />
      Garsonunuz geliyor...
    </div>
  </div>
);

/* ══════════════════════════════════════════════════════════
   SUSPENDED SCREEN
══════════════════════════════════════════════════════════ */
const SuspendedScreen = ({ session }) => (
  <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background:"var(--bg)", padding:28 }}>
    <GS />
    <div style={{ fontSize:60, marginBottom:20, animation:"float 3s ease-in-out infinite" }}>⏸️</div>
    <div style={{ fontFamily:"var(--fh)", fontSize:24, color:"var(--cream)", marginBottom:10, textAlign:"center" }}>Oturumunuz Askıda</div>
    <div style={{ fontSize:15, color:"var(--muted)", fontStyle:"italic", textAlign:"center", lineHeight:1.7, marginBottom:28 }}>
      Merhaba <strong style={{ color:"var(--gsoft)" }}>{session.ad}</strong>,<br />
      hesabınız kapatıldı. Tekrar hoş geldiniz demek için<br />garsonumuzu çağırın.
    </div>
    <div style={{ padding:"14px 22px", background:"var(--gdim)", border:"1px solid var(--bord)", borderRadius:14, textAlign:"center" }}>
      <div style={{ fontSize:12, color:"var(--muted)", marginBottom:4 }}>Masa</div>
      <div style={{ fontFamily:"var(--fh)", fontSize:28, color:"var(--gsoft)" }}>{session.masa}</div>
    </div>
  </div>
);

/* ══════════════════════════════════════════════════════════
   CHAT BUBBLE
══════════════════════════════════════════════════════════ */
const Bubble = ({ msg, isLatest }) => {
  const isUser = msg.role === "user";
  const content = cleanText(msg.content);
  const order = parseOrder(msg.content);
  return (
    <div style={{ display:"flex", flexDirection:isUser?"row-reverse":"row", gap:9, alignItems:"flex-end", marginBottom:15, animation:isLatest?"fadeUp .3s ease-out":"none" }}>
      {!isUser && <div style={{ width:34, height:34, borderRadius:"50%", flexShrink:0, background:"linear-gradient(135deg,var(--gold) 0%,#8b5e2a 100%)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:17, boxShadow:"0 2px 12px rgba(201,145,58,.28)" }}>🍽️</div>}
      <div style={{ maxWidth:"76%", display:"flex", flexDirection:"column", alignItems:isUser?"flex-end":"flex-start" }}>
        <div style={{ padding:"11px 15px", background:isUser?"linear-gradient(135deg,var(--gold) 0%,#8b5e2a 100%)":"var(--surf2)", border:isUser?"none":"1px solid var(--bord)", borderRadius:isUser?"18px 18px 4px 18px":"18px 18px 18px 4px", color:isUser?"#0b0704":"var(--cream)", fontSize:15.5, lineHeight:1.55, fontWeight:isUser?600:300, whiteSpace:"pre-wrap" }}>{content}</div>
        {order && (
          <div style={{ marginTop:9, padding:"12px 14px", background:"rgba(58,138,92,.13)", border:"1px solid rgba(58,138,92,.4)", borderRadius:12, width:"100%", animation:"bounce .5s ease-out" }}>
            <div style={{ color:"#3aaa6a", fontFamily:"var(--fh)", fontSize:12, marginBottom:7 }}>✅ SİPARİŞ İLETİLDİ — MASA {order.masa}</div>
            {order.urunler.map((u,i) => (
              <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:13.5, color:"var(--cream)", marginBottom:3 }}>
                <span>{u.adet}× {u.ad} <span style={{ color:"var(--muted)", fontSize:11 }}>~{u.bekleme}dk</span></span>
                <span style={{ color:"var(--gsoft)" }}>{u.adet*u.fiyat}₺</span>
              </div>
            ))}
            <div style={{ borderTop:"1px solid rgba(58,138,92,.3)", marginTop:7, paddingTop:7, display:"flex", justifyContent:"space-between" }}>
              <span style={{ fontFamily:"var(--fh)", color:"#3aaa6a", fontSize:13 }}>Toplam</span>
              <span style={{ fontFamily:"var(--fh)", color:"var(--gsoft)", fontSize:15 }}>{order.toplam}₺</span>
            </div>
          </div>
        )}
        <div style={{ fontSize:11, color:"var(--muted)", marginTop:3 }}>{msg.time}</div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════
   MENU VIEW
══════════════════════════════════════════════════════════ */
const MenuView = ({ menu, specials }) => {
  const [open, setOpen] = useState(Object.keys(menu)[0] || "");
  return (
    <div style={{ overflowY:"auto", height:"100%", padding:"12px 14px" }}>
      {specials.length > 0 && (
        <div style={{ marginBottom:14, padding:"13px 15px", background:"linear-gradient(135deg,rgba(201,145,58,.18) 0%,rgba(139,94,42,.08) 100%)", border:"1px solid rgba(201,145,58,.4)", borderRadius:14 }}>
          <div style={{ fontFamily:"var(--fh)", fontSize:14, color:"var(--gsoft)", marginBottom:9 }}>⭐ Günün Özel Menüsü</div>
          {specials.map((s,i) => (
            <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:i<specials.length-1?"1px solid var(--bord)":"none" }}>
              <div><div style={{ fontSize:14, color:"var(--cream)" }}>{s.name}</div><div style={{ fontSize:11.5, color:"var(--muted)", fontStyle:"italic" }}>{s.desc}</div></div>
              <div style={{ fontFamily:"var(--fh)", color:"var(--gsoft)", fontSize:15, marginLeft:12, flexShrink:0 }}>{s.price}₺</div>
            </div>
          ))}
        </div>
      )}
      {Object.entries(menu).map(([cat, items]) => (
        <div key={cat} style={{ marginBottom:9 }}>
          <button onClick={() => setOpen(open===cat?null:cat)} style={{ width:"100%", background:open===cat?"var(--gdim)":"var(--surf2)", border:"1px solid var(--bord)", borderRadius:10, padding:"11px 15px", color:"var(--cream)", cursor:"pointer", display:"flex", justifyContent:"space-between", fontFamily:"var(--fh)", fontSize:14, transition:"all .2s" }}>
            <span>{cat}</span><span style={{ color:"var(--gold)", fontSize:11 }}>{open===cat?"▲":"▼"}</span>
          </button>
          {open===cat && items.map((item,i) => (
            <div key={item.id} style={{ display:"flex", justifyContent:"space-between", padding:"9px 12px", borderBottom:i<items.length-1?"1px solid var(--bord)":"none", animation:`slideIn .2s ease-out ${i*.04}s both` }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14.5, color:"var(--cream)" }}>{item.name}</div>
                {item.desc && <div style={{ fontSize:12, color:"var(--muted)", fontStyle:"italic", marginTop:2 }}>{item.desc}</div>}
                <div style={{ fontSize:11, color:"var(--gold)", marginTop:2 }}>⏱ ~{item.wait} dk</div>
              </div>
              <div style={{ fontFamily:"var(--fh)", fontSize:15, color:"var(--gsoft)", marginLeft:12, flexShrink:0, fontWeight:600 }}>{item.price}₺</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

/* ══════════════════════════════════════════════════════════
   TABLE VIEW
══════════════════════════════════════════════════════════ */
const TableView = ({ session, tableOrders, onCallWaiter, onBill }) => {
  const [payModal, setPayModal] = useState(false);
  const [pay, setPay] = useState(null);
  const total = tableOrders.reduce((s,o) => s + (o.toplam||0), 0);
  return (
    <div style={{ height:"100%", overflowY:"auto", padding:14 }}>
      <div style={{ padding:"12px 15px", background:"var(--surf2)", border:"1px solid var(--bord)", borderRadius:14, marginBottom:12, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <div style={{ fontFamily:"var(--fh)", fontSize:15, color:"var(--cream)" }}>{session.ad}</div>
          <div style={{ fontSize:12, color:"var(--muted)" }}>Masa {session.masa}</div>
        </div>
        <StatusBadge status={session.durum} />
      </div>
      <button onClick={onCallWaiter} style={{ width:"100%", padding:"13px 18px", marginBottom:12, background:"rgba(58,106,154,.15)", border:"1px solid rgba(58,106,154,.45)", borderRadius:14, color:"#6aaae0", cursor:"pointer", fontFamily:"var(--fh)", fontSize:15 }}>🔔 Garson Çağır</button>
      {tableOrders.length === 0
        ? <div style={{ textAlign:"center", color:"var(--muted)", marginTop:50 }}><div style={{ fontSize:36 }}>🍽️</div><div style={{ marginTop:12, fontSize:14, fontStyle:"italic" }}>Henüz sipariş yok</div></div>
        : <>
          {tableOrders.map(o => (
            <div key={o.id} style={{ marginBottom:11, padding:"12px 14px", background:"var(--surf2)", border:"1px solid var(--bord)", borderRadius:14 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:7 }}>
                <span style={{ fontSize:12, color:"var(--muted)" }}>🕐 {o.created_at?.slice(11,16)||o.time||""}</span>
                <span style={{ fontSize:12, padding:"2px 10px", borderRadius:20, background:o.status==="yeni"?"rgba(192,64,64,.2)":o.status==="hazırlanıyor"?"rgba(201,145,58,.2)":"rgba(58,138,92,.2)", color:o.status==="yeni"?"#e06060":o.status==="hazırlanıyor"?"var(--gsoft)":"#3aaa6a" }}>{o.status}</span>
              </div>
              {(o.urunler||[]).map((u,i) => (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:14, color:"var(--cream)", padding:"2px 0" }}>
                  <span>{u.adet}× {u.ad}</span><span style={{ color:"var(--gsoft)" }}>{u.adet*u.fiyat}₺</span>
                </div>
              ))}
            </div>
          ))}
          <div style={{ padding:"13px 16px", background:"var(--gdim)", border:"1px solid var(--bord)", borderRadius:14, display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:13 }}>
            <span style={{ fontFamily:"var(--fh)", color:"var(--cream)", fontSize:15 }}>Toplam</span>
            <span style={{ fontFamily:"var(--fh)", color:"var(--gsoft)", fontSize:22 }}>{total}₺</span>
          </div>
          <button onClick={() => setPayModal(true)} style={{ width:"100%", padding:"13px 18px", background:"linear-gradient(135deg,var(--gold) 0%,#8b5e2a 100%)", border:"none", borderRadius:14, color:"#0b0704", cursor:"pointer", fontFamily:"var(--fh)", fontSize:16, fontWeight:600 }}>💳 Hesap İstiyorum</button>
        </>
      }
      {payModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.85)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:200, backdropFilter:"blur(4px)" }}>
          <div style={{ width:"100%", maxWidth:480, background:"var(--surf)", borderRadius:"22px 22px 0 0", padding:"22px 18px 38px", animation:"fadeUp .3s ease-out" }}>
            <div style={{ fontFamily:"var(--fh)", fontSize:19, color:"var(--cream)", marginBottom:3 }}>Ödeme Yöntemi</div>
            <div style={{ fontSize:13, color:"var(--muted)", fontStyle:"italic", marginBottom:18 }}>Nasıl ödemek istersiniz?</div>
            {[{id:"nakit",icon:"💵",label:"Nakit"},{id:"kart",icon:"💳",label:"Kredi / Banka Kartı"},{id:"qr",icon:"📱",label:"QR Kod ile Ödeme"}].map(p => (
              <button key={p.id} onClick={() => setPay(p.id)} style={{ width:"100%", padding:"12px 17px", marginBottom:9, background:pay===p.id?"var(--gdim)":"var(--surf2)", border:`1px solid ${pay===p.id?"var(--gold)":"var(--bord)"}`, borderRadius:13, color:"var(--cream)", cursor:"pointer", display:"flex", alignItems:"center", gap:13, fontSize:15, transition:"all .2s" }}>
                <span style={{ fontSize:22 }}>{p.icon}</span><span>{p.label}</span>
                {pay===p.id && <span style={{ marginLeft:"auto", color:"var(--gold)" }}>✓</span>}
              </button>
            ))}
            <div style={{ display:"flex", gap:9, marginTop:7 }}>
              <button onClick={() => setPayModal(false)} style={{ flex:1, padding:"11px", background:"var(--surf2)", border:"1px solid var(--bord)", borderRadius:12, color:"var(--muted)", cursor:"pointer", fontSize:14 }}>Vazgeç</button>
              <button disabled={!pay} onClick={() => { onBill(pay,total); setPayModal(false); setPay(null); }} style={{ flex:2, padding:"11px", background:pay?"linear-gradient(135deg,var(--gold) 0%,#8b5e2a 100%)":"var(--surf2)", border:"none", borderRadius:12, color:pay?"#0b0704":"var(--muted)", cursor:pay?"pointer":"not-allowed", fontFamily:"var(--fh)", fontSize:15, fontWeight:600, transition:"all .2s" }}>Hesabı İste ✓</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════════════════
   CUSTOMER CHAT
══════════════════════════════════════════════════════════ */
const CustomerChat = ({ session, menu, specials, tableOrders, setTableOrders, onViewGarson }) => {
  const [msgs, setMsgs]         = useState([{ role:"assistant", content:`Hoş geldiniz ${session.ad}! 🌟 Masa ${session.masa}'te bu akşam size eşlik edeceğim.${specials.length?" Bugün özel menümüz de var!":""} Ne arzu ederdiniz?`, id:1, time:ts() }]);
  const [input, setInput]       = useState("");
  const [listening, setListening] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [tab, setTab]           = useState("chat");
  const endRef  = useRef(null);
  const recRef  = useRef(null);
  const taRef   = useRef(null);
  const convRef = useRef([]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior:"smooth" }); }, [msgs]);

  // Poll siparişler
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await api.get(`order.php?session_id=${session.id}`);
        if (res.orders) setTableOrders(res.orders);
      } catch {}
    };
    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [session.id]);

  const speak = useCallback(text => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(cleanText(text));
    u.lang = "tr-TR"; u.rate = 1.05;
    u.onstart = () => setSpeaking(true);
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
  }, []);

  const send = useCallback(async text => {
    if (!text.trim() || loading) return;
    setMsgs(p => [...p, { role:"user", content:text, id:Date.now(), time:ts() }]);
    setInput(""); if (taRef.current) taRef.current.style.height = "auto";
    setLoading(true);
    convRef.current = [...convRef.current, { role:"user", content:text }];
    try {
      const res = await api.post("chat.php", { session_id:session.id, messages:convRef.current, menu, specials });
      if (res.error === "SESSION_INACTIVE") {
        setMsgs(p => [...p, { role:"assistant", content:"Oturumunuz sonlandırılmış. Garsonumuzu çağırın.", id:Date.now(), time:ts() }]);
        setLoading(false); return;
      }
      const reply = res.content?.[0]?.text || "Bir sorun oluştu.";
      convRef.current = [...convRef.current, { role:"assistant", content:reply }];
      setMsgs(p => [...p, { role:"assistant", content:reply, id:Date.now(), time:ts() }]);
      speak(reply);
    } catch {
      setMsgs(p => [...p, { role:"assistant", content:"Bağlantı sorunu yaşandı, tekrar deneyin.", id:Date.now(), time:ts() }]);
    }
    setLoading(false);
  }, [loading, session, menu, specials, speak]);

  const toggleListen = useCallback(() => {
    if (listening) { recRef.current?.stop(); return; }
    if (speaking) { window.speechSynthesis?.cancel(); setSpeaking(false); }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Lütfen Chrome kullanın."); return; }
    const r = new SR(); r.lang = "tr-TR"; r.continuous = false; r.interimResults = false;
    r.onstart = () => setListening(true);
    r.onresult = e => { setListening(false); send(e.results[0][0].transcript); };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recRef.current = r; r.start();
  }, [listening, speaking, send]);

  const callWaiter = async () => {
    await api.post("panel.php", { action:"notify", masa:session.masa, ad:session.ad, tel:session.tel, type:"garson" });
    playBeep(440,.3,2); alert("✓ Garson çağrıldı!");
  };
  const requestBill = async (payment, total) => {
    await api.post("panel.php", { action:"notify", masa:session.masa, ad:session.ad, tel:session.tel, type:"hesap", payment, total });
    playBeep(550,.35,2); alert("✓ Hesap isteğiniz iletildi!");
  };

  return (
    <div style={{ height:"100vh", display:"flex", flexDirection:"column", background:"var(--bg)", overflow:"hidden", position:"relative" }}>
      <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse 60% 40% at 50% 0%,rgba(201,145,58,.05) 0%,transparent 70%)", pointerEvents:"none", zIndex:0 }} />
      {/* Header */}
      <div style={{ padding:"12px 15px", display:"flex", alignItems:"center", gap:11, borderBottom:"1px solid var(--bord)", background:"rgba(22,14,8,.95)", backdropFilter:"blur(12px)", position:"relative", zIndex:10, flexShrink:0 }}>
        <div style={{ width:38, height:38, borderRadius:"50%", background:"linear-gradient(135deg,var(--gold) 0%,#6b3d10 100%)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:19, boxShadow:"0 0 18px rgba(201,145,58,.28)", flexShrink:0 }}>🍽️</div>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:"var(--fh)", fontSize:16, color:"var(--cream)" }}>Garson AI</div>
          <div style={{ fontSize:11, color:"var(--muted)", fontStyle:"italic" }}>Bistro 7 — Masa {session.masa} — {session.ad}</div>
        </div>
        {speaking && <div style={{ display:"flex", alignItems:"center", gap:5, color:"var(--gsoft)", fontSize:12 }}><Dots /> konuşuyor</div>}
        <button onClick={onViewGarson} style={{ background:"var(--surf2)", border:"1px solid var(--bord)", borderRadius:9, padding:"6px 11px", color:"var(--muted)", cursor:"pointer", fontSize:12 }}>👨‍🍳</button>
      </div>
      {/* Tabs */}
      <div style={{ display:"flex", borderBottom:"1px solid var(--bord)", background:"rgba(22,14,8,.9)", flexShrink:0, position:"relative", zIndex:10 }}>
        {[{id:"chat",label:"💬 Garson"},{id:"menu",label:"📋 Menü"},{id:"table",label:`🛒 Masa${tableOrders.length>0?" ●":""}`}].map(({id,label}) => (
          <button key={id} onClick={() => setTab(id)} style={{ flex:1, padding:"10px 0", background:"none", border:"none", cursor:"pointer", fontFamily:"var(--fb)", fontSize:13, color:tab===id?"var(--gsoft)":"var(--muted)", borderBottom:tab===id?"2px solid var(--gold)":"2px solid transparent", transition:"all .2s" }}>{label}</button>
        ))}
      </div>
      {/* Content */}
      <div style={{ flex:1, overflow:"hidden", position:"relative", zIndex:1 }}>
        {tab==="menu" && <MenuView menu={menu} specials={specials} />}
        {tab==="table" && <TableView session={session} tableOrders={tableOrders} onCallWaiter={callWaiter} onBill={requestBill} />}
        {tab==="chat" && (
          <div style={{ height:"100%", display:"flex", flexDirection:"column" }}>
            <div style={{ flex:1, overflowY:"auto", padding:"14px 13px 8px" }}>
              {msgs.map((m,i) => <Bubble key={m.id} msg={m} isLatest={i===msgs.length-1} />)}
              {loading && (
                <div style={{ display:"flex", gap:9, alignItems:"flex-end", marginBottom:14, animation:"fadeUp .3s ease-out" }}>
                  <div style={{ width:34, height:34, borderRadius:"50%", background:"linear-gradient(135deg,var(--gold) 0%,#8b5e2a 100%)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:17 }}>🍽️</div>
                  <div style={{ padding:"12px 16px", background:"var(--surf2)", border:"1px solid var(--bord)", borderRadius:"18px 18px 18px 4px" }}><Dots /></div>
                </div>
              )}
              <div ref={endRef} />
            </div>
            <div style={{ padding:"0 12px 7px", display:"flex", gap:7, overflowX:"auto", flexShrink:0 }}>
              {["Menüyü anlat","Ne tavsiye edersin?","Kahve öner","Sipariş vermek istiyorum","Hesabı istiyorum"].map(s => (
                <button key={s} onClick={() => send(s)} style={{ background:"var(--surf2)", border:"1px solid var(--bord)", borderRadius:20, padding:"5px 12px", color:"var(--muted)", cursor:"pointer", fontSize:12, whiteSpace:"nowrap", flexShrink:0, transition:"all .2s" }}>{s}</button>
              ))}
            </div>
            <div style={{ padding:"9px 12px 17px", borderTop:"1px solid var(--bord)", background:"rgba(22,14,8,.95)", backdropFilter:"blur(12px)", flexShrink:0 }}>
              <div style={{ display:"flex", gap:8, alignItems:"flex-end" }}>
                <textarea ref={taRef} value={input}
                  onChange={e => { setInput(e.target.value); e.target.style.height="auto"; e.target.style.height=Math.min(e.target.scrollHeight,100)+"px"; }}
                  onKeyDown={e => { if (e.key==="Enter"&&!e.shiftKey) { e.preventDefault(); send(input); } }}
                  placeholder={listening?"Dinliyorum...":"Yazın veya mikrofona basın..."}
                  rows={1} disabled={loading}
                  style={{ flex:1, resize:"none", background:"var(--surf2)", border:"1px solid var(--bord)", borderRadius:13, padding:"11px 14px", color:"var(--cream)", fontSize:15, outline:"none", lineHeight:1.4, minHeight:44 }}
                />
                <button onClick={toggleListen} style={{ width:46, height:46, borderRadius:"50%", flexShrink:0, background:listening?"var(--red)":"linear-gradient(135deg,var(--gold) 0%,#8b5e2a 100%)", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", animation:listening?"pulse 1.5s ease-in-out infinite":"none", boxShadow:listening?"none":"0 4px 14px rgba(201,145,58,.28)", transition:"background .3s" }}>
                  {listening ? <Wave active /> : <span style={{ fontSize:19 }}>🎤</span>}
                </button>
                {input.trim() && <button onClick={() => send(input)} style={{ width:46, height:46, borderRadius:"50%", flexShrink:0, background:"var(--gold)", border:"none", cursor:"pointer", fontSize:17, boxShadow:"0 4px 14px rgba(201,145,58,.28)" }}>➤</button>}
              </div>
              {listening && <div style={{ textAlign:"center", marginTop:6, color:"var(--red)", fontSize:12, fontStyle:"italic", animation:"glow 1s ease-in-out infinite" }}>🔴 Dinliyorum... konuşun</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════
   GARSON PANELİ
══════════════════════════════════════════════════════════ */
const GarsonPanel = ({ onBack }) => {
  const [tab, setTab]           = useState("bekleyen");
  const [sessions, setSessions] = useState([]);
  const [orders, setOrders]     = useState([]);
  const [notifs, setNotifs]     = useState([]);
  const [menu, setMenu]         = useState({});
  const [specials, setSpecials] = useState([]);
  const [loading, setLoading]   = useState(true);

  const [newItem, setNewItem]   = useState({ cat:"", name:"", price:"", desc:"", wait:"" });
  const [newSpec, setNewSpec]   = useState({ name:"", price:"", desc:"" });

  const fetchAll = useCallback(async () => {
    try {
      const [panel, menuData] = await Promise.all([
        api.get("panel.php?type=all"),
        api.get("panel.php?type=menu"),
      ]);
      if (panel.sessions)      setSessions(panel.sessions);
      if (panel.orders) {
        const o = panel.orders.map(o => ({ ...o, urunler: typeof o.urunler==="string" ? JSON.parse(o.urunler) : o.urunler }));
        setOrders(o);
      }
      if (panel.notifications) setNotifs(panel.notifications);
      if (menuData.menu)       { setMenu(menuData.menu); setNewItem(p=>({...p,cat:Object.keys(menuData.menu)[0]||""})); }
      if (menuData.specials)   setSpecials(menuData.specials);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); const i = setInterval(fetchAll, 3000); return () => clearInterval(i); }, [fetchAll]);

  // Yeni sipariş / bildirim sesi
  const prevCounts = useRef({ orders:0, notifs:0, pending:0 });
  useEffect(() => {
    const pending = sessions.filter(s=>s.durum==="bekliyor").length;
    const newOrds = orders.filter(o=>o.status==="yeni").length;
    const newNots = notifs.filter(n=>!n.acked).length;
    if (!loading) {
      if (pending > prevCounts.current.pending) playBeep(660,.3,2);
      if (newOrds > prevCounts.current.orders)  { playBeep(880,.35,3); if(navigator.vibrate) navigator.vibrate([200,100,200,100,200]); }
      if (newNots > prevCounts.current.notifs)  playBeep(550,.4,2);
    }
    prevCounts.current = { orders:newOrds, notifs:newNots, pending };
  }, [sessions, orders, notifs, loading]);

  const sessionAction = async (id, action, durum) => {
    if (action==="delete") await api.post("session.php", { action:"delete", id });
    else await api.post("session.php", { action:"update_status", id, durum });
    fetchAll();
  };
  const orderAction = async (id, status) => {
    await api.post("order.php", { action:"update_status", id, status });
    fetchAll();
  };
  const ack = async id => {
    await api.post("panel.php", { action:"ack", id });
    fetchAll();
  };

  const pending  = sessions.filter(s=>s.durum==="bekliyor");
  const active   = sessions.filter(s=>s.durum==="aktif");
  const others   = sessions.filter(s=>s.durum==="askida"||s.durum==="engelli");
  const newCount = pending.length + orders.filter(o=>o.status==="yeni").length + notifs.filter(n=>!n.acked).length;

  const AB = (label,onClick,col) => (
    <button onClick={onClick} style={{ background:`rgba(${col},.15)`, border:`1px solid rgba(${col},.4)`, borderRadius:9, padding:"6px 13px", cursor:"pointer", fontSize:12.5, color:`rgb(${col})`, whiteSpace:"nowrap", fontFamily:"var(--fb)" }}>{label}</button>
  );

  return (
    <div style={{ height:"100vh", display:"flex", flexDirection:"column", background:"var(--bg)" }}>
      <GS />
      <div style={{ padding:"14px 17px", borderBottom:"1px solid var(--bord)", display:"flex", alignItems:"center", gap:11, background:"var(--surf)", flexShrink:0 }}>
        <button onClick={onBack} style={{ background:"none", border:"none", color:"var(--muted)", cursor:"pointer", fontSize:21 }}>←</button>
        <div style={{ fontFamily:"var(--fh)", fontSize:18, color:"var(--cream)" }}>👨‍🍳 Yönetim Paneli</div>
        {newCount>0 && <div style={{ marginLeft:"auto", background:"var(--red)", color:"#fff", borderRadius:20, padding:"3px 13px", fontSize:12, fontWeight:600, animation:"blink 1.4s ease-in-out infinite" }}>{newCount} YENİ</div>}
      </div>

      <div style={{ display:"flex", borderBottom:"1px solid var(--bord)", background:"rgba(22,14,8,.9)", flexShrink:0 }}>
        {[["bekleyen","⏳ Bekleyen",pending.length],["masalar","🪑 Masalar",orders.filter(o=>o.status==="yeni").length],["bildirim","🔔 Bildirim",notifs.filter(n=>!n.acked).length],["admin","⚙️ Admin",0]].map(([id,label,badge])=>(
          <button key={id} onClick={()=>setTab(id)} style={{ flex:1, padding:"10px 4px", background:"none", border:"none", cursor:"pointer", fontFamily:"var(--fb)", fontSize:12, color:tab===id?"var(--gsoft)":"var(--muted)", borderBottom:tab===id?"2px solid var(--gold)":"2px solid transparent", transition:"all .2s", position:"relative" }}>
            {label}{badge>0&&<span style={{ position:"absolute", top:6, right:"10%", width:16, height:16, borderRadius:"50%", background:"var(--red)", color:"#fff", fontSize:9, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700 }}>{badge}</span>}
          </button>
        ))}
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:14 }}>
        {loading && <div style={{ textAlign:"center", color:"var(--muted)", marginTop:60 }}>Yükleniyor...</div>}

        {!loading && tab==="bekleyen" && (
          pending.length===0
            ? <div style={{ textAlign:"center", color:"var(--muted)", marginTop:60 }}><div style={{ fontSize:36 }}>✅</div><div style={{ marginTop:12, fontSize:14, fontStyle:"italic" }}>Bekleyen kayıt yok</div></div>
            : pending.map(s=>(
              <div key={s.id} style={{ padding:"13px 15px", background:"var(--surf2)", border:"1px solid rgba(58,106,154,.45)", borderRadius:14, marginBottom:11, animation:"bounce .4s ease-out" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:11 }}>
                  <div>
                    <div style={{ fontFamily:"var(--fh)", fontSize:17, color:"var(--cream)" }}>{s.ad}</div>
                    <div style={{ fontSize:13, color:"var(--muted)", marginTop:2 }}>📱 {s.tel}</div>
                    <div style={{ fontSize:12, color:"var(--muted)" }}>🕐 {s.created_at?.slice(11,16)}</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontFamily:"var(--fh)", fontSize:24, color:"var(--gsoft)" }}>Masa {s.masa}</div>
                    <StatusBadge status={s.durum} />
                  </div>
                </div>
                <div style={{ display:"flex", gap:9 }}>
                  {AB("✓ Onayla", ()=>sessionAction(s.id,"update","aktif"), "58,138,92")}
                  {AB("✕ Reddet", ()=>sessionAction(s.id,"delete",""), "192,64,64")}
                </div>
              </div>
            ))
        )}

        {!loading && tab==="masalar" && <>
          {active.length>0 && <>
            <div style={{ fontFamily:"var(--fh)", fontSize:12, color:"var(--muted)", marginBottom:9, letterSpacing:1 }}>AKTİF MASALAR</div>
            {active.map(s=>{
              const sOrders = orders.filter(o=>o.masa===parseInt(s.masa)&&o.musteri===s.ad);
              const total = sOrders.reduce((a,o)=>a+(o.toplam||0),0);
              return (
                <div key={s.id} style={{ padding:"13px 15px", background:"var(--surf2)", border:"1px solid rgba(58,138,92,.35)", borderRadius:14, marginBottom:11 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                    <div>
                      <div style={{ fontFamily:"var(--fh)", fontSize:16, color:"var(--cream)" }}>{s.ad} <span style={{ color:"var(--muted)", fontSize:13, fontFamily:"var(--fb)" }}>· Masa {s.masa}</span></div>
                      <div style={{ fontSize:12, color:"var(--muted)" }}>📱 {s.tel}</div>
                    </div>
                    <div style={{ fontFamily:"var(--fh)", fontSize:18, color:"var(--gsoft)" }}>{total}₺</div>
                  </div>
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                    {AB("⏸ Hesap & Askıya Al", ()=>sessionAction(s.id,"update","askida"), "201,145,58")}
                    {AB("🚫 Engelle", ()=>sessionAction(s.id,"update","engelli"), "192,64,64")}
                  </div>
                </div>
              );
            })}
          </>}

          {orders.length>0 && <>
            <div style={{ fontFamily:"var(--fh)", fontSize:12, color:"var(--muted)", marginBottom:9, letterSpacing:1, marginTop:active.length>0?16:0 }}>SİPARİŞLER</div>
            {[...orders].map(o=>(
              <div key={o.id} style={{ padding:"13px 15px", background:"var(--surf2)", border:`1px solid ${o.status==="yeni"?"rgba(192,64,64,.45)":o.status==="hazırlanıyor"?"rgba(201,145,58,.38)":"rgba(58,138,92,.38)"}`, borderRadius:14, marginBottom:11 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:9 }}>
                  <div style={{ fontFamily:"var(--fh)", fontSize:15, color:"var(--cream)" }}>Masa {o.masa} <span style={{ color:"var(--muted)", fontSize:12, fontFamily:"var(--fb)" }}>· {o.musteri}</span></div>
                  <div style={{ display:"flex", gap:7, alignItems:"center" }}>
                    <span style={{ fontSize:11, color:"var(--muted)" }}>{o.created_at?.slice(11,16)}</span>
                    <span style={{ fontSize:11, padding:"2px 9px", borderRadius:20, fontWeight:600, background:o.status==="yeni"?"rgba(192,64,64,.2)":o.status==="hazırlanıyor"?"rgba(201,145,58,.2)":"rgba(58,138,92,.2)", color:o.status==="yeni"?"#e06060":o.status==="hazırlanıyor"?"var(--gsoft)":"#3aaa6a" }}>{o.status}</span>
                  </div>
                </div>
                {(o.urunler||[]).map((u,i)=>(
                  <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:13.5, color:"var(--cream)", padding:"3px 0", borderBottom:i<(o.urunler||[]).length-1?"1px solid var(--bord)":"none" }}>
                    <span><strong style={{ color:"var(--gsoft)" }}>{u.adet}×</strong> {u.ad} <span style={{ color:"var(--muted)", fontSize:11 }}>~{u.bekleme}dk</span></span>
                    <span style={{ color:"var(--muted)" }}>{u.adet*u.fiyat}₺</span>
                  </div>
                ))}
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:10 }}>
                  <span style={{ fontFamily:"var(--fh)", color:"var(--gsoft)", fontSize:15 }}>Toplam: {o.toplam}₺</span>
                  <div style={{ display:"flex", gap:7 }}>
                    {o.status==="yeni"         && AB("🔥 Hazırlıyorum", ()=>orderAction(o.id,"hazırlanıyor"), "201,145,58")}
                    {o.status==="hazırlanıyor" && AB("✅ Hazır — Servis", ()=>orderAction(o.id,"hazır"), "58,138,92")}
                  </div>
                </div>
              </div>
            ))}
          </>}

          {others.length>0 && <>
            <div style={{ fontFamily:"var(--fh)", fontSize:12, color:"var(--muted)", marginBottom:9, letterSpacing:1, marginTop:16 }}>GEÇMİŞ OTURUMLAR</div>
            {others.map(s=>(
              <div key={s.id} style={{ padding:"13px 15px", background:"var(--surf2)", border:"1px solid var(--bord)", borderRadius:14, marginBottom:11, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ fontFamily:"var(--fh)", fontSize:15, color:"var(--cream)" }}>{s.ad} <span style={{ color:"var(--muted)", fontSize:12, fontFamily:"var(--fb)" }}>· Masa {s.masa}</span></div>
                  <div style={{ fontSize:12, color:"var(--muted)" }}>📱 {s.tel}</div>
                </div>
                <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:7 }}>
                  <StatusBadge status={s.durum} />
                  {s.durum==="askida" && AB("↺ Yeniden Aç", ()=>sessionAction(s.id,"update","aktif"), "58,106,154")}
                </div>
              </div>
            ))}
          </>}

          {sessions.length===0 && orders.length===0 && !loading &&
            <div style={{ textAlign:"center", color:"var(--muted)", marginTop:60 }}><div style={{ fontSize:36 }}>🪑</div><div style={{ marginTop:12, fontSize:14, fontStyle:"italic" }}>Henüz aktif masa yok</div></div>
          }
        </>}

        {!loading && tab==="bildirim" && (
          notifs.length===0
            ? <div style={{ textAlign:"center", color:"var(--muted)", marginTop:60 }}><div style={{ fontSize:36 }}>🔕</div><div style={{ marginTop:12, fontSize:14, fontStyle:"italic" }}>Bildirim yok</div></div>
            : [...notifs].reverse().map(n=>(
              <div key={n.id} style={{ padding:"13px 15px", background:n.type==="garson"?"rgba(58,106,154,.1)":"rgba(201,145,58,.08)", border:`1px solid ${n.type==="garson"?"rgba(58,106,154,.4)":"rgba(201,145,58,.35)"}`, borderRadius:14, marginBottom:11, display:"flex", justifyContent:"space-between", alignItems:"flex-start", animation:!n.acked?"blink 1.5s ease-in-out infinite":"none" }}>
                <div>
                  <div style={{ fontFamily:"var(--fh)", fontSize:15, color:n.type==="garson"?"#6aaae0":"var(--gsoft)" }}>
                    {n.type==="garson" ? `🔔 Masa ${n.masa} — ${n.ad} garson istiyor` : `💳 Masa ${n.masa} — ${n.ad} hesap istiyor`}
                  </div>
                  {n.type==="hesap" && <div style={{ fontSize:13, color:"var(--cream)", marginTop:4 }}>Ödeme: {n.payment==="nakit"?"Nakit 💵":n.payment==="kart"?"Kart 💳":"QR Kod 📱"} · <strong style={{ color:"var(--gsoft)" }}>{n.total}₺</strong></div>}
                  <div style={{ fontSize:11, color:"var(--muted)", marginTop:4 }}>📱 {n.tel} · {n.created_at?.slice(11,16)}</div>
                </div>
                {!n.acked && <button onClick={()=>ack(n.id)} style={{ background:"none", border:"1px solid var(--bord)", borderRadius:8, color:"var(--muted)", cursor:"pointer", padding:"5px 11px", fontSize:12, flexShrink:0, marginLeft:9 }}>✓ Tamam</button>}
              </div>
            ))
        )}

        {!loading && tab==="admin" && <>
          <div style={{ fontFamily:"var(--fh)", fontSize:13, color:"var(--gsoft)", marginBottom:10 }}>⭐ Günün Özel Menüsü</div>
          {specials.map((s,i)=>(
            <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"9px 13px", marginBottom:7, background:"rgba(201,145,58,.1)", border:"1px solid rgba(201,145,58,.3)", borderRadius:12 }}>
              <div><div style={{ fontSize:14, color:"var(--cream)" }}>{s.name} · {s.price}₺</div><div style={{ fontSize:12, color:"var(--muted)", fontStyle:"italic" }}>{s.desc}</div></div>
            </div>
          ))}
          <div style={{ padding:"13px 15px", background:"var(--surf2)", border:"1px solid var(--gdim)", borderRadius:14, marginBottom:18 }}>
            <div style={{ fontSize:12, color:"var(--muted)", marginBottom:9, fontFamily:"var(--fh)" }}>YENİ ÖZEL ÜRÜN</div>
            {[["Ürün adı",newSpec.name,v=>setNewSpec({...newSpec,name:v})],["Fiyat (₺)",newSpec.price,v=>setNewSpec({...newSpec,price:v}),"number"],["Açıklama",newSpec.desc,v=>setNewSpec({...newSpec,desc:v})]].map(([ph,val,fn,tp="text"],i)=>(
              <input key={i} type={tp} value={val} placeholder={ph} onChange={e=>fn(e.target.value)} style={{ width:"100%", background:"var(--surf)", border:"1px solid var(--bord)", borderRadius:9, padding:"10px 13px", color:"var(--cream)", fontSize:14, outline:"none", marginBottom:7 }} />
            ))}
            <button onClick={async()=>{ if(!newSpec.name||!newSpec.price)return; await api.post("panel.php",{action:"add_special",...newSpec,price:parseInt(newSpec.price)}); setNewSpec({name:"",price:"",desc:""}); fetchAll(); }} style={{ width:"100%", padding:"10px", background:"linear-gradient(135deg,var(--gold) 0%,#8b5e2a 100%)", border:"none", borderRadius:10, color:"#0b0704", cursor:"pointer", fontFamily:"var(--fh)", fontSize:14, fontWeight:600 }}>⭐ Ekle</button>
          </div>

          <div style={{ fontFamily:"var(--fh)", fontSize:13, color:"var(--gsoft)", marginBottom:10 }}>📋 Menüye Ürün Ekle</div>
          <div style={{ padding:"13px 15px", background:"var(--surf2)", border:"1px solid var(--gdim)", borderRadius:14 }}>
            <select value={newItem.cat} onChange={e=>setNewItem({...newItem,cat:e.target.value})} style={{ width:"100%", background:"var(--surf)", border:"1px solid var(--bord)", borderRadius:9, padding:"10px 13px", color:"var(--cream)", fontSize:14, outline:"none", marginBottom:7 }}>
              {Object.keys(menu).map(c=><option key={c} value={c}>{c}</option>)}
            </select>
            {[["Ürün adı",newItem.name,v=>setNewItem({...newItem,name:v})],["Fiyat (₺)",newItem.price,v=>setNewItem({...newItem,price:v}),"number"],["Süre (dk)",newItem.wait,v=>setNewItem({...newItem,wait:v}),"number"],["Açıklama",newItem.desc,v=>setNewItem({...newItem,desc:v})]].map(([ph,val,fn,tp="text"],i)=>(
              <input key={i} type={tp} value={val} placeholder={ph} onChange={e=>fn(e.target.value)} style={{ width:"100%", background:"var(--surf)", border:"1px solid var(--bord)", borderRadius:9, padding:"10px 13px", color:"var(--cream)", fontSize:14, outline:"none", marginBottom:7 }} />
            ))}
            <button onClick={async()=>{ if(!newItem.name||!newItem.price)return; await api.post("panel.php",{action:"add_menu",kategori:newItem.cat,ad:newItem.name,fiyat:parseInt(newItem.price),sure:parseInt(newItem.wait)||5,aciklama:newItem.desc}); setNewItem({...newItem,name:"",price:"",desc:"",wait:""}); fetchAll(); }} style={{ width:"100%", padding:"10px", background:"linear-gradient(135deg,var(--gold) 0%,#8b5e2a 100%)", border:"none", borderRadius:10, color:"#0b0704", cursor:"pointer", fontFamily:"var(--fh)", fontSize:14, fontWeight:600 }}>+ Menüye Ekle</button>
          </div>
        </>}
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════
   ROOT
══════════════════════════════════════════════════════════ */
export default function App() {
  const [session, setSession]   = useState(null);
  const [sessionStatus, setSessionStatus] = useState(null);
  const [menu, setMenu]         = useState({});
  const [specials, setSpecials] = useState([]);
  const [tableOrders, setTableOrders] = useState([]);
  const [view, setView]         = useState("customer");
  const [menuLoaded, setMenuLoaded] = useState(false);

  // Menüyü çek
  useEffect(() => {
    api.get("panel.php?type=menu").then(r => {
      if (r.menu) setMenu(r.menu);
      if (r.specials) setSpecials(r.specials);
      setMenuLoaded(true);
    }).catch(() => setMenuLoaded(true));
  }, []);

  // Daha önce kayıt varsa localStorage'dan al
  useEffect(() => {
    const savedId = localStorage.getItem("sg_session_id");
    if (savedId) {
      api.get(`session.php?id=${savedId}`).then(r => {
        if (r.session) { setSession(r.session); setSessionStatus(r.session.durum); }
        else localStorage.removeItem("sg_session_id");
      }).catch(() => {});
    }
  }, []);

  // Oturum durumunu poll et (3 saniyede bir)
  useEffect(() => {
    if (!session) return;
    const poll = async () => {
      try {
        const r = await api.get(`session.php?id=${session.id}`);
        if (r.session && r.session.durum !== sessionStatus) {
          setSessionStatus(r.session.durum);
          setSession(r.session);
          if (r.session.durum === "aktif") playBeep(660,.3,2);
        }
      } catch {}
    };
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [session, sessionStatus]);

  // GS her zaman en üstte render edilir — CSS değişkenleri hiç kaybolmaz
  const renderContent = () => {
    if (view === "garson") return <GarsonPanel onBack={() => setView("customer")} />;

    if (!menuLoaded) return (
      <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"var(--bg)" }}>
        <div style={{ width:40, height:40, borderRadius:"50%", border:"3px solid var(--gdim)", borderTopColor:"var(--gold)", animation:"spin .8s linear infinite" }} />
      </div>
    );

    if (!session) return <RegisterScreen onRegister={s => { setSession(s); setSessionStatus(s.durum); }} />;
    if (sessionStatus === "engelli") return <RegisterScreen blockedMsg="engelli" />;
    if (sessionStatus === "askida")  return <SuspendedScreen session={session} />;
    if (sessionStatus === "bekliyor") return (
      <>
        <WaitingScreen session={session} />
        <button onClick={() => setView("garson")} style={{ position:"fixed", bottom:20, right:20, background:"var(--surf2)", border:"1px solid var(--bord)", borderRadius:12, padding:"9px 16px", color:"var(--muted)", cursor:"pointer", fontSize:13, zIndex:999 }}>👨‍🍳</button>
      </>
    );
    return null;
  };

  const content = renderContent();

  return (
    <>
      <GS />
      {content !== null ? content : (
        <CustomerChat
          session={session}
          menu={menu}
          specials={specials}
          tableOrders={tableOrders}
          setTableOrders={setTableOrders}
          onViewGarson={() => setView("garson")}
        />
      )}
    </>
  );
}
