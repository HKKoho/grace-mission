import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

interface ComingSoonProps {
  readonly title: string;
  readonly description: string;
  readonly eta: string;
}

export function ComingSoon({ title, description, eta }: ComingSoonProps) {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center p-6">
      <Card className="max-w-md text-center">
        <CardHeader className="items-center">
          <Sparkles className="mb-2 size-8 text-muted-foreground" />
          <CardTitle className="text-xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <Badge variant="outline">Arriving {eta}</Badge>
          <Button asChild>
            <Link href="/conversations">Back to Conversations</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
