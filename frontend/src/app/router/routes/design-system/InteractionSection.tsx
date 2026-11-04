import { useState } from 'react';
import { MoreHorizontal, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

function InteractionSection() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <section aria-labelledby="interactions-title" className="space-y-4">
      <div>
        <h2 className="text-section-title font-semibold tracking-tight" id="interactions-title">
          Menus, overlays, and tabs
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Keyboard-operable overlays and menus use accessible Radix primitives.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Interactive primitives</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">Open dialog</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Dialog title</DialogTitle>
                  <DialogDescription>
                    Use a dialog for a focused task that benefits from context or confirmation.
                  </DialogDescription>
                </DialogHeader>
                <p className="text-sm leading-6 text-muted-foreground">
                  This demonstration is local to the showcase and does not submit data.
                </p>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Close dialog</Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline">Confirmation dialog</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirm this example</AlertDialogTitle>
                  <AlertDialogDescription>
                    Destructive actions should explain their consequence before continuing.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel asChild>
                    <Button variant="outline">Cancel</Button>
                  </AlertDialogCancel>
                  <AlertDialogAction asChild>
                    <Button onClick={() => toast.info('No data was changed.')}>
                      Confirm example
                    </Button>
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button aria-label="Open example actions" size="icon" variant="outline">
                  <MoreHorizontal aria-hidden="true" className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Example actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => toast.info('This is a local example action.')}>
                  Preview action
                </DropdownMenuItem>
                <DropdownMenuItem disabled>Unavailable action</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline">
                  <Settings2 aria-hidden="true" className="size-4" />
                  Popover
                </Button>
              </PopoverTrigger>
              <PopoverContent>
                <p className="text-sm font-medium">Popover content</p>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">
                  Keep lightweight contextual content close to its trigger.
                </p>
              </PopoverContent>
            </Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button aria-label="More about tooltips" size="icon" variant="ghost">
                  <Settings2 aria-hidden="true" className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Short, supplemental hint</TooltipContent>
            </Tooltip>
          </div>
          <Tabs onValueChange={setActiveTab} value={activeTab}>
            <TabsList aria-label="Example content sections">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>
            <TabsContent value="overview">
              <p className="text-sm leading-6 text-muted-foreground">
                Tabs group related content while keeping one panel visible at a time.
              </p>
            </TabsContent>
            <TabsContent value="details">
              <p className="text-sm leading-6 text-muted-foreground">
                Tab selection is keyboard accessible and managed locally.
              </p>
            </TabsContent>
            <TabsContent value="activity">
              <p className="text-sm leading-6 text-muted-foreground">
                This is sample content only; no activity feed is connected.
              </p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </section>
  );
}

export { InteractionSection };
