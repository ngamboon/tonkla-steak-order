'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';

const ACTIVE_STATUSES = ['received', 'cooking'];

export default function KitchenPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const channelRef = useRef(null);

  useEffect(() => {
    loadInitialOrders();
    subscribeToOrders();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadInitialOrders() {
    setLoading(true);
    setErrorMsg('');
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .in('status', ACTIVE_STATUSES)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setOrders(data || []);
    } catch (err) {
      console.error(err);
      setErrorMsg('โหลดออเดอร์ไม่สำเร็จ กรุณารีเฟรชหน้า');
    } finally {
      setLoading(false);
    }
  }

  function subscribeToOrders() {
    const channel = supabase
      .channel('kitchen-orders')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => handleInsert(payload.new)
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        (payload) => handleUpdate(payload.new)
      )
      .subscribe();

    channelRef.current = channel;
  }

  function handleInsert(newOrder) {
    if (!ACTIVE_STATUSES.includes(newOrder.status)) return;
    setOrders((prev) => {
      if (prev.some((o) => o.id === newOrder.id)) return prev;
      return [...prev, newOrder];
    });
  }

  function handleUpdate(updatedOrder) {
    if (!ACTIVE_STATUSES.includes(updatedOrder.status)) {
      // เช่นเปลี่ยนเป็น 'served' -> เอาออกจากจอ
      setOrders((prev) => prev.filter((o) => o.id !== updatedOrder.id));
      return;
    }
    setOrders((prev) => {
      const exists = prev.some((o) => o.id === updatedOrder.id);
      if (!exists) {
        return [...prev, updatedOrder];
      }
      return prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o));
    });
  }

  async function handleStartCooking(order) {
    // อัปเดตหน้าจอทันทีก่อน แล้วค่อยยืนยันกับฐานข้อมูล
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: 'cooking' } : o)));
    try {
      const { error } = await supabase.from('orders').update({ status: 'cooking' }).eq('id', order.id);
      if (error) throw error;
    } catch (err) {
      console.error(err);
      setErrorMsg('อัปเดตสถานะ "เริ่มทำ" ไม่สำเร็จ กรุณาลองใหม่');
      // ย้อนกลับสถานะถ้าอัปเดตไม่สำเร็จ
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: order.status } : o)));
    }
  }

  async function handleServed(order) {
    // เอาการ์ดออกจากจอทันที
    setOrders((prev) => prev.filter((o) => o.id !== order.id));
    try {
      const { error } = await supabase.from('orders').update({ status: 'served' }).eq('id', order.id);
      if (error) throw error;
    } catch (err) {
      console.error(err);
      setErrorMsg('อัปเดตสถานะ "จัดเสิร์ฟแล้ว" ไม่สำเร็จ — ออเดอร์อาจกลับมาแสดงอีกครั้ง');
      // ถ้าอัปเดตไม่สำเร็จ ให้เอาออเดอร์กลับมาแสดง
      setOrders((prev) => {
        if (prev.some((o) => o.id === order.id)) return prev;
        return [...prev, order];
      });
    }
  }

  function formatTime(createdAt) {
    return new Date(createdAt).toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function formatItems(items) {
    if (!Array.isArray(items)) return [];
    return items;
  }

  return (
    <main style={styles.main}>
      <div style={styles.header}>
        <h1 style={styles.title}>ออเดอร์ในครัว</h1>
        <span style={styles.countBadge}>{orders.length} ออเดอร์</span>
      </div>

      {errorMsg && <div style={styles.errorBox}>{errorMsg}</div>}

      {loading ? (
        <p style={styles.loadingText}>กำลังโหลด...</p>
      ) : orders.length === 0 ? (
        <p style={styles.emptyText}>ยังไม่มีออเดอร์ในขณะนี้</p>
      ) : (
        <div style={styles.grid}>
          {orders.map((order) => {
            const isCooking = order.status === 'cooking';
            return (
              <div
                key={order.id}
                style={{
                  ...styles.card,
                  ...(isCooking ? styles.cardCooking : styles.cardReceived),
                }}
              >
                <div style={styles.cardHeader}>
                  <span style={styles.tableNumber}>โต๊ะ {order.table_number}</span>
                  <span style={styles.orderTime}>{formatTime(order.created_at)}</span>
                </div>

                <ul style={styles.itemsList}>
                  {formatItems(order.items).map((item, idx) => (
                    <li key={idx} style={styles.itemLine}>
                      {item.name} <strong>× {item.quantity}</strong>
                    </li>
                  ))}
                </ul>

                <div style={styles.statusLabel}>
                  {isCooking ? '🔥 กำลังทำ' : '🆕 ออเดอร์ใหม่'}
                </div>

                <div style={styles.cardActions}>
                  {!isCooking && (
                    <button
                      type="button"
                      style={styles.startButton}
                      onClick={() => handleStartCooking(order)}
                    >
                      เริ่มทำ
                    </button>
                  )}
                  <button
                    type="button"
                    style={styles.servedButton}
                    onClick={() => handleServed(order)}
                  >
                    จัดเสิร์ฟแล้ว
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

const styles = {
  main: {
    fontFamily: 'sans-serif',
    minHeight: '100vh',
    background: '#1a1a1a',
    padding: '1.5rem',
    color: '#fff',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '1.5rem',
  },
  title: {
    fontSize: '2.2rem',
    margin: 0,
  },
  countBadge: {
    background: '#333',
    borderRadius: 20,
    padding: '0.6rem 1.2rem',
    fontSize: '1.3rem',
    fontWeight: 'bold',
  },
  errorBox: {
    background: '#5c1a1a',
    color: '#ffcdd2',
    border: '2px solid #e57373',
    borderRadius: 8,
    padding: '1rem',
    marginBottom: '1.5rem',
    fontSize: '1.1rem',
    fontWeight: 'bold',
  },
  loadingText: {
    fontSize: '1.5rem',
    textAlign: 'center',
    marginTop: '3rem',
    color: '#aaa',
  },
  emptyText: {
    fontSize: '1.8rem',
    textAlign: 'center',
    marginTop: '4rem',
    color: '#777',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '1.25rem',
  },
  card: {
    borderRadius: 16,
    padding: '1.25rem',
    border: '4px solid transparent',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  cardReceived: {
    background: '#2b2b2b',
    borderColor: '#555',
  },
  cardCooking: {
    background: '#4d3300',
    borderColor: '#ff9800',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  tableNumber: {
    fontSize: '2.2rem',
    fontWeight: 'bold',
  },
  orderTime: {
    fontSize: '1.2rem',
    color: '#ccc',
  },
  itemsList: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
  },
  itemLine: {
    fontSize: '1.35rem',
  },
  statusLabel: {
    fontSize: '1.1rem',
    fontWeight: 'bold',
    opacity: 0.9,
  },
  cardActions: {
    display: 'flex',
    gap: '0.75rem',
    marginTop: '0.5rem',
  },
  startButton: {
    flex: 1,
    background: '#ff9800',
    color: '#1a1a1a',
    border: 'none',
    borderRadius: 10,
    padding: '1rem',
    fontSize: '1.2rem',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  servedButton: {
    flex: 1,
    background: '#2e7d32',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '1rem',
    fontSize: '1.2rem',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
};
