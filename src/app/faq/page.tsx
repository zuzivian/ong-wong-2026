import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import Icon from '@/components/icon';
import { UNLOCK_COOKIE_NAME, verifyUnlockSession } from '@/lib/invite-unlock';

export default async function FaqPage() {
  const cookieStore = await cookies();
  const unlockCookie = cookieStore.get(UNLOCK_COOKIE_NAME)?.value;
  if (!(await verifyUnlockSession(unlockCookie))) {
    redirect('/');
  }
  const items = [
    {
      question: 'What is the dress code for the wedding?',
      answer:
        'The dress code is semi-formal. As this is a church wedding, please dress appropriately.',
    },
    {
      question: 'I have dietary requirements, will I be able to enjoy the lunch reception?',
      answer:
        'The buffet lunch is Halal, with some vegetarian options. Please include dietary details in your RSVP form to inform us of any other dietary requirements.',
    },
    {
      question: 'May I bring a companion or family member?',
      answer:
        'As we have limited seating, we are unable to extend an invitation to all plus ones. If you’d like to bring a guest, please reach out to us to clarify.',
    },
    {
      question: 'I have changes to my RSVP, can I update my RSVP after I have submitted it?',
      answer:
        'Yes, you may revisit your RSVP and make updates. For changes after 28 April 2026, please also reach out to Samuel or Natasha.',
    },
  ];

  return (
    <>
      <section className="section-band section-band-title">
        <div className="container page-head">
          <h1 className="heading-with-icon">
            <Icon name="help" className="heading-icon" />
            <span>Frequently Asked Questions</span>
          </h1>
        </div>
      </section>

      <section className="section-band">
        <div className="container card faq-shell">
          <ol className="faq-page-list">
            {items.map((item) => (
              <li key={item.question} className="faq-item">
                <h2 className="heading-with-icon faq-question">
                  <Icon name="chevron_right" className="heading-icon" />
                  <span>{item.question}</span>
                </h2>
                <p className="faq-answer">{item.answer}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}
