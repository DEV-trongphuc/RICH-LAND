import React from 'react';
import { AITrainingPanel } from '../components/ui/AITrainingPanel';
import { Brain } from 'lucide-react';

export const AITrainingPage: React.FC = () => {
  return (
    <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem', minHeight: '100vh', background: 'var(--color-bg-light)' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            background: 'linear-gradient(135deg, var(--color-primary) 0%, #660f17 100%)',
            color: 'white',
            padding: 12,
            borderRadius: 14,
            boxShadow: '0 4px 14px rgba(189, 29, 45, 0.25)'
          }}>
            <Brain size={28} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: 'var(--color-text)' }}>
              AI Knowledge Base
            </h1>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: '4px 0 0 0' }}>
              Huấn luyện tri thức doanh nghiệp, quản lý dữ liệu đối chiếu RAG và kiểm thử mô hình chatbot Gemini.
            </p>
          </div>
        </div>
      </div>

      {/* Main Training Panel Wrapper */}
      <div className="card" style={{ padding: '2rem', minHeight: '600px' }}>
        <AITrainingPanel />
      </div>
    </div>
  );
};
