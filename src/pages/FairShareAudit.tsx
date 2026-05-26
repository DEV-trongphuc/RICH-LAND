import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Scale, Users, AlertTriangle, BarChart2, Info,
  TrendingUp, Sparkles, CheckCircle, Layers,
  RotateCcw, Settings, Copy, ChevronDown, ChevronUp
} from 'lucide-react';
import {
  Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Legend
} from 'recharts';
import { CustomSelect } from '../components/ui/CustomSelect';
import { CustomModal } from '../components/ui/CustomModal';
import { fetchAPI } from '../utils/api';
import toast from 'react-hot-toast';
import { KpiCardSkeleton, Skeleton } from '../components/ui/Skeleton';
import { Avatar } from '../components/ui/Avatar';
import { useLanguage } from '../contexts/LanguageContext';

export const FairShareAudit = () => {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<any>(null);
  const [rounds, setRounds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('Tháng này');
  const [roundFilter, setRoundFilter] = useState(() => {
    return searchParams.get('round_id') || '';
  });

  const [showDateModal, setShowDateModal] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copyReportText, setCopyReportText] = useState('');

  // Compensation Details Modal State
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [compensationDetails, setCompensationDetails] = useState<any>(null);

  // State to track expanded sections in the Details modal
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    ticket: true,
    blacklist: false,
    reassign: false,
    active: false
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Reset expanded sections when details modal is opened
  useEffect(() => {
    if (showDetailsModal) {
      setExpandedSections({
        ticket: true,
        blacklist: false,
        reassign: false,
        active: false
      });
    }
  }, [showDetailsModal]);

  // Simulation State
  const [isSimulating, setIsSimulating] = useState(false);
  const [simConsultants, setSimConsultants] = useState<any[]>([]);
  const [simTotalLeads, setSimTotalLeads] = useState<number>(0);

  // Initialize/Sync simulation consultants state when actual data changes
  useEffect(() => {
    if (data?.consultants) {
      setSimConsultants(data.consultants.map((c: any) => ({
        id: c.id,
        name: c.name,
        avatar: c.avatar,
        receive_ratio: c.receive_ratio,
        assigned_count: c.assigned_count,
        sources: { ...c.sources },
        ticket_count: c.ticket_count,
        total_ticket_count: c.total_ticket_count,
        duplicate_count: c.duplicate_count,
        compensation_count: c.compensation_count,
        round_id: c.round_id,
        round_name: c.round_name,
        // Simulation settings
        simulatedRatio: c.receive_ratio,
        simulatedOnShift: c.receive_ratio > 0
      })));
      setSimTotalLeads(Math.round(data.totalLeads || 0));
    } else {
      setSimConsultants([]);
      setSimTotalLeads(0);
    }
  }, [data]);

  const handleUpdateSimRatio = (id: number, ratio: number) => {
    setSimConsultants(prev => prev.map(c => c.id === id ? { ...c, simulatedRatio: ratio } : c));
  };

  const handleToggleSimShift = (id: number) => {
    setSimConsultants(prev => prev.map(c => c.id === id ? { ...c, simulatedOnShift: !c.simulatedOnShift } : c));
  };

  const handleResetSimulation = () => {
    if (!data?.consultants) return;
    setSimConsultants(data.consultants.map((c: any) => ({
      id: c.id,
      name: c.name,
      avatar: c.avatar,
      receive_ratio: c.receive_ratio,
      assigned_count: c.assigned_count,
      sources: { ...c.sources },
      ticket_count: c.ticket_count,
      total_ticket_count: c.total_ticket_count,
      duplicate_count: c.duplicate_count,
      compensation_count: c.compensation_count,
      round_id: c.round_id,
      round_name: c.round_name,
      simulatedRatio: c.receive_ratio,
      simulatedOnShift: c.receive_ratio > 0
    })));
    setSimTotalLeads(Math.round(data.totalLeads || 0));
    toast.success(t("Đã đặt lại bộ giả lập về mặc định"));
  };

  // Saving configuration has been disabled to keep it purely as a simulation

  // Utility function for Largest Remainder Method (Hare-Niemeyer) distribution to get exact integers
  const distributeProportionally = (total: number, weights: number[]): number[] => {
    if (total <= 0 || weights.length === 0) return weights.map(() => 0);
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    if (totalWeight === 0) return weights.map(() => 0);

    const exactQuotas = weights.map(w => total * (w / totalWeight));
    const floors = exactQuotas.map(q => Math.floor(q));
    const remainders = exactQuotas.map((q, i) => q - floors[i]);
    const sumFloors = floors.reduce((sum, f) => sum + f, 0);
    const diff = total - sumFloors;

    const indexedRemainders = remainders.map((r, i) => ({ index: i, remainder: r }));
    indexedRemainders.sort((a, b) => b.remainder - a.remainder);

    const extra = weights.map(() => 0);
    for (let k = 0; k < diff; k++) {
      if (k < indexedRemainders.length) {
        extra[indexedRemainders[k].index] = 1;
      }
    }

    return weights.map((_, i) => floors[i] + extra[i]);
  };

  // Memoized simulated data recalculation
  const simulatedData = useMemo(() => {
    if (!data || simConsultants.length === 0) return null;

    const totalLeads = simTotalLeads;
    const N = simConsultants.length;

    const weights = simConsultants.map(c => c.simulatedOnShift ? (1.0 / Math.max(1, c.simulatedRatio)) : 0);
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);

    let simulatedCounts: number[] = [];

    if (totalWeight === 0) {
      simulatedCounts = simConsultants.map(() => 0);
    } else {
      simulatedCounts = distributeProportionally(totalLeads, weights);
    }

    const rawCounts = simulatedCounts;
    const normalizedCounts = simConsultants.map((c, i) => {
      const ratio = Math.max(1, c.simulatedRatio);
      return rawCounts[i] * ratio;
    });

    const sumSimulatedLeads = rawCounts.reduce((a, b) => a + b, 0);
    const mean = N > 0 ? sumSimulatedLeads / N : 0;

    let sumSqDiff = 0;
    for (let i = 0; i < N; i++) {
      sumSqDiff += Math.pow(rawCounts[i] - mean, 2);
    }
    const standardDeviation = N > 0 ? Math.sqrt(sumSqDiff / N) : 0;

    let giniRaw = 0;
    if (sumSimulatedLeads > 0 && N > 0) {
      let doubleSumDiffRaw = 0;
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          doubleSumDiffRaw += Math.abs(rawCounts[i] - rawCounts[j]);
        }
      }
      giniRaw = doubleSumDiffRaw / (2 * N * sumSimulatedLeads);
    }

    let giniNormalized = 0;
    const sumNorm = normalizedCounts.reduce((a, b) => a + b, 0);
    if (sumNorm > 0 && N > 0) {
      let doubleSumDiffNorm = 0;
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          doubleSumDiffNorm += Math.abs(normalizedCounts[i] - normalizedCounts[j]);
        }
      }
      giniNormalized = doubleSumDiffNorm / (2 * N * sumNorm);
    }

    const fairnessIndex = (1 - giniNormalized) * 100;

    const consultants = simConsultants.map((c, i) => {
      const simSources: any = {};
      const actualCount = c.assigned_count;
      const simCount = rawCounts[i];

      const sourceWeights = data.sources.map((src: string) => {
        if (actualCount > 0) {
          return c.sources[src] || 0;
        } else {
          return 1;
        }
      });

      const distributedSources = distributeProportionally(simCount, sourceWeights);

      data.sources.forEach((src: string, sIdx: number) => {
        simSources[src] = distributedSources[sIdx];
      });

      return {
        ...c,
        assigned_count: simCount,
        sources: simSources,
      };
    });

    return {
      totalLeads: Math.round(totalLeads),
      totalConsultants: N,
      mean: Math.round(mean * 100) / 100,
      standardDeviation: Math.round(standardDeviation * 100) / 100,
      giniRaw: Math.round(giniRaw * 10000) / 10000,
      giniNormalized: Math.round(giniNormalized * 10000) / 10000,
      fairnessIndex: Math.round(fairnessIndex * 10) / 10,
      sources: data.sources,
      consultants,
    };
  }, [data, simConsultants, simTotalLeads]);

  // Fetch Rounds for the dropdown filter
  const fetchRounds = async () => {
    try {
      const res = await fetchAPI('get_rounds');
      if (res.success) {
        const roundsData = res.data || [];
        setRounds(roundsData);
        
        // Auto-select the first round if no round_id is currently selected/passed
        const roundIdParam = searchParams.get('round_id');
        if (!roundIdParam && roundsData.length > 0) {
          setRoundFilter(String(roundsData[0].id));
        } else if (roundsData.length === 0) {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    } catch (e) {
      console.error('Error fetching rounds:', e);
      setLoading(false);
    }
  };

  const fetchStats = async (signal?: AbortSignal) => {
    if (!roundFilter) return; // Guard to prevent fetching before round filter is initialized
    setLoading(true);
    try {
      const url = `get_fair_share_stats&date=${encodeURIComponent(dateFilter)}&round_id=${roundFilter}`;
      const res = await fetchAPI(url);
      if (signal?.aborted) return;

      if (res.success) {
        setData(res.data);
      } else {
        toast.error(res.message || t('Lỗi tải dữ liệu đối soát'));
      }
    } catch (e) {
      console.error('Error fetching fair share stats:', e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRounds();
  }, []);

  useEffect(() => {
    const roundIdParam = searchParams.get('round_id');
    if (roundIdParam !== null) {
      setRoundFilter(roundIdParam);
    }
  }, [searchParams]);

  useEffect(() => {
    const openCompId = searchParams.get('open_comp_id');
    const dateMode = searchParams.get('date_mode');
    if (openCompId) {
      let resolvedDateFilter = dateFilter;
      if (dateMode) {
        switch (dateMode) {
          case 'today': resolvedDateFilter = 'Hôm nay'; break;
          case 'yesterday': resolvedDateFilter = 'Hôm qua'; break;
          case '7_days': resolvedDateFilter = '7 ngày qua'; break;
          case '30_days': resolvedDateFilter = '30 ngày qua'; break;
          case 'this_month': resolvedDateFilter = 'Tháng này'; break;
          case 'last_month': resolvedDateFilter = 'Tháng trước'; break;
        }
        setDateFilter(resolvedDateFilter);
      }
      handleOpenDetailsModal(Number(openCompId), resolvedDateFilter);
    }
  }, [searchParams]);

  useEffect(() => {
    const abortController = new AbortController();
    fetchStats(abortController.signal);
    return () => abortController.abort();
  }, [dateFilter, roundFilter]);

  const handleCustomDateSubmit = () => {
    if (!startDate || !endDate) return toast.error(t("Vui lòng chọn đầy đủ Từ ngày và Đến ngày"));
    if (new Date(startDate) > new Date(endDate)) return toast.error(t("Từ ngày không được lớn hơn Đến ngày"));

    const label = `${startDate} ${t('đến')} ${endDate}`;
    setDateFilter(label);
    setShowDateModal(false);
  };

  const getDisplayDateFilterText = (filter: string) => {
    if (filter.includes('đến')) {
      return filter.replace(/\s*đến\s*/i, ` ${t('đến')} `);
    }
    return t(filter);
  };

  const getFairnessLevel = (index: number) => {
    if (index >= 90) return { label: t('Rất công bằng'), color: '#10b981', bg: 'rgba(16, 185, 129, 0.08)', desc: t('Thuật toán đang phân phối data cực kỳ đồng đều.') };
    if (index >= 75) return { label: t('Bình thường'), color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.08)', desc: t('Có sự chênh lệch nhẹ (thường do tỷ lệ thiết lập hoặc Sale tạm vắng).') };
    return { label: t('Cần điều chỉnh'), color: '#ef4444', bg: 'rgba(239, 68, 68, 0.08)', desc: t('Độ lệch phân phối cao. Vui lòng rà soát lại cấu hình lượt và ca làm việc.') };
  };

  const dateOptions = [
    { value: 'Hôm nay', label: t('Hôm nay') },
    { value: 'Hôm qua', label: t('Hôm qua') },
    { value: 'Tuần này', label: t('Tuần này') },
    { value: 'Tuần trước', label: t('Tuần trước') },
    { value: 'Tuần trước nữa', label: t('Tuần trước nữa') },
    { value: '7 ngày qua', label: t('7 ngày qua') },
    { value: '30 ngày qua', label: t('30 ngày qua') },
    { value: 'Tháng này', label: t('Tháng này') },
    { value: 'Tháng trước', label: t('Tháng trước') }
  ];

  const defaultFilters = ['Hôm nay', 'Hôm qua', 'Tuần này', 'Tuần trước', 'Tuần trước nữa', '7 ngày qua', '30 ngày qua', 'Tháng này', 'Tháng trước', 'Tùy chỉnh'];
  if (!defaultFilters.includes(dateFilter)) {
    dateOptions.push({ value: dateFilter, label: getDisplayDateFilterText(dateFilter) });
  }
  dateOptions.push({ value: 'Tùy chỉnh', label: t('Tùy chỉnh...') });

  const roundOptions = rounds.map(r => ({ value: String(r.id), label: r.round_name }));

  const activeData = isSimulating ? simulatedData : data;

  // Calculate weights and total weight for activeData (used for exact target share calculation)
  const activeWeights = useMemo(() => {
    if (!activeData || !activeData.consultants) return { weights: [], totalWeight: 0 };
    const weights = activeData.consultants.map((con: any) => {
      const conRatio = isSimulating
        ? (simConsultants.find(sc => sc.id === con.id)?.simulatedRatio ?? con.receive_ratio)
        : con.receive_ratio;
      const conOnShift = isSimulating
        ? (simConsultants.find(sc => sc.id === con.id)?.simulatedOnShift ?? (con.receive_ratio > 0))
        : (con.receive_ratio > 0);
      return conOnShift ? (1.0 / Math.max(1, conRatio)) : 0;
    });
    const totalWeight = weights.reduce((sum: number, w: number) => sum + w, 0);
    return { weights, totalWeight };
  }, [activeData, isSimulating, simConsultants]);

  const handleCopyReport = () => {
    const targetData = isSimulating ? simulatedData : data;
    if (!targetData || !targetData.consultants || targetData.consultants.length === 0) {
      toast.error(t("Không có dữ liệu đối soát để sao chép!"));
      return;
    }

    const roundName = roundFilter
      ? (rounds.find(r => String(r.id) === roundFilter)?.round_name || t('Vòng cụ thể'))
      : t('Tất cả các Vòng');

    let text = `📊 ${t('BÁO CÁO ĐỐI SOÁT ĐỘ CÔNG BẰNG PHÂN PHỐI')} ${isSimulating ? t('(GIẢ LẬP)') : t('(THỰC TẾ)')}\n`;
    text += `Round: ${roundName} | ${t('Thời gian')}: ${t(dateFilter)}\n`;
    text += `--------------------------------------------------\n`;
    text += `📈 ${t('CHỈ SỐ HỆ THỐNG')}:\n`;
    text += `- ${t('Chỉ số Công bằng (Fairness Index)')}: ${targetData.fairnessIndex}%\n`;
    text += `- ${t('Độ lệch chuẩn (SD)')}: ±${targetData.standardDeviation} ${t('lead')}\n`;
    text += `- ${t('Số lead trung bình')}: ${targetData.mean} ${t('lead / Sale')}\n`;
    text += `- ${t('Tổng lead thành công')}: ${targetData.totalLeads} ${t('lead')} / ${targetData.totalConsultants} ${t('Saleperson')}\n\n`;

    text += `👥 ${t('CHI TIẾT TỪNG TƯ VẤN VIÊN')}:\n`;

    targetData.consultants.forEach((c: any, index: number) => {
      const currentRatio = isSimulating
        ? (simConsultants.find(sc => sc.id === c.id)?.simulatedRatio ?? c.receive_ratio)
        : c.receive_ratio;
      const onShift = isSimulating
        ? (simConsultants.find(sc => sc.id === c.id)?.simulatedOnShift ?? (c.receive_ratio > 0))
        : (c.receive_ratio > 0);

      const targetShare = activeWeights.totalWeight > 0 ? (targetData.totalLeads * activeWeights.weights[index] / activeWeights.totalWeight) : 0;
      const diff = c.assigned_count - targetShare;
      const diffPercent = targetShare > 0 ? (diff / targetShare) * 100 : 0;
      const roundedDiff = Math.round(diff);

      let devText = '';
      if (!onShift) {
        devText = t('(Nghỉ ca)');
      } else if (roundedDiff > 0) {
        devText = `(${t('Lệch thừa')}: +${roundedDiff} ${t('lead')}, +${diffPercent.toFixed(0)}%)`;
      } else if (roundedDiff < 0) {
        devText = `(${t('Lệch thiếu')}: ${roundedDiff} ${t('lead')}, ${diffPercent.toFixed(0)}%)`;
      } else {
        devText = `(${t('Cân bằng')})`;
      }

      text += `${index + 1}. ${c.name}: ${Math.round(c.assigned_count)} ${t('lead')} (Ratio: ${currentRatio}) - ${devText}\n`;
    });

    text += `--------------------------------------------------\n`;
    text += `💡 ${t('KHUYẾN NGHỊ')}:\n`;
    if (targetData.fairnessIndex >= 90) {
      text += `- ${t('Phân phối cực kỳ công bằng. Cấu hình ratio đang hoạt động tối ưu.')}\n`;
    } else if (targetData.fairnessIndex >= 75) {
      text += `- ${t('Có sự chênh lệch nhẹ. Thường do tỷ lệ thiết lập hoặc Sale tạm vắng ca.')}\n`;
    } else {
      text += `- ${t('Độ lệch phân phối cao. Vui lòng rà soát lại ca trực và cấu hình ratio của từng Sale.')}\n`;
    }

    setCopyReportText(text);
    setShowCopyModal(true);
  };

  const handleExecuteCopy = () => {
    navigator.clipboard.writeText(copyReportText)
      .then(() => {
        toast.success(t("Đã sao chép báo cáo đối soát nhanh!"));
        setShowCopyModal(false);
      })
      .catch(err => {
        console.error('Lỗi khi sao chép báo cáo:', err);
        toast.error(t("Không thể tự động sao chép. Vui lòng thử lại."));
      });
  };

  const handleOpenDetailsModal = async (consultantId: number, overrideDateFilter?: string) => {
    setShowDetailsModal(true);
    setDetailsLoading(true);
    setCompensationDetails(null);
    try {
      const activeDateFilter = overrideDateFilter || dateFilter;
      const url = `get_consultant_compensation_details&consultant_id=${consultantId}&date=${encodeURIComponent(activeDateFilter)}&round_id=${roundFilter}`;
      const res = await fetchAPI(url);
      if (res.success) {
        setCompensationDetails(res.data);
      } else {
        toast.error(res.message || t('Lỗi khi tải chi tiết đối soát bù'));
        setShowDetailsModal(false);
      }
    } catch (e) {
      console.error('Error fetching consultant compensation details:', e);
      toast.error(t('Lỗi kết nối khi tải chi tiết đối soát bù'));
      setShowDetailsModal(false);
    } finally {
      setDetailsLoading(false);
    }
  };

  // Formatting chart data for Data Source Balance
  const sourceChartData = activeData?.consultants ? activeData.consultants.map((c: any) => {
    const item: any = { name: c.name };
    activeData.sources.forEach((src: string) => {
      item[src] = isSimulating ? Math.round(c.sources[src] || 0) : (c.sources[src] || 0);
    });
    return item;
  }) : [];

  // Formatting chart data for Lead Quality (Assigned vs Duplicate vs Faulty Approved)
  const qualityChartData = activeData?.consultants ? activeData.consultants.map((c: any) => ({
    name: c.name,
    [t('Data bàn giao')]: Math.round(c.assigned_count),
    [t('Ticket')]: c.total_ticket_count,
    [t('Duyệt Ticket')]: c.ticket_count
  })) : [];

  // Comparison chart data for simulation
  const simulationChartData = data?.consultants ? data.consultants.map((c: any) => {
    const simC = simulatedData?.consultants?.find((sc: any) => sc.id === c.id);
    return {
      name: c.name,
      [t('Thực tế')]: c.assigned_count,
      [t('Giả lập')]: simC ? Math.round(simC.assigned_count) : 0
    };
  }) : [];

  const sourceColors = ['#6366f1', '#10b981', '#fbbf24', '#f43f5e', '#a855f7', '#06b6d4'];

  // Custom legend renderer for balanced charts - Styled exactly like Tỷ lệ Nguồn Data
  const renderCustomLegend = (props: any) => {
    const { payload } = props;
    if (!payload) return null;
    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
        gap: '6px 12px',
        width: '100%',
        marginTop: '12px',
        padding: '0 24px',
        fontSize: '0.75rem',
        color: 'var(--color-text-light)'
      }}>
        {payload.map((entry: any, index: number) => {
          let color = entry.color;
          if (entry.value === t('Data bàn giao')) color = 'var(--color-primary)';
          else if (entry.value === t('Ticket')) color = '#fbbf24';
          else if (entry.value === t('Duyệt Ticket')) color = '#10b981';
          else if (entry.value === t('Thực tế')) color = 'var(--color-text-muted)';
          else if (entry.value === t('Giả lập')) color = 'var(--color-primary)';
          else {
            const sIdx = activeData?.sources?.indexOf(entry.value);
            if (sIdx !== undefined && sIdx !== -1) {
              color = sourceColors[sIdx % sourceColors.length];
            }
          }
          return (
            <div
              key={index}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}
              title={entry.value}
            >
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, color: 'var(--color-text)' }}>
                {entry.value}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  // Custom visual components for Recharts tooltips
  const CustomChartTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: 'rgba(15, 23, 42, 0.95)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '12px 16px',
          borderRadius: '12px',
          boxShadow: '0 12px 24px rgba(0,0,0,0.25)',
          color: '#f8fafc'
        }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'white', marginBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 6 }}>
            {label}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {payload.map((p: any, idx: number) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, fontSize: '0.75rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color || p.fill }} />
                  {p.name}
                </span>
                <span style={{ fontWeight: 800, color: 'white' }}>{Math.round(p.value)} {t('lead')}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  // Automated smart insights calculation based on Fairness Gini Index & Deviations
  const renderSmartInsights = () => {
    if (!data || !data.consultants || data.consultants.length === 0) return null;

    const targetData = isSimulating ? simulatedData : data;
    if (!targetData) return null;

    const fairness = targetData.fairnessIndex || 0;

    // If simulating and fairness is good, render a success feedback card
    if (isSimulating && fairness >= 75) {
      return (
        <div style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.04) 0%, rgba(16, 185, 129, 0.08) 100%)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          borderLeft: '4px solid #10b981',
          borderRadius: '12px',
          padding: '1.25rem',
          marginBottom: '1.5rem',
          display: 'flex',
          gap: '12px',
          alignItems: 'flex-start'
        }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: 8, borderRadius: '50%', color: '#10b981', flexShrink: 0 }}>
            <CheckCircle size={18} />
          </div>
          <div>
            <h4 style={{ fontWeight: 800, fontSize: '0.875rem', color: '#065f46', margin: 0, marginBottom: 4 }}>
              {t("Cấu Hình Giả Lập Đạt Độ Công Bằng Tốt ({fairness}%)").replace('{fairness}', String(fairness))}
            </h4>
            <p style={{ fontSize: '0.8125rem', color: '#047857', margin: 0, lineHeight: 1.6 }}>
              {t("Với các thiết lập ratio và ca trực đang giả lập, hệ thống phân phối dự kiến sẽ rất cân bằng.")}
            </p>
          </div>
        </div>
      );
    }

    // If not simulating and fairness is good, do not render
    if (!isSimulating && fairness >= 75) return null;

    // Find highest surplus and highest deficit based on active simulation/actual data
    let maxSurplus = 0;
    let maxSurplusSale: any = null;
    let maxDeficit = 0;
    let maxDeficitSale: any = null;

    targetData.consultants.forEach((c: any, index: number) => {
      const targetShare = activeWeights.totalWeight > 0 ? (targetData.totalLeads * activeWeights.weights[index] / activeWeights.totalWeight) : 0;
      const diff = c.assigned_count - targetShare;
      const diffPercent = targetShare > 0 ? (diff / targetShare) * 100 : 0;

      if (diff > maxSurplus) {
        maxSurplus = diff;
        maxSurplusSale = { ...c, diff, diffPercent };
      }
      if (diff < maxDeficit) {
        maxDeficit = diff;
        maxDeficitSale = { ...c, diff, diffPercent };
      }
    });

    const title = isSimulating
      ? t("Khuyến Nghị Cấu Hình Giả Lập: Độ lệch phân phối vẫn còn cao ({fairness}%)").replace('{fairness}', String(fairness))
      : t("Khuyến Nghị Cần Điều Chỉnh: Phát hiện độ lệch phân phối cao thực tế ({fairness}%)").replace('{fairness}', String(fairness));

    const bgColor = 'linear-gradient(135deg, rgba(239, 68, 68, 0.04) 0%, rgba(239, 68, 68, 0.08) 100%)';
    const borderColor = 'rgba(239, 68, 68, 0.2)';
    const borderLeftColor = '#ef4444';
    const iconColor = '#ef4444';
    const titleColor = '#991b1b';
    const descColor = '#b91c1c';

    return (
      <div style={{
        background: bgColor,
        border: `1px solid ${borderColor}`,
        borderLeft: `4px solid ${borderLeftColor}`,
        borderRadius: '12px',
        padding: '1.25rem',
        marginBottom: '1.5rem',
        display: 'flex',
        gap: '12px',
        alignItems: 'flex-start'
      }}>
        <div style={{ background: `${iconColor}15`, padding: 8, borderRadius: '50%', color: iconColor, flexShrink: 0 }}>
          <AlertTriangle size={18} />
        </div>
        <div>
          <h4 style={{ fontWeight: 800, fontSize: '0.875rem', color: titleColor, marginBottom: 4 }}>
            {title}
          </h4>
          <div style={{ fontSize: '0.8125rem', color: descColor, lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div>
              {maxSurplusSale && (
                <span>
                  • {t("Tư vấn viên")} <strong>{maxSurplusSale.name}</strong> {t("dự kiến nhận vượt chỉ tiêu")} <strong>+{Math.round(maxSurplusSale.diff)} {t('lead')}</strong> (+{maxSurplusSale.diffPercent.toFixed(0)}%).
                </span>
              )}
              {maxDeficitSale && (
                <span style={{ marginLeft: maxDeficitSale ? '12px' : 0 }}>
                  • <strong>{maxDeficitSale.name}</strong> {t("dự kiến nhận thiếu chỉ tiêu")} <strong>{Math.round(maxDeficitSale.diff)} {t('lead')}</strong> ({maxDeficitSale.diffPercent.toFixed(0)}%).
                </span>
              )}
            </div>
            <p style={{ margin: 0, opacity: 0.9 }}>
              <strong>{t("Gợi ý xử lý:")}</strong> {t("Cân nhắc điều chỉnh lại Ratio của")} <strong>{maxSurplusSale?.name}</strong> {t("giảm xuống hoặc tăng của")} <strong>{maxDeficitSale?.name}</strong> {t("lên thêm nữa để kéo lệch chuẩn về mức tối ưu.")}
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ animation: 'slideUp 0.3s ease-out', position: 'relative' }} className="fade-in-view">
      {/* Background loading bar */}
      {loading && activeData && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'var(--color-primary-light)', zIndex: 9999, overflow: 'hidden' }}>
          <div style={{ width: '30%', height: '100%', background: 'var(--color-primary)', borderRadius: 'inherit', animation: 'loadingBar 1.5s infinite ease-in-out' }} />
        </div>
      )}
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ fontSize: '1.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Scale size={28} color="var(--color-primary)" /> {t("Đối Soát Độ Công Bằng Phân Phối")}
          </h1>
          <p className="page-subtitle">{t("Kiểm tra toán học & đo lường độ lệch chuẩn, chỉ số Gini để đảm bảo data được chia công bằng.")}</p>
        </div>
        <div className="mobile-w-full" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="mobile-flex-1" style={{ position: 'relative', zIndex: 100, width: 180 }}>
            <CustomSelect
              options={roundOptions}
              value={roundFilter}
              onChange={(val) => setRoundFilter(String(val))}
              width="100%"
            />
          </div>
          <div className="mobile-flex-1" style={{ position: 'relative', zIndex: 100, width: 150 }}>
            <CustomSelect
              options={dateOptions}
              value={dateFilter}
              onChange={(val) => {
                if (val === 'Tùy chỉnh') {
                  setShowDateModal(true);
                  return;
                }
                setDateFilter(String(val));
              }}
              width="100%"
            />
          </div>
          <button
            className={`btn ${isSimulating ? 'primary' : 'outline'}`}
            onClick={() => {
              if (!isSimulating && (!data?.consultants || data.consultants.length === 0)) {
                toast.error(t("Không có dữ liệu tư vấn viên để chạy giả lập"));
                return;
              }
              setIsSimulating(!isSimulating);
            }}
            style={{
              height: 40,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: isSimulating ? 'var(--color-primary)' : 'transparent',
              color: isSimulating ? 'white' : 'var(--color-primary)',
              boxShadow: isSimulating ? 'var(--shadow-primary)' : 'none',
            }}
            title={t("Bật/Tắt Bộ giả lập phân bổ Live")}
          >
            <Settings size={16} className={isSimulating ? 'spin' : ''} />
            <span>{isSimulating ? t('Tắt Giả lập') : t('Giả Lập Live')}</span>
          </button>
          <button
            className="btn outline"
            onClick={handleCopyReport}
            title={t("Sao chép nhanh báo cáo đối soát dạng văn bản")}
            style={{ width: 40, height: 40, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            <Copy size={16} />
          </button>
          <button
            className="btn outline"
            onClick={() => setShowInfoModal(true)}
            title={t("Giải thích chỉ số")}
            style={{ width: 40, height: 40, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            <Info size={16} />
          </button>
        </div>
      </div>

      {/* Live Simulation Control Panel */}
      {isSimulating && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.06) 0%, rgba(124, 58, 237, 0.1) 100%)',
          border: '1px solid var(--color-primary)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.25rem 1.5rem',
          marginBottom: '1.5rem',
          boxShadow: 'var(--shadow-md)',
          animation: 'slideDown 0.3s ease-out'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ background: 'var(--color-primary)', color: 'white', padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Sparkles size={18} />
              </div>
              <div>
                <h4 style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--color-text)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {t("BỘ GIẢ LẬP PHÂN BỔ LIVE")} <span style={{ fontSize: '0.65rem', padding: '2px 6px', background: 'var(--color-success)', color: 'white', borderRadius: 4, fontWeight: 700, letterSpacing: '0.05em' }}>ACTIVE</span>
                </h4>
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', margin: '2px 0 0 0' }}>
                  {t("Thay đổi tần suất nhận hoặc bật/tắt ca trực của từng Sale ở bảng chi tiết bên dưới để thấy các chỉ số tái tính toán ngay lập tức.")}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '2px 8px', height: '32px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)' }}>{t("Tổng Lead:")}</span>
                <button
                  type="button"
                  onClick={() => setSimTotalLeads(prev => Math.max(0, prev - 10))}
                  style={{ border: 'none', background: 'transparent', padding: '0 4px', fontSize: '0.68rem', fontWeight: 800, color: 'var(--color-primary)', cursor: 'pointer' }}
                  title={t("Giảm 10 lead")}
                >
                  -10
                </button>
                <button
                  type="button"
                  onClick={() => setSimTotalLeads(prev => Math.max(0, prev - 1))}
                  style={{ border: 'none', background: 'transparent', padding: '0 4px', fontSize: '0.68rem', fontWeight: 800, color: 'var(--color-primary)', cursor: 'pointer' }}
                  title={t("Giảm 1 lead")}
                >
                  -1
                </button>
                <input
                  type="number"
                  min="0"
                  value={simTotalLeads}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (!isNaN(val)) {
                      setSimTotalLeads(Math.max(0, val));
                    }
                  }}
                  style={{
                    width: '60px',
                    height: '24px',
                    textAlign: 'center',
                    fontWeight: 800,
                    fontSize: '0.8125rem',
                    border: '1px solid var(--color-border-light)',
                    borderRadius: '4px',
                    background: 'var(--color-bg)',
                    color: 'var(--color-text)',
                    padding: 0
                  }}
                />
                <button
                  type="button"
                  onClick={() => setSimTotalLeads(prev => prev + 1)}
                  style={{ border: 'none', background: 'transparent', padding: '0 4px', fontSize: '0.68rem', fontWeight: 800, color: 'var(--color-primary)', cursor: 'pointer' }}
                  title={t("Tăng 1 lead")}
                >
                  +1
                </button>
                <button
                  type="button"
                  onClick={() => setSimTotalLeads(prev => prev + 10)}
                  style={{ border: 'none', background: 'transparent', padding: '0 4px', fontSize: '0.68rem', fontWeight: 800, color: 'var(--color-primary)', cursor: 'pointer' }}
                  title={t("Tăng 10 lead")}
                >
                  +10
                </button>
              </div>

              <button
                className="btn sm secondary"
                onClick={handleResetSimulation}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, background: 'var(--color-surface)' }}
              >
                <RotateCcw size={13} />
                {t("Đặt lại giả lập")}
              </button>

              {/* Lưu cấu hình button removed to prevent saving simulation data to actual database */}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.2)', padding: '10px 12px', borderRadius: '8px', fontSize: '0.75rem', color: 'var(--color-primary)' }}>
            <Info size={15} style={{ flexShrink: 0, marginTop: 1, color: 'var(--color-primary)' }} />
            <div>
              <span>{t("Các thay đổi về Ratio nhận và ca trực ở đây chỉ phục vụ mục đích giả lập trực quan để đối soát độ lệch chuẩn & Gini, không ảnh hưởng đến cấu hình thực tế của hệ thống.")}</span>
            </div>
          </div>

          {/* Quick Start Guide Section */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px dashed rgba(99, 102, 241, 0.2)' }}>
            <div>
              <h5 style={{ fontWeight: 800, fontSize: '0.8125rem', color: 'var(--color-primary)', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ display: 'inline-flex', width: 18, height: 18, borderRadius: '50%', background: 'var(--color-primary)', color: 'white', fontSize: '0.7rem', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>1</span>
                {t("HƯỚNG DẪN CÁCH GIẢ LẬP")}
              </h5>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.75rem', color: 'var(--color-text)', lineHeight: 1.6 }}>
                <li><strong>{t("Bước A:")}</strong> {t("Cuộn xuống")} <strong>{t("Bảng Thống Kê Chi Tiết")}</strong> {t("ở dưới cùng trang.")}</li>
                <li><strong>{t("Bước B:")}</strong> {t("Click vào thẻ avatar/tên của Sale để giả định Sale đó")} <strong>{t("Trực ca")}</strong> {t("(chấm xanh) hoặc")} <strong>{t("Nghỉ ca")}</strong> {t("(chấm đỏ).")}</li>
                <li><strong>{t("Bước C:")}</strong> {t("Kéo thanh trượt hoặc nhập số")} <strong>Ratio</strong> {t("của từng Sale để thay đổi lượt nhận lead (Ratio càng lớn thì nhận càng ít lead).")}</li>
                <li><strong>{t("Kết quả:")}</strong> {t("Các con số lead, biểu đồ và chỉ số công bằng phía trên sẽ tự động tính toán lại ngay lập tức.")}</li>
              </ul>
            </div>
            <div>
              <h5 style={{ fontWeight: 800, fontSize: '0.8125rem', color: 'var(--color-primary)', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ display: 'inline-flex', width: 18, height: 18, borderRadius: '50%', background: 'var(--color-primary)', color: 'white', fontSize: '0.7rem', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>2</span>
                {t("NGUYÊN LÝ VÒNG CHIA (ROUND-ROBIN)")}
              </h5>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text)', lineHeight: 1.6 }}>
                <p style={{ margin: '0 0 6px 0' }}>
                  • <strong>{t("Phân chia theo vòng:")}</strong> {t("Hệ thống chia lead tuần tự từ TVV này sang TVV kia. \"Ratio: X\" nghĩa là TVV nhận 1 lead rồi nghỉ (X - 1) lượt chia tiếp theo.")}
                </p>
                <p style={{ margin: 0 }}>
                  • <strong>{t("Trực ca & Thuần túy toán học:")}</strong> {t("Chỉ TVV đang trực mới có mặt trong hàng đợi chia. Quá trình chia hoàn toàn deterministic (xác thực và có thể dự đoán), không có yếu tố ngẫu nhiên hay \"may mắn\".")}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Intro explain card styled identically to RuleSettings */}
      <div className="hide-on-mobile" style={{
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(99, 102, 241, 0.1) 100%)',
        border: '1px solid var(--color-primary-light)', borderLeft: '4px solid var(--color-primary)',
        borderRadius: 'var(--radius-lg)', padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1.5rem'
      }}>
        <div style={{
          background: 'var(--color-card, #fff)',
          width: 40, height: 40, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: '50%', boxShadow: 'var(--shadow-sm)', color: 'var(--color-primary)'
        }}>
          <Sparkles size={20} />
        </div>
        <div>
          <h4 style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-primary)', marginBottom: 4 }}>
            {t("Báo cáo Đối soát Công bằng hoạt động thế nào?")}
          </h4>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text)', lineHeight: 1.6 }}>
            {t("Hệ thống áp dụng công thức")} <strong>{t("Hệ số bất bình đẳng Gini")}</strong> {t("và")} <strong>{t("Độ lệch chuẩn")}</strong> {t("thực tế của lượng data bàn giao cho Sale. Chỉ số Công bằng được tính toán bằng cách chuẩn hóa lượng data nhận được chia cho Tỷ lệ (Receive Ratio) thiết lập của từng Sale. Giúp bạn ngay lập tức phát hiện xem có sự bất bình đẳng ngoài ý muốn do lỗi phân phối hoặc Sale offline kéo dài hay không.")}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        {loading && !activeData ? (
          Array.from({ length: 4 }).map((_, i) => <KpiCardSkeleton key={i} />)
        ) : (
          <>
            {/* Fairness Index Card */}
            {(() => {
              const level = getFairnessLevel(activeData?.fairnessIndex || 0);
              return (
                <div className="stat-card hover-lift" style={{ minHeight: '135px', display: 'flex', flexDirection: 'column', borderLeft: `4px solid ${level.color}`, position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: '-10px', right: '-10px', width: 60, height: 60, borderRadius: '50%', background: `radial-gradient(circle, ${level.color}10 0%, transparent 70%)` }} />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', zIndex: 1 }}>
                    <span className="stat-label" style={{ fontWeight: 800 }}>{t("CHỈ SỐ CÔNG BẰNG")}</span>
                    <Scale size={18} style={{ color: level.color }} />
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', zIndex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span className="stat-value" style={{ fontWeight: 800, color: 'var(--color-text)', fontSize: '2rem', letterSpacing: '-0.02em', margin: 0 }}>{activeData?.fairnessIndex}%</span>
                      {isSimulating && data && (
                        <span style={{
                          fontSize: '0.68rem',
                          padding: '2px 8px',
                          borderRadius: 20,
                          background: activeData.fairnessIndex >= data.fairnessIndex ? 'var(--color-success-light)' : 'var(--color-danger-light)',
                          color: activeData.fairnessIndex >= data.fairnessIndex ? 'var(--color-success)' : 'var(--color-danger)',
                          fontWeight: 700,
                          border: `1px solid ${activeData.fairnessIndex >= data.fairnessIndex ? 'var(--color-success)' : 'var(--color-danger)'}20`
                        }}>
                          {activeData.fairnessIndex >= data.fairnessIndex ? '+' : ''}{(activeData.fairnessIndex - data.fairnessIndex).toFixed(1)}% {t("vs Thật")}
                        </span>
                      )}
                      <span style={{ fontSize: '0.68rem', padding: '3px 8px', borderRadius: 20, background: level.bg, color: level.color, fontWeight: 700, border: `1px solid ${level.color}20` }}>
                        {level.label}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 'auto', lineHeight: 1.4 }}>
                      {level.desc}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Standard Deviation Card */}
            <div className="stat-card hover-lift" style={{ minHeight: '135px', display: 'flex', flexDirection: 'column', position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span className="stat-label" style={{ fontWeight: 800 }}>{t("ĐỘ LỆCH CHUẨN (SD)")}</span>
                <AlertTriangle size={18} color="#fbbf24" />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span className="stat-value" style={{ fontWeight: 800, color: 'var(--color-text)', fontSize: '2rem', letterSpacing: '-0.02em', margin: 0 }}>± {activeData?.standardDeviation || 0}</span>
                  {isSimulating && data && (
                    <span style={{
                      fontSize: '0.68rem',
                      padding: '2px 8px',
                      borderRadius: 20,
                      background: activeData.standardDeviation <= data.standardDeviation ? 'var(--color-success-light)' : 'var(--color-danger-light)',
                      color: activeData.standardDeviation <= data.standardDeviation ? 'var(--color-success)' : 'var(--color-danger)',
                      fontWeight: 700,
                      border: `1px solid ${activeData.standardDeviation <= data.standardDeviation ? 'var(--color-success)' : 'var(--color-danger)'}20`
                    }}>
                      {activeData.standardDeviation <= data.standardDeviation ? '' : '+'}{(activeData.standardDeviation - data.standardDeviation).toFixed(2)} {t("vs Thật")}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 'auto', lineHeight: 1.4 }}>
                  {t("Chỉ số đo lường mức độ phân tán của số lượng lead. SD càng nhỏ có nghĩa là lượng data được chia càng đồng đều giữa các Sale.")}
                </div>
              </div>
            </div>

            {/* Average lead count card */}
            <div className="stat-card hover-lift" style={{ minHeight: '135px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span className="stat-label" style={{ fontWeight: 800 }}>{t("SỐ LEAD TRUNG BÌNH")}</span>
                <TrendingUp size={18} color="var(--color-primary)" />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span className="stat-value" style={{ fontWeight: 800, color: 'var(--color-text)', fontSize: '2rem', letterSpacing: '-0.02em', margin: 0 }}>{activeData?.mean || 0}</span>
                  {isSimulating && data && (
                    <span style={{
                      fontSize: '0.68rem',
                      padding: '2px 8px',
                      borderRadius: 20,
                      background: 'var(--color-info-light)',
                      color: 'var(--color-info)',
                      fontWeight: 700,
                      border: '1px solid var(--color-info)20'
                    }}>
                      {activeData.mean >= data.mean ? '+' : ''}{(activeData.mean - data.mean).toFixed(2)} {t("vs Thật")}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 'auto', lineHeight: 1.4 }}>
                  {t("Số lượng lead trung bình được nhận bởi một Tư vấn viên trong vòng và khoảng thời gian đã chọn.")}
                </div>
              </div>
            </div>

            {/* Total Audited Leads */}
            <div className="stat-card hover-lift" style={{ minHeight: '135px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span className="stat-label" style={{ fontWeight: 800 }}>{t("TỔNG LEAD / SALEPERSONS")}</span>
                <Users size={18} color="#3b82f6" />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div className="stat-value" style={{ fontWeight: 800, color: 'var(--color-text)', fontSize: '2rem', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span>{Math.round(activeData?.totalLeads || 0)} <span style={{ fontSize: '1rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>/ {activeData?.totalConsultants || 0} {t("Saleperson")}</span></span>
                  {isSimulating && (
                    <span style={{ fontSize: '0.65rem', padding: '3px 8px', borderRadius: 20, background: 'var(--color-primary-light)', color: 'var(--color-primary)', fontWeight: 700, border: '1px solid var(--color-primary)20', letterSpacing: '0.05em' }}>
                      {t("GIẢ LẬP")}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 'auto', lineHeight: 1.4 }}>
                  {t("Phạm vi kiểm toán gồm {count} Tư vấn viên đang hoạt động với tổng số {leads} lead thành công.").replace('{count}', String(activeData?.totalConsultants || 0)).replace('{leads}', String(Math.round(activeData?.totalLeads || 0)))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Smart Auto-Tuning Insights Block */}
      {!loading && data && renderSmartInsights()}

      {/* Main Charts area */}
      {!isSimulating && (
        <div className="responsive-grid-1-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>

          {/* Data Source Balance Chart */}
          <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div style={{ marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-text)' }}>{t("Phân Bổ Cân Bằng Theo Nguồn")}</h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-light)', marginTop: '4px' }}>
                {t("Đảm bảo các Sale nhận số lượng lead chất lượng (FB Ads, Google) đồng đều, tránh dồn nguồn kém chất lượng cho một người.")}
              </p>
            </div>
            <div style={{ flex: 1, minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {loading && !activeData ? (
                <Skeleton width="100%" height={300} borderRadius={16} />
              ) : sourceChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={sourceChartData} margin={{ top: 10, right: 10, left: -25, bottom: 5 }} barGap={5}>
                    <defs>
                      {sourceColors.map((color, idx) => (
                        <linearGradient key={`grad-src-${idx}`} id={`srcGrad-${idx}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={color} stopOpacity={0.95} />
                          <stop offset="100%" stopColor={color} stopOpacity={0.7} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" horizontal={true} vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--color-text)', fontWeight: 600 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomChartTooltip />} cursor={{ fill: 'var(--color-border-light)', opacity: 0.3 }} />
                    <Legend content={renderCustomLegend} />
                    {activeData?.sources && activeData.sources.map((src: string, index: number) => (
                      <Bar
                        key={src}
                        dataKey={src}
                        stackId="a"
                        fill={`url(#srcGrad-${index})`}
                        radius={index === activeData.sources.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                        barSize={32}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>{t("Chưa có dữ liệu thống kê nguồn")}</div>
              )}
            </div>
          </div>

          {/* Dynamic Simulation Chart / Lead Quality Chart */}
          {isSimulating ? (
            <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <div style={{ marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Sparkles size={16} color="var(--color-primary)" /> {t("So Sánh Lead Thực Tế vs. Giả Lập")}
                </h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-light)', marginTop: '4px' }}>
                  {t("So sánh trực quan sự phân bổ lại số lượng lead của từng Sale sau khi thay đổi thiết lập.")}
                </p>
              </div>
              <div style={{ flex: 1, minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {simulationChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={simulationChartData} margin={{ top: 10, right: 10, left: -25, bottom: 5 }} barGap={6}>
                      <defs>
                        <linearGradient id="actualLeadsGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--color-text-muted)" stopOpacity={0.6} />
                          <stop offset="100%" stopColor="var(--color-text-muted)" stopOpacity={0.3} />
                        </linearGradient>
                        <linearGradient id="simulatedLeadsGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.95} />
                          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.65} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" horizontal={true} vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--color-text)', fontWeight: 600 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomChartTooltip />} cursor={{ fill: 'var(--color-border-light)', opacity: 0.3 }} />
                      <Legend content={renderCustomLegend} />
                      <Bar dataKey={t("Thực tế")} fill="url(#actualLeadsGrad)" radius={[4, 4, 0, 0]} barSize={16} />
                      <Bar dataKey={t("Giả lập")} fill="url(#simulatedLeadsGrad)" radius={[4, 4, 0, 0]} barSize={16} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>{t("Chưa có dữ liệu so sánh")}</div>
                )}
              </div>
            </div>
          ) : (
            /* Quality breakdown bar chart */
            <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <div style={{ marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-text)' }}>{t("Chất Lượng Lead Nhận Được")}</h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-light)', marginTop: '4px' }}>
                  {t("Đối soát giữa tỷ lệ lead thật (bàn giao), lead bị trùng lặp, và số data báo lỗi đã được duyệt đền bù của từng Sale.")}
                </p>
              </div>
              <div style={{ flex: 1, minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {loading && !data ? (
                  <Skeleton width="100%" height={300} borderRadius={16} />
                ) : qualityChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={qualityChartData} margin={{ top: 10, right: 10, left: -25, bottom: 5 }} barGap={6}>
                      <defs>
                        <linearGradient id="assignedGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.95} />
                          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.65} />
                        </linearGradient>
                        <linearGradient id="duplicateGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.95} />
                          <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.65} />
                        </linearGradient>
                        <linearGradient id="ticketGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity={0.95} />
                          <stop offset="100%" stopColor="#059669" stopOpacity={0.65} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" horizontal={true} vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--color-text)', fontWeight: 600 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomChartTooltip />} cursor={{ fill: 'var(--color-border-light)', opacity: 0.3 }} />
                      <Legend content={renderCustomLegend} />
                      <Bar dataKey={t("Data bàn giao")} fill="url(#assignedGrad)" radius={[4, 4, 0, 0]} barSize={16} />
                      <Bar dataKey={t("Ticket")} fill="url(#duplicateGrad)" radius={[4, 4, 0, 0]} barSize={16} />
                      <Bar dataKey={t("Duyệt Ticket")} fill="url(#ticketGrad)" radius={[4, 4, 0, 0]} barSize={16} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>{t("Chưa có dữ liệu đối soát chất lượng")}</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detail Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '2rem', border: '1px solid var(--color-border)', position: 'relative' }}>
        {isSimulating && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'var(--color-primary)', zIndex: 5, animation: 'pulse 2s infinite' }} />
        )}
        <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--color-border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
              {t("Bảng Thống Kê Độ Lệch Chi Tiết")} {isSimulating && <span style={{ fontSize: '0.7rem', padding: '2px 8px', background: 'var(--color-primary-light)', color: 'var(--color-primary)', borderRadius: '6px', fontWeight: 800 }}>{t("MÔ PHỎNG")}</span>}
            </h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-light)', marginTop: '4px' }}>
              {isSimulating
                ? t("Đang ở chế độ giả lập. Bật/tắt ca trực (checkbox) và điều chỉnh thanh trượt (slider) của từng Sale để xem kết quả.")
                : t("Chi tiết từng Sale trong vòng được audit: Tỷ lệ (Ratio) cài đặt, số lead nhận được, và đánh giá lệch so với trung bình hệ thống.")
              }
            </p>
          </div>
          <span style={{ fontSize: '0.7rem', padding: '4px 10px', borderRadius: 8, background: 'var(--color-border-light)', border: '1px solid var(--color-border)', fontWeight: 600, color: 'var(--color-text-light)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Layers size={12} /> {t("Số Sale được đo lường:")} {activeData?.consultants?.length || 0}
          </span>
        </div>

        <div className="responsive-table-wrap">
          {loading && !activeData ? (
            <div style={{ padding: '1.25rem' }}>
              <Skeleton width="100%" height={24} style={{ marginBottom: 12 }} />
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} width="100%" height={56} style={{ marginBottom: 8 }} />)}
            </div>
          ) : activeData?.consultants && activeData.consultants.length > 0 ? (
            <table style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse', textAlign: 'left' }} className="audit-premium-table">
              <thead>
                <tr style={{ background: 'var(--color-border-light)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{
                    padding: '14px 18px',
                    fontSize: '0.72rem',
                    color: 'var(--color-text-light)',
                    textTransform: 'uppercase',
                    fontWeight: 800,
                    letterSpacing: '0.04em',
                    background: isSimulating ? 'rgba(99, 102, 241, 0.06)' : 'var(--color-border-light)'
                  }}>
                    {isSimulating ? t("Trực ca / Tư vấn viên (Nhập)") : t("Tư vấn viên")}
                  </th>
                  <th style={{ padding: '14px 18px', fontSize: '0.72rem', color: 'var(--color-text-light)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.04em' }}>{t("Vòng chia")}</th>
                  <th style={{
                    padding: '14px 18px',
                    fontSize: '0.72rem',
                    color: 'var(--color-text-light)',
                    textTransform: 'uppercase',
                    fontWeight: 800,
                    letterSpacing: '0.04em',
                    textAlign: 'center',
                    width: isSimulating ? '180px' : 'auto',
                    background: isSimulating ? 'rgba(99, 102, 241, 0.06)' : 'var(--color-border-light)'
                  }}>
                    Ratio {isSimulating && t("(Nhập)")}
                  </th>
                  <th style={{ padding: '14px 18px', fontSize: '0.72rem', color: 'var(--color-text-light)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.04em', textAlign: 'center' }}>{t("Lead Nhận")}</th>
                  <th style={{ padding: '14px 18px', fontSize: '0.72rem', color: 'var(--color-text-light)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.04em' }}>{t("Phân bổ theo Nguồn")}</th>
                  <th style={{ padding: '14px 18px', fontSize: '0.72rem', color: 'var(--color-text-light)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.04em', textAlign: 'center' }}>{t("Duyệt Ticket")}</th>
                  <th style={{ padding: '14px 18px', fontSize: '0.72rem', color: 'var(--color-text-light)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.04em', textAlign: 'center' }}>{t("Data bù")}</th>
                  <th style={{ padding: '14px 18px', fontSize: '0.72rem', color: 'var(--color-text-light)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.04em', textAlign: 'right' }}>{t("Độ Lệch")}</th>
                </tr>
              </thead>
              <tbody>
                {activeData.consultants.map((c: any, index: number) => {
                  const baselineC = data?.consultants?.find((bc: any) => bc.id === c.id);
                  const simC = simConsultants.find((sc: any) => sc.id === c.id) || c;

                  // Calculate deviation from weight-based expected share
                  const targetShare = activeWeights.totalWeight > 0 ? (activeData.totalLeads * activeWeights.weights[index] / activeWeights.totalWeight) : 0;
                  const diff = c.assigned_count - targetShare;
                  const diffPercent = targetShare > 0 ? (diff / targetShare) * 100 : 0;

                  // Styling based on deviation
                  let deviationClass = 'deviation-balanced';
                  let deviationLabel = t('Cân bằng');

                  if (!isSimulating || simC.simulatedOnShift) {
                    const roundedDiff = Math.round(diff);
                    if (roundedDiff > 0) {
                      deviationClass = 'deviation-surplus';
                      deviationLabel = `+${roundedDiff} ${t('lead')} (+${diffPercent.toFixed(0)}%)`;
                    } else if (roundedDiff < 0) {
                      deviationClass = 'deviation-deficit';
                      deviationLabel = `${roundedDiff} ${t('lead')} (${diffPercent.toFixed(0)}%)`;
                    }
                  } else {
                    deviationLabel = t('Nghỉ ca');
                  }

                  return (
                    <tr
                      key={c.id}
                      style={{
                        borderBottom: '1px solid var(--color-border-light)',
                        transition: 'all 0.25s ease',
                        background: isSimulating ? 'rgba(99, 102, 241, 0.01)' : 'transparent',
                        cursor: !isSimulating ? 'pointer' : 'default'
                      }}
                      className="audit-table-row"
                      onClick={() => {
                        if (!isSimulating) {
                          handleOpenDetailsModal(c.id);
                        }
                      }}
                    >
                      <td style={{
                        padding: '14px 18px',
                        borderLeft: isSimulating ? '3px solid var(--color-primary)' : 'none',
                        background: isSimulating ? 'rgba(99, 102, 241, 0.02)' : 'transparent'
                      }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            cursor: isSimulating ? 'pointer' : 'default',
                            userSelect: 'none'
                          }}
                          onClick={() => {
                            if (isSimulating) {
                              handleToggleSimShift(c.id);
                            }
                          }}
                          title={isSimulating ? (simC.simulatedOnShift ? t("Đang trực ca (Click để chuyển sang Nghỉ ca)") : t("Nghỉ trực ca (Click để chuyển sang Trực ca)")) : ""}
                        >
                          <div style={{ position: 'relative', opacity: (!isSimulating || simC.simulatedOnShift) ? 1 : 0.4 }}>
                            <Avatar src={c.avatar} name={c.name} size={36} />
                            <span style={{ position: 'absolute', bottom: -2, right: -2, width: 12, height: 12, borderRadius: '50%', background: (!isSimulating || simC.simulatedOnShift) ? '#10b981' : '#ef4444', border: '2px solid var(--color-surface)', display: 'block' }} />
                          </div>
                          <div style={{ opacity: (!isSimulating || simC.simulatedOnShift) ? 1 : 0.5 }}>
                            <span style={{ fontWeight: 700, color: 'var(--color-text)', display: 'block', fontSize: '0.875rem' }}>{c.name}</span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                              ID: {c.id} {isSimulating && !simC.simulatedOnShift && `(${t("Nghỉ")})`}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text)', background: 'var(--color-bg)', padding: '4px 10px', borderRadius: 8, border: '1px solid var(--color-border)', display: 'inline-block' }}>
                          {c.round_name}
                        </span>
                      </td>
                      <td style={{
                        padding: '14px 18px',
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        background: isSimulating ? 'rgba(99, 102, 241, 0.04)' : 'transparent'
                      }}>
                        {isSimulating ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: '100%' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <input
                                type="range"
                                min="1"
                                max="10"
                                step="1"
                                value={simC.simulatedRatio}
                                disabled={!simC.simulatedOnShift}
                                onChange={(e) => handleUpdateSimRatio(c.id, parseInt(e.target.value))}
                                style={{ width: '80px', accentColor: 'var(--color-primary)', cursor: simC.simulatedOnShift ? 'pointer' : 'not-allowed', opacity: simC.simulatedOnShift ? 1 : 0.3 }}
                              />
                              <input
                                type="number"
                                min="1"
                                max="10"
                                value={simC.simulatedRatio}
                                disabled={!simC.simulatedOnShift}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value);
                                  if (!isNaN(val)) {
                                    handleUpdateSimRatio(c.id, Math.min(10, Math.max(1, val)));
                                  }
                                }}
                                style={{
                                  width: '48px',
                                  padding: '2px 4px',
                                  fontSize: '0.75rem',
                                  fontWeight: 800,
                                  textAlign: 'center',
                                  border: '1px solid var(--color-border)',
                                  borderRadius: '6px',
                                  background: 'var(--color-surface)',
                                  color: 'var(--color-text)',
                                  opacity: simC.simulatedOnShift ? 1 : 0.3
                                }}
                              />
                            </div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: simC.simulatedOnShift ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>
                              Ratio: {simC.simulatedRatio} {baselineC && baselineC.receive_ratio !== simC.simulatedRatio && (
                                <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                                  ({t("gốc")}: Ratio: {baselineC.receive_ratio})
                                </span>
                              )}
                            </span>
                          </div>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '6px 12px', borderRadius: 20, background: 'rgba(99, 102, 241, 0.06)', border: '1px dashed rgba(99, 102, 241, 0.3)', fontWeight: 800, color: 'var(--color-primary)', fontSize: '0.8125rem' }}>
                            Ratio: {c.receive_ratio}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '14px 18px', textAlign: 'center', fontWeight: 900, fontSize: '1.05rem', color: 'var(--color-text)' }}>
                        {isSimulating && baselineC ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <span style={{ color: 'var(--color-primary)', fontSize: '1.05rem' }}>{Math.round(c.assigned_count)}</span>
                            <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                              ({t("thực tế")}: {baselineC.assigned_count})
                            </span>
                          </div>
                        ) : (
                          c.assigned_count
                        )}
                      </td>
                      <td style={{ padding: '14px 18px', width: '260px', verticalAlign: 'middle' }}>
                        {c.assigned_count > 0 ? (
                          <div className="source-bar-container" style={{ position: 'relative', width: '100%', padding: '6px 0' }}>
                            <div style={{ display: 'flex', width: '100%', height: '8px', borderRadius: '4px', overflow: 'hidden', backgroundColor: 'var(--color-border-light)' }}>
                              {activeData.sources.map((src: string, sIdx: number) => {
                                const val = c.sources[src] || 0;
                                if (val === 0) return null;
                                const pct = (val / c.assigned_count) * 100;
                                const color = sourceColors[sIdx % sourceColors.length];
                                return (
                                  <div
                                    key={src}
                                    style={{
                                      width: `${pct}%`,
                                      height: '100%',
                                      backgroundColor: color,
                                      transition: 'width 0.3s ease'
                                    }}
                                  />
                                );
                              })}
                            </div>
                            <div className="source-tooltip">
                              <div style={{ fontWeight: 700, fontSize: '0.75rem', marginBottom: '6px', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '4px', color: 'var(--color-text)' }}>
                                {t("Phân bổ nguồn ({name})").replace('{name}', c.name)}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                {activeData.sources.map((src: string, sIdx: number) => {
                                  const val = c.sources[src] || 0;
                                  if (val === 0) return null;
                                  const pct = (val / c.assigned_count) * 100;
                                  const color = sourceColors[sIdx % sourceColors.length];
                                  return (
                                    <div key={src} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', fontSize: '0.7rem' }}>
                                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text-light)' }}>
                                        <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: color }} />
                                        {src}
                                      </span>
                                      <span style={{ fontWeight: 800, color: 'var(--color-text)' }}>
                                        {Math.round(val * 10) / 10} <span style={{ fontWeight: 500, opacity: 0.7, fontSize: '0.65rem' }}>({pct.toFixed(0)}%)</span>
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', opacity: 0.6 }}>-</span>
                        )}
                      </td>
                      <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                        {c.ticket_count > 0 ? (
                          <span style={{ color: '#10b981', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.875rem', background: 'rgba(16, 185, 129, 0.08)', padding: '2px 8px', borderRadius: 6, border: '1px solid rgba(16, 185, 129, 0.15)' }}>
                            <CheckCircle size={12} /> {c.ticket_count}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', opacity: 0.6 }}>-</span>
                        )}
                      </td>
                      <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                        {c.compensation_count > 0 ? (
                          <span style={{ color: '#6366f1', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.875rem', background: 'rgba(99, 102, 241, 0.08)', padding: '2px 8px', borderRadius: 6, border: '1px solid rgba(99, 102, 241, 0.15)' }}>
                            <RotateCcw size={12} /> {c.compensation_count}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', opacity: 0.6 }}>-</span>
                        )}
                      </td>
                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <span className={`deviation-badge ${deviationClass}`}>
                          {deviationLabel}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div style={{ textAlign: 'center', padding: '3.5rem', color: 'var(--color-text-muted)' }}>
              <CheckCircle size={36} style={{ marginBottom: 12, opacity: 0.5 }} />
              <p style={{ fontSize: '0.875rem', fontWeight: 600 }}>{t("Không tìm thấy dữ liệu phân phối phù hợp trong khoảng thời gian đã chọn.")}</p>
            </div>
          )}
        </div>
      </div>

      {/* Custom Date Modal (from Dashboard.tsx) */}
      <CustomModal
        isOpen={showDateModal}
        onClose={() => setShowDateModal(false)}
        title={t("Tùy chỉnh thời gian")}
        width="400px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem 0' }}>
          <div>
            <label className="form-label">{t("Từ ngày")}</label>
            <input
              type="date"
              className="form-input"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label className="form-label">{t("Đến ngày")}</label>
            <input
              type="date"
              className="form-input"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <button className="btn outline" onClick={() => setShowDateModal(false)}>{t("Hủy")}</button>
            <button className="btn primary" onClick={handleCustomDateSubmit}>{t("Áp dụng")}</button>
          </div>
        </div>
      </CustomModal>

      {/* Copy Report Preview Modal */}
      <CustomModal
        isOpen={showCopyModal}
        onClose={() => setShowCopyModal(false)}
        title={t("Xem trước báo cáo đối soát nhanh")}
        width="550px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-light)', margin: 0 }}>
            {t("Xem trước nội dung báo cáo. Bạn có thể sao chép văn bản này để gửi nhanh qua các nhóm chat.")}
          </p>
          <textarea
            readOnly
            value={copyReportText}
            style={{
              width: '100%',
              height: '300px',
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid var(--color-border)',
              background: 'var(--color-border-light)',
              color: 'var(--color-text)',
              resize: 'none',
              lineHeight: '1.5'
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button className="btn outline" onClick={() => setShowCopyModal(false)}>{t("Hủy")}</button>
            <button className="btn primary" onClick={handleExecuteCopy}>{t("Sao chép")}</button>
          </div>
        </div>
      </CustomModal>

      {/* Info Terminology Modal */}
      <CustomModal
        isOpen={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        title={t("Giải thích thuật ngữ & Công thức tính toán")}
        width="550px"
        showCloseIcon={false}
      >
        <div style={{ padding: '0.5rem 0', display: 'flex', flexDirection: 'column', gap: '1.25rem', maxHeight: '70vh', overflowY: 'auto' }} className="custom-scrollbar">
          <div>
            <h4 style={{ fontWeight: 800, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.9rem' }}>
              <Scale size={16} color="var(--color-primary)" /> {t("Chỉ số công bằng (Fairness Index)")}
            </h4>
            <p style={{ fontSize: '0.78rem', color: 'var(--color-text-light)', marginTop: 6, lineHeight: 1.5 }}>
              {t("Được tính toán dựa trên")} <strong>{t("Hệ số Gini (Gini Coefficient)")}</strong> {t("đã được chuẩn hóa theo Tỷ lệ nhận lead (Receive Ratio) cài đặt của từng TVV.")}
              {t("Công thức:")} <code>Fairness Index = (1 - Gini) * 100%</code>.
              {t("Chỉ số đạt 100% tương đương với mức công bằng hoàn hảo (mọi Sale đều nhận được lượng lead tỷ lệ thuận tuyệt đối với cài đặt của họ).")}
            </p>
          </div>

          <hr style={{ border: 0, borderTop: '1px solid var(--color-border-light)' }} />

          <div>
            <h4 style={{ fontWeight: 800, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.9rem' }}>
              <AlertTriangle size={16} color="#fbbf24" /> {t("Độ lệch chuẩn (Standard Deviation - SD)")}
            </h4>
            <p style={{ fontSize: '0.78rem', color: 'var(--color-text-light)', marginTop: 6, lineHeight: 1.5 }}>
              {t("Biểu thị mức độ phân tán của số lượng lead được chia xung quanh giá trị trung bình.")}
              {t("Nếu SD = 0, tất cả các Sale nhận được số lượng lead hoàn toàn bằng nhau. SD càng nhỏ, thuật toán chia lead càng ít xảy ra sai số.")}
            </p>
          </div>

          <hr style={{ border: 0, borderTop: '1px solid var(--color-border-light)' }} />

          <div>
            <h4 style={{ fontWeight: 800, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.9rem' }}>
              <BarChart2 size={16} color="#3b82f6" /> {t("Chuẩn hóa tỷ lệ phân bổ (Normalized Share)")}
            </h4>
            <p style={{ fontSize: '0.78rem', color: 'var(--color-text-light)', marginTop: 6, lineHeight: 1.5 }}>
              {t("Khi một vòng phân bổ thiết lập tỷ lệ chia cho Sale A là x2 và Sale B là x1, thì việc Sale A nhận được số lead gấp đôi Sale B là hoàn toàn công bằng.")}
              {t("Thuật toán đối soát công bằng sẽ tự động chia số lead của từng Sale cho Ratio của họ trước khi chạy tính toán Gini để đảm bảo độ chính xác tuyệt đối.")}
            </p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button className="btn primary" onClick={() => setShowInfoModal(false)}>{t("Đóng")}</button>
          </div>
        </div>
      </CustomModal>

      {/* Compensation Details Modal */}
      <CustomModal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        title={t("Đối Soát Chi Tiết Data Bù")}
        width="600px"
      >
        {detailsLoading ? (
          <div style={{ padding: '2rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <div className="spin" style={{ width: '32px', height: '32px', border: '3px solid var(--color-border)', borderTopColor: 'var(--color-primary)', borderRadius: '50%' }} />
            <span style={{ fontSize: '0.875rem', color: 'var(--color-text-light)' }}>{t("Đang tải dữ liệu đối soát...")}</span>
          </div>
        ) : compensationDetails ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.5rem 0' }}>

            {/* Consultant Profile Summary */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--color-border-light)', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
              <Avatar src={compensationDetails.avatar} name={compensationDetails.name} size={48} />
              <div>
                <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>
                  {compensationDetails.name}
                </h4>
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', margin: '2px 0 0 0' }}>
                  ID: {compensationDetails.consultant_id} • {t("Thời gian")}: <span style={{ fontWeight: 600 }}>{t(dateFilter)}</span>
                </p>
              </div>
            </div>

            {/* Core Stats Overview */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ background: 'rgba(99, 102, 241, 0.04)', border: '1px solid rgba(99, 102, 241, 0.15)', borderRadius: '12px', padding: '12px 16px', textAlign: 'center' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-light)', display: 'block', textTransform: 'uppercase', marginBottom: '4px' }}>{t("Tổng Data Đã Chia")}</span>
                <span style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-primary)' }}>{compensationDetails.total_assigned}</span>
              </div>
              <div style={{ background: 'rgba(16, 185, 129, 0.04)', border: '1px solid rgba(16, 185, 129, 0.15)', borderRadius: '12px', padding: '12px 16px', textAlign: 'center' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-light)', display: 'block', textTransform: 'uppercase', marginBottom: '4px' }}>{t("Data Bù Đã Nhận")}</span>
                <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#10b981' }}>{compensationDetails.total_compensation_received}</span>
              </div>
            </div>

            {/* Compensation Breakdown Header */}
            <div>
              <h5 style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 10px 0', borderBottom: '1px dashed var(--color-border)', paddingBottom: '6px' }}>
                {t("Thống Kê Chi Tiết Nguồn Bù")}
              </h5>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* Tickets Approved */}
                <div style={{ padding: '10px 14px', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div 
                    onClick={() => toggleSection('ticket')}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                        <CheckCircle size={14} />
                      </span>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)' }}>{t("Bù do duyệt ticket lỗi")}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--color-text)' }}>+{compensationDetails.breakdown.ticket} {t("lead")}</span>
                      {compensationDetails.breakdown.ticket_details && compensationDetails.breakdown.ticket_details.length > 0 && (
                        expandedSections.ticket ? <ChevronUp size={14} style={{ color: 'var(--color-text-muted)' }} /> : <ChevronDown size={14} style={{ color: 'var(--color-text-muted)' }} />
                      )}
                    </div>
                  </div>

                  {expandedSections.ticket && compensationDetails.breakdown.ticket_details && compensationDetails.breakdown.ticket_details.length > 0 && (
                    <div style={{ 
                      borderTop: '1px dashed var(--color-border-light)', 
                      marginTop: '4px', 
                      paddingTop: '8px', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '8px', 
                      paddingLeft: '32px',
                      maxHeight: '150px',
                      overflowY: 'auto',
                      paddingRight: '4px'
                    }}>
                      {compensationDetails.breakdown.ticket_details.map((tkt: any, idx: number) => {
                        const dateStr = new Date(tkt.created_at).toLocaleDateString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                        return (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--color-text-light)', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Avatar src={tkt.admin_avatar} name={tkt.admin_name} size={16} />
                              <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{tkt.admin_name}</span>
                              <span style={{ color: 'var(--color-text-muted)' }}>({tkt.reason ? t(tkt.reason) : ''})</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>{dateStr}</span>
                              <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>+1 {t("lead")}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Blacklist block */}
                <div style={{ padding: '10px 14px', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div 
                    onClick={() => toggleSection('blacklist')}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                        <AlertTriangle size={14} />
                      </span>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)' }}>{t("Bù do blacklist chặn")}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--color-text)' }}>+{compensationDetails.breakdown.blacklist} {t("lead")}</span>
                      {compensationDetails.breakdown.blacklist_details && compensationDetails.breakdown.blacklist_details.length > 0 && (
                        expandedSections.blacklist ? <ChevronUp size={14} style={{ color: 'var(--color-text-muted)' }} /> : <ChevronDown size={14} style={{ color: 'var(--color-text-muted)' }} />
                      )}
                    </div>
                  </div>

                  {expandedSections.blacklist && compensationDetails.breakdown.blacklist_details && compensationDetails.breakdown.blacklist_details.length > 0 && (
                    <div style={{ 
                      borderTop: '1px dashed var(--color-border-light)', 
                      marginTop: '4px', 
                      paddingTop: '8px', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '8px', 
                      paddingLeft: '32px',
                      maxHeight: '150px',
                      overflowY: 'auto',
                      paddingRight: '4px'
                    }}>
                      {compensationDetails.breakdown.blacklist_details.map((bl: any, idx: number) => {
                        const dateStr = new Date(bl.created_at).toLocaleDateString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                        return (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--color-text-light)', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Avatar src={bl.admin_avatar} name={bl.admin_name} size={16} />
                              <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{bl.admin_name}</span>
                              <span style={{ color: 'var(--color-text-muted)' }}>({bl.reason ? t(bl.reason) : ''})</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>{dateStr}</span>
                              <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>+1 {t("lead")}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Reassignments */}
                <div style={{ padding: '10px 14px', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div 
                    onClick={() => toggleSection('reassign')}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
                        <Layers size={14} />
                      </span>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)' }}>{t("Bù do thu hồi / chuyển lead")}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--color-text)' }}>+{compensationDetails.breakdown.reassign} {t("lead")}</span>
                      {compensationDetails.breakdown.reassign_details && compensationDetails.breakdown.reassign_details.length > 0 && (
                        expandedSections.reassign ? <ChevronUp size={14} style={{ color: 'var(--color-text-muted)' }} /> : <ChevronDown size={14} style={{ color: 'var(--color-text-muted)' }} />
                      )}
                    </div>
                  </div>

                  {expandedSections.reassign && compensationDetails.breakdown.reassign_details && compensationDetails.breakdown.reassign_details.length > 0 && (
                    <div style={{ 
                      borderTop: '1px dashed var(--color-border-light)', 
                      marginTop: '4px', 
                      paddingTop: '8px', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '8px', 
                      paddingLeft: '32px',
                      maxHeight: '150px',
                      overflowY: 'auto',
                      paddingRight: '4px'
                    }}>
                      {compensationDetails.breakdown.reassign_details.map((re: any, idx: number) => {
                        const dateStr = new Date(re.created_at).toLocaleDateString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                        return (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--color-text-light)', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Avatar src={re.admin_avatar} name={re.admin_name} size={16} />
                              <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{re.admin_name}</span>
                              <span style={{ color: 'var(--color-text-muted)' }}>({re.reason ? t(re.reason) : ''})</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>{dateStr}</span>
                              <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>+1 {t("lead")}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Manual/Active Compensations */}
                <div style={{ padding: '10px 14px', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div 
                    onClick={() => toggleSection('active')}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--color-primary)' }}>
                        <RotateCcw size={14} />
                      </span>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)' }}>{t("Bù chủ động ")}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--color-text)' }}>+{compensationDetails.breakdown.active_total} {t("lead")}</span>
                      {compensationDetails.breakdown.active_details && compensationDetails.breakdown.active_details.length > 0 && (
                        expandedSections.active ? <ChevronUp size={14} style={{ color: 'var(--color-text-muted)' }} /> : <ChevronDown size={14} style={{ color: 'var(--color-text-muted)' }} />
                      )}
                    </div>
                  </div>

                  {/* Active details reasons sub-list */}
                  {expandedSections.active && compensationDetails.breakdown.active_details && compensationDetails.breakdown.active_details.length > 0 && (
                    <div style={{ 
                      borderTop: '1px dashed var(--color-border-light)', 
                      marginTop: '4px', 
                      paddingTop: '8px', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '8px', 
                      paddingLeft: '32px',
                      maxHeight: '150px',
                      overflowY: 'auto',
                      paddingRight: '4px'
                    }}>
                      {compensationDetails.breakdown.active_details.map((act: any, idx: number) => {
                        const dateStr = new Date(act.created_at).toLocaleDateString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                        return (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--color-text-light)', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Avatar src={act.admin_avatar} name={act.admin_name} size={16} />
                              <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{act.admin_name}</span>
                              <span style={{ color: 'var(--color-text-muted)' }}>({act.reason ? t(act.reason) : ''})</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>{dateStr}</span>
                              <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>+{act.count} {t("lead")}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button className="btn primary" onClick={() => setShowDetailsModal(false)}>{t("Đóng")}</button>
            </div>
          </div>
        ) : (
          <div style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--color-text-light)' }}>
            {t("Không tải được chi tiết đối soát.")}
          </div>
        )}
      </CustomModal>

      <style>{`
        /* Table Styles */
        .audit-premium-table th {
          background: var(--color-border-light) !important;
          color: var(--color-text-light) !important;
          border-bottom: 1px solid var(--color-border) !important;
        }
        .audit-table-row:hover {
          background-color: rgba(99, 102, 241, 0.03) !important;
          transform: translateX(4px);
        }
        [data-theme="dark"] .audit-table-row:hover {
          background-color: rgba(99, 102, 241, 0.06) !important;
        }
        
        /* Deviation Badges */
        .deviation-badge {
          font-size: 0.75rem;
          font-weight: 700;
          padding: 4px 12px;
          border-radius: 20px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .deviation-balanced {
          background: rgba(16, 185, 129, 0.08);
          color: #10b981;
          border: 1px solid rgba(16, 185, 129, 0.2);
        }
        .deviation-surplus {
          background: rgba(59, 130, 246, 0.08);
          color: #3b82f6;
          border: 1px solid rgba(59, 130, 246, 0.2);
        }
        .deviation-deficit {
          background: rgba(244, 63, 94, 0.08);
          color: #f43f5e;
          border: 1px solid rgba(244, 63, 94, 0.2);
        }
        
        /* Source Bar Container and Tooltip for clutter-free table */
        .source-bar-container {
          cursor: pointer;
        }
        .source-tooltip {
          position: absolute;
          bottom: 100%;
          left: 50%;
          transform: translateX(-50%) translateY(-8px);
          background: var(--color-surface, #fff);
          border: 1px solid var(--color-border);
          box-shadow: var(--shadow-lg);
          border-radius: 8px;
          padding: 8px 12px;
          z-index: 100;
          width: 220px;
          visibility: hidden;
          opacity: 0;
          transition: all 0.2s ease;
          pointer-events: none;
        }
        .source-bar-container:hover .source-tooltip {
          visibility: visible;
          opacity: 1;
          transform: translateX(-50%) translateY(-4px);
        }
        .source-tooltip::after {
          content: '';
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          border-width: 6px;
          border-style: solid;
          border-color: var(--color-surface, #fff) transparent transparent transparent;
        }
      `}</style>
    </div>
  );
};
