export type MediaPurpose = 'avatar' | 'portfolio_evidence' | 'certification_evidence' | 'verification_sample' | 'service_cover' | 'service_gallery' | 'project_reference' | 'booking_reference' | 'proposal_sample' | 'delivery_image' | 'message_image';
export type MediaVisibility = 'public' | 'owner' | 'participants';

export type UploadedImage = {
  uploadedFileId: string;
  uri: string;
  width: number;
  height: number;
  byteSize: number;
  altText: string;
  originalName: string;
};

export type MediaAttachment = {
  id: string;
  targetType: string;
  targetId: string;
  purpose: MediaPurpose;
  position: number;
  altText: string;
  visibility: MediaVisibility;
  publicUrl?: string;
};

export type MediaInput = { uploadedFileId: string; altText: string };
export const mediaInputs = (images: UploadedImage[]): MediaInput[] => images.map(({ uploadedFileId, altText }) => ({ uploadedFileId, altText }));
