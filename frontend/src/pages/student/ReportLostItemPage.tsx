import { Link } from 'react-router-dom';
import { ItemReportForm } from '../../components/items/ItemReportForm';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/DataStates';

export function ReportLostItemPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Report Lost Item"
        description="Log details about a misplaced belonging so campus desks and smart matching can flag potential recoveries."
        actions={
          <Link to="/student/browse">
            <Button variant="outline" size="sm">
              Check Found Inventory First
            </Button>
          </Link>
        }
      />

      <ItemReportForm reportType="LOST" />
    </div>
  );
}
