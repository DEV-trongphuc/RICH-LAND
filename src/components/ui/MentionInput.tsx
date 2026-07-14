import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';
import { Avatar } from './Avatar';

interface User {
  id: number;
  full_name: string;
  role: string;
  avatar_url?: string;
  avatar?: string;
}

interface MentionInputProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string;
  onChange: (e: any) => void;
  users?: User[];
}

export const MentionInput: React.FC<MentionInputProps> = ({ value, onChange, users: propUsers, ...props }) => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [cursorPos, setCursorPos] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isTeamMember = (u: User) => {
    if (!u || !u.role) return false;
    const r = u.role.toLowerCase();
    return ['admin', 'superadmin', 'super_admin', 'sales', 'sale', 'manager', 'assistant', 'telesale', 'prescreener', 'director', 'staff', 'employee'].includes(r);
  };

  useEffect(() => {
    if (propUsers && propUsers.length > 0) {
      console.log("MentionInput using propUsers:", propUsers);
      setUsers(propUsers.filter(isTeamMember));
      return;
    }
    // Fetch users for mentions
    console.log("MentionInput fetching users from API...");
    const isSaleOrManager = currentUser?.role === 'sale' || currentUser?.role === 'manager';
    const usersEndpoint = isSaleOrManager ? '/get_consultants?all=1' : '/users';
    api.get(usersEndpoint).then(res => {
      const d = res.data.data;
      const list = Array.isArray(d) ? d : (d?.items || []);
      console.log("MentionInput API response list:", list);
      const mapped = list.map((u: any) => ({
        ...u,
        id: u.id,
        full_name: u.full_name || u.name || u.username || '',
        avatar_url: u.avatar_url || u.avatar || '',
        role: u.role || 'sale'
      }));
      const filtered = mapped.filter(isTeamMember);
      setUsers(filtered);
    }).catch(err => {
      console.error("MentionInput failed to load users:", err);
      setUsers([]);
    });
  }, [propUsers, currentUser?.role]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showDropdown && textareaRef.current) {
        const wrapper = textareaRef.current.parentElement;
        if (wrapper && !wrapper.contains(e.target as Node)) {
          setShowDropdown(false);
        }
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showDropdown]);

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
    const fullName = user.full_name || 'user';
    
    const newValue = `${beforeMention}@${fullName.replace(/\s+/g, '_')} ${afterMention}`;
    
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
        const newPos = cursorPos + fullName.replace(/\s+/g, '_').length + 2;
        textareaRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  };

  const filteredUsers = users.filter(u => {
    // Do not show the currently logged in user
    if (currentUser && u.id === currentUser.id) {
      return false;
    }
    const name = u.full_name ? String(u.full_name).toLowerCase() : '';
    const role = u.role ? String(u.role).toLowerCase() : '';
    return name.includes(searchQuery) || role.includes(searchQuery);
  });

  const stringToColor = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = [
      '#3b82f6', // Blue
      '#ef4444', // Red
      '#10b981', // Green
      '#f59e0b', // Amber
      '#8b5cf6', // Violet
      '#ec4899', // Pink
      '#14b8a6', // Teal
      '#f97316'  // Orange
    ];
    const idx = Math.abs(hash) % colors.length;
    return colors[idx];
  };

  return (
    <div style={{ position: 'relative', flex: 1, display: 'flex', minWidth: 0 }}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        className={`form-textarea ${props.className || ''}`}
        {...props}
        style={{ width: '100%', ...props.style }}
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
            {filteredUsers.map(u => {
              const fullName = u.full_name || 'Không tên';
              const roleName = u.role || 'user';
              const avatarColor = stringToColor(fullName);
              return (
                <div
                  key={u.id}
                  onClick={() => handleSelectUser(u)}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    borderBottom: '1px solid var(--color-border-light)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: 'var(--color-text)'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <Avatar name={fullName} src={u.avatar_url || u.avatar} size={20} />
                  <div style={{ flex: 1, fontSize: '0.85rem', fontWeight: 600 }}>{fullName}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{roleName}</div>
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
