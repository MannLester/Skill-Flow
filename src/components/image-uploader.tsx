import { Ionicons } from '@expo/vector-icons';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Image, Linking, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/ui';
import { colors, font } from '@/constants/theme';
import type { MediaPurpose, UploadedImage } from '@/media/types';
import { useMediaUpload } from '@/providers/media-upload-provider';

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_EDGE = 2000;

type Pending = { id: string; label: string; progress: number; error?: string; retry?: () => void };
type Props = {
  purpose: MediaPurpose;
  value: UploadedImage[];
  onChange: (images: UploadedImage[]) => void;
  max: number;
  label: string;
  required?: boolean;
  defaultAltText: string;
};

export function ImageUploader({ purpose, value, onChange, max, label, required, defaultAltText }: Props) {
  const { createIntent, finalize, discard } = useMediaUpload();
  const [pending, setPending] = useState<Pending[]>([]);
  const requests = useRef(new Map<string, XMLHttpRequest>());
  const cancelled = useRef(new Set<string>());
  const valueRef = useRef(value);

  useEffect(() => { valueRef.current = value; }, [value]);

  const emitChange = useCallback((images: UploadedImage[]) => {
    valueRef.current = images;
    onChange(images);
  }, [onChange]);

  const processAssets = useCallback(async (assets: ImagePicker.ImagePickerAsset[]) => {
    const available = Math.max(0, max - valueRef.current.length);
    for (const asset of assets.slice(0, available)) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const upload = async () => {
        setPending((items) => upsertPending(items, { id, label: asset.fileName ?? 'Selected image', progress: 0 }));
        try {
          const normalized = await normalizeImage(asset);
          const intent = await createIntent({ purpose });
          const storageId = await uploadBlob(intent.uploadUrl, normalized.blob, (progress) => {
            setPending((items) => items.map((item) => item.id === id ? { ...item, progress } : item));
          }, (request) => requests.current.set(id, request));
          const uploadedFileId = await finalize({
            intentId: intent.intentId, storageId, width: normalized.width, height: normalized.height,
            originalName: asset.fileName ?? 'image.jpg', contentType: normalized.blob.type || 'image/jpeg', byteSize: normalized.blob.size,
          });
          const image: UploadedImage = { uploadedFileId, uri: normalized.uri, width: normalized.width, height: normalized.height, byteSize: normalized.blob.size, altText: defaultAltText, originalName: asset.fileName ?? 'image.jpg' };
          emitChange([...valueRef.current, image].slice(0, max));
          setPending((items) => items.filter((item) => item.id !== id));
        } catch (reason) {
          if (cancelled.current.delete(id)) return;
          const error = reason instanceof Error ? reason.message : 'The image could not be uploaded.';
          setPending((items) => upsertPending(items, { id, label: asset.fileName ?? 'Selected image', progress: 0, error, retry: upload }));
        } finally {
          requests.current.delete(id);
        }
      };
      await upload();
    }
  }, [createIntent, defaultAltText, emitChange, finalize, max, purpose]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'test' || process.env.EXPO_OS !== 'android') return;
    void ImagePicker.getPendingResultAsync().then((result) => {
      if (result && 'canceled' in result && !result.canceled && result.assets) void processAssets(result.assets);
    });
  }, [processAssets]);

  const chooseGallery = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return showPermissionHelp('gallery', permission.canAskAgain);
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: max - value.length > 1, selectionLimit: max - value.length, quality: 1 });
    if (!result.canceled) await processAssets(result.assets);
  };
  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return showPermissionHelp('camera', permission.canAskAgain);
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
    if (!result.canceled) await processAssets(result.assets);
  };
  const remove = async (index: number) => {
    const image = value[index];
    emitChange(value.filter((_, position) => position !== index));
    try { await discard({ uploadedFileId: image.uploadedFileId }); } catch { /* It may already be linked by a saved record. */ }
  };
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    emitChange(next);
  };
  const cancel = (id: string) => { cancelled.current.add(id); requests.current.get(id)?.abort(); setPending((items) => items.filter((item) => item.id !== id)); };

  return <View style={styles.wrap}>
    <View style={styles.heading}><AppText weight="semibold" style={styles.label}>{label}{required ? ' *' : ''}</AppText><AppText style={styles.count}>{value.length}/{max}</AppText></View>
    {value.map((image, index) => <View key={image.uploadedFileId} style={styles.previewRow}>
      <Image source={{ uri: image.uri }} accessibilityLabel={image.altText} style={styles.preview} />
      <View style={styles.details}><TextInput accessibilityLabel={`Alternative text for image ${index + 1}`} value={image.altText} onChangeText={(altText) => emitChange(value.map((item, position) => position === index ? { ...item, altText } : item))} placeholder="Describe this image" placeholderTextColor={colors.muted} style={styles.altInput} />
        <View style={styles.row}><SmallAction label="Move earlier" icon="arrow-up" disabled={index === 0} onPress={() => move(index, -1)} /><SmallAction label="Move later" icon="arrow-down" disabled={index === value.length - 1} onPress={() => move(index, 1)} /><SmallAction label="Remove image" icon="trash-outline" onPress={() => void remove(index)} /></View>
      </View>
    </View>)}
    {pending.map((item) => <View key={item.id} style={styles.pending}><View style={[styles.progress, { width: `${Math.max(5, item.progress * 100)}%` }]} /><AppText style={item.error ? styles.error : styles.pendingText}>{item.error ?? `Uploading ${item.label}… ${Math.round(item.progress * 100)}%`}</AppText><View style={styles.row}>{item.error && item.retry ? <SmallAction label="Retry upload" icon="refresh" onPress={item.retry} /> : null}<SmallAction label="Cancel upload" icon="close" onPress={() => cancel(item.id)} /></View></View>)}
    {value.length < max ? <View style={styles.actions}><Pressable accessibilityRole="button" onPress={chooseGallery} style={styles.button}><Ionicons name="images-outline" size={20} color={colors.burgundy} /><AppText weight="semibold" style={styles.buttonText}>Choose from Gallery</AppText></Pressable><Pressable accessibilityRole="button" onPress={takePhoto} style={styles.button}><Ionicons name="camera-outline" size={20} color={colors.burgundy} /><AppText weight="semibold" style={styles.buttonText}>Take Photo</AppText></Pressable></View> : null}
    <AppText style={styles.help}>JPEG, PNG, WebP, or phone image. SkillFlow removes metadata, limits the longest edge to 2000 px, and rejects processed files over 5 MB.</AppText>
  </View>;
}

function SmallAction({ label, icon, onPress, disabled }: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={[styles.small, disabled && styles.disabled]}><Ionicons name={icon} size={17} color={colors.burgundy} /></Pressable>;
}

export function normalizedDimensions(width: number, height: number) {
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

async function normalizeImage(asset: ImagePicker.ImagePickerAsset) {
  const size = normalizedDimensions(asset.width, asset.height);
  const result = await manipulateAsync(asset.uri, [{ resize: size }], { compress: 0.88, format: SaveFormat.JPEG });
  const response = await fetch(result.uri);
  const blob = await response.blob();
  if (blob.size > MAX_BYTES) throw new Error('This image is over 5 MB after processing. Choose a smaller image.');
  return { uri: result.uri, width: result.width, height: result.height, blob };
}

function uploadBlob(url: string, blob: Blob, progress: (value: number) => void, register: (request: XMLHttpRequest) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    register(request);
    request.open('POST', url);
    request.setRequestHeader('Content-Type', blob.type || 'image/jpeg');
    request.upload.onprogress = (event) => { if (event.lengthComputable) progress(event.loaded / event.total); };
    request.onerror = () => reject(new Error('Upload failed. Check your connection and retry.'));
    request.onabort = () => reject(new Error('Upload cancelled.'));
    request.onload = () => {
      if (request.status < 200 || request.status >= 300) return reject(new Error('Upload failed. Check your connection and retry.'));
      try { resolve((JSON.parse(request.responseText) as { storageId: string }).storageId); }
      catch { reject(new Error('The upload response was invalid.')); }
    };
    request.send(blob);
  });
}

function upsertPending(items: Pending[], next: Pending) { return [...items.filter((item) => item.id !== next.id), next]; }
function showPermissionHelp(kind: 'gallery' | 'camera', canAskAgain: boolean) {
  Alert.alert(`${kind === 'gallery' ? 'Gallery' : 'Camera'} access needed`, `Allow ${kind} access in your device settings to add an image.`, canAskAgain ? undefined : [{ text: 'Cancel', style: 'cancel' }, { text: 'Open Settings', onPress: () => void Linking.openSettings() }]);
}

const styles = StyleSheet.create({
  wrap: { gap: 10, marginTop: 16 }, heading: { flexDirection: 'row', justifyContent: 'space-between' }, label: { fontSize: 13 }, count: { color: colors.muted, fontSize: 11 },
  previewRow: { flexDirection: 'row', gap: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 8 }, preview: { width: 86, height: 86, borderRadius: 8, backgroundColor: colors.blush }, details: { flex: 1, gap: 7 },
  altInput: { borderWidth: 1, borderColor: colors.border, borderRadius: 7, minHeight: 42, paddingHorizontal: 9, fontFamily: font.regular, fontSize: 11, color: colors.ink }, row: { flexDirection: 'row', gap: 7 }, small: { width: 34, height: 30, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.blush }, disabled: { opacity: 0.35 },
  pending: { minHeight: 54, overflow: 'hidden', borderRadius: 8, borderWidth: 1, borderColor: colors.border, padding: 10, justifyContent: 'center' }, progress: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.greenSoft }, pendingText: { fontSize: 10 }, error: { color: colors.red, fontSize: 10 },
  actions: { flexDirection: 'row', gap: 8 }, button: { flex: 1, minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 9, alignItems: 'center', justifyContent: 'center', gap: 4 }, buttonText: { color: colors.burgundy, fontSize: 9 }, help: { color: colors.muted, fontSize: 9, lineHeight: 14 },
});
