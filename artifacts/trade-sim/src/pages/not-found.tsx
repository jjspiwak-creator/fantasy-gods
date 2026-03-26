import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full p-8 text-center glass-panel">
        <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-6" />
        <h1 className="text-3xl font-display font-bold text-white mb-2">404 - OUT OF BOUNDS</h1>
        <p className="text-muted-foreground mb-8">
          The page you're looking for doesn't exist or has been traded away.
        </p>
        <Link href="/">
          <button className="px-6 py-3 rounded-xl font-bold uppercase bg-primary text-primary-foreground hover:bg-primary/90 box-glow transition-all">
            Return to Field
          </button>
        </Link>
      </Card>
    </div>
  );
}
