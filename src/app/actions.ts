'use server';

import { extractExpiryDate } from '@/ai/flows/extract-expiry-date';

interface ProductDetails {
  name: string | null;
  expiryDate: string | null;
  imageUrl: string | null;
}

export async function getProductDetailsFromScan(
  barcode: string,
  photoDataUri: string
): Promise<ProductDetails | null> {
  try {
    const [productInfoResponse, expiryDateResult] = await Promise.all([
      fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`),
      extractExpiryDate({ photoDataUri }),
    ]);

    if (!expiryDateResult?.expiryDate) {
      console.log('No expiry date found.');
      return null;
    }

    let productName: string | null = `Product [${barcode}]`;
    let imageUrl: string | null = null;

    if (productInfoResponse.ok) {
      const productData = await productInfoResponse.json();
      if (productData.status === 1 && productData.product) {
        productName = productData.product.product_name || `Product [${barcode}]`;
        imageUrl = productData.product.image_front_url || null;
      }
    } else {
        console.log(`Failed to fetch product data for barcode: ${barcode}`);
    }

    return {
      name: productName,
      expiryDate: expiryDateResult.expiryDate,
      imageUrl: imageUrl,
    };
  } catch (error) {
    console.error('Error in getProductDetailsFromScan:', error);
    return null;
  }
}
