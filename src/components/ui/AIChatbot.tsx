import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { Send, X, Database, Sparkles, LayoutGrid } from 'lucide-react';
import { fetchAPI } from '../../utils/api';

interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: Date;
}

export const AIChatbot: React.FC = () => {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: t('Xin chào! Tôi là Trợ lý AI hỗ trợ hệ thống quản trị Domation. 🤖\n\nTôi có thể trả lời các câu hỏi về chỉ số thống kê hôm nay, cách cấu hình Zalo Bot, thiết lập Blacklist, quy tắc chia số, hoặc Ticket báo lỗi đền bù.\n\nBạn cần tôi hỗ trợ gì hôm nay?'),
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [stats, setStats] = useState<any>(null);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const botAvatarUrl = "https://crm-domation.vercel.app/LOGO.jpg";

  // Sidebar stats card config
  const statsConfig = [
    { key: 'total_today', label: t('Tổng tiếp nhận'), color: '#6366f1', prompt: t('Hôm nay hệ thống nhận bao nhiêu data?') },
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

  // Responsive sidebar toggle
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setShowSidebar(false);
      } else {
        setShowSidebar(true);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
          history: historyPayload
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
        background: isHeader ? 'white' : 'var(--color-surface)',
        border: isHeader ? '1.5px solid rgba(255,255,255,0.6)' : '1px solid var(--color-border-light)',
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
    <div className={`chatbot-parent ${isOpen ? 'is-open' : 'is-closed'}`} style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999 }}>
      {/* CSS Styles injection */}
      <style>{`
        :root {
          --chatbot-window-bg: rgba(255, 255, 255, 0.75);
          --chatbot-window-border: rgba(255, 255, 255, 0.6);
          --chatbot-sidebar-bg: rgba(248, 250, 252, 0.35);
          --chatbot-sidebar-border: rgba(0, 0, 0, 0.05);
          --chatbot-bubble-bot-bg: rgba(79, 70, 229, 0.04);
          --chatbot-bubble-bot-border: rgba(79, 70, 229, 0.08);
          --chatbot-bubble-user-bg: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
          --chatbot-text: #0f172a;
          --chatbot-text-muted: #64748b;
          --chatbot-card-bg: rgba(255, 255, 255, 0.85);
          --chatbot-card-hover-bg: #ffffff;
          --chatbot-card-border: rgba(0, 0, 0, 0.04);
          --chatbot-card-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);
          --chatbot-input-bg: rgba(248, 250, 252, 0.7);
        }
        [data-theme="dark"] {
          --chatbot-window-bg: rgba(26, 26, 36, 0.75);
          --chatbot-window-border: rgba(255, 255, 255, 0.08);
          --chatbot-sidebar-bg: rgba(15, 15, 20, 0.4);
          --chatbot-sidebar-border: rgba(255, 255, 255, 0.06);
          --chatbot-bubble-bot-bg: rgba(255, 255, 255, 0.03);
          --chatbot-bubble-bot-border: rgba(255, 255, 255, 0.06);
          --chatbot-bubble-user-bg: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
          --chatbot-text: #f1f5f9;
          --chatbot-text-muted: #94a3b8;
          --chatbot-card-bg: rgba(37, 37, 53, 0.6);
          --chatbot-card-hover-bg: rgba(37, 37, 53, 0.8);
          --chatbot-card-border: rgba(255, 255, 255, 0.04);
          --chatbot-card-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          --chatbot-input-bg: rgba(15, 15, 20, 0.5);
        }
        
        .pulse-chatbot {
          animation: pulse-ring-chatbot 2.5s infinite;
        }
        @keyframes pulse-ring-chatbot {
          0% {
            box-shadow: 0 0 0 0 rgba(79, 70, 229, 0.4);
            transform: scale(1);
          }
          50% {
            transform: scale(1.03);
          }
          70% {
            box-shadow: 0 0 0 15px rgba(79, 70, 229, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(79, 70, 229, 0);
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
          border-color: rgba(79, 70, 229, 0.15) !important;
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
          box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15) !important;
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
          background: rgba(79, 70, 229, 0.15);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(79, 70, 229, 0.3);
        }
        
        @media (max-width: 768px) {
          .chatbot-parent.is-open {
            left: 16px !important;
            right: 16px !important;
            bottom: 16px !important;
            width: auto !important;
            height: auto !important;
            transform: none !important;
          }
          .chatbot-parent.is-closed {
            left: auto !important;
            right: 16px !important;
            bottom: 16px !important;
            width: 64px !important;
            height: 64px !important;
          }
          .chatbot-window {
            width: auto !important;
            left: 0 !important;
            right: 0 !important;
            height: calc(100vh - 80px) !important;
            max-height: 80vh !important;
            transform-origin: bottom center !important;
          }
          .chatbot-sidebar {
            display: none !important;
          }
        }
      `}</style>

      {/* Floating Chat Bubble */}
      <button
        onClick={() => setIsOpen(true)}
        style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: 'white',
          padding: 0,
          cursor: 'pointer',
          border: 'none',
          boxShadow: '0 10px 30px rgba(79, 70, 229, 0.3)',
          opacity: isOpen ? 0 : 1,
          transform: buttonTransform,
          pointerEvents: isOpen ? 'none' : 'auto',
          transition: 'transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease',
          outline: 'none',
          position: 'absolute',
          bottom: 0,
          right: 0,
          overflow: 'visible'
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
              parent.style.background = 'linear-gradient(135deg, #4f46e5, #7c3aed)';
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
            border: '3px solid #4f46e5',
            background: 'white',
            display: 'block'
          }}
        />
        <span style={{
          position: 'absolute',
          top: -2,
          right: -2,
          width: 14,
          height: 14,
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
          width: showSidebar ? 'min(820px, 94vw)' : 'min(540px, 92vw)',
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
        {/* Sidebar - Dashboard Stats */}
        {showSidebar && (
          <div
            className="chatbot-sidebar"
            style={{
              width: 260,
              background: 'var(--chatbot-sidebar-bg)',
              borderRight: '1px solid var(--chatbot-sidebar-border)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              flexShrink: 0
            }}
          >
            {/* Sidebar Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--chatbot-sidebar-border)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(79, 70, 229, 0.02)'
            }}>
              <Database size={15} style={{ color: '#4f46e5' }} />
              <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--chatbot-text)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {t('Số liệu hôm nay')}
              </span>
            </div>

            {/* Sidebar Content */}
            <div 
              style={{ 
                flex: 1, 
                overflowY: 'auto', 
                padding: '16px', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: 12 
              }} 
              className="custom-scrollbar"
            >
              {stats ? (
                statsConfig.map((item, idx) => {
                  const value = stats[item.key] !== undefined ? stats[item.key] : 0;
                  return (
                    <div
                      key={idx}
                      onClick={() => handleSend(item.prompt)}
                      style={{
                        padding: '12px 14px',
                        background: 'var(--chatbot-card-bg)',
                        border: '1px solid var(--chatbot-card-border)',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        boxShadow: 'var(--chatbot-card-shadow)',
                        animationDelay: `${idx * 0.05}s`
                      }}
                      className="chatbot-stats-card"
                    >
                      <div style={{ fontSize: '0.72rem', color: 'var(--chatbot-text-muted)', fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, display: 'inline-block' }} />
                        {item.label}
                      </div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--chatbot-text)', display: 'flex', alignItems: 'baseline', gap: 4 }}>
                        {value}
                        <span style={{ fontSize: '0.6875rem', fontWeight: 500, color: 'var(--chatbot-text-muted)' }}>data</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, opacity: 0.6 }}>
                  <div className="dot-typing" style={{ color: 'var(--chatbot-text-muted)', fontSize: '0.8rem' }}>{t('Đang tải số liệu')}</div>
                </div>
              )}
            </div>

            {/* Sidebar Footer */}
            <div style={{
              padding: '12px 16px',
              borderTop: '1px solid var(--chatbot-sidebar-border)',
              fontSize: '0.6875rem',
              color: 'var(--chatbot-text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(79, 70, 229, 0.01)'
            }}>
              <Sparkles size={12} style={{ color: '#7c3aed' }} />
              <span>{t('Nhấp để hỏi AI tự động')}</span>
            </div>
          </div>
        )}

        {/* Main Chat Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          {/* Header */}
          <div
            style={{
              padding: '14px 20px',
              background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 4px 15px rgba(79, 70, 229, 0.15)',
              zIndex: 10
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {renderBotAvatar(34, true)}
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: 800, letterSpacing: '0.01em', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {t('Trợ lý AI Domation')}
                  <Sparkles size={12} style={{ color: '#fcd34d' }} />
                </div>
                <div style={{ fontSize: '0.6875rem', opacity: 0.85, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                  {t('Đang trực tuyến')}
                </div>
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Sidebar toggle button */}
              <button
                className="chatbot-sidebar-toggle-btn"
                onClick={() => setShowSidebar(!showSidebar)}
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
                title={showSidebar ? t("Ẩn chỉ số") : t("Hiện chỉ số")}
              >
                <LayoutGrid size={14} />
              </button>

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

          {/* Messages Container */}
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
                      ? '0 4px 15px rgba(124, 58, 237, 0.2)' 
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

          {/* Quick suggestions */}
          <div
            style={{
              padding: '10px 20px 12px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              borderTop: '1px solid var(--chatbot-window-border)',
              background: 'rgba(124, 58, 237, 0.01)'
            }}
          >
            <div style={{ fontSize: '0.72rem', color: 'var(--chatbot-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('Gợi ý hỏi nhanh:')}</div>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }} className="hide-scrollbar">
              {quickPrompts.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(p.text)}
                  style={{
                    flexShrink: 0,
                    background: 'var(--chatbot-card-bg)',
                    border: '1px solid var(--chatbot-card-border)',
                    borderRadius: '20px',
                    padding: '6px 14px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'var(--chatbot-text)',
                    cursor: 'pointer',
                    outline: 'none',
                    boxShadow: 'var(--chatbot-card-shadow)',
                  }}
                  className="quick-prompt-chip"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Input Bar */}
          <form
            onSubmit={e => {
              e.preventDefault();
              handleSend(inputValue);
            }}
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
                boxShadow: inputValue.trim() ? '0 4px 10px rgba(124, 58, 237, 0.15)' : 'none'
              }}
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
