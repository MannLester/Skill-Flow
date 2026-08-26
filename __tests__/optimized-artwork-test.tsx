import { render } from '@testing-library/react-native';
import { Image } from 'react-native';

import { ServiceArtwork } from '@/components/optimized-artwork';

describe('optimized artwork', () => {
  it('uses an immediately rendered, downsample-friendly native image', () => {
    const screen = render(<ServiceArtwork serviceId="logo" style={{ width: 82, aspectRatio: 1 }} />);
    const image = screen.UNSAFE_getByType(Image);

    expect(image.props.fadeDuration).toBe(0);
    expect(image.props.resizeMethod).toBe('resize');
    expect(image.props.resizeMode).toBe('cover');
  });

  it('falls back to bounded local artwork for newly created services', () => {
    const known = render(<ServiceArtwork serviceId="logo" />).UNSAFE_getByType(Image);
    const fallback = render(<ServiceArtwork serviceId="local-demo-service" />).UNSAFE_getByType(Image);

    expect(fallback.props.source).toBe(known.props.source);
  });
});
