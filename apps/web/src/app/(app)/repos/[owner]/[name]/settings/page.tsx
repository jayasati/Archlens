import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function RepoSettingsPage() {
  return (
    <Card data-testid="settings-stub">
      <CardHeader>
        <CardTitle>Settings</CardTitle>
        <CardDescription>
          Repository settings (default branch, scan triggers, integrations) will live here.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Coming in a future phase.</p>
      </CardContent>
    </Card>
  );
}
