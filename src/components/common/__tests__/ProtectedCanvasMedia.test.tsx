// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import ProtectedCanvasMedia from '../ProtectedCanvasMedia';

describe('ProtectedCanvasMedia Component', () => {
  beforeEach(() => {
    // Mock fetch for Blob
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      blob: vi.fn().mockResolvedValue(new Blob(['fake-image-bytes'], { type: 'image/png' }))
    } as any);

    // Mock URL.createObjectURL and revokeObjectURL
    global.URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost/fake-blob-id');
    global.URL.revokeObjectURL = vi.fn();
  });

  it('renders a canvas element and NO img tag in the DOM', async () => {
    const { container } = render(
      <ProtectedCanvasMedia
        src="https://example.com/exercise-gif.gif"
        alt="Sentadilla con Barra"
      />
    );

    // Verify there are NO <img> tags in the container DOM
    const imgTags = container.querySelectorAll('img');
    expect(imgTags.length).toBe(0);

    // Verify a <canvas> element is rendered
    const canvasElements = container.querySelectorAll('canvas');
    expect(canvasElements.length).toBe(1);
  });
});
