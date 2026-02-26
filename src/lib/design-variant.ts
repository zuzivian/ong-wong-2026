export type DesignVariant = 'heirloom' | 'botanical' | 'chapel';

type VariantMeta = {
  label: string;
  heroClass: string;
  stepperClass: string;
  themeClass: string;
  description: string;
};

const VARIANT_META: Record<DesignVariant, VariantMeta> = {
  heirloom: {
    label: 'Heirloom',
    heroClass: 'hero-heirloom',
    stepperClass: 'stepper-heirloom',
    themeClass: 'theme-heirloom',
    description: 'Warm ivory and marigold with formal editorial contrast.',
  },
  botanical: {
    label: 'Botanical',
    heroClass: 'hero-botanical',
    stepperClass: 'stepper-botanical',
    themeClass: 'theme-botanical',
    description: 'Fresh mint and sage with coral accents and airy spacing.',
  },
  chapel: {
    label: 'Chapel',
    heroClass: 'hero-chapel',
    stepperClass: 'stepper-chapel',
    themeClass: 'theme-chapel',
    description: 'Powder blue and navy with gilded details and crisp hierarchy.',
  },
};

export function parseVariant(value: string | undefined): DesignVariant {
  if (value === 'botanical' || value === 'chapel' || value === 'heirloom') {
    return value;
  }
  return 'heirloom';
}

export function getVariantMeta(variant: DesignVariant): VariantMeta {
  return VARIANT_META[variant];
}

export function listVariants(): DesignVariant[] {
  return ['heirloom', 'botanical', 'chapel'];
}
