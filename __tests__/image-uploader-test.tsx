import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert } from 'react-native';

import { ImageUploader, normalizedDimensions } from '@/components/image-uploader';
import type { UploadedImage } from '@/media/types';

const mockCreateIntent = jest.fn();
const mockFinalize = jest.fn();
const mockDiscard = jest.fn();

jest.mock('@/providers/media-upload-provider', () => ({
  useMediaUpload: () => ({ createIntent: mockCreateIntent, finalize: mockFinalize, discard: mockDiscard }),
}));

class UploadRequest {
  static fail = false;
  status = 200;
  responseText = JSON.stringify({ storageId: 'storage-1' });
  upload: { onprogress?: (event: { lengthComputable: boolean; loaded: number; total: number }) => void } = {};
  onerror?: () => void;
  onabort?: () => void;
  onload?: () => void;
  open() {}
  setRequestHeader() {}
  send() {
    this.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 1 });
    if (UploadRequest.fail) this.onerror?.();
    else this.onload?.();
  }
  abort() { this.onabort?.(); }
}

function Harness({ max = 2 }: { max?: number }) {
  const [images, setImages] = useState<UploadedImage[]>([]);
  return <ImageUploader purpose="portfolio_evidence" value={images} onChange={setImages} max={max} label="Evidence" defaultAltText="Sample image" />;
}

const asset = (name: string) => ({ uri: `file:///${name}`, width: 2400, height: 1200, fileName: name, mimeType: 'image/jpeg' });

describe('ImageUploader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    UploadRequest.fail = false;
    Object.defineProperty(globalThis, 'XMLHttpRequest', { configurable: true, writable: true, value: UploadRequest });
    (global.fetch as jest.Mock).mockResolvedValue({ blob: async () => ({ size: 1024, type: 'image/jpeg' }) });
    mockCreateIntent.mockResolvedValue({ intentId: 'intent-1', uploadUrl: 'https://upload.test', expiresAt: Date.now() + 60_000 });
    mockFinalize.mockResolvedValueOnce('file-1').mockResolvedValueOnce('file-2');
  });

  it('scales the longest edge without enlarging smaller images', () => {
    expect(normalizedDimensions(4000, 1000)).toEqual({ width: 2000, height: 500 });
    expect(normalizedDimensions(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it('keeps picker cancellation side-effect free and explains denied permissions', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const screen = render(<Harness />);
    fireEvent.press(screen.getByText('Choose from Gallery'));
    await waitFor(() => expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled());
    expect(mockCreateIntent).not.toHaveBeenCalled();

    (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: false, canAskAgain: false });
    fireEvent.press(screen.getByText('Take Photo'));
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Camera access needed', expect.any(String), expect.any(Array)));
    expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
    alert.mockRestore();
  });

  it('uploads and retains every image from a multi-select result', async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({ canceled: false, assets: [asset('one.jpg'), asset('two.jpg')] });
    const screen = render(<Harness />);
    fireEvent.press(screen.getByText('Choose from Gallery'));
    await waitFor(() => expect(screen.getAllByLabelText('Sample image')).toHaveLength(2));
    expect(mockFinalize).toHaveBeenCalledTimes(2);
  });

  it('shows a failed upload and retries it successfully', async () => {
    UploadRequest.fail = true;
    (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValueOnce({ canceled: false, assets: [asset('camera.jpg')] });
    const screen = render(<Harness max={1} />);
    fireEvent.press(screen.getByText('Take Photo'));
    await waitFor(() => expect(screen.getByText('Upload failed. Check your connection and retry.')).toBeTruthy());
    UploadRequest.fail = false;
    fireEvent.press(screen.getByLabelText('Retry upload'));
    await waitFor(() => expect(screen.getByLabelText('Sample image')).toBeTruthy());
  });
});
