import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarGroup } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Metadata } from '@/components/ui/metadata';
import { Pagination } from '@/components/ui/pagination';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { StatusBadge } from '@/components/ui/status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { UserIdentity } from '@/components/ui/user-identity';
import { UserMenu } from '@/components/navigation/user-menu';

const sampleRows = [
  { name: 'Atlas workspace', owner: 'Alex Morgan', status: 'active' as const, progress: 68 },
  { name: 'Northstar planning', owner: 'Sam Rivera', status: 'pending' as const, progress: 32 },
  { name: 'Launch readiness', owner: 'Jamie Chen', status: 'planned' as const, progress: 12 },
];

function DataDisplaySection() {
  const [currentPage, setCurrentPage] = useState(2);

  return (
    <section aria-labelledby="data-display-title" className="space-y-4">
      <div>
        <h2 className="text-section-title font-semibold tracking-tight" id="data-display-title">
          Data display
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Illustrative static content only. These examples do not represent real users or connect to
          the backend.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Identity and metadata</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <UserIdentity detail="Illustrative role" name="Alex Morgan" />
            <div className="flex items-center gap-4">
              <AvatarGroup aria-label="Three illustrative team members">
                <Avatar>
                  <AvatarFallback>AM</AvatarFallback>
                </Avatar>
                <Avatar>
                  <AvatarFallback>SR</AvatarFallback>
                </Avatar>
                <Avatar>
                  <AvatarFallback>JC</AvatarFallback>
                </Avatar>
              </AvatarGroup>
              <Badge variant="secondary">+2</Badge>
            </div>
            <UserMenu detail="Illustrative account" name="Alex Morgan" />
          </div>
          <Metadata
            items={[
              { label: 'Workspace', value: 'Atlas workspace' },
              { label: 'Members', value: '12 illustrative members' },
              { label: 'Status', value: <StatusBadge status="active" /> },
              { label: 'Completion', value: '68%' },
            ]}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Table, progress, and pagination</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <Table>
            <caption className="sr-only">Illustrative workspace progress samples</caption>
            <TableHeader>
              <TableRow>
                <TableHead>Workspace</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="min-w-32">Progress</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sampleRows.map((row) => (
                <TableRow key={row.name}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>{row.owner}</TableCell>
                  <TableCell>
                    <StatusBadge status={row.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Progress
                        aria-label={`${row.name} illustrative completion`}
                        className="max-w-28"
                        value={row.progress}
                      />
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {row.progress}%
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Separator />
          <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p aria-live="polite" className="text-sm text-muted-foreground">
              Showcase pagination — page {currentPage} of 8
            </p>
            <Pagination currentPage={currentPage} onPageChange={setCurrentPage} totalPages={8} />
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

export { DataDisplaySection };
