'use client';

import { useState } from 'react';
import { Header } from '@/components/Header';
import { ProductList } from '@/components/ProductList';
import { ProductScanner } from '@/components/ProductScanner';
import type { Product } from '@/types';
import { addDays, subDays } from 'date-fns';

export default function Home() {
  const [products, setProducts] = useState<Product[]>([
    { id: '1', name: 'Organic Milk', expiryDate: addDays(new Date(), 2).toISOString().split('T')[0], scanTimestamp: Date.now(), imageUrl: 'https://placehold.co/100x100.png' },
    { id: '2', name: 'Cheddar Cheese', expiryDate: addDays(new Date(), 10).toISOString().split('T')[0], scanTimestamp: Date.now(), imageUrl: 'https://placehold.co/100x100.png' },
    { id: '3', name: 'Sourdough Bread', expiryDate: subDays(new Date(), 3).toISOString().split('T')[0], scanTimestamp: Date.now(), imageUrl: 'https://placehold.co/100x100.png' },
  ]);

  const addProduct = (productData: Omit<Product, 'id' | 'scanTimestamp'>) => {
    const newProduct: Product = {
      ...productData,
      id: crypto.randomUUID(),
      scanTimestamp: Date.now(),
    };
    setProducts((prevProducts) => [newProduct, ...prevProducts]);
  };

  const deleteProduct = (id: string) => {
    setProducts((prevProducts) => prevProducts.filter((p) => p.id !== id));
  };

  return (
    <>
      <Header />
      <main className="container mx-auto px-4 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          <div className="lg:col-span-1">
            <ProductScanner onProductAdded={addProduct} />
          </div>
          <div className="lg:col-span-2">
            <ProductList products={products} onDeleteProduct={deleteProduct} />
          </div>
        </div>
      </main>
    </>
  );
}
