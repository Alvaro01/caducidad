'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import { Camera, Loader2, ScanLine, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import type { Product } from '@/types';
import { getProductDetailsFromScan } from '@/app/actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

interface ProductScannerProps {
  onProductAdded: (product: Omit<Product, 'id' | 'scanTimestamp'>) => void;
}

const BARCODE_COOLDOWN_MS = 5000;

export function ProductScanner({ onProductAdded }: ProductScannerProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isProcessingRef = useRef(false);
  const barcodeDetectorRef = useRef<any>(null);
  const recentlyScannedRef = useRef<Map<string, number>>(new Map());

  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [isDetectorSupported, setIsDetectorSupported] = useState(true);
  const [scanFeedback, setScanFeedback] = useState<{ message: string; timestamp: number } | null>(null);

  useEffect(() => {
    if (scanFeedback) {
      const timer = setTimeout(() => setScanFeedback(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [scanFeedback]);

  useEffect(() => {
    async function setupScanner() {
      if (!('BarcodeDetector' in window)) {
        console.error('Barcode Detector is not supported by this browser.');
        setIsDetectorSupported(false);
        setHasCameraPermission(false);
        return;
      }

      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setHasCameraPermission(false);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        setHasCameraPermission(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        // @ts-ignore
        barcodeDetectorRef.current = new window.BarcodeDetector({ formats: ['ean_13', 'upc_a', 'upc_e', 'ean_8'] });
      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: 'Camera Access Denied',
          description: 'Please enable camera permissions to use the scanner.',
        });
      }
    }

    setupScanner();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [toast]);


  const processBarcode = (barcode: string) => {
    if (isProcessingRef.current || !videoRef.current || !canvasRef.current || !videoRef.current.srcObject || !videoRef.current.played.length) {
      return;
    }

    isProcessingRef.current = true;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) {
      isProcessingRef.current = false;
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const photoDataUri = canvas.toDataURL('image/jpeg');

    startTransition(async () => {
      try {
        const result = await getProductDetailsFromScan(barcode, photoDataUri);

        if (result && result.name && result.expiryDate) {
          onProductAdded({ name: result.name, expiryDate: result.expiryDate, imageUrl: result.imageUrl });
          setScanFeedback({ message: `Añadido: ${result.name}`, timestamp: Date.now() });
          toast({
            title: "Producto añadido",
            description: `${result.name} (caduca: ${result.expiryDate}) ha sido añadido.`,
          });
        } else if (result && result.errorType) {
          let title = "Fallo en el escaneo";
          let description = result.errorMessage || "No se pudo extraer la información.";
          description = String(description);
          if (!description) description = "No se pudo extraer la información.";
          if (result.errorType === 'ai') {
            title = "Error de IA";
          } else if (result.errorType === 'api') {
            title = "Producto no encontrado";
          } else if (result.errorType === 'network') {
            title = "Error de red";
          } else if (result.errorType === 'unknown') {
            title = "Error desconocido";
          }
          toast({
            variant: 'destructive',
            title,
            description,
          });
        } else {
          toast({
            variant: 'destructive',
            title: "Fallo en el escaneo",
            description: "No se pudo extraer toda la información. Intenta de nuevo.",
          });
        }
      } catch (error) {
        console.error("Scanning failed", error);
        toast({ variant: 'destructive', title: "Error", description: "Ocurrió un error inesperado." });
      } finally {
        isProcessingRef.current = false;
      }
    });
  };

  useEffect(() => {
    let animationFrameId: number;

    const scanLoop = async () => {
      if (
        videoRef.current &&
        barcodeDetectorRef.current &&
        !isProcessingRef.current &&
        videoRef.current.readyState >= 4 &&
        videoRef.current.videoWidth > 0
      ) {
        try {
          const barcodes = await barcodeDetectorRef.current.detect(videoRef.current);
          if (barcodes.length > 0) {
            const detectedBarcode = barcodes[0].rawValue;
            const now = Date.now();
            const lastScanTime = recentlyScannedRef.current.get(detectedBarcode);

            if (!lastScanTime || (now - lastScanTime > BARCODE_COOLDOWN_MS)) {
              recentlyScannedRef.current.set(detectedBarcode, now);
              processBarcode(detectedBarcode);
            }
          }
        } catch (e) {
          console.error('Barcode detection failed: ', e);
        }
      }

      animationFrameId = requestAnimationFrame(scanLoop);
    };

    if (hasCameraPermission && isDetectorSupported) {
      animationFrameId = requestAnimationFrame(scanLoop);
    }

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasCameraPermission, isDetectorSupported]);


  return (
    <Card className="shadow-lg bg-card/80 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-2xl font-headline">Escáner inteligente 1</CardTitle>
        <CardDescription>Apunta tu cámara a un código de barras. Buscaremos el producto y la fecha de caducidad.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative aspect-video w-full bg-muted rounded-lg flex items-center justify-center overflow-hidden border">
          <video ref={videoRef} className={cn('w-full h-full object-cover', !hasCameraPermission && 'hidden')} autoPlay muted playsInline />
          <canvas ref={canvasRef} className="hidden" />

          <div className="absolute inset-0 pointer-events-none">
            {hasCameraPermission === null && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">Iniciando cámara...</p>
              </div>
            )}
            {hasCameraPermission === false && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                {!isDetectorSupported ? (
                  <Alert variant="destructive" className="w-full">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Navegador no soportado</AlertTitle>
                    <AlertDescription>El escaneo de códigos de barras no está soportado en este navegador. Prueba con Chrome en Android o un ordenador de escritorio.</AlertDescription>
                  </Alert>
                ) : (
                  <Alert variant="destructive" className="w-full">
                    <Camera className="h-4 w-4" />
                    <AlertTitle>Error de cámara</AlertTitle>
                    <AlertDescription>No se pudo acceder a la cámara. Por favor, revisa los permisos.</AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {hasCameraPermission && (
              <>
                <div className="absolute top-2 left-2 bg-black/50 text-white text-xs font-semibold px-2 py-1 rounded-md flex items-center gap-1.5 z-10">
                  {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <ScanLine className="h-3 w-3" />}
                  {isPending ? "ANALIZANDO" : "ESCANEANDO"}
                </div>
                <div className="absolute w-[90%] h-1/2 border-2 border-dashed border-white/50 top-1/4 left-[5%]" />
              </>
            )}

            {scanFeedback && (
              <div key={scanFeedback.timestamp} className="absolute inset-0 flex items-center justify-center bg-green-500/80 animate-in fade-in-0 zoom-in-95">
                <p className="text-2xl font-bold text-white text-center drop-shadow-lg p-4">{scanFeedback.message}</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
