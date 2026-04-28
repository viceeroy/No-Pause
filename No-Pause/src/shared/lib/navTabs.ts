import type { ElementType } from 'react';
import { Home, BarChart3 } from 'lucide-react';

export type NavTab = {
  path: string;
  label: string;
  icon: ElementType;
  isActive: (pathname: string) => boolean;
};

export const navTabs: NavTab[] = [
  {
    path: '/',
    label: 'Home',
    icon: Home,
    isActive: (pathname) => pathname === '/',
  },
  {
    path: '/stats',
    label: 'Stats',
    icon: BarChart3,
    isActive: (pathname) => pathname.startsWith('/stats'),
  },
];

export const getNavTabIndex = (pathname: string) =>
  navTabs.findIndex((tab) => tab.isActive(pathname));
