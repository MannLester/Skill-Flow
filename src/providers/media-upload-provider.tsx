import { useMutation } from 'convex/react';
import { createContext, PropsWithChildren, useContext, useMemo } from 'react';

import { api } from '../../convex/_generated/api';
import type { MediaPurpose } from '@/media/types';

type MediaUploadApi = {
  createIntent: (args: { purpose: MediaPurpose }) => Promise<{ intentId: string; uploadUrl: string; expiresAt: number }>;
  finalize: (args: { intentId: string; storageId: string; width: number; height: number; originalName: string; contentType: string; byteSize: number }) => Promise<string>;
  discard: (args: { uploadedFileId: string }) => Promise<null>;
};

const unavailable = async () => { throw new Error('Image uploads require the connected SkillFlow backend.'); };
const MediaUploadContext = createContext<MediaUploadApi>({ createIntent: unavailable, finalize: unavailable, discard: unavailable });

export function MediaUploadProvider({ children }: PropsWithChildren) {
  const createIntentMutation = useMutation(api.media.createUploadIntent);
  const finalizeMutation = useMutation(api.media.finalizeUpload);
  const discardMutation = useMutation(api.media.discardUpload);
  const value = useMemo<MediaUploadApi>(() => ({
    createIntent: (args) => createIntentMutation(args),
    finalize: (args) => finalizeMutation(args as never),
    discard: (args) => discardMutation(args as never),
  }), [createIntentMutation, discardMutation, finalizeMutation]);
  return <MediaUploadContext.Provider value={value}>{children}</MediaUploadContext.Provider>;
}

export function useMediaUpload() { return useContext(MediaUploadContext); }
