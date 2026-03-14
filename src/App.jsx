import { useState, useRef, useEffect, useCallback } from "react";

// ── API BASE ────────────────────────────────────────────────
// Vercel env variable olarak set edilecek
const API = import.meta.env.VITE_API_BASE || "https://testokulu.com/garson-api";

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

// TTS için metni temizle: ₺, *, # gibi karakterleri kaldır, rakamları düzelt
const cleanForTTS = t => cleanText(t)
  .replace(/(\d+)\s*₺/g, (_, n) => `${n} lira`)   // 35₺ → "35 lira"
  .replace(/~(\d+)\s*dk/g, (_, n) => `${n} dakika`) // ~5dk → "5 dakika"
  .replace(/[₺*#•→←]/g, " ")
  .replace(/\s{2,}/g, " ")
  .trim();

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
const MenuView = ({ menu, specials, cart, onAdd, onRemove, onOrder, orderLoading }) => {
  const [open, setOpen] = useState(Object.keys(menu)[0] || "");

  const cartTotal   = cart.reduce((s,i) => s + i.price * i.qty, 0);
  const cartCount   = cart.reduce((s,i) => s + i.qty, 0);

  const PlusBtn = ({ item }) => {
    const qty = cart.find(c=>c.id===item.id)?.qty || 0;
    return (
      <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0, marginLeft:10 }}>
        {qty > 0 && (
          <>
            <button onClick={()=>onRemove(item)} style={{ width:26, height:26, borderRadius:"50%", background:"var(--surf)", border:"1px solid var(--bord)", color:"var(--muted)", cursor:"pointer", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center", lineHeight:1 }}>−</button>
            <span style={{ fontFamily:"var(--fh)", fontSize:14, color:"var(--cream)", minWidth:16, textAlign:"center" }}>{qty}</span>
          </>
        )}
        <button onClick={()=>onAdd(item)} style={{ width:26, height:26, borderRadius:"50%", background:"linear-gradient(135deg,var(--gold) 0%,#8b5e2a 100%)", border:"none", color:"#0b0704", cursor:"pointer", fontSize:18, display:"flex", alignItems:"center", justifyContent:"center", lineHeight:1, boxShadow:"0 2px 8px rgba(201,145,58,.35)", fontWeight:700 }}>+</button>
      </div>
    );
  };

  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column" }}>
      {/* Sepet özet bar */}
      {cartCount > 0 && (
        <div style={{ padding:"10px 14px", background:"linear-gradient(135deg,rgba(201,145,58,.18) 0%,rgba(139,94,42,.1) 100%)", borderBottom:"1px solid rgba(201,145,58,.3)", display:"flex", alignItems:"center", gap:10, flexShrink:0, animation:"fadeIn .2s" }}>
          <div style={{ flex:1 }}>
            <span style={{ fontFamily:"var(--fh)", color:"var(--gsoft)", fontSize:14 }}>{cartCount} ürün</span>
            <span style={{ color:"var(--muted)", fontSize:13, marginLeft:8 }}>· {cartTotal}₺</span>
          </div>
          <button onClick={onOrder} disabled={orderLoading} style={{ padding:"8px 18px", background:"linear-gradient(135deg,var(--gold) 0%,#8b5e2a 100%)", border:"none", borderRadius:12, color:"#0b0704", cursor:orderLoading?"not-allowed":"pointer", fontFamily:"var(--fh)", fontSize:14, fontWeight:600, display:"flex", alignItems:"center", gap:6 }}>
            {orderLoading ? <div style={{ width:14, height:14, borderRadius:"50%", border:"2px solid #8b5e2a", borderTopColor:"transparent", animation:"spin .8s linear infinite" }}/> : "🛎 Sipariş Ver"}
          </button>
        </div>
      )}

      <div style={{ flex:1, overflowY:"auto", padding:"12px 14px" }}>
        {specials.length > 0 && (
          <div style={{ marginBottom:14, padding:"13px 15px", background:"linear-gradient(135deg,rgba(201,145,58,.18) 0%,rgba(139,94,42,.08) 100%)", border:"1px solid rgba(201,145,58,.4)", borderRadius:14 }}>
            <div style={{ fontFamily:"var(--fh)", fontSize:14, color:"var(--gsoft)", marginBottom:9 }}>⭐ Günün Özel Menüsü</div>
            {specials.map((s,i) => (
              <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0", borderBottom:i<specials.length-1?"1px solid var(--bord)":"none" }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, color:"var(--cream)" }}>{s.name}</div>
                  <div style={{ fontSize:11.5, color:"var(--muted)", fontStyle:"italic" }}>{s.desc}</div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{ fontFamily:"var(--fh)", color:"var(--gsoft)", fontSize:15 }}>{s.price}₺</div>
                  <PlusBtn item={{ id:`sp_${i}`, name:s.name, price:s.price, wait:5 }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {Object.entries(menu).map(([cat, items]) => (
          <div key={cat} style={{ marginBottom:9 }}>
            <button onClick={() => setOpen(open===cat?null:cat)} style={{ width:"100%", background:open===cat?"var(--gdim)":"var(--surf2)", border:"1px solid var(--bord)", borderRadius:10, padding:"11px 15px", color:"var(--cream)", cursor:"pointer", display:"flex", justifyContent:"space-between", fontFamily:"var(--fh)", fontSize:14, transition:"all .2s" }}>
              <span>{cat}</span>
              <span style={{ color:"var(--gold)", fontSize:11 }}>{open===cat?"▲":"▼"}</span>
            </button>
            {open===cat && items.map((item,i) => (
              <div key={item.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"9px 12px", borderBottom:i<items.length-1?"1px solid var(--bord)":"none", animation:`slideIn .2s ease-out ${i*.04}s both`, background: cart.find(c=>c.id===item.id) ? "rgba(201,145,58,.05)" : "transparent", transition:"background .2s" }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14.5, color:"var(--cream)" }}>{item.name}</div>
                  {item.desc && <div style={{ fontSize:12, color:"var(--muted)", fontStyle:"italic", marginTop:2 }}>{item.desc}</div>}
                  <div style={{ fontSize:11, color:"var(--gold)", marginTop:2 }}>⏱ ~{item.wait} dk</div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{ fontFamily:"var(--fh)", fontSize:15, color:"var(--gsoft)", fontWeight:600 }}>{item.price}₺</div>
                  <PlusBtn item={item} />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════
   TABLE VIEW
══════════════════════════════════════════════════════════ */
const TableView = ({ session, tableOrders, onCallWaiter, onBill }) => {
  const [payModal, setPayModal] = useState(false);
  const [pay, setPay] = useState(null);

  // Tüm ürünleri tek listede topla
  const allItems = tableOrders.flatMap(o => o.urunler || []);
  const total = tableOrders.reduce((s,o) => s + (o.toplam||0), 0);

  // Ürünleri grupla (aynı ürünleri birleştir)
  const grouped = allItems.reduce((acc, u) => {
    const ex = acc.find(i => i.ad === u.ad && i.fiyat === u.fiyat);
    if (ex) ex.adet += u.adet;
    else acc.push({ ...u });
    return acc;
  }, []);

  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column" }}>
      <div style={{ flex:1, overflowY:"auto", padding:14 }}>

        {/* Müşteri & Masa bilgisi */}
        <div style={{ padding:"12px 15px", background:"var(--surf2)", border:"1px solid var(--bord)", borderRadius:14, marginBottom:14, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontFamily:"var(--fh)", fontSize:16, color:"var(--cream)" }}>{session.ad}</div>
            <div style={{ fontSize:12, color:"var(--muted)" }}>Masa {session.masa}</div>
          </div>
          <StatusBadge status={session.durum} />
        </div>

        {/* Garson çağır */}
        <button onClick={onCallWaiter} style={{ width:"100%", padding:"13px 18px", marginBottom:14, background:"rgba(58,106,154,.15)", border:"1px solid rgba(58,106,154,.45)", borderRadius:14, color:"#6aaae0", cursor:"pointer", fontFamily:"var(--fh)", fontSize:15, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
          🔔 Garson Çağır
        </button>

        {/* Sipariş yok */}
        {grouped.length === 0 && (
          <div style={{ textAlign:"center", color:"var(--muted)", marginTop:50 }}>
            <div style={{ fontSize:40 }}>🍽️</div>
            <div style={{ marginTop:12, fontSize:14, fontStyle:"italic" }}>Henüz sipariş verilmedi</div>
          </div>
        )}

        {/* Sipariş özeti — gruplu liste */}
        {grouped.length > 0 && (
          <div style={{ background:"var(--surf2)", border:"1px solid var(--bord)", borderRadius:14, overflow:"hidden", marginBottom:12 }}>
            <div style={{ padding:"11px 15px", borderBottom:"1px solid var(--bord)", fontFamily:"var(--fh)", fontSize:13, color:"var(--muted)", letterSpacing:.8 }}>
              SİPARİŞLERİNİZ
            </div>
            {grouped.map((u, i) => (
              <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"11px 15px", borderBottom: i < grouped.length-1 ? "1px solid var(--bord)" : "none" }}>
                <div>
                  <div style={{ fontSize:15, color:"var(--cream)" }}>{u.ad}</div>
                  <div style={{ fontSize:12, color:"var(--muted)", marginTop:1 }}>{u.adet} adet × {u.fiyat}₺</div>
                </div>
                <div style={{ fontFamily:"var(--fh)", fontSize:15, color:"var(--gsoft)", fontWeight:600 }}>
                  {u.adet * u.fiyat}₺
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Sipariş durumları */}
        {tableOrders.length > 0 && (
          <div style={{ marginBottom:14 }}>
            {tableOrders.map(o => (
              <div key={o.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 12px", marginBottom:5, background:"var(--surf)", borderRadius:10, border:`1px solid ${o.status==="yeni"?"rgba(192,64,64,.3)":o.status==="hazırlanıyor"?"rgba(201,145,58,.3)":"rgba(58,138,92,.3)"}` }}>
                <span style={{ fontSize:12, color:"var(--muted)" }}>🕐 {o.created_at?.slice(11,16)||o.time||""}</span>
                <span style={{ fontSize:12, padding:"2px 10px", borderRadius:20,
                  background: o.status==="yeni"?"rgba(192,64,64,.18)":o.status==="hazırlanıyor"?"rgba(201,145,58,.18)":"rgba(58,138,92,.18)",
                  color: o.status==="yeni"?"#e06060":o.status==="hazırlanıyor"?"var(--gsoft)":"#3aaa6a"
                }}>
                  {o.status==="yeni"?"⏳ Sipariş alındı":o.status==="hazırlanıyor"?"🔥 Hazırlanıyor":"✅ Hazır — geliyor!"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Alt: Toplam + Hesap butonu */}
      {grouped.length > 0 && (
        <div style={{ padding:"12px 14px 20px", borderTop:"1px solid var(--bord)", background:"rgba(22,14,8,.95)", backdropFilter:"blur(12px)", flexShrink:0 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <span style={{ fontFamily:"var(--fh)", color:"var(--cream)", fontSize:16 }}>Toplam Tutar</span>
            <span style={{ fontFamily:"var(--fh)", color:"var(--gsoft)", fontSize:26 }}>{total}₺</span>
          </div>
          <button onClick={() => setPayModal(true)} style={{ width:"100%", padding:"14px 18px", background:"linear-gradient(135deg,var(--gold) 0%,#8b5e2a 100%)", border:"none", borderRadius:14, color:"#0b0704", cursor:"pointer", fontFamily:"var(--fh)", fontSize:17, fontWeight:600, boxShadow:"0 4px 16px rgba(201,145,58,.3)" }}>
            💳 Hesap İstiyorum
          </button>
        </div>
      )}

      {/* Ödeme yöntemi modal */}
      {payModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.88)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:200, backdropFilter:"blur(4px)" }}>
          <div style={{ width:"100%", maxWidth:525, background:"var(--surf)", borderRadius:"22px 22px 0 0", padding:"22px 18px 38px", animation:"fadeUp .3s ease-out" }}>
            <div style={{ fontFamily:"var(--fh)", fontSize:19, color:"var(--cream)", marginBottom:3 }}>Ödeme Yöntemi</div>
            <div style={{ fontSize:13, color:"var(--muted)", fontStyle:"italic", marginBottom:18 }}>Nasıl ödemek istersiniz?</div>
            {[{id:"nakit",icon:"💵",label:"Nakit"},{id:"kart",icon:"💳",label:"Kredi / Banka Kartı"},{id:"qr",icon:"📱",label:"QR Kod ile Ödeme"}].map(p => (
              <button key={p.id} onClick={() => setPay(p.id)} style={{ width:"100%", padding:"12px 17px", marginBottom:9, background:pay===p.id?"var(--gdim)":"var(--surf2)", border:`1px solid ${pay===p.id?"var(--gold)":"var(--bord)"}`, borderRadius:13, color:"var(--cream)", cursor:"pointer", display:"flex", alignItems:"center", gap:13, fontSize:15, transition:"all .2s" }}>
                <span style={{ fontSize:22 }}>{p.icon}</span>
                <span>{p.label}</span>
                {pay===p.id && <span style={{ marginLeft:"auto", color:"var(--gold)" }}>✓</span>}
              </button>
            ))}
            <div style={{ display:"flex", gap:9, marginTop:7 }}>
              <button onClick={() => setPayModal(false)} style={{ flex:1, padding:"11px", background:"var(--surf2)", border:"1px solid var(--bord)", borderRadius:12, color:"var(--muted)", cursor:"pointer", fontSize:14 }}>Vazgeç</button>
              <button disabled={!pay} onClick={() => { onBill(pay,total); setPayModal(false); setPay(null); }} style={{ flex:2, padding:"11px", background:pay?"linear-gradient(135deg,var(--gold) 0%,#8b5e2a 100%)":"var(--surf2)", border:"none", borderRadius:12, color:pay?"#0b0704":"var(--muted)", cursor:pay?"pointer":"not-allowed", fontFamily:"var(--fh)", fontSize:15, fontWeight:600, transition:"all .2s" }}>
                Hesabı İste ✓
              </button>
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
  const [cart, setCart]         = useState([]);
  const [orderLoading, setOrderLoading] = useState(false);
  const endRef  = useRef(null);
  const recRef  = useRef(null);
  const taRef   = useRef(null);
  const convRef = useRef([]);

  const addToCart = (item) => setCart(prev => {
    const ex = prev.find(c=>c.id===item.id);
    if (ex) return prev.map(c=>c.id===item.id?{...c,qty:c.qty+1}:c);
    return [...prev, { ...item, qty:1 }];
  });
  const removeFromCart = (item) => setCart(prev => {
    const ex = prev.find(c=>c.id===item.id);
    if (!ex || ex.qty <= 1) return prev.filter(c=>c.id!==item.id);
    return prev.map(c=>c.id===item.id?{...c,qty:c.qty-1}:c);
  });

  const submitCartOrder = async () => {
    if (!cart.length || orderLoading) return;
    setOrderLoading(true);
    const urunler = cart.map(c=>({ ad:c.name, adet:c.qty, fiyat:c.price, bekleme:c.wait||5 }));
    const toplam  = cart.reduce((s,c)=>s+c.price*c.qty, 0);
    try {
      await api.post("order.php", { action:"create", session_id:session.id, masa:session.masa, musteri:session.ad, urunler, toplam, not:"" });
      playBeep(660,.25,2);
      setCart([]);
      // Chat'e yansıt
      const summary = urunler.map(u=>`${u.adet}× ${u.ad}`).join(", ");
      setMsgs(p=>[...p,
        { role:"user", content:`Menüden sipariş verdim: ${summary}`, id:Date.now(), time:ts() },
        { role:"assistant", content:`✅ Siparişiniz alındı! ${summary} — toplam ${toplam}₺. Afiyet olsun ${session.ad}!`, id:Date.now()+1, time:ts() }
      ]);
      setTab("chat");
    } catch { alert("Sipariş gönderilemedi, tekrar deneyin."); }
    setOrderLoading(false);
  };

  useEffect(() => { endRef.current?.scrollIntoView({ behavior:"smooth" }); }, [msgs]);

  // Poll siparişler
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await api.get(`order.php?session_id=${session.id}`);
        if (res.orders) {
          setTableOrders(res.orders.map(o => ({
            ...o,
            urunler: typeof o.urunler === "string" ? JSON.parse(o.urunler) : (o.urunler || [])
          })));
        }
      } catch {}
    };
    poll();
    const interval = setInterval(poll, 4000);
    return () => clearInterval(interval);
  }, [session.id]);

  const speak = useCallback(text => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(cleanForTTS(text));
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
        {speaking && (
          <button onClick={() => { window.speechSynthesis.cancel(); setSpeaking(false); }} style={{ display:"flex", alignItems:"center", gap:6, background:"rgba(192,64,64,.18)", border:"1px solid rgba(192,64,64,.4)", borderRadius:20, padding:"5px 12px", cursor:"pointer", color:"#e06060", fontSize:12, fontFamily:"var(--fb)" }}>
            <span style={{ width:8, height:8, borderRadius:2, background:"#e06060", display:"block" }}/>
            Durdur
          </button>
        )}
        <button onClick={onViewGarson} style={{ background:"var(--surf2)", border:"1px solid var(--bord)", borderRadius:9, padding:"6px 11px", color:"var(--muted)", cursor:"pointer", fontSize:12 }}>👨‍🍳</button>
      </div>
      {/* Tabs */}
      <div style={{ display:"flex", borderBottom:"1px solid var(--bord)", background:"rgba(22,14,8,.9)", flexShrink:0, position:"relative", zIndex:10 }}>
        {[{id:"chat",label:"💬 Garson"},{id:"menu",label:`📋 Menü${cart.length>0?" ("+cart.reduce((s,c)=>s+c.qty,0)+")":""}`},{id:"table",label:`🧾 Hesap${tableOrders.length>0?" ●":""}`}].map(({id,label}) => (
          <button key={id} onClick={() => setTab(id)} style={{ flex:1, padding:"10px 0", background:"none", border:"none", cursor:"pointer", fontFamily:"var(--fb)", fontSize:13, color:tab===id?"var(--gsoft)":"var(--muted)", borderBottom:tab===id?"2px solid var(--gold)":"2px solid transparent", transition:"all .2s" }}>{label}</button>
        ))}
      </div>
      {/* Content */}
      <div style={{ flex:1, overflow:"hidden", position:"relative", zIndex:1 }}>
        {tab==="menu" && <MenuView menu={menu} specials={specials} cart={cart} onAdd={addToCart} onRemove={removeFromCart} onOrder={submitCartOrder} orderLoading={orderLoading} />}
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
const GarsonPanel = ({ onBack, rol = "garson" }) => {
  // rol: "garson" | "isletmeci"
  const isIsletmeci = rol === "isletmeci";
  const [tab, setTab]           = useState("bekleyen");
  const [sessions, setSessions] = useState([]);
  const [orders, setOrders]     = useState([]);
  const [notifs, setNotifs]     = useState([]);
  const [menu, setMenu]         = useState({});
  const [specials, setSpecials] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [now, setNow]           = useState(Date.now());
  const [historySession, setHistorySession] = useState(null);
  const [editSession, setEditSession]       = useState(null);
  const [editAd, setEditAd]     = useState("");
  const [editMasa, setEditMasa] = useState("");
  const [newItem, setNewItem]   = useState({ cat:"", name:"", price:"", desc:"", wait:"" });
  const [newSpec, setNewSpec]   = useState({ name:"", price:"", desc:"" });
  const [garsonOrder, setGarsonOrder] = useState(null);   // hangi masa için sipariş giriliyor
  const [garsonCart, setGarsonCart]   = useState([]);     // garsonun sepeti
  const [garsonLoading, setGarsonLoading] = useState(false);

  const garsonAddToCart = (item) => setGarsonCart(prev => {
    const ex = prev.find(c=>c.id===item.id);
    if (ex) return prev.map(c=>c.id===item.id?{...c,qty:c.qty+1}:c);
    return [...prev, {...item, qty:1}];
  });
  const garsonRemoveFromCart = (item) => setGarsonCart(prev => {
    const ex = prev.find(c=>c.id===item.id);
    if (!ex||ex.qty<=1) return prev.filter(c=>c.id!==item.id);
    return prev.map(c=>c.id===item.id?{...c,qty:c.qty-1}:c);
  });
  const submitGarsonOrder = async () => {
    if (!garsonCart.length || !garsonOrder || garsonLoading) return;
    setGarsonLoading(true);
    const urunler = garsonCart.map(c=>({ ad:c.name, adet:c.qty, fiyat:c.price, bekleme:c.wait||5 }));
    const toplam  = garsonCart.reduce((s,c)=>s+c.price*c.qty, 0);
    try {
      await api.post("order.php", { action:"create", session_id:garsonOrder.id, masa:garsonOrder.masa, musteri:garsonOrder.ad, urunler, toplam, not:"[Garson tarafından eklendi]" });
      playBeep(660,.25,2);
      setGarsonCart([]);
      setGarsonOrder(null);
      fetchAll();
    } catch { alert("Sipariş gönderilemedi."); }
    setGarsonLoading(false);
  };

  // Süre sayacı
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(i); }, []);

  const elapsed = (created_at) => {
    if (!created_at) return "";
    const diff = Math.floor((now - new Date(created_at).getTime()) / 60000);
    if (diff < 60) return `${diff}dk`;
    return `${Math.floor(diff/60)}sa ${diff%60}dk`;
  };

  const fetchAll = useCallback(async () => {
    try {
      const panel = await api.get("panel.php?type=all");
      if (panel.sessions) setSessions(panel.sessions);
      if (panel.orders) {
        setOrders(panel.orders.map(o => {
          let urunler = o.urunler;
          if (typeof urunler === "string") {
            try { urunler = JSON.parse(urunler); } catch { urunler = []; }
          }
          return { ...o, urunler: urunler || [], masa: parseInt(o.masa) };
        }));
      }
      if (panel.notifications) setNotifs(panel.notifications);
    } catch(e) { console.error("fetchAll error:", e); }

    try {
      const menuData = await api.get("panel.php?type=menu");
      if (menuData.menu) { setMenu(menuData.menu); setNewItem(p=>({...p,cat:Object.keys(menuData.menu)[0]||""})); }
      if (menuData.specials) setSpecials(menuData.specials);
    } catch(e) { console.error("menu fetch error:", e); }

    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); const i = setInterval(fetchAll, 3000); return () => clearInterval(i); }, [fetchAll]);

  const prevCounts = useRef({ orders:0, notifs:0, pending:0 });
  useEffect(() => {
    const pending  = sessions.filter(s=>s.durum==="bekliyor").length;
    const newOrds  = orders.filter(o=>o.status==="yeni").length;
    const newNots  = notifs.filter(n=>!n.acked).length;
    if (!loading) {
      if (pending > prevCounts.current.pending) playBeep(660,.3,2);
      if (newOrds  > prevCounts.current.orders)  { playBeep(880,.35,3); if(navigator.vibrate) navigator.vibrate([200,100,200,100,200]); }
      if (newNots  > prevCounts.current.notifs)  playBeep(550,.4,2);
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
  const ack = async id => { await api.post("panel.php", { action:"ack", id }); fetchAll(); };
  const saveEdit = async () => {
    if (!editSession) return;
    await api.post("session.php", { action:"update_status", id:editSession.id, durum:editSession.durum });
    setEditSession(null);
    fetchAll();
  };

  // Derived
  const pending = sessions.filter(s=>s.durum==="bekliyor");
  const active  = sessions.filter(s=>s.durum==="aktif");
  const allCust = sessions.filter(s=>s.durum!=="bekliyor");
  const newOrdsCount = orders.filter(o=>o.status==="yeni").length;
  const unread  = notifs.filter(n=>!n.acked).length;
  const newCount = pending.length + newOrdsCount + unread;

  // Günlük özet
  const todayOrders = orders.filter(o => o.created_at?.startsWith(new Date().toISOString().slice(0,10)));
  const todayCiro   = todayOrders.reduce((s,o)=>s+(o.toplam||0),0);
  const urunSayim   = {};
  todayOrders.forEach(o=>(o.urunler||[]).forEach(u=>{ urunSayim[u.ad]=(urunSayim[u.ad]||0)+u.adet; }));
  const enCokSatan  = Object.entries(urunSayim).sort((a,b)=>b[1]-a[1]).slice(0,3);

  // Müşteri geçmişi hesaplama
  const customerHistory = (session) => {
    const sOrders = orders.filter(o => String(o.session_id)===String(session.id) || String(o.masa)===String(session.masa));
    const total   = sOrders.reduce((s,o)=>s+(o.toplam||0),0);
    return { orders:sOrders, total };
  };

  const AB = (label, onClick, col) => (
    <button onClick={onClick} style={{ background:`rgba(${col},.15)`, border:`1px solid rgba(${col},.4)`, borderRadius:9, padding:"6px 13px", cursor:"pointer", fontSize:12.5, color:`rgb(${col})`, whiteSpace:"nowrap", fontFamily:"var(--fb)", transition:"all .2s" }}>{label}</button>
  );

  const card = (extra={}) => ({ padding:"13px 15px", background:"var(--surf2)", border:"1px solid var(--bord)", borderRadius:14, marginBottom:11, ...extra });

  const TabBtn = ({ id, label, badge }) => (
    <button onClick={()=>setTab(id)} style={{ flex:1, padding:"10px 4px", background:"none", border:"none", cursor:"pointer", fontFamily:"var(--fb)", fontSize:11.5, color:tab===id?"var(--gsoft)":"var(--muted)", borderBottom:tab===id?"2px solid var(--gold)":"2px solid transparent", transition:"all .2s", position:"relative", whiteSpace:"nowrap" }}>
      {label}
      {badge>0 && <span style={{ position:"absolute", top:5, right:"8%", minWidth:16, height:16, borderRadius:8, background:"var(--red)", color:"#fff", fontSize:9, display:"inline-flex", alignItems:"center", justifyContent:"center", fontWeight:700, padding:"0 3px" }}>{badge}</span>}
    </button>
  );

  return (
    <div style={{ height:"100vh", display:"flex", flexDirection:"column", background:"var(--bg)" }}>
      {/* Header */}
      <div style={{ padding:"13px 16px", borderBottom:"1px solid var(--bord)", display:"flex", alignItems:"center", gap:11, background:"var(--surf)", flexShrink:0 }}>
        <button onClick={onBack} style={{ background:"none", border:"none", color:"var(--muted)", cursor:"pointer", fontSize:21 }}>←</button>
        <div style={{ fontFamily:"var(--fh)", fontSize:17, color:"var(--cream)" }}>
          {isIsletmeci ? "👔 İşletmeci Paneli" : "👨‍🍳 Garson Paneli"}
        </div>
        {newCount>0 && <div style={{ marginLeft:"auto", background:"var(--red)", color:"#fff", borderRadius:20, padding:"3px 12px", fontSize:12, fontWeight:600, animation:"blink 1.4s ease-in-out infinite" }}>{newCount} YENİ</div>}
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", borderBottom:"1px solid var(--bord)", background:"rgba(22,14,8,.95)", flexShrink:0 }}>
        <TabBtn id="bekleyen"  label="⏳ Bekleyen"  badge={pending.length} />
        <TabBtn id="masalar"   label="🪑 Masalar"   badge={newOrdsCount} />
        {isIsletmeci && <TabBtn id="musteriler" label="👥 Müşteriler" badge={0} />}
        <TabBtn id="bildirim"  label="🔔 Bildirim"  badge={unread} />
        {isIsletmeci && <TabBtn id="admin"     label="⚙️ Admin"     badge={0} />}
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:14 }}>
        {loading && <div style={{ textAlign:"center", color:"var(--muted)", marginTop:60 }}>Yükleniyor...</div>}

        {/* ── BEKLEYEN ── */}
        {!loading && tab==="bekleyen" && (
          pending.length===0
            ? <div style={{ textAlign:"center", color:"var(--muted)", marginTop:60 }}><div style={{ fontSize:36 }}>✅</div><div style={{ marginTop:12, fontSize:14, fontStyle:"italic" }}>Bekleyen kayıt yok</div></div>
            : pending.map(s=>(
              <div key={s.id} style={{ ...card(), border:"1px solid rgba(58,106,154,.45)", animation:"bounce .4s ease-out" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:11 }}>
                  <div>
                    <div style={{ fontFamily:"var(--fh)", fontSize:17, color:"var(--cream)" }}>{s.ad}</div>
                    <div style={{ fontSize:13, color:"var(--muted)", marginTop:2 }}>📱 {s.tel}</div>
                    <div style={{ fontSize:12, color:"var(--muted)" }}>🕐 {s.created_at?.slice(11,16)}</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontFamily:"var(--fh)", fontSize:22, color:"var(--gsoft)" }}>Masa {s.masa}</div>
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

        {/* ── MASALAR (sadece aktif + inline sipariş) ── */}
        {!loading && tab==="masalar" && (
          <>
            {active.length===0 && orders.length===0 && (
              <div style={{ textAlign:"center", color:"var(--muted)", marginTop:60 }}>
                <div style={{ fontSize:36 }}>🪑</div>
                <div style={{ marginTop:12, fontSize:14, fontStyle:"italic" }}>Şu an aktif masa yok</div>
              </div>
            )}

            {/* Aktif masalar */}
            {active.map(s => {
                const sOrders = orders.filter(o => String(o.session_id)===String(s.id) || String(o.masa)===String(s.masa));
                const total   = sOrders.reduce((a,o)=>a+(o.toplam||0),0);
                const hasNew  = sOrders.some(o=>o.status==="yeni");
                return (
                  <div key={s.id} style={{ ...card({ border:`1px solid ${hasNew?"rgba(192,64,64,.5)":"rgba(58,138,92,.35)"}` }), animation: hasNew?"blink 2s ease-in-out infinite":"none" }}>
                    {/* Masa başlık */}
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                      <div>
                        <div style={{ fontFamily:"var(--fh)", fontSize:17, color:"var(--cream)" }}>
                          Masa {s.masa}
                          <span style={{ color:"var(--muted)", fontSize:13, fontFamily:"var(--fb)", marginLeft:8 }}>{s.ad}</span>
                        </div>
                        <div style={{ fontSize:12, color:"var(--muted)", marginTop:2 }}>
                          ⏱ {elapsed(s.created_at)} · 📱 {s.tel}
                        </div>
                      </div>
                      <div style={{ textAlign:"right" }}>
                        <div style={{ fontFamily:"var(--fh)", fontSize:20, color:"var(--gsoft)" }}>{isIsletmeci ? `${total}₺` : `${sOrders.length} sipariş`}</div>
                        <StatusBadge status={s.durum} />
                      </div>
                    </div>

                    {/* Siparişler inline */}
                    {sOrders.length===0
                      ? <div style={{ fontSize:13, color:"var(--muted)", fontStyle:"italic", padding:"6px 0" }}>Henüz sipariş yok</div>
                      : sOrders.map(o=>(
                        <div key={o.id} style={{ padding:"9px 12px", background:"var(--surf)", borderRadius:10, marginBottom:7, border:`1px solid ${o.status==="yeni"?"rgba(192,64,64,.4)":o.status==="hazırlanıyor"?"rgba(201,145,58,.3)":"rgba(58,138,92,.3)"}` }}>
                          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                            <span style={{ fontSize:11, color:"var(--muted)" }}>🕐 {o.created_at?.slice(11,16)}</span>
                            <span style={{ fontSize:11, padding:"2px 9px", borderRadius:20, fontWeight:600,
                              background:o.status==="yeni"?"rgba(192,64,64,.2)":o.status==="hazırlanıyor"?"rgba(201,145,58,.2)":"rgba(58,138,92,.2)",
                              color:o.status==="yeni"?"#e06060":o.status==="hazırlanıyor"?"var(--gsoft)":"#3aaa6a"
                            }}>{o.status}</span>
                          </div>
                          {(o.urunler||[]).map((u,i)=>(
                            <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:13, color:"var(--cream)", padding:"2px 0" }}>
                              <span><strong style={{ color:"var(--gsoft)" }}>{u.adet}×</strong> {u.ad}</span>
                              <span style={{ color:"var(--muted)" }}>{u.adet*u.fiyat}₺</span>
                            </div>
                          ))}
                          {/* Inline akış butonları */}
                          <div style={{ marginTop:8, display:"flex", justifyContent:"flex-end", gap:7 }}>
                            {o.status==="yeni"         && AB("🔥 Hazırlıyorum", ()=>orderAction(o.id,"hazırlanıyor"), "201,145,58")}
                            {o.status==="hazırlanıyor" && AB("✅ Servis Et", ()=>orderAction(o.id,"hazır"), "58,138,92")}
                          </div>
                        </div>
                      ))
                    }

                    {/* Masa aksiyon */}
                    <div style={{ display:"flex", gap:8, marginTop:10, flexWrap:"wrap" }}>
                      {AB("➕ Sipariş Ekle", ()=>{ setGarsonOrder(s); setGarsonCart([]); }, "58,138,92")}
                      {isIsletmeci && AB("⏸ Hesap & Askıya Al", ()=>sessionAction(s.id,"update","askida"), "201,145,58")}
                      {isIsletmeci && AB("🚫 Engelle", ()=>sessionAction(s.id,"update","engelli"), "192,64,64")}
                    </div>
                  </div>
                );
              })}

            {/* Tüm bekleyen/hazırlanan siparişler — session eşleşmesi olmasa bile */}
            {(() => {
              const shownIds = active.flatMap(s =>
                orders.filter(o => String(o.session_id)===String(s.id)||String(o.masa)===String(s.masa)).map(o=>o.id)
              );
              const orphans = orders.filter(o => !shownIds.includes(o.id) && o.status !== "hazır");
              if (!orphans.length) return null;
              return (
                <div style={{ marginTop: active.length ? 16 : 0 }}>
                  <div style={{ fontFamily:"var(--fh)", fontSize:12, color:"var(--muted)", marginBottom:9, letterSpacing:1 }}>DİĞER SİPARİŞLER</div>
                  {orphans.map(o => (
                    <div key={o.id} style={{ ...card({ border:`1px solid ${o.status==="yeni"?"rgba(192,64,64,.45)":"rgba(201,145,58,.38)"}` }) }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                        <span style={{ fontFamily:"var(--fh)", fontSize:14, color:"var(--cream)" }}>Masa {o.masa} · {o.musteri}</span>
                        <span style={{ fontSize:11, padding:"2px 9px", borderRadius:20, fontWeight:600,
                          background:o.status==="yeni"?"rgba(192,64,64,.2)":"rgba(201,145,58,.2)",
                          color:o.status==="yeni"?"#e06060":"var(--gsoft)"
                        }}>{o.status}</span>
                      </div>
                      {(o.urunler||[]).map((u,i) => (
                        <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:13, color:"var(--cream)", padding:"2px 0" }}>
                          <span><strong style={{ color:"var(--gsoft)" }}>{u.adet}×</strong> {u.ad}</span>
                          <span style={{ color:"var(--muted)" }}>{u.adet*u.fiyat}₺</span>
                        </div>
                      ))}
                      <div style={{ display:"flex", justifyContent:"flex-end", gap:7, marginTop:8 }}>
                        {o.status==="yeni"         && AB("🔥 Hazırlıyorum", ()=>orderAction(o.id,"hazırlanıyor"), "201,145,58")}
                        {o.status==="hazırlanıyor" && AB("✅ Servis Et",    ()=>orderAction(o.id,"hazır"),        "58,138,92")}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </>
        )}

        {/* ── MÜŞTERİLER ── */}
        {!loading && tab==="musteriler" && (
          <>
            {allCust.length===0
              ? <div style={{ textAlign:"center", color:"var(--muted)", marginTop:60 }}><div style={{ fontSize:36 }}>👥</div><div style={{ marginTop:12, fontSize:14, fontStyle:"italic" }}>Henüz müşteri kaydı yok</div></div>
              : allCust.map(s=>{
                  const hist = customerHistory(s);
                  return (
                    <div key={s.id} style={{ ...card() }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                        <div style={{ flex:1 }}>
                          <div style={{ fontFamily:"var(--fh)", fontSize:16, color:"var(--cream)" }}>{s.ad}</div>
                          <div style={{ fontSize:12, color:"var(--muted)", marginTop:2 }}>📱 {s.tel} · Masa {s.masa}</div>
                          <div style={{ fontSize:12, color:"var(--muted)" }}>🕐 {s.created_at?.slice(0,16).replace("T"," ")}</div>
                          <div style={{ fontSize:13, color:"var(--gsoft)", marginTop:3 }}>
                            💰 {hist.total}₺ · {hist.orders.length} sipariş
                          </div>
                        </div>
                        <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6 }}>
                          <StatusBadge status={s.durum} />
                        </div>
                      </div>
                      <div style={{ display:"flex", gap:7, marginTop:11, flexWrap:"wrap" }}>
                        {AB("📋 Geçmiş", ()=>setHistorySession(s), "201,145,58")}
                        {s.durum==="askida" && AB("↺ Yeniden Aç", ()=>sessionAction(s.id,"update","aktif"), "58,106,154")}
                        {s.durum==="aktif"  && AB("⏸ Askıya Al",  ()=>sessionAction(s.id,"update","askida"), "201,145,58")}
                        {s.durum!=="engelli" && AB("🚫 Engelle", ()=>sessionAction(s.id,"update","engelli"), "192,64,64")}
                        {s.durum==="engelli" && AB("✓ Engeli Kaldır", ()=>sessionAction(s.id,"update","askida"), "58,138,92")}
                        {AB("🗑 Sil", ()=>{ if(window.confirm(`${s.ad} silinsin mi?`)) sessionAction(s.id,"delete",""); }, "192,64,64")}
                      </div>
                    </div>
                  );
                })
            }
          </>
        )}

        {/* ── BİLDİRİMLER ── */}
        {!loading && tab==="bildirim" && (
          notifs.length===0
            ? <div style={{ textAlign:"center", color:"var(--muted)", marginTop:60 }}><div style={{ fontSize:36 }}>🔕</div><div style={{ marginTop:12, fontSize:14, fontStyle:"italic" }}>Bildirim yok</div></div>
            : [...notifs].reverse().map(n=>(
              <div key={n.id} style={{ ...card({
                background: n.type==="garson"?"rgba(58,106,154,.1)":"rgba(201,145,58,.08)",
                border:`1px solid ${n.type==="garson"?"rgba(58,106,154,.4)":"rgba(201,145,58,.35)"}`,
                animation: !n.acked?"blink 1.5s ease-in-out infinite":"none",
              })}}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                  <div>
                    <div style={{ fontFamily:"var(--fh)", fontSize:15, color:n.type==="garson"?"#6aaae0":"var(--gsoft)" }}>
                      {n.type==="garson" ? `🔔 Masa ${n.masa} — ${n.ad} garson istiyor` : `💳 Masa ${n.masa} — ${n.ad} hesap istiyor`}
                    </div>
                    {n.type==="hesap" && <div style={{ fontSize:13, color:"var(--cream)", marginTop:4 }}>Ödeme: {n.payment==="nakit"?"Nakit 💵":n.payment==="kart"?"Kart 💳":"QR 📱"} · <strong style={{ color:"var(--gsoft)" }}>{n.total}₺</strong></div>}
                    <div style={{ fontSize:11, color:"var(--muted)", marginTop:4 }}>📱 {n.tel} · {n.created_at?.slice(11,16)}</div>
                  </div>
                  {!n.acked && <button onClick={()=>ack(n.id)} style={{ background:"none", border:"1px solid var(--bord)", borderRadius:8, color:"var(--muted)", cursor:"pointer", padding:"5px 11px", fontSize:12, flexShrink:0, marginLeft:9 }}>✓ Tamam</button>}
                </div>
              </div>
            ))
        )}

        {/* ── ADMIN ── */}
        {!loading && tab==="admin" && <>
          {/* Günlük Özet */}
          <div style={{ fontFamily:"var(--fh)", fontSize:13, color:"var(--gsoft)", marginBottom:10 }}>📊 Bugünün Özeti</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:18 }}>
            {[
              { label:"Toplam Ciro", value:`${todayCiro}₺`, color:"var(--gsoft)" },
              { label:"Sipariş Sayısı", value:todayOrders.length, color:"#6aaae0" },
              { label:"Aktif Masa", value:active.length, color:"#3aaa6a" },
              { label:"Bekleyen", value:orders.filter(o=>o.status==="yeni"||o.status==="hazırlanıyor").length, color:"#e06060" },
            ].map((s,i)=>(
              <div key={i} style={{ padding:"12px 14px", background:"var(--surf2)", border:"1px solid var(--bord)", borderRadius:12 }}>
                <div style={{ fontSize:11, color:"var(--muted)", marginBottom:4 }}>{s.label}</div>
                <div style={{ fontFamily:"var(--fh)", fontSize:22, color:s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
          {enCokSatan.length>0 && (
            <div style={{ padding:"12px 14px", background:"var(--surf2)", border:"1px solid var(--bord)", borderRadius:12, marginBottom:18 }}>
              <div style={{ fontSize:11, color:"var(--muted)", marginBottom:10 }}>🏆 EN ÇOK SATAN</div>
              {enCokSatan.map(([ad,adet],i)=>(
                <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:14, color:"var(--cream)", padding:"4px 0", borderBottom:i<enCokSatan.length-1?"1px solid var(--bord)":"none" }}>
                  <span>{i===0?"🥇":i===1?"🥈":"🥉"} {ad}</span>
                  <span style={{ color:"var(--gsoft)" }}>{adet} adet</span>
                </div>
              ))}
            </div>
          )}

          {/* Özel Menü */}
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

          {/* Menü ürünü ekle */}
          <div style={{ fontFamily:"var(--fh)", fontSize:13, color:"var(--gsoft)", marginBottom:10 }}>📋 Menüye Ürün Ekle</div>
          <div style={{ padding:"13px 15px", background:"var(--surf2)", border:"1px solid var(--gdim)", borderRadius:14 }}>
            <select value={newItem.cat} onChange={e=>setNewItem({...newItem,cat:e.target.value})} style={{ width:"100%", background:"var(--surf)", border:"1px solid var(--bord)", borderRadius:9, padding:"10px 13px", color:"var(--cream)", fontSize:14, outline:"none", marginBottom:7 }}>
              {Object.keys(menu).map(c=><option key={c} value={c}>{c}</option>)}
            </select>
            {[["Ürün adı",newItem.name,v=>setNewItem({...newItem,name:v})],["Fiyat (₺)",newItem.price,v=>setNewItem({...newItem,price:v}),"number"],["Süre (dk)",newItem.wait,v=>setNewItem({...newItem,wait:v}),"number"],["Açıklama",newItem.desc,v=>setNewItem({...newItem,desc:v})]].map(([ph,val,fn,tp="text"],i)=>(
              <input key={i} type={tp} value={val} placeholder={ph} onChange={e=>fn(e.target.value)} style={{ width:"100%", background:"var(--surf)", border:"1px solid var(--bord)", borderRadius:9, padding:"10px 13px", color:"var(--cream)", fontSize:14, outline:"none", marginBottom:7 }} />
            ))}
            <button onClick={async()=>{ if(!newItem.name||!newItem.price)return; await api.post("panel.php",{action:"add_menu",kategori:newItem.cat,ad:newItem.name,fiyat:parseInt(newItem.price),sure:parseInt(newItem.wait)||5,aciklama:newItem.desc}); setNewItem({...newItem,name:"",price:"",desc:"",wait:""}); fetchAll(); }} style={{ width:"100%", padding:"10px", background:"linear-gradient(135deg,var(--gold) 0%,#8b5e2a 100%)", border:"none", borderRadius:10, color:"#0b0704", cursor:"pointer", fontFamily:"var(--fh)", fontSize:14, fontWeight:600 }}>+ Ekle</button>
          </div>
        </>}
      </div>

      {/* Müşteri Geçmiş Popup */}
      {historySession && (()=>{
        const hist = customerHistory(historySession);
        return (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.88)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:300, backdropFilter:"blur(4px)" }}>
            <div style={{ width:"100%", maxWidth:525, background:"var(--surf)", borderRadius:"22px 22px 0 0", padding:"22px 18px 38px", maxHeight:"80vh", display:"flex", flexDirection:"column", animation:"fadeUp .3s ease-out" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                <div>
                  <div style={{ fontFamily:"var(--fh)", fontSize:19, color:"var(--cream)" }}>{historySession.ad}</div>
                  <div style={{ fontSize:13, color:"var(--muted)" }}>📱 {historySession.tel} · Masa {historySession.masa}</div>
                </div>
                <button onClick={()=>setHistorySession(null)} style={{ background:"none", border:"none", color:"var(--muted)", cursor:"pointer", fontSize:24 }}>✕</button>
              </div>
              {/* Özet */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:9, marginBottom:14 }}>
                <div style={{ padding:"10px 12px", background:"var(--surf2)", borderRadius:12, textAlign:"center" }}>
                  <div style={{ fontSize:11, color:"var(--muted)" }}>TOPLAM HARCAMA</div>
                  <div style={{ fontFamily:"var(--fh)", fontSize:22, color:"var(--gsoft)", marginTop:2 }}>{hist.total}₺</div>
                </div>
                <div style={{ padding:"10px 12px", background:"var(--surf2)", borderRadius:12, textAlign:"center" }}>
                  <div style={{ fontSize:11, color:"var(--muted)" }}>SİPARİŞ SAYISI</div>
                  <div style={{ fontFamily:"var(--fh)", fontSize:22, color:"#6aaae0", marginTop:2 }}>{hist.orders.length}</div>
                </div>
              </div>
              {/* Sipariş geçmişi */}
              <div style={{ overflowY:"auto", flex:1 }}>
                {hist.orders.length===0
                  ? <div style={{ textAlign:"center", color:"var(--muted)", marginTop:30, fontStyle:"italic" }}>Sipariş geçmişi yok</div>
                  : hist.orders.map(o=>(
                    <div key={o.id} style={{ padding:"10px 12px", background:"var(--surf2)", borderRadius:12, marginBottom:8 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                        <span style={{ fontSize:12, color:"var(--muted)" }}>🕐 {o.created_at?.slice(11,16)}</span>
                        <span style={{ fontFamily:"var(--fh)", color:"var(--gsoft)", fontSize:14 }}>{o.toplam}₺</span>
                      </div>
                      {(o.urunler||[]).map((u,i)=>(
                        <div key={i} style={{ fontSize:13, color:"var(--cream)", padding:"2px 0" }}>{u.adet}× {u.ad}</div>
                      ))}
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        );
      })()}

      {/* Garson Sipariş Ekleme Popup */}
      {garsonOrder && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.9)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:300, backdropFilter:"blur(4px)" }}>
          <div style={{ width:"100%", maxWidth:525, background:"var(--surf)", borderRadius:"22px 22px 0 0", padding:"20px 18px 36px", maxHeight:"85vh", display:"flex", flexDirection:"column", animation:"fadeUp .3s ease-out" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14, flexShrink:0 }}>
              <div>
                <div style={{ fontFamily:"var(--fh)", fontSize:18, color:"var(--cream)" }}>➕ Sipariş Ekle</div>
                <div style={{ fontSize:13, color:"var(--muted)" }}>Masa {garsonOrder.masa} · {garsonOrder.ad}</div>
              </div>
              <button onClick={()=>{ setGarsonOrder(null); setGarsonCart([]); }} style={{ background:"none", border:"none", color:"var(--muted)", cursor:"pointer", fontSize:24 }}>✕</button>
            </div>
            {garsonCart.length>0 && (
              <div style={{ padding:"10px 14px", background:"rgba(58,138,92,.12)", border:"1px solid rgba(58,138,92,.35)", borderRadius:12, marginBottom:12, display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
                <div style={{ flex:1, fontSize:14, color:"var(--cream)" }}>{garsonCart.map(c=>`${c.qty}× ${c.name}`).join(", ")}</div>
                <div style={{ fontFamily:"var(--fh)", color:"var(--gsoft)", fontSize:16, flexShrink:0 }}>{garsonCart.reduce((s,c)=>s+c.price*c.qty,0)}₺</div>
              </div>
            )}
            <div style={{ flex:1, overflowY:"auto", marginBottom:12 }}>
              {Object.entries(menu).map(([cat, items])=>(
                <div key={cat} style={{ marginBottom:10 }}>
                  <div style={{ fontSize:12, color:"var(--muted)", fontFamily:"var(--fh)", marginBottom:5, letterSpacing:.8 }}>{cat}</div>
                  {items.map(item=>{
                    const qty = garsonCart.find(c=>c.id===item.id)?.qty || 0;
                    return (
                      <div key={item.id} style={{ display:"flex", alignItems:"center", padding:"8px 10px", borderBottom:"1px solid var(--bord)", background:qty>0?"rgba(58,138,92,.06)":"transparent", transition:"background .2s" }}>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:14, color:"var(--cream)" }}>{item.name}</div>
                          <div style={{ fontSize:11, color:"var(--muted)" }}>{item.price}₺ · ~{item.wait}dk</div>
                        </div>
                        <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                          {qty>0 && <>
                            <button onClick={()=>garsonRemoveFromCart(item)} style={{ width:26, height:26, borderRadius:"50%", background:"var(--surf2)", border:"1px solid var(--bord)", color:"var(--muted)", cursor:"pointer", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center" }}>−</button>
                            <span style={{ fontFamily:"var(--fh)", fontSize:14, color:"var(--cream)", minWidth:16, textAlign:"center" }}>{qty}</span>
                          </>}
                          <button onClick={()=>garsonAddToCart(item)} style={{ width:28, height:28, borderRadius:"50%", background:"linear-gradient(135deg,var(--gold) 0%,#8b5e2a 100%)", border:"none", color:"#0b0704", cursor:"pointer", fontSize:18, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700 }}>+</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <button onClick={submitGarsonOrder} disabled={!garsonCart.length||garsonLoading} style={{ width:"100%", padding:"14px", background:garsonCart.length?"linear-gradient(135deg,var(--gold) 0%,#8b5e2a 100%)":"var(--surf2)", border:"none", borderRadius:14, color:garsonCart.length?"#0b0704":"var(--muted)", cursor:garsonCart.length?"pointer":"not-allowed", fontFamily:"var(--fh)", fontSize:16, fontWeight:600, display:"flex", alignItems:"center", justifyContent:"center", gap:8, flexShrink:0 }}>
              {garsonLoading
                ? <div style={{ width:18, height:18, borderRadius:"50%", border:"2px solid #8b5e2a", borderTopColor:"transparent", animation:"spin .8s linear infinite" }}/>
                : `🛎 Siparişi Gönder${garsonCart.length?" ("+garsonCart.reduce((s,c)=>s+c.price*c.qty,0)+"₺)":""}`
              }
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
/* ══════════════════════════════════════════════════════════
   ROL SEÇİM EKRANI
══════════════════════════════════════════════════════════ */
// PIN'ler — ileride DB'den çekilebilir
const PINS = { garson: "1234", isletmeci: "0000" };

const PinEntry = ({ rol, onSuccess, onBack }) => {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const isGarson = rol === "garson";

  const check = () => {
    if (pin === PINS[rol]) { onSuccess(); }
    else { setErr("Hatalı PIN, tekrar deneyin."); setPin(""); }
  };

  return (
    <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background:"var(--bg)", padding:28 }}>
      <div style={{ width:64, height:64, borderRadius:"50%", background: isGarson ? "linear-gradient(135deg,#3a6a9a 0%,#1a3a5a 100%)" : "linear-gradient(135deg,var(--gold) 0%,#6b3d10 100%)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:30, marginBottom:18, boxShadow:`0 0 28px ${isGarson ? "rgba(58,106,154,.35)" : "rgba(201,145,58,.35)"}`, animation:"float 4s ease-in-out infinite" }}>
        {isGarson ? "👨‍🍳" : "👔"}
      </div>
      <div style={{ fontFamily:"var(--fh)", fontSize:22, color:"var(--cream)", marginBottom:6 }}>
        {isGarson ? "Garson Girişi" : "İşletmeci Girişi"}
      </div>
      <div style={{ fontSize:13, color:"var(--muted)", fontStyle:"italic", marginBottom:28 }}>PIN kodunuzu girin</div>

      <div style={{ width:"100%", maxWidth:280 }}>
        <input
          type="password" value={pin} onChange={e=>setPin(e.target.value)} placeholder="••••"
          onKeyDown={e=>e.key==="Enter"&&check()}
          maxLength={6}
          style={{ width:"100%", background:"var(--surf2)", border:"1px solid var(--bord)", borderRadius:14, padding:"16px 20px", color:"var(--cream)", fontSize:28, outline:"none", textAlign:"center", letterSpacing:8, marginBottom:12 }}
          onFocus={e=>e.target.style.borderColor="var(--gdim)"}
          onBlur={e=>e.target.style.borderColor="var(--bord)"}
          autoFocus
        />
        {err && <div style={{ padding:"8px 12px", background:"rgba(192,64,64,.15)", border:"1px solid rgba(192,64,64,.35)", borderRadius:10, fontSize:13, color:"#e06060", marginBottom:12, textAlign:"center" }}>⚠️ {err}</div>}
        <button onClick={check} style={{ width:"100%", padding:"14px", background:`linear-gradient(135deg,${isGarson?"#3a6a9a 0%,#1a3a5a":"var(--gold) 0%,#8b5e2a"} 100%)`, border:"none", borderRadius:12, color: isGarson ? "#e8f0f8" : "#0b0704", cursor:"pointer", fontFamily:"var(--fh)", fontSize:17, fontWeight:600, boxShadow:`0 4px 16px ${isGarson?"rgba(58,106,154,.3)":"rgba(201,145,58,.3)"}` }}>
          Giriş Yap →
        </button>
        <button onClick={onBack} style={{ width:"100%", padding:"11px", marginTop:10, background:"none", border:"1px solid var(--bord)", borderRadius:12, color:"var(--muted)", cursor:"pointer", fontFamily:"var(--fb)", fontSize:14 }}>← Geri</button>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════
   ROOT
══════════════════════════════════════════════════════════ */
export default function App() {
  // URL parametresine göre rol belirlenir
  // Müşteri: garson.vercel.app              (param yok)
  // Garson:  garson.vercel.app?rol=garson   → direkt PIN
  // İşletmeci: garson.vercel.app?rol=isletmeci → direkt PIN
  const urlRol = new URLSearchParams(window.location.search).get("rol"); // null | "garson" | "isletmeci"
  const isPersonel = urlRol === "garson" || urlRol === "isletmeci";

  const [authed, setAuthed]         = useState(false);
  const [session, setSession]       = useState(null);
  const [sessionStatus, setSessionStatus] = useState(null);
  const [menu, setMenu]             = useState({});
  const [specials, setSpecials]     = useState([]);
  const [tableOrders, setTableOrders] = useState([]);
  const [menuLoaded, setMenuLoaded] = useState(false);

  // Menü her zaman çekilir
  useEffect(() => {
    api.get("panel.php?type=menu").then(r => {
      if (r.menu) setMenu(r.menu);
      if (r.specials) setSpecials(r.specials);
      setMenuLoaded(true);
    }).catch(() => setMenuLoaded(true));
  }, []);

  // Müşteri: daha önce kayıt varsa geri yükle
  useEffect(() => {
    if (isPersonel) return;
    const savedId = localStorage.getItem("sg_session_id");
    if (savedId) {
      api.get(`session.php?id=${savedId}`).then(r => {
        if (r.session) { setSession(r.session); setSessionStatus(r.session.durum); }
        else localStorage.removeItem("sg_session_id");
      }).catch(() => {});
    }
  }, []);

  // Müşteri: oturum poll
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

  // ── RENDER ───────────────────────────────────────────────

  // Personel akışı: ?rol=garson veya ?rol=isletmeci
  if (isPersonel) {
    // PIN girilmemişse PIN ekranı
    if (!authed) {
      return <PinEntry
        rol={urlRol}
        onSuccess={() => setAuthed(true)}
        onBack={() => window.location.href = window.location.pathname}
      />;
    }
    // PIN doğrulandı → panel
    return <GarsonPanel
      rol={urlRol}
      onBack={() => setAuthed(false)}
    />;
  }

  // Müşteri akışı: varsayılan
  if (!menuLoaded) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"var(--bg)" }}>
      <div style={{ width:40, height:40, borderRadius:"50%", border:"3px solid var(--gdim)", borderTopColor:"var(--gold)", animation:"spin .8s linear infinite" }} />
    </div>
  );

  if (!session) return <RegisterScreen onRegister={s => { setSession(s); setSessionStatus(s.durum); }} />;
  if (sessionStatus === "engelli") return <RegisterScreen blockedMsg="engelli" />;
  if (sessionStatus === "askida")  return <SuspendedScreen session={session} />;
  if (sessionStatus === "bekliyor") return <WaitingScreen session={session} />;

  return (
    <CustomerChat
      session={session}
      menu={menu}
      specials={specials}
      tableOrders={tableOrders}
      setTableOrders={setTableOrders}
      onViewGarson={() => {}}
    />
  );
}
