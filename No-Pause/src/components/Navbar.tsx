import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { navTabs } from '@/lib/navTabs';

export const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
      <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 px-2.5 py-2 bg-surface-elevated/92 backdrop-blur-xl border border-border/80 rounded-full shadow-float">
      {navTabs.map((item) => {
        const isActive = item.isActive(location.pathname);
        const Icon = item.icon;
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-full font-sans text-sm font-medium btn-press',
              'transition-colors duration-200',
              isActive
                ? 'bg-primary text-primary-foreground night-glow'
                : 'text-muted-foreground hover:text-foreground hover:bg-surface-card'
            )}
          >
            <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
            {isActive && <span>{item.label}</span>}
          </button>
        );
      })}
    </nav>
  );
};
