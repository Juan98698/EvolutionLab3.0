import React, { useEffect, useRef, useState } from 'react';

interface ProtectedCanvasMediaProps {
  src?: string;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  maxHeight?: string;
  maxWidth?: string;
  objectFit?: 'contain' | 'cover';
  watermarkText?: string;
}

/**
 * Componente de protección multimedia mediante HTML5 Canvas y Blobs en memoria.
 * - NO genera etiquetas <img> ni atributos "src" visibles en el DOM.
 * - Descarga el archivo como blob en la memoria de JS, lo dibuja en un elemento <canvas>
 *   y revoca la URL de memoria de inmediato.
 * - Si se inspecciona en DevTools con Ctrl+Shift+C / F12, solo se observa:
 *   <canvas width="..." height="..." class="protected-canvas"></canvas>
 * - Deshabilita clics derechos, arrastre y menú contextual.
 */
export const ProtectedCanvasMedia: React.FC<ProtectedCanvasMediaProps> = ({
  src = '',
  alt = 'Media protegido',
  className = '',
  style = {},
  maxHeight = '60vh',
  maxWidth = '100%',
  objectFit = 'contain',
  watermarkText = 'EVOLUTION LAB'
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    let isSubscribed = true;
    let animFrameId: number | null = null;
    let createdBlobUrl: string | null = null;
    let hiddenVideo: HTMLVideoElement | null = null;

    const renderMediaToCanvas = async () => {
      if (!src) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(false);

      try {
        // 1. Descargar el archivo multimedia como Blob binario en memoria de JS
        const response = await fetch(src, { mode: 'cors' });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const blob = await response.blob();
        
        if (!isSubscribed) return;

        // 2. Crear URL de objeto de memoria temporal
        createdBlobUrl = URL.createObjectURL(blob);
        const isVideo = blob.type.startsWith('video/') || src.match(/\.(mp4|webm|ogv)$/i);

        if (isVideo) {
          // Si es un archivo de video / animación MP4
          hiddenVideo = document.createElement('video');
          hiddenVideo.src = createdBlobUrl;
          hiddenVideo.muted = true;
          hiddenVideo.loop = true;
          hiddenVideo.playsInline = true;
          hiddenVideo.autoplay = true;

          await hiddenVideo.play().catch(() => {});

          const drawVideoFrame = () => {
            if (!isSubscribed || !canvasRef.current || !hiddenVideo) return;
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');

            if (ctx && hiddenVideo.videoWidth > 0 && hiddenVideo.videoHeight > 0) {
              if (canvas.width !== hiddenVideo.videoWidth || canvas.height !== hiddenVideo.videoHeight) {
                canvas.width = hiddenVideo.videoWidth;
                canvas.height = hiddenVideo.videoHeight;
              }

              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(hiddenVideo, 0, 0, canvas.width, canvas.height);

              // Dibujar marca de agua sutil
              if (watermarkText) {
                ctx.save();
                ctx.font = 'bold 12px Orbitron, sans-serif';
                ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
                ctx.textAlign = 'right';
                ctx.fillText(watermarkText, canvas.width - 12, canvas.height - 12);
                ctx.restore();
              }
            }

            animFrameId = requestAnimationFrame(drawVideoFrame);
          };

          setLoading(false);
          drawVideoFrame();
        } else {
          // Si es una imagen o GIF estático / animado
          const img = new Image();
          img.crossOrigin = 'anonymous';

          img.onload = () => {
            if (!isSubscribed || !canvasRef.current) return;
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');

            if (ctx && img.naturalWidth > 0 && img.naturalHeight > 0) {
              canvas.width = img.naturalWidth;
              canvas.height = img.naturalHeight;

              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

              // Marca de agua protectora integrada en los píxeles del Canvas
              if (watermarkText) {
                ctx.save();
                ctx.font = 'bold 14px Orbitron, sans-serif';
                ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
                ctx.textAlign = 'right';
                ctx.fillText(watermarkText, canvas.width - 16, canvas.height - 16);
                ctx.restore();
              }
            }

            // Revocar inmediatamente el blob en memoria después de dibujarlo en Canvas
            if (createdBlobUrl) {
              URL.revokeObjectURL(createdBlobUrl);
              createdBlobUrl = null;
            }

            setLoading(false);
          };

          img.onerror = () => {
            if (isSubscribed) {
              setError(true);
              setLoading(false);
            }
          };

          img.src = createdBlobUrl;
        }
      } catch (err) {
        console.warn('Protección Canvas: No se pudo cargar vía Fetch CORS, intentando render directo en Canvas:', err);
        // Fallback seguro usando Image() directo si la respuesta no permite CORS
        if (!isSubscribed) return;

        const fallbackImg = new Image();
        fallbackImg.crossOrigin = 'anonymous';
        fallbackImg.onload = () => {
          if (!isSubscribed || !canvasRef.current) return;
          const canvas = canvasRef.current;
          const ctx = canvas.getContext('2d');
          if (ctx && fallbackImg.naturalWidth > 0) {
            canvas.width = fallbackImg.naturalWidth;
            canvas.height = fallbackImg.naturalHeight;
            ctx.drawImage(fallbackImg, 0, 0, canvas.width, canvas.height);
          }
          setLoading(false);
        };
        fallbackImg.onerror = () => {
          if (isSubscribed) {
            setError(true);
            setLoading(false);
          }
        };
        fallbackImg.src = src;
      }
    };

    renderMediaToCanvas();

    return () => {
      isSubscribed = false;
      if (animFrameId !== null) cancelAnimationFrame(animFrameId);
      if (createdBlobUrl) URL.revokeObjectURL(createdBlobUrl);
      if (hiddenVideo) {
        hiddenVideo.pause();
        hiddenVideo.src = '';
        hiddenVideo.remove();
      }
    };
  }, [src, watermarkText]);

  return (
    <div
      className={`protected-canvas-container ${className}`}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        maxWidth,
        maxHeight,
        overflow: 'hidden',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        ...style
      }}
    >
      {loading && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '30px',
          color: 'rgba(255,255,255,0.4)',
          fontSize: '11px',
          fontFamily: "'Orbitron', sans-serif"
        }}>
          ⚡ Cargando en Canvas Protegido...
        </div>
      )}

      {error ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          color: 'rgba(255,255,255,0.4)',
          fontSize: '11px'
        }}>
          <span>💪 {alt}</span>
        </div>
      ) : (
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={alt}
          className="protected-canvas"
          onContextMenu={(e) => e.preventDefault()}
          onDragStart={(e) => e.preventDefault()}
          style={{
            maxWidth: '100%',
            maxHeight,
            objectFit,
            display: loading ? 'none' : 'block',
            pointerEvents: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            borderRadius: 'inherit'
          }}
        />
      )}

      {/* Escudo transparente sobre el lienzo Canvas */}
      <div
        className="media-protection-overlay"
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
      />
    </div>
  );
};

export default ProtectedCanvasMedia;
