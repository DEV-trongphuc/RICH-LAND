import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../api/axios';

interface User {
  id: number;
  full_name: string;
  role: string;
}

interface MentionInputProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string;
  onChange: (e: any) => void;
}

export const MentionInput: React.FC<MentionInputProps> = ({ value, onChange, ...props }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [cursorPos, setCursorPos] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Fetch users for mentions
    api.get('/users').then(res => {
      setUsers(res.data.data || []);
    }).catch(console.error);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    onChange(e);

    const cursor = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursor);
    
    // Check if we are typing a mention
    const match = textBeforeCursor.match(/@([a-zA-Z0-9_\u00C0-\u1EF9]*)$/);
    if (match) {
      setSearchQuery(match[1].toLowerCase());
      setShowDropdown(true);
      setCursorPos(cursor - match[0].length); // position of the '@'
    } else {
      setShowDropdown(false);
    }
  };

  const handleSelectUser = (user: User) => {
    if (cursorPos === null || !textareaRef.current) return;
    
    const val = value;
    const beforeMention = val.slice(0, cursorPos);
    const afterMention = val.slice(textareaRef.current.selectionStart);
    
    const newValue = `${beforeMention}@${user.full_name.replace(/\s+/g, '_')} ${afterMention}`;
    
    // Simulate an event to pass to parent's onChange
    const fakeEvent = {
      target: { value: newValue }
    } as any;
    
    onChange(fakeEvent);
    setShowDropdown(false);
    
    // Focus back
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        // Set cursor after the inserted name
        const newPos = cursorPos + user.full_name.replace(/\s+/g, '_').length + 2;
        textareaRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  };

  const filteredUsers = users.filter(u => 
    u.full_name.toLowerCase().includes(searchQuery) || 
    u.role.toLowerCase().includes(searchQuery)
  );

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        {...props}
      />
      <AnimatePresence>
        {showDropdown && filteredUsers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            style={{
              position: 'absolute',
              bottom: '100%',
              left: 0,
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)',
              maxHeight: '150px',
              overflowY: 'auto',
              zIndex: 100,
              width: '100%',
              marginBottom: '4px'
            }}
          >
            {filteredUsers.map(u => (
              <div
                key={u.id}
                onClick={() => handleSelectUser(u)}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  borderBottom: '1px solid var(--color-border-light)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--color-primary-light)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold' }}>
                  {u.full_name[0]}
                </div>
                <div style={{ flex: 1, fontSize: '0.85rem', fontWeight: 600 }}>{u.full_name}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{u.role}</div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
