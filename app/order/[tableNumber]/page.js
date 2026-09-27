'use client';

import { useState, useEffect, use } from 'react';
import { supabase } from '@/lib/supabaseClient';

const MAX_CART_ITEMS = 10;
const MAX_QTY_PER_ITEM = 5;
const ADULT_PRICE = 289;
const CHILD_PRICE = 145;

export default function OrderPage({ params }) {
  // ⚠️ Next.js เวอร์ชันนี้ params เป็น Promise ต้อง unwrap ด้วย use() เสมอ
  const { tableNumber } = use(params);
  const tableNumberNum = parseInt(tableNumber, 10);

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null); // { id, adult_count, child_count }
  const [tableNotOpen, setTableNotOpen] = useState(false);

  const [categories, setCategories] = useState([]);
  const [itemsByCategory, setItemsByCategory] = useState({});
  const [activeCategoryId, setActiveCategoryId] = useState(null);

  const [qtySelect, setQtySelect] = useState({}); // itemId -> qty ที่เลือกไว้ก่อนกด +
  const [cart, setCart] = useState([]); // [{ id, name, quantity }]
  const [cartOpen, setCartOpen] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [orderSentMsg, setOrderSentMsg] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [showBillConfirm, setShowBillConfirm] = useState(false);
  const [closingBill, setClosingBill] = useState(false);
  const [billClosed, setBillClosed] = useState(false);

  useEffect(() => {
    checkSessionAndLoadMenu();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkSessionAndLoadMenu() {
    setLoading(true);
    setErrorMsg('');
    try {
      const { data: sessions, error: sessionError } = await supabase
        .from('sessions')
        .select('id, adult_count, child_count')
        .eq('table_number', tableNumberNum)
        .eq('status', 'open')
        .limit(1);

      if (sessionError) throw sessionError;

      if (!sessions || sessions.length === 0) {
        setTableNotOpen(true);
        setLoading(false);
        return;
      }

      setSession(sessions[0]);

      const { data: cats, error: catError } = await supabase
        .from('menu_categories')
        .select('id, name, sort_order')
        .order('sort_order', { ascending: true });

      if (catError) throw catError;

      const { data: items, error: itemError } = await supabase
        .from('menu_items')
        .select('id, category_id, name');

      if (itemError) throw itemError;

      const grouped = {};
      (items || []).forEach((item) => {
        if (!grouped[item.category_id]) grouped[item.category_id] = [];
        grouped[item.category_id].push(item);
      });

      setCategories(cats || []);
      setItemsByCategory(grouped);
      if (cats && cats.length > 0) {
        setActiveCategoryId(cats[0].id);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('เกิดข้อผิดพลาดในการโหลดข้อมูล กรุณาลองใหม่');
    } finally {
      setLoading(false);
    }
  }

  function getQtyForItem(itemId) {
    return qtySelect[itemId] || 1;
  }

  function setQtyForItem(itemId, qty) {
    setQtySelect((prev) => ({ ...prev, [itemId]: qty }));
  }

  function handleAddToCart(item) {
    const qty = getQtyForItem(item.id);
    setErrorMsg('');
    setCart((prev) => {
      const existingIndex = prev.findIndex((c) => c.id === item.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        const newQty = Math.min(MAX_QTY_PER_ITEM, updated[existingIndex].quantity + qty);
        updated[existingIndex] = { ...updated[existingIndex], quantity: newQty };
        return updated;
      }
      if (prev.length >= MAX_CART_ITEMS) {
        setErrorMsg(`ตะกร้าเต็มแล้ว (สูงสุด ${MAX_CART_ITEMS} รายการต่อการส่ง 1 ครั้ง)`);
        return prev;
      }
      return [...prev, { id: item.id, name: item.name, quantity: Math.min(MAX_QTY_PER_ITEM, qty) }];
    });
    setCartOpen(true);
  }

  function handleRemoveFromCart(itemId) {
    setCart((prev) => prev.filter((c) => c.id !== itemId));
  }

  function handleChangeCartQty(itemId, quantity) {
    if (quantity < 1) {
      handleRemoveFromCart(itemId);
      return;
    }
    setCart((prev) =>
      prev.map((c) =>
        c.id === itemId ? { ...c, quantity: Math.min(MAX_QTY_PER_ITEM, quantity) } : c
      )
    );
  }

  const totalCartCount = cart.reduce((sum, c) => sum + c.quantity, 0);

  async function handleSubmitOrder() {
    if (!session || cart.length === 0) return;
    setSubmitting(true);
    setErrorMsg('');
    try {
      const { error } = await supabase.from('orders').insert([
        {
          session_id: session.id,
          table_number: tableNumberNum,
          items: cart.map((c) => ({ name: c.name, quantity: c.quantity })),
          status: 'received',
        },
      ]);

      if (error) throw error;

      setCart([]);
      setCartOpen(false);
      setOrderSentMsg(true);
      setTimeout(() => setOrderSentMsg(false), 3000);
    } catch (err) {
      console.error(err);
      setErrorMsg('ส่งออเดอร์ไม่สำเร็จ: ' + (err.message || 'กรุณาลองใหม่'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmBill() {
    if (!session) return;
    setClosingBill(true);
    setErrorMsg('');
    try {
      const { error } = await supabase
        .from('sessions')
        .update({ status: 'closed' })
        .eq('id', session.id)
        .eq('status', 'open');

      if (error) throw error;

      setShowBillConfirm(false);
      setBillClosed(true);
    } catch (err) {
      console.error(err);
      setErrorMsg('ปิดโต๊ะไม่สำเร็จ: ' + (err.message || 'กรุณาลองใหม่'));
    } finally {
      setClosingBill(false);
    }
  }

  const billTotal = session ? session.adult_count * ADULT_PRICE + session.child_count * CHILD_PRICE : 0;

  if (loading) {
    return (
      <main style={styles.centerScreen}>
        <p style={styles.centerText}>กำลังโหลด...</p>
      </main>
    );
  }

  if (tableNotOpen) {
    return (
      <main style={styles.centerScreen}>
        <p style={styles.centerText}>โต๊ะนี้ยังไม่เปิดใช้งาน กรุณาแจ้งพนักงาน</p>
      </main>
    );
  }

  if (billClosed) {
    return (
      <main style={styles.centerScreen}>
        <p style={styles.thankYouText}>ขอบคุณที่ใช้บริการ</p>
      </main>
    );
  }

  const activeItems = activeCategoryId ? itemsByCategory[activeCategoryId] || [] : [];

  return (
    <main style={styles.main}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.tableLabel}>โต๊ะ {tableNumberNum}</span>
        <button type="button" style={styles.billButton} onClick={() => setShowBillConfirm(true)}>
          เรียกเก็บเงิน
        </button>
      </div>

      <div style={styles.bodyScroll}>
        {errorMsg && <div style={styles.errorBox}>{errorMsg}</div>}
        {orderSentMsg && <div style={styles.successBox}>ส่งออเดอร์แล้ว ✓</div>}

        {/* Category tabs */}
        <div style={styles.tabsRow}>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategoryId(cat.id)}
              style={{
                ...styles.tabButton,
                ...(activeCategoryId === cat.id ? styles.tabButtonActive : {}),
              }}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Menu items */}
        <div style={styles.itemsList}>
          {activeItems.length === 0 && <p style={styles.emptyText}>ไม่มีเมนูในหมวดนี้</p>}
          {activeItems.map((item) => (
            <div key={item.id} style={styles.itemRow}>
              <span style={styles.itemName}>{item.name}</span>
              <div style={styles.itemControls}>
                <select
                  value={getQtyForItem(item.id)}
                  onChange={(e) => setQtyForItem(item.id, parseInt(e.target.value, 10))}
                  style={styles.qtySelect}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <button type="button" style={styles.addButton} onClick={() => handleAddToCart(item)}>
                  +
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* เว้นที่ด้านล่างกันตะกร้าลอยบัง */}
        {cart.length > 0 && <div style={{ height: cartOpen ? 260 : 90 }} />}
      </div>

      {/* Floating cart */}
      {cart.length > 0 && (
        <div style={styles.floatingCartWrap}>
          {cartOpen && (
            <div style={styles.cartDetails}>
              {cart.map((c) => (
                <div key={c.id} style={styles.cartLine}>
                  <span style={styles.cartLineName}>{c.name}</span>
                  <div style={styles.cartLineControls}>
                    <button
                      type="button"
                      style={styles.cartQtyButton}
                      onClick={() => handleChangeCartQty(c.id, c.quantity - 1)}
                    >
                      −
                    </button>
                    <span style={styles.cartQtyText}>{c.quantity}</span>
                    <button
                      type="button"
                      style={styles.cartQtyButton}
                      onClick={() => handleChangeCartQty(c.id, c.quantity + 1)}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      style={styles.cartRemoveButton}
                      onClick={() => handleRemoveFromCart(c.id)}
                    >
                      ลบ
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={styles.floatingCartBar}>
            <button type="button" style={styles.cartToggleButton} onClick={() => setCartOpen((v) => !v)}>
              🛒 ตะกร้า ({totalCartCount})
            </button>
            <button
              type="button"
              style={styles.submitOrderButton}
              onClick={handleSubmitOrder}
              disabled={submitting}
            >
              {submitting ? 'กำลังส่ง...' : 'ส่งออเดอร์'}
            </button>
          </div>
        </div>
      )}

      {/* Bill confirm modal */}
      {showBillConfirm && (
        <div style={styles.overlay}>
          <div style={styles.confirmBox}>
            <h2 style={styles.confirmTitle}>ยืนยันเรียกเก็บเงิน</h2>
            <p style={styles.confirmLine}>ผู้ใหญ่ {session.adult_count} คน × {ADULT_PRICE} บาท</p>
            <p style={styles.confirmLine}>เด็ก {session.child_count} คน × {CHILD_PRICE} บาท</p>
            <p style={styles.confirmTotal}>ยอดที่ต้องจ่าย: {billTotal.toLocaleString()} บาท</p>
            <div style={styles.confirmActions}>
              <button
                type="button"
                style={styles.cancelButton}
                onClick={() => setShowBillConfirm(false)}
                disabled={closingBill}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                style={styles.confirmButton}
                onClick={handleConfirmBill}
                disabled={closingBill}
              >
                {closingBill ? 'กำลังปิด...' : 'ยืนยัน'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

const styles = {
  main: {
    fontFamily: 'sans-serif',
    minHeight: '100vh',
    background: '#fafafa',
    display: 'flex',
    flexDirection: 'column',
  },
  centerScreen: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
    textAlign: 'center',
    fontFamily: 'sans-serif',
  },
  centerText: {
    fontSize: '1.4rem',
    fontWeight: 'bold',
    color: '#555',
  },
  thankYouText: {
    fontSize: '2rem',
    fontWeight: 'bold',
    color: '#2e7d32',
  },
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 5,
    background: '#212121',
    color: '#fff',
    padding: '1rem 1.25rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tableLabel: {
    fontSize: '1.3rem',
    fontWeight: 'bold',
  },
  billButton: {
    background: '#e53935',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '0.7rem 1.1rem',
    fontSize: '1rem',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  bodyScroll: {
    flex: 1,
    padding: '1rem',
  },
  errorBox: {
    background: '#fde2e2',
    color: '#8a1f1f',
    border: '2px solid #e57373',
    borderRadius: 8,
    padding: '0.9rem',
    marginBottom: '1rem',
    fontWeight: 'bold',
    fontSize: '0.95rem',
  },
  successBox: {
    background: '#e8f5e9',
    color: '#1b5e20',
    border: '2px solid #66bb6a',
    borderRadius: 8,
    padding: '0.9rem',
    marginBottom: '1rem',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  tabsRow: {
    display: 'flex',
    gap: '0.5rem',
    overflowX: 'auto',
    paddingBottom: '0.5rem',
    marginBottom: '1rem',
  },
  tabButton: {
    flexShrink: 0,
    background: '#eee',
    color: '#333',
    border: 'none',
    borderRadius: 20,
    padding: '0.7rem 1.2rem',
    fontSize: '1rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  tabButtonActive: {
    background: '#d84315',
    color: '#fff',
  },
  itemsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  emptyText: {
    color: '#888',
    textAlign: 'center',
    padding: '2rem 0',
  },
  itemRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: '#fff',
    borderRadius: 12,
    padding: '1rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  itemName: {
    fontSize: '1.1rem',
    fontWeight: 'bold',
    flex: 1,
    marginRight: '0.75rem',
  },
  itemControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    flexShrink: 0,
  },
  qtySelect: {
    fontSize: '1.1rem',
    padding: '0.5rem',
    borderRadius: 8,
    border: '2px solid #ccc',
  },
  addButton: {
    background: '#2e7d32',
    color: '#fff',
    border: 'none',
    borderRadius: '50%',
    width: 44,
    height: 44,
    fontSize: '1.5rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    lineHeight: 1,
  },
  floatingCartWrap: {
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },
  cartDetails: {
    background: '#fff',
    borderTop: '1px solid #ddd',
    maxHeight: 220,
    overflowY: 'auto',
    padding: '0.75rem 1rem',
  },
  cartLine: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.5rem 0',
    borderBottom: '1px solid #f0f0f0',
  },
  cartLineName: {
    fontSize: '1rem',
    flex: 1,
  },
  cartLineControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  cartQtyButton: {
    background: '#eee',
    border: 'none',
    borderRadius: 6,
    width: 32,
    height: 32,
    fontSize: '1.1rem',
    cursor: 'pointer',
  },
  cartQtyText: {
    minWidth: 20,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  cartRemoveButton: {
    background: '#ffcdd2',
    color: '#c62828',
    border: 'none',
    borderRadius: 6,
    padding: '0.4rem 0.6rem',
    fontSize: '0.85rem',
    cursor: 'pointer',
  },
  floatingCartBar: {
    display: 'flex',
    gap: '0.75rem',
    padding: '0.75rem 1rem',
    paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))',
    background: '#212121',
  },
  cartToggleButton: {
    flex: 1,
    background: '#424242',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '1rem',
    fontSize: '1.05rem',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  submitOrderButton: {
    flex: 1,
    background: '#2e7d32',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '1rem',
    fontSize: '1.05rem',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
    zIndex: 20,
  },
  confirmBox: {
    background: '#fff',
    borderRadius: 12,
    padding: '1.75rem',
    maxWidth: 380,
    width: '100%',
    border: '3px solid #e53935',
  },
  confirmTitle: {
    color: '#c62828',
    marginTop: 0,
    fontSize: '1.4rem',
  },
  confirmLine: {
    fontSize: '1.1rem',
    margin: '0.4rem 0',
  },
  confirmTotal: {
    fontSize: '1.3rem',
    fontWeight: 'bold',
    marginTop: '1rem',
  },
  confirmActions: {
    display: 'flex',
    gap: '0.75rem',
    marginTop: '1.5rem',
  },
  cancelButton: {
    flex: 1,
    background: '#e0e0e0',
    color: '#333',
    border: 'none',
    borderRadius: 8,
    padding: '0.9rem',
    fontSize: '1.05rem',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  confirmButton: {
    flex: 1,
    background: '#c62828',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '0.9rem',
    fontSize: '1.05rem',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
};
