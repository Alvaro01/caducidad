import { ScanText } from 'lucide-react';

export function Header() {
  return (
    <header className="py-8">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-3">
          <ScanText className="h-10 w-10 text-primary" />
          <h1 className="text-4xl font-bold font-headline text-foreground">
            AlertaCaducidad
          </h1>
        </div>
        <p className="mt-2 text-lg text-muted-foreground">
          No dejes que tu comida caduque. Escanea, controla y recibe avisos.
        </p>
      </div>
    </header>
  );
}
