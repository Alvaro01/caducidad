import type { NextConfig } from 'next';
import Tesseract from 'tesseract.js';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'static.openfoodfacts.org',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.openfoodfacts.org',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

const ocrDetectExpiryDate = async (imageUrl: string): Promise<string | null> => {
  if (!imageUrl) return null;
  try {
    const { data: { text } } = await Tesseract.recognize(imageUrl, 'spa'); // o 'eng' si prefieres inglés
    // Busca una fecha en el texto reconocido (formato dd/mm/yyyy, yyyy-mm-dd, etc)
    const match = text.match(/(\\d{2}[\\/\\-]\\d{2}[\\/\\-]\\d{4}|\\d{4}[\\/\\-]\\d{2}[\\/\\-]\\d{2})/);
    if (match) {
      // Normaliza la fecha a formato ISO si es necesario
      return match[0].replace(/\\/ / g, '-');
    }
    return null;
  } catch (e) {
    console.error('Error en OCR:', e);
    return null;
  }
};

export default nextConfig;
