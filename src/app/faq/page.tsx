import Icon from '@/components/icon';

export default function FaqPage() {
  const items = [
    {
      question: 'What time should guests arrive for the service?',
      answer:
        'Please plan to arrive when doors open at 9:30 AM and try to be seated by 9:50 AM. The service will begin promptly at 10:00 AM, and arriving a little earlier will help everyone settle in comfortably. Thank you for helping us keep the start peaceful and on time.',
    },
    {
      question: 'Where is the ceremony and reception venue located?',
      answer:
        'Both the ceremony and reception will be held at The Singapore Thomson Road Baptist Church, 45 Thomson Road, Singapore 307584. You only need to head to one venue for the full celebration. We are grateful to share the whole day with you in one place.',
    },
    {
      question: 'Is parking available at or near the venue?',
      answer:
        'Limited parking may be available at the venue, so we recommend allowing a little extra time just in case. There are nearby parking alternatives if church lots are full. If you prefer not to drive, taxis and ride-hailing are also convenient options.',
    },
    {
      question: 'What is the dress code for the wedding?',
      answer:
        'The dress code is smart and respectful, suitable for a church service and lunch reception. Light, comfortable formalwear is a safe choice for the daytime setting. Most importantly, please come in something that helps you feel present and joyful with us.',
    },
    {
      question: 'How should dietary requirements be submitted?',
      answer:
        'Please include dietary details in your RSVP during the "Dietary Requirements" step. If your needs change later, you can update your RSVP again before the global cutoff date. We truly want everyone to be cared for well, so thank you for sharing this clearly.',
    },
    {
      question: 'May I bring a companion or family member?',
      answer:
        'If your invitation allows loved ones, you can add them during the "Add Loved Ones" step in RSVP. The form will guide you based on your invitation settings, including companion limits if applicable. If you are unsure, feel free to send us a message through the dashboard and we will gladly help.',
    },
    {
      question: 'Can I update my RSVP after I submit it?',
      answer:
        'Yes, you may revisit your RSVP and make updates while edits are still open. Availability depends on the global RSVP cutoff date set for planning and catering. If you need help with a change, please send a message and we will do our best to assist quickly.',
    },
    {
      question: 'I cannot find my invite code. What should I do?',
      answer:
        'Please check your invitation message first and confirm your first and last name spelling. If you still cannot unlock your access, send us a quick note through the contact path available to you. We will help verify your details so you can continue without stress.',
    },
    {
      question: 'Will there be seating arrangements during lunch?',
      answer:
        'A simple seating arrangement may be prepared to help guests settle in smoothly. Final details will be adjusted based on confirmed RSVPs. We appreciate your patience and will share any important updates closer to the wedding date.',
    },
    {
      question: 'May we take photos and videos during the celebration?',
      answer:
        'You are warmly welcome to take photos and short videos, and we are thankful for the memories you capture. During key moments in the service, we kindly ask guests to be mindful and avoid blocking views. Your thoughtfulness helps keep the atmosphere reverent and meaningful for everyone.',
    },
    {
      question: 'Whom should I contact if I need assistance?',
      answer:
        'Please send questions through the message form in your Guest Information page. We will respond as soon as possible and do our best to support what you need. Thank you for your patience and kindness as we coordinate final details.',
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
          <p>
            Thank you for celebrating with us. We have gathered practical answers here to make your
            visit smooth, comfortable, and joyful.
          </p>
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
