import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/shared/lib/utils';
import { navTabs } from '@/shared/lib/navTabs';

export const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
      <nav className="fixed bottom-[calc(0.625rem+env(safe-area-inset-bottom))] sm:bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 px-1.5 sm:px-2.5 py-2 bg-surface-elevated/92 backdrop-blur-xl border border-border/80 rounded-full shadow-float">
      {navTabs.map((item) => {
        const isActive = item.isActive(location.pathname);
        const Icon = item.icon;
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={cn(
	              'flex min-w-[66px] sm:min-w-[84px] items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2.5 rounded-full font-sans text-xs sm:text-sm font-medium btn-press',
              'transition-colors duration-200',
              isActive
                ? 'bg-primary text-primary-foreground night-glow'
                : 'text-muted-foreground hover:text-foreground hover:bg-surface-card'
            )}
          >
            <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
	            <span className={cn('transition-opacity', isActive ? 'opacity-100' : 'sr-only sm:not-sr-only sm:opacity-0')}>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
