import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { Send, X, Database, Sparkles, LayoutGrid, Search, ChevronRight, RefreshCw, ChevronLeft, FileText } from 'lucide-react';
import { fetchAPI } from '../../utils/api';

interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: Date;
}

export const AIChatbot: React.FC = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const getGreetingText = (userName?: string) => {
    const name = userName ? ` ${userName}` : '';
    const hour = new Date().getHours();
    let timeStr = 'Chào buổi sáng';
    if (hour >= 12 && hour < 18) timeStr = 'Chào buổi chiều';
    else if (hour >= 18) timeStr = 'Chào buổi tối';

    const greetings = [
      `${timeStr}${name}! 🌟 Tôi là Trợ lý AI Rich Land. Hôm nay tôi có thể hỗ trợ gì cho bạn về dữ liệu, hệ thống CRM hay cấu hình Zalo/Telegram?`,
      `Xin chào${name}! 👋 Rất vui được đồng hành cùng bạn. Bạn cần tra cứu chỉ số data hôm nay, kiểm tra ticket hay giải đáp thắc mắc nghiệp vụ nào không?`,
      `${timeStr}${name}! ✨ Tôi đã sẵn sàng hỗ trợ. Hãy đặt câu hỏi về quy tắc chia số, blacklist, báo cáo hoặc thông tin dự án nhé!`
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  };

  const getEntityWelcomeMessage = (entity: { name: string; type: 'project' | 'campaign' }, docCount: number) => {
    const docInfo = docCount > 0 ? ` (đã tìm thấy **${docCount} tài liệu** đính kèm)` : '';
    if (entity.type === 'project') {
      return `🏢 **Tôi đã nạp dữ liệu cho Dự án ${entity.name}!**${docInfo}\n\nBạn có thể hỏi tôi về vị trí, tiến độ, pháp lý, chủ đầu tư hoặc chọn **Tài liệu cụ thể** ở menu bên trên để tôi trả lời chính xác nhất nhé!`;
    } else {
      return `🎯 **Tôi đã sẵn sàng giải đáp về Chiến dịch ${entity.name}!**${docInfo}\n\nHãy đặt câu hỏi về ngân sách, mục tiêu, thời gian chạy hoặc tài liệu thuộc chiến dịch này!`;
    }
  };

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: getGreetingText(user?.name),
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [stats, setStats] = useState<any>(null);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Chat modes: 'general' (chat thường), 'project_campaign' (chat chọn dự án/chiến dịch)
  const [chatMode, setChatMode] = useState<'general' | 'project_campaign'>('project_campaign');
  const [projectsList, setProjectsList] = useState<any[]>([]);
  const [campaignsList, setCampaignsList] = useState<any[]>([]);
  const [loadingEntities, setLoadingEntities] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntity, setSelectedEntity] = useState<any | null>(null);
  const [entityContext, setEntityContext] = useState<string>('');
  const [loadingContext, setLoadingContext] = useState(false);
  const [entityDocs, setEntityDocs] = useState<any[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<number | 'all'>('all');
  const [rawDetails, setRawDetails] = useState<any>(null);
  const [parentProj, setParentProj] = useState<any>(null);
  const [showDocSelectModal, setShowDocSelectModal] = useState(false);
  const [docSearchQuery, setDocSearchQuery] = useState('');

  const loadEntities = async () => {
    setLoadingEntities(true);
    try {
      const [projRes, campRes] = await Promise.all([
        fetchAPI('projects').catch(() => null),
        fetchAPI('campaigns').catch(() => null)
      ]);
      const projs = Array.isArray(projRes) ? projRes : (projRes?.data || []);
      const camps = Array.isArray(campRes) ? campRes : (campRes?.data || []);
      setProjectsList(projs);
      setCampaignsList(camps);
    } catch (err) {
      console.error("Lỗi khi tải danh sách dự án/chiến dịch:", err);
    } finally {
      setLoadingEntities(false);
    }
  };

  useEffect(() => {
    if (chatMode === 'project_campaign' && projectsList.length === 0 && campaignsList.length === 0) {
      loadEntities();
    }
  }, [chatMode]);

  const formatProjectContext = (proj: any, docs: any[]) => {
    if (!proj) return '';
    let refUrls: any[] = [];
    if (proj.reference_url) {
      try {
        const parsed = JSON.parse(proj.reference_url);
        refUrls = Array.isArray(parsed) ? parsed : [{ title: 'Website / Link tham khảo', url: proj.reference_url }];
      } catch (e) {
        refUrls = [{ title: 'Website / Link tham khảo', url: proj.reference_url }];
      }
    }
    let folderPaths: any[] = [];
    if (proj.folder_path) {
      try {
        const parsed = JSON.parse(proj.folder_path);
        folderPaths = Array.isArray(parsed) ? parsed : [{ type: 'link', path: proj.folder_path }];
      } catch (e) {
        folderPaths = [{ type: 'link', path: proj.folder_path }];
      }
    }
    let text = `TÊN DỰ ÁN: ${proj.name || '—'}\n`;
    text += `MÃ DỰ ÁN: ${proj.code || '—'}\n`;
    text += `MÔ TẢ: ${proj.description || '—'}\n`;
    text += `CHỦ ĐẦU TƯ: ${proj.developer || '—'}\n`;
    text += `VỊ TRÍ: ${proj.location || '—'}\n`;
    text += `TIẾN ĐỘ THI CÔNG: ${proj.construction_status || '—'}\n`;
    text += `TÌNH TRẠNG PHÁP LÝ: ${proj.legal_status || '—'}\n`;
    text += `QUY MÔ BLOCK: ${proj.scale_block_count || '—'}\n`;
    text += `QUY MÔ CĂN HỘ: ${proj.scale_unit_count || '—'}\n`;
    text += `NĂM BÀN GIAO: ${proj.handover_year || '—'}\n`;
    if (refUrls.length > 0) {
      text += `LINKS THAM KHẢO / WEBSITE:\n`;
      refUrls.forEach(link => {
        if (link.url) text += `- [${link.title || 'Link'}](${link.url})\n`;
      });
    }
    if (folderPaths.length > 0) {
      text += `ĐƯỜNG DẪN THƯ MỤC / DRIVE:\n`;
      folderPaths.forEach(f => {
        if (f.path) text += `- Thư mục ${f.type === 'link' ? 'Drive' : 'Hệ thống'}: [Link Drive/Thư mục](${f.path})\n`;
      });
    }
    if (docs.length > 0) {
      text += `DANH SÁCH TÀI LIỆU DỰ ÁN:\n`;
      docs.forEach(d => {
        const absoluteUrl = d.file_path ? (d.file_path.startsWith('http') ? d.file_path : `${window.location.origin}${d.file_path}`) : '';
        if (absoluteUrl) text += `- Tên tài liệu: ${d.name} | Loại: ${d.mime_type || '—'} | Tải về: [Tải tài liệu](${absoluteUrl})\n`;
      });
    }
    return text;
  };

  const formatCampaignContext = (camp: any, parentProj: any, docs: any[]) => {
    if (!camp) return '';
    let text = `CHIẾN DỊCH MARKETING: ${camp.name || '—'}\n`;
    text += `MÃ CHIẾN DỊCH: ${camp.code || '—'}\n`;
    text += `MÔ TẢ CHIẾN DỊCH: ${camp.description || '—'}\n`;
    text += `NGÂN SÁCH CHIẾN DỊCH: ${camp.budget ? Number(camp.budget).toLocaleString('vi-VN') + ' VND' : '—'}\n`;
    text += `NGÀY BẮT ĐẦU: ${camp.start_date || '—'}\n`;
    text += `NGÀY KẾT THÚC: ${camp.end_date || '—'}\n`;
    text += `MỤC TIÊU CHIẾN DỊCH: ${camp.target_leads ? camp.target_leads + ' Leads' : '—'}\n`;
    if (parentProj) {
      text += `\nDỰ ÁN CHA CỦA CHIẾN DỊCH:\n`;
      text += formatProjectContext(parentProj, docs);
    }
    return text;
  };

  const handleSelectDocFilter = (docId: number | 'all', docs: any[], details: any, pProj: any, entityType: 'project' | 'campaign') => {
    setSelectedDocId(docId);
    if (!details) return;

    if (docId === 'all') {
      if (entityType === 'project') {
        setEntityContext(formatProjectContext(details, docs));
      } else {
        setEntityContext(formatCampaignContext(details, pProj, docs));
      }
    } else {
      const selectedDoc = docs.find(d => Number(d.id) === Number(docId));
      if (selectedDoc) {
        let text = `=== BẠN ĐANG ĐƯỢC CHỈ ĐỊNH TẬP TRUNG HỎI VỀ TÀI LIỆU CỤ THỂ DƯỚI ĐÂY ===\n`;
        text += `TÊN TÀI LIỆU: ${selectedDoc.name || selectedDoc.file_name || 'Tài liệu đính kèm'}\n`;
        text += `LOẠI TÀI LIỆU / ĐỊNH DẠNG: ${selectedDoc.mime_type || selectedDoc.file_type || 'Tài liệu'}\n`;
        const absoluteUrl = selectedDoc.file_path ? (selectedDoc.file_path.startsWith('http') ? selectedDoc.file_path : `${window.location.origin}${selectedDoc.file_path}`) : '';
        if (absoluteUrl) text += `ĐƯỜNG DẪN TẢI FILE TRỰC TIẾP: [Xem/Tải file tài liệu](${absoluteUrl})\n`;
        if (selectedDoc.description) text += `MÔ TẢ VÀ GHI CHÚ TÀI LIỆU: ${selectedDoc.description}\n`;
        
        text += `\n=== THÔNG TIN DỰ ÁN / CHIẾN DỊCH LIÊN QUAN ===\n`;
        if (entityType === 'project') {
          text += `DỰ ÁN: ${details.name || '—'} (Mã: ${details.code || '—'})\n`;
          text += `CHỦ ĐẦU TƯ: ${details.developer || '—'} | VỊ TRÍ: ${details.location || '—'}\n`;
          text += `PHÁP LÝ & TIẾN ĐỘ: ${details.legal_status || '—'} / ${details.construction_status || '—'}\n`;
        } else {
          text += `CHIẾN DỊCH: ${details.name || '—'} (Mã: ${details.code || '—'})\n`;
          text += `MỤC TIÊU / NGÂN SÁCH: ${details.target_leads || '—'} / ${details.budget ? Number(details.budget).toLocaleString('vi-VN') + ' VND' : '—'}\n`;
          if (pProj) {
            text += `DỰ ÁN LIÊN QUAN: ${pProj.name || '—'} (Chủ đầu tư: ${pProj.developer || '—'})\n`;
          }
        }
        setEntityContext(text);
      }
    }
  };

  const handleSelectEntity = async (entity: { id: number; name: string; type: 'project' | 'campaign'; project_id?: number }) => {
    setSelectedEntity(entity);
    setLoadingContext(true);
    setEntityContext('');
    setEntityDocs([]);
    setSelectedDocId('all');
    setRawDetails(null);
    setParentProj(null);

    try {
      let contextText = '';
      let docs: any[] = [];
      let details: any = null;
      let parentProject: any = null;

      if (entity.type === 'project') {
        const detailsRes = await fetchAPI(`projects/${entity.id}`).catch(() => null);
        details = detailsRes?.data || detailsRes;
        const docsRes = await fetchAPI(`projects/${entity.id}/documents`).catch(() => null);
        docs = Array.isArray(docsRes) ? docsRes : (docsRes?.data || []);
        
        setRawDetails(details);
        setEntityDocs(docs);
        contextText = formatProjectContext(details, docs);
      } else {
        const detailsRes = await fetchAPI(`campaigns/${entity.id}`).catch(() => null);
        details = detailsRes?.data || detailsRes;
        let parentDocs: any[] = [];
        if (details && details.project_id) {
          const parentProjRes = await fetchAPI(`projects/${details.project_id}`).catch(() => null);
          parentProject = parentProjRes?.data || parentProjRes;
          const parentDocsRes = await fetchAPI(`projects/${details.project_id}/documents`).catch(() => null);
          parentDocs = Array.isArray(parentDocsRes) ? parentDocsRes : (parentDocsRes?.data || []);
        }
        docs = parentDocs;
        setRawDetails(details);
        setParentProj(parentProject);
        setEntityDocs(parentDocs);
        contextText = formatCampaignContext(details, parentProject, parentDocs);
      }
      setEntityContext(contextText);

      // Set dynamic welcome message for selected entity
      setMessages([
        {
          id: 'welcome_entity_' + Date.now(),
          sender: 'bot',
          text: getEntityWelcomeMessage(entity, docs.length),
          timestamp: new Date()
        }
      ]);
    } catch (err) {
      console.error("Lỗi khi tải ngữ cảnh dự án/chiến dịch:", err);
      setEntityContext(`Lỗi tải dữ liệu cho thực thể ${entity.name}`);
    } finally {
      setLoadingContext(false);
    }
  };

  const filteredProjects = projectsList.filter(p => 
    p.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.code?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const filteredCampaigns = campaignsList.filter(c => 
    c.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.code?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const botAvatarUrl = "/LOGO.jpg";

  // Sidebar stats card config
  const statsConfig = [
    { key: 'total_today', label: t('Tổng tiếp nhận'), color: '#BD1D2D', prompt: t('Hôm nay hệ thống nhận bao nhiêu data?') },
    { key: 'distributed_today', label: t('Đã bàn giao'), color: '#10b981', prompt: t('Hôm nay đã chia bao nhiêu data cho Sale?') },
    { key: 'duplicates', label: t('Trùng lặp'), color: '#f59e0b', prompt: t('Có bao nhiêu data trùng lặp hôm nay?') },
    { key: 'blacklists', label: t('Chặn Blacklist'), color: '#6b7280', prompt: t('Có bao nhiêu số điện thoại bị chặn blacklist hôm nay?') },
    { key: 'ticket_count', label: t('Lỗi / Ticket'), color: '#ef4444', prompt: t('Hôm nay có bao nhiêu ticket báo lỗi?') }
  ];

  // Suggested prompts
  const quickPrompts = [
    { label: t('📊 Thống kê data hôm nay'), text: t('Hôm nay hệ thống chia bao nhiêu data?') },
    { label: t('💬 Cài đặt Zalo Bot'), text: t('Zalo Bot hoạt động thế nào?') },
    { label: t('🛡️ Quản lý Blacklist'), text: t('Làm sao để cấu hình Blacklist?') },
    { label: t('🎫 Ticket báo lỗi đền bù'), text: t('Quy trình xử lý Ticket lỗi thế nào?') }
  ];

  // Fetch stats when chat opens
  useEffect(() => {
    if (isOpen) {
      fetchAPI('get_dashboard_stats')
        .then(res => {
          if (res.success && res.data) {
            setStats(res.data);
          }
        })
        .catch(err => console.error('Lỗi tải stats cho chatbot:', err));
    }
  }, [isOpen]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim()) return;

    const userMessage: Message = {
      id: 'user_' + Date.now(),
      sender: 'user',
      text: textToSend,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    try {
      const historyPayload = messages
        .slice(-10)
        .filter(msg => msg.id !== 'welcome')
        .map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'model',
          text: msg.text
        }));

      const res = await fetchAPI('ai_chat', {
        method: 'POST',
        body: JSON.stringify({
          message: textToSend,
          history: historyPayload,
          project_context: chatMode === 'project_campaign' ? entityContext : ''
        })
      });

      let botResponseText = '';
      if (res.success && res.data && res.data.reply) {
        botResponseText = res.data.reply;
      } else {
        botResponseText = generateResponse(textToSend, stats);
      }

      const botMessage: Message = {
        id: 'bot_' + Date.now(),
        sender: 'bot',
        text: botResponseText,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, botMessage]);
    } catch (err) {
      console.error('Lỗi khi gọi API AI Chat:', err);
      const botResponseText = generateResponse(textToSend, stats);
      const botMessage: Message = {
        id: 'bot_' + Date.now(),
        sender: 'bot',
        text: botResponseText,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, botMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const generateResponse = (input: string, currentStats: any): string => {
    const q = input.toLowerCase().trim();
    
    // 1. Check for statistics questions
    if (q.includes('hôm nay') || q.includes('thống kê') || q.includes('báo cáo') || q.includes('chỉ số') || q.includes('data')) {
      if (q.includes('bao nhiêu') || q.includes('mấy') || q.includes('số lượng') || q.includes('tổng') || q.includes('chia') || q.includes('trùng') || q.includes('lỗi')) {
        if (currentStats) {
          return t(`Dữ liệu thống kê hệ thống **hôm nay** như sau:

* 📥 **Tổng số tiếp nhận**: **{total}** data
* 👤 **Đã bàn giao**: **{assigned}** data
* 👥 **Trùng lặp (không chia)**: **{dup}** data
* 🚫 **Chặn Blacklist**: **{blacklist}** data
* ⚠️ **Data lỗi / Ticket**: **{ticket}** data

*Hiệu số tăng trưởng hoặc chi tiết cụ thể bạn có thể xem trực tiếp ở trang chủ (Dashboard).*`)
                         .replace('{total}', currentStats.total_today)
                         .replace('{assigned}', currentStats.distributed_today)
                         .replace('{dup}', currentStats.duplicates)
                         .replace('{blacklist}', currentStats.blacklists)
                         .replace('{ticket}', currentStats.ticket_count);
        } else {
          return t(`Tôi đang tải số liệu thống kê từ hệ thống. Bạn vui lòng đợi một chút hoặc thử lại nhé!`);
        }
      }
    }

    // 2. Blacklist questions
    if (q.includes('blacklist') || q.includes('danh sách đen') || q.includes('chặn') || q.includes('bỏ qua')) {
      return t(`Hệ thống **Blacklist (Danh sách đen)** hoạt động như sau:

1. **Tự động chặn**: Khi có lead mới vào (qua Webhook/Sheets), hệ thống sẽ check số điện thoại/email đối chiếu với Blacklist. Nếu trùng, lead sẽ bị đánh dấu là \`blacklisted\` và chặn phân bổ.
2. **Quản lý danh sách**: Admin có thể vào mục **Cài đặt -> Danh sách đen** để thêm/xóa thủ công các liên hệ hoặc tải lên file Excel chứa hàng ngàn liên hệ chặn.
3. **Hiển thị**: Dữ liệu bị chặn blacklist sẽ được cộng vào thẻ KPI lỗi ngoài Dashboard để đảm bảo khớp dữ liệu tổng.`);
    }

    // 3. Zalo Bot questions
    if (q.includes('zalo') || q.includes('bot') || q.includes('tin nhắn') || q.includes('chào buổi sáng') || q.includes('morning')) {
      return t(`Hệ thống **Zalo Bot** hỗ trợ bàn giao và chăm sóc tự động:

* **Bàn giao Lead**: Mỗi khi có lead được định tuyến cho Sale, Zalo Bot sẽ gửi ngay thông tin chi tiết (Tên, SĐT, Email, Nguồn, Ghi chú) trực tiếp đến chat ID Zalo của Sale đó.
* **Gom tin nhắn chào buổi sáng**: Nếu ngoài giờ làm việc Sale nhận được nhiều hơn 1 data chờ, khi bắt đầu giờ làm hôm sau Zalo Bot sẽ gửi một tin nhắn tổng hợp chào buổi sáng (ví dụ: *"Chúc buổi sáng vui vẻ! Đêm qua bạn có 3 data..."*), sau đó mới gửi chi tiết từng data.
* **Cài đặt**: Bạn có thể bật/tắt nhận báo cáo lỗi hoặc cấu hình Zalo chat ID của Admin/Sale tại mục **Tài khoản** hoặc **Tư vấn viên**.`);
    }

    // 4. Routing Rules / Rounds questions
    if (q.includes('quy tắc') || q.includes('chia số') || q.includes('định tuyến') || q.includes('rule') || q.includes('vòng xoay') || q.includes('round')) {
      return t(`Quy trình **Định tuyến & Chia số (Routing Rules & Rounds)**:

* **Định tuyến (Rules)**: Khi lead từ Google Sheets hoặc Landing Page đẩy về, hệ thống sẽ chạy qua các Rule có độ ưu tiên từ cao đến thấp. Mỗi rule chứa các điều kiện so khớp (VD: Nguồn chứa "Ads", Loại là "Hot"...). Nếu khớp, lead sẽ đi vào Vòng xoay (Round) tương ứng.
* **Vòng xoay (Rounds)**: Là nhóm các Sale nhận số. Hệ thống chia theo thuật toán **Round-robin** (xoay vòng) kết hợp tỉ lệ nhận (\`receive_ratio\`), đền bù (\`compensation_count\`), and chế độ nhận data mỗi lượt (\`data_per_turn\`).
* **Giờ làm việc**: Sale ngoài giờ làm sẽ bị tạm giữ lead (\`pending_work_hours\`) và được tự động giải phóng khi đến giờ làm việc ngày hôm sau.`);
    }

    // 5. General ticket / report error questions
    if (q.includes('ticket') || q.includes('báo lỗi') || q.includes('đền bù') || q.includes('lỗi dữ liệu') || q.includes('khiếu nại')) {
      return t(`Quy trình **Báo cáo lỗi & Đền bù (Ticket System)**:

1. **Gửi báo cáo**: Khi Sale nhận phải data bị lỗi (sai số, không liên lạc được, thuê bao...), Sale có thể gửi Ticket báo cáo lỗi trực tiếp từ Sale Portal.
2. **Duyệt đền bù**: Admin sẽ nhận được thông báo đỏ trên Header. Admin vào trang **Báo cáo lỗi (Tickets)** để xem xét lý do, liên hệ và duyệt đền bù (cộng thêm lượt nhận data cho Sale trong vòng xoay) hoặc từ chối đền bù.
3. **Giải quyết**: Khi duyệt, hệ thống sẽ tự động bù lượt nhận cho Sale vào lần phân bổ tiếp theo.`);
    }

    // 6. Google Sheets sync questions
    if (q.includes('sheet') || q.includes('đồng bộ') || q.includes('cron') || q.includes('kết nối') || q.includes('excel')) {
      return t(`Hệ thống **Đồng bộ Google Sheets (Sheet Connections)**:

* **Kết nối**: Admin cấu hình ID bảng tính và tên sheet tại mục **Kết nối Sheets**, sau đó ánh xạ các cột (Tên, SĐT, Email...) vào các trường của hệ thống.
* **Đồng bộ tự động**: Tiến trình nền (\`cron_sync.php\`) sẽ tự động quét qua các sheet hoạt động mỗi 2-5 phút, chỉ lấy những dòng dữ liệu mới (dựa trên thuật toán mã hóa Row Hash để không trùng lặp) và chia cho Sale.
* **Chế độ Silent (Im lặng)**: Bạn có thể chọn chế độ chỉ đồng bộ check trùng mà không chia số cho các sheet lưu trữ lịch sử.`);
    }

    // Default fallback
    return t(`Tôi chưa hiểu rõ câu hỏi của bạn. 🤖

Tôi có thể hỗ trợ bạn tốt nhất về các chủ đề sau:
* 📊 **Số liệu thống kê hôm nay**: tổng số, đã chia, trùng, lỗi, blacklist.
* 🛡️ **Hệ thống Blacklist**: chặn số tự động, import Excel.
* 💬 **Zalo Bot**: gửi data tự động, tin nhắn tổng hợp chào buổi sáng.
* ⚙️ **Quy tắc chia số (Rules/Rounds)**: xoay vòng, đền bù, giờ làm việc.
* 🎫 **Ticket báo lỗi**: đền bù lượt chia cho Sale.

Bạn có thể gõ rõ từ khóa hoặc click vào các gợi ý bên dưới nhé!`);
  };

  const renderText = (text: string) => {
    return text.split('\n').map((line, idx) => {
      let content: React.ReactNode = line;
      
      // Basic markdown parser
      // Bullet points
      if (line.startsWith('* ') || line.startsWith('- ')) {
        const itemText = line.substring(2);
        content = (
          <li key={idx} style={{ marginLeft: '12px', marginBottom: '4px' }}>
            {parseBoldText(itemText)}
          </li>
        );
      } else {
        content = <div key={idx} style={{ marginBottom: '8px' }}>{parseBoldText(line)}</div>;
      }
      
      return content;
    });
  };

  const parseBoldText = (text: string) => {
    const parts = text.split('**');
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        return <strong key={i} style={{ color: 'var(--color-primary)', fontWeight: 700 }}>{part}</strong>;
      }
      // Inline code matching
      const codeParts = part.split('`');
      return codeParts.map((subPart, j) => {
        if (j % 2 === 1) {
          return (
            <code 
              key={j} 
              style={{ 
                background: 'rgba(0,0,0,0.05)', 
                padding: '2px 4px', 
                borderRadius: '4px', 
                fontSize: '0.8125rem',
                fontFamily: 'monospace',
                color: 'var(--color-danger)'
              }}
            >
              {subPart}
            </code>
          );
        }
        return subPart;
      });
    });
  };

  const buttonTransform = isOpen 
    ? 'scale(0) rotate(-90deg)' 
    : isHovered 
      ? 'scale(1.08) translateY(-2px)' 
      : 'scale(1) rotate(0deg)';

  const renderBotAvatar = (size: number, isHeader = false) => {
    return (
      <div style={{
        width: size,
        height: size,
        borderRadius: '50%',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'white',
        border: isHeader ? '1.5px solid rgba(255,255,255,0.6)' : '1px solid var(--chatbot-window-border)',
        flexShrink: 0,
        position: 'relative'
      }}>
        <img 
          src={botAvatarUrl} 
          alt="AI" 
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            const parent = e.currentTarget.parentElement;
            if (parent) {
              parent.style.background = 'linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))';
              if (!parent.querySelector('.avatar-fallback-text')) {
                const fallback = document.createElement('span');
                fallback.className = 'avatar-fallback-text';
                fallback.innerText = 'AI';
                fallback.style.color = 'white';
                fallback.style.fontWeight = '700';
                fallback.style.fontSize = `${size * 0.4}px`;
                fallback.style.fontFamily = 'var(--font-sans, sans-serif)';
                parent.appendChild(fallback);
              }
            }
          }}
          style={{ 
            width: '100%', 
            height: '100%', 
            objectFit: 'cover'
          }} 
        />
      </div>
    );
  };

  return (
    <div className={`chatbot-parent ${isOpen ? 'is-open' : 'is-closed'}`} style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 10005 }}>
      {/* CSS Styles injection */}
      <style>{`
        :root {
          --chatbot-window-bg: #ffffff;
          --chatbot-window-border: #e5e7eb;
          --chatbot-sidebar-bg: #f3f4f6;
          --chatbot-sidebar-border: #e5e7eb;
          --chatbot-bubble-bot-bg: #f9fafb;
          --chatbot-bubble-bot-border: #e5e7eb;
          --chatbot-bubble-user-bg: #a31422;
          --chatbot-text: #111827;
          --chatbot-text-muted: #6b7280;
          --chatbot-card-bg: #ffffff;
          --chatbot-card-hover-bg: #f9fafb;
          --chatbot-card-border: #e5e7eb;
          --chatbot-card-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
          --chatbot-input-bg: #f9fafb;
          --chatbot-btn-bg: #ffffff;
          --chatbot-btn-border: #a31422;
        }
        [data-theme="dark"] {
          --chatbot-window-bg: #111827;
          --chatbot-window-border: #374151;
          --chatbot-sidebar-bg: #1f2937;
          --chatbot-sidebar-border: #374151;
          --chatbot-bubble-bot-bg: #1f2937;
          --chatbot-bubble-bot-border: #374151;
          --chatbot-bubble-user-bg: #a31422;
          --chatbot-text: #f9fafb;
          --chatbot-text-muted: #9ca3af;
          --chatbot-card-bg: #1f2937;
          --chatbot-card-hover-bg: #374151;
          --chatbot-card-border: #374151;
          --chatbot-card-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          --chatbot-input-bg: #1f2937;
          --chatbot-btn-bg: #ffffff;
          --chatbot-btn-border: #a31422;
        }
        
        .pulse-chatbot {
          animation: pulse-ring-chatbot 2.5s infinite;
        }
        @keyframes pulse-ring-chatbot {
          0% {
            box-shadow: 0 0 0 0 rgba(163, 20, 34, 0.4);
            transform: scale(1);
          }
          50% {
            transform: scale(1.03);
          }
          70% {
            box-shadow: 0 0 0 15px rgba(163, 20, 34, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(163, 20, 34, 0);
            transform: scale(1);
          }
        }
        
        .message-appear {
          animation: slide-up-fade 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          opacity: 0;
        }
        @keyframes slide-up-fade {
          0% {
            opacity: 0;
            transform: translateY(12px) scale(0.97);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        
        .chatbot-stats-card {
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          animation: stats-card-fade 0.4s ease-out forwards;
          opacity: 0;
        }
        @keyframes stats-card-fade {
          from { opacity: 0; transform: translateX(-10px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .chatbot-stats-card:hover {
          transform: translateY(-2px) scale(1.02);
          background: var(--chatbot-card-hover-bg) !important;
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08) !important;
          border-color: rgba(163, 20, 34, 0.15) !important;
        }
        .chatbot-stats-card:active {
          transform: translateY(0) scale(0.98);
        }
        
        .dot-typing {
          display: inline-flex;
          align-items: center;
          gap: 3px;
        }
        .dot-typing::after {
          content: '...';
          overflow: hidden;
          display: inline-block;
          vertical-align: bottom;
          animation: ellipsis steps(4,end) 900ms infinite;
          width: 0px;
        }
        @keyframes ellipsis {
          to {
            width: 1.25em;
          }
        }
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .quick-prompt-chip {
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .quick-prompt-chip:hover {
          border-color: var(--color-primary) !important;
          color: white !important;
          background: var(--color-primary) !important;
          transform: translateY(-2px);
          box-shadow: var(--shadow-primary) !important;
        }
        .quick-prompt-chip:active {
          transform: translateY(0);
        }
        
        .chatbot-input-field {
          transition: all 0.25s ease;
        }
        .chatbot-input-field:focus {
          border-color: var(--color-primary) !important;
          box-shadow: 0 0 0 3px rgba(163, 20, 34, 0.15) !important;
          background: var(--color-surface) !important;
        }
        .chatbot-send-button {
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .chatbot-send-button:not([disabled]):hover {
          transform: scale(1.1) rotate(-5deg);
          box-shadow: var(--shadow-primary);
        }
        .chatbot-send-button:not([disabled]):active {
          transform: scale(0.95);
        }
        
        /* Premium custom scrollbar */
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(163, 20, 34, 0.15);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(163, 20, 34, 0.3);
        }
        
        @media (max-width: 768px) {
          .chatbot-parent.is-open {
            left: 0 !important;
            right: 0 !important;
            top: 0 !important;
            bottom: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            transform: none !important;
          }
          .chatbot-parent.is-closed {
            left: auto !important;
            right: 12px !important;
            bottom: 74px !important;
            width: 38px !important;
            height: 38px !important;
          }
          .chatbot-parent.is-closed button {
            width: 38px !important;
            height: 38px !important;
            min-width: 38px !important;
            min-height: 38px !important;
            max-width: 38px !important;
            max-height: 38px !important;
          }
          .chatbot-window {
            width: 100% !important;
            height: 100% !important;
            max-height: 100vh !important;
            border-radius: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            top: 0 !important;
            transform-origin: bottom center !important;
          }
          .chatbot-sidebar {
            display: none !important;
          }
          .chatbot-input-bar {
            padding: 10px 10px 30px 10px !important;
            gap: 8px !important;
          }
        }
      `}</style>

      {/* Floating Chat Bubble */}
      <button
        onClick={() => setIsOpen(true)}
        style={{
          width: 52,
          height: 52,
          minWidth: 52,
          minHeight: 52,
          maxWidth: 52,
          maxHeight: 52,
          borderRadius: '50%',
          background: 'var(--chatbot-btn-bg)',
          padding: 0,
          cursor: 'pointer',
          border: 'none',
          boxShadow: '0 10px 30px rgba(163, 20, 34, 0.3)',
          opacity: isOpen ? 0 : 1,
          transform: buttonTransform,
          pointerEvents: isOpen ? 'none' : 'auto',
          transition: 'transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease',
          outline: 'none',
          position: 'absolute',
          bottom: 0,
          right: 0,
          overflow: 'visible',
          boxSizing: 'border-box'
        }}
        className="pulse-chatbot"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <img 
          src={botAvatarUrl} 
          alt="AI Avatar" 
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            const parent = e.currentTarget.parentElement;
            if (parent) {
              parent.style.background = 'linear-gradient(135deg, #a31422, #a31422)';
              if (!parent.querySelector('.btn-fallback-icon')) {
                const fallback = document.createElement('span');
                fallback.className = 'btn-fallback-icon';
                fallback.innerHTML = '🤖';
                fallback.style.fontSize = '26px';
                parent.appendChild(fallback);
              }
            }
          }}
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            objectFit: 'cover',
            border: '3px solid var(--chatbot-btn-border)',
            background: 'var(--chatbot-btn-bg)',
            display: 'block'
          }}
        />
        <span style={{
          position: 'absolute',
          top: -1,
          right: -1,
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: '#10b981',
          boxShadow: '0 0 0 2px var(--color-surface)',
          border: '1.5px solid white'
        }} />
      </button>

      {/* Chat Window */}
      <div
        className="chatbot-window"
        style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: 'min(540px, 92vw)',
          height: 'min(720px, 85vh)',
          borderRadius: '24px',
          background: 'var(--chatbot-window-bg)',
          backdropFilter: 'blur(30px) saturate(210%)',
          WebkitBackdropFilter: 'blur(30px) saturate(210%)',
          border: '1px solid var(--chatbot-window-border)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.5)',
          display: 'flex',
          overflow: 'hidden',
          opacity: isOpen ? 1 : 0,
          transform: isOpen ? 'scale(1) translate3d(0, 0, 0)' : 'scale(0.3) translate3d(0, 40px, 0)',
          transformOrigin: 'bottom right',
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.35s ease, width 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
          willChange: 'transform, opacity, width'
        }}
      >
        {/* Main Chat Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          {/* Header */}
          <div
            style={{
              padding: '14px 20px',
              background: 'linear-gradient(135deg, #a31422 0%, #a31422 100%)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 4px 15px rgba(163, 20, 34, 0.15)',
              zIndex: 10
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {renderBotAvatar(34, true)}
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: 800, letterSpacing: '0.01em', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {t('Trợ lý AI Rich Land')}
                  <Sparkles size={12} style={{ color: '#fcd34d' }} />
                </div>
                <div style={{ fontSize: '0.6875rem', opacity: 0.85, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                  {t('Đang trực tuyến')}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  border: 'none',
                  borderRadius: '50%',
                  width: 30,
                  height: 30,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div style={{
            display: 'flex',
            borderBottom: '1px solid var(--chatbot-window-border)',
            background: 'var(--chatbot-sidebar-bg)',
            padding: '2px'
          }}>
            <button
              type="button"
              onClick={() => setChatMode('project_campaign')}
              style={{
                flex: 1,
                padding: '10px 12px',
                border: 'none',
                background: chatMode === 'project_campaign' ? 'var(--chatbot-card-bg)' : 'transparent',
                color: chatMode === 'project_campaign' ? '#a31422' : 'var(--chatbot-text-muted)',
                fontWeight: 700,
                fontSize: '0.8rem',
                cursor: 'pointer',
                borderRadius: '8px',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              {t('Hỏi Dự án / Chiến dịch')}
            </button>
            <button
              type="button"
              onClick={() => {
                setChatMode('general');
                setSelectedEntity(null);
                setEntityContext('');
              }}
              style={{
                flex: 1,
                padding: '10px 12px',
                border: 'none',
                background: chatMode === 'general' ? 'var(--chatbot-card-bg)' : 'transparent',
                color: chatMode === 'general' ? '#a31422' : 'var(--chatbot-text-muted)',
                fontWeight: 700,
                fontSize: '0.8rem',
                cursor: 'pointer',
                borderRadius: '8px',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              {t('Chat thường')}
            </button>
          </div>

          {chatMode === 'project_campaign' && !selectedEntity ? (
            /* Selector Panel */
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '16px', background: 'var(--chatbot-window-bg)' }}>
              <div style={{ position: 'relative', marginBottom: '12px' }}>
                <input
                  type="text"
                  placeholder={t('Tìm kiếm dự án, chiến dịch...')}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 32px 8px 12px',
                    borderRadius: '20px',
                    border: '1px solid var(--chatbot-window-border)',
                    fontSize: '0.8rem',
                    background: 'var(--chatbot-card-bg)',
                    color: 'var(--chatbot-text)',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <Search size={14} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5, color: 'var(--chatbot-text)' }} />
              </div>
              
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }} className="custom-scrollbar">
                {loadingEntities ? (
                  <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--chatbot-text-muted)', fontSize: '0.8rem' }}>
                    <span className="dot-typing">{t('Đang tải danh sách')}</span>
                  </div>
                ) : (
                  <>
                    {/* Projects Section */}
                    <div>
                      <h5 style={{ fontSize: '0.72rem', color: '#a31422', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px 4px' }}>
                        {t('Dự án')} ({filteredProjects.length})
                      </h5>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {filteredProjects.length === 0 ? (
                          <div style={{ padding: '8px', color: 'var(--chatbot-text-muted)', fontSize: '0.75rem', fontStyle: 'italic' }}>
                            {t('Không có dự án nào')}
                          </div>
                        ) : (
                          filteredProjects.map(p => (
                            <div
                              key={'proj_' + p.id}
                              onClick={() => handleSelectEntity({ id: p.id, name: p.name, type: 'project' })}
                              style={{
                                padding: '10px 14px',
                                background: 'var(--chatbot-card-bg)',
                                border: '1px solid var(--chatbot-window-border)',
                                borderRadius: '12px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                transition: 'all 0.2s'
                              }}
                              className="entity-select-item"
                              onMouseEnter={e => e.currentTarget.style.borderColor = '#a31422'}
                              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--chatbot-window-border)'}
                            >
                              <div>
                                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--chatbot-text)', textAlign: 'left' }}>{p.name}</div>
                                <div style={{ fontSize: '0.68rem', color: 'var(--chatbot-text-muted)', textAlign: 'left' }}>{p.code} | {p.location || t('Chưa có vị trí')}</div>
                              </div>
                              <ChevronRight size={14} style={{ color: '#a31422' }} />
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Campaigns Section */}
                    <div>
                      <h5 style={{ fontSize: '0.72rem', color: '#a31422', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '12px 0 8px 4px' }}>
                        {t('Chiến dịch')} ({filteredCampaigns.length})
                      </h5>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {filteredCampaigns.length === 0 ? (
                          <div style={{ padding: '8px', color: 'var(--chatbot-text-muted)', fontSize: '0.75rem', fontStyle: 'italic' }}>
                            {t('Không có chiến dịch nào')}
                          </div>
                        ) : (
                          filteredCampaigns.map(c => (
                            <div
                              key={'camp_' + c.id}
                              onClick={() => handleSelectEntity({ id: c.id, name: c.name, type: 'campaign', project_id: c.project_id })}
                              style={{
                                padding: '10px 14px',
                                background: 'var(--chatbot-card-bg)',
                                border: '1px solid var(--chatbot-window-border)',
                                borderRadius: '12px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                transition: 'all 0.2s'
                              }}
                              className="entity-select-item"
                              onMouseEnter={e => e.currentTarget.style.borderColor = '#a31422'}
                              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--chatbot-window-border)'}
                            >
                              <div>
                                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--chatbot-text)', textAlign: 'left' }}>{c.name}</div>
                                <div style={{ fontSize: '0.68rem', color: 'var(--chatbot-text-muted)', textAlign: 'left' }}>{c.code} {c.project_name ? `(${c.project_name})` : ''}</div>
                              </div>
                              <ChevronRight size={14} style={{ color: '#a31422' }} />
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            /* Message Viewport */
            <>
              {chatMode === 'project_campaign' && selectedEntity && (
                <div style={{
                  padding: '8px 14px',
                  background: 'rgba(163, 20, 34, 0.04)',
                  borderBottom: '1px solid var(--chatbot-window-border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}>
                  {/* Top Row: < on far left, Đang hỏi về: <Name> on far right */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '8px' }}>
                    <button
                      type="button"
                      title={t('Quay lại chọn dự án / chiến dịch')}
                      onClick={() => {
                        setSelectedEntity(null);
                        setEntityContext('');
                        setEntityDocs([]);
                        setSelectedDocId('all');
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#a31422',
                        cursor: 'pointer',
                        padding: '4px',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(163, 20, 34, 0.12)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <ChevronLeft size={18} style={{ color: '#a31422' }} />
                    </button>

                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#a31422', display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginLeft: 'auto' }}>
                      <span>{t('Đang hỏi về')}:</span>
                      <strong style={{ color: 'var(--chatbot-text)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedEntity.name}</strong>
                      {loadingContext && <span style={{ fontSize: '0.7rem', color: 'var(--chatbot-text-muted)', flexShrink: 0 }}>({t('Đang nạp...')})</span>}
                    </div>
                  </div>

                  {/* Bottom Row: Document selector trigger button -> opens Modal */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <FileText size={13} style={{ color: '#a31422', flexShrink: 0 }} />
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--chatbot-text-muted)', flexShrink: 0 }}>
                        {t('Tài liệu hỏi AI:')}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowDocSelectModal(true)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '4px 10px',
                        borderRadius: '8px',
                        border: '1px solid var(--chatbot-window-border)',
                        background: 'var(--chatbot-card-bg)',
                        color: selectedDocId === 'all' ? 'var(--chatbot-text)' : '#a31422',
                        cursor: 'pointer',
                        outline: 'none',
                        maxWidth: '220px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = '#a31422'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--chatbot-window-border)'}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {selectedDocId === 'all'
                          ? `📂 ${t('Tất cả tài liệu')} (${entityDocs.length})`
                          : `📄 ${entityDocs.find(d => Number(d.id) === Number(selectedDocId))?.name || 'Tài liệu đã chọn'}`}
                      </span>
                      <ChevronRight size={12} style={{ flexShrink: 0, opacity: 0.6 }} />
                    </button>
                  </div>
                </div>
              )}

              
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  background: 'transparent'
                }}
                className="custom-scrollbar"
              >
                {messages.map(msg => (
                  <div
                    key={msg.id}
                    style={{
                      display: 'flex',
                      justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                      alignItems: 'flex-start',
                      gap: 10
                    }}
                    className="message-appear"
                  >
                    {msg.sender === 'bot' && renderBotAvatar(30, false)}
                    
                    <div
                      style={{
                        maxWidth: '82%',
                        padding: '12px 18px',
                        borderRadius: msg.sender === 'user' ? '18px 18px 2px 18px' : '18px 18px 18px 2px',
                        background: msg.sender === 'user' 
                          ? 'var(--chatbot-bubble-user-bg)' 
                          : 'var(--chatbot-bubble-bot-bg)',
                        color: msg.sender === 'user' ? 'white' : 'var(--chatbot-text)',
                        fontSize: '0.875rem',
                        lineHeight: '1.6',
                        boxShadow: msg.sender === 'user' 
                          ? '0 4px 15px rgba(163, 20, 34, 0.2)' 
                          : '0 4px 15px rgba(0,0,0,0.02)',
                        border: msg.sender === 'user' ? 'none' : '1px solid var(--chatbot-bubble-bot-border)'
                      }}
                    >
                      {renderText(msg.text)}
                    </div>
                  </div>
                ))}
                
                {isTyping && (
                  <div 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 10, 
                      paddingLeft: 40,
                      animation: 'slide-up-fade 0.3s ease forwards'
                    }}
                  >
                    <div style={{ display: 'flex', gap: 4 }}>
                      {renderBotAvatar(24, false)}
                      <div style={{
                        padding: '8px 12px',
                        borderRadius: '12px 12px 12px 2px',
                        background: 'var(--chatbot-bubble-bot-bg)',
                        border: '1px solid var(--chatbot-bubble-bot-border)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--chatbot-text-muted)' }} className="dot-typing">{t('AI đang trả lời')}</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </>
          )}

          {/* Input Bar */}
          <form
            onSubmit={e => {
              e.preventDefault();
              handleSend(inputValue);
            }}
            className="chatbot-input-bar"
            style={{
              padding: '12px 20px 20px 20px',
              display: 'flex',
              gap: 12,
              alignItems: 'center',
              background: 'var(--color-surface)',
              borderTop: '1px solid var(--chatbot-window-border)'
            }}
          >
            <input
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              placeholder={t("Nhập câu hỏi của bạn...")}
              className="chatbot-input-field"
              style={{
                flex: 1,
                padding: '12px 18px',
                border: '1px solid var(--chatbot-card-border)',
                borderRadius: '24px',
                fontSize: '0.875rem',
                outline: 'none',
                background: 'var(--chatbot-input-bg)',
                color: 'var(--chatbot-text)'
              }}
            />
            <button
              type="submit"
              disabled={!inputValue.trim()}
              className="chatbot-send-button"
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                background: inputValue.trim() ? 'var(--color-primary)' : 'var(--color-border-light)',
                color: inputValue.trim() ? 'white' : 'var(--color-text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: inputValue.trim() ? 'pointer' : 'default',
                border: 'none',
                outline: 'none',
                boxShadow: inputValue.trim() ? '0 4px 10px rgba(163, 20, 34, 0.15)' : 'none'
              }}
            >
              <Send size={15} />
            </button>
          </form>

          {/* Document Selection Modal Overlay */}
          {showDocSelectModal && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.55)',
              backdropFilter: 'blur(3px)',
              zIndex: 100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px'
            }}>
              <div style={{
                width: '100%',
                maxHeight: '85%',
                background: 'var(--chatbot-window-bg, #ffffff)',
                borderRadius: '16px',
                border: '1px solid var(--chatbot-window-border)',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                animation: 'fadeIn 0.2s ease-out'
              }}>
                {/* Modal Header */}
                <div style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--chatbot-window-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'var(--chatbot-sidebar-bg)'
                }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 800, color: '#a31422', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileText size={16} />
                    {t('Chọn tài liệu để hỏi AI')}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDocSelectModal(false)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--chatbot-text-muted)',
                      cursor: 'pointer',
                      padding: '4px'
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Modal Search Bar */}
                <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--chatbot-window-border)' }}>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      placeholder={t('Tìm kiếm tài liệu...')}
                      value={docSearchQuery}
                      onChange={e => setDocSearchQuery(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '6px 28px 6px 10px',
                        borderRadius: '8px',
                        border: '1px solid var(--chatbot-window-border)',
                        fontSize: '0.78rem',
                        background: 'var(--chatbot-card-bg)',
                        color: 'var(--chatbot-text)',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                    <Search size={13} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
                  </div>
                </div>

                {/* Modal Document List */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }} className="custom-scrollbar">
                  {/* Option 1: All Documents */}
                  <div
                    onClick={() => {
                      handleSelectDocFilter('all', entityDocs, rawDetails, parentProj, selectedEntity.type);
                      setShowDocSelectModal(false);
                    }}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: selectedDocId === 'all' ? '2px solid #a31422' : '1px solid var(--chatbot-window-border)',
                      background: selectedDocId === 'all' ? 'rgba(163, 20, 34, 0.06)' : 'var(--chatbot-card-bg)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '1.1rem' }}>📂</span>
                      <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--chatbot-text)', textAlign: 'left' }}>
                          {t('Tất cả tài liệu dự án')} ({entityDocs.length})
                        </div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--chatbot-text-muted)', textAlign: 'left' }}>
                          {t('AI sẽ tổng hợp câu trả lời từ tất cả tài liệu đính kèm')}
                        </div>
                      </div>
                    </div>
                    {selectedDocId === 'all' && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#a31422' }} />}
                  </div>

                  {/* Option 2...N: Individual Documents */}
                  {entityDocs
                    .filter(d => (d.name || d.file_name || '').toLowerCase().includes(docSearchQuery.toLowerCase()))
                    .map((doc: any) => {
                      const isSelected = selectedDocId === doc.id;
                      return (
                        <div
                          key={doc.id}
                          onClick={() => {
                            handleSelectDocFilter(doc.id, entityDocs, rawDetails, parentProj, selectedEntity.type);
                            setShowDocSelectModal(false);
                          }}
                          style={{
                            padding: '10px 12px',
                            borderRadius: '10px',
                            border: isSelected ? '2px solid #a31422' : '1px solid var(--chatbot-window-border)',
                            background: isSelected ? 'rgba(163, 20, 34, 0.06)' : 'var(--chatbot-card-bg)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            transition: 'all 0.15s'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                            <FileText size={16} style={{ color: isSelected ? '#a31422' : 'var(--chatbot-text-muted)', flexShrink: 0 }} />
                            <div style={{ overflow: 'hidden', textAlign: 'left' }}>
                              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--chatbot-text)', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                                {doc.name || doc.file_name || `Tài liệu #${doc.id}`}
                              </div>
                              <div style={{ fontSize: '0.68rem', color: 'var(--chatbot-text-muted)' }}>
                                {doc.mime_type || 'Tài liệu'} {doc.description ? `• ${doc.description}` : ''}
                              </div>
                            </div>
                          </div>
                          {isSelected && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#a31422', flexShrink: 0 }} />}
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
