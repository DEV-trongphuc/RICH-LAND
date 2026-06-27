import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, ChevronRight, Clock, Phone, Users, Video, 
  CheckCircle2, Mail, AlignLeft
} from 'lucide-react';
import api from '../api/axios';
import { useUIStore } from '../store/uiStore';
import { motion } from 'framer-motion';

interface CalendarViewProps {
  onEventClick: (event: any) => void;
  onDateClick?: (dateStr: string) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ onEventClick, onDateClick }) => {
  const { addToast } = useUIStore();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActivities = async () => {
    try {
      const res = await api.get('/activities');
      setActivities(res.data.data?.items || res.data.data || []);
    } catch (err) {
      addToast('Lỗi khi tải lịch làm việc', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchActivities(); }, []);

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthName = new Intl.DateTimeFormat('vi-VN', { month: 'long' }).format(currentDate);

  const days = [];
  const totalDays = daysInMonth(year, month);
  const startOffset = firstDayOfMonth(year, month);

  // Padding for start of month
  for (let i = 0; i < startOffset; i++) {
    days.push(<div key={`empty-${i}`} className="calendar-day empty border-r border-b border-[var(--color-border-light)] bg-[var(--color-bg)]" style={{ opacity: 0.3 }}></div>);
  }

  const T_ICON: Record<string, React.ReactNode> = {
    call: <Phone size={10} />, email: <Mail size={10} />, meeting: <Users size={10} />,
    task: <CheckCircle2 size={10} />, note: <AlignLeft size={10} />
  };

  const getStyleForType = (type: string) => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
      switch (type) {
        case 'call': return { backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#93c5fd', borderColor: 'rgba(59, 130, 246, 0.3)' };
        case 'email': return { backgroundColor: 'rgba(189, 29, 45, 0.15)', color: '#e63946', borderColor: 'rgba(189, 29, 45, 0.3)' };
        case 'meeting': return { backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#6ee7b7', borderColor: 'rgba(16, 185, 129, 0.3)' };
        case 'task': return { backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#fcd34d', borderColor: 'rgba(245, 158, 11, 0.3)' };
        default: return { backgroundColor: 'rgba(255, 255, 255, 0.05)', color: '#cbd5e1', borderColor: 'rgba(255, 255, 255, 0.1)' };
      }
    }
    switch (type) {
      case 'call': return { backgroundColor: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe' };
      case 'email': return { backgroundColor: '#fff8f9', color: '#7e22ce', borderColor: '#ffccd5' };
      case 'meeting': return { backgroundColor: '#ecfdf5', color: '#047857', borderColor: '#a7f3d0' };
      case 'task': return { backgroundColor: '#fffbeb', color: '#b45309', borderColor: '#fde68a' };
      default: return { backgroundColor: '#f8fafc', color: '#334155', borderColor: '#e2e8f0' };
    }
  };

  // Days of month
  for (let d = 1; d <= totalDays; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayActivities = activities.filter(a => a.due_date && a.due_date.startsWith(dateStr));
    const isToday = new Date().toDateString() === new Date(year, month, d).toDateString();

    days.push(
      <div 
        key={d} 
        className="calendar-day" 
        onClick={() => onDateClick?.(dateStr)}
        style={{ borderRight: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)', padding: '0.5rem', minHeight: '120px', transition: 'background-color 0.2s', backgroundColor: isToday ? 'rgba(163, 20, 34, 0.05)' : 'transparent', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
           <span style={{ fontSize: '0.75rem', fontWeight: 700, width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', backgroundColor: isToday ? 'var(--color-primary)' : 'transparent', color: isToday ? 'white' : 'var(--color-text-muted)' }}>{d}</span>
           {dayActivities.length > 0 && <span style={{ width: '6px', height: '6px', backgroundColor: 'var(--color-primary)', borderRadius: '50%' }}></span>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
           {dayActivities.slice(0, 3).map(a => (
             <div 
                key={a.id} 
                onClick={(e) => { e.stopPropagation(); onEventClick(a); }}
                style={{ padding: '4px 6px', borderRadius: '4px', border: '1px solid', fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', opacity: a.status === 'done' ? 0.5 : 1, filter: a.status === 'done' ? 'grayscale(100%)' : 'none', ...getStyleForType(a.type) }}
             >
               {T_ICON[a.type] || T_ICON.note}
               <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{a.subject}</span>
             </div>
           ))}
           {dayActivities.length > 3 && (
             <div style={{ fontSize: '9px', color: 'var(--color-text-light)', fontWeight: 700, textAlign: 'center', marginTop: '2px' }}>+{dayActivities.length - 3} thêm</div>
           )}
        </div>
      </div>
    );
  }

  const weekDays = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-2xl)', border: '1px solid var(--color-border)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', borderBottom: '1px solid var(--color-border)', backgroundColor: 'rgba(0,0,0,0.02)' }}>
        <div className="flex items-center gap-4">
           <div className="flex bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-1 shadow-sm">
              <button className="p-1.5 rounded-lg transition-colors hover:bg-[var(--color-surface-hover)]" onClick={prevMonth}><ChevronLeft size={16} /></button>
              <span className="px-4 py-1.5 font-bold capitalize text-sm min-w-[120px] text-center" style={{ color: 'var(--color-text)' }}>
                {monthName} {year}
              </span>
              <button className="p-1.5 rounded-lg transition-colors hover:bg-[var(--color-surface-hover)]" onClick={nextMonth}><ChevronRight size={16} /></button>
           </div>
           <button className="text-xs font-bold text-primary hover:underline" onClick={() => setCurrentDate(new Date())}>Hôm nay</button>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
           {['call', 'email', 'meeting', 'task', 'note'].map(type => (
             <div key={type} style={{ width: '12px', height: '12px', borderRadius: '50%', ...getStyleForType(type) }} title={type} />
           ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', borderTop: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg)' }}>
        {weekDays.map(wd => (
          <div key={wd} style={{ padding: '8px', textAlign: 'center', fontSize: '10px', fontWeight: 900, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {wd}
          </div>
        ))}
      </div>
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gridAutoRows: '1fr', overflowY: 'auto' }}>
        {days}
      </div>
    </div>
  );
};
