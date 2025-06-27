'use client';

import { differenceInDays, format, isBefore, isToday, parseISO, isValid } from 'date-fns';
import { AlertTriangle, CheckCircle2, Trash2, CalendarX2, Info, Package } from 'lucide-react';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { Product } from '@/types';

interface ProductListProps {
  products: Product[];
  onDeleteProduct: (id: string) => void;
}

export function ProductList({ products, onDeleteProduct }: ProductListProps) {
  const getStatus = (expiryDateString: string): { text: string; variant: 'destructive' | 'secondary' | 'default'; icon: React.ReactNode; tooltip: string } => {
    const expiry = parseISO(expiryDateString);
    if (!isValid(expiry)) {
      return { text: 'Fecha de caducidad inválida', variant: 'destructive', icon: <CalendarX2 className="h-4 w-4" />, tooltip: 'No se pudo leer la fecha de caducidad.' };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize today to the start of the day

    if (isBefore(expiry, today)) {
      return { text: 'Expirado', variant: 'destructive', icon: <CalendarX2 className="h-4 w-4" />, tooltip: `Expiró el ${format(expiry, 'PPP')}` };
    }

    const daysUntilExpiry = differenceInDays(expiry, today);

    if (daysUntilExpiry <= 3) {
      const dayText = isToday(expiry) ? 'hoy' : `en ${daysUntilExpiry} día${daysUntilExpiry > 1 ? 's' : ''}`;
      return { text: `Caduca ${dayText}`, variant: 'secondary', icon: <AlertTriangle className="h-4 w-4 text-amber-500" />, tooltip: `Caduca el ${format(expiry, 'PPP')}` };
    }

    return { text: 'OK', variant: 'default', icon: <CheckCircle2 className="h-4 w-4 text-green-500" />, tooltip: `Caduca el ${format(expiry, 'PPP')}` };
  };

  const sortedProducts = [...products].sort((a, b) => {
    const dateA = parseISO(a.expiryDate);
    const dateB = parseISO(b.expiryDate);
    const aIsValid = isValid(dateA);
    const bIsValid = isValid(dateB);

    if (aIsValid && !bIsValid) return -1;
    if (!aIsValid && bIsValid) return 1;
    if (!aIsValid && !bIsValid) return 0;

    return dateA.getTime() - dateB.getTime();
  });

  return (
    <Card className="shadow-lg bg-card/80 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-2xl font-headline">Tus productos</CardTitle>
        <CardDescription>Todos tus artículos escaneados, ordenados por los que caducan antes.</CardDescription>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          <div className="space-y-4">
            {sortedProducts.length > 0 ? (
              sortedProducts.map((product) => {
                const status = getStatus(product.expiryDate);
                const expiryDate = parseISO(product.expiryDate);
                const isDateValid = isValid(expiryDate);
                return (
                  <Card key={product.id} className="transition-shadow hover:shadow-md">
                    <CardContent className="p-4 flex items-start gap-4">
                      <div className="relative w-20 h-20 aspect-square rounded-md overflow-hidden bg-muted flex-shrink-0">
                        {product.imageUrl ? (
                          <Image
                            src={product.imageUrl}
                            alt={product.name}
                            fill
                            sizes="80px"
                            className="object-cover"
                            data-ai-hint="product image"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-8 h-8 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="flex-grow">
                        <div className="flex justify-between items-start gap-4">
                          <div>
                            <p className="font-semibold text-lg">{product.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {isDateValid ? `Caduca el ${format(expiryDate, 'dd MMM yyyy')}` : 'Fecha de caducidad inválida'}
                            </p>
                            {product.brand && <p className="text-xs text-gray-500">Marca: {product.brand}</p>}
                            {product.quantity && <p className="text-xs text-gray-500">Cantidad: {product.quantity}</p>}
                            {product.categories && <p className="text-xs text-gray-500">Categorías: {product.categories}</p>}
                            {product.nutriscore && <p className="text-xs text-gray-500">Nutriscore: {product.nutriscore.toUpperCase()}</p>}
                            {product.ecoscore && <p className="text-xs text-gray-500">Ecoscore: {product.ecoscore.toUpperCase()}</p>}
                            {product.ingredients && <p className="text-xs text-gray-500">Ingredientes: {product.ingredients}</p>}
                            {product.country && <p className="text-xs text-gray-500">País: {product.country}</p>}
                            {product.barcode && <p className="text-xs text-gray-500">Código de barras: {product.barcode}</p>}
                            {product.url && (
                              <p className="text-xs text-blue-600 underline"><a href={product.url} target="_blank" rel="noopener noreferrer">Ver en OpenFoodFacts</a></p>
                            )}
                          </div>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="shrink-0" onClick={() => onDeleteProduct(product.id)}>
                                <Trash2 className="h-5 w-5" />
                                <span className="sr-only">Eliminar producto</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Eliminar {product.name}</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <div className="mt-3">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant={status.variant} className="gap-1.5 pl-2 cursor-default">
                                {status.icon}
                                {status.text}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{status.tooltip}</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground rounded-lg border-2 border-dashed">
                <Info className="w-10 h-10" />
                <p className="font-semibold text-lg">Aún no hay productos</p>
                <p className="text-sm max-w-xs">Tu lista de productos está vacía. Usa el escáner para añadir un artículo.</p>
              </div>
            )}
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
