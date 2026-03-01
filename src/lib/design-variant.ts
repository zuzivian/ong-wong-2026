type VariantMeta = {
  label: string;
  heroClass: string;
  stepperClass: string;
  themeClass: string;
  description: string;
};

const HEIRLOOM_META: VariantMeta = {
  label: 'Heirloom',
  heroClass: 'hero-heirloom',
  stepperClass: 'stepper-heirloom',
  themeClass: 'theme-heirloom',
  description: 'Warm ivory and marigold with formal editorial contrast.',
};

export function getVariantMeta(): VariantMeta {
  return HEIRLOOM_META;
}
