import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  ClipboardCheck,
  FileSpreadsheet,
  History,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  UserRound,
  X,
} from 'lucide-react';
import { PreviewNoticeBar } from '../components/items/PreviewNoticeBar';
import {
  useCurrentUserQuery,
  useLogoutMutation,
} from '../hooks/useCampusFindQueries';

const ADMIN_NAV_ITEMS = [
  { to: '/admin', label: 'Admin Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/reports', label: 'Manage Reports', icon: FileSpreadsheet, end: false },
  { to: '/admin/claims', label: 'Review Claims', icon: ClipboardCheck, end: false },
  { to: '/admin/audit', label: 'Audit History', icon: History, end: false },
];

const ADMIN_ROUTE_TITLES: Record<string, string> = {
  '/admin': 'Admin Dashboard',
  '/admin/reports': 'Manage Reports',
  '/admin/claims': 'Review Claims',
  '/admin/audit': 'Audit History',
};

export function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { data: currentUser } = useCurrentUserQuery();
  const logoutMutation = useLogoutMutation();
  const currentTitle = ADMIN_ROUTE_TITLES[location.pathname] ?? 'Admin Console';

  const handleLogout = async () => {
    setSidebarOpen(false);
    try {
      await logoutMutation.mutateAsync();
    } finally {
      navigate('/login');
    }
  };

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between bg-[#0F172A] text-[#E2E8F0]">
      <div>
        <div className="flex h-16 items-center justify-between border-b border-[#1E293B] px-5">
          <Link
            to="/"
            className="text-base font-bold tracking-tight text-white whitespace-nowrap"
          >
            CampusFind
          </Link>
          <span className="text-[11px] font-medium text-[#94A3B8] whitespace-nowrap">
            Admin Console
          </span>
        </div>

        <nav aria-label="Admin workspace navigation" className="space-y-1 p-3">
          {ADMIN_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-[#1E40AF] text-white'
                      : 'text-[#CBD5E1] hover:bg-[#1E293B] hover:text-white'
                  }`
                }
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      <div className="space-y-3 border-t border-[#1E293B] p-4">
        {currentUser ? (
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-white truncate">
              {currentUser.fullName}
            </p>
            <p className="text-xs text-[#94A3B8] font-mono tabular-nums truncate">
              {currentUser.campusId} · {currentUser.role}
            </p>
          </div>
        ) : (
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-white">Not Signed In</p>
            <p className="text-xs text-[#94A3B8]">
              Administrator authentication required.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-1.5 pt-1 text-xs">
          <Link
            to="/student"
            onClick={() => setSidebarOpen(false)}
            className="inline-flex items-center gap-2 rounded-md px-2.5 py-2 font-medium text-[#CBD5E1] hover:bg-[#1E293B] hover:text-white"
          >
            <UserRound className="h-3.5 w-3.5 text-[#93C5FD]" aria-hidden="true" />
            <span>Switch to Student Portal</span>
          </Link>
          {currentUser ? (
            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={logoutMutation.isPending}
              className="inline-flex items-center gap-2 rounded-md px-2.5 py-2 text-left font-medium text-[#94A3B8] hover:bg-[#1E293B] hover:text-white cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{logoutMutation.isPending ? 'Signing Out...' : 'Sign Out'}</span>
            </button>
          ) : (
            <Link
              to="/login"
              onClick={() => setSidebarOpen(false)}
              className="inline-flex items-center gap-2 rounded-md px-2.5 py-2 font-medium text-[#93C5FD] hover:bg-[#1E293B] hover:text-white"
            >
              <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Admin Sign In</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#F8F9FA] text-[#1E293B]">
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:block lg:w-[260px]">
        {sidebarContent}
      </aside>

      {sidebarOpen ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-[#0F172A]/45"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-[264px] max-w-[80vw] h-full">
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close admin sidebar"
              className="absolute right-3 top-3.5 flex h-9 w-9 items-center justify-center rounded-md text-[#94A3B8] hover:bg-[#1E293B] hover:text-white"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
            {sidebarContent}
          </aside>
        </div>
      ) : null}

      <div className="flex flex-1 flex-col lg:pl-[260px] min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-[#E2E8F0] bg-white px-4 sm:px-6 lg:h-16 lg:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open admin navigation sidebar"
              className="flex h-10 w-10 items-center justify-center rounded-md border border-[#E2E8F0] text-[#0F172A] lg:hidden cursor-pointer"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>

            <div className="flex items-center gap-2 text-xs sm:text-sm min-w-0">
              <Link
                to="/admin"
                className="text-[#64748B] hover:text-[#0F172A] whitespace-nowrap shrink-0"
              >
                Campus Safety Admin
              </Link>
              <span className="text-[#94A3B8]" aria-hidden="true">
                /
              </span>
              <span className="font-medium text-[#0F172A] truncate">{currentTitle}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/admin/claims"
              className="rounded-md bg-[#0F172A] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#1E293B] whitespace-nowrap shrink-0 transition-colors"
            >
              Review Claims
            </Link>
          </div>
        </header>

        <PreviewNoticeBar />

        <main className="flex-1 px-4 py-7 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
