import RsvpFlow from '@/components/rsvp-flow';
import { getVariantMeta, parseVariant } from '@/lib/design-variant';

type RsvpPageProps = {
  searchParams?: {
    v?: string;
  };
};

export default function RsvpPage({ searchParams }: RsvpPageProps) {
  const variant = parseVariant(searchParams?.v);
  const meta = getVariantMeta(variant);
  return (
    <div className={`theme-page ${meta.themeClass}`}>
      <RsvpFlow variant={variant} />
    </div>
  );
}
