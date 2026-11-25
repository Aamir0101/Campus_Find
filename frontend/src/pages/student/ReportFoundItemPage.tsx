import { Link } from 'react-router-dom';
import { ItemReportForm } from '../../components/items/ItemReportForm';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/DataStates';

export function ReportFoundItemPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Report Found Item"
        description="Register an item you located on campus and select whether you are handing it in to a Campus Safety desk."
        actions={
          <Link to="/student/reports">
            <Button variant="outline" size="sm">
              View My Reports
            </Button>
          </Link>
        }
      />

      <ItemReportForm reportType="FOUND" />
    </div>
  );
}
