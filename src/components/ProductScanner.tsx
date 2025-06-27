'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import { Camera, Loader2, ScanLine, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import type { Product } from '@/types';
import { getProductDetailsFromScan } from '@/app/actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import Tesseract from 'tesseract.js';

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

  // Nuevo estado para el flujo moderno
  const [productInProcess, setProductInProcess] = useState<any>(null); // producto escaneado sin fecha
  const [isProcessingOCR, setIsProcessingOCR] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [manualDate, setManualDate] = useState<string | null>(null);
  const [step, setStep] = useState<'barcode' | 'confirm' | 'expiry-camera' | 'expiry-ocr' | 'expiry-manual'>('barcode');
  const [expiryPhoto, setExpiryPhoto] = useState<string | null>(null);
  const [expiryAttempts, setExpiryAttempts] = useState(0);
  const MAX_EXPIRY_ATTEMPTS = 5;

  useEffect(() => {
    if (scanFeedback) {
      const timer = setTimeout(() => setScanFeedback(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [scanFeedback]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    async function setupScanner() {
      if (!('BarcodeDetector' in window)) {
        setIsDetectorSupported(false);
        setHasCameraPermission(false);
        return;
      }
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setHasCameraPermission(false);
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        setHasCameraPermission(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        // @ts-ignore
        barcodeDetectorRef.current = new window.BarcodeDetector({ formats: ['ean_13', 'upc_a', 'upc_e', 'ean_8'] });
      } catch (error) {
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: 'Camera Access Denied',
          description: 'Por favor, activa los permisos de cámara.'
        });
      }
    }

    if (step === 'barcode' || step === 'expiry-camera') {
      setupScanner();
    }

    return () => {
      // Solo detenemos la cámara si salimos del flujo de escaneo completamente
      if (stream && (step !== 'barcode' && step !== 'expiry-camera')) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [step, toast]);

  // Simulación de OCR (reemplaza esto por tu llamada real a Tesseract.js)
  const fakeOCR = async (imageUrl: string) => {
    // Simula un OCR que falla el 50% de las veces
    await new Promise(res => setTimeout(res, 1500));
    return Math.random() > 0.5 ? '2025-12-31' : null;
  };

  // Paso 1: Escaneo de código de barras
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
        if (result && result.name) {
          const raw = result.rawData || {};
          const product = {
            name: result.name,
            imageUrl: result.imageUrl || undefined,
            brand: raw.brands || undefined,
            quantity: raw.quantity || undefined,
            categories: raw.categories || undefined,
            nutriscore: raw.nutriscore_grade || undefined,
            ecoscore: raw.ecoscore_grade || undefined,
            ingredients: raw.ingredients_text || undefined,
            country: raw.countries || undefined,
            barcode: raw.code || undefined,
            url: raw.url || undefined,
            rawData: result.rawData
          };
          setProductInProcess(product);
          setStep('confirm');
        } else {
          toast({
            variant: 'destructive',
            title: 'Fallo en el escaneo',
            description: 'No se pudo extraer toda la información. Intenta de nuevo.',
          });
        }
      } catch (error) {
        console.error('Scanning failed', error);
        toast({ variant: 'destructive', title: 'Error', description: 'Ocurrió un error inesperado.' });
      } finally {
        isProcessingRef.current = false;
      }
    });
  };

  // Paso 2: Captura de foto de la fecha de caducidad
  const handleCaptureExpiryPhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const photoDataUri = canvas.toDataURL('image/jpeg');
    setExpiryPhoto(photoDataUri);
    setStep('expiry-ocr');
    setIsProcessingOCR(true);
    setOcrError(null);
    // Inicia OCR real
    ocrDetectExpiryDate(photoDataUri);
  };

  // OCR real con Tesseract.js (devuelve la fecha o null)
  const ocrDetectExpiryDate = async (imageUrl: string) => {
    try {
      const { data: { text } } = await Tesseract.recognize(imageUrl, 'spa');
      const match = text.match(/(\d{2}[\/\-]\d{2}[\/\-]\d{4}|\d{4}[\/\-]\d{2}[\/\-]\d{2})/);
      if (match) {
        return match[0].replace(/\//g, '-');
      }
      return null;
    } catch (e) {
      return null;
    }
  };

  // Guardar producto (por ahora solo console.log)
  const guardarProductoEnBD = (producto: any) => {
    console.log('Producto guardado:', producto);
    onProductAdded(producto);
    toast({ title: 'Producto guardado', description: producto.name });
  };

  // Cuando el usuario selecciona fecha manualmente
  const handleManualDate = (date: Date | undefined) => {
    if (!date || !productInProcess) return;
    const fechaISO = date.toISOString().split('T')[0];
    guardarProductoEnBD({ ...productInProcess, expiryDate: fechaISO });
    setScanFeedback({ message: `Añadido: ${productInProcess.name}`, timestamp: Date.now() });
    resetearFlujo();
  };

  // Resetear el flujo (añadir reset de intentos)
  const resetearFlujo = () => {
    setProductInProcess(null);
    setManualDate(null);
    setOcrError(null);
    setIsProcessingOCR(false);
    setStep('barcode');
    setExpiryPhoto(null);
    setExpiryAttempts(0);
  };

  // Escaneo automático de fecha de caducidad
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    let isUnmounted = false;
    const scanExpiryLoop = async () => {
      if (step !== 'expiry-camera' || !videoRef.current || !canvasRef.current || !productInProcess) return;
      setIsProcessingOCR(true);
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (!context) return;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const photoDataUri = canvas.toDataURL('image/jpeg');
      const fecha = await ocrDetectExpiryDate(photoDataUri);
      if (isUnmounted) return;
      if (fecha) {
        setIsProcessingOCR(false);
        guardarProductoEnBD({ ...productInProcess, expiryDate: fecha });
        setScanFeedback({ message: `Añadido: ${productInProcess.name}`, timestamp: Date.now() });
        resetearFlujo();
      } else {
        setExpiryAttempts(prev => prev + 1);
      }
    };
    if (step === 'expiry-camera' && expiryAttempts < MAX_EXPIRY_ATTEMPTS) {
      intervalId = setInterval(scanExpiryLoop, 2000);
      scanExpiryLoop(); // Primer intento inmediato
    }
    if (step === 'expiry-camera' && expiryAttempts >= MAX_EXPIRY_ATTEMPTS) {
      setIsProcessingOCR(false);
      setOcrError('No se detectó una fecha válida. Introduce la fecha manualmente.');
      setStep('expiry-manual');
    }
    return () => {
      isUnmounted = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [step, expiryAttempts, productInProcess]);

  useEffect(() => {
    let animationFrameId: number;

    if (!productInProcess) {
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
    }

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasCameraPermission, isDetectorSupported, productInProcess]);

  // Renderizado condicional según el estado del flujo
  if (step === 'confirm' && productInProcess) {
    return (
      <Card className="shadow-lg bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-2xl font-headline">Confirmar producto</CardTitle>
          <CardDescription>Revisa los datos y pulsa para escanear la fecha de caducidad</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-4">
            {productInProcess.imageUrl && (
              <img src={productInProcess.imageUrl} alt={productInProcess.name} className="w-32 h-32 object-cover rounded" />
            )}
            <div className="text-center">
              <p className="font-bold text-lg">{productInProcess.name}</p>
              {productInProcess.brand && <p className="text-xs text-gray-500">Marca: {productInProcess.brand}</p>}
              {productInProcess.quantity && <p className="text-xs text-gray-500">Cantidad: {productInProcess.quantity}</p>}
              {productInProcess.categories && <p className="text-xs text-gray-500">Categorías: {productInProcess.categories}</p>}
              {productInProcess.nutriscore && <p className="text-xs text-gray-500">Nutriscore: {productInProcess.nutriscore.toUpperCase()}</p>}
              {productInProcess.ecoscore && <p className="text-xs text-gray-500">Ecoscore: {productInProcess.ecoscore.toUpperCase()}</p>}
              {productInProcess.ingredients && <p className="text-xs text-gray-500">Ingredientes: {productInProcess.ingredients}</p>}
              {productInProcess.country && <p className="text-xs text-gray-500">País: {productInProcess.country}</p>}
              {productInProcess.barcode && <p className="text-xs text-gray-500">Código de barras: {productInProcess.barcode}</p>}
              {productInProcess.url && (
                <p className="text-xs text-blue-600 underline"><a href={productInProcess.url} target="_blank" rel="noopener noreferrer">Ver en OpenFoodFacts</a></p>
              )}
            </div>
            <Button onClick={() => setStep('expiry-camera')}>Escanear fecha de caducidad</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === 'expiry-camera') {
    return (
      <Card className="shadow-lg bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-2xl font-headline">Escanea la fecha de caducidad</CardTitle>
          <CardDescription>Enfoca la fecha, la detección es automática</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-4">
            <video ref={videoRef} className={cn('w-full h-48 object-cover rounded border')} autoPlay muted playsInline />
            {isProcessingOCR && <p className="text-sm text-muted-foreground">Buscando fecha de caducidad automáticamente... (Intento {expiryAttempts + 1}/{MAX_EXPIRY_ATTEMPTS})</p>}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === 'expiry-ocr') {
    return (
      <Card className="shadow-lg bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-2xl font-headline">Procesando fecha...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-4">
            {expiryPhoto && <img src={expiryPhoto} alt="Foto de fecha" className="w-32 h-32 object-cover rounded" />}
            {isProcessingOCR && <p className="text-sm text-muted-foreground">Buscando fecha de caducidad automáticamente...</p>}
            {ocrError && <p className="text-sm text-red-500">{ocrError}</p>}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === 'expiry-manual') {
    return (
      <Card className="shadow-lg bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-2xl font-headline">Introduce la fecha manualmente</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-2">
            <Calendar mode="single" selected={manualDate ? new Date(manualDate) : undefined} onSelect={date => { setManualDate(date ? date.toISOString().split('T')[0] : null); handleManualDate(date); }} initialFocus />
            <p className="text-xs text-muted-foreground">Selecciona la fecha de caducidad</p>
          </div>
        </CardContent>
      </Card>
    );
  }

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
