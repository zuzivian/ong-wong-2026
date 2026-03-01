import RsvpFlow from '@/components/rsvp-flow';
import { getVariantMeta } from '@/lib/design-variant';

export default function RsvpPage() {
  const meta = getVariantMeta();
  return (
    <div className={`theme-page ${meta.themeClass}`}>
      <RsvpFlow />
    </div>
  );
}
