import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

function FormsSection() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  return (
    <section aria-labelledby="forms-title" className="space-y-4">
      <div>
        <h2 className="text-section-title font-semibold tracking-tight" id="forms-title">
          Form controls
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Labeled controls, help text, and validation are associated for assistive technology.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Inputs and selection</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <FormField
            description="Used only as an illustrative field in this showcase."
            htmlFor="sample-name"
            label="Workspace name"
            required
          >
            {(controlProps) => (
              <Input
                {...controlProps}
                autoComplete="off"
                placeholder="e.g. Product team"
              />
            )}
          </FormField>
          <FormField htmlFor="sample-role" label="Role">
            {(controlProps) => (
              <Select defaultValue="member">
                <SelectTrigger aria-label="Role" {...controlProps}>
                  <SelectValue placeholder="Choose a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="lead">Team lead</SelectItem>
                  <SelectItem value="manager">Project manager</SelectItem>
                </SelectContent>
              </Select>
            )}
          </FormField>
          <FormField htmlFor="sample-description" label="Description">
            {(controlProps) => (
              <Textarea {...controlProps} placeholder="Add a short description" rows={3} />
            )}
          </FormField>
          <div className="space-y-5">
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">Notifications</legend>
              <RadioGroup aria-label="Notification frequency" defaultValue="daily">
                <div className="flex items-center gap-2">
                  <RadioGroupItem id="frequency-daily" value="daily" />
                  <Label htmlFor="frequency-daily">Daily summary</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem id="frequency-instant" value="instant" />
                  <Label htmlFor="frequency-instant">As they happen</Label>
                </div>
              </RadioGroup>
            </fieldset>
            <div className="flex items-center gap-2">
              <Checkbox defaultChecked id="sample-checkbox" />
              <Label htmlFor="sample-checkbox">Include me in workspace updates</Label>
            </div>
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="sample-switch">Email notifications</Label>
              <Switch
                checked={notificationsEnabled}
                id="sample-switch"
                onCheckedChange={setNotificationsEnabled}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

export { FormsSection };
