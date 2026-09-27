'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

const initialForm = {
  tableNumber: '',
  adultCount: '',
  childCount: '',
};

export default function GenerateQrPage() {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // ถ้ามี session เดิมเปิดค้างอยู่ที่โต๊ะนี้ จะถูกเก็บไว้ตรงนี้
  const [existingSession, setExistingSession] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [closing, setClosing] = useState(false);

  // ผลลัพธ์ QR หลังเปิดโต๊ะสำเร็จ
  const [qrResult, setQrResult] = useState(null);
  const [copied, setCopied] = useState(false);

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function resetAll() {
    setForm(initialForm);
    setExistingSession(null);
    setShowConfirm(false);
    setQrResult(null);
    setErrorMsg('');
    setCopied(false);
  }

  async function handleOpenTable(e) {
    e.preventDefault();
    setErrorMsg('');

    const tableNumber = parseInt(form.tableNumber, 10);
    const adultCount = parseInt(form.adultCount, 10) || 0;
    const childCount = parseInt(form.childCount, 10) || 0;

    if (!tableNumber || tableNumber <= 0) {
      setErrorMsg('กรุณากรอกเลขโต๊ะให้ถูกต้อง');
      return;
    }

    setLoading(true);
    try {
      // 1. เช็คว่ามี session ที่ยังเปิดอยู่ของโต๊ะนี้หรือไม่
      const { data: openSessions, error: checkError } = await supabase
        .from('sessions')
        .select('id, table_number, adult_count, child_count, created_at')
        .eq('table_number', tableNumber)
        .eq('status', 'open')
        .limit(1);

      if (checkError) throw checkError;

      if (openSessions && openSessions.length > 0) {
        // มี session เปิดค้างอยู่ -> แสดงกล่องเตือนแทนการสร้างใหม่
        setExistingSession(openSessions[0]);
        setLoading(false);
        return;
      }

      // 2. ไม่มี session เปิดค้าง -> สร้างใหม่
      const { data: inserted, error: insertError } = await supabase
        .from('sessions')
        .insert([
          {
            table_number: tableNumber,
            adult_count: adultCount,
            child_count: childCount,
            status: 'open',
          },
        ])
        .select()
        .single();

      if (insertError) throw insertError;

      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const orderUrl = `${origin}/order/${inserted.table_number}`;

      setQrResult({
        tableNumber: inserted.table_number,
        adultCount: inserted.adult_count,
        childCount: inserted.child_count,
        url: orderUrl,
      });
    } catch (err) {
      console.error(err);
      setErrorMsg('เกิดข้อผิดพลาด: ' + (err.message || 'ไม่สามารถเปิดโต๊ะได้ กรุณาลองใหม่'));
    } finally {
      setLoading(false);
    }
  }

  function getMinutesOpen(createdAt) {
    const diffMs = Date.now() - new Date(createdAt).getTime();
    return Math.max(0, Math.floor(diffMs / 60000));
  }

  async function handleConfirmClose() {
    if (!existingSession) return;
    setClosing(true);
    setErrorMsg('');
    try {
      // เช็คซ้ำว่า status ยังเป็น 'open' ตอน update จริง เพื่อกันการกดปิดซ้ำซ้อน
      const { data, error } = await supabase
        .from('sessions')
        .update({ status: 'closed' })
        .eq('id', existingSession.id)
        .eq('status', 'open')
        .select();

      if (error) throw error;

      if (!data || data.length === 0) {
        // มีคนอื่นปิดไปก่อนแล้ว
        setErrorMsg('โต๊ะนี้ถูกปิดออเดอร์ไปแล้วโดยผู้อื่น กรุณากด "เปิดโต๊ะ" อีกครั้ง');
      }

      // ปิดกล่องยืนยัน + เอากล่องเตือนออก กลับไปที่ฟอร์มเดิม (ค่าที่กรอกไว้ยังอยู่)
      setShowConfirm(false);
      setExistingSession(null);
    } catch (err) {
      console.error(err);
      setErrorMsg('ปิดออเดอร์เดิมไม่สำเร็จ: ' + (err.message || 'กรุณาลองใหม่'));
    } finally {
      setClosing(false);
    }
  }

  function handleCancelConfirm() {
    setShowConfirm(false);
  }

  async function handleCopyLink() {
    if (!qrResult) return;
    try {
      await navigator.clipboard.writeText(qrResult.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error(err);
      setErrorMsg('คัดลอกลิงก์ไม่สำเร็จ กรุณาคัดลอกด้วยตนเอง');
    }
  }

  const qrImageUrl = qrResult
    ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrResult.url)}`
    : null;

  return (
    <main style={styles.main}>
      <h1 style={styles.title}>เปิดโต๊ะให้ลูกค้า</h1>

      {errorMsg && <div style={styles.errorBox}>{errorMsg}</div>}

      {/* กล่องเตือน: โต๊ะนี้มี session เปิดค้างอยู่แล้ว */}
      {existingSession && !qrResult && (
        <div style={styles.warningBox}>
          <p style={styles.warningText}>
            โต๊ะนี้มีลูกค้าอยู่ระหว่างทานอาหาร กรุณาปิดออเดอร์เดิมก่อน
          </p>
          <button
            type="button"
            style={styles.warningButton}
            onClick={() => setShowConfirm(true)}
          >
            ปิดออเดอร์เดิม
          </button>
        </div>
      )}

      {/* ฟอร์มกรอกข้อมูล */}
      {!qrResult && (
        <form onSubmit={handleOpenTable} style={styles.form}>
          <label style={styles.label}>
            เลขโต๊ะ
            <input
              type="number"
              inputMode="numeric"
              min="1"
              value={form.tableNumber}
              onChange={(e) => handleChange('tableNumber', e.target.value)}
              style={styles.input}
              required
              disabled={loading}
            />
          </label>

          <label style={styles.label}>
            จำนวนผู้ใหญ่
            <input
              type="number"
              inputMode="numeric"
              min="0"
              value={form.adultCount}
              onChange={(e) => handleChange('adultCount', e.target.value)}
              style={styles.input}
              disabled={loading}
            />
          </label>

          <label style={styles.label}>
            จำนวนเด็ก
            <input
              type="number"
              inputMode="numeric"
              min="0"
              value={form.childCount}
              onChange={(e) => handleChange('childCount', e.target.value)}
              style={styles.input}
              disabled={loading}
            />
          </label>

          <button type="submit" style={styles.submitButton} disabled={loading}>
            {loading ? 'กำลังเปิดโต๊ะ...' : 'เปิดโต๊ะ'}
          </button>
        </form>
      )}

      {/* ผลลัพธ์ QR หลังเปิดโต๊ะสำเร็จ */}
      {qrResult && (
        <div style={styles.qrBox}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrImageUrl} alt={`QR Code โต๊ะ ${qrResult.tableNumber}`} style={styles.qrImage} />
          <p style={styles.qrSummary}>
            โต๊ะ {qrResult.tableNumber} · ผู้ใหญ่ {qrResult.adultCount} · เด็ก {qrResult.childCount}
          </p>
          <div style={styles.linkRow}>
            <span style={styles.linkText}>{qrResult.url}</span>
            <button type="button" style={styles.copyButton} onClick={handleCopyLink}>
              {copied ? 'คัดลอกแล้ว ✓' : 'คัดลอกลิงก์'}
            </button>
          </div>
          <button type="button" style={styles.newTableButton} onClick={resetAll}>
            เปิดโต๊ะใหม่
          </button>
        </div>
      )}

      {/* กล่องยืนยันปิดโต๊ะเดิม */}
      {showConfirm && existingSession && (
        <div style={styles.overlay}>
          <div style={styles.confirmBox}>
            <h2 style={styles.confirmTitle}>ยืนยันปิดโต๊ะเดิม</h2>
            <p style={styles.confirmLine}>เลขโต๊ะ: {existingSession.table_number}</p>
            <p style={styles.confirmLine}>
              ผู้ใหญ่ {existingSession.adult_count} · เด็ก {existingSession.child_count}
            </p>
            <p style={styles.confirmLine}>
              เปิดมาแล้ว {getMinutesOpen(existingSession.created_at)} นาที
            </p>
            <div style={styles.confirmActions}>
              <button
                type="button"
                style={styles.cancelButton}
                onClick={handleCancelConfirm}
                disabled={closing}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                style={styles.confirmButton}
                onClick={handleConfirmClose}
                disabled={closing}
              >
                {closing ? 'กำลังปิด...' : 'ยืนยันปิดโต๊ะเดิม'}
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
    padding: '2rem',
    fontFamily: 'sans-serif',
    maxWidth: 480,
    margin: '0 auto',
    fontSize: '1.1rem',
  },
  title: {
    fontSize: '2rem',
    marginBottom: '1.5rem',
  },
  errorBox: {
    background: '#fde2e2',
    color: '#8a1f1f',
    border: '2px solid #e57373',
    borderRadius: 8,
    padding: '1rem',
    marginBottom: '1.5rem',
    fontWeight: 'bold',
  },
  warningBox: {
    background: '#fff3e0',
    border: '3px solid #fb8c00',
    borderRadius: 10,
    padding: '1.25rem',
    marginBottom: '1.5rem',
  },
  warningText: {
    color: '#e65100',
    fontWeight: 'bold',
    fontSize: '1.15rem',
    marginTop: 0,
    marginBottom: '1rem',
  },
  warningButton: {
    background: '#e53935',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '0.9rem 1.5rem',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    width: '100%',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
    fontWeight: 'bold',
    fontSize: '1.1rem',
  },
  input: {
    fontSize: '1.4rem',
    padding: '0.6rem',
    borderRadius: 8,
    border: '2px solid #ccc',
  },
  submitButton: {
    background: '#2e7d32',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '1.1rem',
    fontSize: '1.3rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    marginTop: '0.5rem',
  },
  qrBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
    textAlign: 'center',
  },
  qrImage: {
    width: 260,
    height: 260,
  },
  qrSummary: {
    fontSize: '1.4rem',
    fontWeight: 'bold',
  },
  linkRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
    alignItems: 'center',
    width: '100%',
  },
  linkText: {
    wordBreak: 'break-all',
    color: '#555',
    fontSize: '0.95rem',
  },
  copyButton: {
    background: '#1565c0',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '0.4rem 0.9rem',
    fontSize: '0.9rem',
    cursor: 'pointer',
  },
  newTableButton: {
    background: '#455a64',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '1rem 1.5rem',
    fontSize: '1.2rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    marginTop: '1rem',
    width: '100%',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
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
