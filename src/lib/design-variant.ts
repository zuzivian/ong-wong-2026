type VariantMeta = {
  label: string;
  heroClass: string;
  stepperClass: string;
  themeClass: string;
  description: string;
};

const HEIRLOOM_META: VariantMeta = {
  label: 'Editorial',
  heroClass: 'hero-editorial',
  stepperClass: 'stepper-editorial',
  themeClass: 'theme-editorial',
  description: 'Soft editorial minimalism with modern typography and restrained romance.',
};

export function getVariantMeta(): VariantMeta {
  return HEIRLOOM_META;
}
