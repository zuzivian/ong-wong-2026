import RsvpFlow from '@/components/rsvp-flow';
import { getVariantMeta, parseVariant } from '@/lib/design-variant';

type RsvpByTokenPageProps = {
  params: {
    token: string;
  };
  searchParams?: {
    v?: string;
  };
};

export default function RsvpByTokenPage({ params, searchParams }: RsvpByTokenPageProps) {
  const variant = parseVariant(searchParams?.v);
  const meta = getVariantMeta(variant);
  return (
    <div className={`theme-page ${meta.themeClass}`}>
      <RsvpFlow initialToken={params.token} variant={variant} />
    </div>
  );
}
