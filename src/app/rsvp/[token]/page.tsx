import RsvpFlow from '@/components/rsvp-flow';
import { getVariantMeta } from '@/lib/design-variant';

type RsvpByTokenPageProps = {
  params: {
    token: string;
  };
};

export default function RsvpByTokenPage({ params }: RsvpByTokenPageProps) {
  const meta = getVariantMeta();
  return (
    <div className={`theme-page ${meta.themeClass}`}>
      <RsvpFlow initialToken={params.token} />
    </div>
  );
}
