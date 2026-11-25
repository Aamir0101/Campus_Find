import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Button } from '../components/ui/Button';

export function PublicLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FA] text-[#1E293B]">
      <header className="sticky top-0 z-40 border-b border-[#E2E8F0] bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="text-lg font-bold tracking-tight text-[#0F172A] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#1E40AF]"
          >
            CampusFind
          </Link>

          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-[#475569]"
          >
            <a
              href="/#features"
              className="hover:text-[#0F172A] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Capabilities
            </a>
            <a
              href="/#workflow"
              className="hover:text-[#0F172A] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Verification
            </a>
            <NavLink
              to="/student"
              className={({ isActive }) =>
                `hover:text-[#0F172A] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
                  isActive ? 'text-[#0F172A] font-semibold' : ''
                }`
              }
            >
              Student Portal
            </NavLink>
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `hover:text-[#0F172A] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
                  isActive ? 'text-[#0F172A] font-semibold' : ''
                }`
              }
            >
              Admin Console
            </NavLink>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <Link to="/login" className="hidden sm:inline-block">
              <Button size="sm">Sign In</Button>
            </Link>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
              className="flex h-10 w-10 items-center justify-center rounded-md border border-[#E2E8F0] text-[#0F172A] md:hidden cursor-pointer"
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Menu className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {mobileMenuOpen ? (
          <div className="border-t border-[#E2E8F0] bg-white px-4 py-4 md:hidden">
            <nav className="flex flex-col space-y-2 text-sm font-medium text-[#334155]">
              <a
                href="/#features"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-md px-3 py-2.5 hover:bg-[#F1F5F9]"
              >
                Capabilities
              </a>
              <a
                href="/#workflow"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-md px-3 py-2.5 hover:bg-[#F1F5F9]"
              >
                Verification
              </a>
              <Link
                to="/student"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-md px-3 py-2.5 hover:bg-[#F1F5F9]"
              >
                Student Portal
              </Link>
              <Link
                to="/admin"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-md px-3 py-2.5 hover:bg-[#F1F5F9]"
              >
                Admin Console
              </Link>
              <div className="pt-2">
                <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                  <Button className="w-full">Sign In</Button>
                </Link>
              </div>
            </nav>
          </div>
        ) : null}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-[#E2E8F0] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[#0F172A]">CampusFind</p>
            <p className="text-xs text-[#64748B]">
              University Lost, Found &amp; Verified Property Recovery System
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs text-[#475569]">
            <Link to="/student/browse" className="hover:text-[#0F172A]">
              Browse Inventory
            </Link>
            <Link to="/student/report-lost" className="hover:text-[#0F172A]">
              Report Lost Item
            </Link>
            <Link to="/register" className="hover:text-[#0F172A]">
              Create Account
            </Link>
            <Link to="/admin" className="hover:text-[#0F172A]">
              Campus Safety Desk
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
