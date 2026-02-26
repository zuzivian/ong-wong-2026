import Icon from '@/components/icon';

export default function FaqPage() {
  const items = [
    {
      question: 'What time should guests arrive for the service?',
      answer:
        'Please plan to arrive when doors open at W and be seated by X so the service can begin promptly at Y.',
    },
    {
      question: 'Where is the ceremony and reception venue located?',
      answer:
        'Both ceremony and reception are at The Singapore Thomson Road Baptist Church, 45 Thomson Road, Singapore 307584.',
    },
    {
      question: 'Is parking available at or near the venue?',
      answer:
        'Limited parking may be available at the venue. Guests may also use nearby parking alternatives if needed.',
    },
    {
      question: 'How should dietary requirements be submitted?',
      answer:
        'Please include dietary details in your RSVP flow under the “Dietary and Contact” step.',
    },
    {
      question: 'May I bring a companion or family member?',
      answer:
        'If your invitation allows loved ones, you may add them during the “Add Loved Ones” step in RSVP.',
    },
    {
      question: 'Whom should I contact if I need assistance?',
      answer:
        'You may send questions through your Guest Dashboard message form and we will respond as soon as possible.',
    },
  ];

  return (
    <>
      <section className="page-head">
        <h1 className="heading-with-icon">
          <Icon name="help" className="heading-icon" />
          <span>Frequently Asked Questions</span>
        </h1>
        <p>Formal guidance for guests. More details will be added in due course.</p>
      </section>

      <section className="card">
        <ol className="faq-list">
          {items.map((item) => (
            <li key={item.question}>
              <h2 className="heading-with-icon">
                <Icon name="chevron_right" className="heading-icon" />
                <span>{item.question}</span>
              </h2>
              <p>{item.answer}</p>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
