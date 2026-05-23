import React, { useState, useEffect, useRef } from 'react';
import { Send, X } from 'lucide-react';
import { fetchAPI } from '../../utils/api';

interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: Date;
}

export const AIChatbot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: 'Xin chào! Tôi là Trợ lý AI hỗ trợ hệ thống quản trị Domation. 🤖\n\nTôi có thể trả lời các câu hỏi về chỉ số thống kê hôm nay, cách cấu hình Zalo Bot, thiết lập Blacklist, quy tắc chia số, hoặc Ticket báo lỗi đền bù.\n\nBạn cần tôi hỗ trợ gì hôm nay?',
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [stats, setStats] = useState<any>(null);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const botAvatarUrl = "https://crm-domation.vercel.app/LOGO.jpg";

  // Suggested prompts
  const quickPrompts = [
    { label: '📊 Thống kê data hôm nay', text: 'Hôm nay hệ thống chia bao nhiêu data?' },
    { label: '💬 Cài đặt Zalo Bot', text: 'Zalo Bot hoạt động thế nào?' },
    { label: '🛡️ Quản lý Blacklist', text: 'Làm sao để cấu hình Blacklist?' },
    { label: '🎫 Ticket báo lỗi đền bù', text: 'Quy trình xử lý Ticket lỗi thế nào?' }
  ];

  // Fetch stats when chat opens
  useEffect(() => {
    if (isOpen && !stats) {
      fetchAPI('get_dashboard_stats')
        .then(res => {
          if (res.success && res.data) {
            setStats(res.data);
          }
        })
        .catch(err => console.error('Lỗi tải stats cho chatbot:', err));
    }
  }, [isOpen, stats]);

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
          return `Dữ liệu thống kê hệ thống **hôm nay** như sau:\n\n` +
                 `* 📥 **Tổng số tiếp nhận**: **${currentStats.total_today}** data\n` +
                 `* 👤 **Đã bàn giao**: **${currentStats.distributed_today}** data\n` +
                 `* 👥 **Trùng lặp (không chia)**: **${currentStats.duplicates}** data\n` +
                 `* 🚫 **Chặn Blacklist**: **${currentStats.blacklists}** data\n` +
                 `* ⚠️ **Data lỗi / Ticket**: **${currentStats.errors}** data\n\n` +
                 `*Hiệu số tăng trưởng hoặc chi tiết cụ thể bạn có thể xem trực tiếp ở trang chủ (Dashboard).*`;
        } else {
          return `Tôi đang tải số liệu thống kê từ hệ thống. Bạn vui lòng đợi một chút hoặc thử lại nhé!`;
        }
      }
    }

    // 2. Blacklist questions
    if (q.includes('blacklist') || q.includes('danh sách đen') || q.includes('chặn') || q.includes('bỏ qua')) {
      return `Hệ thống **Blacklist (Danh sách đen)** hoạt động như sau:\n\n` +
             `1. **Tự động chặn**: Khi có lead mới vào (qua Webhook/Sheets), hệ thống sẽ check số điện thoại/email đối chiếu với Blacklist. Nếu trùng, lead sẽ bị đánh dấu là \`blacklisted\` và chặn phân bổ.\n` +
             `2. **Quản lý danh sách**: Admin có thể vào mục **Cài đặt -> Danh sách đen** để thêm/xóa thủ công các liên hệ hoặc tải lên file Excel chứa hàng ngàn liên hệ chặn.\n` +
             `3. **Hiển thị**: Dữ liệu bị chặn blacklist sẽ được cộng vào thẻ KPI lỗi ngoài Dashboard để đảm bảo khớp dữ liệu tổng.`;
    }

    // 3. Zalo Bot questions
    if (q.includes('zalo') || q.includes('bot') || q.includes('tin nhắn') || q.includes('chào buổi sáng') || q.includes('morning')) {
      return `Hệ thống **Zalo Bot** hỗ trợ bàn giao và chăm sóc tự động:\n\n` +
             `* **Bàn giao Lead**: Mỗi khi có lead được định tuyến cho Sale, Zalo Bot sẽ gửi ngay thông tin chi tiết (Tên, SĐT, Email, Nguồn, Ghi chú) trực tiếp đến chat ID Zalo của Sale đó.\n` +
             `* **Gom tin nhắn chào buổi sáng**: Nếu ngoài giờ làm việc Sale nhận được nhiều hơn 1 data chờ, khi bắt đầu giờ làm hôm sau Zalo Bot sẽ gửi một tin nhắn tổng hợp chào buổi sáng (ví dụ: *"Chúc buổi sáng vui vẻ! Đêm qua bạn có 3 data..."*), sau đó mới gửi chi tiết từng data.\n` +
             `* **Cài đặt**: Bạn có thể bật/tắt nhận báo cáo lỗi hoặc cấu hình Zalo chat ID của Admin/Sale tại mục **Tài khoản** hoặc **Tư vấn viên**.`;
    }

    // 4. Routing Rules / Rounds questions
    if (q.includes('quy tắc') || q.includes('chia số') || q.includes('định tuyến') || q.includes('rule') || q.includes('vòng xoay') || q.includes('round')) {
      return `Quy trình **Định tuyến & Chia số (Routing Rules & Rounds)**:\n\n` +
             `* **Định tuyến (Rules)**: Khi lead từ Google Sheets hoặc Landing Page đẩy về, hệ thống sẽ chạy qua các Rule có độ ưu tiên từ cao đến thấp. Mỗi rule chứa các điều kiện so khớp (VD: Nguồn chứa "Ads", Loại là "Hot"...). Nếu khớp, lead sẽ đi vào Vòng xoay (Round) tương ứng.\n` +
             `* **Vòng xoay (Rounds)**: Là nhóm các Sale nhận số. Hệ thống chia theo thuật toán **Round-robin** (xoay vòng) kết hợp tỉ lệ nhận (\`receive_ratio\`), đền bù (\`compensation_count\`), và chế độ nhận data mỗi lượt (\`data_per_turn\`).\n` +
             `* **Giờ làm việc**: Sale ngoài giờ làm sẽ bị tạm giữ lead (\`pending_work_hours\`) và được tự động giải phóng khi đến giờ làm việc ngày hôm sau.`;
    }

    // 5. General ticket / report error questions
    if (q.includes('ticket') || q.includes('báo lỗi') || q.includes('đền bù') || q.includes('lỗi dữ liệu') || q.includes('khiếu nại')) {
      return `Quy trình **Báo cáo lỗi & Đền bù (Ticket System)**:\n\n` +
             `1. **Gửi báo cáo**: Khi Sale nhận phải data bị lỗi (sai số, không liên lạc được, thuê bao...), Sale có thể gửi Ticket báo cáo lỗi trực tiếp từ Sale Portal.\n` +
             `2. **Duyệt đền bù**: Admin sẽ nhận được thông báo đỏ trên Header. Admin vào trang **Báo cáo lỗi (Tickets)** để xem xét lý do, liên hệ và duyệt đền bù (cộng thêm lượt nhận data cho Sale trong vòng xoay) hoặc từ chối đền bù.\n` +
             `3. **Giải quyết**: Khi duyệt, hệ thống sẽ tự động bù lượt nhận cho Sale vào lần phân bổ tiếp theo.`;
    }

    // 6. Google Sheets sync questions
    if (q.includes('sheet') || q.includes('đồng bộ') || q.includes('cron') || q.includes('kết nối') || q.includes('excel')) {
      return `Hệ thống **Đồng bộ Google Sheets (Sheet Connections)**:\n\n` +
             `* **Kết nối**: Admin cấu hình ID bảng tính và tên sheet tại mục **Kết nối Sheets**, sau đó ánh xạ các cột (Tên, SĐT, Email...) vào các trường của hệ thống.\n` +
             `* **Đồng bộ tự động**: Tiến trình nền (\`cron_sync.php\`) sẽ tự động quét qua các sheet hoạt động mỗi 2-5 phút, chỉ lấy những dòng dữ liệu mới (dựa trên thuật toán mã hóa Row Hash để không trùng lặp) và chia cho Sale.\n` +
             `* **Chế độ Silent (Im lặng)**: Bạn có thể chọn chế độ chỉ đồng bộ check trùng mà không chia số cho các sheet lưu trữ lịch sử.`;
    }

    // Default fallback
    return `Tôi chưa hiểu rõ câu hỏi của bạn. 🤖\n\nTôi có thể hỗ trợ bạn tốt nhất về các chủ đề sau:\n` +
           `* 📊 **Số liệu thống kê hôm nay**: tổng số, đã chia, trùng, lỗi, blacklist.\n` +
           `* 🛡️ **Hệ thống Blacklist**: chặn số tự động, import Excel.\n` +
           `* 💬 **Zalo Bot**: gửi data tự động, tin nhắn tổng hợp chào buổi sáng.\n` +
           `* ⚙️ **Quy tắc chia số (Rules/Rounds)**: xoay vòng, đền bù, giờ làm việc.\n` +
           `* 🎫 **Ticket báo lỗi**: đền bù lượt chia cho Sale.\n\n` +
           `Bạn có thể gõ rõ từ khóa hoặc click vào các gợi ý bên dưới nhé!`;
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
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999 }}>
      {/* CSS Styles injection */}
      <style>{`
        .pulse-chatbot {
          animation: pulse-ring-chatbot 2s infinite;
        }
        @keyframes pulse-ring-chatbot {
          0% {
            box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.7);
          }
          70% {
            box-shadow: 0 0 0 10px rgba(99, 102, 241, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(99, 102, 241, 0);
          }
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
      `}</style>

      {/* Floating Chat Bubble */}
      <button
        onClick={() => setIsOpen(true)}
        style={{
          width: 54,
          height: 54,
          borderRadius: '50%',
          background: 'white',
          padding: 0,
          cursor: 'pointer',
          border: 'none',
          boxShadow: '0 4px 18px rgba(99, 102, 241, 0.3)',
          opacity: isOpen ? 0 : 1,
          transform: buttonTransform,
          pointerEvents: isOpen ? 'none' : 'auto',
          transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease',
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
              parent.style.background = 'linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))';
              if (!parent.querySelector('.btn-fallback-icon')) {
                const fallback = document.createElement('span');
                fallback.className = 'btn-fallback-icon';
                fallback.innerHTML = '🤖';
                fallback.style.fontSize = '24px';
                parent.appendChild(fallback);
              }
            }
          }}
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            objectFit: 'cover',
            border: '2.5px solid var(--color-primary)',
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
        style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: 'min(440px, 90vw)',
          height: 'min(520px, 80vh)',
          borderRadius: '16px',
          background: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(20px) saturate(190%)',
          WebkitBackdropFilter: 'blur(20px) saturate(190%)',
          border: '1px solid rgba(255, 255, 255, 0.4)',
          boxShadow: '0 12px 36px rgba(0, 0, 0, 0.12)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          opacity: isOpen ? 1 : 0,
          transform: isOpen ? 'scale(1) translate3d(0, 0, 0)' : 'scale(0.3) translate3d(0, 40px, 0)',
          transformOrigin: 'bottom right',
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.35s ease',
          willChange: 'transform, opacity'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '12px 16px',
            background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {renderBotAvatar(32, true)}
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 700 }}>Trợ lý AI Domation</div>
              <div style={{ fontSize: '0.6875rem', opacity: 0.85, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                Đang trực tuyến
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: 'none',
              borderRadius: '50%',
              width: 26,
              height: 26,
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

        {/* Messages Container */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          {messages.map(msg => (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                alignItems: 'flex-start',
                gap: 8
              }}
            >
              {msg.sender === 'bot' && renderBotAvatar(28, false)}
              
              <div
                style={{
                  maxWidth: '80%',
                  padding: '10px 14px',
                  borderRadius: msg.sender === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                  background: msg.sender === 'user' ? 'var(--color-primary)' : 'var(--color-surface)',
                  color: msg.sender === 'user' ? 'white' : 'var(--color-text)',
                  fontSize: '0.8125rem',
                  lineHeight: '1.45',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                  border: msg.sender === 'user' ? 'none' : '1px solid var(--color-border-light)'
                }}
              >
                {renderText(msg.text)}
              </div>
            </div>
          ))}
          
          {isTyping && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 36 }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>AI đang trả lời...</span>
              <span className="dot-typing" />
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick suggestions */}
        <div
          style={{
            padding: '6px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            borderTop: '1px solid var(--color-border-light)',
            background: 'rgba(255,255,255,0.4)'
          }}
        >
          <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Gợi ý hỏi nhanh:</div>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }} className="hide-scrollbar">
            {quickPrompts.map((p, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(p.text)}
                style={{
                  flexShrink: 0,
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '20px',
                  padding: '4px 10px',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  color: 'var(--color-text-light)',
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--color-primary)';
                  e.currentTarget.style.color = 'var(--color-primary)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--color-border-light)';
                  e.currentTarget.style.color = 'var(--color-text-light)';
                }}
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
            padding: '10px 12px 14px 12px',
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            background: 'var(--color-surface)',
            borderTop: '1px solid var(--color-border-light)'
          }}
        >
          <input
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            placeholder="Nhập câu hỏi của bạn..."
            style={{
              flex: 1,
              padding: '8px 12px',
              border: '1px solid var(--color-border)',
              borderRadius: '20px',
              fontSize: '0.8125rem',
              outline: 'none',
              background: 'var(--color-bg)',
              color: 'var(--color-text)'
            }}
          />
          <button
            type="submit"
            disabled={!inputValue.trim()}
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: inputValue.trim() ? 'var(--color-primary)' : 'var(--color-border-light)',
              color: inputValue.trim() ? 'white' : 'var(--color-text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: inputValue.trim() ? 'pointer' : 'default',
              border: 'none',
              outline: 'none',
              transition: 'all 0.2s'
            }}
          >
            <Send size={14} />
          </button>
        </form>
      </div>
    </div>
  );
};
