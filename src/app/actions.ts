'use server';

import { extractExpiryDate } from '@/ai/flows/extract-expiry-date';

interface ProductDetails {
  name: string | null;
  expiryDate: string | null;
  imageUrl: string | null;
  errorType?: 'api' | 'ai' | 'network' | 'unknown';
  errorMessage?: string;
  rawData: any;
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

    if (!expiryDateResult) {
      return {
        name: null,
        expiryDate: null,
        imageUrl: null,
        rawData: null,
        errorType: 'ai',
        errorMessage: 'No se pudo extraer la fecha de caducidad de la imagen.'
      };
    }

    if (!expiryDateResult?.expiryDate) {
      return {
        name: null,
        expiryDate: null,
        imageUrl: null,
        rawData: null,
        errorType: 'ai',
        errorMessage: 'No se encontró ninguna fecha de caducidad en la imagen.'
      };
    }

    let productName: string | null = `Product [${barcode}]`;
    let imageUrl: string | null = null;
    let rawData: any = null;

    if (productInfoResponse.ok) {
      const productData = await productInfoResponse.json();
      if (productData.status === 1 && productData.product) {
        productName = productData.product.product_name || `Product [${barcode}]`;
        imageUrl = productData.product.image_front_url || null;
        rawData = productData.product;
      } else {
        return {
          name: null,
          expiryDate: expiryDateResult.expiryDate,
          imageUrl: null,
          rawData: productData,
          errorType: 'api',
          errorMessage: 'El producto no se encuentra en la base de datos de OpenFoodFacts.'
        };
      }
    } else {
      return {
        name: null,
        expiryDate: expiryDateResult.expiryDate,
        imageUrl: null,
        rawData: null,
        errorType: 'network',
        errorMessage: `Error de red al consultar OpenFoodFacts: ${productInfoResponse.status}`
      };
    }

    return {
      name: productName,
      expiryDate: expiryDateResult.expiryDate,
      imageUrl: imageUrl,
      rawData: rawData,
    };
  } catch (error: any) {
    return {
      name: null,
      expiryDate: null,
      imageUrl: null,
      rawData: null,
      errorType: 'unknown',
      errorMessage: error?.message || 'Error desconocido en el proceso de escaneo.'
    };
  }
}
