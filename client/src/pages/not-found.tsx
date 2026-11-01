import { Link } from "wouter";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center" data-testid="page-not-found">
      <Compass className="h-10 w-10 text-muted-foreground" />
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="max-w-sm text-sm text-muted-foreground">That link does not match any page. Try the search bar or go back to the dashboard.</p>
      <Button asChild><Link href="/">Back to dashboard</Link></Button>
    </div>
  );
}
