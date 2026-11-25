import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminLayout } from '../layouts/AdminLayout';
import { PublicLayout } from '../layouts/PublicLayout';
import { StudentLayout } from '../layouts/StudentLayout';
import { AdminDashboardPage } from '../pages/admin/AdminDashboardPage';
import { AuditHistoryPage } from '../pages/admin/AuditHistoryPage';
import { ManageReportsPage } from '../pages/admin/ManageReportsPage';
import { ReviewClaimsPage } from '../pages/admin/ReviewClaimsPage';
import { LandingPage } from '../pages/public/LandingPage';
import { LoginPage } from '../pages/public/LoginPage';
import { RegisterPage } from '../pages/public/RegisterPage';
import { BrowseItemsPage } from '../pages/student/BrowseItemsPage';
import { ItemDetailsPage } from '../pages/student/ItemDetailsPage';
import { MyClaimsPage } from '../pages/student/MyClaimsPage';
import { MyReportsPage } from '../pages/student/MyReportsPage';
import { PotentialMatchesPage } from '../pages/student/PotentialMatchesPage';
import { ReportFoundItemPage } from '../pages/student/ReportFoundItemPage';
import { ReportLostItemPage } from '../pages/student/ReportLostItemPage';
import { StudentDashboardPage } from '../pages/student/StudentDashboardPage';
import { SubmitClaimPage } from '../pages/student/SubmitClaimPage';

export function AppRoutes() {
  return (
    <Routes>
      {/* Public Pages */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      {/* Student Portal Pages */}
      <Route path="/student" element={<StudentLayout />}>
        <Route index element={<StudentDashboardPage />} />
        <Route path="report-lost" element={<ReportLostItemPage />} />
        <Route path="report-found" element={<ReportFoundItemPage />} />
        <Route path="browse" element={<BrowseItemsPage />} />
        <Route path="items/:id" element={<ItemDetailsPage />} />
        <Route path="matches" element={<PotentialMatchesPage />} />
        <Route path="reports" element={<MyReportsPage />} />
        <Route path="claims" element={<MyClaimsPage />} />
        <Route path="claims/new" element={<SubmitClaimPage />} />
        <Route path="claims/new/:itemId" element={<SubmitClaimPage />} />
      </Route>

      {/* Admin Console Pages */}
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminDashboardPage />} />
        <Route path="reports" element={<ManageReportsPage />} />
        <Route path="claims" element={<ReviewClaimsPage />} />
        <Route path="audit" element={<AuditHistoryPage />} />
      </Route>

      {/* Fallback Redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
