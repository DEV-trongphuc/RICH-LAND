import React from 'react';
import styles from './EmptyCard.module.css';

interface EmptyCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  action?: React.ReactNode;
}

export const EmptyCard: React.FC<EmptyCardProps> = ({ icon, title, description, actionText, onAction, action }) => {
  return (
    <div className={styles.emptyCard}>
      <div className={styles.iconWrapper}>{icon}</div>
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.description}>{description}</p>
      {actionText && onAction && (
        <div className={styles.actionWrapper}>
          <button className="btn primary" onClick={onAction}>{actionText}</button>
        </div>
      )}
      {action && <div className={styles.actionWrapper}>{action}</div>}
    </div>
  );
};
