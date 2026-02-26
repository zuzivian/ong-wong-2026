import Link from 'next/link';
import { getVariantMeta, listVariants } from '@/lib/design-variant';

export default function DesignLabPage() {
  const variants = listVariants();

  return (
    <>
      <section className="page-head">
        <h1>Design Lab</h1>
        <p>
          Compare three concrete style directions for the Home hero and RSVP stepper.
        </p>
      </section>

      <section className="card">
        <ol className="variant-list">
          {variants.map((variant) => {
            const meta = getVariantMeta(variant);
            return (
              <li key={variant} className={`scheme-preview ${meta.themeClass}`}>
                <h2>{meta.label}</h2>
                <p>{meta.description}</p>
                <div className="scheme-swatches" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
                <div className="cta-row">
                  <Link href={`/?v=${variant}`} className="button-secondary">
                    Preview Home
                  </Link>
                  <Link href={`/rsvp?v=${variant}`} className="button-secondary">
                    Preview RSVP
                  </Link>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </>
  );
}
