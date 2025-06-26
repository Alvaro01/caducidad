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
      return { text: 'Invalid Date', variant: 'destructive', icon: <CalendarX2 className="h-4 w-4" />, tooltip: 'Could not read expiry date.' };
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize today to the start of the day
    
    if (isBefore(expiry, today)) {
      return { text: 'Expired', variant: 'destructive', icon: <CalendarX2 className="h-4 w-4" />, tooltip: `Expired on ${format(expiry, 'PPP')}` };
    }

    const daysUntilExpiry = differenceInDays(expiry, today);

    if (daysUntilExpiry <= 3) {
      const dayText = isToday(expiry) ? 'today' : `in ${daysUntilExpiry} day${daysUntilExpiry > 1 ? 's' : ''}`;
      return { text: `Expires ${dayText}`, variant: 'secondary', icon: <AlertTriangle className="h-4 w-4 text-amber-500" />, tooltip: `Expires on ${format(expiry, 'PPP')}` };
    }

    return { text: 'OK', variant: 'default', icon: <CheckCircle2 className="h-4 w-4 text-green-500" />, tooltip: `Expires on ${format(expiry, 'PPP')}` };
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
        <CardTitle className="text-2xl font-headline">Your Products</CardTitle>
        <CardDescription>All your scanned items, sorted by the soonest to expire.</CardDescription>
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
                              {isDateValid ? `Expires on ${format(expiryDate, 'dd MMM yyyy')}` : 'Invalid expiry date'}
                            </p>
                          </div>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="shrink-0" onClick={() => onDeleteProduct(product.id)}>
                                <Trash2 className="h-5 w-5" />
                                <span className="sr-only">Delete product</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Delete {product.name}</p>
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
                <p className="font-semibold text-lg">No products yet</p>
                <p className="text-sm max-w-xs">Your product list is empty. Use the scanner to add an item.</p>
              </div>
            )}
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
