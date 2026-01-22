
import React from 'react';

interface TacticalButtonProps {
  onClick: () => void;
  label: string;
  icon?: React.ReactNode;
  color?: string;
  variant?: 'primary' | 'secondary' | 'danger';
  className?: string;
  disabled?: boolean;
}

export const TacticalButton: React.FC<TacticalButtonProps> = ({ 
  onClick, label, icon, color, variant = 'primary', className = '', disabled = false 
}) => {
  const baseClasses = "flex items-center justify-center gap-2 px-6 py-3 mono font-bold text-sm tracking-widest uppercase transition-all duration-200 border-2 active:scale-95";
  
  const getVariantClasses = () => {
    switch (variant) {
      case 'danger':
        return "bg-[#ff2e2e]/10 border-[#ff2e2e] text-[#ff2e2e] hover:bg-[#ff2e2e] hover:text-white";
      case 'secondary':
        return "bg-white/5 border-white/20 text-white/70 hover:border-white/50 hover:text-white";
      default:
        return `bg-[${color}]/10 border-[${color}] text-[${color}] hover:bg-[${color}] hover:text-white`;
    }
  };

  const dynamicStyle = color ? {
    borderColor: color,
    color: color,
    backgroundColor: `${color}1A`, // 10% opacity hex
  } : {};

  return (
    <button 
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variant === 'primary' ? '' : getVariantClasses()} ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      style={variant === 'primary' ? dynamicStyle : {}}
    >
      {icon && <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">{icon}</svg>}
      {label}
    </button>
  );
};
