import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  FileCheck2,
  FilePlus2,
  FileSearch,
  FolderKanban,
  GitCompareArrows,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  PackageCheck,
  ShieldCheck,
  X,
} from 'lucide-react';
import { PreviewNoticeBar } from '../components/items/PreviewNoticeBar';
import {
  useCurrentUserQuery,
  useLogoutMutation,
} from '../hooks/useCampusFindQueries';

const STUDENT_NAV_ITEMS = [
  { to: '/student', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/student/report-lost', label: 'Report Lost Item', icon: FileSearch, end: false },
  { to: '/student/report-found', label: 'Report Found Item', icon: FilePlus2, end: false },
  { to: '/student/browse', label: 'Browse Items', icon: PackageCheck, end: false },
  { to: '/student/matches', label: 'Potential Matches', icon: GitCompareArrows, end: false },
  { to: '/student/reports', label: 'My Reports', icon: FolderKanban, end: false },
  { to: '/student/claims', label: 'My Claims', icon: FileCheck2, end: false },
];

const ROUTE_TITLES: Record<string, string> = {
  '/student': 'Student Dashboard',
  '/student/report-lost': 'Report Lost Item',
  '/student/report-found': 'Report Found Item',
  '/student/browse': 'Browse Campus Inventory',
  '/student/matches': 'Potential Matches',
  '/student/reports': 'My Reports',
  '/student/claims': 'My Claims',
  '/student/claims/new': 'Submit Ownership Claim',
};

export function StudentLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { data: currentUser } = useCurrentUserQuery();
  const logoutMutation = useLogoutMutation();

  const currentTitle = location.pathname.startsWith('/student/items/')
    ? 'Item Record Details'
    : location.pathname.startsWith('/student/claims/new')
      ? 'Submit Ownership Claim'
      : ROUTE_TITLES[location.pathname] ?? 'Student Portal';

  const handleLogout = async () => {
    setSidebarOpen(false);
    try {
      await logoutMutation.mutateAsync();
    } finally {
      navigate('/login');
    }
  };

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between bg-white border-r border-[#E2E8F0]">
      <div>
        <div className="flex h-16 items-center justify-between border-b border-[#E2E8F0] px-5">
          <Link
            to="/"
            className="text-base font-bold tracking-tight text-[#0F172A] whitespace-nowrap"
          >
            CampusFind
          </Link>
          <span className="text-[11px] font-medium text-[#64748B] whitespace-nowrap">
            Student Portal
          </span>
        </div>

        <nav aria-label="Student workspace navigation" className="space-y-1 p-3">
          {STUDENT_NAV_ITEMS.map((item) => {
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
                      ? 'bg-[#EFF6FF] text-[#1E40AF]'
                      : 'text-[#475569] hover:bg-[#F8FAFC] hover:text-[#0F172A]'
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

      <div className="space-y-3 border-t border-[#E2E8F0] p-4">
        {currentUser ? (
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-[#0F172A] truncate">
              {currentUser.fullName}
            </p>
            <p className="text-xs text-[#64748B] font-mono tabular-nums truncate">
              {currentUser.campusId} · {currentUser.role}
            </p>
          </div>
        ) : (
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-[#0F172A]">Not Signed In</p>
            <p className="text-xs text-[#64748B]">
              Sign in to file or manage reports.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-1.5 pt-1 text-xs">
          {currentUser?.role === 'ADMIN' ? (
            <Link
              to="/admin"
              onClick={() => setSidebarOpen(false)}
              className="inline-flex items-center gap-2 rounded-md px-2.5 py-2 font-medium text-[#334155] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-[#1E40AF]" aria-hidden="true" />
              <span>Admin Console</span>
            </Link>
          ) : null}

          {currentUser ? (
            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={logoutMutation.isPending}
              className="inline-flex items-center gap-2 rounded-md px-2.5 py-2 text-left font-medium text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A] cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{logoutMutation.isPending ? 'Signing Out...' : 'Sign Out'}</span>
            </button>
          ) : (
            <Link
              to="/login"
              onClick={() => setSidebarOpen(false)}
              className="inline-flex items-center gap-2 rounded-md px-2.5 py-2 font-medium text-[#1E40AF] hover:bg-[#EFF6FF]"
            >
              <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Sign In</span>
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
            className="fixed inset-0 bg-[#0F172A]/40"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-[264px] max-w-[80vw] h-full">
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar"
              className="absolute right-3 top-3.5 flex h-9 w-9 items-center justify-center rounded-md text-[#64748B] hover:bg-[#F1F5F9]"
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
              aria-label="Open navigation sidebar"
              className="flex h-10 w-10 items-center justify-center rounded-md border border-[#E2E8F0] text-[#0F172A] lg:hidden cursor-pointer"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>

            <div className="flex items-center gap-2 text-xs sm:text-sm min-w-0">
              <Link
                to="/student"
                className="text-[#64748B] hover:text-[#0F172A] whitespace-nowrap shrink-0"
              >
                Student Portal
              </Link>
              <span className="text-[#94A3B8]" aria-hidden="true">
                /
              </span>
              <span className="font-medium text-[#0F172A] truncate">{currentTitle}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {!currentUser ? (
              <Link
                to="/login"
                className="rounded-md border border-[#CBD5E1] bg-white px-3 py-2 text-xs font-medium text-[#0F172A] hover:bg-[#F8FAFC] whitespace-nowrap shrink-0"
              >
                Sign In
              </Link>
            ) : null}
            <Link
              to="/student/report-lost"
              className="rounded-md bg-[#1E40AF] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#1D4ED8] whitespace-nowrap shrink-0 transition-colors"
            >
              Report Lost
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
