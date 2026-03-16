import { useState, useRef, useEffect, useCallback } from "react";

const API = import.meta.env.VITE_API_BASE || "https://garson.testokulu.com/garson-api";

/* ── API ─────────────────────────────────────────────────── */
const req = async (path, opts = {}) => {
  const token = localStorage.getItem("sg_token");
  const res = await fetch(`${API}/${path}`, {
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...opts,
  });
  return res.json();
};
const get  = path         => req(path);
const post = (path, data) => req(path, { method: "POST", body: JSON.stringify({ ...data, _token: localStorage.getItem("sg_token") }) });

/* ── HELPERS ─────────────────────────────────────────────── */
const ts = () => new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
const uid = () => Math.random().toString(36).slice(2, 9);

const parseOrder = t => {
  const m = t.match(/###SIPARIS###\s*([\s\S]*?)\s*###BITIS###/);
  if (!m) return null; try { return JSON.parse(m[1]); } catch { return null; }
};
const cleanText = t => t.replace(/###SIPARIS###[\s\S]*?###BITIS###/g, "").trim();
const cleanTTS  = t => cleanText(t).replace(/(\d+)\s*₺/g, (_, n) => `${n} lira`).replace(/[₺*#•→←_]/g, " ").replace(/\s{2,}/g, " ").trim();

const playBeep = (f = 880, d = 0.3, n = 1) => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    for (let i = 0; i < n; i++) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = "sine"; o.frequency.value = f;
      const t = ctx.currentTime + i * (d + 0.1);
      g.gain.setValueAtTime(0.4, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
      o.start(t); o.stop(t + d + 0.01);
    }
  } catch {}
};

const qrUrl = (url) => `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(url)}&bgcolor=0b0704&color=e8b86d`;

/* ── SMALL UI ────────────────────────────────────────────── */
const Wave = ({ active }) => (
  <div style={{ display: "flex", gap: 3, alignItems: "center", height: 20 }}>
    {[0, .1, .2, .3, .4].map((d, i) => (
      <div key={i} style={{ width: 3, height: "100%", background: "#fff", borderRadius: 2, transformOrigin: "center", animation: active ? `waveBar .8s ease-in-out ${d}s infinite` : "none", transform: active ? undefined : "scaleY(.3)" }} />
    ))}
  </div>
);

const Dots = () => (
  <span style={{ display: "inline-flex", gap: 4, alignItems: "center", marginLeft: 4 }}>
    {[0, .2, .4].map((d, i) => <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--gold)", display: "block", animation: `glow 1s ease-in-out ${d}s infinite` }} />)}
  </span>
);

const Badge = ({ status }) => {
  const m = { bekliyor: ["Bekliyor", "#6aaae0", "rgba(58,106,154,.2)"], aktif: ["Aktif", "#3aaa6a", "rgba(58,138,92,.2)"], askida: ["Askıda", "var(--gsoft)", "rgba(201,145,58,.2)"] };
  const [l, c, bg] = m[status] || m.bekliyor;
  return <span style={{ fontSize: 12, padding: "3px 12px", borderRadius: 20, background: bg, color: c, fontWeight: 600 }}>{l}</span>;
};

const Inp = ({ label, value, onChange, type = "text", placeholder, autoFocus }) => (
  <div style={{ marginBottom: 14 }}>
    {label && <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 5, letterSpacing: .8, fontFamily: "var(--fh)" }}>{label}</div>}
    <input autoFocus={autoFocus} type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ width: "100%", background: "var(--surf2)", border: "1px solid var(--bord)", borderRadius: 12, padding: "13px 16px", color: "var(--cream)", fontSize: 16, outline: "none" }}
      onFocus={e => e.target.style.borderColor = "var(--gdim)"} onBlur={e => e.target.style.borderColor = "var(--bord)"}
    />
  </div>
);

const Btn = ({ label, onClick, gold, disabled, small }) => (
  <button onClick={onClick} disabled={disabled} style={{
    width: "100%", padding: small ? "10px" : "14px",
    background: disabled ? "var(--surf2)" : gold ? "linear-gradient(135deg,var(--gold) 0%,#8b5e2a 100%)" : "var(--surf2)",
    border: gold ? "none" : "1px solid var(--bord)", borderRadius: 12,
    color: disabled ? "var(--muted)" : gold ? "#0b0704" : "var(--cream)",
    cursor: disabled ? "not-allowed" : "pointer", fontFamily: "var(--fh)", fontSize: small ? 14 : 16, fontWeight: 600,
    boxShadow: gold && !disabled ? "0 4px 16px rgba(201,145,58,.3)" : "none", transition: "all .2s",
  }}>{label}</button>
);

const Spin = () => <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid rgba(201,145,58,.3)", borderTopColor: "var(--gold)", animation: "spin .8s linear infinite" }} />;

/* ══════════════════════════════════════════════════════════
   STAFF LOGIN
══════════════════════════════════════════════════════════ */
const StaffLogin = ({ onLogin }) => {
  const [tel, setTel]     = useState("");
  const [pass, setPass]   = useState("");
  const [err, setErr]     = useState("");
  const [loading, setLoading] = useState(false);

  const login = async () => {
    if (!tel || !pass) return setErr("Telefon ve şifre gerekli.");
    setLoading(true); setErr("");
    const r = await post("auth.php", { tel, sifre: pass });
    if (r.error) { setErr(r.error); setLoading(false); return; }
    localStorage.setItem("sg_token", r.token);
    localStorage.setItem("sg_staff", JSON.stringify(r));
    onLogin(r);
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: 28 }}>
      <div style={{ position: "fixed", inset: 0, background: "radial-gradient(ellipse 70% 50% at 50% 30%, rgba(201,145,58,.06) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ width: 68, height: 68, borderRadius: "50%", background: "linear-gradient(135deg,var(--gold) 0%,#6b3d10 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, marginBottom: 18, boxShadow: "0 0 32px rgba(201,145,58,.3)", animation: "float 4s ease-in-out infinite", position: "relative", zIndex: 1 }}>🍽️</div>
      <div style={{ fontFamily: "var(--fh)", fontSize: 24, color: "var(--cream)", marginBottom: 4, position: "relative", zIndex: 1 }}>Personel Girişi</div>
      <div style={{ fontSize: 13, color: "var(--muted)", fontStyle: "italic", marginBottom: 28, position: "relative", zIndex: 1 }}>Telefon ve şifrenizle giriş yapın</div>
      <div style={{ width: "100%", maxWidth: 340, position: "relative", zIndex: 1 }}>
        <Inp label="TELEFON" value={tel} onChange={setTel} type="tel" placeholder="05xx xxx xx xx" autoFocus />
        <Inp label="ŞİFRE" value={pass} onChange={setPass} type="password" placeholder="••••••" />
        {err && <div style={{ padding: "10px 14px", background: "rgba(192,64,64,.15)", border: "1px solid rgba(192,64,64,.35)", borderRadius: 10, fontSize: 13, color: "#e06060", marginBottom: 14 }}>⚠️ {err}</div>}
        <button onClick={login} disabled={loading} style={{ width: "100%", padding: "14px", background: loading ? "var(--surf2)" : "linear-gradient(135deg,var(--gold) 0%,#8b5e2a 100%)", border: "none", borderRadius: 12, color: loading ? "var(--muted)" : "#0b0704", cursor: loading ? "not-allowed" : "pointer", fontFamily: "var(--fh)", fontSize: 17, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          {loading ? <Spin /> : "Giriş Yap →"}
        </button>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════
   CUSTOMER: WAITING
══════════════════════════════════════════════════════════ */
const WaitingScreen = ({ venueAd, masaNo }) => (
  <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: 28 }}>
    <div style={{ position: "relative", width: 90, height: 90, marginBottom: 24 }}>
      {[0, 1, 2].map(i => <div key={i} style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "2px solid rgba(201,145,58,.4)", animation: `spin ${2 + i * .5}s linear infinite`, transform: `scale(${1 + i * .2})` }} />)}
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34 }}>⏳</div>
    </div>
    <div style={{ fontFamily: "var(--fh)", fontSize: 22, color: "var(--cream)", marginBottom: 8, textAlign: "center" }}>Onay Bekleniyor</div>
    <div style={{ fontSize: 14, color: "var(--muted)", fontStyle: "italic", textAlign: "center", lineHeight: 1.7, marginBottom: 24 }}>
      <strong style={{ color: "var(--gsoft)" }}>{venueAd}</strong>'e hoş geldiniz.<br />Garsonumuz sizi görecek.
    </div>
    <div style={{ padding: "14px 28px", background: "var(--surf2)", border: "1px solid var(--bord)", borderRadius: 16, textAlign: "center" }}>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>MASA</div>
      <div style={{ fontFamily: "var(--fh)", fontSize: 32, color: "var(--gsoft)" }}>{masaNo}</div>
    </div>
    <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 8, color: "var(--muted)", fontSize: 13, fontStyle: "italic", animation: "blink 2s ease-in-out infinite" }}>
      <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#6aaae0" }} />
      Garsonunuz geliyor...
    </div>
  </div>
);

/* ══════════════════════════════════════════════════════════
   CUSTOMER: MENU VIEW (with cart)
══════════════════════════════════════════════════════════ */
const MenuView = ({ menu, specials, cart, onAdd, onRemove, onOrder, orderLoading }) => {
  const [open, setOpen] = useState(Object.keys(menu)[0] || "");
  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  const PlusBtn = ({ item }) => {
    const qty = cart.find(c => c.id === item.id)?.qty || 0;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, marginLeft: 10 }}>
        {qty > 0 && <>
          <button onClick={() => onRemove(item)} style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--surf)", border: "1px solid var(--bord)", color: "var(--muted)", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
          <span style={{ fontFamily: "var(--fh)", fontSize: 14, color: "var(--cream)", minWidth: 16, textAlign: "center" }}>{qty}</span>
        </>}
        <button onClick={() => onAdd(item)} style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg,var(--gold) 0%,#8b5e2a 100%)", border: "none", color: "#0b0704", cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>+</button>
      </div>
    );
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {cartCount > 0 && (
        <div style={{ padding: "10px 14px", background: "linear-gradient(135deg,rgba(201,145,58,.18) 0%,rgba(139,94,42,.1) 100%)", borderBottom: "1px solid rgba(201,145,58,.3)", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <div style={{ flex: 1 }}>
            <span style={{ fontFamily: "var(--fh)", color: "var(--gsoft)", fontSize: 14 }}>{cartCount} ürün</span>
            <span style={{ color: "var(--muted)", fontSize: 13, marginLeft: 8 }}>· {cartTotal}₺</span>
          </div>
          <button onClick={onOrder} disabled={orderLoading} style={{ padding: "8px 18px", background: "linear-gradient(135deg,var(--gold) 0%,#8b5e2a 100%)", border: "none", borderRadius: 12, color: "#0b0704", cursor: orderLoading ? "not-allowed" : "pointer", fontFamily: "var(--fh)", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
            {orderLoading ? <Spin /> : "🛎 Sipariş Ver"}
          </button>
        </div>
      )}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px" }}>
        {specials.length > 0 && (
          <div style={{ marginBottom: 14, padding: "13px 15px", background: "linear-gradient(135deg,rgba(201,145,58,.18) 0%,rgba(139,94,42,.08) 100%)", border: "1px solid rgba(201,145,58,.4)", borderRadius: 14 }}>
            <div style={{ fontFamily: "var(--fh)", fontSize: 14, color: "var(--gsoft)", marginBottom: 9 }}>⭐ Günün Özel Menüsü</div>
            {specials.map((s, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: i < specials.length - 1 ? "1px solid var(--bord)" : "none" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, color: "var(--cream)" }}>{s.name}</div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)", fontStyle: "italic" }}>{s.desc}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ fontFamily: "var(--fh)", color: "var(--gsoft)", fontSize: 15 }}>{s.price}₺</div>
                  <PlusBtn item={{ id: `sp_${i}`, name: s.name, price: s.price, wait: 5 }} />
                </div>
              </div>
            ))}
          </div>
        )}
        {Object.entries(menu).map(([cat, items]) => (
          <div key={cat} style={{ marginBottom: 9 }}>
            <button onClick={() => setOpen(open === cat ? null : cat)} style={{ width: "100%", background: open === cat ? "var(--gdim)" : "var(--surf2)", border: "1px solid var(--bord)", borderRadius: 10, padding: "11px 15px", color: "var(--cream)", cursor: "pointer", display: "flex", justifyContent: "space-between", fontFamily: "var(--fh)", fontSize: 14, transition: "all .2s" }}>
              <span>{cat}</span><span style={{ color: "var(--gold)", fontSize: 11 }}>{open === cat ? "▲" : "▼"}</span>
            </button>
            {open === cat && items.map((item, i) => (
              <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 12px", borderBottom: i < items.length - 1 ? "1px solid var(--bord)" : "none", background: cart.find(c => c.id === item.id) ? "rgba(201,145,58,.05)" : "transparent", transition: "background .2s" }}>
                <div style={{ flex: 1 }}>
                  {item.img && <img src={item.img} alt={item.name} style={{ width: "100%", borderRadius: 8, marginBottom: 6, maxHeight: 120, objectFit: "cover" }} />}
                  <div style={{ fontSize: 14.5, color: "var(--cream)" }}>{item.name}</div>
                  {item.desc && <div style={{ fontSize: 12, color: "var(--muted)", fontStyle: "italic", marginTop: 2 }}>{item.desc}</div>}
                  <div style={{ fontSize: 11, color: "var(--gold)", marginTop: 2 }}>⏱ ~{item.wait} dk</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ fontFamily: "var(--fh)", fontSize: 15, color: "var(--gsoft)", fontWeight: 600 }}>{item.price}₺</div>
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
   CUSTOMER: HESAP VIEW
══════════════════════════════════════════════════════════ */
const HesapView = ({ session, tableOrders, venueId, onCallWaiter }) => {
  const [payModal, setPayModal] = useState(false);
  const [pay, setPay]           = useState(null);
  const [sent, setSent]         = useState(false);

  const allItems = tableOrders.flatMap(o => o.urunler || []);
  const total    = tableOrders.reduce((s, o) => s + (o.toplam || 0), 0);
  const grouped  = allItems.reduce((acc, u) => {
    const ex = acc.find(i => i.ad === u.ad && i.fiyat === u.fiyat);
    if (ex) ex.adet += u.adet; else acc.push({ ...u });
    return acc;
  }, []);

  const requestBill = async () => {
    await post("panel.php", { action: "notify", venue_id: venueId, session_id: session.id, masa_no: session.masa_no, type: "hesap", payment: pay, total });
    setSent(true); setPayModal(false); playBeep(550, .35, 2);
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
        <div style={{ padding: "12px 15px", background: "var(--surf2)", border: "1px solid var(--bord)", borderRadius: 14, marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: "var(--fh)", fontSize: 15, color: "var(--cream)" }}>Masa {session.masa_no}</div>
          <Badge status={session.durum} />
        </div>
        <button onClick={onCallWaiter} style={{ width: "100%", padding: "13px 18px", marginBottom: 14, background: "rgba(58,106,154,.15)", border: "1px solid rgba(58,106,154,.45)", borderRadius: 14, color: "#6aaae0", cursor: "pointer", fontFamily: "var(--fh)", fontSize: 15 }}>🔔 Garson Çağır</button>

        {sent && <div style={{ padding: "12px 15px", background: "rgba(58,138,92,.13)", border: "1px solid rgba(58,138,92,.4)", borderRadius: 12, marginBottom: 14, color: "#3aaa6a", fontFamily: "var(--fh)", fontSize: 14, textAlign: "center" }}>✅ Hesap isteğiniz garsonumuza iletildi.</div>}

        {grouped.length === 0
          ? <div style={{ textAlign: "center", color: "var(--muted)", marginTop: 50 }}><div style={{ fontSize: 40 }}>🍽️</div><div style={{ marginTop: 12, fontSize: 14, fontStyle: "italic" }}>Henüz sipariş verilmedi</div></div>
          : <>
            <div style={{ background: "var(--surf2)", border: "1px solid var(--bord)", borderRadius: 14, overflow: "hidden", marginBottom: 12 }}>
              <div style={{ padding: "11px 15px", borderBottom: "1px solid var(--bord)", fontFamily: "var(--fh)", fontSize: 12, color: "var(--muted)", letterSpacing: .8 }}>SİPARİŞLERİNİZ</div>
              {grouped.map((u, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 15px", borderBottom: i < grouped.length - 1 ? "1px solid var(--bord)" : "none" }}>
                  <div>
                    <div style={{ fontSize: 15, color: "var(--cream)" }}>{u.ad}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 1 }}>{u.adet} adet × {u.fiyat}₺</div>
                  </div>
                  <div style={{ fontFamily: "var(--fh)", fontSize: 15, color: "var(--gsoft)", fontWeight: 600 }}>{u.adet * u.fiyat}₺</div>
                </div>
              ))}
            </div>
            {tableOrders.map(o => (
              <div key={o.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 12px", marginBottom: 5, background: "var(--surf)", borderRadius: 10, border: `1px solid ${o.status === "yeni" ? "rgba(192,64,64,.3)" : o.status === "hazırlanıyor" ? "rgba(201,145,58,.3)" : "rgba(58,138,92,.3)"}` }}>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>🕐 {o.created_at?.slice(11, 16) || ""}</span>
                <span style={{ fontSize: 12, padding: "2px 10px", borderRadius: 20, background: o.status === "yeni" ? "rgba(192,64,64,.18)" : o.status === "hazırlanıyor" ? "rgba(201,145,58,.18)" : "rgba(58,138,92,.18)", color: o.status === "yeni" ? "#e06060" : o.status === "hazırlanıyor" ? "var(--gsoft)" : "#3aaa6a" }}>
                  {o.status === "yeni" ? "⏳ Alındı" : o.status === "hazırlanıyor" ? "🔥 Hazırlanıyor" : "✅ Hazır!"}
                </span>
              </div>
            ))}
          </>
        }
      </div>

      {grouped.length > 0 && !sent && (
        <div style={{ padding: "12px 14px 20px", borderTop: "1px solid var(--bord)", background: "rgba(22,14,8,.95)", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontFamily: "var(--fh)", color: "var(--cream)", fontSize: 16 }}>Toplam</span>
            <span style={{ fontFamily: "var(--fh)", color: "var(--gsoft)", fontSize: 26 }}>{total}₺</span>
          </div>
          <button onClick={() => setPayModal(true)} style={{ width: "100%", padding: "14px", background: "linear-gradient(135deg,var(--gold) 0%,#8b5e2a 100%)", border: "none", borderRadius: 14, color: "#0b0704", cursor: "pointer", fontFamily: "var(--fh)", fontSize: 17, fontWeight: 600 }}>💳 Hesap İstiyorum</button>
        </div>
      )}

      {payModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.88)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 200, backdropFilter: "blur(4px)" }}>
          <div style={{ width: "100%", maxWidth: 525, background: "var(--surf)", borderRadius: "22px 22px 0 0", padding: "22px 18px 38px", animation: "fadeUp .3s ease-out" }}>
            <div style={{ fontFamily: "var(--fh)", fontSize: 19, color: "var(--cream)", marginBottom: 16 }}>Ödeme Yöntemi</div>
            {[{ id: "nakit", icon: "💵", label: "Nakit" }, { id: "kart", icon: "💳", label: "Kredi / Banka Kartı" }, { id: "qr", icon: "📱", label: "QR Kod" }].map(p => (
              <button key={p.id} onClick={() => setPay(p.id)} style={{ width: "100%", padding: "12px 17px", marginBottom: 9, background: pay === p.id ? "var(--gdim)" : "var(--surf2)", border: `1px solid ${pay === p.id ? "var(--gold)" : "var(--bord)"}`, borderRadius: 13, color: "var(--cream)", cursor: "pointer", display: "flex", alignItems: "center", gap: 13, fontSize: 15, transition: "all .2s" }}>
                <span style={{ fontSize: 22 }}>{p.icon}</span><span>{p.label}</span>
                {pay === p.id && <span style={{ marginLeft: "auto", color: "var(--gold)" }}>✓</span>}
              </button>
            ))}
            <div style={{ display: "flex", gap: 9, marginTop: 7 }}>
              <button onClick={() => setPayModal(false)} style={{ flex: 1, padding: "11px", background: "var(--surf2)", border: "1px solid var(--bord)", borderRadius: 12, color: "var(--muted)", cursor: "pointer", fontSize: 14 }}>Vazgeç</button>
              <button disabled={!pay} onClick={requestBill} style={{ flex: 2, padding: "11px", background: pay ? "linear-gradient(135deg,var(--gold) 0%,#8b5e2a 100%)" : "var(--surf2)", border: "none", borderRadius: 12, color: pay ? "#0b0704" : "var(--muted)", cursor: pay ? "pointer" : "not-allowed", fontFamily: "var(--fh)", fontSize: 15, fontWeight: 600 }}>Hesabı İste ✓</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════════════════
   CUSTOMER: CHAT
══════════════════════════════════════════════════════════ */
const CustomerChat = ({ session, venueAd }) => {
  const [menu, setMenu]           = useState({});
  const [specials, setSpecials]   = useState([]);
  const [tableOrders, setTableOrders] = useState([]);
  const [msgs, setMsgs]           = useState([{ role: "assistant", content: `${venueAd}'e hoş geldiniz! Masa ${session.masa_no}. Ne arzu edersiniz?`, id: 1, time: ts() }]);
  const [input, setInput]         = useState("");
  const [listening, setListening] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [speaking, setSpeaking]   = useState(false);
  const [tab, setTab]             = useState("chat");
  const [cart, setCart]           = useState([]);
  const [orderLoading, setOrderLoading] = useState(false);
  const endRef  = useRef(null);
  const recRef  = useRef(null);
  const taRef   = useRef(null);
  const convRef = useRef([]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  useEffect(() => {
    get(`panel.php?type=menu&session_id=${session.id}`).then(r => { if (r.menu) setMenu(r.menu); if (r.specials) setSpecials(r.specials); });
  }, []);

  useEffect(() => {
    const poll = async () => {
      const r = await get(`order.php?session_id=${session.id}`);
      if (r.orders) setTableOrders(r.orders.map(o => ({ ...o, urunler: typeof o.urunler === "string" ? JSON.parse(o.urunler) : (o.urunler || []) })));
    };
    poll();
    const i = setInterval(poll, 4000);
    return () => clearInterval(i);
  }, [session.id]);

  const speak = useCallback(text => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(cleanTTS(text));
    u.lang = "tr-TR"; u.rate = 1.05;
    u.onstart = () => setSpeaking(true);
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
  }, []);

  const send = useCallback(async text => {
    if (!text.trim() || loading) return;
    setMsgs(p => [...p, { role: "user", content: text, id: Date.now(), time: ts() }]);
    setInput(""); if (taRef.current) taRef.current.style.height = "auto";
    setLoading(true);
    convRef.current = [...convRef.current, { role: "user", content: text }];
    try {
      const r = await post("chat.php", { session_id: session.id, messages: convRef.current });
      if (r.error === "INACTIVE") { setMsgs(p => [...p, { role: "assistant", content: "Oturumunuz sona erdi.", id: Date.now(), time: ts() }]); setLoading(false); return; }
      const reply = r.content?.[0]?.text || "Bir sorun oluştu.";
      convRef.current = [...convRef.current, { role: "assistant", content: reply }];
      setMsgs(p => [...p, { role: "assistant", content: reply, id: Date.now(), time: ts() }]);
      const order = parseOrder(reply);
      if (order) {
        await post("order.php", { action: "create", session_id: session.id, venue_id: session.venue_id, masa_no: session.masa_no, urunler: order.urunler, toplam: order.toplam, not: order.not || "" });
        playBeep(880, .3, 2);
      }
      speak(reply);
    } catch { setMsgs(p => [...p, { role: "assistant", content: "Bağlantı sorunu, tekrar deneyin.", id: Date.now(), time: ts() }]); }
    setLoading(false);
  }, [loading, session, speak]);

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

  const addToCart = item => setCart(p => { const ex = p.find(c => c.id === item.id); return ex ? p.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c) : [...p, { ...item, qty: 1 }]; });
  const removeFromCart = item => setCart(p => { const ex = p.find(c => c.id === item.id); return (!ex || ex.qty <= 1) ? p.filter(c => c.id !== item.id) : p.map(c => c.id === item.id ? { ...c, qty: c.qty - 1 } : c); });

  const submitCart = async () => {
    if (!cart.length || orderLoading) return;
    setOrderLoading(true);
    const urunler = cart.map(c => ({ ad: c.name, adet: c.qty, fiyat: c.price, bekleme: c.wait || 5 }));
    const toplam  = cart.reduce((s, c) => s + c.price * c.qty, 0);
    await post("order.php", { action: "create", session_id: session.id, venue_id: session.venue_id, masa_no: session.masa_no, urunler, toplam, not: "" });
    playBeep(660, .25, 2);
    setCart([]);
    const summary = urunler.map(u => `${u.adet}× ${u.ad}`).join(", ");
    setMsgs(p => [...p, { role: "assistant", content: `✅ Siparişiniz alındı! ${summary}`, id: Date.now(), time: ts() }]);
    setTab("chat");
    setOrderLoading(false);
  };

  const callWaiter = async () => {
    await post("panel.php", { action: "notify", venue_id: session.venue_id, session_id: session.id, masa_no: session.masa_no, type: "garson" });
    playBeep(440, .3, 2); alert("✓ Garson çağrıldı!");
  };

  const cartCount = cart.reduce((s, c) => s + c.qty, 0);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "11px 14px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid var(--bord)", background: "rgba(22,14,8,.95)", flexShrink: 0 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,var(--gold) 0%,#6b3d10 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>🍽️</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "var(--fh)", fontSize: 15, color: "var(--cream)" }}>Garson AI</div>
          <div style={{ fontSize: 11, color: "var(--muted)", fontStyle: "italic" }}>{venueAd} — Masa {session.masa_no}</div>
        </div>
        {speaking && (
          <button onClick={() => { window.speechSynthesis.cancel(); setSpeaking(false); }} style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(192,64,64,.18)", border: "1px solid rgba(192,64,64,.4)", borderRadius: 20, padding: "5px 10px", cursor: "pointer", color: "#e06060", fontSize: 12 }}>
            <span style={{ width: 7, height: 7, borderRadius: 1, background: "#e06060", display: "block" }} /> Durdur
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--bord)", background: "rgba(22,14,8,.9)", flexShrink: 0 }}>
        {[{ id: "chat", label: "💬 Garson" }, { id: "menu", label: `📋 Menü${cartCount > 0 ? ` (${cartCount})` : ""}` }, { id: "hesap", label: `🧾 Hesap${tableOrders.length > 0 ? " ●" : ""}` }].map(({ id, label }) => (
          <button key={id} onClick={() => setTab(id)} style={{ flex: 1, padding: "10px 0", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--fb,inherit)", fontSize: 13, color: tab === id ? "var(--gsoft)" : "var(--muted)", borderBottom: tab === id ? "2px solid var(--gold)" : "2px solid transparent", transition: "all .2s" }}>{label}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: "hidden" }}>
        {tab === "menu" && <MenuView menu={menu} specials={specials} cart={cart} onAdd={addToCart} onRemove={removeFromCart} onOrder={submitCart} orderLoading={orderLoading} />}
        {tab === "hesap" && <HesapView session={session} tableOrders={tableOrders} venueId={session.venue_id} onCallWaiter={callWaiter} />}
        {tab === "chat" && (
          <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 13px 8px" }}>
              {msgs.map((m, i) => {
                const isUser = m.role === "user";
                const content = cleanText(m.content);
                const order = parseOrder(m.content);
                return (
                  <div key={m.id} style={{ display: "flex", flexDirection: isUser ? "row-reverse" : "row", gap: 9, alignItems: "flex-end", marginBottom: 14, animation: i === msgs.length - 1 ? "fadeUp .3s ease-out" : "none" }}>
                    {!isUser && <div style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg,var(--gold) 0%,#8b5e2a 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🍽️</div>}
                    <div style={{ maxWidth: "76%", display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start" }}>
                      <div style={{ padding: "10px 14px", background: isUser ? "linear-gradient(135deg,var(--gold) 0%,#8b5e2a 100%)" : "var(--surf2)", border: isUser ? "none" : "1px solid var(--bord)", borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px", color: isUser ? "#0b0704" : "var(--cream)", fontSize: 15, lineHeight: 1.55, fontWeight: isUser ? 600 : 300, whiteSpace: "pre-wrap" }}>{content}</div>
                      {order && (
                        <div style={{ marginTop: 8, padding: "10px 13px", background: "rgba(58,138,92,.13)", border: "1px solid rgba(58,138,92,.4)", borderRadius: 12, width: "100%", animation: "bounce .5s ease-out" }}>
                          <div style={{ color: "#3aaa6a", fontFamily: "var(--fh)", fontSize: 12, marginBottom: 6 }}>✅ Sipariş iletildi — Masa {order.masa}</div>
                          {order.urunler?.map((u, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--cream)", marginBottom: 2 }}><span>{u.adet}× {u.ad}</span><span style={{ color: "var(--gsoft)" }}>{u.adet * u.fiyat}₺</span></div>)}
                          <div style={{ borderTop: "1px solid rgba(58,138,92,.3)", marginTop: 6, paddingTop: 6, display: "flex", justifyContent: "space-between" }}>
                            <span style={{ color: "#3aaa6a", fontSize: 13 }}>Toplam</span>
                            <span style={{ fontFamily: "var(--fh)", color: "var(--gsoft)" }}>{order.toplam}₺</span>
                          </div>
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>{m.time}</div>
                    </div>
                  </div>
                );
              })}
              {loading && (
                <div style={{ display: "flex", gap: 9, alignItems: "flex-end", marginBottom: 14, animation: "fadeUp .3s ease-out" }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,var(--gold) 0%,#8b5e2a 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🍽️</div>
                  <div style={{ padding: "12px 16px", background: "var(--surf2)", border: "1px solid var(--bord)", borderRadius: "18px 18px 18px 4px" }}><Dots /></div>
                </div>
              )}
              <div ref={endRef} />
            </div>
            <div style={{ padding: "0 12px 7px", display: "flex", gap: 7, overflowX: "auto", flexShrink: 0 }}>
              {["Menüyü anlat", "Ne önerirsin?", "Sipariş vermek istiyorum", "Hesabı istiyorum"].map(s => (
                <button key={s} onClick={() => send(s)} style={{ background: "var(--surf2)", border: "1px solid var(--bord)", borderRadius: 20, padding: "5px 12px", color: "var(--muted)", cursor: "pointer", fontSize: 12, whiteSpace: "nowrap", flexShrink: 0 }}>{s}</button>
              ))}
            </div>
            <div style={{ padding: "9px 12px 16px", borderTop: "1px solid var(--bord)", background: "rgba(22,14,8,.95)", flexShrink: 0 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                <textarea ref={taRef} value={input} onChange={e => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px"; }} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }} placeholder={listening ? "Dinliyorum..." : "Yazın veya mikrofona basın..."} rows={1} disabled={loading}
                  style={{ flex: 1, resize: "none", background: "var(--surf2)", border: "1px solid var(--bord)", borderRadius: 13, padding: "11px 14px", color: "var(--cream)", fontSize: 15, outline: "none", lineHeight: 1.4, minHeight: 44 }} />
                <button onClick={toggleListen} style={{ width: 46, height: 46, borderRadius: "50%", flexShrink: 0, background: listening ? "var(--red)" : "linear-gradient(135deg,var(--gold) 0%,#8b5e2a 100%)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", animation: listening ? "pulse 1.5s ease-in-out infinite" : "none", boxShadow: listening ? "none" : "0 4px 14px rgba(201,145,58,.28)" }}>
                  {listening ? <Wave active /> : <span style={{ fontSize: 19 }}>🎤</span>}
                </button>
                {input.trim() && <button onClick={() => send(input)} style={{ width: 46, height: 46, borderRadius: "50%", flexShrink: 0, background: "var(--gold)", border: "none", cursor: "pointer", fontSize: 17, boxShadow: "0 4px 14px rgba(201,145,58,.28)" }}>➤</button>}
              </div>
              {listening && <div style={{ textAlign: "center", marginTop: 6, color: "var(--red)", fontSize: 12, fontStyle: "italic", animation: "glow 1s ease-in-out infinite" }}>🔴 Dinliyorum...</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};





/* ══════════════════════════════════════════════════════════
   IMAGE PICKER — Dosya yükleme + URL + önizleme
══════════════════════════════════════════════════════════ */
const ImagePicker = ({ value, onChange, uploading, onUpload }) => {
  const fileRef = useRef(null);

  return (
    <div style={{ marginBottom: 9 }}>
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8, letterSpacing: .5 }}>ÜRÜN GÖRSELİ</div>

      {/* Önizleme */}
      {value ? (
        <div style={{ position: "relative", marginBottom: 10 }}>
          <img
            src={value}
            alt="Önizleme"
            style={{
              width: "100%", maxHeight: 180, objectFit: "cover",
              borderRadius: 14,
              border: "2px solid var(--gold)",
              boxShadow: "0 0 0 1px rgba(201,145,58,.3), 0 4px 20px rgba(0,0,0,.4)",
              display: "block",
            }}
            onError={e => { e.target.style.display = "none"; }}
          />
          <button
            onClick={() => onChange("")}
            style={{ position:"absolute", top:8, right:8, width:28, height:28, borderRadius:"50%", background:"rgba(0,0,0,.7)", border:"1px solid rgba(255,255,255,.2)", color:"#fff", cursor:"pointer", fontSize:14, display:"flex", alignItems:"center", justifyContent:"center" }}
          >✕</button>
        </div>
      ) : (
        <div style={{ width:"100%", height:100, borderRadius:14, border:"2px dashed var(--bord)", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:10, background:"var(--surf)", color:"var(--muted)", fontSize:13 }}>
          Görsel yok
        </div>
      )}

      {/* Butonlar */}
      <div style={{ display:"flex", gap:8 }}>
        {/* Bilgisayardan yükle */}
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          style={{ flex:1, padding:"10px 8px", background:"rgba(201,145,58,.12)", border:"1px solid rgba(201,145,58,.4)", borderRadius:10, color:"var(--gsoft)", cursor:uploading?"not-allowed":"pointer", fontSize:13, display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}
        >
          {uploading ? <><Spin /> Yükleniyor...</> : "📁 Bilgisayardan"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          style={{ display:"none" }}
          onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }}
        />

        {/* URL ile */}
        <button
          onClick={() => {
            const url = window.prompt("Görsel URL'sini girin:");
            if (url?.trim()) onChange(url.trim());
          }}
          style={{ flex:1, padding:"10px 8px", background:"var(--surf2)", border:"1px solid var(--bord)", borderRadius:10, color:"var(--muted)", cursor:"pointer", fontSize:13 }}
        >
          🔗 URL ile
        </button>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════
   MENU MANAGER — Tamamen bağımsız, kendi state'i var
══════════════════════════════════════════════════════════ */
const MenuManager = ({ venueId }) => {
  const [tab, setTab]         = useState("liste");
  const [cats, setCats]       = useState([]);    // string[]
  const [items, setItems]     = useState([]);    // tüm ürünler flat
  const [loading, setLoading] = useState(true);
  const [msg, setMsg]         = useState("");

  // Kategori formu
  const [catName, setCatName]   = useState("");
  const [catBusy, setCatBusy]   = useState(false);

  // Ürün formu
  const [pCat, setPCat]   = useState("");
  const [pName, setPName] = useState("");
  const [pPrice, setPPrice] = useState("");
  const [pWait, setPWait] = useState("");
  const [pDesc, setPDesc] = useState("");
  const [pImg, setPImg]   = useState("");
  const [pImgUploading, setPImgUploading] = useState(false);
  const [editImgUploading, setEditImgUploading] = useState(false);
  const [pBusy, setPBusy] = useState(false);

  // Düzenleme
  const [editItem, setEditItem] = useState(null);

  const token = () => localStorage.getItem("sg_token") || "";

  const apicall = async (action, data = {}) => {
    const res = await fetch(`${API}/panel.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ action, ...data, _token: token() }),
    });
    return res.json();
  };

  const uploadImage = async (file, setBusy, setUrl) => {
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      fd.append("_token", localStorage.getItem("sg_token") || "");
      const res = await fetch(`${API}/upload.php`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("sg_token") || ""}` },
        body: fd,
      });
      const r = await res.json();
      if (r.ok) setUrl(r.url);
      else flash("❌ " + (r.error || "Yükleme hatası"));
    } catch(e) { flash("❌ Bağlantı hatası"); }
    setBusy(false);
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/panel.php?type=menu`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const r = await res.json();
      if (r.menu) {
        const catList = Object.keys(r.menu);
        setCats(catList);
        const flat = catList.flatMap(cat =>
          (r.menu[cat] || []).map(i => ({ ...i, cat }))
        );
        setItems(flat);
        if (!pCat && catList.length > 0) setPCat(catList[0]);
      }
    } catch(e) { setMsg("❌ Yüklenemedi: " + e.message); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(""), 3000); };

  /* ── KATEGORİ EKLE ── */
  const addCat = async () => {
    const k = catName.trim();
    if (!k) { flash("⚠️ Kategori adı girin."); return; }
    if (cats.includes(k)) { flash("⚠️ Bu kategori zaten var."); return; }
    setCatBusy(true);
    const r = await apicall("cat_add", { kategori: k });
    setCatBusy(false);
    if (r.ok || r.msg === "zaten var") {
      flash("✅ Kategori eklendi: " + k);
      setCatName("");
      setCats(prev => prev.includes(k) ? prev : [...prev, k]);
      if (!pCat) setPCat(k);
    } else {
      flash("❌ " + (r.error || "Hata"));
    }
  };

  /* ── ÜRÜN EKLE ── */
  const addItem = async () => {
    if (!pCat) { flash("⚠️ Kategori seçin."); return; }
    if (!pName.trim()) { flash("⚠️ Ürün adı girin."); return; }
    if (!pPrice || parseInt(pPrice) <= 0) { flash("⚠️ Geçerli fiyat girin."); return; }
    setPBusy(true);
    const r = await apicall("menu_add", {
      kategori: pCat,
      ad: pName.trim(),
      fiyat: parseInt(pPrice),
      sure: parseInt(pWait) || 5,
      aciklama: pDesc.trim(),
      gorsel: pImg.trim(),
    });
    setPBusy(false);
    if (r.ok) {
      flash("✅ Ürün eklendi: " + pName);
      setPName(""); setPPrice(""); setPWait(""); setPDesc(""); setPImg("");
      await load();
    } else {
      flash("❌ " + (r.error || "Hata"));
    }
  };

  /* ── ÜRÜN SİL ── */
  const delItem = async (id, name) => {
    if (!window.confirm(`"${name}" silinsin mi?`)) return;
    const r = await apicall("menu_del", { id });
    if (r.ok) { flash("🗑 Silindi"); await load(); }
    else flash("❌ " + (r.error || "Hata"));
  };

  /* ── ÜRÜN GÜNCELLE ── */
  const updateItem = async () => {
    if (!editItem) return;
    const r = await apicall("menu_update", {
      id: editItem.id,
      ad: editItem.name,
      fiyat: parseInt(editItem.price),
      sure: parseInt(editItem.wait) || 5,
      aciklama: editItem.desc || "",
      gorsel: editItem.img || "",
      aktif: editItem.aktif,
    });
    if (r.ok) { flash("✅ Güncellendi"); setEditItem(null); await load(); }
    else flash("❌ " + (r.error || "Hata"));
  };

  /* ── SATIŞ DURDUR / AKTİF ET ── */
  const toggleItem = async (item) => {
    const r = await apicall("menu_toggle", { id: item.id, aktif: item.aktif ? 0 : 1 });
    if (r.ok) { flash(item.aktif ? "⏸ Satış durduruldu" : "▶ Satışa açıldı"); await load(); }
    else flash("❌ " + (r.error || "Hata"));
  };

  const inp = (ph, val, set, type = "text") => (
    <input type={type} value={val} onChange={e => set(e.target.value)} placeholder={ph}
      style={{ width:"100%", background:"var(--bg)", border:"1px solid var(--bord)", borderRadius:9, padding:"11px 13px", color:"var(--cream)", fontSize:14, outline:"none", marginBottom:9 }}
    />
  );

  const subBtn = (id, label) => (
    <button key={id} onClick={() => setTab(id)} style={{ flex:1, padding:"9px 4px", background:tab===id?"var(--surf)":"transparent", border:"none", borderRadius:10, cursor:"pointer", fontSize:12, color:tab===id?"var(--gsoft)":"var(--muted)", fontWeight:tab===id?600:400 }}>{label}</button>
  );

  if (loading) return <div style={{textAlign:"center",color:"var(--muted)",marginTop:40}}><Spin /></div>;

  return (
    <div>
      {/* Mesaj */}
      {msg && (
        <div style={{ padding:"10px 14px", background: msg.startsWith("✅")||msg.startsWith("▶")||msg.startsWith("🗑") ? "rgba(58,138,92,.15)" : "rgba(192,64,64,.15)", border:`1px solid ${msg.startsWith("✅")||msg.startsWith("▶")||msg.startsWith("🗑") ? "rgba(58,138,92,.4)" : "rgba(192,64,64,.4)"}`, borderRadius:10, fontSize:13, color: msg.startsWith("✅")||msg.startsWith("▶")||msg.startsWith("🗑") ? "#3aaa6a" : "#e06060", marginBottom:14, animation:"fadeIn .2s" }}>
          {msg}
        </div>
      )}

      {/* Alt sekmeler */}
      <div style={{ display:"flex", background:"var(--surf2)", borderRadius:12, padding:3, marginBottom:16 }}>
        {subBtn("liste","📋 Ürünler")}
        {subBtn("cat","🗂 Kategori")}
        {subBtn("urun","➕ Ürün Ekle")}
      </div>

      {/* ── ÜRÜN LİSTESİ ── */}
      {tab === "liste" && (
        items.length === 0
          ? <div style={{textAlign:"center",color:"var(--muted)",marginTop:40,fontStyle:"italic"}}>Henüz ürün yok. Önce kategori, sonra ürün ekleyin.</div>
          : cats.map(cat => {
              const catItems = items.filter(i => i.cat === cat);
              if (!catItems.length) return (
                <div key={cat} style={{marginBottom:14}}>
                  <div style={{fontFamily:"var(--fh)",fontSize:13,color:"var(--gsoft)",padding:"7px 12px",background:"var(--surf2)",borderRadius:8,marginBottom:4}}>{cat} <span style={{color:"var(--muted)",fontSize:11}}>(boş)</span></div>
                </div>
              );
              return (
                <div key={cat} style={{marginBottom:18}}>
                  <div style={{fontFamily:"var(--fh)",fontSize:13,color:"var(--gsoft)",padding:"7px 12px",background:"var(--surf2)",borderRadius:8,marginBottom:6}}>
                    {cat} <span style={{color:"var(--muted)",fontSize:11}}>({catItems.length} ürün)</span>
                  </div>
                  {catItems.map(item => (
                    <div key={item.id} style={{ padding:"10px 12px", marginBottom:6, background:"var(--surf2)", border:`1px solid ${item.aktif===0||item.aktif==="0"?"rgba(192,64,64,.3)":"var(--bord)"}`, borderRadius:11, opacity:item.aktif===0||item.aktif==="0"?0.6:1 }}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                        <div style={{flex:1,display:"flex",gap:10,alignItems:"flex-start"}}>
                          {item.img && (
                            <img src={item.img} alt={item.name}
                              style={{ width:52, height:52, objectFit:"cover", borderRadius:10, border:"2px solid var(--gold)", flexShrink:0, boxShadow:"0 0 0 1px rgba(201,145,58,.2)" }}
                              onError={e=>e.target.style.display="none"}
                            />
                          )}
                          <div>
                            <div style={{fontSize:14,color:"var(--cream)",fontWeight:500}}>{item.name}</div>
                            <div style={{fontSize:12,color:"var(--muted)",marginTop:2}}>{item.price}₺ · ~{item.wait}dk{item.desc ? " · "+item.desc : ""}</div>
                            {(item.aktif===0||item.aktif==="0") && <div style={{fontSize:11,color:"#e06060",marginTop:2}}>⏸ Satış durduruldu</div>}
                          </div>
                        </div>
                        <div style={{display:"flex",gap:5,marginLeft:8}}>
                          <button onClick={()=>toggleItem(item)} title={item.aktif?"Durdur":"Aktif Et"} style={{width:28,height:28,borderRadius:7,background:item.aktif?"rgba(201,145,58,.15)":"rgba(58,138,92,.15)",border:`1px solid ${item.aktif?"rgba(201,145,58,.4)":"rgba(58,138,92,.4)"}`,color:item.aktif?"var(--gsoft)":"#3aaa6a",cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center"}}>{item.aktif?"⏸":"▶"}</button>
                          <button onClick={()=>setEditItem({...item})} title="Düzenle" style={{width:28,height:28,borderRadius:7,background:"rgba(58,106,154,.15)",border:"1px solid rgba(58,106,154,.4)",color:"#6aaae0",cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center"}}>✎</button>
                          <button onClick={()=>delItem(item.id, item.name)} title="Sil" style={{width:28,height:28,borderRadius:7,background:"rgba(192,64,64,.15)",border:"1px solid rgba(192,64,64,.3)",color:"#e06060",cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })
      )}

      {/* ── KATEGORİ ── */}
      {tab === "cat" && (
        <div>
          <div style={{marginBottom:16}}>
            <div style={{fontFamily:"var(--fh)",fontSize:13,color:"var(--gsoft)",marginBottom:10}}>Mevcut Kategoriler</div>
            {cats.length === 0
              ? <div style={{color:"var(--muted)",fontSize:13,fontStyle:"italic",marginBottom:14}}>Henüz kategori yok</div>
              : cats.map(cat => (
                <div key={cat} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 14px",marginBottom:8,background:"var(--surf2)",border:"1px solid var(--bord)",borderRadius:12}}>
                  <span style={{fontFamily:"var(--fh)",fontSize:15,color:"var(--cream)"}}>{cat}</span>
                  <span style={{fontSize:12,color:"var(--muted)"}}>{items.filter(i=>i.cat===cat).length} ürün</span>
                </div>
              ))
            }
          </div>
          <div style={{padding:"16px",background:"var(--surf2)",border:"1px solid var(--gdim)",borderRadius:14}}>
            <div style={{fontFamily:"var(--fh)",fontSize:13,color:"var(--muted)",marginBottom:12}}>Yeni Kategori</div>
            <input
              type="text" value={catName} onChange={e=>setCatName(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&addCat()}
              placeholder="Örn: ☕ Kahveler"
              style={{width:"100%",background:"var(--bg)",border:"1px solid var(--bord)",borderRadius:9,padding:"13px 15px",color:"var(--cream)",fontSize:15,outline:"none",marginBottom:12}}
            />
            <button onClick={addCat} disabled={catBusy} style={{width:"100%",padding:"13px",background:catBusy?"var(--surf)":"linear-gradient(135deg,var(--gold) 0%,#8b5e2a 100%)",border:"none",borderRadius:10,color:catBusy?"var(--muted)":"#0b0704",cursor:catBusy?"not-allowed":"pointer",fontFamily:"var(--fh)",fontSize:15,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
              {catBusy ? <><Spin /> Ekleniyor...</> : "+ Kategori Oluştur"}
            </button>
          </div>
        </div>
      )}

      {/* ── ÜRÜN EKLE ── */}
      {tab === "urun" && (
        <div style={{padding:"16px",background:"var(--surf2)",border:"1px solid var(--gdim)",borderRadius:14}}>
          <div style={{fontFamily:"var(--fh)",fontSize:13,color:"var(--muted)",marginBottom:12}}>Yeni Ürün</div>
          {cats.length === 0
            ? <div style={{color:"#e06060",fontSize:13,marginBottom:14}}>⚠️ Önce kategori ekleyin.</div>
            : <>
              <select value={pCat} onChange={e=>setPCat(e.target.value)} style={{width:"100%",background:"var(--bg)",border:"1px solid var(--bord)",borderRadius:9,padding:"11px 13px",color:"var(--cream)",fontSize:14,outline:"none",marginBottom:9}}>
                {cats.map(cat=><option key={cat} value={cat}>{cat}</option>)}
              </select>
              {inp("Ürün adı *", pName, setPName)}
              {inp("Fiyat (₺) *", pPrice, setPPrice, "number")}
              {inp("Hazırlanma süresi (dk)", pWait, setPWait, "number")}
              {inp("Açıklama", pDesc, setPDesc)}
              <ImagePicker
                value={pImg}
                onChange={setPImg}
                uploading={pImgUploading}
                onUpload={file => uploadImage(file, setPImgUploading, setPImg)}
              />
              <button onClick={addItem} disabled={pBusy} style={{width:"100%",padding:"13px",background:pBusy?"var(--surf)":"linear-gradient(135deg,var(--gold) 0%,#8b5e2a 100%)",border:"none",borderRadius:10,color:pBusy?"var(--muted)":"#0b0704",cursor:pBusy?"not-allowed":"pointer",fontFamily:"var(--fh)",fontSize:15,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginTop:4}}>
                {pBusy ? <><Spin /> Kaydediliyor...</> : "+ Ürünü Kaydet"}
              </button>
            </>
          }
        </div>
      )}

      {/* ── DÜZENLE MODAL ── */}
      {editItem && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.9)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:400,backdropFilter:"blur(4px)"}}>
          <div style={{width:"100%",maxWidth:525,background:"var(--surf)",borderRadius:"22px 22px 0 0",padding:"20px 18px 36px",animation:"fadeUp .3s ease-out"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div style={{fontFamily:"var(--fh)",fontSize:17,color:"var(--cream)"}}>✎ Ürünü Düzenle</div>
              <button onClick={()=>setEditItem(null)} style={{background:"none",border:"none",color:"var(--muted)",cursor:"pointer",fontSize:22}}>✕</button>
            </div>
            {[["Ürün adı",editItem.name,v=>setEditItem({...editItem,name:v})],
              ["Fiyat (₺)",editItem.price,v=>setEditItem({...editItem,price:v}),"number"],
              ["Süre (dk)",editItem.wait,v=>setEditItem({...editItem,wait:v}),"number"],
              ["Açıklama",editItem.desc||"",v=>setEditItem({...editItem,desc:v})],
            ].map(([ph,val,fn,tp="text"],i)=>(
              <input key={i} type={tp} value={val||""} placeholder={ph} onChange={e=>fn(e.target.value)}
                style={{width:"100%",background:"var(--surf2)",border:"1px solid var(--bord)",borderRadius:9,padding:"11px 13px",color:"var(--cream)",fontSize:14,outline:"none",marginBottom:9}} />
            ))}
            <ImagePicker
              value={editItem.img||""}
              onChange={v=>setEditItem({...editItem,img:v})}
              uploading={editImgUploading}
              onUpload={file=>uploadImage(file,setEditImgUploading,v=>setEditItem({...editItem,img:v}))}
            />
            <div style={{display:"flex",gap:9}}>
              <button onClick={()=>setEditItem(null)} style={{flex:1,padding:"12px",background:"var(--surf2)",border:"1px solid var(--bord)",borderRadius:10,color:"var(--muted)",cursor:"pointer",fontSize:14}}>İptal</button>
              <button onClick={updateItem} style={{flex:2,padding:"12px",background:"linear-gradient(135deg,var(--gold) 0%,#8b5e2a 100%)",border:"none",borderRadius:10,color:"#0b0704",cursor:"pointer",fontFamily:"var(--fh)",fontSize:15,fontWeight:600}}>Kaydet ✓</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════════════════
   CHANGE PASSWORD SCREEN (ilk giriş)
══════════════════════════════════════════════════════════ */
const ChangePassword = ({ staff, onDone }) => {
  const [pass1, setPass1] = useState("");
  const [pass2, setPass2] = useState("");
  const [err, setErr]     = useState("");
  const [loading, setLoading] = useState(false);

  const save = async () => {
    if (pass1.length < 6) return setErr("Şifre en az 6 karakter olmalı.");
    if (pass1 !== pass2)  return setErr("Şifreler eşleşmiyor.");
    setLoading(true); setErr("");
    const r = await post("panel.php", { action: "change_pass", yeni_sifre: pass1 });
    if (r.error) { setErr(r.error); setLoading(false); return; }
    // Update stored staff
    const updated = { ...staff, gecici: false };
    localStorage.setItem("sg_staff", JSON.stringify(updated));
    onDone(updated);
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: 28 }}>
      <div style={{ position: "fixed", inset: 0, background: "radial-gradient(ellipse 70% 50% at 50% 30%, rgba(201,145,58,.06) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ width: 64, height: 64, borderRadius: "50%", background: "linear-gradient(135deg,var(--gold) 0%,#6b3d10 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, marginBottom: 18, boxShadow: "0 0 32px rgba(201,145,58,.3)", position: "relative", zIndex: 1 }}>🔑</div>
      <div style={{ fontFamily: "var(--fh)", fontSize: 22, color: "var(--cream)", marginBottom: 6, position: "relative", zIndex: 1 }}>Şifrenizi Belirleyin</div>
      <div style={{ fontSize: 13, color: "var(--muted)", fontStyle: "italic", marginBottom: 28, textAlign: "center", position: "relative", zIndex: 1 }}>
        Hoş geldiniz, <strong style={{ color: "var(--gsoft)" }}>{staff.ad}</strong>!<br />
        Güvenliğiniz için lütfen yeni bir şifre belirleyin.
      </div>
      <div style={{ width: "100%", maxWidth: 340, position: "relative", zIndex: 1 }}>
        <Inp label="YENİ ŞİFRE" value={pass1} onChange={setPass1} type="password" placeholder="En az 6 karakter" />
        <Inp label="ŞİFRE TEKRAR" value={pass2} onChange={setPass2} type="password" placeholder="Aynı şifreyi tekrar girin" />
        {err && <div style={{ padding: "10px 14px", background: "rgba(192,64,64,.15)", border: "1px solid rgba(192,64,64,.35)", borderRadius: 10, fontSize: 13, color: "#e06060", marginBottom: 14 }}>⚠️ {err}</div>}
        <button onClick={save} disabled={loading} style={{ width: "100%", padding: "14px", background: loading ? "var(--surf2)" : "linear-gradient(135deg,var(--gold) 0%,#8b5e2a 100%)", border: "none", borderRadius: 12, color: loading ? "var(--muted)" : "#0b0704", cursor: loading ? "not-allowed" : "pointer", fontFamily: "var(--fh)", fontSize: 17, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          {loading ? <Spin /> : "Şifremi Kaydet →"}
        </button>
      </div>
    </div>
  );
};


/* ══════════════════════════════════════════════════════════
   INLINE CHANGE PASSWORD (yönetim > özet)
══════════════════════════════════════════════════════════ */
const ChangePassInline = () => {
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [msg, setMsg] = useState("");
  const save = async () => {
    if (p1.length < 6) return setMsg("En az 6 karakter.");
    if (p1 !== p2)     return setMsg("Şifreler eşleşmiyor.");
    const r = await post("panel.php", { action: "change_pass", yeni_sifre: p1 });
    if (r.ok) { setMsg("✅ Şifre güncellendi."); setP1(""); setP2(""); }
    else setMsg("❌ Hata oluştu.");
  };
  return (
    <div>
      <input type="password" value={p1} onChange={e=>setP1(e.target.value)} placeholder="Yeni şifre" style={{width:"100%",background:"var(--bg)",border:"1px solid var(--bord)",borderRadius:9,padding:"10px 13px",color:"var(--cream)",fontSize:14,outline:"none",marginBottom:7}}/>
      <input type="password" value={p2} onChange={e=>setP2(e.target.value)} placeholder="Tekrar" style={{width:"100%",background:"var(--bg)",border:"1px solid var(--bord)",borderRadius:9,padding:"10px 13px",color:"var(--cream)",fontSize:14,outline:"none",marginBottom:7}}/>
      {msg && <div style={{fontSize:13,color:msg.startsWith("✅")?"#3aaa6a":"#e06060",marginBottom:7}}>{msg}</div>}
      <button onClick={save} style={{width:"100%",padding:"9px",background:"var(--surf)",border:"1px solid var(--bord)",borderRadius:9,color:"var(--cream)",cursor:"pointer",fontFamily:"var(--fb,inherit)",fontSize:13}}>Şifreyi Güncelle</button>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════
   STAFF PANEL
══════════════════════════════════════════════════════════ */
const StaffPanel = ({ staff, onLogout }) => {
  const isAdmin   = staff.rol === "superadmin";
  const isOwner   = staff.rol === "isletmeci";
  const vid       = staff.venue_id;

  const [tab, setTab]           = useState("bekleyen");
  const [sessions, setSessions] = useState([]);
  const [orders, setOrders]     = useState([]);
  const [notifs, setNotifs]     = useState([]);
  const [tables, setTables]     = useState([]);
  const [menu, setMenu]         = useState({});
  const [specials, setSpecials] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [qrModal, setQrModal]   = useState(null);
  const [garsonOrder, setGarsonOrder] = useState(null);
  const [garsonCart, setGarsonCart]   = useState([]);
  const [garsonLoading, setGarsonLoading] = useState(false);
  const [masaPopup, setMasaPopup] = useState(null); // popup için seçili masa/oturum
  const [newMasa, setNewMasa] = useState(""); // masa ekleme input
  const [yTab, setYTab]       = useState("ozet"); // yönetim alt sekme
  const [newMasa, setNewMasa]   = useState("");
  const [newItem, setNewItem]   = useState({ cat: "", name: "", price: "", desc: "", wait: "" });
  const [newSpec, setNewSpec]   = useState({ name: "", price: "", desc: "" });

  // Süper admin state
  const [venues, setVenues]     = useState([]);
  const [newVenue, setNewVenue] = useState({ venue_ad: "", ad: "", tel: "", email: "", gecici_sifre: "" });
  const [vMsg, setVMsg]         = useState("");

  const [now, setNow]           = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(i); }, []);

  const elapsed = ca => {
    if (!ca) return "";
    const d = Math.floor((now - new Date(ca).getTime()) / 60000);
    return d < 60 ? `${d}dk` : `${Math.floor(d / 60)}sa ${d % 60}dk`;
  };

  const fetchAll = useCallback(async () => {
    try {
      if (isAdmin) {
        const r = await get("panel.php?type=venues"); if (r.venues) setVenues(r.venues);
        setLoading(false); return;
      }
      const [p, m, t] = await Promise.all([get("panel.php?type=all"), get("panel.php?type=menu"), get("panel.php?type=tables")]);
      if (p.sessions) setSessions(p.sessions);
      if (p.orders) setOrders(p.orders.map(o => ({ ...o, urunler: typeof o.urunler === "string" ? (JSON.parse(o.urunler) || []) : (o.urunler || []) })));
      if (p.notifications) setNotifs(p.notifications);
      if (m.menu !== undefined) { setMenu(m.menu); }
      if (m.specials !== undefined) setSpecials(m.specials || []);
      if (t.tables) setTables(t.tables);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [isAdmin]);

  useEffect(() => { fetchAll(); const i = setInterval(fetchAll, 3000); return () => clearInterval(i); }, [fetchAll]);

  // Ses bildirimi
  const prev = useRef({ pending: 0, newOrds: 0, notifs: 0 });
  useEffect(() => {
    if (loading) return;
    const pending = sessions.filter(s => s.durum === "bekliyor").length;
    const newOrds = orders.filter(o => o.status === "yeni").length;
    const newNots = notifs.filter(n => !n.acked).length;
    if (pending > prev.current.pending) playBeep(660, .3, 2);
    if (newOrds > prev.current.newOrds) { playBeep(880, .35, 3); if (navigator.vibrate) navigator.vibrate([200, 100, 200]); }
    if (newNots > prev.current.notifs) playBeep(550, .4, 2);
    prev.current = { pending, newOrds, newNots };
  }, [sessions, orders, notifs, loading]);

  const sAct = async (id, durum, vid_) => { await post("session.php", { action: "update", id, durum, venue_id: vid_ || vid }); fetchAll(); };
  const sClose = async (id, vid_) => { await post("session.php", { action: "close", id, venue_id: vid_ || vid }); fetchAll(); };
  const oAct  = async (id, status) => { await post("order.php", { action: "status", id, status }); fetchAll(); };
  const ack   = async id => { await post("panel.php", { action: "ack", id }); fetchAll(); };

  const garsonSubmit = async () => {
    if (!garsonCart.length || !garsonOrder || garsonLoading) return;
    setGarsonLoading(true);
    const urunler = garsonCart.map(c => ({ ad: c.name, adet: c.qty, fiyat: c.price, bekleme: c.wait || 5 }));
    const toplam = garsonCart.reduce((s, c) => s + c.price * c.qty, 0);
    await post("order.php", { action: "create", session_id: garsonOrder.id, venue_id: vid, masa_no: garsonOrder.masa_no, urunler, toplam, not: "[Garson]" });
    setGarsonCart([]); setGarsonOrder(null); playBeep(660, .25, 2); fetchAll();
    setGarsonLoading(false);
  };

  const pending   = sessions.filter(s => s.durum === "bekliyor");
  const active    = sessions.filter(s => s.durum === "aktif");
  const newOrdsN  = orders.filter(o => o.status === "yeni").length;
  const unread    = notifs.filter(n => !n.acked).length;
  const newTotal  = pending.length + newOrdsN + unread;

  // Günlük özet
  const today      = new Date().toISOString().slice(0, 10);
  const todayOrds  = orders.filter(o => o.created_at?.startsWith(today));
  const ciro       = todayOrds.reduce((s, o) => s + (o.toplam || 0), 0);
  const urunSayim  = {};
  todayOrds.forEach(o => (o.urunler || []).forEach(u => { urunSayim[u.ad] = (urunSayim[u.ad] || 0) + u.adet; }));
  const topItems   = Object.entries(urunSayim).sort((a, b) => b[1] - a[1]).slice(0, 3);

  const AB = (label, onClick, col) => (
    <button onClick={onClick} style={{ background: `rgba(${col},.15)`, border: `1px solid rgba(${col},.4)`, borderRadius: 9, padding: "6px 13px", cursor: "pointer", fontSize: 12.5, color: `rgb(${col})`, whiteSpace: "nowrap" }}>{label}</button>
  );
  const card = (ex = {}) => ({ padding: "13px 15px", background: "var(--surf2)", border: "1px solid var(--bord)", borderRadius: 14, marginBottom: 11, ...ex });

  const TabBtn = ({ id, label, badge }) => (
    <button onClick={() => setTab(id)} style={{ flex: 1, padding: "10px 4px", background: "none", border: "none", cursor: "pointer", fontSize: 11.5, color: tab === id ? "var(--gsoft)" : "var(--muted)", borderBottom: tab === id ? "2px solid var(--gold)" : "2px solid transparent", position: "relative", whiteSpace: "nowrap" }}>
      {label}
      {badge > 0 && <span style={{ position: "absolute", top: 5, right: "8%", minWidth: 16, height: 16, borderRadius: 8, background: "var(--red)", color: "#fff", fontSize: 9, display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700, padding: "0 3px" }}>{badge}</span>}
    </button>
  );

  /* ── SÜPER ADMİN PANELİ ── */
  if (isAdmin) return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)" }}>
      <div style={{ padding: "13px 16px", borderBottom: "1px solid var(--bord)", display: "flex", alignItems: "center", gap: 11, background: "var(--surf)", flexShrink: 0 }}>
        <div style={{ fontFamily: "var(--fh)", fontSize: 17, color: "var(--cream)" }}>🔴 Süper Admin</div>
        <button onClick={onLogout} style={{ marginLeft: "auto", background: "none", border: "1px solid var(--bord)", borderRadius: 9, padding: "6px 13px", color: "var(--muted)", cursor: "pointer", fontSize: 13 }}>Çıkış</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
        <div style={{ fontFamily: "var(--fh)", fontSize: 13, color: "var(--gsoft)", marginBottom: 12 }}>Mekanlar ({venues.length})</div>
        {venues.map(v => (
          <div key={v.id} style={{ ...card() }}>
            <div style={{ fontFamily: "var(--fh)", fontSize: 16, color: "var(--cream)" }}>{v.ad}</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>Personel: {v.staff_count} · {v.aktif ? "Aktif" : "Pasif"}</div>
          </div>
        ))}
        <div style={{ height: 1, background: "var(--bord)", margin: "16px 0" }} />
        <div style={{ fontFamily: "var(--fh)", fontSize: 13, color: "var(--gsoft)", marginBottom: 12 }}>Yeni Mekan Ekle</div>
        <div style={{ ...card({ border: "1px solid var(--gdim)" }) }}>
          {[["İşletme Adı", newVenue.venue_ad, v => setNewVenue({ ...newVenue, venue_ad: v })],
            ["Yetkili Adı Soyadı", newVenue.ad, v => setNewVenue({ ...newVenue, ad: v })],
            ["Telefon", newVenue.tel, v => setNewVenue({ ...newVenue, tel: v }), "tel"],
            ["E-posta (opsiyonel)", newVenue.email, v => setNewVenue({ ...newVenue, email: v }), "email"],
            ["Geçici Şifre", newVenue.gecici_sifre, v => setNewVenue({ ...newVenue, gecici_sifre: v }), "password"]
          ].map(([ph, val, fn, tp = "text"], i) => (
            <input key={i} type={tp} value={val} placeholder={ph} onChange={e => fn(e.target.value)} style={{ width: "100%", background: "var(--surf)", border: "1px solid var(--bord)", borderRadius: 9, padding: "10px 13px", color: "var(--cream)", fontSize: 14, outline: "none", marginBottom: 8 }} />
          ))}
          {vMsg && <div style={{ fontSize: 13, color: "#3aaa6a", marginBottom: 8 }}>{vMsg}</div>}
          <button onClick={async () => {
            if (!newVenue.venue_ad || !newVenue.ad || !newVenue.tel || !newVenue.gecici_sifre) return;
            const r = await post("panel.php", { action: "venue_add", ...newVenue });
            if (r.ok) { setVMsg(`✅ ${r.venue_ad} oluşturuldu! İşletme linki: ${window.location.origin} — Tel: ${newVenue.tel} / Şifre: ${newVenue.gecici_sifre}`);  setNewVenue({ venue_ad: "", ad: "", tel: "", email: "", gecici_sifre: "" }); fetchAll(); }
            else setVMsg("❌ Hata: " + (r.error || "bilinmeyen"));
          }} style={{ width: "100%", padding: "11px", background: "linear-gradient(135deg,var(--gold) 0%,#8b5e2a 100%)", border: "none", borderRadius: 10, color: "#0b0704", cursor: "pointer", fontFamily: "var(--fh)", fontSize: 14, fontWeight: 600 }}>Mekan Oluştur</button>
        </div>
      </div>
    </div>
  );

  /* ── GARSON / İŞLETMECİ PANELİ ── */
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)" }}>
      {/* Header */}
      <div style={{ padding: "12px 15px", borderBottom: "1px solid var(--bord)", display: "flex", alignItems: "center", gap: 10, background: "var(--surf)", flexShrink: 0 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "var(--fh)", fontSize: 16, color: "var(--cream)" }}>{isOwner ? "👔" : "👨‍🍳"} {staff.ad}</div>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>{staff.venue_ad} · {isOwner ? "İşletmeci" : "Garson"}</div>
        </div>
        {newTotal > 0 && <div style={{ background: "var(--red)", color: "#fff", borderRadius: 20, padding: "3px 12px", fontSize: 12, fontWeight: 600, animation: "blink 1.4s ease-in-out infinite" }}>{newTotal}</div>}
        <button onClick={onLogout} style={{ background: "none", border: "1px solid var(--bord)", borderRadius: 9, padding: "6px 11px", color: "var(--muted)", cursor: "pointer", fontSize: 12 }}>Çıkış</button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--bord)", background: "rgba(22,14,8,.95)", flexShrink: 0 }}>
        <TabBtn id="bekleyen"  label="⏳ Bekleyen"  badge={pending.length} />
        <TabBtn id="masalar"   label="🪑 Masalar"   badge={newOrdsN} />
        <TabBtn id="bildirim"  label="🔔 Bildirim"  badge={unread} />
        {isOwner && <TabBtn id="yonetim" label="⚙️ Yönetim" badge={0} />}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
        {loading && <div style={{ textAlign: "center", color: "var(--muted)", marginTop: 60 }}>Yükleniyor...</div>}

        {/* ── BEKLEYEN ── */}
        {!loading && tab === "bekleyen" && (
          pending.length === 0
            ? <div style={{ textAlign: "center", color: "var(--muted)", marginTop: 60 }}><div style={{ fontSize: 36 }}>✅</div><div style={{ marginTop: 12, fontSize: 14, fontStyle: "italic" }}>Bekleyen kayıt yok</div></div>
            : pending.map(s => (
              <div key={s.id} style={{ ...card({ border: "1px solid rgba(58,106,154,.45)", animation: "bounce .4s ease-out" }) }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ fontFamily: "var(--fh)", fontSize: 24, color: "var(--gsoft)" }}>Masa {s.masa_no}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>🕐 {s.created_at?.slice(11, 16)}</div>
                </div>
                <div style={{ display: "flex", gap: 9 }}>
                  {AB("✓ Onayla", () => sAct(s.id, "aktif"), "58,138,92")}
                  {AB("✕ Reddet", () => sClose(s.id), "192,64,64")}
                </div>
              </div>
            ))
        )}

        {/* ── MASALAR ── */}
        {!loading && tab === "masalar" && (
          <>
            {/* Masa ekleme — üstte kompakt */}
            {isOwner && (
              <div style={{display:"flex",gap:8,marginBottom:14}}>
                <input type="text" value={newMasa} onChange={e=>setNewMasa(e.target.value)}
                  placeholder="Masa ekle: 5 veya 1-50"
                  onKeyDown={e=>{ if(e.key==="Enter") e.currentTarget.nextSibling.click(); }}
                  style={{flex:1,background:"var(--surf2)",border:"1px solid var(--bord)",borderRadius:10,padding:"9px 13px",color:"var(--cream)",fontSize:13,outline:"none"}}
                />
                <button onClick={async()=>{
                  if(!newMasa.trim()) return;
                  const val = newMasa.trim();
                  let nums = [];
                  if(val.includes("-")){
                    const [a,b] = val.split("-").map(s=>parseInt(s.trim()));
                    if(a>0&&b>=a&&b-a<500) for(let i=a;i<=b;i++) nums.push(i);
                  } else { const n=parseInt(val); if(n>0) nums.push(n); }
                  const mevcutlar = new Set(tables.map(t=>parseInt(t.masa_no)));
                  const eklenecek = nums.filter(n=>!mevcutlar.has(n));
                  for(const n of eklenecek) await post("panel.php",{action:"table_add",masa_no:n});
                  setNewMasa(""); fetchAll();
                }} style={{padding:"9px 16px",background:"linear-gradient(135deg,var(--gold) 0%,#8b5e2a 100%)",border:"none",borderRadius:10,color:"#0b0704",cursor:"pointer",fontFamily:"var(--fh)",fontSize:13,fontWeight:600,whiteSpace:"nowrap"}}>+ Ekle</button>
              </div>
            )}

            {/* Masa grid — aktif + boş masalar */}
            {tables.length === 0 && active.length === 0 && (
              <div style={{textAlign:"center",color:"var(--muted)",marginTop:60}}>
                <div style={{fontSize:36}}>🪑</div>
                <div style={{marginTop:12,fontSize:14,fontStyle:"italic"}}>Henüz masa eklenmedi</div>
              </div>
            )}

            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:16}}>
              {tables.sort((a,b)=>a.masa_no-b.masa_no).map(t=>{
                const ses   = active.find(s=>parseInt(s.masa_no)===parseInt(t.masa_no));
                const sOrds = ses ? orders.filter(o=>String(o.session_id)===String(ses.id)) : [];
                const total = sOrds.reduce((a,o)=>a+(o.toplam||0),0);
                const hasNew= sOrds.some(o=>o.status==="yeni");
                const dolu  = !!ses;
                const url   = `${import.meta.env.VITE_APP_URL||window.location.origin}?qr=${t.qr_token}`;
                return (
                  <div key={t.id}
                    onClick={()=>setMasaPopup({table:t, session:ses, orders:sOrds, total, url})}
                    style={{
                      background: dolu ? "var(--surf2)" : "var(--surf)",
                      border:`1px solid ${hasNew?"rgba(192,64,64,.6)":dolu?"rgba(58,138,92,.4)":"var(--bord)"}`,
                      borderRadius:12, padding:"10px 8px", textAlign:"center", cursor:"pointer",
                      animation: hasNew?"blink 2s ease-in-out infinite":"none",
                      transition:"transform .15s, box-shadow .15s",
                      position:"relative",
                    }}
                    onMouseEnter={e=>{e.currentTarget.style.transform="scale(1.03)";e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,.3)";}}
                    onMouseLeave={e=>{e.currentTarget.style.transform="scale(1)";e.currentTarget.style.boxShadow="none";}}
                  >
                    <div style={{fontFamily:"var(--fh)",fontSize:17,color:"var(--cream)",marginBottom:3}}>{t.masa_no}</div>
                    {dolu ? (
                      <>
                        <div style={{fontSize:10,color:"#3aaa6a",marginBottom:3}}>● Dolu</div>
                        {isOwner && total>0 && <div style={{fontFamily:"var(--fh)",fontSize:12,color:"var(--gsoft)"}}>{total}₺</div>}
                        {sOrds.length>0 && <div style={{fontSize:10,color:"var(--muted)",marginTop:2}}>{sOrds.length} sipariş</div>}
                      </>
                    ) : (
                      <div style={{fontSize:10,color:"var(--muted)"}}>Boş</div>
                    )}
                    {/* Küçük sil butonu — sağ üst köşe */}
                    {isOwner && (
                      <button
                        onClick={e=>{e.stopPropagation(); if(window.confirm(`Masa ${t.masa_no} silinsin mi?`)) post("panel.php",{action:"table_del",id:t.id}).then(fetchAll);}}
                        title="Masayı Sil"
                        style={{position:"absolute",top:4,right:4,width:16,height:16,borderRadius:4,background:"rgba(192,64,64,.2)",border:"none",color:"rgba(224,96,96,.6)",cursor:"pointer",fontSize:9,display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1}}
                      >✕</button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Eşleşmeyen siparişler */}
            {(() => {
              const shown = new Set(tables.flatMap(t=>{
                const ses = active.find(s=>parseInt(s.masa_no)===parseInt(t.masa_no));
                return ses ? orders.filter(o=>String(o.session_id)===String(ses.id)).map(o=>o.id) : [];
              }));
              const orphans = orders.filter(o=>!shown.has(o.id)&&o.status!=="hazır");
              if(!orphans.length) return null;
              return <>
                <div style={{fontFamily:"var(--fh)",fontSize:11,color:"var(--muted)",marginBottom:8,letterSpacing:1}}>DİĞER SİPARİŞLER</div>
                {orphans.map(o=>(
                  <div key={o.id} style={{...card({border:`1px solid ${o.status==="yeni"?"rgba(192,64,64,.45)":"rgba(201,145,58,.38)"}`})}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                      <span style={{fontFamily:"var(--fh)",fontSize:13,color:"var(--cream)"}}>Masa {o.masa_no}</span>
                      <span style={{fontSize:10,padding:"2px 8px",borderRadius:20,background:o.status==="yeni"?"rgba(192,64,64,.2)":"rgba(201,145,58,.2)",color:o.status==="yeni"?"#e06060":"var(--gsoft)"}}>{o.status}</span>
                    </div>
                    {(o.urunler||[]).map((u,i)=><div key={i} style={{fontSize:12,color:"var(--cream)"}}>{u.adet}× {u.ad}</div>)}
                    <div style={{display:"flex",justifyContent:"flex-end",gap:6,marginTop:7}}>
                      {o.status==="yeni"         && AB("🔥",()=>oAct(o.id,"hazırlanıyor"),"201,145,58")}
                      {o.status==="hazırlanıyor" && AB("✅",()=>oAct(o.id,"hazır"),"58,138,92")}
                    </div>
                  </div>
                ))}
              </>;
            })()}
          </>
        )}

        {/* ── BİLDİRİMLER ── */}
        {!loading && tab === "bildirim" && (
          notifs.length === 0
            ? <div style={{ textAlign: "center", color: "var(--muted)", marginTop: 60 }}><div style={{ fontSize: 36 }}>🔕</div><div style={{ marginTop: 12, fontSize: 14, fontStyle: "italic" }}>Bildirim yok</div></div>
            : [...notifs].reverse().map(n => (
              <div key={n.id} style={{ ...card({ background: n.type === "garson" ? "rgba(58,106,154,.1)" : n.type === "bekliyor" ? "rgba(58,106,154,.08)" : "rgba(201,145,58,.08)", border: `1px solid ${n.type === "garson" || n.type === "bekliyor" ? "rgba(58,106,154,.4)" : "rgba(201,145,58,.35)"}`, animation: !n.acked ? "blink 1.5s ease-in-out infinite" : "none" }) }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontFamily: "var(--fh)", fontSize: 15, color: n.type === "hesap" ? "var(--gsoft)" : "#6aaae0" }}>
                      {n.type === "bekliyor" ? `🪑 Masa ${n.masa_no} — Müşteri oturdu` : n.type === "garson" ? `🔔 Masa ${n.masa_no} — Garson çağırıyor` : `💳 Masa ${n.masa_no} — Hesap istiyor`}
                    </div>
                    {n.type === "hesap" && <div style={{ fontSize: 13, color: "var(--cream)", marginTop: 4 }}>Ödeme: {n.payment === "nakit" ? "Nakit 💵" : n.payment === "kart" ? "Kart 💳" : "QR 📱"} · <strong style={{ color: "var(--gsoft)" }}>{n.total}₺</strong></div>}
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>🕐 {n.created_at?.slice(11, 16)}</div>
                  </div>
                  {!n.acked && <button onClick={() => ack(n.id)} style={{ background: "none", border: "1px solid var(--bord)", borderRadius: 8, color: "var(--muted)", cursor: "pointer", padding: "5px 11px", fontSize: 12, flexShrink: 0, marginLeft: 9 }}>✓ Tamam</button>}
                </div>
              </div>
            ))
        )}

        {/* ── YÖNETİM (sadece işletmeci) ── */}
        {!loading && tab === "yonetim" && isOwner && (
          <>
            {/* Alt sekmeler */}
            <div style={{ display:"flex", gap:0, marginBottom:16, background:"var(--surf2)", borderRadius:12, padding:3 }}>
              {[["ozet","📊 Özet"],["menu","📋 Menü"]].map(([id,label]) => (
                <button key={id} onClick={()=>setYTab(id)} style={{ flex:1, padding:"9px 6px", background:yTab===id?"var(--surf)":"transparent", border:"none", borderRadius:10, cursor:"pointer", fontSize:12.5, color:yTab===id?"var(--gsoft)":"var(--muted)", fontWeight:yTab===id?600:400, transition:"all .2s" }}>{label}</button>
              ))}
            </div>

            {/* ── ÖZET ── */}
            {yTab === "ozet" && <>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:18 }}>
                {[{label:"Toplam Ciro",value:`${ciro}₺`,color:"var(--gsoft)"},{label:"Sipariş",value:todayOrds.length,color:"#6aaae0"},{label:"Aktif Masa",value:active.length,color:"#3aaa6a"},{label:"Bekleyen",value:orders.filter(o=>o.status!=="hazır").length,color:"#e06060"}].map((s,i)=>(
                  <div key={i} style={{padding:"12px 14px",background:"var(--surf2)",border:"1px solid var(--bord)",borderRadius:12}}>
                    <div style={{fontSize:11,color:"var(--muted)",marginBottom:4}}>{s.label}</div>
                    <div style={{fontFamily:"var(--fh)",fontSize:22,color:s.color}}>{s.value}</div>
                  </div>
                ))}
              </div>
              {topItems.length > 0 && (
                <div style={{padding:"12px 14px",background:"var(--surf2)",border:"1px solid var(--bord)",borderRadius:12,marginBottom:14}}>
                  <div style={{fontSize:11,color:"var(--muted)",marginBottom:10}}>🏆 EN ÇOK SATAN</div>
                  {topItems.map(([ad,adet],i)=>(
                    <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:14,color:"var(--cream)",padding:"4px 0",borderBottom:i<topItems.length-1?"1px solid var(--bord)":"none"}}>
                      <span>{i===0?"🥇":i===1?"🥈":"🥉"} {ad}</span>
                      <span style={{color:"var(--gsoft)"}}>{adet} adet</span>
                    </div>
                  ))}
                </div>
              )}
              {/* Şifre değiştir */}
              <div style={{...card({border:"1px solid var(--gdim)"})}}>
                <div style={{fontFamily:"var(--fh)",fontSize:13,color:"var(--muted)",marginBottom:10}}>🔑 Şifre Değiştir</div>
                <ChangePassInline />
              </div>
            </>}
            {/* ── MENÜ ── */}
            {yTab === "menu" && (
              <MenuManager venueId={vid} />
            )}
          </>
        )}
      </div>


      {/* ── MASA DETAY POPUP ── */}
      {masaPopup && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.88)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:300,backdropFilter:"blur(4px)"}} onClick={()=>setMasaPopup(null)}>
          <div style={{width:"100%",maxWidth:525,background:"var(--surf)",borderRadius:"22px 22px 0 0",padding:"20px 18px 36px",maxHeight:"80vh",display:"flex",flexDirection:"column",animation:"fadeUp .3s ease-out"}} onClick={e=>e.stopPropagation()}>
            {/* Başlık */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexShrink:0}}>
              <div>
                <div style={{fontFamily:"var(--fh)",fontSize:19,color:"var(--cream)"}}>Masa {masaPopup.table.masa_no}</div>
                <div style={{fontSize:12,color:"var(--muted)",marginTop:2}}>
                  {masaPopup.session ? `● Dolu · ⏱ ${elapsed(masaPopup.session.created_at)}` : "○ Boş"}
                  {isOwner && masaPopup.total > 0 && ` · ${masaPopup.total}₺`}
                </div>
              </div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                {/* QR butonu */}
                <button onClick={()=>{setQrModal({masa_no:masaPopup.table.masa_no,url:masaPopup.url});setMasaPopup(null);}} style={{padding:"7px 14px",background:"rgba(201,145,58,.15)",border:"1px solid rgba(201,145,58,.4)",borderRadius:9,color:"var(--gsoft)",cursor:"pointer",fontSize:13}}>🔲 QR</button>
                <button onClick={()=>setMasaPopup(null)} style={{background:"none",border:"none",color:"var(--muted)",cursor:"pointer",fontSize:22}}>✕</button>
              </div>
            </div>

            {/* Siparişler */}
            <div style={{flex:1,overflowY:"auto"}}>
              {!masaPopup.session ? (
                <div style={{textAlign:"center",color:"var(--muted)",marginTop:30,fontStyle:"italic"}}>Bu masa boş</div>
              ) : masaPopup.orders.length === 0 ? (
                <div style={{textAlign:"center",color:"var(--muted)",marginTop:30,fontStyle:"italic"}}>Henüz sipariş yok</div>
              ) : masaPopup.orders.map(o=>(
                <div key={o.id} style={{padding:"9px 11px",background:"var(--surf2)",borderRadius:10,marginBottom:8,border:`1px solid ${o.status==="yeni"?"rgba(192,64,64,.4)":o.status==="hazırlanıyor"?"rgba(201,145,58,.3)":"rgba(58,138,92,.3)"}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                    <span style={{fontSize:11,color:"var(--muted)"}}>🕐 {o.created_at?.slice(11,16)}</span>
                    <span style={{fontSize:11,padding:"2px 8px",borderRadius:20,fontWeight:600,background:o.status==="yeni"?"rgba(192,64,64,.2)":o.status==="hazırlanıyor"?"rgba(201,145,58,.2)":"rgba(58,138,92,.2)",color:o.status==="yeni"?"#e06060":o.status==="hazırlanıyor"?"var(--gsoft)":"#3aaa6a"}}>{o.status}</span>
                  </div>
                  {(o.urunler||[]).map((u,i)=>(
                    <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:13,color:"var(--cream)",padding:"2px 0"}}>
                      <span><strong style={{color:"var(--gsoft)"}}>{u.adet}×</strong> {u.ad}{o.notlar?.includes("[Garson]")?" 👨‍🍳":""}</span>
                      <span style={{color:"var(--muted)"}}>{u.adet*u.fiyat}₺</span>
                    </div>
                  ))}
                  <div style={{display:"flex",justifyContent:"flex-end",gap:6,marginTop:7}}>
                    {o.status==="yeni"         && <button onClick={()=>{oAct(o.id,"hazırlanıyor");setMasaPopup(null);}} style={{padding:"5px 12px",background:"rgba(201,145,58,.2)",border:"1px solid rgba(201,145,58,.4)",borderRadius:8,color:"var(--gsoft)",cursor:"pointer",fontSize:12}}>🔥 Hazırlıyorum</button>}
                    {o.status==="hazırlanıyor" && <button onClick={()=>{oAct(o.id,"hazır");setMasaPopup(null);}} style={{padding:"5px 12px",background:"rgba(58,138,92,.2)",border:"1px solid rgba(58,138,92,.4)",borderRadius:8,color:"#3aaa6a",cursor:"pointer",fontSize:12}}>✅ Servis Et</button>}
                  </div>
                </div>
              ))}
            </div>

            {/* Alt aksiyonlar */}
            {masaPopup.session && (
              <div style={{display:"flex",gap:8,marginTop:14,flexShrink:0}}>
                <button onClick={()=>{setGarsonOrder(masaPopup.session);setGarsonCart([]);setMasaPopup(null);}} style={{flex:1,padding:"11px",background:"rgba(58,138,92,.15)",border:"1px solid rgba(58,138,92,.4)",borderRadius:11,color:"#3aaa6a",cursor:"pointer",fontFamily:"var(--fh)",fontSize:14}}>➕ Sipariş Ekle</button>
                {isOwner && <button onClick={()=>{sClose(masaPopup.session.id);setMasaPopup(null);}} style={{flex:1,padding:"11px",background:"rgba(201,145,58,.15)",border:"1px solid rgba(201,145,58,.4)",borderRadius:11,color:"var(--gsoft)",cursor:"pointer",fontFamily:"var(--fh)",fontSize:14}}>✓ Hesap Ödendi</button>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Garson sipariş popup */}
      {garsonOrder && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.9)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 300, backdropFilter: "blur(4px)" }}>
          <div style={{ width: "100%", maxWidth: 525, background: "var(--surf)", borderRadius: "22px 22px 0 0", padding: "18px 16px 34px", maxHeight: "85vh", display: "flex", flexDirection: "column", animation: "fadeUp .3s ease-out" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexShrink: 0 }}>
              <div>
                <div style={{ fontFamily: "var(--fh)", fontSize: 17, color: "var(--cream)" }}>➕ Sipariş Ekle</div>
                <div style={{ fontSize: 13, color: "var(--muted)" }}>Masa {garsonOrder.masa_no}</div>
              </div>
              <button onClick={() => { setGarsonOrder(null); setGarsonCart([]); }} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 22 }}>✕</button>
            </div>
            {garsonCart.length > 0 && (
              <div style={{ padding: "9px 13px", background: "rgba(58,138,92,.12)", border: "1px solid rgba(58,138,92,.35)", borderRadius: 10, marginBottom: 10, flexShrink: 0, display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, color: "var(--cream)" }}>{garsonCart.map(c => `${c.qty}× ${c.name}`).join(", ")}</span>
                <span style={{ fontFamily: "var(--fh)", color: "var(--gsoft)" }}>{garsonCart.reduce((s, c) => s + c.price * c.qty, 0)}₺</span>
              </div>
            )}
            <div style={{ flex: 1, overflowY: "auto", marginBottom: 10 }}>
              {Object.entries(menu).map(([cat, items]) => (
                <div key={cat} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 5, letterSpacing: .8 }}>{cat}</div>
                  {items.map(item => {
                    const qty = garsonCart.find(c => c.id === item.id)?.qty || 0;
                    return (
                      <div key={item.id} style={{ display: "flex", alignItems: "center", padding: "8px 10px", borderBottom: "1px solid var(--bord)", background: qty > 0 ? "rgba(58,138,92,.05)" : "transparent" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, color: "var(--cream)" }}>{item.name}</div>
                          <div style={{ fontSize: 11, color: "var(--muted)" }}>{item.price}₺</div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          {qty > 0 && <>
                            <button onClick={() => { const ex = garsonCart.find(c => c.id === item.id); setGarsonCart(p => (!ex || ex.qty <= 1) ? p.filter(c => c.id !== item.id) : p.map(c => c.id === item.id ? { ...c, qty: c.qty - 1 } : c)); }} style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--surf2)", border: "1px solid var(--bord)", color: "var(--muted)", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                            <span style={{ fontSize: 14, color: "var(--cream)", minWidth: 16, textAlign: "center" }}>{qty}</span>
                          </>}
                          <button onClick={() => { const ex = garsonCart.find(c => c.id === item.id); setGarsonCart(p => ex ? p.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c) : [...p, { ...item, qty: 1 }]); }} style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg,var(--gold) 0%,#8b5e2a 100%)", border: "none", color: "#0b0704", cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>+</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <button onClick={garsonSubmit} disabled={!garsonCart.length || garsonLoading} style={{ width: "100%", padding: "13px", background: garsonCart.length ? "linear-gradient(135deg,var(--gold) 0%,#8b5e2a 100%)" : "var(--surf2)", border: "none", borderRadius: 13, color: garsonCart.length ? "#0b0704" : "var(--muted)", cursor: garsonCart.length ? "pointer" : "not-allowed", fontFamily: "var(--fh)", fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {garsonLoading ? <Spin /> : `🛎 Gönder${garsonCart.length ? " (" + garsonCart.reduce((s, c) => s + c.price * c.qty, 0) + "₺)" : ""}`}
            </button>
          </div>
        </div>
      )}

      {/* QR Modal */}
      {qrModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.92)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300 }}>
          <div style={{ background: "var(--surf)", borderRadius: 22, padding: "28px 24px", textAlign: "center", animation: "bounce .4s ease-out", maxWidth: 340 }}>
            <div style={{ fontFamily: "var(--fh)", fontSize: 20, color: "var(--cream)", marginBottom: 4 }}>Masa {qrModal.masa_no}</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 18, wordBreak: "break-all" }}>{qrModal.url}</div>
            <img src={qrUrl(qrModal.url)} alt="QR" style={{ width: 240, height: 240, borderRadius: 12, border: "3px solid var(--gold)" }} />
            <div style={{ fontSize: 12, color: "var(--muted)", margin: "12px 0" }}>Sağ tıkla → Farklı kaydet → Yazıcıdan yazdır</div>
            <button onClick={() => setQrModal(null)} style={{ width: "100%", padding: "12px", background: "linear-gradient(135deg,var(--gold) 0%,#8b5e2a 100%)", border: "none", borderRadius: 12, color: "#0b0704", cursor: "pointer", fontFamily: "var(--fh)", fontSize: 15, fontWeight: 600 }}>Kapat</button>
          </div>
        </div>
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════════════════
   ROOT
══════════════════════════════════════════════════════════ */
export default function App() {
  const params    = new URLSearchParams(window.location.search);
  const qrToken   = params.get("qr");
  const isCustomer = !!qrToken;

  // Staff auth state
  const [staff, setStaff]     = useState(() => { try { return JSON.parse(localStorage.getItem("sg_staff")); } catch { return null; } });

  // Customer state
  const [qrInfo, setQrInfo]         = useState(null);   // {venue_id, venue_ad, masa_no, table_id}
  const [session, setSession]       = useState(null);
  const [sessionStatus, setSessionStatus] = useState(null);
  const [qrLoading, setQrLoading]   = useState(isCustomer);
  const [qrError, setQrError]       = useState("");

  // QR yükle
  useEffect(() => {
    if (!isCustomer) return;
    get(`session.php?qr=${qrToken}`).then(r => {
      if (r.error) { setQrError("Geçersiz veya süresi dolmuş QR kodu."); setQrLoading(false); return; }
      setQrInfo({ venue_id: r.venue_id, venue_ad: r.venue_ad, masa_no: r.masa_no, table_id: r.table_id });

      // Mevcut oturum var mı?
      const savedId = localStorage.getItem(`sg_ses_${r.table_id}`);
      if (savedId) {
        get(`session.php?id=${savedId}`).then(r2 => {
          if (r2.session) { setSession(r2.session); setSessionStatus(r2.session.durum); }
          else localStorage.removeItem(`sg_ses_${r.table_id}`);
          setQrLoading(false);
        });
      } else setQrLoading(false);
    }).catch(() => { setQrError("Bağlantı hatası."); setQrLoading(false); });
  }, []);

  // Oturum yoksa oluştur
  useEffect(() => {
    if (!qrInfo || session || qrLoading) return;
    post("session.php", { action: "create", table_id: qrInfo.table_id, venue_id: qrInfo.venue_id, masa_no: qrInfo.masa_no }).then(r => {
      if (r.session) {
        setSession(r.session); setSessionStatus(r.session.durum);
        localStorage.setItem(`sg_ses_${qrInfo.table_id}`, r.session.id);
      }
    });
  }, [qrInfo, session, qrLoading]);

  // Oturum durumu poll
  useEffect(() => {
    if (!session) return;
    const poll = async () => {
      const r = await get(`session.php?id=${session.id}`);
      if (r.error) { localStorage.removeItem(`sg_ses_${qrInfo?.table_id}`); setSession(null); setSessionStatus(null); return; }
      if (r.session?.durum !== sessionStatus) {
        setSessionStatus(r.session.durum);
        setSession(r.session);
        if (r.session.durum === "aktif") playBeep(660, .3, 2);
      }
    };
    const i = setInterval(poll, 3000);
    return () => clearInterval(i);
  }, [session?.id, sessionStatus]);

  const logout = () => { localStorage.removeItem("sg_token"); localStorage.removeItem("sg_staff"); setStaff(null); };

  // ── RENDER ──────────────────────────────────────────────

  // Müşteri akışı
  if (isCustomer) {
    if (qrLoading) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}><Spin /></div>;
    if (qrError)   return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: 28, flexDirection: "column", gap: 16 }}><div style={{ fontSize: 40 }}>❌</div><div style={{ fontFamily: "var(--fh)", fontSize: 20, color: "var(--cream)", textAlign: "center" }}>{qrError}</div></div>;
    if (!session || sessionStatus === "bekliyor") return <WaitingScreen venueAd={qrInfo?.venue_ad || ""} masaNo={qrInfo?.masa_no || ""} />;
    return <CustomerChat session={session} venueAd={qrInfo?.venue_ad || ""} />;
  }

  // Personel akışı
  if (!staff) return <StaffLogin onLogin={setStaff} />;
  if (staff.gecici) return <ChangePassword staff={staff} onDone={updated => setStaff(updated)} />;
  return <StaffPanel staff={staff} onLogout={logout} />;
}
